// API1 Phase 3 P3-C: pure, synthetic retirement-CAS recovery reconciliation.
// No durable storage, retries, fsync, clocks, process inspection or network.
// A structural match NEVER confirms retirement, permits a retry, or starts a tunnel.
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MAX = Number.MAX_SAFE_INTEGER;
const id = v => typeof v === 'string' && ID.test(v);
const digest = v => typeof v === 'string' && DIGEST.test(v);
const num = v => Number.isSafeInteger(v) && v >= 0 && v < MAX;
const positive = v => num(v) && v > 0;
function record(value, fields) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const p = Object.getPrototypeOf(value);
    if (p !== Object.prototype && p !== null) return false;
    const ds = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(ds);
    return names.length === fields.length &&
      fields.every(key => Object.hasOwn(ds,key)) &&
      names.every(key => typeof key === 'string' && fields.includes(key) &&
        Object.hasOwn(ds[key],'value') && ds[key].enumerable);
  } catch {return false;}
}
const INPUT = ['journal','attempt','lookup','coordinator','nowMs','maxAgeMs'];
const JOURNAL = ['schemaVersion','resourceId','oldOwnerId','generationId',
  'leaseId','fencingEpoch','phase','txId','requestDigest','certificateDigest',
  'previousCoordinatorRevision','previousCoordinatorCommitIndex',
  'localSequence','journalHeadDigest','fileSyncClaim','directorySyncClaim','observedAtMs'];
const ATTEMPT = ['txId','resourceId','kind','requestDigest','expectedRevision',
  'expectedEpoch','ackStatus','ackCommitIndex'];
const LOOKUP = ['txId','kind','status','requestDigest','expectedRevision',
  'expectedEpoch','commitIndex','recordDigest','readAtMs'];
const COORDINATOR = ['schemaVersion','coordinatorId','resourceId','mode','revision',
  'fencingEpoch','commitIndex','headDigest','reportedConsistency','holder',
  'retired','readAtMs'];
const HOLDER = ['ownerId','generationId','leaseId','fencingEpoch'];
const RETIRED = ['ownerId','generationId','leaseId','fencingEpoch','certificateDigest'];
function validJournal(j) {
  return record(j,JOURNAL) && j.schemaVersion===1 &&
    [j.resourceId,j.oldOwnerId,j.generationId,j.leaseId,j.txId].every(id) &&
    positive(j.fencingEpoch) &&
    ['INTENT','FENCED','DRAINED','EXIT_WITNESSED','CERT_PERSISTED',
      'RELEASE_REQUESTED','RELEASE_CONFIRMED','UNKNOWN'].includes(j.phase) &&
    digest(j.requestDigest) && (j.certificateDigest===null||digest(j.certificateDigest)) &&
    num(j.previousCoordinatorRevision) && num(j.previousCoordinatorCommitIndex) &&
    num(j.localSequence) && digest(j.journalHeadDigest) &&
    typeof j.fileSyncClaim==='boolean' && typeof j.directorySyncClaim==='boolean' &&
    num(j.observedAtMs);
}
function validAttempt(a) {
  return record(a,ATTEMPT) && [a.txId,a.resourceId].every(id) &&
    a.kind==='PUBLISH_RETIREMENT' && digest(a.requestDigest) &&
    num(a.expectedRevision) && positive(a.expectedEpoch) &&
    ['ACK_APPLIED','ACK_LOST','TIMEOUT','ACK_CONFLICT'].includes(a.ackStatus) &&
    (a.ackCommitIndex===null||positive(a.ackCommitIndex));
}
function validLookup(l) {
  return record(l,LOOKUP) && l.kind==='PUBLISH_RETIREMENT' && id(l.txId) &&
    ['COMMITTED','NOT_SEEN','CONFLICT','INDETERMINATE'].includes(l.status) &&
    digest(l.requestDigest) && num(l.expectedRevision) &&
    positive(l.expectedEpoch) && num(l.readAtMs) &&
    (l.status==='COMMITTED' ? positive(l.commitIndex)&&digest(l.recordDigest) :
      l.commitIndex===null && l.recordDigest===null);
}
function validCoordinator(c) {
  if (!record(c,COORDINATOR) || c.schemaVersion!==1 ||
      ![c.coordinatorId,c.resourceId].every(id) ||
      !['HELD','RETIRING','VACANT','UNKNOWN'].includes(c.mode) ||
      !num(c.revision)||!positive(c.fencingEpoch)||!num(c.commitIndex)||
      !digest(c.headDigest)||c.reportedConsistency!=='linearizable-asserted'||
      !num(c.readAtMs))return false;
  if (c.holder!==null && (!record(c.holder,HOLDER)||
      ![c.holder.ownerId,c.holder.generationId,c.holder.leaseId].every(id)||
      !positive(c.holder.fencingEpoch)))return false;
  if(c.retired!==null && (!record(c.retired,RETIRED)||
      ![c.retired.ownerId,c.retired.generationId,c.retired.leaseId].every(id)||
      !positive(c.retired.fencingEpoch)||!digest(c.retired.certificateDigest)))return false;
  if (['HELD','RETIRING'].includes(c.mode)&&c.holder===null)return false;
  if (c.mode==='VACANT'&&c.holder!==null)return false;
  return true;
}
function result(issues) {
  const unique=[...new Set(issues)];
  return Object.freeze({
    decision:unique.length?'HOLD':'STRUCTURE_REVIEWABLE',
    issues:Object.freeze(unique),
    recoveryComplete:false, retirementVerified:false, leaseGranted:false,
    executionAuthorized:false, safeToRetry:false, safeToRelease:false,
    startupAuthorized:false, witnessVerified:false, durableJournalVerified:false,
    coordinatorAuthenticated:false, coordinatorCASVerified:false,
    requiresAuthoritativeRead:true, requiresDurableJournalVerification:true,
    requiresIndependentExitWitness:true, requiresResourceSideFencing:true,
    requiresFreshOperatorApproval:true
  });
}
/**
 * Synthetic, non-operational reconciliation for one uncertain retirement
 * publication. Even a matching COMMITTED lookup is only a claim, not proof
 * of an authenticated durable coordinator release or verified process exit.
 */
