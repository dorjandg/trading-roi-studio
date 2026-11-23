// API1 P3-D: pure reconciliation of a synthetic uncertain effect outcome.
// No outbox, inbox, dedupe store, external side effect, filesystem or network.
// Claims of COMMITTED, durability, receipt or clock are NEVER authenticated.
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const HEX=/^[a-f0-9]{64}$/;
const MAX=Number.MAX_SAFE_INTEGER;
const id=x=>typeof x==='string'&&ID.test(x);
const hex=x=>typeof x==='string'&&HEX.test(x);
const n=x=>Number.isSafeInteger(x)&&x>=0&&x<MAX;
const positive=x=>n(x)&&x>0;
function record(x,fields){
  if(x===null||typeof x!=='object'||Array.isArray(x))return false;
  try{
    const p=Object.getPrototypeOf(x);
    if(p!==Object.prototype&&p!==null)return false;
    const ds=Object.getOwnPropertyDescriptors(x),keys=Reflect.ownKeys(ds);
    return keys.length===fields.length&&fields.every(k=>Object.hasOwn(ds,k))&&
      keys.every(k=>typeof k==='string'&&fields.includes(k)&&
        Object.hasOwn(ds[k],'value')&&ds[k].enumerable);
  }catch{return false;}
}
const INPUT=['snapshot','outbox','ledger','receipt','nowMs','maxAgeMs'];
const SNAPSHOT=['schemaVersion','resourceId','revision','commitIndex','epoch',
  'mode','ownerId','generationId','leaseId','leaseExpiresAtMs','headDigest','readAtMs'];
const OUTBOX=['schemaVersion','resourceId','ownerId','generationId','leaseId',
  'epoch','coordinatorRevision','commitIndex','coordinatorHeadDigest','requestId','requestDigest',
  'canonicalKeyDigest','dispatchId','phase','sequence','intentDigest',
  'fileSyncedClaim','directorySyncedClaim','createdAtMs'];
const LEDGER=['schemaVersion','resourceId','ownerId','generationId','leaseId',
  'epoch','requestId','requestDigest','canonicalKeyDigest','dispatchId',
  'state','sequence','persistedSequenceFloor','persistedEpochFloor',
  'outboxIntentDigest',
  'outcomeDigest','recordDigest','readAtMs'];
const RECEIPT=['schemaVersion','resourceId','ownerId','generationId','leaseId',
  'epoch','requestId','requestDigest','canonicalKeyDigest','dispatchId',
  'state','ledgerSequence','outcomeDigest','recordDigest','observedAtMs'];
function validSnapshot(x){
  return record(x,SNAPSHOT)&&x.schemaVersion===1&&
    [x.resourceId,x.ownerId,x.generationId,x.leaseId].every(id)&&
    n(x.revision)&&n(x.commitIndex)&&positive(x.epoch)&&
    ['HELD','RETIRING','VACANT','UNKNOWN'].includes(x.mode)&&
    positive(x.leaseExpiresAtMs)&&hex(x.headDigest)&&n(x.readAtMs);
}
function validOutbox(x){
  return record(x,OUTBOX)&&x.schemaVersion===1&&
    [x.resourceId,x.ownerId,x.generationId,x.leaseId,x.requestId,x.dispatchId].every(id)&&
    positive(x.epoch)&&n(x.coordinatorRevision)&&n(x.commitIndex)&&hex(x.coordinatorHeadDigest)&&
    [x.requestDigest,x.canonicalKeyDigest,x.intentDigest].every(hex)&&
    ['PREPARED','DISPATCHING','ACK_UNKNOWN','ACKED','UNKNOWN'].includes(x.phase)&&
    positive(x.sequence)&&typeof x.fileSyncedClaim==='boolean'&&
    typeof x.directorySyncedClaim==='boolean'&&n(x.createdAtMs);
}
function validLedger(x){
  return record(x,LEDGER)&&x.schemaVersion===1&&
    [x.resourceId,x.ownerId,x.generationId,x.leaseId,x.requestId,x.dispatchId].every(id)&&
    positive(x.epoch)&&positive(x.sequence)&&n(x.persistedSequenceFloor)&&
    positive(x.persistedEpochFloor)&&
    ['COMMITTED','PENDING','UNKNOWN','NOT_FOUND'].includes(x.state)&&
    [x.requestDigest,x.canonicalKeyDigest,x.outcomeDigest,x.recordDigest,
      x.outboxIntentDigest].every(hex)&&
    n(x.readAtMs);
}
function validReceipt(x){
  return record(x,RECEIPT)&&x.schemaVersion===1&&
    [x.resourceId,x.ownerId,x.generationId,x.leaseId,x.requestId,x.dispatchId].every(id)&&
    positive(x.epoch)&&
    ['COMMITTED','NOT_FOUND','FAILED','UNKNOWN'].includes(x.state)&&
    positive(x.ledgerSequence)&&
    [x.requestDigest,x.canonicalKeyDigest,x.outcomeDigest,x.recordDigest].every(hex)&&
    n(x.observedAtMs);
}
function result(issues){
  const unique=Object.freeze([...new Set(issues)]);
  return Object.freeze({decision:unique.length?'HOLD':'STRUCTURE_REVIEWABLE',issues:unique,
    outcomeVerified:false,durabilityVerified:false,dedupeVerified:false,
    reconciliationComplete:false,exactlyOnceGuaranteed:false,
    safeToRetry:false,retryAuthorized:false,deliveryAuthorized:false,
    acknowledgementAuthorized:false,executionAuthorized:false,
    requiresAtomicEffectAndLedger:true,requiresAuthenticatedSinkReceipt:true,
    requiresDurableOutbox:true,requiresTrustedCoordinatorEpoch:true,
    requiresOperatorReviewForUnknownOutcomes:true});
}
/**
 * A claimed COMMITTED inbox/receipt after an ACK_UNKNOWN dispatch is only
 * structurally consistent. Real effect results may be unknown forever;
 * exactly-once is not promised and retry is NEVER suggested.
 */
