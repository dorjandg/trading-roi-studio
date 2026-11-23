import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewRetirementReleaseRecovery as review}
  from '../simulation/private-runtime-recovery-reconciliation-boundary.mjs';

const D=x=>x.repeat(64);
const journal={schemaVersion:1,resourceId:'synthetic-tunnel',oldOwnerId:'old-owner',
  generationId:'old-gen',leaseId:'old-lease',fencingEpoch:18,
  phase:'RELEASE_REQUESTED',txId:'tx-release-01',requestDigest:D('a'),
  certificateDigest:D('b'),previousCoordinatorRevision:44,
  previousCoordinatorCommitIndex:70,localSequence:75,journalHeadDigest:D('c'),
  fileSyncClaim:true,directorySyncClaim:true,observedAtMs:9990};
const attempt={txId:'tx-release-01',resourceId:'synthetic-tunnel',
  kind:'PUBLISH_RETIREMENT',requestDigest:D('a'),expectedRevision:44,
  expectedEpoch:18,ackStatus:'ACK_LOST',ackCommitIndex:null};
const lookup={txId:'tx-release-01',kind:'PUBLISH_RETIREMENT',
  status:'COMMITTED',requestDigest:D('a'),expectedRevision:44,
  expectedEpoch:18,commitIndex:71,recordDigest:D('d'),readAtMs:9995};
const coordinator={schemaVersion:1,coordinatorId:'synthetic-coordinator',
  resourceId:'synthetic-tunnel',mode:'VACANT',revision:45,fencingEpoch:18,
  commitIndex:71,headDigest:D('d'),reportedConsistency:'linearizable-asserted',
  holder:null,retired:{ownerId:'old-owner',generationId:'old-gen',
    leaseId:'old-lease',fencingEpoch:18,certificateDigest:D('b')},readAtMs:9995};
const baseline=()=>structuredClone({journal,attempt,lookup,coordinator,nowMs:10000,maxAgeMs:1000});
const check=f=>{const i=baseline();f?.(i);return review(i);};
const holds=(change,issue)=>{
  const out=check(change);assert.equal(out.decision,'HOLD');
  assert.ok(out.issues.includes(issue),`${issue}: ${out.issues}`);
  assert.equal(out.safeToRetry,false);
  assert.equal(out.startupAuthorized,false);
  return out;
};

test('lost acknowledgement followed by matching synthetic readback is never authority',()=>{
  const fixture=baseline(),before=structuredClone(fixture),out=review(fixture);
  assert.equal(out.decision,'STRUCTURE_REVIEWABLE');
  assert.deepEqual(out.issues,[]);
  for(const key of ['recoveryComplete','retirementVerified','leaseGranted',
    'executionAuthorized','safeToRetry','safeToRelease','startupAuthorized',
    'witnessVerified','durableJournalVerified','coordinatorAuthenticated',
    'coordinatorCASVerified'])assert.equal(out[key],false);
  assert.equal(out.requiresAuthoritativeRead,true);
  assert.equal(out.requiresIndependentExitWitness,true);
  assert.ok(Object.isFrozen(out)&&Object.isFrozen(out.issues));
  assert.deepEqual(fixture,before);
});

test('claimed ACK_APPLIED with matching COMMITTED lookup is also only structural',()=>{
  const out=check(i=>{i.journal.phase='RELEASE_CONFIRMED';
    i.attempt.ackStatus='ACK_APPLIED';i.attempt.ackCommitIndex=71;});
  assert.equal(out.decision,'STRUCTURE_REVIEWABLE');
  assert.equal(out.retirementVerified,false);
});

test('NOT_SEEN is never safe to retry, even with a durable-looking journal',()=>{
  holds(i=>{i.lookup.status='NOT_SEEN';i.lookup.commitIndex=null;
    i.lookup.recordDigest=null;},'RECOVERY_NOT_SEEN_NOT_SAFE_TO_RETRY');
});

test('conflict and unknown lookup outcomes remain HOLD',()=>{
  holds(i=>{i.lookup.status='CONFLICT';i.lookup.commitIndex=null;
    i.lookup.recordDigest=null;},'RECOVERY_TRANSACTION_CONFLICT');
  holds(i=>{i.lookup.status='INDETERMINATE';i.lookup.commitIndex=null;
    i.lookup.recordDigest=null;},'RECOVERY_TRANSACTION_INDETERMINATE');
});

