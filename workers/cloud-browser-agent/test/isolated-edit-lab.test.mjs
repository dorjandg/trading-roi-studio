import test from "node:test";
import assert from "node:assert/strict";
import {IsolatedEditLab} from "../simulation/isolated-edit-lab.mjs";
const one=async()=>{const lab=new IsolatedEditLab();lab.seed("fixture:title","Original");const p=await lab.propose({fieldId:"fixture:title",nextValue:"Updated",creatorId:"creator-01"});return {lab,p};};
test("approved simulated edit executes once and can roll back",async()=>{
 const {lab,p}=await one();
 assert.deepEqual(lab.inspect("fixture:title"),{value:"Original",revision:1});
 await lab.approve({proposalId:p.proposalId,approverId:"reviewer-02",digest:p.digest});
 const result=await lab.execute({proposalId:p.proposalId,digest:p.digest,requestId:"request-001",expectedRevision:1});
 assert.equal(result.simulationOnly,true);
 assert.deepEqual(lab.inspect("fixture:title"),{value:"Updated",revision:2});
 await assert.rejects(lab.execute({proposalId:p.proposalId,digest:p.digest,requestId:"request-002",expectedRevision:2}),{code:"APPROVAL_REQUIRED_OR_USED"});
 await lab.rollback({proposalId:p.proposalId,actorId:"reviewer-02",expectedRevision:2});
 assert.deepEqual(lab.inspect("fixture:title"),{value:"Original",revision:3});
 assert.equal(await lab.verifyJournal(),true);
 assert.deepEqual(lab.events().map(e=>e.kind),["PROPOSED","APPROVED","EXECUTED","ROLLED_BACK"]);
});
test("approval cannot be self-issued or replaced with arbitrary digest",async()=>{
 const {lab,p}=await one();
 await assert.rejects(lab.approve({proposalId:p.proposalId,approverId:"creator-01",digest:p.digest}),{code:"SEPARATION_OF_DUTIES"});
 await assert.rejects(lab.approve({proposalId:p.proposalId,approverId:"reviewer-02",digest:"0".repeat(64)}),{code:"DIGEST_MISMATCH"});
 await assert.rejects(lab.execute({proposalId:p.proposalId,digest:p.digest,requestId:"request-001",expectedRevision:1}),{code:"APPROVAL_REQUIRED_OR_USED"});
 assert.equal(lab.inspect("fixture:title").value,"Original");
});
test("expired approvals never execute",async()=>{
 let clock=10000;
 const lab=new IsolatedEditLab({now:()=>clock});lab.seed("fixture:title","Before");
 const p=await lab.propose({fieldId:"fixture:title",nextValue:"After",creatorId:"creator-01",ttlMs:1000});
 clock=11000;
 await assert.rejects(lab.approve({proposalId:p.proposalId,approverId:"reviewer-02",digest:p.digest}),{code:"EXPIRED"});
 assert.equal(lab.inspect("fixture:title").value,"Before");
});
test("stale revision and digest mismatch deny execution and rollback",async()=>{
 const {lab,p}=await one();
 await lab.approve({proposalId:p.proposalId,approverId:"reviewer-02",digest:p.digest});
 await assert.rejects(lab.execute({proposalId:p.proposalId,digest:"1".repeat(64),requestId:"request-001",expectedRevision:1}),{code:"DIGEST_MISMATCH"});
 await assert.rejects(lab.execute({proposalId:p.proposalId,digest:p.digest,requestId:"request-001",expectedRevision:3}),{code:"STALE_REVISION"});
 assert.equal(lab.inspect("fixture:title").value,"Original");
 await lab.execute({proposalId:p.proposalId,digest:p.digest,requestId:"request-001",expectedRevision:1});
 await assert.rejects(lab.rollback({proposalId:p.proposalId,actorId:"reviewer-02",expectedRevision:1}),{code:"STALE_REVISION"});
 assert.equal(lab.inspect("fixture:title").value,"Updated");
});
test("kill switch prevents approvals executions and rollback",async()=>{
 const {lab,p}=await one();
 lab.disableWrites();
 await assert.rejects(lab.approve({proposalId:p.proposalId,approverId:"reviewer-02",digest:p.digest}),{code:"KILL_SWITCH"});
 await assert.rejects(lab.execute({proposalId:p.proposalId,digest:p.digest,requestId:"request-001",expectedRevision:1}),{code:"KILL_SWITCH"});
 await assert.rejects(lab.rollback({proposalId:p.proposalId,actorId:"reviewer-02",expectedRevision:1}),{code:"KILL_SWITCH"});
});
test("audit journal hashes chain events and excludes edit values",async()=>{
 const {lab,p}=await one();
 await lab.approve({proposalId:p.proposalId,approverId:"reviewer-02",digest:p.digest});
 await lab.execute({proposalId:p.proposalId,digest:p.digest,requestId:"request-001",expectedRevision:1});
 const logs=JSON.stringify(lab.events());
 assert.equal(logs.includes("Original"),false);
 assert.equal(logs.includes("Updated"),false);
 assert.equal(await lab.verifyJournal(),true);
 const tampered=lab.events();tampered[0].kind="IMPERSONATED";
 assert.equal(await lab.verifyJournal(),true); // defensive-copy output cannot mutate internal ledger
});
