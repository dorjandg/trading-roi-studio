// API1 P3-A NEXT: PURE synthetic transcript review, not a coordinator client.
// No filesystem, network, secrets, process inspection, locks or side effects.
// Never turns an asserted commit, journal hash, or clock into a trusted lease.
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MAX = Number.MAX_SAFE_INTEGER;
const id = x => typeof x === 'string' && ID.test(x);
const digest = x => typeof x === 'string' && DIGEST.test(x);
const num = x => Number.isSafeInteger(x) && x >= 0 && x < MAX;
const pos = x => num(x) && x > 0;
function shape(x, keys) {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return false;
  try {
    const prototype = Object.getPrototypeOf(x);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(x);
    const owned = Reflect.ownKeys(descriptors);
    return owned.length === keys.length && keys.every(k => Object.hasOwn(descriptors, k)) &&
      owned.every(k => typeof k === 'string' && keys.includes(k) &&
        Object.hasOwn(descriptors[k], 'value') && descriptors[k].enumerable);
  } catch { return false; }
}
const INPUT = ['before', 'operation', 'after', 'receipt', 'nowMs', 'maxAgeMs'];
const SNAP = ['schemaVersion','resourceId','revision','fencingEpoch','mode','holder','retired','commitIndex','headDigest'];
const HOLDER = ['ownerId','generationId','leaseId','fencingEpoch','expiresAtMs'];
const RETIRED = ['ownerId','generationId','leaseId','fencingEpoch','receiptDigest'];
const OP = ['txId','kind','resourceId','expectedRevision','expectedEpoch','ownerId','generationId','leaseId','nextExpiresAtMs','retirementDigest'];
const RECEIPT = ['txId','kind','result','expectedRevision','expectedEpoch','coordinatorId','commitIndex','previousDigest','recordDigest','observedAtMs','durability'];
const sameOwner = (a,b) => a && b && a.ownerId===b.ownerId && a.generationId===b.generationId &&
  a.leaseId===b.leaseId && a.fencingEpoch===b.fencingEpoch;
const sameRequestOwner = (a,o) => a && o && a.ownerId===o.ownerId &&
  a.generationId===o.generationId && a.leaseId===o.leaseId &&
  a.fencingEpoch===o.expectedEpoch;
function validSnapshot(x) {
  if (!shape(x,SNAP) || x.schemaVersion!==1 || !id(x.resourceId) ||
      !num(x.revision) || !num(x.fencingEpoch) || !num(x.commitIndex) ||
      !digest(x.headDigest) || !['HELD','RETIRING','VACANT','UNKNOWN'].includes(x.mode)) return false;
  if (x.holder!==null && (!shape(x.holder,HOLDER) ||
      ![x.holder.ownerId,x.holder.generationId,x.holder.leaseId].every(id) ||
      !pos(x.holder.fencingEpoch) || !pos(x.holder.expiresAtMs))) return false;
  if (x.retired!==null && (!shape(x.retired,RETIRED) ||
      ![x.retired.ownerId,x.retired.generationId,x.retired.leaseId].every(id) ||
      !pos(x.retired.fencingEpoch) || !digest(x.retired.receiptDigest))) return false;
  if (['HELD','RETIRING'].includes(x.mode) && x.holder===null) return false;
  if (x.mode==='VACANT' && x.holder!==null) return false;
  return true;
}
function validOperation(o) {
  return shape(o,OP) && id(o.txId) &&
    ['BEGIN_RETIRE','PUBLISH_RETIREMENT','ACQUIRE','RENEW'].includes(o.kind) &&
    [o.resourceId,o.ownerId,o.generationId,o.leaseId].every(id) &&
    num(o.expectedRevision) && num(o.expectedEpoch) &&
    (o.nextExpiresAtMs===null || pos(o.nextExpiresAtMs)) &&
    (o.retirementDigest===null || digest(o.retirementDigest));
}
function validReceipt(x) {
  return shape(x,RECEIPT) && id(x.txId) && id(x.coordinatorId) &&
    ['BEGIN_RETIRE','PUBLISH_RETIREMENT','ACQUIRE','RENEW'].includes(x.kind) &&
    ['APPLIED','CONFLICT','UNKNOWN'].includes(x.result) &&
    num(x.expectedRevision) && num(x.expectedEpoch) && num(x.commitIndex) &&
    digest(x.previousDigest) && digest(x.recordDigest) && num(x.observedAtMs) &&
    x.durability==='coordinator-asserted';
}
function report(issues) {
  return Object.freeze({
    decision: issues.length ? 'HOLD' : 'STRUCTURE_REVIEWABLE',
    issues: Object.freeze([...new Set(issues)]),
    coordinatorAuthenticated: false, durableCommitVerified: false,
    leaseGranted: false, retirementVerified: false, executionAuthorized: false,
    requiresLinearizableCAS: true, requiresResourceSideFencing: true,
    requiresAuthoritativeRecoveryRead: true
  });
}
/**
 * Pure consistency check of an UNTRUSTED single-CAS transcript. All fields,
 * including 'durability' and coordinator identity, are caller assertions.
 * It cannot establish atomicity, durability, signature trust, or live ownership.
 */
