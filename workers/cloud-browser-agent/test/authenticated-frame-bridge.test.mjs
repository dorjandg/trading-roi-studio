import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createAuthenticatedFrameBridge} from "../simulation/authenticated-frame-bridge.mjs";
test("ephemeral authenticated frame bridge denies unauthenticated and cross-origin requests",async()=>{
 const bridge=await createAuthenticatedFrameBridge(chromium);
 try{
  const noAuth=await fetch(bridge.url+"/frame");
  assert.equal(noAuth.status,401);
  const bad=await fetch(bridge.url+"/state",{headers:{authorization:"Bearer wrong"}});
  assert.equal(bad.status,401);
  const cross=await fetch(bridge.url+"/state",{headers:{authorization:bridge.authorization,origin:"https://example.com"}});
  assert.equal(cross.status,403);
  const auth={authorization:bridge.authorization};
  const initial=await(await fetch(bridge.url+"/state",{headers:auth})).json();
  assert.equal(initial.activeTab,"google");
  assert.equal(initial.externalRequests,0);
  const frame=await fetch(bridge.url+"/frame",{headers:auth});
  assert.equal(frame.status,200);
  assert.equal(frame.headers.get("content-type"),"image/png");
  assert.deepEqual([...new Uint8Array(await frame.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
  const switchResult=await fetch(bridge.url+"/command",{method:"POST",headers:{...auth,"content-type":"application/json"},body:JSON.stringify({type:"switch",tab:"youtube"})});
  assert.equal(switchResult.status,200);
  assert.equal((await switchResult.json()).activeTab,"youtube");
  const blocked=await fetch(bridge.url+"/command",{method:"POST",headers:{...auth,"content-type":"application/json"},body:JSON.stringify({type:"navigate",url:"https://youtube.com"})});
  assert.equal(blocked.status,400);
  const after=await(await fetch(bridge.url+"/state",{headers:auth})).json();
  assert.equal(after.activeTab,"youtube");
  assert.equal(after.externalRequests,0);
  assert.equal(after.productionWritesAllowed,false);
 }finally{await bridge.close();}
});
