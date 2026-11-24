import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {request as httpRequest} from "node:http";
import {createPrivateBrowserGateway} from "../simulation/private-browser-gateway.mjs";
const fixture=route=>{
 const req=route.request(),u=new URL(req.url());
 if(req.method()!=="GET"||u.hostname!=="en.wikipedia.org")return route.abort();
 const title=u.pathname.includes("Special:Search")?"Search":u.pathname.includes("James_Webb")?"Webb":"Main";
 const link=title==="Search"?'<a href="/wiki/James_Webb_Space_Telescope">James Webb</a>':'<a href="/wiki/Main_Page">Main</a>';
 return route.fulfill({status:200,contentType:"text/html",body:`<title>${title}</title><h1>${title}</h1>${link}`});
};
test("private browser gateway denies unauthenticated access and controls safe Chromium navigation",async()=>{
 const gateway=await createPrivateBrowserGateway(chromium,{fixture,timeoutMs:10000});
 try{
  const request=(path,{key=gateway.accessKey,method="GET",body,headers={}}={})=>fetch(gateway.url+path,{method,headers:{...(key?{authorization:"Bearer "+key}:{}),...(body?{"content-type":"application/json"}:{}),...headers},body:body?JSON.stringify(body):undefined});
  assert.equal((await request("/state",{key:null})).status,401);
  assert.equal((await request("/frame",{key:"wrong"})).status,401);
  assert.equal((await request("/links",{key:null})).status,401);
  assert.equal((await request("/command",{key:null,method:"POST",body:{type:"back"}})).status,401);
  assert.equal((await request("/state",{headers:{origin:"https://evil.example"}})).status,403);
  const badHostStatus=await new Promise((resolve,reject)=>{const req=httpRequest(gateway.url+"/state",{headers:{host:"evil.example",authorization:"Bearer "+gateway.accessKey}},res=>{res.resume();resolve(res.statusCode);});req.on("error",reject);req.end();});
  assert.equal(badHostStatus,403);
  assert.equal((await request("/health")).status,200);
  const first=await(await request("/state")).json();
  assert.match(first.url,/Main_Page/);
  assert.equal((await request("/command",{method:"POST",body:{type:"search",term:"James Webb Space Telescope"}})).status,200);
  const links=await(await request("/links")).json();
  assert.ok(links.some(x=>x.href.endsWith("James_Webb_Space_Telescope")));
  assert.equal((await request("/command",{method:"POST",body:{type:"click",href:"https://en.wikipedia.org/wiki/James_Webb_Space_Telescope"}})).status,200);
  const f=await request("/frame");assert.equal(f.status,200);
  const png=Buffer.from(await f.arrayBuffer());assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal((await request("/command",{method:"POST",body:{type:"navigate",url:"https://example.org"}})).status,400);
  assert.equal((await request("/command",{method:"POST",body:{type:"back"}})).status,200);
 }finally{await gateway.close();}
});

test("gateway rejects malformed commands, unsupported methods and non-JSON bodies without leaking access key",async()=>{
 const gateway=await createPrivateBrowserGateway(chromium,{fixture,timeoutMs:10000});
 try{
  const headers={authorization:"Bearer "+gateway.accessKey};
  const base=gateway.url;
  const badType=await fetch(base+"/command",{method:"POST",headers:{...headers,"content-type":"text/plain"},body:"back"});
  assert.equal(badType.status,415);
  const badJSON=await fetch(base+"/command",{method:"POST",headers:{...headers,"content-type":"application/json"},body:"{"});
  assert.equal(badJSON.status,400);
  const large=await fetch(base+"/command",{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({type:"search",term:"a".repeat(600)})});
  assert.equal(large.status,400);
  const badMethod=await fetch(base+"/state",{method:"POST",headers});
  assert.equal(badMethod.status,404);
  const unknown=await fetch(base+"/missing",{headers});
  assert.equal(unknown.status,404);
  const invalid=await fetch(base+"/command",{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({type:"click",href:"https://example.org/"})});
  assert.equal(invalid.status,400);
  const failure=await invalid.clone().json();
  assert.equal(failure.code,"CONTROLLER_OPERATION_FAILED");
  assert.equal(failure.dispatched,true);
  assert.equal(failure.outcomeUnknown,true);
  assert.equal(failure.retrySafe,false);
  for(const response of [badType,badJSON,large,badMethod,unknown,invalid]){
   assert.equal(response.headers.get("cache-control"),"no-store");
   assert.equal(response.headers.get("x-frame-options"),"DENY");
   assert.equal((await response.text()).includes(gateway.accessKey),false);
  }
  // The adapter was invoked. Conservatively stop, even if this particular
  // adapter rejected the destination before any page action.
  const shutdown=await gateway.close();
  assert.equal(shutdown.outcomeUnknown,true);
  assert.equal(shutdown.retrySafe,false);
 }finally{await gateway.close();}
});