test('coordinator cannot show retiring, held or unknown if release was published',()=>{
  holds(i=>{i.coordinator.mode='RETIRING';i.coordinator.holder={
    ownerId:'old-owner',generationId:'old-gen',leaseId:'old-lease',fencingEpoch:18};},
    'RECOVERY_COORDINATOR_NOT_VACANT');
  holds(i=>{i.coordinator.mode='HELD';i.coordinator.holder={
    ownerId:'old-owner',generationId:'old-gen',leaseId:'old-lease',fencingEpoch:18};},
    'RECOVERY_COORDINATOR_NOT_VACANT');
  holds(i=>{i.coordinator.mode='UNKNOWN';},'RECOVERY_COORDINATOR_NOT_VACANT');
});

test('a residual holder after an uncertain release does not get ignored',()=>{
  const out=holds(i=>{i.coordinator.mode='UNKNOWN';i.coordinator.holder={
    ownerId:'old-owner',generationId:'old-gen',leaseId:'old-lease',fencingEpoch:18};},
    'RECOVERY_OLD_HOLDER_STILL_PRESENT');
  assert.ok(out.issues.includes('RECOVERY_COORDINATOR_NOT_VACANT'));
});

test('crashes before durable certificate cannot be repaired with readback metadata',()=>{
  for(const phase of ['INTENT','FENCED','DRAINED','EXIT_WITNESSED','UNKNOWN'])
    holds(i=>{i.journal.phase=phase;},'RECOVERY_RETIREMENT_CERT_NOT_PERSISTED');
  holds(i=>{i.journal.phase='CERT_PERSISTED';},'RECOVERY_RELEASE_PHASE_INCONSISTENT');
});

test('failed fsync and directory sync claims never advance recovery',()=>{
  holds(i=>{i.journal.fileSyncClaim=false;},'RECOVERY_JOURNAL_DURABILITY_UNCONFIRMED');
  holds(i=>{i.journal.directorySyncClaim=false;},'RECOVERY_JOURNAL_DURABILITY_UNCONFIRMED');
  holds(i=>{i.journal.certificateDigest=null;},'RECOVERY_JOURNAL_DURABILITY_UNCONFIRMED');
});

test('resource identity must match all views',()=>{
  holds(i=>{i.coordinator.resourceId='other-resource';},'RECOVERY_RESOURCE_SCOPE_MISMATCH');
  holds(i=>{i.attempt.resourceId='other-resource';},'RECOVERY_RESOURCE_SCOPE_MISMATCH');
});

test('tx ID, digest and kind are bound to the single release',()=>{
  for(const change of [
    i=>{i.attempt.txId='tx-another';},
    i=>{i.lookup.txId='tx-another';},
    i=>{i.lookup.requestDigest=D('f');},
    i=>{i.attempt.requestDigest=D('f');}
  ])holds(change,'RECOVERY_TRANSACTION_REPLAY_OR_REBIND');
  assert.throws(()=>{const i=baseline();i.lookup.kind='RENEW';review(i);},
    /^Error: Invalid synthetic release recovery input$/);
});

test('lease epoch and expected revision cannot be rebound after crash',()=>{
  for(const change of [
    i=>{i.attempt.expectedRevision=43;},
    i=>{i.lookup.expectedRevision=43;},
    i=>{i.attempt.expectedEpoch=17;},
    i=>{i.lookup.expectedEpoch=17;}
  ])holds(change,'RECOVERY_EXPECTATIONS_MISMATCH');
  holds(i=>{i.coordinator.fencingEpoch=19;},'RECOVERY_EPOCH_CONFLICT');
});

test('ACK_APPLIED must have commit index and match the lookup',()=>{
  holds(i=>{i.attempt.ackStatus='ACK_APPLIED';},'RECOVERY_ACK_SHAPE_CONTRADICTION');
  holds(i=>{i.attempt.ackCommitIndex=71;},'RECOVERY_ACK_SHAPE_CONTRADICTION');
  holds(i=>{i.attempt.ackStatus='ACK_APPLIED';i.attempt.ackCommitIndex=72;},
    'RECOVERY_ACK_COMMIT_INDEX_MISMATCH');
});

test('ACK_CONFLICT cannot coexist with a COMMITTED transaction readback',()=>{
  holds(i=>{i.attempt.ackStatus='ACK_CONFLICT';},'RECOVERY_ACK_LOOKUP_CONTRADICTION');
});

test('ACK_APPLIED followed by NOT_SEEN is a protocol contradiction',()=>{
  holds(i=>{i.attempt.ackStatus='ACK_APPLIED';i.attempt.ackCommitIndex=71;
    i.lookup.status='NOT_SEEN';i.lookup.commitIndex=null;i.lookup.recordDigest=null;},
    'RECOVERY_ACK_LOOKUP_CONTRADICTION');
});

