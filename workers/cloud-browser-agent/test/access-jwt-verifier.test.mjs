import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {createAccessJwtVerifier} from "../simulation/access-jwt-verifier.mjs";

const issuer="https://floral-river-0fbd.cloudflareaccess.com";
const audience="test-staging-cloudflare-access-audience-id";
const now=1_800_000_000_000;
const enc=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
function setup(){
 const rsa=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk=rsa.publicKey.export({format:"jwk"});
 const keys={keys:[{...jwk,kid:"key-1",alg:"RS256",use:"sig"}]};
 const roleAssignments={"creator@example.test":"creator","reviewer@example.test":"reviewer"};
 const verifier=createAccessJwtVerifier({issuer,audience,jwks:keys,roleAssignments,now:()=>now,allowedClockSkewSeconds:0});
 const claims={iss:issuer,aud:[audience],sub:"access-user-001",email:"creator@example.test",
   iat:now/1000-10,nbf:now/1000-10,exp:now/1000+120};
 function issue(c=claims,h={alg:"RS256",typ:"JWT",kid:"key-1"}){
  const unsigned=enc(h)+"."+enc(c);
  return unsigned+"."+sign("RSA-SHA256",Buffer.from(unsigned),rsa.privateKey).toString("base64url");
 }
 return {verifier,claims,issue,keys,roleAssignments,rsa};
}
test("cryptographically valid Access RS256 token maps email to trusted server role",async()=>{
 const {verifier,issue}=setup();
 const result=await verifier.verify(issue());
 assert.deepEqual(result,{principalId:"access-user-001",email:"creator@example.test",role:"creator",issuer,authenticated:true});
 assert.equal(Object.isFrozen(result),true);
});
test("claims cannot override principal role, and non-allowlisted identities are rejected",async()=>{
 const {verifier,issue,claims}=setup();
 const actor=await verifier.verify(issue({...claims,role:"admin",permissions:["write-anything"]}));
 assert.equal(actor.role,"creator");
 await assert.rejects(verifier.verify(issue({...claims,email:"attacker@example.test"})),{code:"PRINCIPAL_NOT_ALLOWED"});
});
test("reject modified signatures, foreign audiences, wrong issuer and redirecting key headers",async()=>{
 const {verifier,issue,claims}=setup();
 const original=issue(),parts=original.split(".");
 const changed=parts[0]+"."+enc({...claims,sub:"forged"})+"."+parts[2];
 await assert.rejects(verifier.verify(changed),{code:"INVALID_SIGNATURE"});
 await assert.rejects(verifier.verify(issue({...claims,aud:["another-audience"]})),{code:"INVALID_CLAIMS"});
 await assert.rejects(verifier.verify(issue({...claims,iss:"https://different.cloudflareaccess.com"})),{code:"INVALID_CLAIMS"});
 await assert.rejects(verifier.verify(issue(claims,{alg:"none",typ:"JWT",kid:"key-1"})),{code:"INVALID_JWT"});
 await assert.rejects(verifier.verify(issue(claims,{alg:"RS256",typ:"JWT",kid:"key-1",jku:"https://attacker.test/key"})),{code:"INVALID_JWT"});
 await assert.rejects(verifier.verify(issue(claims,{alg:"RS256",typ:"JWT",kid:"unknown"})),{code:"INVALID_JWT"});
});
test("enforce token expiration, not-before, lifetime and issuer configuration",async()=>{
 const {verifier,issue,claims,keys,roleAssignments}=setup();
 await assert.rejects(verifier.verify(issue({...claims,exp:now/1000-1})),{code:"EXPIRED_OR_NOT_ACTIVE"});
 await assert.rejects(verifier.verify(issue({...claims,nbf:now/1000+120})),{code:"EXPIRED_OR_NOT_ACTIVE"});
 await assert.rejects(verifier.verify(issue({...claims,iat:now/1000-3700,exp:now/1000+120})),{code:"INVALID_CLAIMS"});
 assert.throws(()=>createAccessJwtVerifier({issuer:"http://127.0.0.1",audience,jwks:keys,roleAssignments}),{code:"INVALID_CONFIGURATION"});
 assert.throws(()=>createAccessJwtVerifier({issuer,audience,jwks:keys,roleAssignments:{"creator@example.test":"admin"}}),{code:"INVALID_CONFIGURATION"});
});
test("reject mismatched signature from a different RSA key and arbitrary role credentials",async()=>{
 const {verifier,claims}=setup();
 const attacker=generateKeyPairSync("rsa",{modulusLength:2048});
 const unsigned=enc({alg:"RS256",typ:"JWT",kid:"key-1"})+"."+enc(claims);
 const forged=unsigned+"."+sign("RSA-SHA256",Buffer.from(unsigned),attacker.privateKey).toString("base64url");
 await assert.rejects(verifier.verify(forged),{code:"INVALID_SIGNATURE"});
});
