/**
 * Stage 4.6: isolated SQLite fixture with durable approvals and event logs.
 * TEST ONLY. Never imported from src/, never exposed as HTTP/MCP, no network/browser,
 * no user credentials and no real websites. Identity roles are synthetic test fixtures.
 */
import {DatabaseSync} from "node:sqlite";
import {createHash,randomUUID} from "node:crypto";
const digest=s=>createHash("sha256").update(s).digest("hex");
const deny=code=>{const e=new Error(code);e.code=code;throw e};
const validActor=(actor,role)=>actor&&Object.keys(actor).sort().join(",")==="id,role" &&
  actor.role===role && typeof actor.id==="string" && /^fixture-(creator|reviewer)-[a-z0-9-]{1,32}$/.test(actor.id);
const validText=s=>typeof s==="string"&&s.length>0&&s.length<=1200&& !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s);
export class PersistentWritePrototype {
 #db;#now;#disabled=false;
 constructor(filename,{now=()=>Date.now()}={}){
  if(typeof filename!=="string"||filename===":memory:"||!filename.endsWith(".sqlite"))deny("LOCAL_FILE_REQUIRED");
  this.#db=new DatabaseSync(filename);this.#now=now;
  this.#db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=1000;");
  this.#db.exec(`
CREATE TABLE IF NOT EXISTS fixture_fields (
  id TEXT PRIMARY KEY CHECK(id='fixture:title'), value TEXT NOT NULL, revision INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS fixture_proposals (
  id TEXT PRIMARY KEY, field_id TEXT NOT NULL REFERENCES fixture_fields(id),
  creator_id TEXT NOT NULL, approver_id TEXT, content_digest TEXT NOT NULL,
  proposed_value TEXT NOT NULL, previous_value TEXT, base_revision INTEGER NOT NULL,
  applied_revision INTEGER, state TEXT NOT NULL CHECK(state IN
    ('PENDING','APPROVED','EXECUTED','ROLLED_BACK')),
  expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
  request_id TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS fixture_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, proposal_id TEXT NOT NULL REFERENCES fixture_proposals(id),
  kind TEXT NOT NULL, actor_id TEXT NOT NULL, payload_digest TEXT NOT NULL,
  occurred_at INTEGER NOT NULL, previous_hash TEXT NOT NULL, event_hash TEXT NOT NULL);
`);
 }
 close(){this.#db.close()}
 disableWrites(){this.#disabled=true}
 #requireWrite(){if(this.#disabled)deny("KILL_SWITCH")}
 #run(fn){
  this.#db.exec("BEGIN IMMEDIATE");
  try{const result=fn();this.#db.exec("COMMIT");return result}
  catch(e){this.#db.exec("ROLLBACK");throw e}
 }
 #event(id,kind,actor,d){
  const previous=this.#db.prepare("SELECT event_hash FROM fixture_events ORDER BY seq DESC LIMIT 1").get()?.event_hash||"0".repeat(64);
  const time=this.#now();
  const eventHash=digest(JSON.stringify({id,kind,actor,d,time,previous}));
  this.#db.prepare("INSERT INTO fixture_events(proposal_id,kind,actor_id,payload_digest,occurred_at,previous_hash,event_hash) VALUES(?,?,?,?,?,?,?)")
   .run(id,kind,actor,d,time,previous,eventHash);
 }
 seed(value="Original test title"){
  if(!validText(value))deny("INVALID_FIXTURE");
  this.#db.prepare("INSERT OR IGNORE INTO fixture_fields(id,value,revision) VALUES('fixture:title',?,1)").run(value);
 }
 state(){const row=this.#db.prepare("SELECT value,revision FROM fixture_fields WHERE id='fixture:title'").get();if(!row)deny("NO_FIXTURE");return {value:row.value,revision:row.revision}}
 propose(actor,nextValue,{ttlMs=60000}={}){
  this.#requireWrite();
  if(!validActor(actor,"creator")||!validText(nextValue))deny("ACTOR_OR_CHANGE_DENIED");
  if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>300000)deny("INVALID_TTL");
  return this.#run(()=>{
   const field=this.state(),now=this.#now(),id=randomUUID(),contentDigest=digest(nextValue);
   this.#db.prepare("INSERT INTO fixture_proposals(id,field_id,creator_id,content_digest,proposed_value,base_revision,state,expires_at,created_at) VALUES(?,'fixture:title',?,?,?,?,'PENDING',?,?)")
    .run(id,actor.id,contentDigest,nextValue,field.revision,now+ttlMs,now);
   this.#event(id,"PROPOSED",actor.id,contentDigest);
   return {proposalId:id,contentDigest,baseRevision:field.revision,expiresAt:now+ttlMs,state:"PENDING",simulationOnly:true};
  });
 }
 approve(actor,{proposalId,contentDigest}){
  this.#requireWrite();if(!validActor(actor,"reviewer"))deny("ACTOR_DENIED");
  return this.#run(()=>{
   const p=this.#db.prepare("SELECT * FROM fixture_proposals WHERE id=?").get(proposalId);
   if(!p||p.state!=="PENDING")deny("NOT_PENDING");
   if(p.creator_id===actor.id)deny("SEPARATION_OF_DUTIES");
   if(this.#now()>=p.expires_at)deny("EXPIRED");
   if(contentDigest!==p.content_digest)deny("DIGEST_MISMATCH");
   const changes=this.#db.prepare("UPDATE fixture_proposals SET state='APPROVED',approver_id=? WHERE id=? AND state='PENDING'").run(actor.id,proposalId);
   if(changes.changes!==1)deny("APPROVAL_RACE");
   this.#event(proposalId,"APPROVED",actor.id,contentDigest);
   return {state:"APPROVED",proposalId,simulationOnly:true};
  });
 }
 execute(actor,{proposalId,contentDigest,expectedRevision,requestId}){
  this.#requireWrite();if(!validActor(actor,"creator"))deny("ACTOR_DENIED");
  if(typeof requestId!=="string"||!/^fixture-request-[a-z0-9-]{1,40}$/.test(requestId))deny("INVALID_REQUEST");
  return this.#run(()=>{
   const p=this.#db.prepare("SELECT * FROM fixture_proposals WHERE id=?").get(proposalId);
   if(!p||p.state!=="APPROVED"||p.creator_id!==actor.id||!p.approver_id)deny("APPROVAL_REQUIRED_OR_USED");
   if(this.#now()>=p.expires_at)deny("EXPIRED");
   if(p.content_digest!==contentDigest||digest(p.proposed_value)!==contentDigest)deny("DIGEST_MISMATCH");
   const field=this.state();
   if(field.revision!==p.base_revision||field.revision!==expectedRevision)deny("STALE_REVISION");
   const updated=this.#db.prepare("UPDATE fixture_fields SET value=?,revision=revision+1 WHERE id='fixture:title' AND revision=?").run(p.proposed_value,expectedRevision);
   if(updated.changes!==1)deny("STALE_REVISION");
   const grant=this.#db.prepare("UPDATE fixture_proposals SET state='EXECUTED',previous_value=?,applied_revision=?,request_id=? WHERE id=? AND state='APPROVED'")
    .run(field.value,expectedRevision+1,requestId,proposalId);
   if(grant.changes!==1)deny("APPROVAL_REQUIRED_OR_USED");
   this.#event(proposalId,"EXECUTED",actor.id,contentDigest);
   return {state:"EXECUTED",revision:expectedRevision+1,simulationOnly:true};
  });
 }
 rollback(actor,{proposalId,expectedRevision}){
  this.#requireWrite();if(!validActor(actor,"reviewer"))deny("ACTOR_DENIED");
  return this.#run(()=>{
   const p=this.#db.prepare("SELECT * FROM fixture_proposals WHERE id=?").get(proposalId);
   if(!p||p.state!=="EXECUTED"||p.approver_id!==actor.id)deny("ROLLBACK_DENIED");
   if(expectedRevision!==p.applied_revision)deny("STALE_REVISION");
   const updated=this.#db.prepare("UPDATE fixture_fields SET value=?,revision=revision+1 WHERE id='fixture:title' AND revision=?").run(p.previous_value,expectedRevision);
   if(updated.changes!==1)deny("STALE_REVISION");
   this.#db.prepare("UPDATE fixture_proposals SET state='ROLLED_BACK' WHERE id=? AND state='EXECUTED'").run(proposalId);
   this.#event(proposalId,"ROLLED_BACK",actor.id,p.content_digest);
   return {state:"ROLLED_BACK",revision:expectedRevision+1,simulationOnly:true};
  });
 }
 events(){
  return this.#db.prepare("SELECT proposal_id,kind,actor_id,payload_digest,occurred_at,previous_hash,event_hash FROM fixture_events ORDER BY seq").all();
 }
 verifyAudit(){
  let previous="0".repeat(64);
  for(const e of this.events()){
   if(e.previous_hash!==previous||digest(JSON.stringify({id:e.proposal_id,kind:e.kind,actor:e.actor_id,d:e.payload_digest,time:e.occurred_at,previous}))!==e.event_hash)return false;
   previous=e.event_hash;
  }
  return true;
 }
}
