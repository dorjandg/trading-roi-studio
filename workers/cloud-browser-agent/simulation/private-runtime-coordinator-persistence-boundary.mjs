// API1 Phase 3: synthetic recovery/readback boundary, NOT a persistence client.
// No filesystem, network, clocks, credentials, locks, or effectful imports.
// Every claimed coordinator read and durable transaction is UNAUTHENTICATED.
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const SHA = /^[a-f0-9]{64}$/;
const MAX = Number.MAX_SAFE_INTEGER;
const validId = x => typeof x === 'string' && ID.test(x);
const validSha = x => typeof x === 'string' && SHA.test(x);
const safe = x => Number.isSafeInteger(x) && x >= 0 && x < MAX;
const positive = x => safe(x) && x > 0;

function record(x, keys) {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return false;
  try {
    const p = Object.getPrototypeOf(x);
    if (p !== Object.prototype && p !== null) return false;
    const ds = Object.getOwnPropertyDescriptors(x);
    const names = Reflect.ownKeys(ds);
    return names.length === keys.length && keys.every(k => Object.hasOwn(ds,k)) &&
      names.every(k => typeof k === 'string' && keys.includes(k) &&
        Object.hasOwn(ds[k], 'value') && ds[k].enumerable);
  } catch { return false; }
}
const INPUT = ['attempt','readback','nowMs','maxAgeMs'];
const ATTEMPT = ['schemaVersion','txId','kind','resourceId','expectedRevision',
  'expectedEpoch','requestDigest','ackStatus','ackCommitIndex'];
const READBACK = ['schemaVersion','coordinatorId','term','consistency','txId',
  'resourceId','mode','revision','fencingEpoch','commitIndex','headDigest',
  'readAtMs','transaction'];
const TX = ['status','kind','requestDigest','commitIndex','recordDigest',
  'expectedRevision','expectedEpoch'];
const KINDS = ['BEGIN_RETIRE','PUBLISH_RETIREMENT','ACQUIRE','RENEW'];
const ACKS = ['ACK_APPLIED','ACK_CONFLICT','ACK_LOST','TIMEOUT'];
const TX_STATUS = ['COMMITTED','CONFLICT','NOT_SEEN','INDETERMINATE'];

function validAttempt(a) {
  return record(a,ATTEMPT) && a.schemaVersion === 1 && validId(a.txId) &&
    KINDS.includes(a.kind) && validId(a.resourceId) &&
    safe(a.expectedRevision) && safe(a.expectedEpoch) && validSha(a.requestDigest) &&
    ACKS.includes(a.ackStatus) && (a.ackCommitIndex === null || safe(a.ackCommitIndex));
}
function validReadback(r) {
  if (!record(r,READBACK) || r.schemaVersion !== 1 ||
      ![r.coordinatorId,r.txId,r.resourceId].every(validId) ||
      !positive(r.term) || r.consistency !== 'linearizable-asserted' ||
      !['HELD','RETIRING','VACANT','UNKNOWN'].includes(r.mode) ||
      ![r.revision,r.fencingEpoch,r.commitIndex,r.readAtMs].every(safe) ||
      !validSha(r.headDigest) || !record(r.transaction,TX)) return false;
  const t = r.transaction;
  if (!TX_STATUS.includes(t.status)) return false;
  if (t.status === 'COMMITTED') {
    return KINDS.includes(t.kind) && validSha(t.requestDigest) && positive(t.commitIndex) &&
      validSha(t.recordDigest) && safe(t.expectedRevision) && safe(t.expectedEpoch);
  }
  return t.kind === null && t.requestDigest === null && t.commitIndex === null &&
    t.recordDigest === null && t.expectedRevision === null && t.expectedEpoch === null;
}
function report(issues) {
  const distinct = [...new Set(issues)];
  return Object.freeze({
    decision: distinct.length ? 'HOLD' : 'STRUCTURE_REVIEWABLE',
    issues: Object.freeze(distinct),
    coordinatorAuthenticated:false, linearizabilityVerified:false,
    durableCommitVerified:false, transactionVerified:false,
    leaseGranted:false, retirementVerified:false, executionAuthorized:false,
    safeToRetry:false, requiresAuthoritativeRecoveryRead:true,
    requiresResourceSideFencing:true, requiresIndependentVerification:true
  });
}
/**
 * Review a fully synthetic response to a transaction lookup after a crash,
 * timeout or acknowledged write. It performs NO store I/O, CAS or retry.
 * Even a STRUCTURE_REVIEWABLE transcript does NOT confirm a committed CAS.
 */
