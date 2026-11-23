// API1 P3-A proposal: PURE, ADVISORY lifecycle transition planner.
// Does not verify identity, approvals, health or processes. All evidence is
// externally asserted and MUST be independently authenticated before any real action.
// This module never executes, authorizes or persists an operational transition.
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const steps=Object.freeze({
  BASELINE_VERIFIED:{CANDIDATE_PREPARING:[]},
  CANDIDATE_PREPARING:{CANDIDATE_PREPARED:["candidatePrepared"]},
  CANDIDATE_PREPARED:{CANDIDATE_VALIDATED:["candidateValidated","credentialBindingVerified"]},
  CANDIDATE_VALIDATED:{AWAITING_APPROVAL:[]},
  AWAITING_APPROVAL:{CUTOVER_PREFLIGHT:["approvalVerifiedExternally","approvalMatchesGeneration","approvalFresh"]},
  CUTOVER_PREFLIGHT:{OLD_TUNNEL_STOPPING:["ownershipExternallyVerified","requestsDrained","approvalFresh"]},
  OLD_TUNNEL_STOPPING:{OLD_TUNNEL_STOPPED:["oldTunnelExitVerified"]},
  OLD_TUNNEL_STOPPED:{NEW_TUNNEL_STARTING:["noConflictingOwnerVerified","approvalFresh"]},
  NEW_TUNNEL_STARTING:{ACTIVE_UNVERIFIED:["newTunnelStartVerified"]},
  ACTIVE_UNVERIFIED:{ACTIVE_VERIFIED:["tunnelReady","controlPlanePolling","authenticatedMcpVerified","chatgptToolVerified","generationConsistent"]}
});
const rollbackSources=new Set(["ACTIVE_UNVERIFIED","ACTIVE_VERIFIED","RECOVERY_REQUIRED"]);
const holds=new Set(["HOLD_CONFIGURATION","HOLD_OWNERSHIP","HOLD_CREDENTIALS",
  "HOLD_APPROVAL","RECOVERY_REQUIRED","ROLLBACK_PENDING"]);
const known=new Set([...Object.keys(steps),"ACTIVE_VERIFIED",...holds]);
const knownFacts=new Set(["candidatePrepared","candidateValidated","credentialBindingVerified",
  "approvalVerifiedExternally","approvalMatchesGeneration","approvalFresh",
  "ownershipExternallyVerified","requestsDrained","oldTunnelExitVerified",
  "noConflictingOwnerVerified","newTunnelStartVerified","tunnelReady",
  "controlPlanePolling","authenticatedMcpVerified","chatgptToolVerified",
  "generationConsistent","failureObserved","rollbackReviewRequested"]);
const result=(decision,reasons,proposal)=>Object.freeze({
  decision,reasons:Object.freeze(reasons),proposedState:proposal?Object.freeze(proposal):null,
  executionAuthorized:false,requiresExternalVerification:true
});

/**
 * A revision-bounded *proposal* only. No caller-supplied boolean or "approval"
 * ever becomes an operational permission through this function.
 */
export function planLifecycleTransition({state,target,evidence={}}={}){
  if(!object(state)||!known.has(state.phase)||(typeof state.generationId!=="string"||!ID.test(state.generationId))||
     !Number.isSafeInteger(state.revision)||state.revision<0||
     state.revision===Number.MAX_SAFE_INTEGER||
     !known.has(target)||!object(evidence)||
     Object.keys(evidence).some(k=>k!=="generationId"&&!knownFacts.has(k))||
     Object.entries(evidence).some(([k,v])=>k!=="generationId"&&typeof v!=="boolean"))
    throw Error("Invalid lifecycle planning input");

  if(evidence.generationId!==state.generationId)
    return result("HOLD",["GENERATION_MISMATCH"],null);
  if(target===state.phase)
    return result("HOLD",["NO_STATE_CHANGE"],null);

  let required=steps[state.phase]?.[target];
  if(target==="ROLLBACK_PENDING"&&rollbackSources.has(state.phase))
    required=["rollbackReviewRequested"];
  else if(holds.has(target)&&target!=="ROLLBACK_PENDING"&&!holds.has(state.phase))
    required=["failureObserved"];
  if(!required)
    return result("HOLD",["TRANSITION_NOT_ALLOWED"],null);

  const missing=required.filter(k=>evidence[k]!==true);
  if(missing.length)
    return result("HOLD",["REQUIRED_EVIDENCE_MISSING"],null);

  // The proposal is not a committed event and cannot be used as an
  // executable instruction, authorization token or process-control handle.
  return result("PLAN_ELIGIBLE",[],{
    phase:target,generationId:state.generationId,revision:state.revision+1
  });
}
