// Synthetic public-key state only. Real SQLite tests use new disposable private
// directories, never a configured database, browser profile, key source or socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtempSync,rmSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAccessKeysetLifecycle} from '../simulation/access-keyset-lifecycle.mjs';
import {createSigningKeyCheckpointStore} from '../simulation/signing-key-checkpoint-store.mjs';
import {createDurableAccessKeysetOwner} from '../simulation/durable-access-keyset-owner.mjs';

const keys=Array.from({length:2},()=>generateKeyPairSync('rsa',{modulusLength:2048}));
const digest=value=>createHash('sha256').update(value).digest('hex');
const publicKey=(index=0,kid='key-'+index)=>({...keys[index].publicKey.export({format:'jwk'}),kid});
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function fixture(){
  let now=100000,onClock=null;
  const config={issuer:'https://synthetic-owner.cloudflareaccess.com',audience:'synthetic-audience',
    allowedSubjects:['synthetic-subject'],expectedHost:'api1.example.test',maxOverlapSeconds:20,
    clock:()=>{onClock?.();return now;}};
  const payload=JSON.stringify(createAccessKeysetLifecycle(config).exportCheckpoint().checkpoint);
  const update=(generation=1,publicJwks=[publicKey()],revokedKids=[])=>
    ({generation,observedAtSeconds:now,publicJwks,revokedKids});
  const request=(index=0)=>{
    const body=encode({alg:'RS256',typ:'JWT',kid:'key-'+index})+'.'+encode({
      iss:config.issuer,aud:[config.audience],sub:config.allowedSubjects[0],type:'app',
      iat:99990,nbf:99990,exp:100600});
    const token=body+'.'+sign('RSA-SHA256',Buffer.from(body),keys[index].privateKey).toString('base64url');
    return {method:'POST',path:'/mcp',rawHeaders:['Host',config.expectedHost,'Content-Type',
      'application/json','Cf-Access-Jwt-Assertion',token],body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})};
  };
  return {config,payload,update,request,setTime:value=>{now=value;},setClockHook:value=>{onClock=value;}};
}
function fakeStore(payload,{revision=1,storeId='synthetic-owner-store'}={}){
  let head=Object.freeze({storeId,revision,payload,sha256:digest(payload)}),closed=false,writes=0;
  const control={before:null,after:null,readHook:null};
  const store={
    read(){if(closed)throw Error('closed');return control.readHook?control.readHook(head):head;},
    compareAndSwap({expectedRevision,expectedSha256,payload:next}){
      if(closed)throw Error('closed');writes++;
      if(head.revision!==expectedRevision||head.sha256!==expectedSha256)
        throw Object.assign(Error('synthetic conflict'),{code:'STATE_CAS_CONFLICT'});
      control.before?.();
      head=Object.freeze({storeId,revision:head.revision+1,payload:next,sha256:digest(next)});
      return control.after?control.after(head):head;
    },
    close(){closed=true;}
  };
  return {store,control,head:()=>head,writes:()=>writes,closed:()=>closed,
    replace:next=>{head=Object.freeze({...next});}};
}
function noAuthority(value){
  for(const field of ['admissionAuthorized','executionAuthorized','trustedIngressVerified','keyLifecycleRuntimeVerified'])
    assert.equal(value[field],false,field);
  assert.equal(value.requiresIndependentRollbackAnchor,true);
  assert.ok(Object.isFrozen(value));
}
function review(value){noAuthority(value);assert.equal(value.decision,'STRUCTURE_REVIEWABLE');assert.equal(value.checkpointCommitAcknowledged,true);}
function denied(value,reason){noAuthority(value);assert.equal(value.decision,'DENY');if(reason)assert.equal(value.reason,reason);}
function own(t,f,storage,options={}){
  const owner=createDurableAccessKeysetOwner(f.config,{store:storage.store,...options});
  t.after(()=>owner.close());return owner;
}
function directory(t){
  const path=mkdtempSync(join(tmpdir(),'omnipilot-owner-test-'));chmodSync(path,0o700);
  t.after(()=>rmSync(path,{recursive:true,force:true}));return path;
}

