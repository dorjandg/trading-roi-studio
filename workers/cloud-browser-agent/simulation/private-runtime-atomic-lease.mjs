// API1 P3-A NEXT: PURE, SYNTHETIC compare-and-swap lease proposal only.
// No coordinator, system clock, local process, network, token, or write access.
// Real exclusivity requires a separately approved linearizable, durable CAS
// coordinator AND resource-side fencing of stale epochs (not implemented here).
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const HEX=/^[a-f0-9]{64}$/;
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
const n=x=>Number.isSafeInteger(x)&&x>=0&&x<Number.MAX_SAFE_INTEGER;
const positive=x=>n(x)&&x>0;
const holderKeys=['ownerId','generationId','leaseId','fencingEpoch','expiresAtMs'];
const retiredKeys=['state','ownerId','generationId','leaseId','fencingEpoch','journalSequence','recordDigest'];
const snapshotKeys=['schemaVersion','resourceId','revision','fencingEpoch','mode','holder','retired'];
const requestKeys=['kind','resourceId','expectedRevision','expectedEpoch',
  'ownerId','generationId','leaseId','ttlMs','retirementDigest'];
const review=(decision,reasons,proposal=null)=>Object.freeze({
  decision,reasons:Object.freeze([...new Set(reasons)]),
  proposedCAS:proposal?Object.freeze({
    expectedRevision:proposal.expectedRevision,
    nextSnapshot:Object.freeze({
      ...proposal.nextSnapshot,
      holder:proposal.nextSnapshot.holder?Object.freeze(proposal.nextSnapshot.holder):null,
      retired:proposal.nextSnapshot.retired?Object.freeze(proposal.nextSnapshot.retired):null
    })
  }):null,
  executionAuthorized:false,leaseGranted:false,
  requiresDurableLinearizableCAS:true,requiresTransportFencing:true,
  requiresTrustedCoordinatorClock:true,requiresExternalVerification:true,
  requiresFreshOperatorApproval:true
});

/**
 * Proposes an ACQUIRE or RENEW conditional mutation against an asserted
 * coordinator snapshot. CAS_PROPOSAL is not a lease, token or permission.
 * Expired or unknown ownership is NEVER automatically treated as vacant.
 */
