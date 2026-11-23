// DESIGN-ONLY D1-compatible adapter. No Worker/MCP imports or website actions.
// D1 batch must be atomic. A single primary-key row binds consumption to its audit.
const id=x=>typeof x==="string"&&/^[0-9a-f-]{36}$/.test(x);
const name=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
const hash=x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
const origin=x=>typeof x==="string"&&/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/.test(x);
export const D1_APPROVAL_LEDGER_SCHEMA=`CREATE TABLE IF NOT EXISTS isolated_grant_audit (
 grant_id TEXT PRIMARY KEY NOT NULL,
 principal TEXT NOT NULL,
 session_id TEXT NOT NULL,
 action_digest TEXT NOT NULL,
 origin TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type = 'GRANT_CONSUMED')
);`;
export function createD1ApprovalLedger(db){
 if(!db||typeof db.prepare!=="function"||typeof db.batch!=="function")throw Error("Isolated D1 binding required");
 return Object.freeze({
  async reserveAndAudit(event){
   if(!event||!id(event.grantId)||!name(event.principal)||!name(event.sessionId)||!hash(event.actionDigest)||!origin(event.origin))
    throw Error("Invalid ledger event");
   // No INSERT OR IGNORE: uniqueness conflict must reject replay, not return success.
   const statement=db.prepare("INSERT INTO isolated_grant_audit (grant_id,principal,session_id,action_digest,origin,event_type) VALUES (?,?,?,?,?,'GRANT_CONSUMED')")
     .bind(event.grantId,event.principal,event.sessionId,event.actionDigest,event.origin);
   try{await db.batch([statement]);}catch(e){
    if(/UNIQUE constraint failed|PRIMARY KEY constraint failed/i.test(String(e?.message)))throw Error("Approval replay rejected");
    throw Error("Isolated D1 audit transaction unavailable");
   }
   // Never claim success if the commit succeeded but the acknowledgement/read fails.
   let row;
   try{row=await db.prepare("SELECT grant_id,principal,session_id,action_digest,origin,event_type FROM isolated_grant_audit WHERE grant_id=?").bind(event.grantId).first();}
   catch{throw Error("Isolated D1 audit verification unavailable");}
   if(!row||row.grant_id!==event.grantId||row.principal!==event.principal||
      row.session_id!==event.sessionId||row.action_digest!==event.actionDigest||
      row.origin!==event.origin||row.event_type!=="GRANT_CONSUMED")
    throw Error("Isolated D1 audit verification failed");
   return Object.freeze({auditRecorded:true,grantConsumed:true,executionAllowed:false,productionWritesAllowed:false});
  }
 });
}
