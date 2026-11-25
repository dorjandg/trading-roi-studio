import test from 'node:test';
import assert from 'node:assert/strict';
import {createIsolatedRevocationFence}
  from '../src/omnipilot-revocation-fence.mjs';

const grantId='00000000-0000-4000-8000-000000000001',subjectKey='a'.repeat(64);
const sessionA='browser-session-00001',sessionB='browser-session-00002';
const later=()=>{let resolve;const promise=new Promise(ok=>resolve=ok);return {resolve,promise}};
function setup(options={}){
  let row={grantId,subjectKey,revision:2,status:'ACTIVE',
    expiresAtMs:Date.now()+600000};
  let reads=0,persists=0,closed=[];
  const callbacks={
    async loadCurrent(){
      reads++;
      if(options.loadCurrent)return options.loadCurrent(row);
      return row;
    },
    async persistRevocation(input){
      persists++;
      if(options.persistRevocation)return options.persistRevocation(input);
      row={...row,status:'REVOKED',revision:3};
      return {grantId,status:'REVOKED',revision:3};
    },
    async closeOwnedSession(id){
      closed.push(id);
      if(options.closeOwnedSession)return options.closeOwnedSession(id);
      return {status:'closed'};
    }
  };
  return {fence:createIsolatedRevocationFence({
    grantId,subjectKey,revision:2,...callbacks
  }),get reads(){return reads},get persists(){return persists},
    get closed(){return [...closed]},
    set row(r){row=r}};
}
const failed=(promise,code)=>assert.rejects(promise,{code});
test('owned session is registered after fresh grant authorization',async()=>{
  const b=setup();
  assert.deepEqual(await b.fence.register(sessionA),
    {grantId,revision:2,registered:true});
  const result=await b.fence.runStep(sessionA,async x=>({
    kind:'read',session:x.sessionId
  }));
  assert.equal(result.completed,true);
  assert.equal(result.result.session,sessionA);
  assert.equal(b.reads,3);
  assert.equal(b.fence.inspect().activeSessions,1);
  assert.equal(b.fence.inspect().mode,'ACTIVE');
});
test('revoke starts barrier before storage call and closes all owned sessions',async()=>{
  const pending=later(),b=setup({async persistRevocation(){
    return pending.promise;
  }});
  await b.fence.register(sessionA);
  await b.fence.register(sessionB);
  const revoked=b.fence.revoke();
  assert.equal(b.fence.inspect().mode,'REVOKING');
  await failed(b.fence.runStep(sessionA,async()=>{}),'FENCE_REVOKED_OR_BLOCKED');
  await failed(b.fence.register('browser-session-00003'),'FENCE_REVOKED_OR_BLOCKED');
  pending.resolve({grantId,status:'REVOKED',revision:3});
  const x=await revoked;
  assert.equal(x.completed,true);
  assert.equal(x.closedSessions,2);
  assert.equal(b.fence.inspect().mode,'REVOKED');
  assert.equal(b.fence.inspect().activeSessions,0);
  assert.deepEqual(b.closed.sort(),[sessionA,sessionB].sort());
  assert.equal(await b.fence.revoke(),x); // No double persistent revocation.
  assert.equal(b.persists,1);
});
test('in-flight result is never reported successful after revocation starts',async()=>{
  const started=later(),finish=later();
  const b=setup();
  await b.fence.register(sessionA);
  const running=b.fence.runStep(sessionA,async()=>{
    started.resolve();
    return finish.promise;
  });
  await started.promise;
  const ended=await b.fence.revoke();
  assert.equal(ended.closedSessions,1);
  finish.resolve('action-may-have-run');
  await failed(running,'FENCE_REVOKED_OR_BLOCKED');
  assert.equal(b.fence.inspect().mode,'REVOKED');
});
test('revocation begun while a primary grant read is pending prevents registration',async()=>{
  const read=later();
  const b=setup({loadCurrent:async()=>read.promise});
  const registering=b.fence.register(sessionA);
  const stop=b.fence.revoke();
  assert.equal(b.fence.inspect().mode,'REVOKING');
  read.resolve({grantId,subjectKey,revision:2,status:'ACTIVE',
    expiresAtMs:Date.now()+600000});
  await assert.rejects(registering,e=>['FENCE_REVOKED_OR_BLOCKED',
    'FENCE_GRANT_NOT_ACTIVE'].includes(e?.code));
  assert.equal((await stop).closedSessions,0);
});
test('unknown durable revocation commit blocks the owner permanently',async()=>{
  const b=setup({persistRevocation:async()=>{
    throw Error('private database error');
  }});
  await b.fence.register(sessionA);
  await failed(b.fence.revoke(),'FENCE_REVOCATION_COMMIT_UNCERTAIN');
  assert.equal(b.fence.inspect().mode,'BLOCKED');
  await failed(b.fence.register(sessionB),'FENCE_REVOKED_OR_BLOCKED');
  await failed(b.fence.runStep(sessionA,async()=>{}),'FENCE_REVOKED_OR_BLOCKED');
  await failed(b.fence.revoke(),'FENCE_REVOCATION_COMMIT_UNCERTAIN');
  assert.equal(b.persists,1);
});
test('session-close failure cannot be reported as completed revocation',async()=>{
  const b=setup({closeOwnedSession:async()=>({status:'closing'})});
  await b.fence.register(sessionA);
  await failed(b.fence.revoke(),'FENCE_SESSION_CLEANUP_UNCERTAIN');
  assert.equal(b.fence.inspect().mode,'BLOCKED');
  assert.equal(b.fence.inspect().activeSessions,1);
  await failed(b.fence.register(sessionB),'FENCE_REVOKED_OR_BLOCKED');
});
test('independent revocation or stale grant invalidates new steps',async()=>{
  const b=setup();
  await b.fence.register(sessionA);
  b.row={grantId,subjectKey,revision:3,status:'REVOKED',
    expiresAtMs:Date.now()+600000};
  let performed=0;
  await failed(b.fence.runStep(sessionA,async()=>performed++),
    'FENCE_GRANT_NOT_ACTIVE');
  assert.equal(performed,0);
});
test('fail-closed session validation and concurrent step denial',async()=>{
  assert.throws(()=>createIsolatedRevocationFence({
    grantId:'untrusted',subjectKey,revision:2,loadCurrent:async()=>null,
    persistRevocation:async()=>null,closeOwnedSession:async()=>null
  }),{code:'FENCE_CONFIG_INVALID'});
  const b=setup();await b.fence.register(sessionA);
  await failed(b.fence.register(sessionA),'FENCE_SESSION_REFUSED');
  await failed(b.fence.register('short'),'FENCE_SESSION_REFUSED');
  const active=later(),started=later();
  const first=b.fence.runStep(sessionA,async()=>{
    started.resolve();return active.promise;
  });
  await started.promise;
  await failed(b.fence.runStep(sessionA,async()=>{}),'FENCE_ACTION_REFUSED');
  active.resolve('ok');
  assert.equal((await first).completed,true);
});
