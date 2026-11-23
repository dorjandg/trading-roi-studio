import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createSqliteApprovalLedger} from "../simulation/sqlite-approval-ledger.mjs";
import {createIsolatedGrantIssuer,createIsolatedGrantVerifier} from "../simulation/isolated-approval-grants.mjs";
const key="offline-only-test-signing-key-0123456789-abc";
const now=1700000000000;
const context={principal:"test-user",sessionId:"session-1",actionDigest:"a".repeat(64),origin:"https://example.test"};
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),"api1-sqlite-"));
 const filename=join(dir,"audit.sqlite");
 const grant=createIsolatedGrantIssuer(key).issue({...context,expiresAt:now+10000},now);
 try{await fn(filename,grant);}finally{await rm(dir,{recursive:true,force:true});}
}
const verifier=ledger=>createIsolatedGrantVerifier(key,ledger);
test("transactional audit survives reopen and replay is rejected",()=>fixture(async(filename,grant)=>{
 const ledger=createSqliteApprovalLedger(filename);
 try{
  assert.equal((await verifier(ledger).verifyAndRecord(grant,context,now)).executionAllowed,false);
  assert.equal(ledger.inspect(grant.payload.grantId).state,"COMMITTED");
 }finally{ledger.close();}
 const reopened=createSqliteApprovalLedger(filename);
 try{
  assert.equal(reopened.count(),1);
  assert.equal(reopened.inspect(grant.payload.grantId).audit.principal,"test-user");
  await assert.rejects(verifier(reopened).verifyAndRecord(grant,context,now),/replay/);
 }finally{reopened.close();}
}));
test("two independent database connections cannot consume same grant twice",()=>fixture(async(filename,grant)=>{
 const first=createSqliteApprovalLedger(filename),second=createSqliteApprovalLedger(filename);
 try{
  const outcomes=await Promise.allSettled([verifier(first).verifyAndRecord(grant,context,now),verifier(second).verifyAndRecord(grant,context,now)]);
  assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
  assert.equal(first.count(),1);
  assert.equal(second.count(),1);
 }finally{first.close();second.close();}
}));
for(const stage of ["beforeInsert","afterInsert","beforeCommit"]){
 test("transaction rollback on "+stage+" permits a later clean audit",()=>fixture(async(filename,grant)=>{
  const failing=createSqliteApprovalLedger(filename,{failAt:stage});
  try{
   await assert.rejects(verifier(failing).verifyAndRecord(grant,context,now),/Simulated/);
   assert.equal(failing.count(),0);
  }finally{failing.close();}
  const healthy=createSqliteApprovalLedger(filename);
  try{
   assert.equal((await verifier(healthy).verifyAndRecord(grant,context,now)).executionAllowed,false);
   assert.equal(healthy.count(),1);
  }finally{healthy.close();}
 }));
}
test("lost acknowledgement after COMMIT never permits replay",()=>fixture(async(filename,grant)=>{
 const uncertain=createSqliteApprovalLedger(filename,{failAt:"afterCommit"});
 try{await assert.rejects(verifier(uncertain).verifyAndRecord(grant,context,now),/acknowledgement/);}finally{uncertain.close();}
 const reopened=createSqliteApprovalLedger(filename);
 try{
  assert.equal(reopened.inspect(grant.payload.grantId).state,"COMMITTED");
  await assert.rejects(verifier(reopened).verifyAndRecord(grant,context,now),/replay/);
  assert.equal(reopened.count(),1);
 }finally{reopened.close();}
}));
test("invalid IDs and ledger input fail closed",()=>fixture(async(filename)=>{
 const ledger=createSqliteApprovalLedger(filename);
 try{
  assert.throws(()=>ledger.inspect("../escape"),/Invalid grant ID/);
  await assert.rejects(ledger.reserveAndAudit({grantId:"../escape"}),/Invalid ledger event/);
  assert.equal(ledger.count(),0);
 }finally{ledger.close();}
 assert.throws(()=>createSqliteApprovalLedger(":memory:"),/Invalid isolated SQLite path/);
}));
