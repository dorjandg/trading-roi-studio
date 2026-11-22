import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createAccessJwtVerifier} from "../simulation/access-jwt-verifier.mjs";
import {createAccessAuthenticatedFixture} from "../simulation/access-authenticated-fixture.mjs";

const issuer="https://floral-river-0fbd.cloudflareaccess.com";
const audience="test-browser-write-fixture-audience";
const now=1_800_000_000_000;
const encode=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),"access-bridge-"));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const key={...pair.publicKey.export({format:"jwk"}),kid:"test-kid",alg:"RS256",use:"sig"};
 const verifier=createAccessJwtVerifier({
  issuer,audience,jwks:{keys:[key]},now:()=>now,allowedClockSkewSeconds:0,
  roleAssignments:{"creator@example.test":"creator","reviewer@example.test":"reviewer"}
 });
 function token(subject,email,extra={}){
  const claims={iss:issuer,aud:[audience],sub:subject,email,iat:now/1000-10,nbf:now/1000-10,exp:now/1000+200,...extra};
  const unsigned=encode({alg:"RS256",typ:"JWT",kid:"test-kid"})+"."+encode(claims);
  return unsigned+"."+sign("RSA-SHA256",Buffer.from(unsigned),pair.privateKey).toString("base64url");
 }
 const file=join(root,"access-bridge.sqlite");
 return {token,open:()=>createAccessAuthenticatedFixture(file,{verifier,now:()=>now})};
}
test("verified signed Access principals control durable test edit across restart",async t=>{
 const f=fixture(t),creator=f.token("access-creator-01","creator@example.test"),reviewer=f.token("access-reviewer-02","reviewer@example.test");
 let app=f.open();app.seed();
 const proposal=await app.command(creator,"propose",{nextValue:"Verified JWT fixture title"});
 app.close();app=f.open();
 await assert.rejects(app.command(creator,"approve",{proposalId:proposal.proposalId,contentDigest:proposal.contentDigest}),{code:"ROLE_DENIED"});
 await app.command(reviewer,"approve",{proposalId:proposal.proposalId,contentDigest:proposal.contentDigest});
 app.close();app=f.open();
 const result=await app.command(creator,"execute",{proposalId:proposal.proposalId,contentDigest:proposal.contentDigest,expectedRevision:1,requestId:"fixture-request-01"});
 assert.equal(result.state,"EXECUTED");
 assert.equal(app.state().value,"Verified JWT fixture title");
 await assert.rejects(app.command(creator,"execute",{proposalId:proposal.proposalId,contentDigest:proposal.contentDigest,expectedRevision:2,requestId:"fixture-request-02"}),{code:"APPROVAL_REQUIRED_OR_USED"});
 await app.command(reviewer,"rollback",{proposalId:proposal.proposalId,expectedRevision:2});
 assert.deepEqual(app.state(),{value:"Original test title",revision:3});
 assert.equal(app.verifyAudit(),true);app.close();
});
test("invalid signature, role injection and unapproved actor cannot change field",async t=>{
 const f=fixture(t),creator=f.token("access-creator-01","creator@example.test");
 const app=f.open();app.seed();
 const tampered=creator.slice(0,-3)+"zzz";
 await assert.rejects(app.command(tampered,"propose",{nextValue:"Forged"}));
 await assert.rejects(app.command(creator,"propose",{nextValue:"Role injection",role:"reviewer"}),{code:"INVALID_ARGUMENTS"});
 await assert.rejects(app.command(creator,"execute",{proposalId:"not-approved",contentDigest:"0".repeat(64),expectedRevision:1,requestId:"fixture-request-01"}),{code:"APPROVAL_REQUIRED_OR_USED"});
 assert.deepEqual(app.state(),{value:"Original test title",revision:1});app.close();
});
