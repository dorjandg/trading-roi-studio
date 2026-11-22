import test from "node:test";
import assert from "node:assert/strict";
import {publicDiscovery,advertisedTools} from "../src/discovery.mjs";
const req=(method,params)=>new Request("https://cloud-browser-chatgpt-stage.example/mcp",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:7,method,params})});
test("anonymous initialization is metadata only",async()=>{
 const r=await publicDiscovery(req("initialize",{protocolVersion:"2025-06-18"}));
 assert.equal(r.status,200);
 const j=await r.json();
 assert.equal(j.result.capabilities.tools.listChanged,false);
 assert.ok(j.result.instructions.includes("OAuth"));
});
test("anonymous discovery returns exactly 3 OAuth-only read-only tools",async()=>{
 const r=await publicDiscovery(req("tools/list",{}));
 assert.equal(r.status,200);
 const j=await r.json();
 assert.deepEqual(j.result.tools.map(t=>t.name),["browser_agent_status","browser_inspect","browser_page_links"]);
 for(const tool of j.result.tools){
  assert.equal(tool.annotations.readOnlyHint,true);
  assert.deepEqual(tool._meta.securitySchemes,[{type:"oauth2",scopes:["mcp:read"]}]);
  assert.equal(tool.inputSchema.additionalProperties,false);
 }
});
test("never execute tools, ping or bypass OAuth",async()=>{
 for(const method of ["tools/call","ping","notifications/initialized"]){
  assert.equal(await publicDiscovery(req(method,{name:"browser_agent_status",arguments:{}})),null);
 }
});
test("GET, malformed and giant payload never reveal tools",async()=>{
 assert.equal(await publicDiscovery(new Request("https://cloud-browser-chatgpt-stage.example/mcp")),null);
 assert.equal(await publicDiscovery(new Request("https://cloud-browser-chatgpt-stage.example/mcp",{method:"POST",body:"invalid"})),null);
 const tooBig=new Request("https://cloud-browser-chatgpt-stage.example/mcp",{method:"POST",body:"x".repeat(4097)});
 assert.equal((await publicDiscovery(tooBig)).status,413);
});
