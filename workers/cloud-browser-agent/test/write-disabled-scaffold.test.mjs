import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {createWriteDisabledHandler} from "../../cloud-browser-write-stage/src/index.mjs";

const origin="https://stage-write.invalid";
const issuer="https://floral-river-0fbd.cloudflareaccess.com";
const audience="stage-only-access-audience-test-id";
const enc=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
function setup(){
 const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwks={keys:[{...publicKey.export({format:"jwk"}),kid:"test-key",alg:"RS256",use:"sig"}]};
 const env={WRITE_SERVICE_BOOTSTRAP_ENABLED:"true",ACCESS_ISSUER:issuer,ACCESS_AUDIENCE:audience,
  ACCESS_JWKS_JSON:JSON.stringify(jwks),
  ACCESS_ROLE_ASSIGNMENTS_JSON:JSON.stringify({"reviewer@example.test":"reviewer"})};
 function issue(extra={}){
  const now=Math.floor(Date.now()/1000);
  const payload={iss:issuer,aud:[audience],sub:"verified-user-1",email:"reviewer@example.test",
   iat:now-5,nbf:now-5,exp:now+60,...extra};
  const unsigned=enc({alg:"RS256",kid:"test-key",typ:"JWT"})+"."+enc(payload);
  return unsigned+"."+sign("RSA-SHA256",Buffer.from(unsigned),privateKey).toString("base64url");
 }
 const call=(path,{method="POST",token=issue(),body={purpose:"review-identity-only"},extraHeaders={}}={})=>{
  const headers={"content-type":"application/json",...extraHeaders};
  if(token)headers["Cf-Access-Jwt-Assertion"]=token;
  return new Request(origin+path,{method,headers,body:method==="GET"?undefined:JSON.stringify(body)});
 };
 return {env,issue,call,handle:createWriteDisabledHandler()};
}
test("safe by default when no staging bootstrap flag",async()=>{
 const s=setup(),r=await s.handle(s.call("/authorization-check"),{});
 assert.equal(r.status,503);assert.equal((await r.json()).executionAllowed,false);
});
test("valid signed Access identity returns preflight-only decision",async()=>{
 const s=setup(),r=await s.handle(s.call("/authorization-check"),s.env);
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.authenticated,true);assert.equal(data.role,"reviewer");
 for(const key of ["executionAllowed","approvalAllowed","uploadAllowed","productionWritesAllowed"])
  assert.equal(data[key],false);
 assert.equal(data.email,undefined);
});
test("forged Access credentials and unallowlisted identity are rejected",async()=>{
 const s=setup(),token=s.issue();
 const tampered=token.slice(0,-4)+"abcd";
 for(const t of [null,tampered,s.issue({email:"forged@example.test"}),s.issue({aud:["wrong-audience"]})]){
  const r=await s.handle(s.call("/authorization-check",{token:t}),s.env);
  assert.equal(r.status,401);
  assert.equal((await r.json()).executionAllowed,false);
 }
});
test("all write endpoints forbidden, even with real valid signed identity",async()=>{
 const s=setup();
 for(const pathname of ["/execute","/approve","/upload","/submit","/rollback","/mcp","/health"]){
  const r=await s.handle(s.call(pathname),s.env);
  assert.equal(r.status,404);assert.equal((await r.json()).executionAllowed,false);
 }
 const status=await s.handle(s.call("/health",{method:"GET"}),s.env);
 assert.equal(status.status,200);
 assert.equal((await status.json()).mode,"write-disabled");
});
test("strict preflight request schema and missing JWKS fail closed",async()=>{
 const s=setup();
 for(const body of [{purpose:"write"},{purpose:"review-identity-only",approved:true},{},[]]){
  const r=await s.handle(s.call("/authorization-check",{body}),s.env);
  assert.equal(r.status,400);
 }
 const e={...s.env};delete e.ACCESS_JWKS_JSON;
 const r=await s.handle(s.call("/authorization-check"),e);
 assert.equal(r.status,503);
});
