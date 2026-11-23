// API1 Phase 3 P3-C: pure, synthetic effect-side fencing review.
// NO browser, transport, process, filesystem, network, clocks, secrets or writes.
// Caller-supplied snapshots, sink state and dedupe ledger are NOT authenticated.
// STRUCTURE_REVIEWABLE is NEVER permission to deliver or open a session.
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MAX = Number.MAX_SAFE_INTEGER;
const id = value => typeof value === 'string' && ID.test(value);
const digest = value => typeof value === 'string' && DIGEST.test(value);
const num = value => Number.isSafeInteger(value) && value >= 0 && value < MAX;
const positive = value => num(value) && value > 0;

// Only detached, plain JSON-style own data records are in scope. No accessors,
// exotic prototypes, symbols or additional fields. Proxy input must be rejected
// at the future transport parse boundary, not by this side-effect-free model.
function record(value, fields) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const names = Reflect.ownKeys(descriptors);
    return names.length === fields.length &&
      fields.every(key => Object.hasOwn(descriptors, key)) &&
      names.every(key => typeof key === 'string' && fields.includes(key) &&
        Object.hasOwn(descriptors[key], 'value') && descriptors[key].enumerable);
  } catch { return false; }
}
const INPUT = ['snapshot', 'sink', 'delivery', 'dedupe', 'nowMs', 'maxAgeMs'];
const SNAPSHOT = ['schemaVersion','resourceId','revision','term','commitIndex',
  'fencingEpoch','mode','holder','headDigest','readAtMs'];
const OWNER = ['ownerId','generationId','leaseId','fencingEpoch','expiresAtMs'];
const SINK = ['schemaVersion','resourceId','state','fencingEpoch','revision',
  'commitIndex','persistedFenceFloor','persistedRevisionFloor',
  'persistedCommitFloor','ownerId','generationId','leaseId',
  'checkpointDigest','readAtMs'];
const DELIVERY = ['schemaVersion','resourceId','ownerId','generationId','leaseId',
  'fencingEpoch','coordinatorRevision','commitIndex','sessionId','requestId',
  'kind','requestDigest'];
const DEDUPE = ['schemaVersion','resourceId','requestId','requestDigest',
  'fencingEpoch','state','journalRevision','journalDigest','observedAtMs'];

const validOwner = x => record(x, OWNER) &&
  [x.ownerId,x.generationId,x.leaseId].every(id) &&
  positive(x.fencingEpoch) && positive(x.expiresAtMs);
function validSnapshot(x) {
  return record(x, SNAPSHOT) && x.schemaVersion === 1 && id(x.resourceId) &&
    num(x.revision) && positive(x.term) && num(x.commitIndex) &&
    positive(x.fencingEpoch) && digest(x.headDigest) && num(x.readAtMs) &&
    ['HELD','RETIRING','VACANT','UNKNOWN'].includes(x.mode) &&
    (x.holder === null || validOwner(x.holder)) &&
    (x.mode !== 'HELD' || x.holder !== null) &&
    (x.mode !== 'VACANT' || x.holder === null);
}
function validSink(x) {
  return record(x, SINK) && x.schemaVersion === 1 && id(x.resourceId) &&
    ['ACTIVE','FENCED','UNKNOWN'].includes(x.state) &&
    positive(x.fencingEpoch) && num(x.revision) && num(x.commitIndex) &&
    positive(x.persistedFenceFloor) && num(x.persistedRevisionFloor) &&
    num(x.persistedCommitFloor) &&
    [x.ownerId,x.generationId,x.leaseId].every(v => v === null || id(v)) &&
    digest(x.checkpointDigest) && num(x.readAtMs);
}
function validDelivery(x) {
  return record(x, DELIVERY) && x.schemaVersion === 1 &&
    [x.resourceId,x.ownerId,x.generationId,x.leaseId,
      x.sessionId,x.requestId].every(id) && positive(x.fencingEpoch) &&
    num(x.coordinatorRevision) && num(x.commitIndex) &&
    ['OPEN_SESSION','DELIVER','COMPLETE'].includes(x.kind) && digest(x.requestDigest);
}
function validDedupe(x) {
  return record(x, DEDUPE) && x.schemaVersion === 1 &&
    [x.resourceId,x.requestId].every(id) && digest(x.requestDigest) &&
    positive(x.fencingEpoch) && ['FRESH','SEEN','UNKNOWN'].includes(x.state) &&
    num(x.journalRevision) && digest(x.journalDigest) && num(x.observedAtMs);
}
function result(issues) {
  const distinct = [...new Set(issues)];
  return Object.freeze({
    decision: distinct.length ? 'HOLD' : 'STRUCTURE_REVIEWABLE',
    issues: Object.freeze(distinct),
    effectAuthorized:false, sessionAuthorized:false, deliveryAuthorized:false,
    fenceEnforced:false, leaseVerified:false, deduplicationVerified:false,
    coordinatorAuthenticated:false, executionAuthorized:false,
    requiresResourceSideAtomicFencing:true, requiresDurableDeduplication:true,
    requiresTrustedDurableHighWatermark:true,
    requiresTrustedCoordinatorAndClock:true, requiresIndependentVerification:true
  });
}
/**
 * Checks whether an asserted effect and sink fence have coherent structural
 * metadata. It never permits an actual browser action, forwarding, delivery,
 * acknowledgement, retry, or response; even ideal-looking metadata is untrusted.
 */
