import test from "node:test";
import assert from "node:assert/strict";
import {createD1ApprovalLedger,D1_APPROVAL_LEDGER_SCHEMA} from "../simulation/d1-approval-ledger.mjs";
// D1-shaped contract tests only: these do NOT connect to Cloudflare D1.
const event=Object.freeze({grantId:"12345678-1234-4234-8234-123456789abc",principal:"user-1",sessionId:"session-1",actionDigest:"f".repeat(64),origin:"https://example.test"});
function fake({batchFailure=null,readFailure=false,mutateRow=null}={}){
 const rows=new Map();
 const db={
  prepare(sql){return {bind(...args){return {
   statement:{sql,args},
   async first(){
    if(readFailure)throw Error("read unavailable");
    const row=rows.get(args[0])??null;
    return row&&mutateRow?mutateRow({...row}):row;
   }
  };}};},
  async batch(statements){
   if(batchFailure==="before")throw Error("network unavailable");
   if(statements.length!==1)throw Error("unexpected batch");
   const args=statements[0].statement.args;
   if(rows.has(args[0]))throw Error("UNIQUE constraint failed");
   rows.set(args[0],{grant_id:args[0],principal:args[1],session_id:args[2],action_digest:args[3],origin:args[4],event_type:"GRANT_CONSUMED"});
   if(batchFailure==="after")throw Error("acknowledgement unavailable");
  }
 };
 return {db,rows};
}
test("schema is a single consumption and audit record with primary-key uniqueness",()=>{
 assert.match(D1_APPROVAL_LEDGER_SCHEMA,/grant_id TEXT PRIMARY KEY NOT NULL/);
 assert.match(D1_APPROVAL_LEDGER_SCHEMA,/CHECK\(event_type = 'GRANT_CONSUMED'\)/);
});
test("failed batch before commit leaves no audit and never authorizes execution",async()=>{
 const f=fake({batchFailure:"before"});
 await assert.rejects(createD1ApprovalLedger(f.db).reserveAndAudit(event),/transaction unavailable/);
 assert.equal(f.rows.size,0);
});
test("ambiguous acknowledgement after commit remains fail-closed",async()=>{
 const f=fake({batchFailure:"after"});
 await assert.rejects(createD1ApprovalLedger(f.db).reserveAndAudit(event),/transaction unavailable/);
 assert.equal(f.rows.size,1);
 await assert.rejects(createD1ApprovalLedger(f.db).reserveAndAudit(event),/replay/);
});
test("audit read failure after committed batch never reports success",async()=>{
 const f=fake({readFailure:true});
 await assert.rejects(createD1ApprovalLedger(f.db).reserveAndAudit(event),/verification unavailable/);
 assert.equal(f.rows.size,1);
});
for(const field of ["grant_id","principal","session_id","action_digest","origin","event_type"]){
 test("mismatched stored "+field+" fails audit verification",async()=>{
  const f=fake({mutateRow:row=>({...row,[field]:"tampered"})});
  await assert.rejects(createD1ApprovalLedger(f.db).reserveAndAudit(event),/verification failed/);
  assert.equal(f.rows.size,1);
 });
}
test("untrusted event with missing or malformed scope is rejected before DB call",async()=>{
 const f=fake();
 for(const altered of [{...event,principal:""},{...event,origin:"http://example.test"},{...event,actionDigest:"abc"},{...event,grantId:"../escape"}]){
  await assert.rejects(createD1ApprovalLedger(f.db).reserveAndAudit(altered),/Invalid ledger event/);
 }
 assert.equal(f.rows.size,0);
});
