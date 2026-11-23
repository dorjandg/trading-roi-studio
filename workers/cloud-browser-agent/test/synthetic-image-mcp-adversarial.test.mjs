import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createSyntheticImageMcpHandler} from "../simulation/synthetic-image-mcp-entrypoint.mjs";
const secret="disposable-test-token-0123456789abcdef";
const url="http://127.0.0.1/mcp";
function req(actions=[],maxFrames=4){return new Request(url,{method:"POST",headers:{authorization:"Bearer "+secret,"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:9,method:"tools/call",params:{name:"synthetic_frame_preview",arguments:{actions,maxFrames}}})});}
test("response size ceiling rejects PNG result and still closes disposable browser",async()=>{
 let opened=0,closed=0;
 const wrapped={launch:async options=>{
  const browser=await chromium.launch(options);opened++;
  return new Proxy(browser,{get(target,key){
   if(key==="close")return async(...args)=>{closed++;return target.close(...args);};
   const value=target[key];return typeof value==="function"?value.bind(target):value;
  }});
 }};
 const handler=createSyntheticImageMcpHandler(wrapped,{secret,maxResponseBytes:512});
 const response=await(await handler(req())).json();
 assert.equal(response.error.code,-32000);
 assert.equal(response.error.message,"Image response too large");
 assert.equal(opened,1);
 assert.equal(closed,1);
});
test("browser is closed after failed navigation and no session persists between tool calls",async()=>{
 let opened=0,closed=0;
 const wrapped={launch:async options=>{
  const browser=await chromium.launch(options);opened++;
  return new Proxy(browser,{get(target,key){
   if(key==="close")return async(...args)=>{closed++;return target.close(...args);};
   const value=target[key];return typeof value==="function"?value.bind(target):value;
  }});
 }};
 const handler=createSyntheticImageMcpHandler(wrapped,{secret});
 const failure=await(await handler(req([{type:"history",delta:-1}]))).json();
 assert.equal(failure.error.code,-32000);
 const success=await(await handler(req([{type:"switch",tab:"youtube"}],2))).json();
 assert.equal(success.result.content.length,3);
 assert.equal(JSON.parse(success.result.content[0].text).networkRequests,0);
 assert.equal(opened,2);
 assert.equal(closed,2);
});
test("adversarial input matrix fails closed before browser launch",async()=>{
 let launches=0;
 const handler=createSyntheticImageMcpHandler({launch:async()=>{launches++;throw Error("Must not launch");}},{secret});
 const malicious=[
  {actions:[{type:"switch",tab:"https://github.com"}]},
  {actions:[{type:"navigate",index:999}]},
  {actions:[{type:"history",delta:0}]},
  {actions:[{type:"switch",tab:"github",url:"https://github.com"}]},
  {actions:[null]},
  {actions:[{type:"navigate",index:1.5}]},
  {actions:[],maxFrames:0},
  {actions:[],maxFrames:5},
  {actions:[{type:"switch",tab:"google"},{type:"switch",tab:"github"},{type:"switch",tab:"youtube"},{type:"switch",tab:"staging"}]}
 ];
 for(const args of malicious){
  const r=await(await handler(new Request(url,{method:"POST",headers:{authorization:"Bearer "+secret,"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"synthetic_frame_preview",arguments:args}})}))).json();
  assert.equal(r.error.code,-32602);
 }
 assert.equal(launches,0);
});
