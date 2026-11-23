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
 const huge=await handler(new Request("http://127.0.0.1/mcp",{method:"POST",headers:{authorization:"Bearer "+secret,"content-type":"application/json","content-length":"9000"},body:"{}"}));
 assert.equal(huge.status,413);
});

test("isolated MCP enforces strict JSON-RPC envelopes and content types",async()=>{
 const malformed=[
  {jsonrpc:"2.0",id:1,method:"tools/list",unexpected:true},
  {jsonrpc:"2.0",id:1.5,method:"tools/list"},
  {jsonrpc:"2.0",id:-1,method:"tools/list"},
  {jsonrpc:"2.0",id:1,method:"tools/list",params:{url:"https://example.com"}}
 ];
 for(const rpc of malformed){
  const r=await handler(new Request("http://127.0.0.1/mcp",{method:"POST",headers:{authorization:"Bearer "+secret,"content-type":"application/json"},body:JSON.stringify(rpc)}));
  if(rpc.params)assert.equal((await r.json()).error.code,-32602);
  else assert.equal(r.status,400);
 }
 const wrongType=await handler(new Request("http://127.0.0.1/mcp",{method:"POST",headers:{authorization:"Bearer "+secret,"content-type":"text/plain"},body:"{}"}));
 assert.equal(wrongType.status,415);
 const invalidAuth=await handler(new Request("http://127.0.0.1/mcp",{method:"POST",headers:{authorization:"Bearer "+secret+"x","content-type":"application/json"},body:"{}"}));
 assert.equal(invalidAuth.status,401);
});
test("isolated MCP end-to-end multi-action sequence preserves offline-only image metadata",async()=>{
 const result=await(await handler(request("tools/call",{name:"synthetic_frame_preview",arguments:{actions:[{type:"switch",tab:"staging"},{type:"navigate",index:1},{type:"history",delta:-1}],maxFrames:4}}))).json();
 assert.equal(result.result.content.length,5);
 const meta=JSON.parse(result.result.content[0].text);
 assert.equal(meta.frameCount,4);
 assert.equal(meta.networkRequests,0);
 assert.equal(meta.readOnly,true);
 assert.equal(meta.embeddedBrowser,false);
 for(const image of result.result.content.slice(1)){
  const data=Buffer.from(image.data,"base64");
  assert.ok(data.length>1000);
  assert.ok(data.length<2_000_000);
  assert.equal(image.mimeType,"image/png");
 }
 const fail=await(await handler(request("tools/call",{name:"synthetic_frame_preview",arguments:{actions:[{type:"history",delta:-1}]}}))).json();
 assert.equal(fail.error.code,-32000);
 assert.equal(fail.error.message,"Synthetic frame preview failed");
});
