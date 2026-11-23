import test from 'node:test';
import assert from 'node:assert/strict';
import {planPrivateTunnelStartup} from '../simulation/private-runtime-startup-plan.mjs';

const tunnelRef='synthetic-tunnel-p3a';
const generationId='synthetic-generation-p3a';
const state={phase:'OLD_TUNNEL_STOPPED',generationId,revision:7};
const ownershipInput={purpose:'activate',tunnelRef,observations:[],
  inventoryComplete:true,crossHostEvidence:'externally-verified-exclusive',
  nowMs:10000,inventoryObservedAtMs:9999,maxAgeMs:500};
const retiredProcessInspection={decision:'HOLD',issues:['PROCESS_IDENTITY_READ_UNAVAILABLE'],
  executionAuthorized:false,requiresExternalVerification:true};
const evidence={generationId,approvalFresh:true,approvalVerifiedExternally:true,
  oldTunnelExitVerifiedExternally:true,noConflictingOwnerVerifiedExternally:true};
const plan=(changes={})=>planPrivateTunnelStartup({
  state,tunnelRef,ownershipInput,retiredProcessInspection,evidence,...changes
});

test('P3-A eligible synthetic startup is a proposal only, not a process command',()=>{
  const before=structuredClone({state,ownershipInput,retiredProcessInspection,evidence});
  const out=plan();
  assert.equal(out.decision,'PLAN_ELIGIBLE');
  assert.deepEqual(out.proposedState,{phase:'NEW_TUNNEL_STARTING',generationId,revision:8});
  assert.equal(out.executionAuthorized,false);
  assert.equal(out.requiresExternalVerification,true);
  assert.equal(out.requiresOperatorControlledAtomicLease,true);
  assert.ok(Object.isFrozen(out)&&Object.isFrozen(out.proposedState));
  assert.deepEqual({state,ownershipInput,retiredProcessInspection,evidence},before);
});

test('P3-A active owner or duplicate owner blocks startup',()=>{
  const owner={tunnelRef,hostId:'synthetic-host',generationId,pid:9011,
    observedAtMs:9998,startIdentity:'boot-ticks',executableFingerprint:'exe-hash',state:'active'};
  const active=plan({ownershipInput:{...ownershipInput,observations:[owner]}});
  assert.deepEqual(active.reasons,['OWNERSHIP_HOLD']);
  const duplicate=plan({ownershipInput:{...ownershipInput,observations:[owner,{...owner,pid:9012}]}});
  assert.deepEqual(duplicate.reasons,['OWNERSHIP_HOLD']);
});

test('P3-A incomplete or stale inventory and unverified remote scope block startup',()=>{
  for(const altered of [
    {inventoryComplete:false},{inventoryObservedAtMs:1000},
    {crossHostEvidence:'unknown'}
  ])assert.deepEqual(plan({ownershipInput:{...ownershipInput,...altered}}).reasons,['OWNERSHIP_HOLD']);
});

test('P3-A retired process still present or inconsistent fails closed',()=>{
  assert.deepEqual(plan({retiredProcessInspection:{...retiredProcessInspection,
    decision:'REVIEWABLE',issues:[]}}).reasons,['RETIRED_PROCESS_STILL_PRESENT']);
  assert.deepEqual(plan({retiredProcessInspection:{...retiredProcessInspection,
    issues:['START_IDENTITY_MISMATCH']}}).reasons,['RETIRED_PROCESS_IDENTITY_AMBIGUOUS']);
});

test('P3-A empty or mixed retired-process issue lists cannot imply absence',()=>{
  for(const issues of [[],['PROCESS_IDENTITY_READ_UNAVAILABLE','START_IDENTITY_MISMATCH']]){
    const out=plan({retiredProcessInspection:{...retiredProcessInspection,issues}});
    assert.deepEqual(out.reasons,['RETIRED_PROCESS_IDENTITY_AMBIGUOUS']);
  }
});

test('P3-A external exit, approval and exclusivity evidence are all required',()=>{
  const noExit=plan({evidence:{...evidence,oldTunnelExitVerifiedExternally:false}});
  assert.deepEqual(noExit.reasons,['OLD_TUNNEL_EXIT_UNVERIFIED']);
  const noApproval=plan({evidence:{...evidence,approvalFresh:false}});
  assert.deepEqual(noApproval.reasons,['APPROVAL_REVIEW_REQUIRED']);
  const noExclusive=plan({evidence:{...evidence,noConflictingOwnerVerifiedExternally:false}});
  assert.deepEqual(noExclusive.reasons,['EXTERNAL_EXCLUSIVITY_UNVERIFIED']);
});

test('P3-A generation mismatch, wrong tunnel and wrong lifecycle phase hold',()=>{
  assert.deepEqual(plan({evidence:{...evidence,generationId:'other-generation'}}).reasons,['GENERATION_MISMATCH']);
  assert.deepEqual(plan({tunnelRef:'other-tunnel'}).reasons,['OWNERSHIP_SCOPE_MISMATCH']);
  assert.deepEqual(plan({state:{...state,phase:'ACTIVE_VERIFIED'}}).reasons,['STARTUP_PHASE_NOT_ELIGIBLE']);
  assert.deepEqual(plan({state:{...state,phase:'RECOVERY_REQUIRED'}}).reasons,['STARTUP_PHASE_NOT_ELIGIBLE']);
});

test('P3-A unknown approval keys, strings pretending to be booleans are invalid',()=>{
  for(const changed of [
    {evidence:{...evidence,token:'secret'}},
    {evidence:{...evidence,approvalFresh:'true'}},
    {retiredProcessInspection:{...retiredProcessInspection,executionAuthorized:true}},
    {retiredProcessInspection:{...retiredProcessInspection,decision:'VERIFIED'}},
    {tunnelRef:'bad\ncontrol'}
  ])assert.throws(()=>plan(changed),/Invalid startup planning input/);
});

test('P3-A revision overflow cannot generate a next-state proposal',()=>{
  assert.throws(()=>plan({state:{...state,revision:Number.MAX_SAFE_INTEGER}}),/Invalid lifecycle planning input/);
});
