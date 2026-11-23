import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewEffectSettlementReconciliation as review} from '../simulation/private-runtime-effect-settlement-reconciliation.mjs';
const D=x=>x.repeat(64);
const identity={resourceId:'synthetic-tunnel',ownerId:'owner-a',
  generationId:'gen-a',leaseId:'lease-a',epoch:12};
const request={requestId:'request-001',requestDigest:D('a'),
  canonicalKeyDigest:D('b'),dispatchId:'dispatch-001'};
const snapshot={schemaVersion:1,...identity,revision:99,commitIndex:199,
  mode:'HELD',leaseExpiresAtMs:30000,headDigest:D('c'),readAtMs:5000};
const outbox={schemaVersion:1,...identity,coordinatorRevision:99,commitIndex:199,
  coordinatorHeadDigest:D('c'),
  ...request,phase:'ACK_UNKNOWN',sequence:42,intentDigest:D('d'),
  fileSyncedClaim:true,directorySyncedClaim:true,createdAtMs:4900};
const ledger={schemaVersion:1,...identity,...request,state:'COMMITTED',
  sequence:43,persistedSequenceFloor:43,persistedEpochFloor:12,
  outboxIntentDigest:D('d'),
  outcomeDigest:D('e'),recordDigest:D('f'),readAtMs:5200};
const receipt={schemaVersion:1,...identity,...request,state:'COMMITTED',
  ledgerSequence:43,outcomeDigest:D('e'),recordDigest:D('f'),observedAtMs:5250};
