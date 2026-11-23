import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createFileApprovalLedger} from "../simulation/file-approval-ledger.mjs";
import {createIsolatedGrantIssuer,createIsolatedGrantVerifier} from "../simulation/isolated-approval-grants.mjs";
const key="test-only-signing-key-for-ledger-0123456789";
const now=1700000000000;
const context={principal:"test-user",sessionId:"session-1",actionDigest:"b".repeat(64),origin:"https://example.test"};
async function fixture(fn){
 const root=await mkdtemp(join(tmpdir(),"api1-ledger-"));
 try{
  const grant=createIsolatedGrantIssuer(key).issue({...context,expiresAt:now+10000},now);
  await fn(root,grant);
 }finally{await rm(root,{recursive:true,force:true});}
}
test("file ledger retains committed audit across reconstructed instances",async()=>fixture(async(root,grant)=>{
 const ledger=createFileApprovalLedger(root);
 const result=await createIsolatedGrantVerifier(key,ledger).verifyAndRecord(grant,context,now);
 assert.equal(result.executionAllowed,false);
 const reopened=createFileApprovalLedger(root);
 const state=await reopened.inspect(grant.payload.grantId);
 assert.equal(state.state,"COMMITTED");
 assert.equal(state.audit.principal,context.principal);
 assert.equal(state.executionAllowed,false);
 await assert.rejects(createIsolatedGrantVerifier(key,reopened).verifyAndRecord(grant,context,now),/replay/);
}));
test("independent ledgers race for one grant, only one commits",async()=>fixture(async(root,grant)=>{
 const a=createIsolatedGrantVerifier(key,createFileApprovalLedger(root));
 const b=createIsolatedGrantVerifier(key,createFileApprovalLedger(root));
 const results=await Promise.allSettled([a.verifyAndRecord(grant,context,now),b.verifyAndRecord(grant,context,now)]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 assert.equal(results.filter(r=>r.status==="rejected").length,1);
 assert.equal((await createFileApprovalLedger(root).listIds()).length,1);
}));
for(const stage of ["afterReserve","afterAuditWrite","afterCommit"]){
 test("failure "+stage+" never allows replay or execution",async()=>fixture(async(root,grant)=>{
  const failing=createIsolatedGrantVerifier(key,createFileApprovalLedger(root,{failAt:stage}));
  await assert.rejects(failing.verifyAndRecord(grant,context,now),/Simulated/);
  const reopened=createFileApprovalLedger(root);
  const state=await reopened.inspect(grant.payload.grantId);
  assert.equal(state.state,stage==="afterCommit"?"COMMITTED":"QUARANTINED");
  assert.equal(state.executionAllowed,false);
  await assert.rejects(createIsolatedGrantVerifier(key,reopened).verifyAndRecord(grant,context,now),/replay|uncertain/);
 }));
}
test("invalid grant IDs cannot escape ledger directory",async()=>fixture(async(root)=>{
 const ledger=createFileApprovalLedger(root);
 await assert.rejects(ledger.inspect("../escape"),/Invalid grant ID/);
 await assert.rejects(ledger.reserveAndAudit({grantId:"../escape"}),/Invalid ledger event/);
 assert.deepEqual(await ledger.listIds(),[]);
}));
