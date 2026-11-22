import test from "node:test";
import assert from "node:assert/strict";
import {forwardAuthorizedMcp,validateRpc} from "../src/forward.mjs";
const env={CF_ACCESS_CLIENT_ID:"fake.access",CF_ACCESS_CLIENT_SECRET:"fake-secret",BROWSER_AGENT_API_TOKEN:"fake-worker-token"};
const user={userId:"approved-user"};
const req=(obj)=>new Request("https://gateway.invalid/mcp",{method:"POST",body:JSON.stringify(obj)});
const rpc=(method,params)=>({jsonrpc:"2.0",id:1,method,params});
test("no forwarded request without verified identity",async()=>{
 let called=false;
 const response=await forwardAuthorizedMcp(req(rpc("tools/list")),env,null,()=>{called=true;});
 assert.equal(response.status,401);assert.equal(called,false);
});
test("only read-only MCP methods allowed",()=>{
 assert.equal(validateRpc(rpc("tools/list")),true);
 assert.equal(validateRpc(rpc("tools/call",{name:"browser_agent_status",arguments:{}})),true);
 assert.equal(validateRpc(rpc("tools/call",{name:"browser_inspect",arguments:{url:"https://trading-roi-studio.pages.dev"}})),true);
 assert.equal(validateRpc(rpc("tools/call",{name:"browser_click",arguments:{url:"https://example.com"}})),false);
 assert.equal(validateRpc(rpc("tools/call",{name:"browser_inspect",arguments:{url:"ok",click:true}})),false);
});
test("blocks write actions before forwarding",async()=>{
 let called=false;const response=await forwardAuthorizedMcp(req(rpc("tools/call",{name:"browser_click",arguments:{}})),env,user,()=>{called=true;});
 assert.equal(response.status,400);assert.equal(called,false);
});
test("only forwards to fixed staging worker and sends credentials server side",async()=>{
 const response=await forwardAuthorizedMcp(req(rpc("tools/list")),env,user,async(url,opts)=>{
   assert.equal(url,"https://cloud-browser-agent-stage.dorjan-gjoni-dg.workers.dev/mcp");
   assert.equal(opts.redirect,"manual");assert.equal(opts.headers["CF-Access-Client-Id"],env.CF_ACCESS_CLIENT_ID);
   assert.equal(opts.headers.Authorization,"Bearer "+env.BROWSER_AGENT_API_TOKEN);
   return Response.json({jsonrpc:"2.0",id:1,result:{tools:[]}});
 });
 assert.equal(response.status,200);assert.deepEqual((await response.json()).result.tools,[]);
});
test("rejects redirects from upstream",async()=>{
 const response=await forwardAuthorizedMcp(req(rpc("tools/list")),env,user,async()=>new Response(null,{status:302,headers:{location:"https://evil.example"}}));
 assert.equal(response.status,502);
});
test("rejects absent credentials and invalid JSON",async()=>{
 assert.equal((await forwardAuthorizedMcp(req(rpc("tools/list")),{},user)).status,503);
 const bad=new Request("https://gateway.invalid/mcp",{method:"POST",body:"not-json"});
 assert.equal((await forwardAuthorizedMcp(bad,env,user)).status,400);
});
