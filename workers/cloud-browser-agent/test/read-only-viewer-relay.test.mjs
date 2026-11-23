import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {request as httpRequest} from "node:http";
import {createPrivateBrowserGateway} from "../simulation/private-browser-gateway.mjs";
import {createReadOnlyViewerRelay} from "../simulation/read-only-viewer-relay.mjs";
const fixture=route=>{
 const u=new URL(route.request().url());
 if(u.hostname!=="en.wikipedia.org"||route.request().method()!=="GET")return route.abort();
 const isSearch=u.pathname.includes("Special:Search");
 return route.fulfill({status:200,contentType:"text/html",body:`<title>${isSearch?"Results":"Home"}</title><h1>${isSearch?"Results":"Home"}</h1><a href="/wiki/Main_Page">Home</a>`});
};
test("isolated read-only relay streams real Chromium PNG frames but cannot issue commands",async()=>{
 const gateway=await createPrivateBrowserGateway(chromium,{fixture,timeoutMs:10000});
 const relay=await createReadOnlyViewerRelay(gateway);
 try{
  const get=(path,key=relay.viewerKey,headers={})=>fetch(relay.url+path,{headers:{...(key?{authorization:"Bearer "+key}:{}),...headers}});
  assert.equal((await get("/state",null)).status,401);
  assert.equal((await get("/frame",gateway.accessKey)).status,401);
  assert.equal((await get("/state",relay.viewerKey,{origin:"https://evil.example"})).status,403);
  const forged=await new Promise((resolve,reject)=>{const req=httpRequest(relay.url+"/state",{headers:{host:"evil.example",authorization:"Bearer "+relay.viewerKey}},res=>{res.resume();resolve(res.statusCode);});req.on("error",reject);req.end();});
  assert.equal(forged,403);
  const state=await(await get("/state")).json();
  assert.match(state.url,/Main_Page/);
  assert.equal((await get("/links")).status,200);
  const frame=await get("/frame");
  assert.equal(frame.status,200);
  assert.equal(frame.headers.get("cache-control"),"no-store");
  assert.equal(frame.headers.get("x-frame-sequence"),String(state.sequence));
  const png=Buffer.from(await frame.arrayBuffer());
  assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  const forbidden=await fetch(relay.url+"/command",{method:"POST",headers:{authorization:"Bearer "+relay.viewerKey,"content-type":"application/json"},body:'{"type":"back"}'});
  assert.equal(forbidden.status,404);
  assert.equal((await get("/command")).status,404);
  assert.equal((await get("/health")).status,200);
  const controller=await fetch(gateway.url+"/command",{method:"POST",headers:{authorization:"Bearer "+gateway.accessKey,"content-type":"application/json"},body:JSON.stringify({type:"search",term:"James Webb"})});
  assert.equal(controller.status,200);
  const after=await(await get("/state")).json();
  assert.equal(after.sequence,state.sequence+1);
  assert.equal((await get("/frame")).headers.get("x-frame-sequence"),String(after.sequence));
 }finally{await relay.close();await gateway.close();}
});
