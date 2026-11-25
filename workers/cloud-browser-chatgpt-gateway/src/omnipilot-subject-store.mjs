// Isolated D1 adapter contract; NEVER wired to a deployed Worker.
// Only a separately provisioned OMNIPILOT_GRANT_DB may be injected here.
// Do not use OAUTH_KV, FINANCE_DB, or any production database.
import {verifySubjectAudit} from './omnipilot-subject-ledger.mjs';
const deny=(code='SUBJECT_STORE_UNAVAILABLE')=>{throw Object.assign(new Error(code),{code})};
const HASH=/^[a-f0-9]{64}$/,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function assertDatabase(db){
  if(!db||typeof db.prepare!=='function'||typeof db.withSession!=='function')deny();
  return db;
}
const grantSql='SELECT grant_id,subject_key,requested_by_key,approved_by_key,origin,path_prefix,mode,expires_at_ms,max_actions,status,revision,created_at_ms,updated_at_ms,audit_head FROM omnipilot_subject_grants WHERE grant_id=? LIMIT 1';
const eventsSql='SELECT event_id,grant_id,revision,event_type,actor_key,subject_key,target_digest,terms_digest,previous_hash,event_hash,occurred_at_ms FROM omnipilot_subject_grant_audit WHERE grant_id=? ORDER BY revision ASC LIMIT 7';
const activeSql="SELECT grant_id FROM omnipilot_subject_grants WHERE subject_key=? AND origin=? AND status='ACTIVE' LIMIT 1";
const insertSql='INSERT INTO omnipilot_subject_grants (grant_id,subject_key,requested_by_key,approved_by_key,origin,path_prefix,mode,expires_at_ms,max_actions,status,revision,created_at_ms,updated_at_ms,audit_head,last_event_id,last_event_type,last_event_actor_key,last_event_target_digest,last_event_terms_digest,last_event_previous_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
const updateSql='UPDATE omnipilot_subject_grants SET status=?,revision=?,updated_at_ms=?,audit_head=?,approved_by_key=?,last_event_id=?,last_event_type=?,last_event_actor_key=?,last_event_target_digest=?,last_event_terms_digest=?,last_event_previous_hash=? WHERE grant_id=? AND subject_key=? AND revision=? AND audit_head=? AND status=? RETURNING revision';