export function reviewCoordinatorPersistenceBoundary(input) {
  if (!record(input,INPUT) || !validAttempt(input.attempt) ||
      !validReadback(input.readback) || !safe(input.nowMs) ||
      !positive(input.maxAgeMs) || input.maxAgeMs > 60_000)
    throw Error('Invalid synthetic coordinator persistence input');
  const {attempt:a,readback:r,nowMs,maxAgeMs} = input;
  const tx = r.transaction, issues = [];
  if (r.txId !== a.txId || r.resourceId !== a.resourceId)
    issues.push('PERSISTENCE_LOOKUP_SCOPE_MISMATCH');
  if (r.mode === 'UNKNOWN') issues.push('PERSISTENCE_COORDINATOR_STATE_UNKNOWN');
  if (r.readAtMs > nowMs || nowMs - r.readAtMs > maxAgeMs)
    issues.push('PERSISTENCE_READBACK_STALE');
  if (tx.status !== 'COMMITTED') {
    issues.push(tx.status === 'CONFLICT' ? 'PERSISTENCE_TRANSACTION_CONFLICT' :
      tx.status === 'NOT_SEEN' ? 'PERSISTENCE_NOT_SEEN_NOT_SAFE_TO_RETRY' :
      'PERSISTENCE_TRANSACTION_INDETERMINATE');
  }
  if ((a.ackStatus === 'ACK_APPLIED' && a.ackCommitIndex === null) ||
      (a.ackStatus !== 'ACK_APPLIED' && a.ackCommitIndex !== null))
    issues.push('PERSISTENCE_ACK_SHAPE_CONTRADICTION');
  if (a.ackStatus === 'ACK_CONFLICT' && tx.status === 'COMMITTED')
    issues.push('PERSISTENCE_ACK_TRANSACTION_CONTRADICTION');
  if (a.ackStatus === 'ACK_APPLIED' && tx.status !== 'COMMITTED')
    issues.push('PERSISTENCE_ACK_TRANSACTION_CONTRADICTION');
  if (a.ackCommitIndex !== null && tx.status === 'COMMITTED' &&
      a.ackCommitIndex !== tx.commitIndex)
    issues.push('PERSISTENCE_ACK_INDEX_MISMATCH');
  if (tx.status === 'COMMITTED') {
    if (tx.kind !== a.kind || tx.requestDigest !== a.requestDigest ||
        tx.expectedRevision !== a.expectedRevision ||
        tx.expectedEpoch !== a.expectedEpoch)
      issues.push('PERSISTENCE_TRANSACTION_ID_REUSED_OR_REBOUND');
    if (tx.commitIndex > r.commitIndex ||
        r.revision <= a.expectedRevision || r.fencingEpoch < a.expectedEpoch ||
        (a.kind === 'ACQUIRE' && r.fencingEpoch <= a.expectedEpoch))
      issues.push('PERSISTENCE_COMMIT_NOT_VISIBLE');
    if (tx.commitIndex === r.commitIndex && tx.recordDigest !== r.headDigest)
      issues.push('PERSISTENCE_HEAD_DIGEST_MISMATCH');
    if (a.ackCommitIndex !== null && a.ackCommitIndex > r.commitIndex)
      issues.push('PERSISTENCE_ACK_AHEAD_OF_READBACK');
  }
  // Caller-controlled coordinator ID, leader term, read consistency, receipt
  // digests, and timestamps are never treated as authenticated or durable.
  return report(issues);
}