export function reviewDurableCoordinatorTranscript(input) {
  if (!shape(input,INPUT)) throw Error('Invalid synthetic coordinator transcript');
  const {before,after,operation,receipt,nowMs,maxAgeMs} = input;
  if (!validSnapshot(before) || !validSnapshot(after) || !validOperation(operation) ||
      !validReceipt(receipt) || !num(nowMs) || !pos(maxAgeMs) || maxAgeMs>60_000)
    throw Error('Invalid synthetic coordinator transcript');
  const issues = [];
  if (before.mode==='UNKNOWN' || after.mode==='UNKNOWN') issues.push('COORDINATOR_STATE_UNKNOWN');
  if (receipt.result==='UNKNOWN') issues.push('COORDINATOR_OUTCOME_UNKNOWN');
  if (receipt.result==='CONFLICT') issues.push('COORDINATOR_CAS_CONFLICT');
  if (before.resourceId!==after.resourceId || before.resourceId!==operation.resourceId)
    issues.push('COORDINATOR_RESOURCE_MISMATCH');
  if (before.revision!==operation.expectedRevision || before.fencingEpoch!==operation.expectedEpoch ||
      receipt.expectedRevision!==operation.expectedRevision || receipt.expectedEpoch!==operation.expectedEpoch)
    issues.push('COORDINATOR_EXPECTATION_MISMATCH');
  if (operation.txId!==receipt.txId || operation.kind!==receipt.kind)
    issues.push('COORDINATOR_TRANSACTION_MISMATCH');
  if (receipt.observedAtMs>nowMs || nowMs-receipt.observedAtMs>maxAgeMs)
    issues.push('COORDINATOR_RECEIPT_STALE');
  if (before.revision+1>=MAX || before.commitIndex+1>=MAX ||
      after.revision!==before.revision+1 || after.commitIndex!==before.commitIndex+1 ||
      receipt.commitIndex!==after.commitIndex || receipt.previousDigest!==before.headDigest ||
      receipt.recordDigest!==after.headDigest || receipt.recordDigest===receipt.previousDigest)
    issues.push('COORDINATOR_JOURNAL_OR_REVISION_CONFLICT');
  if (receipt.result!=='APPLIED') return report(issues);
  const unchangedRetired = JSON.stringify(after.retired)===JSON.stringify(before.retired);
  const beforeHolder = before.holder;
  switch(operation.kind) {
    case 'BEGIN_RETIRE':
      if(before.mode!=='HELD' || after.mode!=='RETIRING' ||
         !sameOwner(beforeHolder,after.holder) || !sameRequestOwner(beforeHolder,operation) ||
         before.fencingEpoch!==after.fencingEpoch ||
         !unchangedRetired || operation.retirementDigest!==null || operation.nextExpiresAtMs!==null ||
         beforeHolder?.expiresAtMs!==after.holder?.expiresAtMs)
        issues.push('COORDINATOR_RETIRE_BEGIN_INVALID');
      break;
    case 'PUBLISH_RETIREMENT':
      if(before.mode!=='RETIRING' || after.mode!=='VACANT' || after.holder!==null ||
         !beforeHolder || !sameRequestOwner(beforeHolder,operation) ||
         before.fencingEpoch!==after.fencingEpoch ||
         !after.retired || !sameOwner(beforeHolder,after.retired) ||
         operation.retirementDigest===null ||
         operation.retirementDigest!==after.retired?.receiptDigest ||
         operation.nextExpiresAtMs!==null)
        issues.push('COORDINATOR_RETIRE_PUBLISH_INVALID');
      break;
    case 'ACQUIRE':
      if(before.mode!=='VACANT' || after.mode!=='HELD' || before.holder!==null ||
         !before.retired || !unchangedRetired ||
         operation.retirementDigest!==before.retired?.receiptDigest ||
         after.fencingEpoch!==before.fencingEpoch+1 ||
         !after.holder || !sameOwner(after.holder,{...operation,fencingEpoch:after.fencingEpoch}) ||
         after.holder.expiresAtMs!==operation.nextExpiresAtMs ||
         !pos(operation.nextExpiresAtMs) ||
         operation.nextExpiresAtMs<=nowMs ||
         operation.nextExpiresAtMs-nowMs>30_000 ||
         [before.retired?.ownerId,before.retired?.generationId,before.retired?.leaseId]
           .some((x,i)=>x===[operation.ownerId,operation.generationId,operation.leaseId][i]))
        issues.push('COORDINATOR_ACQUIRE_INVALID');
      break;
    case 'RENEW':
      if(before.mode!=='HELD' || after.mode!=='HELD' || !beforeHolder ||
         !sameOwner(beforeHolder,after.holder) || !sameRequestOwner(beforeHolder,operation) ||
         !unchangedRetired || before.fencingEpoch!==after.fencingEpoch ||
         operation.retirementDigest!==null ||
         !pos(operation.nextExpiresAtMs) ||
         after.holder?.expiresAtMs!==operation.nextExpiresAtMs ||
         operation.nextExpiresAtMs<=beforeHolder.expiresAtMs ||
         nowMs>=beforeHolder.expiresAtMs)
        issues.push('COORDINATOR_RENEW_INVALID');
      break;
  }
  if ((before.holder && before.holder.fencingEpoch!==before.fencingEpoch) ||
      (after.holder && after.holder.fencingEpoch!==after.fencingEpoch))
    issues.push('COORDINATOR_FENCING_CONFLICT');
  return report(issues);
}
