import test from "node:test";
import assert from "node:assert/strict";
import { createMcpHandler } from "../src/mcp.mjs";

const env={AGENT_API_TOKEN:"test-secret",ALLOWED_ORIGINS:"https://trading-roi-studio.pages.dev",BROWSER:{}};
const request=(method,params={})=>new Request("https://example.test/mcp",{
 method:"POST",headers:{authorization:"Bearer test-secret","content-type":"application/json"},
 body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})
});
test("MCP requires authentication",async()=>{
 const r=await createMcpHandler(async()=>{})(new Request("https://example.test/mcp",{method:"POST"}),env);
 assert.equal(r.status,401);
});
test("MCP advertises only read-only tools",async()=>{
 const r=await createMcpHandler(async()=>{})(request("tools/list"),env);
 const x=await r.json();
 assert.deepEqual(x.result.tools.map(t=>t.name),["browser_agent_status","browser_page_links","browser_inspect"]);
});
test("MCP initializes and returns status without browser launch",async()=>{
 const handler=createMcpHandler(async()=>{throw Error("must not launch");});
 assert.equal((await (await handler(request("initialize"),env)).json()).result.serverInfo.name,"cloud-browser-agent-staging");
 const x=await (await handler(request("tools/call",{name:"browser_agent_status",arguments:{}}),env)).json();
 assert.equal(JSON.parse(x.result.content[0].text).browserConfigured,true);
});
test("MCP blocks unauthorized URL before browser launch",async()=>{
 let launchCount=0;
 const handler=createMcpHandler(async()=>{launchCount++;});
 const x=await (await handler(request("tools/call",{name:"browser_inspect",arguments:{url:"https://example.com"}}),env)).json();
 assert.equal(x.error.code,-32602);assert.equal(launchCount,0);
});
test("MCP rejects unlisted actions",async()=>{
 const x=await (await createMcpHandler(async()=>{})(request("tools/call",{name:"browser_click",arguments:{}}),env)).json();
 assert.equal(x.error.code,-32602);
});

test("MCP blocks unapproved page link discovery before launch",async()=>{
 let count=0;
 const handler=createMcpHandler(async()=>{count++;});
 const reply=await (await handler(request("tools/call",{name:"browser_page_links",arguments:{url:"https://evil.test/"}}),env)).json();
 assert.equal(reply.error.code,-32602); assert.equal(count,0);
});
