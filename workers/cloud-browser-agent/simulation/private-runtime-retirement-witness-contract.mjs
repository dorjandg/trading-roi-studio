// API1 P3-A NEXT: PURE structural review for a future trusted retirement witness.
// Never opens pidfds, reads /proc, verifies cryptographic signatures, accesses
// secrets, or accepts caller-controlled metadata as proof that a process exited.
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const HEX = /^[a-f0-9]{64}$/;
const TICKS = /^[1-9][0-9]{0,19}$/;
const MAX = Number.MAX_SAFE_INTEGER;
const id = x => typeof x==='string' && ID.test(x);
const hex = x => typeof x==='string' && HEX.test(x);
const num = x => Number.isSafeInteger(x) && x>=0 && x<MAX;
const positive = x => num(x) && x>0;
function shape(x, keys) {
  if(x===null || typeof x!=='object' || Array.isArray(x)) return false;
  try {
    const proto=Object.getPrototypeOf(x);
    if(proto!==Object.prototype && proto!==null) return false;
    const ds=Object.getOwnPropertyDescriptors(x),names=Reflect.ownKeys(ds);
    return names.length===keys.length && keys.every(k=>Object.hasOwn(ds,k)) &&
      names.every(k=>typeof k==='string' && keys.includes(k) &&
        Object.hasOwn(ds[k],'value') && ds[k].enumerable);
  } catch { return false; }
}
const INPUT=['owner','challenge','report','spentNonces','nowMs','maxAgeMs'];
const OWNER=['resourceId','ownerId','hostId','bootId','pid','startTicks','executableFingerprint','generationId','leaseId','fencingEpoch'];
const CHALLENGE=['schemaVersion','nonce','resourceId','ownerId','generationId','leaseId','fencingEpoch','coordinatorRevision','journalDigest','issuedAtMs','expiresAtMs'];
const REPORT=['schemaVersion','monitorId','keyId','signatureAlgorithm','signatureDigest','challengeNonce','coordinatorRevision','journalDigest','resourceId','ownerId','hostId','bootId','pid','startTicks','executableFingerprint','generationId','leaseId','fencingEpoch','method','descriptorBinding','status','exitObservedAtMs','signedAtMs','exitEvidenceDigest'];
const scoped=['resourceId','ownerId','generationId','leaseId','fencingEpoch'];
// Never iterate an attacker-supplied array before verifying that it is dense,
// ordinary, and has value-only properties. Accessor indices can run code.
function denseHexList(x) {
  if(!Array.isArray(x))return false;
  try{
    if(Object.getPrototypeOf(x)!==Array.prototype || x.length>256)return false;
    const ds=Object.getOwnPropertyDescriptors(x);
    if(Reflect.ownKeys(ds).length!==x.length+1)return false;
    for(let i=0;i<x.length;i++){
      const d=ds[String(i)];
      if(!d || !Object.hasOwn(d,'value') || !d.enumerable || !hex(d.value))return false;
    }
    return true;
  }catch{return false;}
}
function validOwner(x) {
  return shape(x,OWNER) && [x.resourceId,x.ownerId,x.hostId,x.bootId,x.executableFingerprint,
    x.generationId,x.leaseId].every(id) && num(x.pid) && x.pid>0 && x.pid<=2147483647 &&
    typeof x.startTicks==='string' && TICKS.test(x.startTicks) && positive(x.fencingEpoch);
}
function validChallenge(x) {
  return shape(x,CHALLENGE) && x.schemaVersion===1 && hex(x.nonce) &&
    [x.resourceId,x.ownerId,x.generationId,x.leaseId].every(id) &&
    positive(x.fencingEpoch) && num(x.coordinatorRevision) && hex(x.journalDigest) &&
    num(x.issuedAtMs) && num(x.expiresAtMs);
}
function validReport(x) {
  return shape(x,REPORT) && x.schemaVersion===1 &&
    [x.monitorId,x.keyId,x.resourceId,x.ownerId,x.hostId,x.bootId,x.executableFingerprint,
      x.generationId,x.leaseId].every(id) &&
    [x.signatureDigest,x.challengeNonce,x.journalDigest,x.exitEvidenceDigest].every(hex) &&
    x.signatureAlgorithm==='Ed25519' && num(x.coordinatorRevision) &&
    num(x.pid) && x.pid>0 && x.pid<=2147483647 &&
    typeof x.startTicks==='string' && TICKS.test(x.startTicks) &&
    positive(x.fencingEpoch) && ['pidfd-waitid','supervisor-wait'].includes(x.method) &&
    x.descriptorBinding==='pre-opened-generation-bound' && x.status==='EXIT_OBSERVED' &&
    num(x.exitObservedAtMs) && num(x.signedAtMs);
}
function outcome(issues) {
  return Object.freeze({
    decision:issues.length?'HOLD':'STRUCTURE_REVIEWABLE',
    issues:Object.freeze([...new Set(issues)]),
    signatureVerified:false, observerAuthenticated:false, exitVerified:false,
    replayLedgerTrusted:false, executionAuthorized:false, retirementAuthorized:false,
    requiresIndependentAttestationVerification:true, requiresCoordinatorReplayCAS:true
  });
}
/** Metadata, challenge, and witness are all UNTRUSTED assertions. This is NOT
 * a cryptographic verifier. Only a future independent verifier with a protected
 * trust root, durable nonce ledger, and supervised descriptor can establish exit.
 */
export function reviewRetirementWitnessEnvelope(input) {
  if(!shape(input,INPUT)) throw Error('Invalid synthetic witness envelope');
  const {owner,challenge,report,spentNonces,nowMs,maxAgeMs}=input;
  if(!validOwner(owner)||!validChallenge(challenge)||!validReport(report)||
     !denseHexList(spentNonces)||
     !num(nowMs)||!positive(maxAgeMs)||maxAgeMs>60_000)
    throw Error('Invalid synthetic witness envelope');
  const issues=[];
  for(const k of scoped) {
    if(owner[k]!==challenge[k] || owner[k]!==report[k]) {
      issues.push('WITNESS_OWNER_SCOPE_MISMATCH'); break;
    }
  }
  for(const k of OWNER) {
    if(report[k]!==owner[k]) {issues.push('WITNESS_PROCESS_IDENTITY_MISMATCH');break;}
  }
  if(report.challengeNonce!==challenge.nonce ||
     report.coordinatorRevision!==challenge.coordinatorRevision ||
     report.journalDigest!==challenge.journalDigest)
    issues.push('WITNESS_CHALLENGE_BINDING_MISMATCH');
  if(report.monitorId===owner.ownerId || report.monitorId===owner.leaseId)
    issues.push('WITNESS_NOT_INDEPENDENT');
  if(spentNonces.includes(challenge.nonce) ||
     new Set(spentNonces).size!==spentNonces.length)
    issues.push('WITNESS_NONCE_REPLAY_OR_AMBIGUOUS_LEDGER');
  if(challenge.issuedAtMs>=challenge.expiresAtMs ||
     challenge.expiresAtMs-challenge.issuedAtMs>maxAgeMs ||
     nowMs>challenge.expiresAtMs || nowMs<challenge.issuedAtMs)
    issues.push('WITNESS_CHALLENGE_EXPIRED_OR_INVALID');
  if(report.exitObservedAtMs<challenge.issuedAtMs ||
     report.signedAtMs<report.exitObservedAtMs ||
     report.signedAtMs>nowMs || report.signedAtMs>challenge.expiresAtMs ||
     nowMs-report.signedAtMs>maxAgeMs)
    issues.push('WITNESS_EVENT_STALE_OR_UNORDERED');
  return outcome(issues);
}