export function planAtomicOwnershipLease({snapshot,request,coordinatorClockMs}={}){
  if(!record(snapshot,snapshotKeys)||!record(request,requestKeys)||
     snapshot.schemaVersion!==1||
     ![snapshot.resourceId,request.resourceId,request.ownerId,
       request.generationId,request.leaseId].every(id)||
     !n(snapshot.revision)||!n(snapshot.fencingEpoch)||
     !n(request.expectedRevision)||!n(request.expectedEpoch)||
     !n(coordinatorClockMs)||!positive(request.ttlMs)||request.ttlMs>30_000||
     !['VACANT','HELD','RETIRING','UNKNOWN'].includes(snapshot.mode)||
     !['ACQUIRE','RENEW'].includes(request.kind)||
     (request.retirementDigest!==null&&
       (typeof request.retirementDigest!=='string'||!HEX.test(request.retirementDigest)))||
     (snapshot.holder!==null&&(
       !record(snapshot.holder,holderKeys)||
       ![snapshot.holder.ownerId,snapshot.holder.generationId,
         snapshot.holder.leaseId].every(id)||
       !positive(snapshot.holder.fencingEpoch)||!positive(snapshot.holder.expiresAtMs)))||
     (snapshot.retired!==null&&(
       !record(snapshot.retired,retiredKeys)||
       snapshot.retired.state!=='COMMITTED'||
       ![snapshot.retired.ownerId,snapshot.retired.generationId,
         snapshot.retired.leaseId].every(id)||
       !positive(snapshot.retired.fencingEpoch)||
       !positive(snapshot.retired.journalSequence)||
       typeof snapshot.retired.recordDigest!=='string'||
       !HEX.test(snapshot.retired.recordDigest)))||
     (snapshot.mode==='VACANT'&&snapshot.holder!==null)||
     (['HELD','RETIRING'].includes(snapshot.mode)&&snapshot.holder===null))
    throw Error('Invalid synthetic atomic lease input');

  const reasons=[];
  if(snapshot.resourceId!==request.resourceId)reasons.push('LEASE_RESOURCE_MISMATCH');
  if(snapshot.revision!==request.expectedRevision)
    reasons.push('LEASE_CAS_REVISION_STALE');
  if(snapshot.fencingEpoch!==request.expectedEpoch)
    reasons.push('LEASE_FENCING_EPOCH_STALE');
  if(snapshot.revision+1>=Number.MAX_SAFE_INTEGER)
    reasons.push('LEASE_CAS_REVISION_OVERFLOW');
  if(snapshot.mode==='UNKNOWN')reasons.push('LEASE_OWNERSHIP_UNKNOWN');
  if(snapshot.mode==='RETIRING')reasons.push('LEASE_RETIREMENT_INCOMPLETE');
  if(snapshot.holder&&snapshot.holder.fencingEpoch!==snapshot.fencingEpoch)
    reasons.push('LEASE_HOLDER_FENCING_CONFLICT');
  if(reasons.length)return review('HOLD',reasons);

  if(request.kind==='ACQUIRE'){
    if(snapshot.mode!=='VACANT')return review('HOLD',['LEASE_EXISTING_OWNER_UNRETIRED']);
    if(!snapshot.retired||snapshot.retired.state!=='COMMITTED'||
       snapshot.retired.fencingEpoch!==snapshot.fencingEpoch)
      return review('HOLD',['LEASE_RETIREMENT_BARRIER_MISSING']);
    if(snapshot.retired.recordDigest!==request.retirementDigest)
      return review('HOLD',['LEASE_RETIREMENT_DIGEST_MISMATCH']);
    if(snapshot.retired.leaseId===request.leaseId||
       snapshot.retired.generationId===request.generationId||
       snapshot.retired.ownerId===request.ownerId)
      return review('HOLD',['LEASE_PREDECESSOR_IDENTITY_REUSED']);
    if(!positive(snapshot.fencingEpoch)||
       snapshot.fencingEpoch+1>=Number.MAX_SAFE_INTEGER)
      return review('HOLD',['LEASE_FENCING_OVERFLOW']);
    if(coordinatorClockMs+request.ttlMs>=Number.MAX_SAFE_INTEGER)
      return review('HOLD',['LEASE_CLOCK_OVERFLOW']);
    const next={schemaVersion:1,resourceId:snapshot.resourceId,
      revision:snapshot.revision+1,fencingEpoch:snapshot.fencingEpoch+1,
      mode:'HELD',holder:{ownerId:request.ownerId,
        generationId:request.generationId,leaseId:request.leaseId,
        fencingEpoch:snapshot.fencingEpoch+1,
        expiresAtMs:coordinatorClockMs+request.ttlMs},retired:{...snapshot.retired}};
    return review('CAS_PROPOSAL',[],{expectedRevision:snapshot.revision,nextSnapshot:next});
  }

  if(snapshot.mode!=='HELD'||!snapshot.holder)
    return review('HOLD',['LEASE_NOT_HELD_FOR_RENEWAL']);
  const h=snapshot.holder;
  if(h.ownerId!==request.ownerId||h.generationId!==request.generationId||
     h.leaseId!==request.leaseId||h.fencingEpoch!==request.expectedEpoch||
     request.retirementDigest!==null)
    return review('HOLD',['LEASE_RENEWAL_OWNER_MISMATCH']);
  if(coordinatorClockMs>=h.expiresAtMs)
    return review('HOLD',['LEASE_ALREADY_EXPIRED']);
  if(coordinatorClockMs+request.ttlMs>=Number.MAX_SAFE_INTEGER)
    return review('HOLD',['LEASE_CLOCK_OVERFLOW']);
  const nextExpiry=coordinatorClockMs+request.ttlMs;
  if(nextExpiry<=h.expiresAtMs)
    return review('HOLD',['LEASE_RENEWAL_NO_EXTENSION']);
  return review('CAS_PROPOSAL',[],{expectedRevision:snapshot.revision,
    nextSnapshot:{...snapshot,revision:snapshot.revision+1,
      holder:{...h,expiresAtMs:nextExpiry}}});
}
