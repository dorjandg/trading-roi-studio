// Isolated development owner for review-only key lifecycle checkpoints.
// Store methods must be synchronous trusted capabilities. No network, browser,
// real credential, profile, default database path or runtime grant is provided.
// Complete candidate state is committed before it replaces the private current
// instance. A conflict or ambiguous acknowledgement permanently halts this owner.
import {createHash} from 'node:crypto';
import {restoreAccessKeysetLifecycle} from './access-keyset-lifecycle.mjs';

const MAX_PAYLOAD_BYTES = 131072;
const claimedStores = new WeakSet();
const hash = value => createHash('sha256').update(value,'utf8').digest('hex');
const hashOk = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const noAuthority = Object.freeze({admissionAuthorized:false,executionAuthorized:false,
  trustedIngressVerified:false,keyLifecycleRuntimeVerified:false,requiresTrustedKeySource:true,
  requiresDurableGenerationFloor:true,requiresExternalOwnershipFence:true,
  requiresIndependentRollbackAnchor:true});
function error(code) {
  return Object.assign(Error(code),{code});
}
function dataRecord(value,names) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw error('INVALID_DATA');
  const keys=Reflect.ownKeys(value),out=Object.create(null);
  if (keys.length!==names.length || keys.some(key=>typeof key!=='string'||!names.includes(key)))
    throw error('INVALID_DATA');
  for (const key of names) {
    const field=Object.getOwnPropertyDescriptor(value,key);
    if (!field || !Object.hasOwn(field,'value') || !field.enumerable) throw error('INVALID_DATA');
    out[key]=field.value;
  }
  return out;
}
function payloadText(value) {
  if (typeof value!=='string' || value.length===0 || value.length>MAX_PAYLOAD_BYTES ||
      Buffer.byteLength(value,'utf8')>MAX_PAYLOAD_BYTES || Buffer.from(value).toString('utf8')!==value)
    throw error('INVALID_PAYLOAD');
  return value;
}
function receipt(value) {
  // Consume native asynchronous rejection without allowing an asynchronous store
  // to turn a later commit into permission to resume this synchronous owner.
  if (value instanceof Promise) { value.catch(()=>{}); throw error('ASYNC_STORE_REFUSED'); }
  const row=dataRecord(value,['storeId','revision','sha256','payload']);
  if (typeof row.storeId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(row.storeId)||
      !integer(row.revision)||row.revision<1||!hashOk(row.sha256)||
      hash(payloadText(row.payload))!==row.sha256) throw error('INVALID_RECEIPT');
  return Object.freeze({...row});
}
function decode(payload) {
  const checkpoint=JSON.parse(payloadText(payload));
  // The lifecycle exporter produces this exact representation. This also
  // rejects duplicate JSON members, discarded whitespace and noncanonical bytes.
  if (JSON.stringify(checkpoint)!==payload) throw error('NONCANONICAL_CHECKPOINT');
  return checkpoint;
}
function exported(candidate) {
  const value=dataRecord(candidate.exportCheckpoint(),['checkpoint','sha256']);
  const payload=payloadText(JSON.stringify(value.checkpoint));
  if (!hashOk(value.sha256)||hash(payload)!==value.sha256) throw error('INVALID_CHECKPOINT_EXPORT');
  return {payload,sha256:value.sha256};
}
function trustedMethod(store,name) {
  const field=Object.getOwnPropertyDescriptor(store,name);
  if (!field || !Object.hasOwn(field,'value') || typeof field.value!=='function')
    throw error('INVALID_CHECKPOINT_STORE');
  return field.value.bind(store);
}
function closeSynchronously(closeStore) {
  const value=closeStore();
  if (value instanceof Promise) { value.catch(()=>{});return false; }
  return value===undefined;
}
function failureClass(value) {
  let code;
  try { code=Object.getOwnPropertyDescriptor(value,'code')?.value; } catch {}
  if (code==='STATE_CAS_CONFLICT') return 'CHECKPOINT_CONFLICT';
  if (code==='INVALID_RECEIPT'||code==='ASYNC_STORE_REFUSED') return 'CHECKPOINT_ACK_INVALID';
  return 'CHECKPOINT_WRITE_UNCONFIRMED';
}

