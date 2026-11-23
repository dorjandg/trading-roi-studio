import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {exportDisposableFrameSequence} from "../simulation/chatgpt-frame-export.mjs";
test("ChatGPT-facing export returns ordered synthetic PNG frames without network access",async()=>{
 const result=await exportDisposableFrameSequence(chromium,[
  {type:"navigate",index:1},
  {type:"switch",tab:"youtube"},
  {type:"navigate",index:2},
  {type:"switch",tab:"google"},
  {type:"history",delta:-1}
 ]);
 assert.equal(result.mode,"DISPOSABLE_OFFLINE_FRAME_SEQUENCE");
 assert.equal(result.live,false);
 assert.equal(result.embeddedBrowser,false);
 assert.equal(result.networkRequests,0);
 assert.equal(result.productionWritesAllowed,false);
 assert.deepEqual(result.frames.map(f=>f.page),["Home","Search results","Home","Videos","Search results","Home"]);
 assert.deepEqual(result.frames.map(f=>f.sequence),[1,2,3,4,5,6]);
 for(const frame of result.frames){
  assert.equal(frame.synthetic,true);
  assert.equal(frame.mimeType,"image/png");
  assert.deepEqual([...Buffer.from(frame.pngBase64,"base64").subarray(0,8)],[137,80,78,71,13,10,26,10]);
 }
 assert.equal(result.events.length,6);
});
test("ChatGPT-facing export refuses arbitrary destinations and oversized sequences",async()=>{
 await assert.rejects(exportDisposableFrameSequence(chromium,[{type:"switch",tab:"https://youtube.com"}]),/Frame action refused/);
 await assert.rejects(exportDisposableFrameSequence(chromium,[{type:"navigate",url:"https://google.com"}]),/Frame action refused/);
 await assert.rejects(exportDisposableFrameSequence(chromium,Array.from({length:13},()=>({type:"navigate",index:0}))),/Invalid frame action sequence/);
});
