import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCoordinatorPersistenceBoundary} from '../simulation/private-runtime-coordinator-persistence-boundary.mjs';

const H=x=>x.repeat(64);
const attempt={schemaVersion:1,txId:'tx-synthetic-1',kind:'ACQUIRE',
  resourceId:'tunnel-synthetic',expectedRevision:7,expectedEpoch:9,
  requestDigest:H('a'),ackStatus:'ACK_LOST',ackCommitIndex:null};
const transaction={status:'COMMITTED',kind:'ACQUIRE',requestDigest:H('a'),commitIndex:99,
  recordDigest:H('b'),expectedRevision:7,expectedEpoch:9};
const readback={schemaVersion:1,coordinatorId:'coordinator-synthetic',term:5,
  consistency:'linearizable-asserted',txId:'tx-synthetic-1',
  resourceId:'tunnel-synthetic',mode:'HELD',revision:8,fencingEpoch:10,
  commitIndex:99,headDigest:H('b'),readAtMs:2000,transaction};
const fixture=()=>structuredClone({attempt,readback,nowMs:2001,maxAgeMs:500});
const review=changes=>reviewCoordinatorPersistenceBoundary({...fixture(),...changes});
const hold=(data,reason)=>{const r=reviewCoordinatorPersistenceBoundary(data);
  assert.equal(r.decision,'HOLD');assert.ok(r.issues.includes(reason),JSON.stringify(r));
  assert.equal(r.leaseGranted,false);assert.equal(r.safeToRetry,false);};

