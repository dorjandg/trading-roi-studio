import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createIsolatedBrowserMcpServer} from "../simulation/isolated-real-browser-mcp.mjs";

const QUERY="James Webb Space Telescope";
const fixture=route=>{
 const req=route.request(),u=new URL(req.url());
 assert.equal(req.method(),"GET");
 assert.equal(u.hostname,"en.wikipedia.org");
 const markup=(title,body)=>'<!doctype html><html><head><title>'+title+'</title></head><body><h1>'+title+'</h1>'+body+'</body></html>';
 if(u.pathname==="/wiki/Main_Page")return route.fulfill({status:200,contentType:"text/html",
  body:markup("Wikipedia Home",'<form method="get" action="/wiki/Special:Search"><input name="search" type="search"><button>Search</button></form><img src="https://unapproved.example.invalid/track">')});
 if(u.pathname==="/wiki/Special:Search")return route.fulfill({status:200,contentType:"text/html",
  body:markup("Search results",'<main id="mw-content-text"><a href="/wiki/James_Webb_Space_Telescope">James Webb Space Telescope</a><a href="https://external.example.invalid/evil">External</a></main>')});
 if(u.pathname==="/wiki/James_Webb_Space_Telescope")return route.fulfill({status:200,contentType:"text/html",
  body:markup("James Webb Space Telescope",'<main id="mw-content-text"><p>The James Webb Space Telescope observes early galaxies with powerful infrared instruments and a deep space orbit.</p></main>')});
 return route.abort();
};
const rpc=(method,params,id=1)=>({jsonrpc:"2.0",id,method,...(params===undefined?{}:{params})});
async function send(server,body,{token=server.accessToken,origin,contentType="application/json",host}={}){
 return fetch(server.url,{method:"POST",headers:{
  "content-type":contentType,
  "accept":"application/json, text/event-stream",
  ...((token!==null)?{authorization:"Bearer "+token}:{}),
  ...(origin?{origin}:{}),...(host?{host}:{})
 },body:JSON.stringify(body)});
}
test("MCP client sequence: initialize, notification, ping, tools/list, authenticated tools/call returns structured evidence and 3 PNGs",{timeout:90000},async()=>{
 const server=await createIsolatedBrowserMcpServer(chromium,{routeFixture:fixture,timeoutMs:12000});
 try{
  assert.match(server.url,/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
  const initialize=await send(server,rpc("initialize",{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"api1-ci-client",version:"0.1"}},1));
  assert.equal(initialize.status,200);
  const initial=await initialize.json();
  assert.equal(initial.result.protocolVersion,"2025-06-18");
  assert.equal(initial.result.serverInfo.name,"api1-isolated-wikipedia-chromium");
  const notif=await send(server,{jsonrpc:"2.0",method:"notifications/initialized"});
  assert.equal(notif.status,202);
  const ping=await(await send(server,rpc("ping",{},2))).json();
  assert.deepEqual(ping.result,{});
  const listing=await(await send(server,rpc("tools/list",{},3))).json();
  assert.deepEqual(listing.result.tools.map(t=>t.name),["browser_automate_wikipedia_demo"]);
  assert.equal(listing.result.tools[0].annotations.readOnlyHint,true);
  assert.equal(listing.result.tools[0].inputSchema.additionalProperties,false);
  const call=await send(server,rpc("tools/call",{name:"browser_automate_wikipedia_demo",arguments:{query:QUERY}},4));
  assert.equal(call.status,200);
  assert.equal(call.headers.get("cache-control"),"no-store");
  const payload=await call.json();
  assert.equal(payload.jsonrpc,"2.0");
  assert.equal(payload.id,4);
  assert.equal(payload.result.isError,false);
  assert.deepEqual(payload.result.content.map(c=>c.type),["text","image","image","image"]);
  assert.equal(payload.result.structuredContent.status,"passed");
  assert.deepEqual(payload.result.structuredContent.steps.map(s=>s.action),["navigate","search","click"]);
  assert.equal(payload.result.structuredContent.extracted.heading,"James Webb Space Telescope");
  assert.match(payload.result.structuredContent.extracted.paragraphs[0],/early galaxies/);
  assert.equal(payload.result.structuredContent.productionWritesAllowed,false);
  assert.equal(payload.result.structuredContent.thirdPartyAutomationUsed,false);
  assert.deepEqual(JSON.parse(payload.result.content[0].text),payload.result.structuredContent);
  const frames=payload.result.content.slice(1);
  for(const frame of frames){
   assert.equal(frame.mimeType,"image/png");
   const png=Buffer.from(frame.data,"base64");
   assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.ok(png.length>1000);
  }
  assert.notEqual(frames[1].data,frames[2].data);
 }finally{await server.close();}
});
test("MCP authorization and request validation are strict; no unapproved calls launch a browser",async()=>{
 let starts=0;
 const fakeChromium={launch(){starts++;throw Error("Unexpected launch");}};
 const server=await createIsolatedBrowserMcpServer(fakeChromium);
 try{
  assert.equal((await send(server,rpc("tools/list"),{token:null})).status,401);
  assert.equal((await send(server,rpc("tools/list"),{token:"invalid"})).status,401);
  assert.equal((await send(server,rpc("tools/list"),{origin:"https://evil.example"})).status,403);
  assert.equal((await send(server,rpc("tools/list"),{host:"external.example"})).status,403);
  assert.equal((await send(server,rpc("tools/list"),{contentType:"text/plain"})).status,415);
  const spoof=await(await send(server,rpc("tools/call",{name:"browser_automate_wikipedia_demo",arguments:{query:QUERY,url:"https://example.com"}},20))).json();
  assert.equal(spoof.error.code,-32602);
  const unknown=await(await send(server,rpc("tools/call",{name:"browser_enter_any_site",arguments:{query:QUERY}},21))).json();
  assert.equal(unknown.error.code,-32602);
  const foreign=await(await send(server,rpc("tools/call",{name:"browser_automate_wikipedia_demo",arguments:{query:"https://example.com"}},22))).json();
  assert.equal(foreign.error.code,-32602);
  const write=await(await send(server,rpc("tools/call",{name:"browser_automate_wikipedia_demo",arguments:{query:QUERY,write:true}},23))).json();
  assert.equal(write.error.code,-32602);
  const bad=await(await send(server,{jsonrpc:"2.0",id:1,method:"tools/list",admin:true})).status;
  assert.equal(bad,400);
  const huge="x".repeat(4100);
  const large=await send(server,rpc("tools/call",{name:"browser_automate_wikipedia_demo",arguments:{query:huge}},24));
  assert.equal(large.status,413);
  assert.equal(starts,0);
 }finally{await server.close();}
});
test("MCP browser failure is sanitized and cannot leak secrets or internal error messages",async()=>{
 const fakeChromium={launch:()=>{throw Error("INTERNAL SECRET SHOULD NOT LEAK");}};
 const server=await createIsolatedBrowserMcpServer(fakeChromium);
 try{
  const r=await(await send(server,rpc("tools/call",{name:"browser_automate_wikipedia_demo",arguments:{query:QUERY}},6))).json();
  assert.equal(r.error.code,-32000);
  assert.equal(r.error.message,"Isolated public browser automation failed");
  assert.doesNotMatch(JSON.stringify(r),/INTERNAL SECRET/);
 }finally{await server.close();}
});
