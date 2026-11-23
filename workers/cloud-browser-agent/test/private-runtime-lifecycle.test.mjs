import test from "node:test";
import assert from "node:assert/strict";
import {planLifecycleTransition} from "../simulation/private-runtime-lifecycle.mjs";

const generationId="synthetic-generation-1";
const state=(phase="BASELINE_VERIFIED",revision=0)=>({phase,generationId,revision});
const plan=(from,to,evidence={})=>planLifecycleTransition({
  state:state(from),target:to,evidence:{generationId,...evidence}
});

test("P3-A valid model transitions produce proposals only, never executable permissions",()=>{
  const r=plan("BASELINE_VERIFIED","CANDIDATE_PREPARING");
  assert.equal(r.decision,"PLAN_ELIGIBLE");
  assert.deepEqual(r.proposedState,state("CANDIDATE_PREPARING",1));
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.requiresExternalVerification,true);
  assert.ok(Object.isFrozen(r.proposedState));
});

test("P3-A lifecycle rejects generation mismatch and forbids same-state replay",()=>{
  const mismatch=plan("BASELINE_VERIFIED","CANDIDATE_PREPARING",{generationId:"other-generation"});
  assert.deepEqual(mismatch.reasons,["GENERATION_MISMATCH"]);
  assert.equal(mismatch.proposedState,null);
  const same=plan("BASELINE_VERIFIED","BASELINE_VERIFIED");
  assert.deepEqual(same.reasons,["NO_STATE_CHANGE"]);
});

test("P3-A requires candidate and credential binding evidence",()=>{
  const bad=plan("CANDIDATE_PREPARED","CANDIDATE_VALIDATED",{candidateValidated:true});
  assert.equal(bad.decision,"HOLD");
  const ok=plan("CANDIDATE_PREPARED","CANDIDATE_VALIDATED",{
    candidateValidated:true,credentialBindingVerified:true
  });
  assert.equal(ok.decision,"PLAN_ELIGIBLE");
});

test("P3-A approval and ownership gates block unsafe operational transitions",()=>{
  const approval=plan("AWAITING_APPROVAL","CUTOVER_PREFLIGHT",{
    approvalVerifiedExternally:true,approvalMatchesGeneration:true
  });
  assert.equal(approval.decision,"HOLD");
  const starting=plan("CUTOVER_PREFLIGHT","OLD_TUNNEL_STOPPING",{
    ownershipExternallyVerified:true,approvalFresh:true
  });
  assert.equal(starting.decision,"HOLD");
  const stopped=plan("OLD_TUNNEL_STOPPED","NEW_TUNNEL_STARTING",{
    noConflictingOwnerVerified:true
  });
  assert.equal(stopped.decision,"HOLD");
});

test("P3-A no direct skip from validated candidate to active",()=>{
  const r=plan("CANDIDATE_VALIDATED","ACTIVE_VERIFIED",{
    approvalVerifiedExternally:true,tunnelReady:true,chatgptToolVerified:true
  });
  assert.equal(r.decision,"HOLD");
  assert.deepEqual(r.reasons,["TRANSITION_NOT_ALLOWED"]);
});

test("P3-A active verification requires tunnel, control-plane, MCP, ChatGPT and matching generation",()=>{
  const facts={tunnelReady:true,controlPlanePolling:true,authenticatedMcpVerified:true,
    chatgptToolVerified:true,generationConsistent:true};
  assert.equal(plan("ACTIVE_UNVERIFIED","ACTIVE_VERIFIED",{...facts,chatgptToolVerified:false}).decision,"HOLD");
  const ok=plan("ACTIVE_UNVERIFIED","ACTIVE_VERIFIED",facts);
  assert.equal(ok.decision,"PLAN_ELIGIBLE");
  assert.equal(ok.executionAuthorized,false);
});

test("P3-A missing observation evidence cannot put a runtime into a failure state",()=>{
  assert.equal(plan("ACTIVE_VERIFIED","RECOVERY_REQUIRED").decision,"HOLD");
  assert.equal(plan("ACTIVE_VERIFIED","RECOVERY_REQUIRED",{failureObserved:true}).decision,"PLAN_ELIGIBLE");
});