test('matching synthetic lost ACK only reviews structure, never proves durable write',()=>{
  const data=fixture(),before=structuredClone(data),result=review(data);
  assert.deepEqual(result.issues,[]);assert.equal(result.decision,'STRUCTURE_REVIEWABLE');
  assert.equal(result.durableCommitVerified,false);assert.equal(result.coordinatorAuthenticated,false);
  assert.equal(result.linearizabilityVerified,false);assert.equal(result.transactionVerified,false);
  assert.equal(result.safeToRetry,false);assert.equal(result.executionAuthorized,false);
  assert.equal(result.leaseGranted,false);assert.equal(result.retirementVerified,false);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.issues));
  assert.deepEqual(data,before);
});
test('timeout with committed readback never grants retry authority',()=>{
  const d=fixture();d.attempt.ackStatus='TIMEOUT';
  assert.equal(reviewCoordinatorPersistenceBoundary(d).decision,'STRUCTURE_REVIEWABLE');
  assert.equal(reviewCoordinatorPersistenceBoundary(d).safeToRetry,false);
});
test('unknown, not-seen, and conflict outcomes all hold',()=>{
  const reasons={NOT_SEEN:'PERSISTENCE_NOT_SEEN_NOT_SAFE_TO_RETRY',
    INDETERMINATE:'PERSISTENCE_TRANSACTION_INDETERMINATE',
    CONFLICT:'PERSISTENCE_TRANSACTION_CONFLICT'};
  for(const [status,reason] of Object.entries(reasons)){
    const d=fixture();d.readback.transaction={status,kind:null,requestDigest:null,commitIndex:null,
      recordDigest:null,expectedRevision:null,expectedEpoch:null};
    hold(d,reason);
  }
});
test('ack applied but authoritative lookup not found is contradictory and holds',()=>{
  const d=fixture();d.attempt.ackStatus='ACK_APPLIED';
  d.readback.transaction={status:'NOT_SEEN',kind:null,requestDigest:null,commitIndex:null,
    recordDigest:null,expectedRevision:null,expectedEpoch:null};
  hold(d,'PERSISTENCE_ACK_TRANSACTION_CONTRADICTION');
});
test('ack conflict but transaction committed is contradictory and holds',()=>{
  const d=fixture();d.attempt.ackStatus='ACK_CONFLICT';
  hold(d,'PERSISTENCE_ACK_TRANSACTION_CONTRADICTION');
});
test('inconsistent acknowledgement evidence holds before any proposed retry',()=>{
  let d=fixture();d.attempt.ackStatus='ACK_APPLIED';
  hold(d,'PERSISTENCE_ACK_SHAPE_CONTRADICTION');
  d=fixture();d.attempt.ackCommitIndex=99;
  hold(d,'PERSISTENCE_ACK_SHAPE_CONTRADICTION');
});
test('transaction kind cannot be rebound to a different operation',()=>{
  const d=fixture();d.readback.transaction.kind='RENEW';
  hold(d,'PERSISTENCE_TRANSACTION_ID_REUSED_OR_REBOUND');
});
test('transaction lookup is bound to exact transaction ID and resource',()=>{
  for(const [k,v] of [['txId','replay-tx'],['resourceId','other-tunnel']]){
    const d=fixture();d.readback[k]=v;
    hold(d,'PERSISTENCE_LOOKUP_SCOPE_MISMATCH');
  }
});
test('reusing transaction ID with another request digest/revision/epoch holds',()=>{
  for(const [k,v] of [['requestDigest',H('c')],['expectedRevision',6],['expectedEpoch',8]]){
    const d=fixture();d.readback.transaction[k]=v;
    hold(d,'PERSISTENCE_TRANSACTION_ID_REUSED_OR_REBOUND');
  }
});
test('a stale or future coordinator readback holds',()=>{
  for(const date of [1200,2002]){
    const d=fixture();d.readback.readAtMs=date;
    hold(d,'PERSISTENCE_READBACK_STALE');
  }
});
test('UNKNOWN state must not imply vacancy',()=>{
  const d=fixture();d.readback.mode='UNKNOWN';
  hold(d,'PERSISTENCE_COORDINATOR_STATE_UNKNOWN');
});
test('missing committed record, stale epoch and nonadvancing revision hold',()=>{
  for(const [k,v] of [['commitIndex',98],['revision',7],['fencingEpoch',9]]){
    const d=fixture();d.readback[k]=v;
    hold(d,'PERSISTENCE_COMMIT_NOT_VISIBLE');
  }
});
test('head digest mismatch and ack index mismatch hold',()=>{
  let d=fixture();d.readback.headDigest=H('f');hold(d,'PERSISTENCE_HEAD_DIGEST_MISMATCH');
  d=fixture();d.attempt.ackStatus='ACK_APPLIED';d.attempt.ackCommitIndex=98;hold(d,'PERSISTENCE_ACK_INDEX_MISMATCH');
  d=fixture();d.attempt.ackStatus='ACK_APPLIED';d.attempt.ackCommitIndex=100;hold(d,'PERSISTENCE_ACK_AHEAD_OF_READBACK');
});
test('a later readback may carry a newer journal head but remains advisory',()=>{
  const d=fixture();d.readback.revision=12;d.readback.commitIndex=105;
  d.readback.headDigest=H('d');d.readback.fencingEpoch=12;
  const result=reviewCoordinatorPersistenceBoundary(d);
  assert.equal(result.decision,'STRUCTURE_REVIEWABLE');
  assert.equal(result.durableCommitVerified,false);
});
test('non-ACQUIRE retirement operations do not need a successor epoch',()=>{
  for(const kind of ['BEGIN_RETIRE','PUBLISH_RETIREMENT','RENEW']){
    const d=fixture();d.attempt.kind=kind;d.readback.transaction.kind=kind;d.readback.fencingEpoch=9;
    assert.equal(reviewCoordinatorPersistenceBoundary(d).decision,'STRUCTURE_REVIEWABLE');
  }
});
test('malformed input, unexpected fields, getters and inherited properties fail before observation',()=>{
  const cases=[];
  let d=fixture();d.readback.consistency='eventually-consistent';cases.push(d);
  d=fixture();d.readback.transaction.status='COMMITTED';d.readback.transaction.requestDigest=null;cases.push(d);
  d=fixture();d.attempt.ackCommitIndex='99';cases.push(d);
  d=fixture();d.attempt.secret='Bearer TOKEN';cases.push(d);
  d=fixture();d.readback.term=0;cases.push(d);
  d=fixture();d.attempt.txId='bad\n';cases.push(d);
  d=fixture();d.maxAgeMs=60001;cases.push(d);
  d=fixture();d.readback=Object.create(d.readback);cases.push(d);
  d=fixture();Object.defineProperty(d.readback,'txId',{get(){throw Error('SECRET_GETTER');}});cases.push(d);
  d=fixture();d.readback[Symbol('hidden')]=1;cases.push(d);
  for(const data of cases)assert.throws(()=>reviewCoordinatorPersistenceBoundary(data),
    /^Error: Invalid synthetic coordinator persistence input$/);
});
test('readback with exact maximum-safe overflow is rejected',()=>{
  const d=fixture();d.readback.commitIndex=Number.MAX_SAFE_INTEGER;
  assert.throws(()=>reviewCoordinatorPersistenceBoundary(d),
    /^Error: Invalid synthetic coordinator persistence input$/);
});
test('two simulated writers share one revision; losing writer cannot infer retry safety',()=>{
  let current={revision:7,fencingEpoch:9,commitIndex:98};
  const simulatedCAS=(rev,nextEpoch)=>{
    if(rev!==current.revision)return false;
    current={revision:rev+1,fencingEpoch:nextEpoch,commitIndex:99};return true;
  };
  assert.equal(simulatedCAS(7,10),true);
  assert.equal(simulatedCAS(7,10),false);
  const d=fixture();d.readback.transaction={status:'CONFLICT',kind:null,requestDigest:null,
    commitIndex:null,recordDigest:null,expectedRevision:null,expectedEpoch:null};
  hold(d,'PERSISTENCE_TRANSACTION_CONFLICT');
});
test('no identifiers, digests or claimed coordinator identities are echoed into a result',()=>{
  const report=review(fixture());
  assert.doesNotMatch(JSON.stringify(report),/tx-synthetic|coordinator-synthetic|tunnel-synthetic|aaaaaa/);
});