export function createDurableAccessKeysetOwner(config,{store,minimumGeneration=0,minimumClockSeconds=null}={}) {
  if (!store || typeof store!=='object' || !integer(minimumGeneration) ||
      minimumClockSeconds!==null&&!integer(minimumClockSeconds)) throw error('INVALID_OWNER_CONFIG');
  const read=trustedMethod(store,'read'),write=trustedMethod(store,'compareAndSwap'),
    closeStore=trustedMethod(store,'close');
  if (claimedStores.has(store)) throw error('OWNER_STORE_ALREADY_OWNED');
  claimedStores.add(store);
  let head,current;
  try {
    head=receipt(read());
    current=restoreAccessKeysetLifecycle(config,decode(head.payload),{
      revision:head.revision,sha256:head.sha256,generationFloor:minimumGeneration,
      lastClockFloorSeconds:minimumClockSeconds});
  } catch {
    try { closeSynchronously(closeStore); } catch {}
    throw error('OWNER_RECOVERY_REFUSED');
  }
  let closed=false,halted=false,busy=false,epoch=0,haltReason=null,
    freshPublicationRequired=true,storeCloseAcknowledged=false;
  function diagnostics() {
    return Object.freeze({ownerState:closed?'closed':halted?'halted':'available',busy,haltReason,
      freshPublicationRequired,lastAcknowledgedRevision:head.revision,
      lastAcknowledgedSha256:head.sha256,storeCloseAcknowledged,...noAuthority});
  }
  function deny(reason,detail={}) {
    return Object.freeze({decision:'DENY',reason,...detail,...noAuthority,
      checkpointCommitAcknowledged:false,lastAcknowledgedRevision:head.revision,retrySafe:false});
  }
  function live(generation) { return !closed&&!halted&&epoch===generation; }
  function operate(method,input) {
    if (closed) return deny('OWNER_CLOSED');
    if (halted) return deny('OWNER_HALTED',{haltReason});
    if (busy) return deny('OWNER_BUSY');
    if (head.revision===Number.MAX_SAFE_INTEGER) {
      halted=true;epoch++;haltReason='CHECKPOINT_REVISION_EXHAUSTED';
      return deny('OWNER_HALTED',{haltReason});
    }
    busy=true;
    const generation=epoch;
    let writeAttempted=false;
    try {
      const candidate=current.fork();
      const verdict=method==='status'?candidate.status():candidate[method](input);
      if (!verdict || !['DENY','HOLD','STRUCTURE_REVIEWABLE'].includes(verdict.decision) ||
          ['admissionAuthorized','executionAuthorized','trustedIngressVerified','keyLifecycleRuntimeVerified']
            .some(name=>verdict[name]!==false)) throw error('INVALID_LIFECYCLE_RESULT');
      const next=exported(candidate);
      if (!live(generation)) return deny(closed?'OWNER_CLOSED':'OWNER_HALTED',{haltReason});
      // Even a refusal/status/assessment can advance lastClock. Persist the
      // complete candidate with a new CAS revision before returning that result.
      writeAttempted=true;
      const acknowledged=receipt(write({expectedRevision:head.revision,
        expectedSha256:head.sha256,payload:next.payload}));
      if (acknowledged.storeId!==head.storeId || acknowledged.revision!==head.revision+1 ||
          acknowledged.sha256!==next.sha256 || acknowledged.payload!==next.payload)
        throw error('INVALID_RECEIPT');
      if (!live(generation)) return deny(closed?'OWNER_CLOSED':'OWNER_HALTED',
        {haltReason,checkpointWriteOutcomeUnknown:true});
      // No await, callback or external operation may intervene in this swap.
      current=candidate;head=acknowledged;
      if (method==='publish'&&verdict.decision==='STRUCTURE_REVIEWABLE'&&
          verdict.reason==='KEYSET_PUBLISHED_OFFLINE') freshPublicationRequired=false;
      return Object.freeze({...verdict,...noAuthority,checkpointCommitAcknowledged:true,
        checkpointRevision:head.revision,checkpointSha256:head.sha256,retrySafe:false});
    } catch (cause) {
      if (!closed) { halted=true;epoch++;haltReason=writeAttempted?failureClass(cause):'CHECKPOINT_STAGING_FAILED'; }
      return deny(closed?'OWNER_CLOSED':'OWNER_HALTED',{haltReason,
        checkpointWriteOutcomeUnknown:writeAttempted&&haltReason!=='CHECKPOINT_CONFLICT'});
    } finally { busy=false; }
  }
  function close() {
    if (closed) return diagnostics();
    closed=true;epoch++;current=null;
    try { storeCloseAcknowledged=closeSynchronously(closeStore); } catch { storeCloseAcknowledged=false; }
    return diagnostics();
  }
  return Object.freeze({publish:update=>operate('publish',update),assess:request=>operate('assess',request),
    status:()=>operate('status'),diagnostics,close});
}
