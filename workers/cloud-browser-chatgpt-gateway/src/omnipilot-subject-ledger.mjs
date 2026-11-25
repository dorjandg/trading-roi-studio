// OmniPilot isolated per-subject grant lifecycle and redact-only audit events.
// Pure state transitions + WebCrypto; no D1 access, no OAuth endpoint, no MCP
// action registration. Persistence must use atomic expected-revision CAS.
import {constrainSubjectGrant} from './omnipilot-subject-authority.mjs';
const HEX=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ZERO='0'.repeat(64);
const fail=(code='GRANT_TRANSITION_DENIED')=>{throw Object.assign(new Error(code),{code})};
const safeTime=x=>Number.isSafeInteger(x)&&x>=0;
const validKey=key=>key&&key.algorithm?.name==='HMAC'&&key.usages?.includes('sign');
const hex=buffer=>Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');
async function mac(key,message){
  if(!validKey(key))fail('AUDIT_KEY_UNAVAILABLE');
  try{return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)))}
  catch{fail('AUDIT_SIGNING_FAILED')}
}
function validIdentity(id){if(!HEX.test(id||''))fail('GRANT_IDENTITY_INVALID');return id}
function makeId(idFactory){
  if(typeof idFactory!=='function')fail('GRANT_IDENTIFIER_UNAVAILABLE');
  const value=idFactory();
  if(typeof value!=='string'||!UUID.test(value))fail('GRANT_IDENTIFIER_INVALID');
  return value;
}
const canonicalEvent=e=>JSON.stringify([
  'omnipilot:grant-audit:v1',e.eventId,e.grantId,e.revision,
  e.type,e.actorKey,e.subjectKey,e.targetDigest,e.occurredAtMs,e.previousHash
]);
async function newEvent({type,record,actorKey,revision,previousHash,nowMs,auditKey,idFactory}){
  if(!['REQUESTED','APPROVED','DENIED','REVOKED'].includes(type)
    ||!safeTime(nowMs)||!Number.isSafeInteger(revision)||revision<1
    ||!HEX.test(previousHash))fail();
  const targetDigest=await mac(auditKey,
    'omnipilot:grant-target:v1\0'+record.origin+'\0'+record.pathPrefix);
  const event={eventId:makeId(idFactory),grantId:record.grantId,revision,
    type,actorKey:validIdentity(actorKey),subjectKey:validIdentity(record.subjectKey),
    targetDigest,occurredAtMs:nowMs,previousHash};
  const hash=await mac(auditKey,canonicalEvent(event));
  return Object.freeze({...event,hash});
}
const freezeState=(record,events)=>Object.freeze({
  record:Object.freeze({...record}),
  events:Object.freeze([...events])
});
export async function createSubjectProposal({
  subjectKey,requesterKey,candidate,operatorPolicy,nowMs=Date.now(),
  auditKey,idFactory=()=>crypto.randomUUID()
}){
  validIdentity(subjectKey);validIdentity(requesterKey);
  if(requesterKey!==subjectKey||!safeTime(nowMs))fail();
  const grant=constrainSubjectGrant(candidate,operatorPolicy,nowMs);
  const grantId=makeId(idFactory);
  const record={grantId,subjectKey,requestedByKey:requesterKey,approvedByKey:null,
    ...grant,status:'PENDING',revision:1,createdAtMs:nowMs,
    updatedAtMs:nowMs,auditHead:ZERO};
  const event=await newEvent({type:'REQUESTED',record,actorKey:requesterKey,
    revision:1,previousHash:ZERO,nowMs,auditKey,idFactory});
  return freezeState({...record,auditHead:event.hash},[event]);
}
export async function verifySubjectAudit(state,auditKey){
  if(!state||typeof state!=='object'||!state.record||
    !Array.isArray(state.events)||!state.events.length||
    state.events.length>6||!validKey(auditKey))return false;
  const record=state.record;
  if(!UUID.test(record.grantId||'')||!HEX.test(record.subjectKey||'')||
    !Number.isSafeInteger(record.revision)||record.revision!==state.events.length||
    !HEX.test(record.auditHead||''))return false;
  let previous=ZERO,types=[];
  const expectedTarget=await mac(auditKey,
    'omnipilot:grant-target:v1\0'+record.origin+'\0'+record.pathPrefix);
  for(let i=0;i<state.events.length;i++){
    const e=state.events[i];
    if(!e||!UUID.test(e.eventId||'')||e.grantId!==record.grantId||
      e.revision!==i+1||e.subjectKey!==record.subjectKey||
      e.targetDigest!==expectedTarget||e.previousHash!==previous||
      !HEX.test(e.actorKey||'')||!HEX.test(e.hash||'')||
      !safeTime(e.occurredAtMs)||!['REQUESTED','APPROVED','DENIED','REVOKED'].includes(e.type)||
      i===0&&e.type!=='REQUESTED'||i>0&&e.type==='REQUESTED'||
      i>0&&e.occurredAtMs<state.events[i-1].occurredAtMs)return false;
    const calculated=await mac(auditKey,canonicalEvent(e));
    if(calculated!==e.hash)return false;
    previous=e.hash;types.push(e.type);
  }
  if(previous!==record.auditHead||
    types.filter(x=>x==='APPROVED').length>1||
    types.filter(x=>x==='REVOKED').length>1||
    types.filter(x=>x==='DENIED').length>1)return false;
  const status=types.at(-1)==='REQUESTED'?'PENDING':
    types.at(-1)==='APPROVED'?'ACTIVE':
    types.at(-1)==='REVOKED'?'REVOKED':'DENIED';
  if(record.status!==status)return false;
  if(types.includes('DENIED')&&types.includes('APPROVED'))return false;
  if(types.includes('DENIED')&&types.includes('REVOKED'))return false;
  if(types.includes('REVOKED')&&types.at(-1)!=='REVOKED')return false;
  if(record.updatedAtMs!==state.events.at(-1).occurredAtMs)return false;
  return true;
}
export async function transitionSubjectGrant({
  state,operation,actorKey,operatorKey,expectedRevision,
  operatorPolicy,nowMs=Date.now(),auditKey,idFactory=()=>crypto.randomUUID()
}){
  validIdentity(actorKey);validIdentity(operatorKey);
  if(!safeTime(nowMs)||!['approve','deny','revoke'].includes(operation)||
    !await verifySubjectAudit(state,auditKey))fail();
  const current=state.record;
  const operator=actorKey===operatorKey;
  const owner=actorKey===current.subjectKey;
  if(operation==='approve'||operation==='deny'){
    if(!operator||owner)fail('INDEPENDENT_OPERATOR_REQUIRED');
  }else if(!operator&&!owner)fail('GRANT_REVOKER_UNAUTHORIZED');
  if(operation==='revoke'&&current.status==='REVOKED'){
    // Idempotent safe retry: no second audit event or revision increment.
    return state;
  }
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==current.revision)
    fail('STALE_GRANT_REVISION');
  if(operation!=='revoke'&&current.status!=='PENDING')fail();
  if(operation==='revoke'&&!['PENDING','ACTIVE'].includes(current.status))fail();
  if(nowMs<current.updatedAtMs)fail();
  if(operation==='approve'){
    if(nowMs>=current.expiresAtMs)fail('GRANT_EXPIRED');
    // Operator approval never overrides the current global site policy.
    constrainSubjectGrant({
      origin:current.origin,mode:current.mode,pathPrefix:current.pathPrefix,
      expiresAt:new Date(current.expiresAtMs).toISOString(),
      maxActions:current.maxActions
    },operatorPolicy,nowMs);
  }
  const nextStatus=operation==='approve'?'ACTIVE':
    operation==='deny'?'DENIED':'REVOKED';
  const event=await newEvent({
    type:nextStatus==='ACTIVE'?'APPROVED':nextStatus==='DENIED'?'DENIED':'REVOKED',
    record:current,actorKey,revision:current.revision+1,
    previousHash:current.auditHead,nowMs,auditKey,idFactory
  });
  const updated={...current,status:nextStatus,revision:current.revision+1,
    updatedAtMs:nowMs,auditHead:event.hash,
    approvedByKey:operation==='approve'?actorKey:current.approvedByKey};
  return freezeState(updated,[...state.events,event]);
}
