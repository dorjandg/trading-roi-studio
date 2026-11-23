// API1 P3-D: synthetic, read-only multi-sink fence barrier STRUCTURE review.
// No disk, browser, transport, clock, network, secrets, locks or live leases.
// Caller-provided receipts are never authenticated; reviewable is NOT safe.
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const HEX=/^[a-f0-9]{64}$/;
const LIMIT=Number.MAX_SAFE_INTEGER;
const id=x=>typeof x==='string'&&ID.test(x);
const hex=x=>typeof x==='string'&&HEX.test(x);
const n=x=>Number.isSafeInteger(x)&&x>=0&&x<LIMIT;
const pos=x=>n(x)&&x>0;
function record(x,fields){
  if(x===null||typeof x!=='object'||Array.isArray(x))return false;
  try{
    const p=Object.getPrototypeOf(x);
    if(p!==Object.prototype&&p!==null)return false;
    const ds=Object.getOwnPropertyDescriptors(x),names=Reflect.ownKeys(ds);
    return names.length===fields.length&&fields.every(k=>Object.hasOwn(ds,k))&&
      names.every(k=>typeof k==='string'&&fields.includes(k)&&
        Object.hasOwn(ds[k],'value')&&ds[k].enumerable===true);
  }catch{return false;}
}
function list(x,min,max){
  if(!Array.isArray(x))return false;
  try{
    if(Object.getPrototypeOf(x)!==Array.prototype||x.length<min||x.length>max)return false;
    const ds=Object.getOwnPropertyDescriptors(x),names=Reflect.ownKeys(ds);
    if(names.length!==x.length+1||!Object.hasOwn(ds,'length'))return false;
    return Array.from({length:x.length},(_,i)=>String(i)).every(k=>
      Object.hasOwn(ds,k)&&Object.hasOwn(ds[k],'value')&&ds[k].enumerable);
  }catch{return false;}
}
const INPUT=['snapshot','membership','barrier','acks','nowMs','maxAgeMs'];
const SNAPSHOT=['schemaVersion','resourceId','term','revision','commitIndex','epoch',
  'mode','ownerId','generationId','leaseId','headDigest','membershipRevision',
  'membershipDigest','readAtMs'];
const MEMBERSHIP=['schemaVersion','resourceId','revision','digest','sinks','term',
  'committedAtIndex','readAtMs'];
const BARRIER=['schemaVersion','barrierId','resourceId','membershipDigest',
  'epoch','phase','requestedAtMs','completedAtMs','headDigest','term',
  'coordinatorRevision','commitIndex'];
const ACK=['schemaVersion','sinkId','resourceId','barrierId','membershipDigest',
  'epoch','revision','commitIndex','persistedEpochFloor','persistedRevisionFloor','persistedCommitFloor',
  'ownerId','generationId','leaseId','queuedEffects','openSessions',
  'drainState','observedAtMs','receiptDigest'];
function validSnapshot(s){
  if(!record(s,SNAPSHOT)||s.schemaVersion!==1||!id(s.resourceId)||!pos(s.term)||
    !n(s.revision)||!n(s.commitIndex)||!pos(s.epoch)||!hex(s.headDigest)||
    !n(s.membershipRevision)||!hex(s.membershipDigest)||!n(s.readAtMs)||
    !['HELD','RETIRING','VACANT','UNKNOWN'].includes(s.mode))return false;
  if(![s.ownerId,s.generationId,s.leaseId].every(v=>v===null||id(v)))return false;
  if(s.mode==='HELD'&&![s.ownerId,s.generationId,s.leaseId].every(id))return false;
  if(s.mode==='VACANT'&&[s.ownerId,s.generationId,s.leaseId].some(v=>v!==null))return false;
  return true;
}
function validMembership(m){
  return record(m,MEMBERSHIP)&&m.schemaVersion===1&&id(m.resourceId)&&
    n(m.revision)&&hex(m.digest)&&list(m.sinks,1,16)&&m.sinks.every(id)&&
    pos(m.term)&&n(m.committedAtIndex)&&n(m.readAtMs);
}
function validBarrier(b){
  return record(b,BARRIER)&&b.schemaVersion===1&&id(b.barrierId)&&
    id(b.resourceId)&&hex(b.membershipDigest)&&pos(b.epoch)&&
    ['PUBLISHED','PREPARING','UNKNOWN'].includes(b.phase)&&
    n(b.requestedAtMs)&&n(b.completedAtMs)&&hex(b.headDigest)&&
    pos(b.term)&&n(b.coordinatorRevision)&&n(b.commitIndex);
}
function validAck(a){
  return record(a,ACK)&&a.schemaVersion===1&&
    [a.sinkId,a.resourceId,a.barrierId,a.ownerId,a.generationId,a.leaseId].every(id)&&
    hex(a.membershipDigest)&&hex(a.receiptDigest)&&pos(a.epoch)&&
    n(a.revision)&&n(a.commitIndex)&&pos(a.persistedEpochFloor)&&
    n(a.persistedRevisionFloor)&&n(a.persistedCommitFloor)&&n(a.queuedEffects)&&n(a.openSessions)&&
    ['COMPLETE','UNRESOLVED','UNKNOWN'].includes(a.drainState)&&n(a.observedAtMs);
}
function result(issues){
  const unique=Object.freeze([...new Set(issues)]);
  return Object.freeze({decision:unique.length?'HOLD':'STRUCTURE_REVIEWABLE',issues:unique,
    barrierVerified:false,allSinksFenced:false,quorumVerified:false,
    admissionAuthorized:false,effectAuthorized:false,sessionAuthorized:false,
    deliveryAuthorized:false,executionAuthorized:false,startupAuthorized:false,
    requiresAuthenticatedMembership:true,requiresDurablePerSinkFencing:true,
    requiresAtomicCoordinatorCommit:true,requiresIndependentDrainVerification:true});
}
/**
 * Structural correspondence between a claimed committed membership and ALL
 * enumerated sink receipts. One missing sink blocks review; quorum is NOT enough.
 * No receipt or topology field is proof until a separate trusted implementation.
 */
