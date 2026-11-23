// API1 P3-A NEXT: PURE structural review of a SYNTHETIC retirement record.
// Never reads the filesystem, verifies signatures, grants a lease, starts/stops
// a process, or treats caller claims about fsync / kernel exit as actual proof.
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const HEX=/^[a-f0-9]{64}$/;
const TICKS=/^[1-9][0-9]{0,19}$/;
const record=(x,required,allowed=required)=>{
  if(x===null||typeof x!=='object'||Array.isArray(x))return false;
  try{
    const p=Object.getPrototypeOf(x);
    if(p!==Object.prototype&&p!==null)return false;
    const ds=Object.getOwnPropertyDescriptors(x),ks=Reflect.ownKeys(ds);
    return required.every(k=>Object.hasOwn(ds,k))&&
      ks.every(k=>typeof k==='string'&&allowed.includes(k)&&
        Object.hasOwn(ds[k],'value')&&ds[k].enumerable);
  }catch{return false;}
};
const id=x=>typeof x==='string'&&ID.test(x);
const epoch=x=>Number.isSafeInteger(x)&&x>0&&x<Number.MAX_SAFE_INTEGER;
const seq=x=>Number.isSafeInteger(x)&&x>=0&&x<Number.MAX_SAFE_INTEGER;
const ms=x=>Number.isSafeInteger(x)&&x>=0;
const result=(issues)=>Object.freeze({
  decision:issues.length?'HOLD':'STRUCTURE_REVIEWABLE',
  issues:Object.freeze([...new Set(issues)]),
  retirementVerified:false,attestationVerified:false,executionAuthorized:false,
  requiresIndependentVerification:true,requiresDurableCoordinatorCAS:true
});

/**
 * The reported ordering, durability and signature metadata are UNTRUSTED
 * assertions. STRUCTURE_REVIEWABLE means only that they are well-formed and
 * mutually consistent. No caller can use this result to advance startup.
 */
export function reviewRetirementEvidence({expected,receipt,nowMs,maxAgeMs=30_000}={}){
  const expectedKeys=['resourceId','ownerId','hostId','generationId','leaseId',
    'bootId','pid','startTicks','executableFingerprint','fencingEpoch',
    'lastJournalSequence','lastJournalDigest'];
  const receiptKeys=['schemaVersion','resourceId','ownerId','hostId',
    'generationId','leaseId','bootId','pid','startTicks',
    'executableFingerprint','fencingEpoch','journalSequence',
    'previousDigest','recordDigest','phase','checkpoint','witness'];
  const checkpointKeys=['intentSynced','routingFenced','requestsDrained',
    'exitObserved','commitSynced','directorySynced','coordinatorReleaseCAS',
    'intentOrder','fenceOrder','drainOrder','exitOrder','commitOrder','directoryOrder','casOrder'];
  const witnessKeys=['monitorId','method','generationId','leaseId',
    'fencingEpoch','observedAtMs','attestationDigest'];
  if(!record(expected,expectedKeys)||!record(receipt,receiptKeys)||
    !record(receipt.checkpoint,checkpointKeys)||
    !record(receipt.witness,witnessKeys)||
    ![expected.resourceId,expected.ownerId,expected.hostId,expected.generationId,
      expected.leaseId,expected.bootId,expected.executableFingerprint,
      receipt.resourceId,receipt.ownerId,receipt.hostId,receipt.generationId,
      receipt.leaseId,receipt.bootId,receipt.executableFingerprint,
      receipt.witness.monitorId,receipt.witness.generationId,
      receipt.witness.leaseId].every(id)||
    ![expected.startTicks,receipt.startTicks].every(x=>typeof x==='string'&&TICKS.test(x))||
    ![expected.pid,receipt.pid].every(x=>Number.isSafeInteger(x)&&x>0&&x<=2147483647)||
    !epoch(expected.fencingEpoch)||!epoch(receipt.fencingEpoch)||
    !epoch(receipt.witness.fencingEpoch)||!seq(expected.lastJournalSequence)||
    !seq(receipt.journalSequence)||
    ![expected.lastJournalDigest,receipt.previousDigest,
      receipt.recordDigest,receipt.witness.attestationDigest].every(x=>typeof x==='string'&&HEX.test(x))||
    receipt.schemaVersion!==1||!['PREPARED','COMMITTED'].includes(receipt.phase)||
    !['pidfd-exit','supervisor-wait'].includes(receipt.witness.method)||
    !ms(nowMs)||!ms(receipt.witness.observedAtMs)||
    !Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>60_000||
    !['intentSynced','routingFenced','requestsDrained','exitObserved',
      'commitSynced','directorySynced','coordinatorReleaseCAS']
      .every(k=>typeof receipt.checkpoint[k]==='boolean')||
    !['intentOrder','fenceOrder','drainOrder','exitOrder','commitOrder','directoryOrder','casOrder']
      .every(k=>seq(receipt.checkpoint[k])))
    throw Error('Invalid synthetic retirement evidence input');

  const issues=[];
  const identityKeys=['resourceId','ownerId','hostId','generationId',
    'leaseId','bootId','pid','startTicks','executableFingerprint'];
  if(identityKeys.some(k=>receipt[k]!==expected[k]))issues.push('RETIREMENT_OWNER_IDENTITY_MISMATCH');
  if(receipt.fencingEpoch!==expected.fencingEpoch)issues.push('RETIREMENT_EPOCH_MISMATCH');
  if(receipt.journalSequence!==expected.lastJournalSequence+1||
     receipt.previousDigest!==expected.lastJournalDigest||
     receipt.recordDigest===receipt.previousDigest)
    issues.push('RETIREMENT_CHAIN_NOT_ADVANCING');
  if(receipt.phase!=='COMMITTED')issues.push('RETIREMENT_NOT_COMMITTED');
  if(receipt.witness.monitorId===receipt.ownerId)
    issues.push('RETIREMENT_WITNESS_NOT_INDEPENDENT');
  if(receipt.witness.generationId!==receipt.generationId||
     receipt.witness.leaseId!==receipt.leaseId||
     receipt.witness.fencingEpoch!==receipt.fencingEpoch)
    issues.push('RETIREMENT_WITNESS_SCOPE_MISMATCH');
  const c=receipt.checkpoint;
  if(![c.intentSynced,c.routingFenced,c.requestsDrained,c.exitObserved,
        c.commitSynced,c.directorySynced,c.coordinatorReleaseCAS].every(Boolean))
    issues.push('RETIREMENT_DURABILITY_OR_EXIT_UNCONFIRMED');
  if(!(c.intentOrder<c.fenceOrder&&c.fenceOrder<c.drainOrder&&
       c.drainOrder<c.exitOrder&&c.exitOrder<c.commitOrder&&
       c.commitOrder<c.directoryOrder&&c.directoryOrder<c.casOrder))
    issues.push('RETIREMENT_ORDER_INVALID');
  if(receipt.witness.observedAtMs>nowMs||
     nowMs-receipt.witness.observedAtMs>maxAgeMs)
    issues.push('RETIREMENT_WITNESS_STALE');
  return result(issues);
}