const fixture=()=>structuredClone({snapshot,outbox,ledger,receipt,nowMs:5300,maxAgeMs:1000});
const run=mutate=>{const x=fixture();if(mutate)mutate(x);return review(x);};
function hold(mutate,reason){const o=run(mutate);
  assert.equal(o.decision,'HOLD',o.issues.join(','));
  assert.ok(o.issues.includes(reason),`expected ${reason}, got ${o.issues}`);
  for(const key of ['executionAuthorized','safeToRetry','retryAuthorized',
    'deliveryAuthorized','acknowledgementAuthorized'])assert.equal(o[key],false);
  return o;
}
test('coherent synthetic ledger and receipt imply no effect outcome authority',()=>{
  const data=fixture(),before=structuredClone(data),o=review(data);
  assert.equal(o.decision,'STRUCTURE_REVIEWABLE');assert.deepEqual(o.issues,[]);
  for(const key of ['outcomeVerified','durabilityVerified','dedupeVerified',
    'reconciliationComplete','exactlyOnceGuaranteed','safeToRetry',
    'retryAuthorized','deliveryAuthorized','acknowledgementAuthorized',
    'executionAuthorized'])assert.equal(o[key],false);
  assert.equal(o.requiresAtomicEffectAndLedger,true);
  assert.equal(o.requiresAuthenticatedSinkReceipt,true);
  assert.deepEqual(data,before);
  assert.ok(Object.isFrozen(o)&&Object.isFrozen(o.issues));
});
test('outbox before dispatch, dispatching, acknowledged, unknown remain HOLD',()=>{
  for(const phase of ['PREPARED','DISPATCHING','ACKED','UNKNOWN'])
    hold(x=>{x.outbox.phase=phase;},'SETTLEMENT_NOT_AN_UNCERTAIN_ACK');
});
test('pending, absent or unknown durable ledger never establish settlement',()=>{
  for(const state of ['PENDING','UNKNOWN','NOT_FOUND'])
    hold(x=>{x.ledger.state=state;},'SETTLEMENT_COMMIT_UNRESOLVED');
});
test('receipt NOT_FOUND, FAILED and UNKNOWN hold despite committed ledger',()=>{
  for(const state of ['NOT_FOUND','FAILED','UNKNOWN'])
    hold(x=>{x.receipt.state=state;},'SETTLEMENT_COMMIT_UNRESOLVED');
});
test('outbox claimed durability must report both checkpoints',()=>{
  hold(x=>{x.outbox.fileSyncedClaim=false;},'SETTLEMENT_OUTBOX_DURABILITY_UNCONFIRMED');
  hold(x=>{x.outbox.directorySyncedClaim=false;},'SETTLEMENT_OUTBOX_DURABILITY_UNCONFIRMED');
});
test('ledger sequence cannot advance with gaps or replays',()=>{
  hold(x=>{x.ledger.sequence=42;x.receipt.ledgerSequence=42;x.ledger.persistedSequenceFloor=42;},
    'SETTLEMENT_LEDGER_CHAIN_MISMATCH');
  hold(x=>{x.ledger.sequence=44;x.receipt.ledgerSequence=44;},
    'SETTLEMENT_LEDGER_CHAIN_MISMATCH');
  hold(x=>{x.receipt.ledgerSequence=44;},'SETTLEMENT_LEDGER_CHAIN_MISMATCH');
  hold(x=>{x.ledger.outboxIntentDigest=D('9');},'SETTLEMENT_LEDGER_CHAIN_MISMATCH');
});
test('post-crash persisted ledger floors cannot regress',()=>{
  hold(x=>{x.ledger.persistedSequenceFloor=44;},'SETTLEMENT_LEDGER_HIGH_WATER_ROLLBACK');
  hold(x=>{x.ledger.persistedEpochFloor=13;},'SETTLEMENT_LEDGER_HIGH_WATER_ROLLBACK');
});
test('receipt outcome and ledger record digest must agree',()=>{
  hold(x=>{x.receipt.outcomeDigest=D('9');},'SETTLEMENT_RECEIPT_DIGEST_CONFLICT');
  hold(x=>{x.receipt.recordDigest=D('8');},'SETTLEMENT_RECEIPT_DIGEST_CONFLICT');
  hold(x=>{x.receipt.outcomeDigest=D('a');x.ledger.outcomeDigest=D('a');},
    'SETTLEMENT_RECEIPT_DIGEST_CONFLICT');
});
test('outbox, ledger or receipt cannot migrate between resources',()=>{
  for(const target of ['outbox','ledger','receipt'])
    hold(x=>{x[target].resourceId='other-tunnel';},'SETTLEMENT_RESOURCE_REBOUND');
});
test('old owner, generation or lease in any record holds',()=>{
  for(const target of ['outbox','ledger','receipt'])
    for(const key of ['ownerId','generationId','leaseId'])
      hold(x=>{x[target][key]='reused-other';},'SETTLEMENT_OWNER_REBOUND');
});
test('stale and future epochs do not reconcile any downstream effects',()=>{
  for(const target of ['outbox','ledger','receipt'])
    for(const epoch of [11,13])
      hold(x=>{x[target].epoch=epoch;},'SETTLEMENT_FENCING_EPOCH_MISMATCH');
});
test('dispatch ID replay with a different ID or different request cannot settle',()=>{
  for(const target of ['ledger','receipt'])
    for(const key of ['requestId','requestDigest','canonicalKeyDigest','dispatchId'])
      hold(x=>{x[target][key]=key.endsWith('Digest')?D('9'):'rebound-other';},
        'SETTLEMENT_REQUEST_REPLAY_OR_REBIND');
});
test('coordinator revision or commit index drift is a hard HOLD',()=>{
  hold(x=>{x.outbox.coordinatorRevision=98;},'SETTLEMENT_COORDINATOR_HISTORY_MISMATCH');
  hold(x=>{x.outbox.commitIndex=200;},'SETTLEMENT_COORDINATOR_HISTORY_MISMATCH');
  hold(x=>{x.outbox.coordinatorHeadDigest=D('9');},'SETTLEMENT_COORDINATOR_HISTORY_MISMATCH');
});
test('expired and non-held coordinator disallow reconciliation',()=>{
  hold(x=>{x.snapshot.leaseExpiresAtMs=5300;},'SETTLEMENT_LEASE_EXPIRED_OR_UNKNOWN');
  hold(x=>{x.snapshot.leaseExpiresAtMs=5000;},'SETTLEMENT_LEASE_EXPIRED_OR_UNKNOWN');
  for(const mode of ['VACANT','UNKNOWN','RETIRING'])
    hold(x=>{x.snapshot.mode=mode;},'SETTLEMENT_COORDINATOR_NOT_HELD');
});
test('claimed receipt predating dispatch cannot support structural review',()=>{
  hold(x=>{x.outbox.createdAtMs=5201;},'SETTLEMENT_RECEIPT_PRECEDES_DISPATCH');
  hold(x=>{x.receipt.observedAtMs=4899;},'SETTLEMENT_RECEIPT_PRECEDES_DISPATCH');
});
test('observed timestamps are bounded, never trusted time proof',()=>{
  for(const [target,field] of [['snapshot','readAtMs'],['outbox','createdAtMs'],
    ['ledger','readAtMs'],['receipt','observedAtMs']]){
    hold(x=>{x[target][field]=6000;},'SETTLEMENT_EVIDENCE_STALE');
    hold(x=>{x[target][field]=0;},'SETTLEMENT_EVIDENCE_STALE');
  }
});
test('unknown fields and unsafe primitives fail input validation',()=>{
  for(const mutate of [
    x=>{x.outbox.token='SHOULD_NOT_LEAK';},
    x=>{x.receipt.state='MAGIC_SUCCESS';},
    x=>{x.outbox.sequence=Number.MAX_SAFE_INTEGER;},
    x=>{x.ledger.sequence=0;},
    x=>{x.ledger.requestId='bad\nkey';},
    x=>{x.maxAgeMs=60001;},
    x=>{x.nowMs=NaN;},
    x=>{x.snapshot.headDigest='bad';}
  ]){const x=fixture();mutate(x);assert.throws(()=>review(x),
    /^Error: Invalid synthetic effect settlement input$/);}
});
test('inherited values, symbols and accessors cannot cross structural input boundary',()=>{
  let called=0;
  for(const mutate of [
    x=>{x.receipt=Object.create(x.receipt);},
    x=>{x.ledger[Symbol('token')]='secret';},
    x=>{Object.defineProperty(x.outbox,'phase',
      {get(){called++;throw Error('SECRET_ACCESSOR');}});},
    x=>{Object.defineProperty(x.receipt,'recordDigest',
      {get(){called++;throw Error('SECRET_ACCESSOR');}});}
  ]){const x=fixture();mutate(x);assert.throws(()=>review(x),
    /^Error: Invalid synthetic effect settlement input$/);}
  assert.equal(called,0);
});
test('structured issue results do not echo owner, request, digest, or secrets',()=>{
  const r=hold(x=>{x.ledger.requestId='replayed-secret';},'SETTLEMENT_REQUEST_REPLAY_OR_REBIND');
  assert.doesNotMatch(JSON.stringify(r),/replayed-secret|owner-a|request-001|dispatch-001|synthetic-tunnel/);
});
test('a matrix of old and future epochs always fails except exact match',()=>{
  for(let epoch=1;epoch<=14;epoch++)for(let receiptEpoch=1;receiptEpoch<=14;receiptEpoch++){
    const x=fixture();x.snapshot.epoch=epoch;x.outbox.epoch=epoch;
    x.ledger.epoch=epoch;x.ledger.persistedEpochFloor=epoch;x.receipt.epoch=receiptEpoch;
    const r=review(x);
    assert.equal(r.decision,receiptEpoch===epoch?'STRUCTURE_REVIEWABLE':'HOLD');
    assert.equal(r.safeToRetry,false);
  }
});
test('conflicting outcome after alleged commit is never safe to replay',()=>{
  const x=fixture();x.receipt.outcomeDigest=D('7');
  const out=review(x);
  assert.equal(out.decision,'HOLD');
  assert.equal(out.safeToRetry,false);
  assert.equal(out.exactlyOnceGuaranteed,false);
});
test('even ideal looking metadata cannot acknowledge a user request',()=>{
  const out=run();assert.equal(out.acknowledgementAuthorized,false);
  assert.equal(out.deliveryAuthorized,false);
  assert.equal(out.reconciliationComplete,false);
});
