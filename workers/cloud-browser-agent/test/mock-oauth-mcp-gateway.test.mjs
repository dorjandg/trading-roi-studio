import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign as signJwt} from "node:crypto";
import {chromium} from "playwright";
import {createMockJwtVerifier} from "../simulation/mock-oauth-jwt.mjs";
import {createMockOauthMcpGateway} from "../simulation/mock-oauth-mcp-gateway.mjs";

const issuer="https://oauth-api1.example.invalid";
const resource="https://browser-api1.example.invalid";
const subject="ci-reviewer-only";
const kid="synthetic-ci-key";
const current=2000000000;
const {privateKey,publicKey}=generateKeyPairSync("ed25519");
const publicJwk=publicKey.export({format:"jwk"});
const privateValue=privateKey; // Ephemeral in CI memory, never committed or uploaded.
const validClaims=()=>({
 iss:issuer,aud:resource,sub:subject,iat:current-60,nbf:current-60,
 exp:current+300,scope:"browser:wikipedia.read"
});
const header=()=>({alg:"EdDSA",typ:"at+jwt",kid});
const encode=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
const jwt=(claims=validClaims(),head=header(),signingKey=privateValue)=>{
 const input=encode(head)+"."+encode(claims);
 return input+"."+signJwt(null,Buffer.from(input),signingKey).toString("base64url");
};
const config=()=>({issuer,resource,publicJwk,kid,allowedSubjects:[subject],nowSeconds:()=>current});
const request=(method,params,id=1)=>({jsonrpc:"2.0",id,method,...(params===undefined?{}:{params})});
async function send(server,rpc,bearer){
 return fetch(server.url,{method:"POST",headers:{
  "content-type":"application/json",
  ...(bearer===undefined?{}:{authorization:bearer})
 },body:JSON.stringify(rpc)});
}
const searchQuery="James Webb Space Telescope";
const fixture=route=>{
 const req=route.request(),url=new URL(req.url());
 assert.equal(req.method(),"GET");assert.equal(url.hostname,"en.wikipedia.org");
 const html=(title,body)=>'<!doctype html><title>'+title+'</title><h1>'+title+'</h1>'+body;
 if(url.pathname==="/wiki/Main_Page")
  return route.fulfill({status:200,contentType:"text/html",
   body:html("Wikipedia Home",'<form method="get" action="/wiki/Special:Search"><input name="search" type="search"><button>Search</button></form>')});
 if(url.pathname==="/wiki/Special:Search")
  return route.fulfill({status:200,contentType:"text/html",
   body:html("Search results",'<main id="mw-content-text"><a href="/wiki/James_Webb_Space_Telescope">James Webb Space Telescope</a></main>')});
 if(url.pathname==="/wiki/James_Webb_Space_Telescope")
  return route.fulfill({status:200,contentType:"text/html",
   body:html("James Webb Space Telescope",'<main id="mw-content-text"><p>The James Webb Space Telescope is an infrared telescope for observing the early universe and young galaxies.</p></main>')});
 return route.abort();
};
test("synthetic JWT: real Ed25519 signature, exact issuer, audience, subject and scope are required",()=>{
 const verifier=createMockJwtVerifier(config());
 assert.deepEqual(verifier.verify("Bearer "+jwt()),{ok:true,subject,scope:"browser:wikipedia.read"});
 const altered=[
  {claims:{...validClaims(),iss:"https://evil.example.invalid"},error:"invalid_token"},
  {claims:{...validClaims(),aud:"https://other.example.invalid"},error:"invalid_token"},
  {claims:{...validClaims(),aud:[resource,"https://other.example.invalid"]},error:"invalid_token"},
  {claims:{...validClaims(),sub:"unapproved-account"},error:"invalid_token"},
  {claims:{...validClaims(),exp:current},error:"invalid_token"},
  {claims:{...validClaims(),exp:current-1},error:"invalid_token"},
  {claims:{...validClaims(),nbf:current+1},error:"invalid_token"},
  {claims:{...validClaims(),iat:current+1},error:"invalid_token"},
  {claims:{...validClaims(),exp:current+10000},error:"invalid_token"},
  {claims:{...validClaims(),scope:"browser:write"},error:"insufficient_scope"},
  {claims:{...validClaims(),scope:"browser:wikipedia.read browser:wikipedia.read"},error:"invalid_token"},
  {claims:{...validClaims(),scope:"browser:wikipedia.read "},error:"invalid_token"},
  {claims:{...validClaims(),exp:undefined},error:"invalid_token"},
  {claims:{...validClaims(),nbf:undefined},error:"invalid_token"},
  {claims:validClaims(),head:{...header(),alg:"none"},error:"invalid_token"},
  {claims:validClaims(),head:{...header(),alg:"HS256"},error:"invalid_token"},
  {claims:validClaims(),head:{...header(),kid:"unknown-key"},error:"invalid_token"},
  {claims:validClaims(),head:{...header(),crit:["b64"]},error:"invalid_token"}
 ];
 for(const v of altered){
  assert.deepEqual(verifier.verify("Bearer "+jwt(v.claims,v.head||header())),
   {ok:false,error:v.error},JSON.stringify(v));
 }
 const other=generateKeyPairSync("ed25519").privateKey;
 assert.deepEqual(verifier.verify("Bearer "+jwt(validClaims(),header(),other)),
  {ok:false,error:"invalid_token"});
 const original=jwt();
 assert.deepEqual(verifier.verify("Bearer "+original.slice(0,-3)+"AAA"),
  {ok:false,error:"invalid_token"});
 for(const item of [null,"","Basic token","Bearer abc","Bearer x.y.z","Bearer "+original+" ", "Bearer "+original+"\n"]){
  assert.deepEqual(verifier.verify(item),{ok:false,error:"invalid_token"});
 }
});
test("invalid synthetic verifier configuration fails closed and no private signing key is allowed",()=>{
 assert.throws(()=>createMockJwtVerifier({...config(),publicJwk:privateValue.export({format:"jwk"})}),/public test JWK/);
 assert.throws(()=>createMockJwtVerifier({...config(),issuer:"http://not-secure"}),/Invalid synthetic verifier/);
 assert.throws(()=>createMockJwtVerifier({...config(),scope:"browser:admin"}),/Invalid synthetic verifier/);
 assert.throws(()=>createMockJwtVerifier({...config(),allowedSubjects:[]}),/Invalid synthetic verifier/);
});
test("unauthenticated MCP requests receive OAuth challenges and metadata; unsafe calls do not launch Chromium",async()=>{
 let starts=0;
 const noBrowser={launch(){starts++;throw Error("Browser should not start");}};
 const server=await createMockOauthMcpGateway(noBrowser,config());
 try{
  const metadata=await fetch(server.metadataUrl);
  assert.equal(metadata.status,200);
  const discovery=await metadata.json();
  assert.equal(discovery.resource,resource);
  assert.deepEqual(discovery.authorization_servers,[issuer]);
  assert.deepEqual(discovery.scopes_supported,["browser:wikipedia.read"]);
  const init=await send(server,request("initialize",{protocolVersion:"2025-06-18"}));
  assert.equal(init.status,401);
  const challenge=init.headers.get("www-authenticate");
  assert.match(challenge,/resource_metadata="https:\/\/browser-api1\.example\.invalid\/\.well-known\/oauth-protected-resource"/);
  assert.match(challenge,/error="invalid_token"/);
  assert.match(challenge,/scope="browser:wikipedia\.read"/);
  assert.equal((await send(server,request("tools/list"),"Bearer wrong")).status,401);
  const toolCall=request("tools/call",{name:"browser_automate_wikipedia_demo",arguments:{query:searchQuery}},4);
  const unauth=(await(await send(server,toolCall)).json()).result;
  assert.equal(unauth.isError,true);
  assert.match(unauth._meta["mcp/www_authenticate"][0],/error_description="Wikipedia read authorization required"/);
  const scopeDenied=(await(await send(server,toolCall,"Bearer "+jwt({...validClaims(),scope:"other:read"}))).json()).result;
  assert.match(scopeDenied._meta["mcp/www_authenticate"][0],/error="insufficient_scope"/);
  const expired=(await(await send(server,toolCall,"Bearer "+jwt({...validClaims(),exp:current-1}))).json()).result;
  assert.match(expired._meta["mcp/www_authenticate"][0],/error="invalid_token"/);
  assert.equal((await send(server,request("ping"),"Bearer "+jwt({...validClaims(),aud:"https://wrong.example.invalid"}))).status,401);
  assert.equal((await send(server,request("tools/list"),"Bearer "+jwt({...validClaims(),iss:"https://wrong.example.invalid"}))).status,401);
  assert.equal(starts,0);
 }finally{await server.close();}
});
test("valid synthetic OAuth JWT permits MCP initialization, tool metadata, and actual disposable Chromium frames", {timeout:90000},async()=>{
 const server=await createMockOauthMcpGateway(chromium,{...config(),routeFixture:fixture,timeoutMs:12000});
 const bearer="Bearer "+jwt();
 try{
  const init=await send(server,request("initialize",{protocolVersion:"2025-06-18"},1),bearer);
  assert.equal(init.status,200);
  assert.equal((await init.json()).result.protocolVersion,"2025-06-18");
  const tools=await(await send(server,request("tools/list",{},2),bearer)).json();
  assert.deepEqual(tools.result.tools.map(x=>x.name),["browser_automate_wikipedia_demo"]);
  assert.deepEqual(tools.result.tools[0]._meta.securitySchemes,[{type:"oauth2",scopes:["browser:wikipedia.read"]}]);
  const notification={jsonrpc:"2.0",method:"notifications/initialized"};
  assert.equal((await send(server,notification,bearer)).status,202);
  const resultResponse=await send(server,request("tools/call",{
   name:"browser_automate_wikipedia_demo",arguments:{query:searchQuery}
  },3),bearer);
  assert.equal(resultResponse.status,200);
  const result=(await resultResponse.json()).result;
  assert.equal(result.isError,false);
  assert.deepEqual(result.structuredContent.steps.map(x=>x.action),["navigate","search","click"]);
  assert.equal(result.structuredContent.productionWritesAllowed,false);
  assert.equal(result.structuredContent.thirdPartyAutomationUsed,false);
  assert.deepEqual(result.content.map(x=>x.type),["text","image","image","image"]);
  for(const shot of result.content.slice(1))
   assert.equal(Buffer.from(shot.data,"base64").subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 }finally{await server.close();}
});
