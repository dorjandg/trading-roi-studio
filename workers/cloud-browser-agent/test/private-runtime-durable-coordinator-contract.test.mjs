import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewDurableCoordinatorTranscript as review} from '../simulation/private-runtime-durable-coordinator-contract.mjs';

const D = c => c.repeat(64), resourceId='synthetic-tunnel';
const old={ownerId:'old-owner',generationId:'old-gen',leaseId:'old-lease',fencingEpoch:7,expiresAtMs:5000};
const retired={ownerId:'old-owner',generationId:'old-gen',leaseId:'old-lease',fencingEpoch:7,receiptDigest:D('d')};
const base={schemaVersion:1,resourceId,revision:10,fencingEpoch:7,mode:'HELD',
  holder:old,retired:null,commitIndex:50,headDigest:D('a')};
const retiring={...base,revision:11,mode:'RETIRING',commitIndex:51,headDigest:D('b')};
const vacant={...retiring,revision:12,mode:'VACANT',holder:null,retired,commitIndex:52,headDigest:D('c')};
const newlyHeld={...vacant,revision:13,fencingEpoch:8,mode:'HELD',
  holder:{ownerId:'new-owner',generationId:'new-gen',leaseId:'new-lease',fencingEpoch:8,expiresAtMs:8000},
  commitIndex:53,headDigest:D('e')};
const renewed={...newlyHeld,revision:14,holder:{...newlyHeld.holder,expiresAtMs:9000},commitIndex:54,headDigest:D('f')};
const op=(kind,before,overrides={})=>({txId:'synthetic-tx-1',kind,resourceId,
  expectedRevision:before.revision,expectedEpoch:before.fencingEpoch,
  ownerId:kind==='ACQUIRE'||kind==='RENEW'?'new-owner':'old-owner',
  generationId:kind==='ACQUIRE'||kind==='RENEW'?'new-gen':'old-gen',
  leaseId:kind==='ACQUIRE'||kind==='RENEW'?'new-lease':'old-lease',
  nextExpiresAtMs:kind==='ACQUIRE'?8000:kind==='RENEW'?9000:null,
  retirementDigest:kind==='ACQUIRE'||kind==='PUBLISH_RETIREMENT'?D('d'):null,...overrides});
const envelope=(before,after,kind,override={})=>{
  const operation=op(kind,before);
  return {before,after,operation,receipt:{txId:operation.txId,kind,result:'APPLIED',
    expectedRevision:before.revision,expectedEpoch:before.fencingEpoch,
    coordinatorId:'synthetic-coordinator',commitIndex:after.commitIndex,
    previousDigest:before.headDigest,recordDigest:after.headDigest,
    observedAtMs:2000,durability:'coordinator-asserted'},nowMs:2100,maxAgeMs:500,...override};
};
const valid=[envelope(base,retiring,'BEGIN_RETIRE'),
  envelope(retiring,vacant,'PUBLISH_RETIREMENT'),
  envelope(vacant,newlyHeld,'ACQUIRE'),envelope(newlyHeld,renewed,'RENEW')];
const copy=x=>structuredClone(x);
const hold=(input,code)=>{const x=review(input);assert.equal(x.decision,'HOLD');assert.ok(x.issues.includes(code),JSON.stringify(x.issues));assert.equal(x.leaseGranted,false);};

