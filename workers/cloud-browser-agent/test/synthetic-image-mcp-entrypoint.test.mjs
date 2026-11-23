import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createSyntheticImageMcpHandler} from "../simulation/synthetic-image-mcp-entrypoint.mjs";
const secret="test-only-not-deployed-secret-0123456789abcdef";
const handler=createSyntheticImageMcpHandler(chromium,{secret});
function request(method,params,id=1,auth=true){return new Request("http://127.0.0.1/mcp",{method:"POST",headers:{"content-type":"application/json",...(auth?{authorization:"Bearer "+secret}:{})},body:JSON.stringify({jsonrpc:"2.0",id,method,...(params===undefined?{}:{params})})});}
test("isolated MCP advertises only synthetic preview and returns actual PNG images",async()=>{
 const init=await(await handler(request("initialize"))).json();
 assert.equal(init.result.serverInfo.name,"synthetic-frame-test-only");
 const list=await(await handler(request("tools/list"))).json();
 assert.deepEqual(list.result.tools.map(x=>x.name),["synthetic_frame_preview"]);
 const response=await(await handler(request("tools/call",{name:"synthetic_frame_preview",arguments:{actions:[{type:"switch",tab:"github"}],maxFrames:2}}))).json();
 assert.equal(response.result.isError,false);
 assert.deepEqual(response.result.content.map(x=>x.type),["text","image","image"]);
 const metadata=JSON.parse(response.result.content[0].text);
 assert.equal(metadata.live,false);
 assert.equal(metadata.networkRequests,0);
 for(const img of response.result.content.slice(1)){
  assert.equal(img.mimeType,"image/png");
  assert.deepEqual([...Buffer.from(img.data,"base64").subarray(0,8)],[137,80,78,71,13,10,26,10]);
 }
});
test("isolated MCP fails closed for missing auth, origins, real URLs and unknown tools",async()=>{
 assert.equal((await handler(request("tools/list",undefined,1,false))).status,401);
 const cross=request("tools/list");
 cross.headers.set("origin","https://evil.example");
 assert.equal((await handler(cross)).status,403);
 const unknown=await(await handler(request("tools/call",{name:"browser_inspect",arguments:{url:"https://example.com"}}))).json();
 assert.equal(unknown.error.code,-32602);
 const invalid=await(await handler(request("tools/call",{name:"synthetic_frame_preview",arguments:{actions:[{type:"navigate",url:"https://google.com"}]}}))).json();
 assert.equal(invalid.error.code,-32602);
 const extra=await(await handler(request("tools/call",{name:"synthetic_frame_preview",arguments:{url:"https://google.com"}}))).json();
 assert.equal(extra.error.code,-32602);
 const huge=await handler(new Request("http://127.0.0.1/mcp",{method:"POST",headers:{authorization:"Bearer "+secret,"content-length":"9000"},body:"{}"}));
 assert.equal(huge.status,413);
});
