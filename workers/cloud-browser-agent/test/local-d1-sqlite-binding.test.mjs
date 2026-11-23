import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createDisposableLocalD1Binding} from "../simulation/local-d1-sqlite-binding.mjs";
import {runDisposableD1Acceptance} from "../simulation/disposable-d1-acceptance.mjs";
import {D1_APPROVAL_LEDGER_SCHEMA,createD1ApprovalLedger} from "../simulation/d1-approval-ledger.mjs";
const event={grantId:"22222222-2222-4222-8222-222222222222",principal:"local-user",sessionId:"local-session",actionDigest:"b".repeat(64),origin:"https://example.test"};
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),"api1-d1-local-"));
 const filename=join(dir,"only-disposable.sqlite");
 try{await fn(filename);}finally{await rm(dir,{recursive:true,force:true});}
}
test("acceptance contract executes against actual disposable SQLite database",()=>fixture(async filename=>{
 const db=createDisposableLocalD1Binding(filename);
 try{
  const result=await runDisposableD1Acceptance(db);
  assert.equal(result.passed,true);
  assert.equal(result.executionAllowed,false);
 }finally{db.close();}
}));
test("separate SQLite-backed D1 bindings reject concurrent replay and persist audit",()=>fixture(async filename=>{
 const a=createDisposableLocalD1Binding(filename),b=createDisposableLocalD1Binding(filename);
 try{
  await a.exec(D1_APPROVAL_LEDGER_SCHEMA);
  const attempts=await Promise.allSettled([createD1ApprovalLedger(a).reserveAndAudit(event),createD1ApprovalLedger(b).reserveAndAudit(event)]);
  assert.equal(attempts.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(attempts.filter(x=>x.status==="rejected").length,1);
 }finally{a.close();b.close();}
 const reopened=createDisposableLocalD1Binding(filename);
 try{
  await assert.rejects(createD1ApprovalLedger(reopened).reserveAndAudit(event),/replay/);
 }finally{reopened.close();}
}));
test("disposable adapter rejects unrelated SQL and malformed batch",()=>fixture(async filename=>{
 const db=createDisposableLocalD1Binding(filename);
 try{
  await assert.rejects(db.exec("DROP TABLE isolated_grant_audit"),/denied/);
  assert.throws(()=>db.prepare("SELECT * FROM users"),/denied/);
  await assert.rejects(db.batch([]),/Only one isolated audit insert/);
 }finally{db.close();}
}));
