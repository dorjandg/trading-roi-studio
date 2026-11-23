import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewMultiSinkFenceBarrier as review} from '../simulation/private-runtime-multi-sink-fence-barrier.mjs';
const D=x=>x.repeat(64);
const owner={ownerId:'owner-v2',generationId:'gen-v2',leaseId:'lease-v2'};
const snapshot={schemaVersion:1,resourceId:'synthetic-tunnel',term:4,
  revision:98,commitIndex:178,epoch:12,mode:'HELD',...owner,
  headDigest:D('a'),membershipRevision:7,membershipDigest:D('b'),readAtMs:2000};
const membership={schemaVersion:1,resourceId:snapshot.resourceId,revision:7,
  digest:D('b'),sinks:['sink-a','sink-b','sink-c'],term:4,
  committedAtIndex:175,readAtMs:2000};
const barrier={schemaVersion:1,barrierId:'barrier-12',resourceId:snapshot.resourceId,
  membershipDigest:D('b'),epoch:12,phase:'PUBLISHED',requestedAtMs:1900,
  completedAtMs:2000,headDigest:D('a'),term:4,coordinatorRevision:98,commitIndex:178};
const ack=sinkId=>({schemaVersion:1,sinkId,resourceId:snapshot.resourceId,
  barrierId:barrier.barrierId,membershipDigest:D('b'),epoch:12,revision:98,
  commitIndex:178,persistedEpochFloor:12,persistedRevisionFloor:98,
  persistedCommitFloor:178,...owner,
  queuedEffects:0,openSessions:0,drainState:'COMPLETE',observedAtMs:1950,
  receiptDigest:D(sinkId==='sink-a'?'1':sinkId==='sink-b'?'2':'3')});
