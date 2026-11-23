import test from "node:test";
import assert from "node:assert/strict";
import {createSyntheticImageMcpHandler} from "../simulation/synthetic-image-mcp-entrypoint.mjs";
const secret="isolated-disposable-secret-123456789012345";
const rpc=(signal)=>new Request("http://127.0.0.1/mcp",{method:"POST",signal,headers:{authorization:"Bearer "+secret,"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"synthetic_frame_preview",arguments:{maxFrames:1}}})});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test("concurrent requests are bounded to one browser and busy request is rejected",async()=>{
 const gate=deferred();let launched=0,closed=0;
 const chromium={launch:async()=>{launched++;await gate.promise;return {close:async()=>{closed++;}};}};
 const handler=createSyntheticImageMcpHandler(chromium,{secret,timeoutMs:100});
 const first=handler(rpc());
 await new Promise(r=>setTimeout(r,5));
 const second=await(await handler(rpc())).json();
 assert.equal(second.error.code,-32001);
 assert.equal(launched,1);
 gate.resolve();
 const result=await(await first).json();
 assert.equal(result.error.code,-32000);
 assert.equal(closed,1);
});
test("timeout releases capacity and late browser launch closes",async()=>{
 const gate=deferred();let closed=0;
 const chromium={launch:async()=>{await gate.promise;return {close:async()=>{closed++;}};}};
 const handler=createSyntheticImageMcpHandler(chromium,{secret,timeoutMs:15});
 const result=await(await handler(rpc())).json();
 assert.equal(result.error.message,"Preview timeout");
 gate.resolve();
 await new Promise(r=>setTimeout(r,15));
 assert.equal(closed,1);
});
test("request cancellation closes late browser and returns sanitized error",async()=>{
 const gate=deferred();let closed=0;
 const chromium={launch:async()=>{await gate.promise;return {close:async()=>{closed++;}};}};
 const handler=createSyntheticImageMcpHandler(chromium,{secret,timeoutMs:100});
 const controller=new AbortController();
 const response=handler(rpc(controller.signal));
 await new Promise(r=>setTimeout(r,5));
 controller.abort();
 const result=await(await response).json();
 assert.equal(result.error.message,"Preview cancelled");
 gate.resolve();
 await new Promise(r=>setTimeout(r,15));
 assert.equal(closed,1);
});
test("invalid resource limits fail before accepting requests",()=>{
 assert.throws(()=>createSyntheticImageMcpHandler({},{secret,timeoutMs:0}),/Invalid timeout/);
 assert.throws(()=>createSyntheticImageMcpHandler({},{secret,maxResponseBytes:9000000}),/Invalid response byte ceiling/);
});
