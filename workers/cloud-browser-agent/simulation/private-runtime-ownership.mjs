// API1 P3-A proposal: PURE ownership assessment over caller-supplied observations.
// No file/process/network access, no locks, no signals, and no execution authority.
// Observations and cross-host attestations MUST be verified by a separate trusted
// operator-controlled component before they can be used in a real operation.
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const STATES=new Set(["active","stopped","unknown"]);
const PURPOSES=new Set(["activate","observe"]);
const CROSS_HOST=new Set(["unknown","externally-verified-exclusive"]);
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const id=x=>typeof x==="string"&&ID.test(x);
const processId=x=>Number.isSafeInteger(x)&&x>0;
const identity=x=>object(x)&&id(x.hostId)&&id(x.generationId)&&
  processId(x.pid)&&id(x.startIdentity)&&id(x.executableFingerprint);
const matches=(a,b)=>a.hostId===b.hostId&&a.generationId===b.generationId&&
  a.pid===b.pid&&a.startIdentity===b.startIdentity&&
  a.executableFingerprint===b.executableFingerprint;
const report=(issues,activeOwnerCount)=>Object.freeze({
  decision:issues.length?"HOLD":"REVIEWABLE",
  issues:Object.freeze([...new Set(issues)]),
  activeOwnerCount,
  executionAuthorized:false,
  requiresExternalVerification:true
});

/**
 * Returns a NON-AUTHORITATIVE assessment. It never authorizes a process action.
 * `inventoryComplete` and `crossHostEvidence` are caller ASSERTIONS, not proofs.
 * `observe` requires an expected active owner; `activate` requires no active owner.
 */
export function assessTunnelOwnership({
  purpose,tunnelRef,expectedOwner=null,observations,
  inventoryComplete=false,crossHostEvidence="unknown",
  nowMs,inventoryObservedAtMs,maxAgeMs=30_000
}={}){
  if(!PURPOSES.has(purpose)||!id(tunnelRef)||!Array.isArray(observations)||
     typeof inventoryComplete!=="boolean"||!CROSS_HOST.has(crossHostEvidence)||
     (purpose==="observe"&&!identity(expectedOwner))||
     (purpose==="activate"&&expectedOwner!==null)||
     !Number.isSafeInteger(nowMs)||nowMs<0||
     !Number.isSafeInteger(inventoryObservedAtMs)||inventoryObservedAtMs<0||
     !Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>60_000||
     observations.length>512||observations.some(x=>!object(x)||!id(x.tunnelRef)||
       !identity(x)||!STATES.has(x.state)||!Number.isSafeInteger(x.observedAtMs)||
       x.observedAtMs<0))
    throw Error("Invalid ownership assessment input");

  const relevant=observations.filter(x=>x.tunnelRef===tunnelRef);
  const active=relevant.filter(x=>x.state==="active");
  const issues=[];
  if(!inventoryComplete)issues.push("INVENTORY_INCOMPLETE");
  // Freshness inputs must come from a trusted *same-clock* observer. They
  // are advisory assertions, never evidence of a distributed ownership lease.
  if(inventoryObservedAtMs>nowMs||nowMs-inventoryObservedAtMs>maxAgeMs)
    issues.push("INVENTORY_STALE");
  if(relevant.some(x=>x.observedAtMs>nowMs||nowMs-x.observedAtMs>maxAgeMs))
    issues.push("OWNER_OBSERVATION_STALE");
  if(crossHostEvidence!=="externally-verified-exclusive")issues.push("CROSS_HOST_UNVERIFIED");
  if(relevant.some(x=>x.state==="unknown"))issues.push("OWNER_STATE_UNKNOWN");

  // Conflicting start identities for one host/PID are a sign of stale or
  // contradictory observations. Fail closed even when both claim "stopped".
  for(let i=0;i<relevant.length;i++){
    for(let j=i+1;j<relevant.length;j++){
      const a=relevant[i],b=relevant[j];
      if(a.hostId===b.hostId&&a.pid===b.pid&&
         (a.startIdentity!==b.startIdentity||a.executableFingerprint!==b.executableFingerprint))
        issues.push("PID_IDENTITY_CONFLICT");
    }
  }
  if(active.length>1)issues.push("DUPLICATE_ACTIVE_OWNERS");
  if(purpose==="activate"&&active.length)issues.push("ACTIVE_OWNER_PRESENT");
  if(purpose==="observe"){
    if(!active.length)issues.push("EXPECTED_OWNER_NOT_ACTIVE");
    if(!active.some(x=>matches(x,expectedOwner)))issues.push("EXPECTED_OWNER_IDENTITY_MISMATCH");
    if(active.some(x=>!matches(x,expectedOwner)))issues.push("UNEXPECTED_ACTIVE_OWNER");
  }
  return report(issues,active.length);
}
