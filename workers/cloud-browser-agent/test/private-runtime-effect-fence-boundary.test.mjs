import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewEffectFenceBoundary as review} from '../simulation/private-runtime-effect-fence-boundary.mjs';

const D = char => char.repeat(64);
const owner = {ownerId:'synthetic-owner',generationId:'gen-new',leaseId:'lease-new',
  fencingEpoch:12,expiresAtMs:25000};
const snapshot = {schemaVersion:1,resourceId:'tunnel-a',revision:88,term:2,
  commitIndex:140,fencingEpoch:12,mode:'HELD',holder:owner,
  headDigest:D('a'),readAtMs:19000};
const sink = {schemaVersion:1,resourceId:'tunnel-a',state:'ACTIVE',
  fencingEpoch:12,revision:88,commitIndex:140,persistedFenceFloor:12,
  persistedRevisionFloor:88,persistedCommitFloor:140,ownerId:owner.ownerId,
  generationId:owner.generationId,leaseId:owner.leaseId,
  checkpointDigest:D('a'),readAtMs:19000};
const delivery = {schemaVersion:1,resourceId:'tunnel-a',
  ownerId:owner.ownerId,generationId:owner.generationId,
  leaseId:owner.leaseId,fencingEpoch:12,coordinatorRevision:88,
  commitIndex:140,sessionId:'session-a',requestId:'req-001',
  kind:'DELIVER',requestDigest:D('b')};
const dedupe = {schemaVersion:1,resourceId:'tunnel-a',
  requestId:'req-001',requestDigest:D('b'),fencingEpoch:12,
  state:'FRESH',journalRevision:88,journalDigest:D('c'),observedAtMs:19000};
const baseline=()=>structuredClone({snapshot,sink,delivery,dedupe,nowMs:20000,maxAgeMs:3000});
function check(mutator) {const i=baseline();mutator(i);return review(i);}
function holds(mutate,reason) {
  const out=check(mutate);assert.equal(out.decision,'HOLD');
  assert.ok(out.issues.includes(reason),`expected ${reason}, got ${out.issues}`);
  assert.equal(out.executionAuthorized,false);
  assert.equal(out.effectAuthorized,false);
  return out;
}

test('coherent synthetic effect is only structural; no session or delivery is authorized',()=>{
  const fixture=baseline(),before=structuredClone(fixture),out=review(fixture);
  assert.equal(out.decision,'STRUCTURE_REVIEWABLE');
  assert.deepEqual(out.issues,[]);
  for(const key of ['effectAuthorized','sessionAuthorized','deliveryAuthorized',
    'fenceEnforced','leaseVerified','deduplicationVerified',
    'coordinatorAuthenticated','executionAuthorized'])assert.equal(out[key],false);
  assert.equal(out.requiresResourceSideAtomicFencing,true);
  assert.equal(out.requiresDurableDeduplication,true);
  assert.equal(out.requiresTrustedDurableHighWatermark,true);
  assert.ok(Object.isFrozen(out)&&Object.isFrozen(out.issues));
  assert.deepEqual(fixture,before);
});

test('retiring, vacant and unknown coordinator modes cannot admit any effect',()=>{
  for(const mode of ['RETIRING','UNKNOWN'])
    holds(i=>{i.snapshot.mode=mode;},'EFFECT_OWNER_NOT_HELD');
  holds(i=>{i.snapshot.mode='VACANT';i.snapshot.holder=null;},'EFFECT_OWNER_NOT_HELD');
});

test('fenced and unknown sinks never admit queued or in-flight work',()=>{
  for(const state of ['FENCED','UNKNOWN'])
    holds(i=>{i.sink.state=state;},'EFFECT_SINK_NOT_ACTIVE');
});

test('resource mismatches across three boundaries always HOLD',()=>{
  for(const key of ['sink','delivery','dedupe'])
    holds(i=>{i[key].resourceId='different-tunnel';},'EFFECT_RESOURCE_MISMATCH');
});