export function reviewEffectFenceBoundary(input) {
  if (!record(input,INPUT) || !validSnapshot(input.snapshot) ||
      !validSink(input.sink) || !validDelivery(input.delivery) ||
      !validDedupe(input.dedupe) || !num(input.nowMs) ||
      !positive(input.maxAgeMs) || input.maxAgeMs > 60_000)
    throw Error('Invalid synthetic effect fence input');
  const {snapshot:s,sink:k,delivery:d,dedupe:q,nowMs,maxAgeMs} = input;
  const issues = [];
  if ([k.resourceId,d.resourceId,q.resourceId].some(x => x !== s.resourceId))
    issues.push('EFFECT_RESOURCE_MISMATCH');
  if (s.mode !== 'HELD') issues.push('EFFECT_OWNER_NOT_HELD');
  if (k.state !== 'ACTIVE') issues.push('EFFECT_SINK_NOT_ACTIVE');
  for (const t of [s.readAtMs,k.readAtMs,q.observedAtMs]) {
    if (t > nowMs || nowMs-t > maxAgeMs) {
      issues.push('EFFECT_EVIDENCE_STALE_OR_FUTURE');
      break;
    }
  }
  if (k.fencingEpoch < s.fencingEpoch)
    issues.push('EFFECT_FENCE_NOT_INSTALLED');
  if (k.fencingEpoch > s.fencingEpoch)
    issues.push('EFFECT_SNAPSHOT_BEHIND_SINK');
  if (k.fencingEpoch < k.persistedFenceFloor ||
      k.revision < k.persistedRevisionFloor ||
      k.commitIndex < k.persistedCommitFloor ||
      s.fencingEpoch < k.persistedFenceFloor ||
      s.revision < k.persistedRevisionFloor ||
      s.commitIndex < k.persistedCommitFloor)
    issues.push('EFFECT_DURABLE_HIGH_WATERMARK_ROLLBACK');
  if (d.fencingEpoch < s.fencingEpoch)
    issues.push('EFFECT_STALE_DELIVERY_EPOCH');
  if (d.fencingEpoch > s.fencingEpoch)
    issues.push('EFFECT_FUTURE_DELIVERY_EPOCH');
  if (q.fencingEpoch !== d.fencingEpoch)
    issues.push('EFFECT_DEDUPE_EPOCH_MISMATCH');
  if (d.coordinatorRevision !== s.revision ||
      d.commitIndex !== s.commitIndex ||
      k.revision !== s.revision || k.commitIndex !== s.commitIndex)
    issues.push('EFFECT_REVISION_OR_COMMIT_MISMATCH');
  if (s.holder) {
    if (s.holder.fencingEpoch !== s.fencingEpoch)
      issues.push('EFFECT_OWNER_FENCING_CONFLICT');
    if (s.holder.expiresAtMs <= nowMs)
      issues.push('EFFECT_LEASE_EXPIRED_OR_UNKNOWN');
    for (const field of ['ownerId','generationId','leaseId']) {
      if (k[field] !== s.holder[field] || d[field] !== s.holder[field]) {
        issues.push('EFFECT_OWNER_IDENTITY_MISMATCH');
        break;
      }
    }
  } else {
    issues.push('EFFECT_OWNER_ABSENT');
  }
  if (q.requestId !== d.requestId || q.requestDigest !== d.requestDigest)
    issues.push('EFFECT_DEDUPE_KEY_MISMATCH');
  if (q.journalRevision !== s.revision)
    issues.push('EFFECT_DEDUPE_LEDGER_REVISION_MISMATCH');
  if (k.checkpointDigest !== s.headDigest)
    issues.push('EFFECT_SINK_HEAD_DIGEST_MISMATCH');
  if (q.state !== 'FRESH')
    issues.push(q.state === 'SEEN' ? 'EFFECT_DUPLICATE_REQUEST' : 'EFFECT_DEDUPE_UNKNOWN');
  // The proof-looking digests, freshness timestamps and FRESH ledger state
  // are caller assertions. Nothing is granted, even on STRUCTURE_REVIEWABLE.
  return result(issues);
}
