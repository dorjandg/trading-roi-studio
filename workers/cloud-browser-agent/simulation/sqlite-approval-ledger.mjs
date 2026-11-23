// OFFLINE TEST-ONLY SQLite ledger. Node 22 node:sqlite experimental API.
// Never import into a Worker, MCP endpoint or website interaction executor.
import {DatabaseSync} from "node:sqlite";
import {resolve} from "node:path";
const stages=new Set(["beforeInsert","afterInsert","beforeCommit","afterCommit"]);
const grantIdOk=x=>typeof x==="string"&&/^[0-9a-f-]{36}$/.test(x);
const idOk=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
const hashOk=x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
export function createSqliteApprovalLedger(filename,{failAt=null}={}){
 if(typeof filename!=="string"||!filename.startsWith("/")||filename===":memory:"||filename.includes("\0")||!filename.endsWith(".sqlite"))throw Error("Invalid isolated SQLite path");
 if(failAt!==null&&!stages.has(failAt))throw Error("Invalid simulated failure stage");
 const db=new DatabaseSync(resolve(filename));
 db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
 db.exec("CREATE TABLE IF NOT EXISTS approval_audit (grant_id TEXT PRIMARY KEY, principal TEXT NOT NULL, session_id TEXT NOT NULL, action_digest TEXT NOT NULL, origin TEXT NOT NULL, event_type TEXT NOT NULL CHECK(event_type='GRANT_CONSUMED'))");
 let closed=false;
 const ensureOpen=()=>{if(closed)throw Error("Ledger closed");};
 return Object.freeze({
  async reserveAndAudit(event){
   ensureOpen();
   if(!event||!grantIdOk(event.grantId)||!idOk(event.principal)||!idOk(event.sessionId)||!hashOk(event.actionDigest)||
      typeof event.origin!=="string"||!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/.test(event.origin))throw Error("Invalid ledger event");
   let transaction=false;
   try{
    db.exec("BEGIN IMMEDIATE");
    transaction=true;
    if(failAt==="beforeInsert")throw Error("Simulated transaction failure before insert");
    db.prepare("INSERT INTO approval_audit(grant_id,principal,session_id,action_digest,origin,event_type) VALUES(?,?,?,?,?,'GRANT_CONSUMED')")
      .run(event.grantId,event.principal,event.sessionId,event.actionDigest,event.origin);
    if(failAt==="afterInsert"||failAt==="beforeCommit")throw Error("Simulated transaction failure before commit");
    db.exec("COMMIT");
    transaction=false;
    if(failAt==="afterCommit")throw Error("Simulated acknowledgement loss after commit");
    return Object.freeze({auditRecorded:true,executionAllowed:false});
   }catch(e){
    if(transaction)db.exec("ROLLBACK");
    if(e?.code==="ERR_SQLITE_ERROR"&&/UNIQUE constraint failed/.test(e.message))throw Error("Approval replay rejected");
    throw e;
   }
  },
  inspect(grantId){
   ensureOpen();
   if(!grantIdOk(grantId))throw Error("Invalid grant ID");
   const row=db.prepare("SELECT grant_id AS grantId,principal,session_id AS sessionId,action_digest AS actionDigest,origin,event_type AS eventType FROM approval_audit WHERE grant_id=?").get(grantId);
   return Object.freeze({state:row?"COMMITTED":"ABSENT",audit:row?Object.freeze({...row}):null,executionAllowed:false});
  },
  count(){ensureOpen();return Number(db.prepare("SELECT COUNT(*) AS n FROM approval_audit").get().n);},
  close(){if(!closed){closed=true;db.close();}}
 });
}