test('post-restart epoch/revision/commit rollback conflicts with persisted floor',()=>{
  holds(i=>{i.sink.persistedFenceFloor=13;},'EFFECT_DURABLE_HIGH_WATERMARK_ROLLBACK');
  holds(i=>{i.sink.persistedRevisionFloor=89;},'EFFECT_DURABLE_HIGH_WATERMARK_ROLLBACK');
  holds(i=>{i.sink.persistedCommitFloor=141;},'EFFECT_DURABLE_HIGH_WATERMARK_ROLLBACK');
  holds(i=>{i.snapshot.fencingEpoch=11;i.sink.fencingEpoch=11;
    i.delivery.fencingEpoch=11;i.snapshot.holder.fencingEpoch=11;
    i.dedupe.fencingEpoch=11;},'EFFECT_DURABLE_HIGH_WATERMARK_ROLLBACK');
});

test('old epoch and future epoch are not silently accepted',()=>{
  holds(i=>{i.delivery.fencingEpoch=11;},'EFFECT_STALE_DELIVERY_EPOCH');
  holds(i=>{i.delivery.fencingEpoch=13;},'EFFECT_FUTURE_DELIVERY_EPOCH');
});

test('sink behind coordinator fence or ahead of stale snapshot blocks effects',()=>{
  holds(i=>{i.sink.fencingEpoch=11;},'EFFECT_FENCE_NOT_INSTALLED');
  holds(i=>{i.sink.fencingEpoch=13;},'EFFECT_SNAPSHOT_BEHIND_SINK');
});

test('owner fence contradiction stops the review',()=>{
  holds(i=>{i.snapshot.holder.fencingEpoch=11;},'EFFECT_OWNER_FENCING_CONFLICT');
});

test('lease expiration is checked, but claimed time is never trusted',()=>{
  holds(i=>{i.snapshot.holder.expiresAtMs=20000;},'EFFECT_LEASE_EXPIRED_OR_UNKNOWN');
  holds(i=>{i.snapshot.holder.expiresAtMs=19999;},'EFFECT_LEASE_EXPIRED_OR_UNKNOWN');
});

test('old sessions and wrong owner identities are rejected',()=>{
  for(const key of ['ownerId','generationId','leaseId']){
    holds(i=>{i.delivery[key]='previous-generation';},'EFFECT_OWNER_IDENTITY_MISMATCH');
    holds(i=>{i.sink[key]='previous-generation';},'EFFECT_OWNER_IDENTITY_MISMATCH');
  }
});

test('coordinator revisions and committed log positions must match exactly',()=>{
  for(const k of ['coordinatorRevision','commitIndex'])
    holds(i=>{i.delivery[k]++;},'EFFECT_REVISION_OR_COMMIT_MISMATCH');
  for(const k of ['revision','commitIndex'])
    holds(i=>{i.sink[k]++;},'EFFECT_REVISION_OR_COMMIT_MISMATCH');
});

test('fence checkpoint digest must bind to asserted coordinator head',()=>{
  holds(i=>{i.sink.checkpointDigest=D('d');},'EFFECT_SINK_HEAD_DIGEST_MISMATCH');
});

test('request identity must bind to a single dedupe lookup',()=>{
  holds(i=>{i.dedupe.requestId='other-request';},'EFFECT_DEDUPE_KEY_MISMATCH');
  holds(i=>{i.dedupe.requestDigest=D('d');},'EFFECT_DEDUPE_KEY_MISMATCH');
  holds(i=>{i.dedupe.fencingEpoch=11;},'EFFECT_DEDUPE_EPOCH_MISMATCH');
});

test('already seen and unknown requests remain blocked',()=>{
  holds(i=>{i.dedupe.state='SEEN';},'EFFECT_DUPLICATE_REQUEST');
  holds(i=>{i.dedupe.state='UNKNOWN';},'EFFECT_DEDUPE_UNKNOWN');
});

