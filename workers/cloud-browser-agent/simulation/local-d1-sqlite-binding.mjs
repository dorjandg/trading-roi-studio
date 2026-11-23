// Local SQLite-backed D1 API subset for disposable integration tests only.
// No network, Wrangler, remote D1, Worker/MCP imports or browser actions.
import {DatabaseSync} from "node:sqlite";
import {resolve} from "node:path";
export function createDisposableLocalD1Binding(filename){
 if(typeof filename!=="string"||!filename.startsWith("/")||!filename.endsWith(".sqlite")||filename.includes("\0"))throw Error("Absolute disposable SQLite path required");
 const db=new DatabaseSync(resolve(filename));
 db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000");
 let closed=false;
 const guard=()=>{if(closed)throw Error("Disposable database closed");};
 const prepare=sql=>{
  guard();
  if(typeof sql!=="string"||!/^\s*(INSERT INTO isolated_grant_audit|SELECT grant_id,principal,session_id,action_digest,origin,event_type FROM isolated_grant_audit)/i.test(sql))throw Error("SQL outside isolated ledger denied");
  return Object.freeze({bind(...params){
   return Object.freeze({sql,params,async first(){
    guard();
    if(!/^\s*SELECT/i.test(sql))throw Error("SELECT required");
    return db.prepare(sql).get(...params)??null;
   }});
  }});
 };
 return Object.freeze({
  async exec(sql){guard();if(typeof sql!=="string"||!/^CREATE TABLE IF NOT EXISTS isolated_grant_audit\s*\(/.test(sql.trim()))throw Error("Schema operation denied");db.exec(sql);},
  prepare,
  async batch(statements){
   guard();
   if(!Array.isArray(statements)||statements.length!==1||!statements[0]||!/^\s*INSERT INTO isolated_grant_audit/i.test(statements[0].sql))throw Error("Only one isolated audit insert allowed");
   let started=false;
   try{
    db.exec("BEGIN IMMEDIATE");started=true;
    const s=statements[0];
    db.prepare(s.sql).run(...s.params);
    db.exec("COMMIT");started=false;
    return [{success:true}];
   }catch(e){if(started)db.exec("ROLLBACK");throw e;}
  },
  close(){if(!closed){closed=true;db.close();}}
 });
}