test('recovery starts held; publication activates only after a matching complete checkpoint receipt',t=>{
  const f=fixture(),s=fakeStore(f.payload),owner=own(t,f,s);
  assert.equal(owner.diagnostics().freshPublicationRequired,true);
  assert.equal(owner.status().decision,'HOLD');
  let nested;
  s.control.before=()=>{
    assert.equal(owner.diagnostics().lastAcknowledgedRevision,2);
    nested=owner.assess(f.request());
  };
  const published=owner.publish(f.update());
  review(published);denied(nested,'OWNER_BUSY');
  assert.equal(owner.diagnostics().freshPublicationRequired,false);
  assert.equal(published.checkpointRevision,3);
  assert.equal(JSON.parse(s.head().payload).generation,1);
  s.control.before=null;
  review(owner.assess(f.request()));
  assert.equal(owner.diagnostics().lastAcknowledgedRevision,s.head().revision);
});

test('refused publication, status and assessment clock observations are persisted before returning',t=>{
  const f=fixture(),s=fakeStore(f.payload),owner=own(t,f,s);
  review(owner.publish(f.update()));
  f.setTime(100010);
  const refused=owner.publish(f.update(1));
  denied(refused,'GENERATION_NOT_ADVANCING');assert.equal(refused.checkpointCommitAcknowledged,true);
  assert.equal(JSON.parse(s.head().payload).generation,1);
  assert.equal(JSON.parse(s.head().payload).lastClock,100010);
  f.setTime(100020);review(owner.status());
  assert.equal(JSON.parse(s.head().payload).lastClock,100020);
  f.setTime(100030);review(owner.assess(f.request()));
  assert.equal(JSON.parse(s.head().payload).lastClock,100030);
});

test('known conflict halts without promoting the staged publication or retrying',t=>{
  const f=fixture(),s=fakeStore(f.payload),owner=own(t,f,s);
  s.replace({...s.head(),revision:2});
  const failed=owner.publish(f.update());
  denied(failed,'OWNER_HALTED');assert.equal(failed.haltReason,'CHECKPOINT_CONFLICT');
  assert.equal(failed.checkpointWriteOutcomeUnknown,false);
  assert.equal(owner.diagnostics().lastAcknowledgedRevision,1);
  assert.equal(JSON.parse(s.head().payload).generation,0);
  const calls=s.writes();denied(owner.publish(f.update()),'OWNER_HALTED');
  denied(owner.assess(f.request()),'OWNER_HALTED');assert.equal(s.writes(),calls);
});

test('failure before commit never exposes the candidate and preserves the prior checkpoint',t=>{
  const f=fixture(),s=fakeStore(f.payload),owner=own(t,f,s);
  s.control.before=()=>{throw Error('PRIVATE_PATH_AND_SYNTHETIC_SECRET');};
  const failed=owner.publish(f.update());
  denied(failed,'OWNER_HALTED');assert.equal(failed.checkpointCommitAcknowledged,false);
  assert.equal(s.head().payload,f.payload);assert.equal(owner.diagnostics().lastAcknowledgedRevision,1);
  assert.ok(!JSON.stringify(failed).includes('PRIVATE_PATH'));
  assert.ok(!JSON.stringify(failed).includes(publicKey().n));
});

test('lost acknowledgment after commit halts; explicit recovery preserves committed state and requires refresh',t=>{
  const f=fixture(),s=fakeStore(f.payload),owner=own(t,f,s);
  s.control.after=()=>{throw Object.assign(Error('ack lost'),{code:'STATE_WRITE_OUTCOME_UNKNOWN'});};
  const failed=owner.publish(f.update());
  denied(failed,'OWNER_HALTED');assert.equal(failed.checkpointWriteOutcomeUnknown,true);
  assert.equal(s.head().revision,2);assert.equal(JSON.parse(s.head().payload).generation,1);
  assert.equal(owner.diagnostics().lastAcknowledgedRevision,1);
  denied(owner.status(),'OWNER_HALTED');
  const recoveredStore=fakeStore(s.head().payload,{revision:2});
  const recovered=own(t,f,recoveredStore);
  assert.equal(recovered.status().decision,'HOLD');
  denied(recovered.publish(f.update(1)),'GENERATION_NOT_ADVANCING');
  f.setTime(100001);review(recovered.publish(f.update(2)));review(recovered.assess(f.request()));
});

