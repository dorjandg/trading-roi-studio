import test from "node:test";
import assert from "node:assert/strict";
import {createD1ApprovalLedger,D1_APPROVAL_LEDGER_SCHEMA} from "../simulation/d1-approval-ledger.mjs";
import {createIsolatedGrantIssuer,createIsolatedGrantVerifier} from "../simulation/isolated-approval-grants.mjs";
const key="test-only-d1-grant-signing-key-0123456789";
const now=1700000000000;
const context={principal:"test-user",sessionId:"session-1",actionDigest:"a".repeat(64),origin:"https://example.test"};
function fixture(){
 const rows=new Map();let fail=null;
 const db={
  prepare(sql){
   return {bind(...args){return {
    async first(){
     if(fail==="read")throw Error("read outage");
     if(!sql.startsWith("SELECT"))throw Error("unexpected query");
     return rows.get(args[0])??null;
    },
    statement:{sql,args}
   };}};
  },
  async batch(statements){
   if(fail==="before")throw Error("database outage");
   if(statements.length!==1)throw Error("expected one atomic insert");
   const {sql,args}=statements[0].statement;
   if(!sql.startsWith("INSERT INTO isolated_grant_audit"))throw Error("unexpected SQL");
   if(rows.has(args[0]))throw Error("UNIQUE constraint failed: isolated_grant_audit.grant_id");
   rows.set(args[0],{grant_id:args[0],principal:args[1],session_id:args[2],action_digest:args[3],origin:args[4],event_type:"GRANT_CONSUMED"});
   if(fail==="after")throw Error("lost commit acknowledgement");
  }
 };
 const grant=createIsolatedGrantIssuer(key).issue({...context,expiresAt:now+10000},now);
 return {rows,db,grant,setFailure:x=>{fail=x;}};
}
const verifier=db=>createIsolatedGrantVerifier(key,createD1ApprovalLedger(db));
test("D1 design uses unique grant primary key and one audit-consumption row",()=>{
 assert.match(D1_APPROVAL_LEDGER_SCHEMA,/grant_id TEXT PRIMARY KEY/);
 assert.match(D1_APPROVAL_LEDGER_SCHEMA,/CHECK\(event_type = 'GRANT_CONSUMED'\)/);
});
test("D1 adapter verifies stored audit and never grants execution",async()=>{
 const f=fixture();
 const result=await verifier(f.db).verifyAndRecord(f.grant,context,now);
 assert.equal(result.executionAllowed,false);
 assert.equal(result.productionWritesAllowed,false);
 assert.equal(f.rows.size,1);
});
test("D1 concurrent replay is rejected with one committed row",async()=>{
 const f=fixture();
 const outcomes=await Promise.allSettled([verifier(f.db).verifyAndRecord(f.grant,context,now),verifier(f.db).verifyAndRecord(f.grant,context,now)]);
 assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
 assert.equal(f.rows.size,1);
});
test("D1 outage before commit fails closed and can retry safely",async()=>{
 const f=fixture();f.setFailure("before");
 await assert.rejects(verifier(f.db).verifyAndRecord(f.grant,context,now),/transaction unavailable/);
 assert.equal(f.rows.size,0);
 f.setFailure(null);
 assert.equal((await verifier(f.db).verifyAndRecord(f.grant,context,now)).executionAllowed,false);
});
test("D1 lost commit acknowledgement cannot replay grant",async()=>{
 const f=fixture();f.setFailure("after");
 await assert.rejects(verifier(f.db).verifyAndRecord(f.grant,context,now),/transaction unavailable/);
 assert.equal(f.rows.size,1);
 f.setFailure(null);
 await assert.rejects(verifier(f.db).verifyAndRecord(f.grant,context,now),/replay/);
});
test("D1 read outage after commit never reports verified audit",async()=>{
 const f=fixture();f.setFailure("read");
 await assert.rejects(verifier(f.db).verifyAndRecord(f.grant,context,now),/verification unavailable/);
 assert.equal(f.rows.size,1);
 f.setFailure(null);
 await assert.rejects(verifier(f.db).verifyAndRecord(f.grant,context,now),/replay/);
});
test("D1 malformed event and missing binding fail closed",async()=>{
 assert.throws(()=>createD1ApprovalLedger({}),/binding required/);
 const f=fixture();
 await assert.rejects(createD1ApprovalLedger(f.db).reserveAndAudit({grantId:"../bad"}),/Invalid ledger event/);
 assert.equal(f.rows.size,0);
});