test('dedupe journal behind and ahead of snapshot both block',()=>{
  holds(i=>{i.dedupe.journalRevision=87;},'EFFECT_DEDUPE_LEDGER_REVISION_MISMATCH');
  holds(i=>{i.dedupe.journalRevision=89;},'EFFECT_DEDUPE_LEDGER_REVISION_MISMATCH');
});

test('old, future and stale observation timestamps are rejected',()=>{
  for(const target of ['snapshot','sink','dedupe']){
    const key=target==='dedupe'?'observedAtMs':'readAtMs';
    holds(i=>{i[target][key]=20001;},'EFFECT_EVIDENCE_STALE_OR_FUTURE');
    holds(i=>{i[target][key]=16000;},'EFFECT_EVIDENCE_STALE_OR_FUTURE');
  }
});

test('all three action types are only reviewable; no action is executed',()=>{
  for(const kind of ['OPEN_SESSION','DELIVER','COMPLETE']){
    const out=check(i=>{i.delivery.kind=kind;});
    assert.equal(out.decision,'STRUCTURE_REVIEWABLE');
    assert.equal(out.executionAuthorized,false);
  }
});

test('unbounded inputs or unknown action kinds fail validation',()=>{
  for(const mutate of [
    i=>{i.delivery.kind='DELETE_PROFILE';},
    i=>{i.delivery.requestId='R'.repeat(129);},
    i=>{i.delivery.fencingEpoch=-1;},
    i=>{i.snapshot.holder.expiresAtMs=Number.MAX_SAFE_INTEGER;},
    i=>{i.maxAgeMs=60001;},
    i=>{i.nowMs=Infinity;},
    i=>{i.sink.ownerId='bad\nowner';},
    i=>{i.dedupe.requestDigest='bad';}
  ])assert.throws(()=>{const i=baseline();mutate(i);review(i);},
    /^Error: Invalid synthetic effect fence input$/);
});

test('inherited fields, accessors, symbols and secret extras fail without leakage',()=>{
  let invoked=0;
  for(const make of [
    i=>{i.delivery=Object.create(i.delivery);},
    i=>{i.sink.secret='Bearer SYNTHETIC_SECRET';},
    i=>{i.snapshot[Symbol('secret')]='synthetic-token';},
    i=>{Object.defineProperty(i.delivery,'leaseId',{
      enumerable:true,get(){invoked++;throw Error('SECRET_ACCESSOR');}});},
    i=>{Object.defineProperty(i.dedupe,'state',{
      enumerable:true,get(){invoked++;throw Error('SECRET_ACCESSOR');}});}
  ])assert.throws(()=>{const i=baseline();make(i);review(i);},
    /^Error: Invalid synthetic effect fence input$/);
  assert.equal(invoked,0);
});

test('issue reports never echo synthetic identifiers or digests',()=>{
  const out=holds(i=>{i.delivery.ownerId='other-owner';},'EFFECT_OWNER_IDENTITY_MISMATCH');
  assert.doesNotMatch(JSON.stringify(out),/synthetic-owner|session-a|req-001|tunnel-a|Bearer/);
});

test('deterministic cross-epoch model: only equal epoch is structurally reviewable',()=>{
  for(let s=1;s<=16;s++)for(let d=1;d<=16;d++){
    const out=check(i=>{
      i.snapshot.fencingEpoch=s;
      i.snapshot.holder.fencingEpoch=s;
      i.sink.fencingEpoch=s;
      i.sink.persistedFenceFloor=s;
      i.delivery.fencingEpoch=d;
      i.dedupe.fencingEpoch=d;
    });
    assert.equal(out.decision,d===s?'STRUCTURE_REVIEWABLE':'HOLD',`snapshot ${s} delivery ${d}`);
    assert.equal(out.executionAuthorized,false);
  }
});