test('wrong revision, identity, digest or payload in acknowledgment halts without promotion',t=>{
  for(const alter of [head=>({...head,revision:head.revision+1}),head=>({...head,storeId:'different-store'}),
    head=>({...head,sha256:'0'.repeat(64)}),head=>({...head,payload:fallbackPayload()})]){
    const f=fixture(),s=fakeStore(f.payload),owner=own(t,f,s);
    s.control.after=alter;
    const result=owner.publish(f.update());
    denied(result,'OWNER_HALTED');assert.equal(result.checkpointWriteOutcomeUnknown,true);
    assert.equal(owner.diagnostics().lastAcknowledgedRevision,1);
  }
  function fallbackPayload(){return '{"unrelated":"synthetic"}';}
});

test('an asynchronous store acknowledgment cannot activate or reopen this synchronous owner',async t=>{
  const f=fixture(),s=fakeStore(f.payload),owner=own(t,f,s);
  s.control.after=()=>Promise.reject(Error('SYNTHETIC_ASYNC_FAILURE'));
  const result=owner.publish(f.update());
  denied(result,'OWNER_HALTED');assert.equal(result.checkpointWriteOutcomeUnknown,true);
  await new Promise(resolve=>setImmediate(resolve));
  denied(owner.status(),'OWNER_HALTED');assert.equal(owner.diagnostics().lastAcknowledgedRevision,1);
});

test('recovery rejects noncanonical, duplicate-member and tampered checkpoint bytes',()=>{
  const f=fixture();
  const duplicate=f.payload.replace('"generation":0','"generation":0,"generation":0');
  assert.notEqual(duplicate,f.payload);
  for(const payload of [' '+f.payload,duplicate,'{"unknown":true}']){
    const s=fakeStore(payload);
    assert.throws(()=>createDurableAccessKeysetOwner(f.config,{store:s.store}),/OWNER_RECOVERY_REFUSED/);
    assert.equal(s.closed(),true);
  }
  const s=fakeStore(f.payload);s.control.readHook=head=>({...head,sha256:'0'.repeat(64)});
  assert.throws(()=>createDurableAccessKeysetOwner(f.config,{store:s.store}),/OWNER_RECOVERY_REFUSED/);
});

test('accessor receipts are refused without reading their payload getter',()=>{
  const f=fixture(),s=fakeStore(f.payload);let reads=0;
  s.control.readHook=head=>{const output={...head};Object.defineProperty(output,'payload',{enumerable:true,get(){reads++;throw Error('SECRET');}});return output;};
  assert.throws(()=>createDurableAccessKeysetOwner(f.config,{store:s.store}),/OWNER_RECOVERY_REFUSED/);
  assert.equal(reads,0);
});

test('one handle has one owner; close is permanent and does not close it twice',t=>{
  const f=fixture(),s=fakeStore(f.payload),owner=own(t,f,s);
  assert.throws(()=>createDurableAccessKeysetOwner(f.config,{store:s.store}),/OWNER_STORE_ALREADY_OWNED/);
  review(owner.publish(f.update()));
  owner.close();owner.close();
  denied(owner.publish(f.update(2)),'OWNER_CLOSED');assert.equal(owner.diagnostics().ownerState,'closed');
  assert.equal(owner.diagnostics().storeCloseAcknowledged,true);
});

test('reentrant close from the trusted clock prevents any subsequent checkpoint write',t=>{
  const f=fixture(),s=fakeStore(f.payload),owner=own(t,f,s);
  f.setClockHook(()=>owner.close());
  denied(owner.status(),'OWNER_CLOSED');assert.equal(s.writes(),0);
  assert.equal(owner.diagnostics().lastAcknowledgedRevision,1);
});

test('reentrant close during a committed acknowledgment cannot reactivate or return reviewable state',t=>{
  const f=fixture(),s=fakeStore(f.payload),owner=own(t,f,s);
  s.control.after=head=>{owner.close();return head;};
  const result=owner.publish(f.update());
  denied(result,'OWNER_CLOSED');assert.equal(result.checkpointWriteOutcomeUnknown,true);
  assert.equal(owner.diagnostics().lastAcknowledgedRevision,1);
  denied(owner.assess(f.request()),'OWNER_CLOSED');
});