test('coordinator revision, commit index and head hash require exact match',()=>{
  holds(i=>{i.coordinator.revision=46;},'RECOVERY_COMMIT_HISTORY_NOT_RECONCILED');
  holds(i=>{i.coordinator.commitIndex=72;},'RECOVERY_COMMIT_HISTORY_NOT_RECONCILED');
  holds(i=>{i.coordinator.headDigest=D('e');},'RECOVERY_COMMIT_HISTORY_NOT_RECONCILED');
  holds(i=>{i.lookup.commitIndex=70;},'RECOVERY_COMMIT_HISTORY_NOT_RECONCILED');
  holds(i=>{i.journal.previousCoordinatorCommitIndex=71;},'RECOVERY_COMMIT_HISTORY_NOT_RECONCILED');
});

test('retired identity and certificate must bind old exact owner and epoch',()=>{
  for(const change of [
    i=>{i.coordinator.retired.ownerId='other-owner';},
    i=>{i.coordinator.retired.generationId='other-generation';},
    i=>{i.coordinator.retired.leaseId='other-lease';},
    i=>{i.coordinator.retired.fencingEpoch=19;},
    i=>{i.coordinator.retired.certificateDigest=D('f');},
    i=>{i.coordinator.retired=null;}
  ])holds(change,'RECOVERY_RETIREMENT_ANCHOR_MISMATCH');
});

test('stale or future timestamps across journal, lookup and coordinator fail closed',()=>{
  for(const target of ['journal','lookup','coordinator']){
    const key=target==='journal'?'observedAtMs':'readAtMs';
    holds(i=>{i[target][key]=11000;},'RECOVERY_STALE_OR_FUTURE_EVIDENCE');
    holds(i=>{i[target][key]=8000;},'RECOVERY_STALE_OR_FUTURE_EVIDENCE');
  }
});

test('max age bound and impossible input values throw sanitized errors',()=>{
  for(const change of [
    i=>{i.maxAgeMs=60001;},
    i=>{i.nowMs=-1;},
    i=>{i.journal.leaseId='bad\nlease';},
    i=>{i.coordinator.mode='LAUNCHED';},
    i=>{i.lookup.kind='ACQUIRE';},
    i=>{i.lookup.commitIndex=-1;},
    i=>{i.journal.fencingEpoch=Number.MAX_SAFE_INTEGER;}
  ])assert.throws(()=>{const i=baseline();change(i);review(i);},
    /^Error: Invalid synthetic release recovery input$/);
});

test('inherited properties, getters, symbols and secret extras fail without execution',()=>{
  let calls=0;
  for(const change of [
    i=>{i.coordinator=Object.create(i.coordinator);},
    i=>{i.journal.secret='Bearer SECRET';},
    i=>{i.lookup[Symbol('secret')]=true;},
    i=>{Object.defineProperty(i.attempt,'txId',{
      enumerable:true,get(){calls++;throw Error('LEAK_SECRET');}});},
    i=>{Object.defineProperty(i.coordinator.retired,'ownerId',{
      enumerable:true,get(){calls++;throw Error('LEAK_SECRET');}});}
  ])assert.throws(()=>{const i=baseline();change(i);review(i);},
    /^Error: Invalid synthetic release recovery input$/);
  assert.equal(calls,0);
});

test('all reports remain immutable, sanitized and non-operational on HOLD',()=>{
  const out=holds(i=>{i.journal.phase='FENCED';},'RECOVERY_RETIREMENT_CERT_NOT_PERSISTED');
  assert.ok(Object.isFrozen(out)&&Object.isFrozen(out.issues));
  assert.doesNotMatch(JSON.stringify(out),/synthetic-tunnel|tx-release-01|Bearer/);
  assert.equal(out.safeToRetry,false);
  assert.equal(out.safeToRelease,false);
  assert.equal(out.startupAuthorized,false);
});

test('lookup outcome and journal phase cross-product never grants an effect',()=>{
  const statuses=['COMMITTED','NOT_SEEN','CONFLICT','INDETERMINATE'];
  const phases=['INTENT','FENCED','DRAINED','EXIT_WITNESSED','CERT_PERSISTED',
    'RELEASE_REQUESTED','RELEASE_CONFIRMED','UNKNOWN'];
  for(const status of statuses)for(const phase of phases){
    const out=check(i=>{i.journal.phase=phase;i.lookup.status=status;
      if(status!=='COMMITTED'){
        i.lookup.commitIndex=null;i.lookup.recordDigest=null;
      }
    });
    assert.equal(out.executionAuthorized,false);
    assert.equal(out.safeToRetry,false);
    assert.equal(out.startupAuthorized,false);
    if(status!=='COMMITTED'||!['RELEASE_REQUESTED','RELEASE_CONFIRMED'].includes(phase))
      assert.equal(out.decision,'HOLD',`${status}/${phase}`);
  }
});
