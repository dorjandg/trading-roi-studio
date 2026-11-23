// API1 Phase 3: synthetic trust-policy and nonce-CAS planning boundary.
// No crypto imports, private keys, pidfds, coordinator calls, or writes.
// Caller-supplied trust roots and nonce states are UNAUTHENTICATED claims.
import {reviewRetirementWitnessEnvelope} from './private-runtime-retirement-witness-contract.mjs';

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
    const ds = Object.getOwnPropertyDescriptors(x), names = Reflect.ownKeys(ds);
    return names.length === keys.length && keys.every(k => Object.hasOwn(ds,k)) &&
      names.every(k => typeof k === 'string' && keys.includes(k) &&
        Object.hasOwn(ds[k],'value') && ds[k].enumerable);
  } catch { return false; }
}
const INPUT = ['envelope','trustPolicy','nonceRecord'];
const POLICY = ['schemaVersion','resourceId','monitorId','keyId','algorithm',
  'status','validFromMs','validUntilMs','policyRevision','trustAnchorDigest'];
const NONCE = ['schemaVersion','nonce','resourceId','generationId','leaseId',
  'fencingEpoch','coordinatorRevision','state','observedAtMs','journalDigest'];
function validPolicy(p) {
  return record(p,POLICY) && p.schemaVersion === 1 &&
    [p.resourceId,p.monitorId,p.keyId].every(validId) && p.algorithm === 'Ed25519' &&
    ['ACTIVE','REVOKED','UNKNOWN'].includes(p.status) &&
    [p.validFromMs,p.validUntilMs].every(safe) && positive(p.policyRevision) &&
    validSha(p.trustAnchorDigest);
}
function validNonce(n) {
  return record(n,NONCE) && n.schemaVersion === 1 && validSha(n.nonce) &&
    [n.resourceId,n.generationId,n.leaseId].every(validId) &&
    positive(n.fencingEpoch) && safe(n.coordinatorRevision) &&
    ['AVAILABLE','SPENT','UNKNOWN'].includes(n.state) && safe(n.observedAtMs) &&
    validSha(n.journalDigest);
}
function report(issues) {
  const distinct = [...new Set(issues)];
  return Object.freeze({
    decision: distinct.length ? 'HOLD' : 'VERIFICATION_PENDING',
    issues: Object.freeze(distinct),
    trustRootAuthenticated:false, signatureVerified:false,
    processDescriptorVerified:false, monitorAuthenticated:false,
    nonceConsumed:false, nonceLedgerTrusted:false, exitVerified:false,
    retirementAuthorized:false, executionAuthorized:false,
    requiresTrustedCryptoVerifier:true, requiresKernelDescriptorProvenance:true,
    requiresDurableCoordinatorNonceCAS:true, requiresIndependentVerification:true
  });
}
/**
 * Plan the checks at a future independent verifier boundary. Does not verify
 * signed bytes, consume a nonce, or establish an actual kernel exit event.
 */
export function reviewWitnessVerifierBoundary(input) {
  if (!record(input,INPUT) || !validPolicy(input.trustPolicy) ||
      !validNonce(input.nonceRecord))
    throw Error('Invalid synthetic witness verification boundary');
  let envelopeResult;
  try {
    envelopeResult = reviewRetirementWitnessEnvelope(input.envelope);
  } catch {
    throw Error('Invalid synthetic witness verification boundary');
  }
  const {envelope:e,trustPolicy:p,nonceRecord:n} = input;
  const {owner,challenge,report:w,nowMs,maxAgeMs} = e;
  const issues = [...envelopeResult.issues];
  if (p.resourceId !== owner.resourceId || p.monitorId !== w.monitorId ||
      p.keyId !== w.keyId || p.algorithm !== w.signatureAlgorithm)
    issues.push('WITNESS_POLICY_SCOPE_MISMATCH');
  if (p.status !== 'ACTIVE') issues.push('WITNESS_TRUST_KEY_NOT_ACTIVE');
  if (p.validFromMs >= p.validUntilMs ||
      w.signedAtMs < p.validFromMs || w.signedAtMs > p.validUntilMs ||
      nowMs < p.validFromMs || nowMs > p.validUntilMs)
    issues.push('WITNESS_TRUST_KEY_OUT_OF_WINDOW');
  if (n.nonce !== challenge.nonce || n.resourceId !== owner.resourceId ||
      n.generationId !== owner.generationId || n.leaseId !== owner.leaseId ||
      n.fencingEpoch !== owner.fencingEpoch ||
      n.coordinatorRevision !== challenge.coordinatorRevision ||
      n.journalDigest !== challenge.journalDigest)
    issues.push('WITNESS_NONCE_LEDGER_SCOPE_MISMATCH');
  if (n.state !== 'AVAILABLE')
    issues.push(n.state === 'SPENT' ? 'WITNESS_NONCE_ALREADY_CONSUMED' :
      'WITNESS_NONCE_LEDGER_UNKNOWN');
  if (n.observedAtMs > nowMs || nowMs - n.observedAtMs > maxAgeMs)
    issues.push('WITNESS_NONCE_LEDGER_STALE');
  // Even ideal-looking metadata never constitutes a validated signature,
  // authentic policy, coordinator nonce CAS, or a process-exit witness.
  return report(issues);
}