const acks=membership.sinks.map(ack);
const fixture=()=>structuredClone({snapshot,membership,barrier,acks,nowMs:2100,maxAgeMs:2000});
const run=mutate=>{const x=fixture();if(mutate)mutate(x);return review(x);};
function hold(mutate,reason){const out=run(mutate);
  assert.equal(out.decision,'HOLD');
  assert.ok(out.issues.includes(reason),`expected ${reason}, got ${out.issues}`);
  assert.equal(out.executionAuthorized,false);
  return out;
}
test('P3-D all claimed sinks may be structure-reviewable, never authorized',()=>{
  const input=fixture(),before=structuredClone(input),o=review(input);
  assert.deepEqual(o.issues,[]);
  assert.equal(o.decision,'STRUCTURE_REVIEWABLE');
  for(const field of ['barrierVerified','allSinksFenced','quorumVerified',
    'admissionAuthorized','effectAuthorized','sessionAuthorized',
    'deliveryAuthorized','executionAuthorized','startupAuthorized'])
    assert.equal(o[field],false);
  assert.equal(o.requiresAuthenticatedMembership,true);
  assert.equal(o.requiresDurablePerSinkFencing,true);
  assert.ok(Object.isFrozen(o)&&Object.isFrozen(o.issues));
  assert.deepEqual(input,before);
});
test('a majority is not enough; missing any one sink must HOLD',()=>{
  for(let i=0;i<3;i++)hold(x=>{x.acks.splice(i,1);},'SINK_BARRIER_MISSING_ACK');
});
test('zero acknowledgements and extra unregistered sink HOLD',()=>{
  hold(x=>{x.acks=[];},'SINK_BARRIER_MISSING_ACK');
  hold(x=>{x.acks.push(ack('sink-z'));},'SINK_BARRIER_UNREGISTERED_SINK');
});
test('duplicate acknowledgements never count twice',()=>{
  hold(x=>{x.acks[1]=structuredClone(x.acks[0]);},'SINK_BARRIER_DUPLICATE_ACK');
});
test('duplicated receipt digest across distinct sinks is not independent evidence',()=>{
  hold(x=>{x.acks[1].receiptDigest=x.acks[0].receiptDigest;},'SINK_BARRIER_RECEIPT_REUSE');
});
test('duplicated or unsorted membership is not an authoritative inventory',()=>{
  hold(x=>{x.membership.sinks=['sink-a','sink-a','sink-c'];},'SINK_BARRIER_INVALID_MEMBERSHIP');
  hold(x=>{x.membership.sinks=['sink-b','sink-a','sink-c'];},'SINK_BARRIER_INVALID_MEMBERSHIP');
});
test('missing or post-head membership commit HOLD',()=>{
  hold(x=>{x.membership.committedAtIndex=179;},'SINK_BARRIER_TOPOLOGY_NOT_COMMITTED');
  hold(x=>{x.membership.revision=8;},'SINK_BARRIER_MEMBERSHIP_REBOUND');
  hold(x=>{x.membership.digest=D('f');},'SINK_BARRIER_MEMBERSHIP_REBOUND');
  hold(x=>{x.barrier.membershipDigest=D('e');},'SINK_BARRIER_MEMBERSHIP_REBOUND');
});
test('old membership witness rebound and future term HOLD',()=>{
  hold(x=>{x.membership.term=5;},'SINK_BARRIER_TERM_MISMATCH');
  hold(x=>{x.barrier.term=3;},'SINK_BARRIER_TERM_MISMATCH');
});
test('uncommitted or unknown fence publication HOLD',()=>{
  for(const phase of ['PREPARING','UNKNOWN'])
    hold(x=>{x.barrier.phase=phase;},'SINK_BARRIER_UNPUBLISHED');
});
test('coordinator history and head are an exact barrier scope',()=>{
  for(const key of ['coordinatorRevision','commitIndex'])
    hold(x=>{x.barrier[key]++;},'SINK_BARRIER_COORDINATOR_HEAD_MISMATCH');
  hold(x=>{x.barrier.headDigest=D('f');},'SINK_BARRIER_COORDINATOR_HEAD_MISMATCH');
});
test('an epoch ahead or behind holds',()=>{
  for(const epoch of [11,13])
    hold(x=>{x.barrier.epoch=epoch;},'SINK_BARRIER_EPOCH_MISMATCH');
});
test('stale sink receipt epochs and commit indices fail closed',()=>{
  hold(x=>{x.acks[1].epoch=11;},'SINK_BARRIER_ACK_STALE_OR_FUTURE');
  hold(x=>{x.acks[1].epoch=13;},'SINK_BARRIER_ACK_STALE_OR_FUTURE');
  hold(x=>{x.acks[1].revision=97;},'SINK_BARRIER_ACK_STALE_OR_FUTURE');
  hold(x=>{x.acks[1].commitIndex=180;},'SINK_BARRIER_ACK_STALE_OR_FUTURE');
});
test('sink fencing high-water regression after simulated restart HOLD',()=>{
  hold(x=>{x.acks[0].persistedEpochFloor=13;},'SINK_BARRIER_PERSISTED_FLOOR_ROLLBACK');
  hold(x=>{x.acks[0].persistedCommitFloor=179;},'SINK_BARRIER_PERSISTED_FLOOR_ROLLBACK');
  hold(x=>{x.acks[0].persistedRevisionFloor=99;},'SINK_BARRIER_PERSISTED_FLOOR_ROLLBACK');
});
test('different owner/lease/generation on any sink HOLD',()=>{
  for(const key of ['ownerId','leaseId','generationId'])
    hold(x=>{x.acks[2][key]='old-owner';},'SINK_BARRIER_OWNER_REBOUND');
});
test('in-flight work prevents a completed drain assertion',()=>{
  hold(x=>{x.acks[0].queuedEffects=1;},'SINK_BARRIER_WORK_IN_FLIGHT');
  hold(x=>{x.acks[1].openSessions=1;},'SINK_BARRIER_WORK_IN_FLIGHT');
  for(const state of ['UNRESOLVED','UNKNOWN'])
    hold(x=>{x.acks[2].drainState=state;},'SINK_BARRIER_WORK_IN_FLIGHT');
});
test('replayed barrier ID or membership digest in an ack HOLD',()=>{
  hold(x=>{x.acks[0].barrierId='old-barrier';},'SINK_BARRIER_ACK_REBIND');
  hold(x=>{x.acks[0].membershipDigest=D('f');},'SINK_BARRIER_ACK_REBIND');
});
test('old barriers cannot be bound to a new resource',()=>{
  hold(x=>{x.barrier.resourceId='other-tunnel';},'SINK_BARRIER_RESOURCE_MISMATCH');
  hold(x=>{x.acks[0].resourceId='other-tunnel';},'SINK_BARRIER_RESOURCE_MISMATCH');
  hold(x=>{x.membership.resourceId='other-tunnel';},'SINK_BARRIER_RESOURCE_MISMATCH');
});
test('non-held coordinator modes remain blocked',()=>{
  for(const mode of ['RETIRING','UNKNOWN'])
    hold(x=>{x.snapshot.mode=mode;},'SINK_BARRIER_OWNER_NOT_HELD');
  hold(x=>{x.snapshot.mode='VACANT';x.snapshot.ownerId=null;
    x.snapshot.generationId=null;x.snapshot.leaseId=null;},'SINK_BARRIER_OWNER_NOT_HELD');
});
test('acknowledgement timestamp before request or after barrier HOLD',()=>{
  hold(x=>{x.acks[1].observedAtMs=1899;},'SINK_BARRIER_ACK_OUTSIDE_WINDOW');
  hold(x=>{x.acks[1].observedAtMs=2001;},'SINK_BARRIER_ACK_OUTSIDE_WINDOW');
  hold(x=>{x.barrier.completedAtMs=1899;},'SINK_BARRIER_TIME_ORDER_INVALID');
});
test('stale and future evidence cannot support review',()=>{
  for(const target of ['snapshot','membership']){
    hold(x=>{x[target].readAtMs=5000;},'SINK_BARRIER_EVIDENCE_STALE');
    hold(x=>{x[target].readAtMs=0;},'SINK_BARRIER_EVIDENCE_STALE');
  }
  hold(x=>{x.acks[0].observedAtMs=3000;},'SINK_BARRIER_EVIDENCE_STALE');
});
test('malformed, inherited and accessor inputs rejected before reading values',()=>{
  let called=0;
  for(const change of [
    x=>{x.membership.sinks=[];},
    x=>{x.membership.sinks=Array.from({length:17},(_,i)=>`sink-${i}`);},
    x=>{x.membership.sinks[0]='sink\nsecret';},
    x=>{x.membership.sinks=Object.create(x.membership.sinks);},
    x=>{x.acks[0].secret='Bearer secret';},
    x=>{x.acks[0]=Object.create(x.acks[0]);},
    x=>{x.snapshot[Symbol('secret')]='token';},
    x=>{Object.defineProperty(x.barrier,'epoch',{get(){called++;throw Error('secret');}});},
    x=>{Object.defineProperty(x.acks,'0',{get(){called++;throw Error('secret');}});}
  ]){
    const x=fixture();change(x);
    assert.throws(()=>review(x),/^Error: Invalid synthetic multi-sink fence input$/);
  }
  assert.equal(called,0);
});
test('unknown properties and oversized receipt arrays rejected',()=>{
  for(const change of [
    x=>{x.snapshot.extra='token';},
    x=>{x.maxAgeMs=60001;},
    x=>{x.acks=Array.from({length:33},(_,i)=>ack(`sink-${i}`));},
    x=>{x.membership.sinks[5]='sink-d';},
    x=>{x.nowMs=Infinity;}
  ]){const x=fixture();change(x);assert.throws(()=>review(x),
    /^Error: Invalid synthetic multi-sink fence input$/);}
});
test('result never echoes IDs, digests, paths or any secret',()=>{
  const x=fixture();x.acks[0].ownerId='secret-owner';
  const o=review(x);assert.equal(o.decision,'HOLD');
  assert.doesNotMatch(JSON.stringify(o),/secret-owner|synthetic-tunnel|sink-a|barrier-12|\/[a-z]+\//);
});
test('deterministic matrix: only exact sink epoch is structurally reviewable',()=>{
  for(let epoch=1;epoch<=12;epoch++)for(let ackEpoch=1;ackEpoch<=12;ackEpoch++){
    const x=fixture();x.snapshot.epoch=epoch;x.barrier.epoch=epoch;
    x.acks.forEach(a=>{a.epoch=epoch;a.persistedEpochFloor=epoch;});
    x.acks[0].epoch=ackEpoch;
    const o=review(x);
    assert.equal(o.decision,ackEpoch===epoch?'STRUCTURE_REVIEWABLE':'HOLD');
    assert.equal(o.executionAuthorized,false);
  }
});
