// API1 P3-A: PURE proposal for an already approved, externally controlled
// tunnel startup phase. No OS reads, signal handling, spawning, locks or writes.
// The existing ownership and lifecycle planners remain the single sources
// for their policy logic. All supplied evidence is unauthenticated input.
import {assessTunnelOwnership} from './private-runtime-ownership.mjs';
import {planLifecycleTransition} from './private-runtime-lifecycle.mjs';

const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const record=x=>obj(x)&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const owns=(x,required)=>required.every(k=>Object.hasOwn(x,k));
const result=(decision,reasons,proposedState=null)=>Object.freeze({
  decision,reasons:Object.freeze([...new Set(reasons)]),proposedState,
  executionAuthorized:false,requiresExternalVerification:true,
  requiresOperatorControlledAtomicLease:true
});

/**
 * A possible OLD_TUNNEL_STOPPED -> NEW_TUNNEL_STARTING transition.
 * This result never grants a lease or authority to start a process.
 * The inspector's REVIEWABLE outcome is insufficient on its own to prove
 * that an old process exited, or that no other host owns the tunnel.
 */
export function planPrivateTunnelStartup({
  state,tunnelRef,ownershipInput,retiredProcessInspection,
  evidence={}
}={}){
  if(!record(state)||!owns(state,['phase','generationId','revision'])||
    typeof tunnelRef!=='string'||!ID.test(tunnelRef)||
    !record(ownershipInput)||!owns(ownershipInput,[
      'purpose','tunnelRef','observations','inventoryComplete','crossHostEvidence',
      'nowMs','inventoryObservedAtMs'])||
    !record(retiredProcessInspection)||!owns(retiredProcessInspection,[
      'decision','issues','executionAuthorized','requiresExternalVerification'])||
    !record(evidence)||!owns(evidence,[
      'generationId','approvalFresh','approvalVerifiedExternally',
      'oldTunnelExitVerifiedExternally','noConflictingOwnerVerifiedExternally'])||
    Object.keys(evidence).some(k=>!['generationId','approvalFresh',
      'approvalVerifiedExternally','oldTunnelExitVerifiedExternally',
      'noConflictingOwnerVerifiedExternally'].includes(k))||
    !['approvalFresh','approvalVerifiedExternally',
      'oldTunnelExitVerifiedExternally','noConflictingOwnerVerifiedExternally']
      .every(k=>typeof evidence[k]==='boolean')||
    typeof evidence.generationId!=='string'||
    !['HOLD','REVIEWABLE'].includes(retiredProcessInspection.decision)||
    retiredProcessInspection.executionAuthorized!==false||
    retiredProcessInspection.requiresExternalVerification!==true||
    !Array.isArray(retiredProcessInspection.issues)||
    retiredProcessInspection.issues.length>16||
    retiredProcessInspection.issues.some(x=>typeof x!=='string'))
    throw Error('Invalid startup planning input');

  if(state.phase!=='OLD_TUNNEL_STOPPED')
    return result('HOLD',['STARTUP_PHASE_NOT_ELIGIBLE']);
  if(state.generationId!==evidence.generationId)
    return result('HOLD',['GENERATION_MISMATCH']);
  if(ownershipInput.purpose!=='activate'||ownershipInput.tunnelRef!==tunnelRef||
    ownershipInput.expectedOwner!==undefined&&ownershipInput.expectedOwner!==null)
    return result('HOLD',['OWNERSHIP_SCOPE_MISMATCH']);

  // Compare the current synthetic inventory against the existing pure policy.
  const assessment=assessTunnelOwnership(ownershipInput);
  const reasons=[];
  if(assessment.decision!=='REVIEWABLE')reasons.push('OWNERSHIP_HOLD');
  // An inspection of the retired PID must NOT still match a live process.
  if(retiredProcessInspection.decision==='REVIEWABLE')
    reasons.push('RETIRED_PROCESS_STILL_PRESENT');
  if(retiredProcessInspection.decision==='HOLD'&&
     (retiredProcessInspection.issues.length!==1||
      retiredProcessInspection.issues[0]!=='PROCESS_IDENTITY_READ_UNAVAILABLE'))
    reasons.push('RETIRED_PROCESS_IDENTITY_AMBIGUOUS');
  if(evidence.approvalFresh!==true||evidence.approvalVerifiedExternally!==true)
    reasons.push('APPROVAL_REVIEW_REQUIRED');
  if(evidence.oldTunnelExitVerifiedExternally!==true)
    reasons.push('OLD_TUNNEL_EXIT_UNVERIFIED');
  if(evidence.noConflictingOwnerVerifiedExternally!==true)
    reasons.push('EXTERNAL_EXCLUSIVITY_UNVERIFIED');
  if(reasons.length)return result('HOLD',reasons);

  // Keep the established lifecycle evidence gates. This is only advisory:
  // a real cutover still requires operator-controlled compare-and-swap,
  // exclusive ownership/lease verification, and a fresh manual approval.
  const transition=planLifecycleTransition({
    state,target:'NEW_TUNNEL_STARTING',evidence:{
      generationId:evidence.generationId,
      noConflictingOwnerVerified:true,approvalFresh:true
    }
  });
  if(transition.decision!=='PLAN_ELIGIBLE')
    return result('HOLD',['LIFECYCLE_HOLD']);
  // A failed read is NOT proof of process exit. No independent, generation-
  // bound retirement witness exists in P3-A, so the safe proposal is HOLD.
  // Do not broaden this rule based solely on unverified caller booleans.
  return result('HOLD',['RETIRED_PROCESS_UNOBSERVABLE']);
}