test('all four synthetically consistent transitions are only STRUCTURE_REVIEWABLE',()=>{
  for(const t of valid){const input=copy(t),before=copy(input),r=review(input);
    assert.equal(r.decision,'STRUCTURE_REVIEWABLE',t.operation.kind+': '+r.issues.join(','));assert.deepEqual(r.issues,[]);
    assert.equal(r.durableCommitVerified,false);assert.equal(r.coordinatorAuthenticated,false);
    assert.equal(r.leaseGranted,false);assert.equal(r.retirementVerified,false);
    assert.equal(r.executionAuthorized,false);assert.equal(r.requiresResourceSideFencing,true);
    assert.deepEqual(input,before);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.issues));}
});
test('UNKNOWN and CONFLICT outcomes never advance observed authority',()=>{
  for(const [result,code] of [['UNKNOWN','COORDINATOR_OUTCOME_UNKNOWN'],['CONFLICT','COORDINATOR_CAS_CONFLICT']]) {
    const x=copy(valid[2]);x.receipt.result=result;hold(x,code);
  }
});
test('stale revision and stale fencing epoch are explicitly held',()=>{
  const a=copy(valid[2]);a.operation.expectedRevision=11;hold(a,'COORDINATOR_EXPECTATION_MISMATCH');
  const b=copy(valid[2]);b.operation.expectedEpoch=6;hold(b,'COORDINATOR_EXPECTATION_MISMATCH');
});
test('transaction identity and kind are part of the durable CAS envelope',()=>{
  const x=copy(valid[2]);x.receipt.txId='replayed-tx';hold(x,'COORDINATOR_TRANSACTION_MISMATCH');
  const y=copy(valid[2]);y.receipt.kind='RENEW';hold(y,'COORDINATOR_TRANSACTION_MISMATCH');
});
test('journal continuity, commit index and revision must all advance exactly once',()=>{
  for(const [path,value] of [['revision',14],['commitIndex',56],['headDigest',D('a')]]){
    const x=copy(valid[2]);x.after[path]=value;hold(x,'COORDINATOR_JOURNAL_OR_REVISION_CONFLICT');
  }
  const y=copy(valid[2]);y.receipt.previousDigest=D('f');hold(y,'COORDINATOR_JOURNAL_OR_REVISION_CONFLICT');
});
test('release can only be structurally proposed from RETIRING and with scoped certificate',()=>{
  const x=copy(valid[1]);x.before.mode='HELD';hold(x,'COORDINATOR_RETIRE_PUBLISH_INVALID');
  const y=copy(valid[1]);y.after.retired.receiptDigest=D('f');hold(y,'COORDINATOR_RETIRE_PUBLISH_INVALID');
  const z=copy(valid[1]);z.after.retired.generationId='alien-generation';hold(z,'COORDINATOR_RETIRE_PUBLISH_INVALID');
});
test('retire begin must retain old owner, expiry and epoch',()=>{
  const x=copy(valid[0]);x.after.holder={...x.after.holder,expiresAtMs:5001};hold(x,'COORDINATOR_RETIRE_BEGIN_INVALID');
  const y=copy(valid[0]);y.after.fencingEpoch=8;hold(y,'COORDINATOR_RETIRE_BEGIN_INVALID');
});
test('a new generation must have a new fencing epoch and not reuse predecessor identity',()=>{
  const a=copy(valid[2]);a.after.fencingEpoch=7;a.after.holder.fencingEpoch=7;hold(a,'COORDINATOR_ACQUIRE_INVALID');
  const b=copy(valid[2]);b.after.holder.leaseId='old-lease';b.operation.leaseId='old-lease';hold(b,'COORDINATOR_ACQUIRE_INVALID');
});
test('renewal may never change owner, epoch or shorten expiry',()=>{
  const a=copy(valid[3]);a.after.holder.ownerId='evil-owner';hold(a,'COORDINATOR_RENEW_INVALID');
  const b=copy(valid[3]);b.after.holder.expiresAtMs=7000;b.operation.nextExpiresAtMs=7000;hold(b,'COORDINATOR_RENEW_INVALID');
  const c=copy(valid[3]);c.nowMs=8000;c.receipt.observedAtMs=8000;hold(c,'COORDINATOR_RENEW_INVALID');
});
test('known expired owner cannot be recovered through synthetic ACQUIRE without retirement',()=>{
  const x=copy(valid[2]);x.before.mode='HELD';x.before.holder=copy(old);
  hold(x,'COORDINATOR_ACQUIRE_INVALID');
});
test('two independent synthetic contenders cannot both satisfy one atomic revision',()=>{
  const x=copy(valid[2]),y=copy(valid[2]);y.operation.ownerId='rival-owner';
  y.operation.generationId='rival-gen';y.operation.leaseId='rival-lease';
  y.after.holder={...y.after.holder,ownerId:'rival-owner',generationId:'rival-gen',leaseId:'rival-lease'};
  assert.equal(review(x).decision,'STRUCTURE_REVIEWABLE');
  assert.equal(review(y).decision,'STRUCTURE_REVIEWABLE');
  // The in-memory test fixture models *one* serialized CAS, not durability.
  let state=copy(vacant);
  const atomicSim=proposal=>{
    if(state.revision!==proposal.operation.expectedRevision)return false;
    state=copy(proposal.after);return true;
  };
  assert.equal(atomicSim(x),true);assert.equal(atomicSim(y),false);
  assert.equal(state.holder.ownerId,'new-owner');
  // An untrusted transcript can still be forged. Only real CAS can enforce this.
  assert.equal(review(y).leaseGranted,false);
});
test('unknown coordinator state, stale receipt and resource confusion hold',()=>{
  const x=copy(valid[2]);x.before.mode='UNKNOWN';hold(x,'COORDINATOR_STATE_UNKNOWN');
  const y=copy(valid[2]);y.nowMs=3000;hold(y,'COORDINATOR_RECEIPT_STALE');
  const z=copy(valid[2]);z.operation.resourceId='other-tunnel';hold(z,'COORDINATOR_RESOURCE_MISMATCH');
});
test('accessors, symbols, inherited, extra fields and malformed durations are rejected without calling getters',()=>{
  let touched=0;
  const getter=Object.defineProperty(copy(valid[2]),'nowMs',{get(){touched++;throw Error('SECRET');}});
  for(const bad of [getter,Object.create(valid[2]),
    {...copy(valid[2]),token:'Bearer SECRET'},
    Object.assign(copy(valid[2]),{[Symbol('hidden')]:true}),
    {...copy(valid[2]),maxAgeMs:0},
    {...copy(valid[2]),before:{...vacant,secret:'SECRET'}}]){
    assert.throws(()=>review(bad),/^Error: Invalid synthetic coordinator transcript$/);
  }
  assert.equal(touched,0);
});
test('no raw owner, token or process data leaks into a result',()=>{
  assert.doesNotMatch(JSON.stringify(review(valid[2])),/synthetic-tunnel|old-owner|new-owner|secret|\/proc/i);
});

test('acquisition requires bounded unexpired TTL even in an asserted coordinator clock',()=>{
  const expired=copy(valid[2]);expired.operation.nextExpiresAtMs=2000;expired.after.holder.expiresAtMs=2000;
  hold(expired,'COORDINATOR_ACQUIRE_INVALID');
  const tooLong=copy(valid[2]);tooLong.operation.nextExpiresAtMs=40000;tooLong.after.holder.expiresAtMs=40000;
  hold(tooLong,'COORDINATOR_ACQUIRE_INVALID');
});
test('crash windows and lost acknowledgements cannot be claimed as a verified lease',()=>{
  for(const step of [valid[0],valid[1],valid[2],valid[3]]){
    const x=copy(step);x.receipt.result='UNKNOWN';
    const r=review(x);assert.equal(r.decision,'HOLD');
    assert.ok(r.issues.includes('COORDINATOR_OUTCOME_UNKNOWN'));
    assert.equal(r.durableCommitVerified,false);assert.equal(r.leaseGranted,false);
  }
});
