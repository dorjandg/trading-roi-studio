import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {makeFixtureIdentityAuthority,makeAuthenticatedFixtureController} from "../simulation/sealed-identity-gateway.mjs";

function setup(t){
 const dir=mkdtempSync(join(tmpdir(),"browser-auth-fixture-"));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let clock=10000;
 const now=()=>clock;
 const authority=makeFixtureIdentityAuthority({now});
 const path=join(dir,"fixture.sqlite");
 const service=()=>makeAuthenticatedFixtureController(path,{authority,now});
 const creator=authority.issue({subject:"fixture-creator-01",role:"creator"});
 const reviewer=authority.issue({subject:"fixture-reviewer-02",role:"reviewer"});
 return {authority,service,creator,reviewer,advance:n=>clock+=n};
}
test("signed identities permit two-role approved fixture edit and restart rollback",t=>{
 const {service,creator,reviewer}=setup(t);
 let app=service();app.seed();
 const p=app.command(creator,"propose",{nextValue:"Authorized test title"});
 app.close();app=service();
 assert.throws(()=>app.command(creator,"approve",{proposalId:p.proposalId,contentDigest:p.contentDigest}),{code:"ROLE_DENIED"});
 assert.deepEqual(app.state(),{value:"Original test title",revision:1});
 app.command(reviewer,"approve",{proposalId:p.proposalId,contentDigest:p.contentDigest});
 app.close();app=service();
 app.command(creator,"execute",{proposalId:p.proposalId,contentDigest:p.contentDigest,expectedRevision:1,requestId:"fixture-request-01"});
 assert.deepEqual(app.state(),{value:"Authorized test title",revision:2});
 assert.throws(()=>app.command(creator,"execute",{proposalId:p.proposalId,contentDigest:p.contentDigest,expectedRevision:2,requestId:"fixture-request-02"}),{code:"APPROVAL_REQUIRED_OR_USED"});
 app.command(reviewer,"rollback",{proposalId:p.proposalId,expectedRevision:2});
 assert.deepEqual(app.state(),{value:"Original test title",revision:3});
 assert.equal(app.verifyAudit(),true);
 assert.equal(JSON.stringify(app.events()).includes("Authorized test title"),false);
 app.close();
});
test("unsigned, tampered, expired, foreign and forged-role tokens are rejected",t=>{
 const {authority,service,creator,advance}=setup(t);
 const app=service();app.seed();
 assert.throws(()=>app.command("fake","propose",{nextValue:"Forged"}),{code:"INVALID_AUTH"});
 const [payload,signature]=creator.split(".");
 assert.throws(()=>app.command(payload+"."+("A"===signature[0]?"B":"A")+signature.slice(1),"propose",{nextValue:"Forged"}),{code:"INVALID_AUTH"});
 const foreign=makeFixtureIdentityAuthority({now:()=>10000}).issue({subject:"fixture-creator-01",role:"creator"});
 assert.throws(()=>app.command(foreign,"propose",{nextValue:"Forged"}),{code:"INVALID_AUTH"});
 assert.throws(()=>authority.issue({subject:"fixture-creator-01",role:"reviewer"}),{code:"INVALID_PRINCIPAL"});
 advance(60000);
 assert.throws(()=>app.command(creator,"propose",{nextValue:"Expired"}),{code:"INVALID_AUTH"});
 assert.deepEqual(app.state(),{value:"Original test title",revision:1});
 app.close();
});
test("client cannot override signed principal or inject unknown fields/actions",t=>{
 const {service,creator,reviewer}=setup(t);
 const app=service();app.seed();
 assert.throws(()=>app.command(creator,"propose",{nextValue:"A",actor:{id:"fixture-reviewer-02",role:"reviewer"}}),{code:"INVALID_ARGUMENTS"});
 assert.throws(()=>app.command(reviewer,"propose",{nextValue:"A"}),{code:"ROLE_DENIED"});
 assert.throws(()=>app.command(creator,"delete",{nextValue:"A"}),{code:"INVALID_ACTION"});
 const p=app.command(creator,"propose",{nextValue:"A"});
 assert.throws(()=>app.command(reviewer,"approve",{proposalId:p.proposalId,contentDigest:p.contentDigest,approved:true}),{code:"INVALID_ARGUMENTS"});
 assert.throws(()=>app.command(creator,"execute",{proposalId:p.proposalId,contentDigest:p.contentDigest,expectedRevision:1,requestId:"fixture-request-01"}),{code:"APPROVAL_REQUIRED_OR_USED"});
 app.close();
});
test("kill switch stops signed actors and leaves fixture unchanged",t=>{
 const {service,creator}=setup(t);
 const app=service();app.seed();app.disableWrites();
 assert.throws(()=>app.command(creator,"propose",{nextValue:"No"}),{code:"KILL_SWITCH"});
 assert.deepEqual(app.state(),{value:"Original test title",revision:1});app.close();
});