export function reviewRetirementReleaseRecovery(input) {
  if (!record(input,INPUT) || !validJournal(input.journal) ||
      !validAttempt(input.attempt) || !validLookup(input.lookup) ||
      !validCoordinator(input.coordinator) || !num(input.nowMs) ||
      !positive(input.maxAgeMs)||input.maxAgeMs>60_000)
    throw Error('Invalid synthetic release recovery input');
  const {journal:j,attempt:a,lookup:l,coordinator:c,nowMs,maxAgeMs} = input;
  const issues=[];
  if (a.resourceId!==j.resourceId || c.resourceId!==j.resourceId)
    issues.push('RECOVERY_RESOURCE_SCOPE_MISMATCH');
  if (a.txId!==j.txId || l.txId!==j.txId ||
      l.requestDigest!==j.requestDigest || a.requestDigest!==j.requestDigest ||
      l.kind!==a.kind)
    issues.push('RECOVERY_TRANSACTION_REPLAY_OR_REBIND');
  if (a.expectedRevision!==j.previousCoordinatorRevision ||
      l.expectedRevision!==a.expectedRevision ||
      a.expectedEpoch!==j.fencingEpoch || l.expectedEpoch!==a.expectedEpoch)
    issues.push('RECOVERY_EXPECTATIONS_MISMATCH');
  if (c.fencingEpoch!==j.fencingEpoch)
    issues.push('RECOVERY_EPOCH_CONFLICT');
  if (a.ackStatus==='ACK_APPLIED' ? a.ackCommitIndex===null : a.ackCommitIndex!==null)
    issues.push('RECOVERY_ACK_SHAPE_CONTRADICTION');
  if (a.ackStatus==='ACK_CONFLICT' && l.status==='COMMITTED')
    issues.push('RECOVERY_ACK_LOOKUP_CONTRADICTION');
  if (a.ackStatus==='ACK_APPLIED' && l.status!=='COMMITTED')
    issues.push('RECOVERY_ACK_LOOKUP_CONTRADICTION');
  if (['UNKNOWN','INTENT','FENCED','DRAINED','EXIT_WITNESSED'].includes(j.phase))
    issues.push('RECOVERY_RETIREMENT_CERT_NOT_PERSISTED');
  if (j.phase==='CERT_PERSISTED' && l.status==='COMMITTED')
    issues.push('RECOVERY_RELEASE_PHASE_INCONSISTENT');
  if (!j.fileSyncClaim || !j.directorySyncClaim || !j.certificateDigest)
    issues.push('RECOVERY_JOURNAL_DURABILITY_UNCONFIRMED');
  if (l.status!=='COMMITTED')
    issues.push(l.status==='CONFLICT'?'RECOVERY_TRANSACTION_CONFLICT':
      l.status==='NOT_SEEN'?'RECOVERY_NOT_SEEN_NOT_SAFE_TO_RETRY':
      'RECOVERY_TRANSACTION_INDETERMINATE');
  if (c.mode!=='VACANT') issues.push('RECOVERY_COORDINATOR_NOT_VACANT');
  if (c.holder!==null) issues.push('RECOVERY_OLD_HOLDER_STILL_PRESENT');
  for (const timestamp of [j.observedAtMs,l.readAtMs,c.readAtMs]) {
    if (timestamp>nowMs || nowMs-timestamp>maxAgeMs) {
      issues.push('RECOVERY_STALE_OR_FUTURE_EVIDENCE');
      break;
    }
  }
  if (l.status==='COMMITTED') {
    if (a.ackCommitIndex!==null && a.ackCommitIndex!==l.commitIndex)
      issues.push('RECOVERY_ACK_COMMIT_INDEX_MISMATCH');
    // Require an exact head/commit match. A later head requires independent
    // authenticated journal reconstruction, never an optimistic shortcut.
    if (c.revision!==a.expectedRevision+1 ||
        c.commitIndex!==l.commitIndex ||
        c.commitIndex<=j.previousCoordinatorCommitIndex ||
        c.headDigest!==l.recordDigest)
      issues.push('RECOVERY_COMMIT_HISTORY_NOT_RECONCILED');
  }
  if (!c.retired || c.retired.ownerId!==j.oldOwnerId ||
      c.retired.generationId!==j.generationId ||
      c.retired.leaseId!==j.leaseId ||
      c.retired.fencingEpoch!==j.fencingEpoch ||
      c.retired.certificateDigest!==j.certificateDigest)
    issues.push('RECOVERY_RETIREMENT_ANCHOR_MISMATCH');
  // No action is permitted by this untrusted structural comparison.
  return result(issues);
}