export function reviewMultiSinkFenceBarrier(input){
  if(!record(input,INPUT)||!validSnapshot(input.snapshot)||
    !validMembership(input.membership)||!validBarrier(input.barrier)||
    !list(input.acks,0,32)||!input.acks.every(validAck)||
    !n(input.nowMs)||!pos(input.maxAgeMs)||input.maxAgeMs>60_000)
    throw Error('Invalid synthetic multi-sink fence input');
  const {snapshot:s,membership:m,barrier:b,acks,nowMs,maxAgeMs}=input;
  const issues=[];
  if(s.mode!=='HELD')issues.push('SINK_BARRIER_OWNER_NOT_HELD');
  if(m.resourceId!==s.resourceId||b.resourceId!==s.resourceId||
      acks.some(a=>a.resourceId!==s.resourceId))issues.push('SINK_BARRIER_RESOURCE_MISMATCH');
  if(m.term!==s.term||b.term!==s.term)issues.push('SINK_BARRIER_TERM_MISMATCH');
  if(m.revision!==s.membershipRevision||m.digest!==s.membershipDigest||
      b.membershipDigest!==s.membershipDigest)
    issues.push('SINK_BARRIER_MEMBERSHIP_REBOUND');
  if(m.committedAtIndex>s.commitIndex)
    issues.push('SINK_BARRIER_TOPOLOGY_NOT_COMMITTED');
  if(b.headDigest!==s.headDigest||b.coordinatorRevision!==s.revision||
      b.commitIndex!==s.commitIndex)issues.push('SINK_BARRIER_COORDINATOR_HEAD_MISMATCH');
  if(b.epoch!==s.epoch)issues.push('SINK_BARRIER_EPOCH_MISMATCH');
  if(b.phase!=='PUBLISHED')issues.push('SINK_BARRIER_UNPUBLISHED');
  if(b.completedAtMs<b.requestedAtMs)
    issues.push('SINK_BARRIER_TIME_ORDER_INVALID');
  if(new Set(m.sinks).size!==m.sinks.length||
      m.sinks.some((x,i)=>i>0&&m.sinks[i-1]>=x))
    issues.push('SINK_BARRIER_INVALID_MEMBERSHIP');
  const ackIds=acks.map(a=>a.sinkId);
  if(new Set(ackIds).size!==ackIds.length)issues.push('SINK_BARRIER_DUPLICATE_ACK');
  if(new Set(acks.map(a=>a.receiptDigest)).size!==acks.length)
    issues.push('SINK_BARRIER_RECEIPT_REUSE');
  if(m.sinks.some(x=>!ackIds.includes(x)))issues.push('SINK_BARRIER_MISSING_ACK');
  if(ackIds.some(x=>!m.sinks.includes(x)))issues.push('SINK_BARRIER_UNREGISTERED_SINK');
  for(const a of acks){
    if(a.barrierId!==b.barrierId||a.membershipDigest!==m.digest)
      issues.push('SINK_BARRIER_ACK_REBIND');
    if(a.epoch!==s.epoch||a.revision!==s.revision||a.commitIndex!==s.commitIndex)
      issues.push('SINK_BARRIER_ACK_STALE_OR_FUTURE');
    if(a.persistedEpochFloor>a.epoch||a.persistedRevisionFloor>a.revision||
       a.persistedCommitFloor>a.commitIndex)
      issues.push('SINK_BARRIER_PERSISTED_FLOOR_ROLLBACK');
    if(a.ownerId!==s.ownerId||a.generationId!==s.generationId||a.leaseId!==s.leaseId)
      issues.push('SINK_BARRIER_OWNER_REBOUND');
    if(a.drainState!=='COMPLETE'||a.queuedEffects!==0||a.openSessions!==0)
      issues.push('SINK_BARRIER_WORK_IN_FLIGHT');
    if(a.observedAtMs<b.requestedAtMs||a.observedAtMs>b.completedAtMs)
      issues.push('SINK_BARRIER_ACK_OUTSIDE_WINDOW');
  }
  for(const t of [s.readAtMs,m.readAtMs,b.completedAtMs,...acks.map(a=>a.observedAtMs)]){
    if(t>nowMs||nowMs-t>maxAgeMs){issues.push('SINK_BARRIER_EVIDENCE_STALE');break;}
  }
  // This is deliberately ONLY a shape check: no membership authority,
  // cryptographic verification, fence durability or effect-admission grant.
  return result(issues);
}
