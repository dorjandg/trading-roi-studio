import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {simulateChatGptImageToolCall} from "../simulation/chatgpt-mcp-image-preview.mjs";
test("offline MCP preview emits genuine synthetic image content without network",async()=>{
 const r=await simulateChatGptImageToolCall(chromium,{actions:[{type:"switch",tab:"youtube"},{type:"navigate",index:1}],maxFrames:3});
 assert.equal(r.isError,false);
 assert.deepEqual(r.content.map(x=>x.type),["text","image","image","image"]);
 const meta=JSON.parse(r.content[0].text);
 assert.equal(meta.networkRequests,0);
 assert.equal(meta.live,false);
 assert.equal(meta.embeddedBrowser,false);
 for(const item of r.content.slice(1)){
  assert.equal(item.mimeType,"image/png");
  assert.deepEqual([...Buffer.from(item.data,"base64").subarray(0,8)],[137,80,78,71,13,10,26,10]);
 }
});
test("offline MCP preview rejects real website commands and unbounded image requests",async()=>{
 await assert.rejects(simulateChatGptImageToolCall(chromium,{actions:[{type:"navigate",url:"https://google.com"}]}),/Frame action refused/);
 await assert.rejects(simulateChatGptImageToolCall(chromium,{maxFrames:10}),/Preview limits exceeded/);
 await assert.rejects(simulateChatGptImageToolCall(chromium,{url:"https://google.com"}),/Invalid tool arguments/);
});