test('revision exhaustion refuses before staging or writing',t=>{
  const f=fixture(),s=fakeStore(f.payload,{revision:Number.MAX_SAFE_INTEGER}),owner=own(t,f,s);
  const result=owner.publish(f.update());
  denied(result,'OWNER_HALTED');assert.equal(result.haltReason,'CHECKPOINT_REVISION_EXHAUSTED');
  assert.equal(s.writes(),0);
});

test('real SQLite restart retains revoked identities and requires a fresh publication',t=>{
  const f=fixture(),filename=join(directory(t),'keys.sqlite'),storeId='synthetic-sqlite-owner';
  const store=createSigningKeyCheckpointStore(filename,{mode:'create',storeId,
    floor:{revision:0,sha256:null},initialPayload:f.payload});
  const owner=createDurableAccessKeysetOwner(f.config,{store});
  t.after(()=>owner.close());
  review(owner.publish(f.update(1)));
  f.setTime(100010);review(owner.publish(f.update(2,[publicKey(1)])));
  f.setTime(100011);review(owner.publish(f.update(3,[publicKey(1)],['key-0'])));
  const floor=store.read();owner.close();
  const recoveredStore=createSigningKeyCheckpointStore(filename,{mode:'open',storeId,
    floor:{revision:floor.revision,sha256:floor.sha256}});
  const recovered=createDurableAccessKeysetOwner(f.config,{store:recoveredStore,
    minimumGeneration:3,minimumClockSeconds:100011});
  t.after(()=>recovered.close());
  assert.equal(recovered.status().decision,'HOLD');
  f.setTime(100012);review(recovered.publish(f.update(4,[publicKey(1)])));
  denied(recovered.assess(f.request(0)),'REQUEST_DENIED');review(recovered.assess(f.request(1)));
  denied(recovered.publish(f.update(5,[publicKey(0)])),'KEY_RETIRED_OR_REVOKED');
  assert.equal(JSON.parse(recoveredStore.read().payload).generation,4);
  assert.equal(JSON.parse(recoveredStore.read().payload).history.find(x=>x.jwk.kid==='key-0').state,'revoked');
});

test('real SQLite restart preserves clock-only advancement after a refused request',t=>{
  const f=fixture(),filename=join(directory(t),'clock.sqlite'),storeId='synthetic-clock-owner';
  const store=createSigningKeyCheckpointStore(filename,{mode:'create',storeId,
    floor:{revision:0,sha256:null},initialPayload:f.payload});
  const owner=createDurableAccessKeysetOwner(f.config,{store});t.after(()=>owner.close());
  review(owner.publish(f.update(1)));
  f.setTime(100050);denied(owner.assess({method:'GET'}),'REQUEST_DENIED');
  const floor=store.read();assert.equal(JSON.parse(floor.payload).lastClock,100050);owner.close();
  f.setTime(100040);
  const reopened=createSigningKeyCheckpointStore(filename,{mode:'open',storeId,
    floor:{revision:floor.revision,sha256:floor.sha256}});
  const recovered=createDurableAccessKeysetOwner(f.config,{store:reopened});t.after(()=>recovered.close());
  denied(recovered.publish(f.update(2)),'CLOCK_REJECTED');
  assert.equal(JSON.parse(reopened.read().payload).lastClock,100050);
});

test('asynchronous close is consumed and never acknowledged as synchronous completion',async()=>{
  const f=fixture(),s=fakeStore(f.payload,{storeId:'api1.keyset:fixture'});
  s.store.close=()=>Promise.reject(Error('SYNTHETIC_CLOSE_FAILURE'));
  const owner=createDurableAccessKeysetOwner(f.config,{store:s.store});
  const result=owner.close();
  assert.equal(result.ownerState,'closed');assert.equal(result.storeCloseAcknowledged,false);
  await new Promise(resolve=>setImmediate(resolve));
  denied(owner.status(),'OWNER_CLOSED');
});

test('recovery-failure cleanup consumes asynchronous close rejection',async()=>{
  const f=fixture(),s=fakeStore('{"invalid":true}');
  s.store.close=()=>Promise.reject(Error('SYNTHETIC_RECOVERY_CLOSE_FAILURE'));
  assert.throws(()=>createDurableAccessKeysetOwner(f.config,{store:s.store}),/OWNER_RECOVERY_REFUSED/);
  await new Promise(resolve=>setImmediate(resolve));
});
