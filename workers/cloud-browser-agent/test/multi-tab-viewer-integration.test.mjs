import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createMultiTabViewerSession} from "../simulation/multi-tab-viewer-session.mjs";
import {createPrivateBrowserGateway} from "../simulation/private-browser-gateway.mjs";
import {createReadOnlyViewerRelay} from "../simulation/read-only-viewer-relay.mjs";
import {createMockViewerIngress} from "../simulation/mock-viewer-ingress.mjs";
test("offline four-tab Chromium integrates with authenticated viewer and scoped tab controls",async()=>{
 const gateway=await createPrivateBrowserGateway(chromium,{sessionFactory:createMultiTabViewerSession});
 const relay=await createReadOnlyViewerRelay(gateway);
 const ingress=await createMockViewerIngress(relay,{controllerGateway:gateway});
 try{
  const login=async key=>{
   const r=await fetch(ingress.url+"/mock-login",{method:"POST",headers:{"x-mock-bootstrap":key}});
   assert.equal(r.status,200);
   const cookies=r.headers.getSetCookie().map(s=>s.split(";")[0]).join("; ");
   const csrf=/api1_csrf=([^;]+)/.exec(cookies)?.[1];
   return {cookies,csrf,role:(await r.json()).role};
  };
  const viewer=await login(ingress.mockBootstrap),control=await login(ingress.mockControlBootstrap);
  assert.equal(viewer.role,"viewer");assert.equal(control.role,"controller");
  const state=async (cookie=viewer.cookies)=>(await(await fetch(ingress.url+"/api/state",{headers:{cookie}})).json());
  const cmd=async (auth,command,csrf=auth.csrf)=>fetch(ingress.url+"/api/command",{method:"POST",headers:{cookie:auth.cookies,"content-type":"application/json","x-csrf-token":csrf},body:JSON.stringify(command)});
  const initial=await state();
  assert.deepEqual(initial.tabs,["google","youtube","github","staging"]);
  assert.equal(initial.activeTab,"google");
  assert.equal((await cmd(viewer,{type:"switch-tab",name:"youtube"})).status,403);
  assert.equal((await cmd(control,{type:"switch-tab",name:"youtube"},"wrong")).status,403);
  assert.equal((await cmd(control,{type:"switch-tab",name:"unknown"})).status,400);
  assert.equal((await cmd(control,{type:"switch-tab",name:"youtube"})).status,200);
  const after=await state();
  assert.equal(after.activeTab,"youtube");assert.equal(after.sequence,initial.sequence+1);
  assert.equal((await cmd(control,{type:"navigate-fixture",index:2})).status,200);
  assert.equal((await state()).page,"Videos");
  assert.equal((await cmd(control,{type:"back"})).status,200);
  assert.equal((await state()).page,"Home");
  const frame=await fetch(ingress.url+"/api/frame",{headers:{cookie:viewer.cookies}});
  assert.equal(frame.status,200);
  assert.equal(Buffer.from(await frame.arrayBuffer()).subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  const html=await(await fetch(ingress.url+"/",{headers:{cookie:viewer.cookies}})).text();
  assert.match(html,/id="tabs"/);
  const script=await(await fetch(ingress.url+"/viewer.js",{headers:{cookie:viewer.cookies}})).text();
  assert.match(script,/switch-tab/);
  assert.equal((await cmd(control,{type:"search",term:"bad"})).status,400);
  assert.equal((await state()).externalRequests,0);
 }finally{await ingress.close();await relay.close();await gateway.close();}
});