test("P3-A rollback planning requires explicit review request",()=>{
  assert.equal(plan("ACTIVE_UNVERIFIED","ROLLBACK_PENDING").decision,"HOLD");
  assert.equal(plan("ACTIVE_UNVERIFIED","ROLLBACK_PENDING",{rollbackReviewRequested:true}).decision,"PLAN_ELIGIBLE");
  assert.equal(plan("ROLLBACK_PENDING","NEW_TUNNEL_STARTING",{approvalFresh:true}).decision,"HOLD");
});

test("P3-A unknown transitions, unsafe evidence types and invalid revisions fail closed",()=>{
  const bad=[
    {state:state(),target:"ROOT",evidence:{generationId}},
    {state:state("ROOT"),target:"CANDIDATE_PREPARING",evidence:{generationId}},
    {state:state("BASELINE_VERIFIED",-1),target:"CANDIDATE_PREPARING",evidence:{generationId}},
    {state:state(),target:"CANDIDATE_PREPARING",evidence:{generationId,approvalFresh:"yes"}},
    {state:state(),target:"CANDIDATE_PREPARING",evidence:{generationId,token:"secret"}}
  ];
  for(const x of bad)assert.throws(()=>planLifecycleTransition(x),/^Error: Invalid lifecycle planning input$/);
});

test("P3-A plan does not mutate caller-owned state or evidence",()=>{
  const s=state(),e={generationId};
  const r=planLifecycleTransition({state:s,target:"CANDIDATE_PREPARING",evidence:e});
  assert.deepEqual(s,state());
  assert.deepEqual(e,{generationId});
  assert.equal(r.executionAuthorized,false);
});

test("P3-A non-string generation cannot be coerced to a valid identity",()=>{
  assert.throws(()=>planLifecycleTransition({state:{phase:"BASELINE_VERIFIED",generationId:12,revision:0},
    target:"CANDIDATE_PREPARING",evidence:{generationId:12}}),
    /^Error: Invalid lifecycle planning input$/);
});

test("P3-A a full synthetic lifecycle requires every evidence gate",()=>{
  const transitions=[
    ["CANDIDATE_PREPARING",{}],
    ["CANDIDATE_PREPARED",{candidatePrepared:true}],
    ["CANDIDATE_VALIDATED",{candidateValidated:true,credentialBindingVerified:true}],
    ["AWAITING_APPROVAL",{}],
    ["CUTOVER_PREFLIGHT",{approvalVerifiedExternally:true,approvalMatchesGeneration:true,approvalFresh:true}],
    ["OLD_TUNNEL_STOPPING",{ownershipExternallyVerified:true,requestsDrained:true,approvalFresh:true}],
    ["OLD_TUNNEL_STOPPED",{oldTunnelExitVerified:true}],
    ["NEW_TUNNEL_STARTING",{noConflictingOwnerVerified:true,approvalFresh:true}],
    ["ACTIVE_UNVERIFIED",{newTunnelStartVerified:true}],
    ["ACTIVE_VERIFIED",{tunnelReady:true,controlPlanePolling:true,authenticatedMcpVerified:true,
      chatgptToolVerified:true,generationConsistent:true}]
  ];
  let current=state();
  for(const [target,facts] of transitions){
    const result=planLifecycleTransition({state:current,target,evidence:{generationId,...facts}});
    assert.equal(result.decision,"PLAN_ELIGIBLE",target);
    assert.equal(result.executionAuthorized,false);
    current=result.proposedState;
  }
  assert.equal(current.phase,"ACTIVE_VERIFIED");
  assert.equal(current.revision,10);
});

test("P3-A rollback cannot be requested from a never-active baseline",()=>{
  const result=plan("BASELINE_VERIFIED","ROLLBACK_PENDING",{rollbackReviewRequested:true});
  assert.deepEqual(result.reasons,["TRANSITION_NOT_ALLOWED"]);
});

test("P3-A revision overflow is invalid",()=>{
  assert.throws(()=>planLifecycleTransition({state:state("BASELINE_VERIFIED",Number.MAX_SAFE_INTEGER),
    target:"CANDIDATE_PREPARING",evidence:{generationId}}),
    /^Error: Invalid lifecycle planning input$/);
});