export function reviewEffectSettlementReconciliation(input){
  if(!record(input,INPUT)||!validSnapshot(input.snapshot)||
    !validOutbox(input.outbox)||!validLedger(input.ledger)||
    !validReceipt(input.receipt)||!n(input.nowMs)||
    !positive(input.maxAgeMs)||input.maxAgeMs>60_000)
    throw Error('Invalid synthetic effect settlement input');
  const {snapshot:s,outbox:o,ledger:l,receipt:r,nowMs,maxAgeMs}=input;
  const issues=[];
  if(s.mode!=='HELD')issues.push('SETTLEMENT_COORDINATOR_NOT_HELD');
  if(s.leaseExpiresAtMs<=nowMs)issues.push('SETTLEMENT_LEASE_EXPIRED_OR_UNKNOWN');
  for(const row of [o,l,r]){
    if(row.resourceId!==s.resourceId)issues.push('SETTLEMENT_RESOURCE_REBOUND');
    if(row.ownerId!==s.ownerId||row.generationId!==s.generationId||
       row.leaseId!==s.leaseId)issues.push('SETTLEMENT_OWNER_REBOUND');
    if(row.epoch!==s.epoch)issues.push('SETTLEMENT_FENCING_EPOCH_MISMATCH');
    if(row.requestId!==o.requestId||row.requestDigest!==o.requestDigest||
       row.canonicalKeyDigest!==o.canonicalKeyDigest||row.dispatchId!==o.dispatchId)
      issues.push('SETTLEMENT_REQUEST_REPLAY_OR_REBIND');
  }
  if(o.coordinatorRevision!==s.revision||o.commitIndex!==s.commitIndex||
     o.coordinatorHeadDigest!==s.headDigest)
    issues.push('SETTLEMENT_COORDINATOR_HISTORY_MISMATCH');
  if(o.phase!=='ACK_UNKNOWN')issues.push('SETTLEMENT_NOT_AN_UNCERTAIN_ACK');
  if(!o.fileSyncedClaim||!o.directorySyncedClaim)
    issues.push('SETTLEMENT_OUTBOX_DURABILITY_UNCONFIRMED');
  if(l.state!=='COMMITTED'||r.state!=='COMMITTED')
    issues.push('SETTLEMENT_COMMIT_UNRESOLVED');
  if(l.sequence!==o.sequence+1||r.ledgerSequence!==l.sequence||
     l.outboxIntentDigest!==o.intentDigest)
    issues.push('SETTLEMENT_LEDGER_CHAIN_MISMATCH');
  if(l.sequence<l.persistedSequenceFloor||l.epoch<l.persistedEpochFloor)
    issues.push('SETTLEMENT_LEDGER_HIGH_WATER_ROLLBACK');
  if(r.outcomeDigest!==l.outcomeDigest||r.recordDigest!==l.recordDigest||
     r.outcomeDigest===o.requestDigest)
    issues.push('SETTLEMENT_RECEIPT_DIGEST_CONFLICT');
  if(o.createdAtMs>l.readAtMs||o.createdAtMs>r.observedAtMs)
    issues.push('SETTLEMENT_RECEIPT_PRECEDES_DISPATCH');
  for(const t of [s.readAtMs,o.createdAtMs,l.readAtMs,r.observedAtMs]){
    if(t>nowMs||nowMs-t>maxAgeMs){issues.push('SETTLEMENT_EVIDENCE_STALE');break;}
  }
  // These are untrusted text records. No delivery, retry, downstream ack,
  // process interaction or permission is ever issued from this function.
  return result(issues);
}
