import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {PersistentWritePrototype} from "../simulation/persistent-write-prototype.mjs";
const creator={id:"fixture-creator-01",role:"creator"};
const reviewer={id:"fixture-reviewer-02",role:"reviewer"};
function local(t,opts={}){
 const dir=mkdtempSync(join(tmpdir(),"browser-agent-sim-"));
 const path=join(dir,"edit-test.sqlite");
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 return {path,create:()=>new PersistentWritePrototype(path,opts)};
}
test("proposal and approval survive restart; edit and rollback persist with audit",t=>{
 const db=local(t);let service=db.create();service.seed();
 const proposal=service.propose(creator,"New disposable title");
 service.close();
 service=db.create();
 assert.deepEqual(service.state(),{value:"Original test title",revision:1});
 service.approve(reviewer,proposal);
 service.close();
 service=db.create();
 assert.deepEqual(service.state(),{value:"Original test title",revision:1});
 const edited=service.execute(creator,{proposalId:proposal.proposalId,contentDigest:proposal.contentDigest,expectedRevision:1,requestId:"fixture-request-001"});
 assert.equal(edited.state,"EXECUTED");
 assert.deepEqual(service.state(),{value:"New disposable title",revision:2});
 assert.throws(()=>service.execute(creator,{proposalId:proposal.proposalId,contentDigest:proposal.contentDigest,expectedRevision:2,requestId:"fixture-request-002"}),{code:"APPROVAL_REQUIRED_OR_USED"});
 service.close();
 service=db.create();
 assert.deepEqual(service.state(),{value:"New disposable title",revision:2});
 const rollback=service.rollback(reviewer,{proposalId:proposal.proposalId,expectedRevision:2});
 assert.equal(rollback.state,"ROLLED_BACK");
 assert.deepEqual(service.state(),{value:"Original test title",revision:3});
 assert.equal(service.verifyAudit(),true);
 assert.deepEqual(service.events().map(e=>e.kind),["PROPOSED","APPROVED","EXECUTED","ROLLED_BACK"]);
 assert.equal(JSON.stringify(service.events()).includes("New disposable title"),false);
 service.close();
});
test("forged identity, self authorization and mismatched digest fail closed",t=>{
 const db=local(t),service=db.create();service.seed();
 assert.throws(()=>service.propose({id:"alice",role:"creator"},"A"),{code:"ACTOR_OR_CHANGE_DENIED"});
 const p=service.propose(creator,"New");
 assert.throws(()=>service.approve(creator,p),{code:"ACTOR_DENIED"});
 assert.throws(()=>service.approve({id:"fixture-creator-01",role:"reviewer"},p),{code:"SEPARATION_OF_DUTIES"});
 assert.throws(()=>service.approve(reviewer,{...p,contentDigest:"0".repeat(64)}),{code:"DIGEST_MISMATCH"});
 assert.throws(()=>service.execute(creator,{proposalId:p.proposalId,contentDigest:p.contentDigest,expectedRevision:1,requestId:"fixture-request-001"}),{code:"APPROVAL_REQUIRED_OR_USED"});
 assert.deepEqual(service.state(),{value:"Original test title",revision:1});service.close();
});
test("expiry, stale revisions and repeated request IDs stop execution",t=>{
 let clock=5000;const db=local(t,{now:()=>clock}),service=db.create();service.seed();
 const expired=service.propose(creator,"Expired",{ttlMs:1000});
 clock=6000;
 assert.throws(()=>service.approve(reviewer,expired),{code:"EXPIRED"});
 const p=service.propose(creator,"Fresh",{ttlMs:1000});
 service.approve(reviewer,p);
 assert.throws(()=>service.execute(creator,{proposalId:p.proposalId,contentDigest:p.contentDigest,expectedRevision:5,requestId:"fixture-request-001"}),{code:"STALE_REVISION"});
 assert.deepEqual(service.state(),{value:"Original test title",revision:1});
 clock=7000;
 assert.throws(()=>service.execute(creator,{proposalId:p.proposalId,contentDigest:p.contentDigest,expectedRevision:1,requestId:"fixture-request-001"}),{code:"EXPIRED"});
 service.close();
});
test("transaction rollback preserves value and audit when execution fails",t=>{
 const db=local(t),service=db.create();service.seed();const p=service.propose(creator,"New");
 service.approve(reviewer,p);
 assert.throws(()=>service.execute(creator,{proposalId:p.proposalId,contentDigest:"f".repeat(64),expectedRevision:1,requestId:"fixture-request-001"}),{code:"DIGEST_MISMATCH"});
 assert.deepEqual(service.state(),{value:"Original test title",revision:1});
 assert.deepEqual(service.events().map(e=>e.kind),["PROPOSED","APPROVED"]);
 assert.equal(service.verifyAudit(),true);service.close();
});
test("disabled write service rejects changes without touching stored state",t=>{
 const db=local(t),service=db.create();service.seed();service.disableWrites();
 assert.throws(()=>service.propose(creator,"New"),{code:"KILL_SWITCH"});
 assert.deepEqual(service.state(),{value:"Original test title",revision:1});
 service.close();
});
