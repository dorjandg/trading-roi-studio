import test from "node:test";
import assert from "node:assert/strict";
import {createIsolatedGrantIssuer,createIsolatedGrantVerifier,createSimulatedAtomicAuditStore} from "../simulation/isolated-approval-grants.mjs";
const key="test-only-secret-not-a-real-credential-0123456789";
const now=1700000000000;
const context={principal:"test-user",sessionId:"session-1",actionDigest:"a".repeat(64),origin:"https://example.test"};
function setup(){
 const store=createSimulatedAtomicAuditStore();
 const issuer=createIsolatedGrantIssuer(key);
 const verifier=createIsolatedGrantVerifier(key,store);
 const grant=issuer.issue({...context,expiresAt:now+10000},now);
 return {store,issuer,verifier,grant};
}
test("signed scoped grant records audit but never permits execution",async()=>{
 const {store,verifier,grant}=setup();
 const result=await verifier.verifyAndRecord(grant,context,now);
 assert.deepEqual(result,{auditRecorded:true,grantConsumed:true,executionAllowed:false,productionWritesAllowed:false});
 assert.equal(store.records().length,1);
 assert.equal(Object.isFrozen(store.records()[0]),true);
 assert.equal(JSON.stringify(store.records()).includes(key),false);
});
test("replay is rejected, including simultaneous verification",async()=>{
 const {store,verifier,grant}=setup();
 const outcomes=await Promise.allSettled([verifier.verifyAndRecord(grant,context,now),verifier.verifyAndRecord(grant,context,now)]);
 assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
 assert.equal(store.records().length,1);
 await assert.rejects(verifier.verifyAndRecord(grant,context,now),/replay/);
});
test("principal, session, action, origin and expiry cannot be substituted",async()=>{
 const {store,verifier,grant}=setup();
 for(const [field,value] of [["principal","another"],["sessionId","other"],["actionDigest","b".repeat(64)],["origin","https://other.test"]]){
  await assert.rejects(verifier.verifyAndRecord(grant,{...context,[field]:value},now),/scope/);
 }
 await assert.rejects(verifier.verifyAndRecord(grant,context,now+10000),/expiry/);
 assert.equal(store.records().length,0);
});
test("tampering and wrong signing key fail without audit",async()=>{
 const {store,verifier,grant}=setup();
 await assert.rejects(verifier.verifyAndRecord({...grant,payload:{...grant.payload,expiresAt:now+9999}},context,now),/signature/);
 const other=createIsolatedGrantVerifier("different-test-secret-0123456789-abcdef",store);
 await assert.rejects(other.verifyAndRecord(grant,context,now),/signature/);
 assert.equal(store.records().length,0);
});
test("audit failure blocks consumption and never returns authorization",async()=>{
 const {store,verifier,grant}=setup();
 store.setFailure(true);
 await assert.rejects(verifier.verifyAndRecord(grant,context,now),/audit unavailable/);
 assert.equal(store.records().length,0);
 store.setFailure(false);
 const result=await verifier.verifyAndRecord(grant,context,now);
 assert.equal(result.executionAllowed,false);
 assert.equal(store.records().length,1);
});
test("malformed grant, untrusted evidence and invalid issuer inputs fail closed",async()=>{
 const {verifier,grant,issuer}=setup();
 for(const bad of [null,{},[],{...grant,signature:"0".repeat(64),unexpected:true}]){
  await assert.rejects(verifier.verifyAndRecord(bad,context,now),/Malformed approval/);
 }
 assert.throws(()=>issuer.issue({...context,expiresAt:now+120000},now),/Invalid authenticated approval evidence/);
 assert.throws(()=>createIsolatedGrantIssuer("short"),/Invalid isolated signing key/);
});
