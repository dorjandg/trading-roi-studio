// Synthetic per-grant session revocation FENCE, not a deployed coordinator.
// The ONLY proof of cross-process enforcement would be a durable serialized
// owner (e.g. isolated Durable Object) with persistent revocation epoch.
// No module-global state, no browser instantiation, no storage binding.
const fail=code=>{throw Object.assign(new Error(code),{code})};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HEX=/^[0-9a-f]{64}$/;
const SESSION=/^[A-Za-z0-9-]{10,128}$/;

export function createIsolatedRevocationFence({
  grantId,subjectKey,revision,loadCurrent,persistRevocation,closeOwnedSession
}){
  if(!UUID.test(grantId||'')||!HEX.test(subjectKey||'')||
    !Number.isSafeInteger(revision)||revision<2||
    typeof loadCurrent!=='function'||typeof persistRevocation!=='function'||
    typeof closeOwnedSession!=='function')
    fail('FENCE_CONFIG_INVALID');

  // One coordinator owner per grant in synthetic tests. No other owner may
  // accept the same grant until durable exclusive ownership is established.
  let mode='ACTIVE',revocationPromise=null,epoch=revision;
  const sessions=new Map();
  const current=async()=>{
    let record;
    try{record=await loadCurrent(grantId,subjectKey)}catch{
      fail('FENCE_AUTHORITY_UNAVAILABLE');
    }
    if(!record||record.grantId!==grantId||record.subjectKey!==subjectKey||
       record.status!=='ACTIVE'||record.revision!==epoch||
       !Number.isSafeInteger(record.expiresAtMs)||record.expiresAtMs<=Date.now())
      fail('FENCE_GRANT_NOT_ACTIVE');
    return record;
  };
  const gate=()=>{if(mode!=='ACTIVE')fail('FENCE_REVOKED_OR_BLOCKED')};
  const register=async sessionId=>{
    gate();
    if(!SESSION.test(sessionId||'')||sessions.has(sessionId)||sessions.size>=8)
      fail('FENCE_SESSION_REFUSED');
    await current();
    gate(); // Revocation may start during the awaited primary read.
    sessions.set(sessionId,{running:false,closed:false});
    return Object.freeze({grantId,revision:epoch,registered:true});
  };
  const runStep=async(sessionId,execute)=>{
    gate();
    if(typeof execute!=='function'||!sessions.has(sessionId))
      fail('FENCE_ACTION_REFUSED');
    const state=sessions.get(sessionId);
    if(state.running||state.closed)fail('FENCE_ACTION_REFUSED');
    await current();
    gate();
    if(state.running||state.closed)fail('FENCE_ACTION_REFUSED');
    state.running=true;
    let result;
    try{
      result=await execute(Object.freeze({sessionId,grantId,revision:epoch}));
    }catch{
      fail('FENCE_ACTION_OUTCOME_UNKNOWN_NO_RETRY');
    }finally{
      state.running=false;
    }
    gate(); // Never return success after revocation started during action.
    await current(); // A parallel trusted database revocation invalidates result.
    gate();
    return Object.freeze({completed:true,result});
  };
  const revoke=async()=>{
    if(revocationPromise)return revocationPromise;
    gate();
    mode='REVOKING'; // Barrier occurs BEFORE the durable state write.
    revocationPromise=(async()=>{
      let persisted;
      try{persisted=await persistRevocation(Object.freeze({
        grantId,subjectKey,expectedRevision:epoch
      }))}catch{
        mode='BLOCKED';
        fail('FENCE_REVOCATION_COMMIT_UNCERTAIN');
      }
      if(!persisted||persisted.status!=='REVOKED'||persisted.grantId!==grantId||
         !Number.isSafeInteger(persisted.revision)||
         persisted.revision!==epoch+1){
        mode='BLOCKED';
        fail('FENCE_REVOCATION_COMMIT_UNCERTAIN');
      }
      epoch=persisted.revision;
      const receipts=await Promise.allSettled(
        [...sessions].map(async([id,state])=>{
          let close;
          try{close=await closeOwnedSession(id)}catch{
            return false;
          }
          if(close?.status!=='closed')return false;
          state.closed=true;
          return true;
        })
      );
      if(receipts.some(x=>x.status!=='fulfilled'||x.value!==true)){
        mode='BLOCKED'; // Never announce complete when cleanup is uncertain.
        fail('FENCE_SESSION_CLEANUP_UNCERTAIN');
      }
      mode='REVOKED';
      return Object.freeze({
        completed:true,grantId,revision:epoch,
        closedSessions:sessions.size,scope:'this-isolated-owner-only',
        inFlightActionsMayHaveStarted:true
      });
    })();
    return revocationPromise;
  };
  return Object.freeze({
    register,runStep,revoke,
    inspect:()=>Object.freeze({mode,revision:epoch,activeSessions:
      [...sessions.values()].filter(x=>!x.closed).length})
  });
}
