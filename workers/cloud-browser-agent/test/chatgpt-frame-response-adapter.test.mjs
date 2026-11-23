import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {exportDisposableFrameSequence} from "../simulation/chatgpt-frame-export.mjs";
import {prepareChatFrameResponse} from "../simulation/chatgpt-frame-response-adapter.mjs";
test("offline frame adapter yields bounded image blocks without credentials or false live claims",async()=>{
 const exported=await exportDisposableFrameSequence(chromium,[{type:"switch",tab:"github"},{type:"navigate",index:1}]);
 const response=prepareChatFrameResponse(exported,{maxFrames:2});
 assert.deepEqual(response.images.map(x=>x.sequence),[1,2]);
 assert.equal(response.images[1].tab,"github");
 assert.equal(response.text.frameCount,2);
 assert.equal(response.text.live,false);
 assert.equal(response.text.embeddedBrowser,false);
 assert.equal(response.text.networkRequests,0);
 assert.equal(response.images[0].mimeType,"image/png");
 assert.equal(JSON.stringify(response.text).includes("pngBase64"),false);
 assert.equal(JSON.stringify(response.text).includes("Bearer"),false);
});
test("offline frame adapter refuses tampering, oversized limits and fake live exports",()=>{
 const png=Buffer.from([137,80,78,71,13,10,26,10,1]).toString("base64");
 const base={mode:"DISPOSABLE_OFFLINE_FRAME_SEQUENCE",live:false,networkRequests:0,productionWritesAllowed:false,frames:[{sequence:1,tab:"google",page:"Home",mimeType:"image/png",synthetic:true,readOnly:true,pngBase64:png}]};
 assert.equal(prepareChatFrameResponse(base).images.length,1);
 assert.throws(()=>prepareChatFrameResponse({...base,live:true}),/Untrusted/);
 assert.throws(()=>prepareChatFrameResponse({...base,networkRequests:1}),/Untrusted/);
 assert.throws(()=>prepareChatFrameResponse(base,{maxFrames:100}),/Invalid frame limit/);
 assert.throws(()=>prepareChatFrameResponse({...base,frames:[{...base.frames[0],tab:"https://google.com"}]}),/Invalid synthetic tab/);
 assert.throws(()=>prepareChatFrameResponse({...base,frames:[base.frames[0],base.frames[0]]}),/Invalid frame metadata/);
});