function primary(db){
  assertDatabase(db);
  const session=db.withSession('first-primary');
  if(!session||typeof session.prepare!=='function')deny();
  return session;
}
function rowToGrant(row){
  return Object.freeze({grantId:row.grant_id,subjectKey:row.subject_key,
    requestedByKey:row.requested_by_key,approvedByKey:row.approved_by_key,
    origin:row.origin,pathPrefix:row.path_prefix,mode:row.mode,
    expiresAtMs:row.expires_at_ms,maxActions:row.max_actions,
    status:row.status,revision:row.revision,createdAtMs:row.created_at_ms,
    updatedAtMs:row.updated_at_ms,auditHead:row.audit_head});
}
const rowToEvent=row=>Object.freeze({
  eventId:row.event_id,grantId:row.grant_id,revision:row.revision,
  type:row.event_type,actorKey:row.actor_key,subjectKey:row.subject_key,
  targetDigest:row.target_digest,termsDigest:row.terms_digest,
  previousHash:row.previous_hash,hash:row.event_hash,
  occurredAtMs:row.occurred_at_ms
});
async function readVerified(session,grantId,auditKey){
  const row=await session.prepare(grantSql).bind(grantId).first();
  if(!row)return null;
  const response=await session.prepare(eventsSql).bind(grantId).all();
  if(!Array.isArray(response?.results)||response.results.length>6)deny('SUBJECT_AUDIT_INVALID');
  const state=Object.freeze({record:rowToGrant(row),
    events:Object.freeze(response.results.map(rowToEvent))});
  if(!await verifySubjectAudit(state,auditKey))deny('SUBJECT_AUDIT_INVALID');
  return state;
}
// Trusted internal calls only, never expose this audit state via MCP.
export async function readVerifiedGrantById(db,grantId,auditKey){
  if(!UUID.test(grantId||''))deny('SUBJECT_GRANT_ID_INVALID');
  try{return await readVerified(primary(db),grantId,auditKey)}
  catch(e){if(e?.code)throw e;deny()}
}
// The authorization caller loads current primary state for each dispatch.
// In-flight actions need a separate cancellation fence before claiming instant
// abort after revocation. Never cache this record in KV or a global variable.
export async function loadFreshActiveSubjectGrant(db,{subjectKey,origin},auditKey){
  if(!HASH.test(subjectKey||'')||typeof origin!=='string'||origin.length>200)
    deny('SUBJECT_GRANT_IDENTITY_INVALID');
  try{
    const session=primary(db);
    const row=await session.prepare(activeSql).bind(subjectKey,origin).first();
    if(!row)return null;
    const state=await readVerified(session,row.grant_id,auditKey);
    if(!state||state.record.status!=='ACTIVE'||
      state.record.subjectKey!==subjectKey||state.record.origin!==origin)
      deny('SUBJECT_AUDIT_INVALID');
    return state.record;
  }catch(e){if(e?.code)throw e;deny()}
}
export async function insertPendingSubjectGrant(db,state,auditKey){
  assertDatabase(db);
  if(!await verifySubjectAudit(state,auditKey)||
    state.record.status!=='PENDING'||state.record.revision!==1)deny('SUBJECT_AUDIT_INVALID');
  const r=state.record,e=state.events[0];
  try{
    await db.prepare(insertSql).bind(
      r.grantId,r.subjectKey,r.requestedByKey,r.approvedByKey,r.origin,r.pathPrefix,
      r.mode,r.expiresAtMs,r.maxActions,r.status,r.revision,r.createdAtMs,r.updatedAtMs,
      r.auditHead,e.eventId,e.type,e.actorKey,e.targetDigest,e.termsDigest,e.previousHash
    ).run();
  }catch{deny('GRANT_COMMIT_UNCERTAIN_NO_AUTO_RETRY')}
  try{
    const confirmed=await readVerifiedGrantById(db,r.grantId,auditKey);
    if(!confirmed||confirmed.record.auditHead!==r.auditHead)
      deny('GRANT_COMMIT_UNCERTAIN_NO_AUTO_RETRY');
    return Object.freeze({grantId:r.grantId,revision:r.revision,
      status:'PENDING',recorded:true});
  }catch{deny('GRANT_COMMIT_UNCERTAIN_NO_AUTO_RETRY')}
}
export async function commitSubjectGrantTransition(db,before,after,auditKey){
  assertDatabase(db);
  if(!await verifySubjectAudit(before,auditKey)||
    !await verifySubjectAudit(after,auditKey)||
    before.record.grantId!==after.record.grantId||
    before.record.subjectKey!==after.record.subjectKey||
    before.record.origin!==after.record.origin||
    before.record.pathPrefix!==after.record.pathPrefix||
    before.record.mode!==after.record.mode||
    before.record.expiresAtMs!==after.record.expiresAtMs||
    before.record.maxActions!==after.record.maxActions||
    before.record.revision+1!==after.record.revision||
    before.record.auditHead!==after.events.at(-1).previousHash||
    after.events.length!==before.events.length+1)
      deny('SUBJECT_AUDIT_INVALID');
  const b=before.record,r=after.record,e=after.events.at(-1);
  let updated;
  try{
    updated=await db.prepare(updateSql).bind(
      r.status,r.revision,r.updatedAtMs,r.auditHead,r.approvedByKey,
      e.eventId,e.type,e.actorKey,e.targetDigest,e.termsDigest,e.previousHash,
      b.grantId,b.subjectKey,b.revision,b.auditHead,b.status
    ).first();
  }catch{deny('GRANT_COMMIT_UNCERTAIN_NO_AUTO_RETRY')}
  if(!updated)deny('STALE_GRANT_REVISION');
  try{
    const confirmed=await readVerifiedGrantById(db,r.grantId,auditKey);
    if(!confirmed||confirmed.record.revision!==r.revision||
      confirmed.record.auditHead!==r.auditHead)
      deny('GRANT_COMMIT_UNCERTAIN_NO_AUTO_RETRY');
    return Object.freeze({grantId:r.grantId,revision:r.revision,
      status:r.status,recorded:true});
  }catch{deny('GRANT_COMMIT_UNCERTAIN_NO_AUTO_RETRY')}
}
