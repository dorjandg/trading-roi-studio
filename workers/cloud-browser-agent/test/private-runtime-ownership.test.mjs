import test from "node:test";
import assert from "node:assert/strict";
import {assessTunnelOwnership} from "../simulation/private-runtime-ownership.mjs";

const tunnelRef="synthetic-tunnel-reference";
const owner={tunnelRef,hostId:"synthetic-host-a",generationId:"synthetic-generation-a",
  pid:1001,observedAtMs:1995,startIdentity:"boot-sequence-123",executableFingerprint:"synthetic-exe-abc",state:"active"};
const input=(changes={})=>({purpose:"activate",tunnelRef,observations:[],
  inventoryComplete:true,crossHostEvidence:"externally-verified-exclusive",
  nowMs:2000,inventoryObservedAtMs:1990,maxAgeMs:500,...changes});

test("P3-A empty externally attested inventory is reviewable but NEVER authorizes execution",()=>{
  const result=assessTunnelOwnership(input());
  assert.equal(result.decision,"REVIEWABLE");
  assert.deepEqual(result.issues,[]);
  assert.equal(result.executionAuthorized,false);
  assert.equal(result.requiresExternalVerification,true);
  assert.ok(Object.isFrozen(result));
});

test("P3-A existing local active tunnel blocks replacement activation",()=>{
  const result=assessTunnelOwnership(input({observations:[owner]}));
  assert.equal(result.decision,"HOLD");
  assert.ok(result.issues.includes("ACTIVE_OWNER_PRESENT"));
});

test("P3-A duplicate active tunnel owners are rejected",()=>{
  const other={...owner,pid:1002,generationId:"synthetic-generation-b"};
  const result=assessTunnelOwnership(input({observations:[owner,other]}));
  assert.ok(result.issues.includes("DUPLICATE_ACTIVE_OWNERS"));
  assert.equal(result.activeOwnerCount,2);
});

test("P3-A unclear inventory or remote ownership fails closed",()=>{
  const result=assessTunnelOwnership(input({inventoryComplete:false,crossHostEvidence:"unknown"}));
  assert.deepEqual(result.issues,["INVENTORY_INCOMPLETE","CROSS_HOST_UNVERIFIED"]);
  assert.equal(result.decision,"HOLD");
});

test("P3-A unknown process state blocks owner judgment",()=>{
  const result=assessTunnelOwnership(input({observations:[{...owner,state:"unknown"}]}));
  assert.ok(result.issues.includes("OWNER_STATE_UNKNOWN"));
});

test("P3-A synthetic PID reuse is rejected even for stopped observations",()=>{
  const a={...owner,state:"stopped"};
  const b={...a,startIdentity:"boot-sequence-999"};
  const result=assessTunnelOwnership(input({observations:[a,b]}));
  assert.ok(result.issues.includes("PID_IDENTITY_CONFLICT"));
});

test("P3-A observe mode requires exact expected process generation and executable",()=>{
  const expected={hostId:owner.hostId,generationId:owner.generationId,pid:owner.pid,
    startIdentity:owner.startIdentity,executableFingerprint:owner.executableFingerprint};
  const ok=assessTunnelOwnership(input({purpose:"observe",expectedOwner:expected,observations:[owner]}));
  assert.equal(ok.decision,"REVIEWABLE");
  assert.equal(ok.executionAuthorized,false);
  const mismatch=assessTunnelOwnership(input({purpose:"observe",expectedOwner:{...expected,executableFingerprint:"other-exe"},observations:[owner]}));
  assert.ok(mismatch.issues.includes("EXPECTED_OWNER_IDENTITY_MISMATCH"));
});

test("P3-A observation mode detects an unexpected active owner",()=>{
  const expected={hostId:owner.hostId,generationId:"synthetic-generation-other",pid:1002,
    startIdentity:"other-start",executableFingerprint:"other-exe"};
  const result=assessTunnelOwnership(input({purpose:"observe",expectedOwner:expected,observations:[owner]}));
  assert.ok(result.issues.includes("UNEXPECTED_ACTIVE_OWNER"));
});

test("P3-A unrelated tunnel observations never count as this tunnel's owners",()=>{
  const result=assessTunnelOwnership(input({observations:[{...owner,tunnelRef:"different-synthetic-tunnel"}]}));
  assert.equal(result.activeOwnerCount,0);
  assert.equal(result.executionAuthorized,false);
});

test("P3-A malformed or unsafe identity fields fail closed without echoing input",()=>{
  for(const changed of [
    {purpose:"stop"},{tunnelRef:"wrong\ncontrol"},{observations:[{...owner,pid:0}]},
    {observations:[{...owner,startIdentity:"bad\nmarker"}]},
    {observations:[{...owner,state:"claimed-ready"}]},
    {observations:Array(513).fill(owner)},
    {purpose:"observe",expectedOwner:null},
    {crossHostEvidence:"I promise"}
  ])assert.throws(()=>assessTunnelOwnership(input(changed)),/^Error: Invalid ownership assessment input$/);
});

test("P3-A inputs are not mutated by pure ownership assessment",()=>{
  const original=owner.state;
  const arr=[owner];
  const result=assessTunnelOwnership(input({observations:arr}));
  assert.equal(arr[0].state,original);
  assert.equal(arr.length,1);
  assert.equal(result.executionAuthorized,false);
});

test("P3-A stale or future-dated inventory observations block review",()=>{
  const inventoryStale=assessTunnelOwnership(input({inventoryObservedAtMs:100}));
  assert.ok(inventoryStale.issues.includes("INVENTORY_STALE"));
  const ownerStale=assessTunnelOwnership(input({observations:[{...owner,state:"stopped",observedAtMs:100}]}));
  assert.ok(ownerStale.issues.includes("OWNER_OBSERVATION_STALE"));
  const future=assessTunnelOwnership(input({observations:[{...owner,state:"stopped",observedAtMs:3000}]}));
  assert.ok(future.issues.includes("OWNER_OBSERVATION_STALE"));
  assert.equal(future.executionAuthorized,false);
});

test("P3-A invalid clock data cannot bypass stale assessment",()=>{
  for(const changed of [{nowMs:-1},{inventoryObservedAtMs:NaN},{maxAgeMs:0},{maxAgeMs:60001}])
    assert.throws(()=>assessTunnelOwnership(input(changed)),/^Error: Invalid ownership assessment input$/);
});
