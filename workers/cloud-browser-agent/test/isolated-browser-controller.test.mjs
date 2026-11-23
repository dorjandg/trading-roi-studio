import test from "node:test";
import assert from "node:assert/strict";
import {createIsolatedBrowserController} from "../simulation/isolated-browser-controller.mjs";
test("scoped control grants drive only approved browser actions and record audit",async()=>{
 let sequence=0;
 const calls=[];
 const session={state:()=>({sequence}),search:async term=>{calls.push(["search",term]);sequence++;},click:async href=>{calls.push(["click",href]);sequence++;},back:async()=>{calls.push(["back"]);sequence++;}};
 const c=createIsolatedBrowserController(session);
 const read=c.issueReadGrant();
 assert.equal(c.read(read).sequence,0);
 await assert.rejects(c.execute(read,{type:"back"}),/Unauthorized/);
 const grant=c.issueControlGrant();
 assert.equal((await c.execute(grant,{type:"search",term:"James Webb"})).sequence,1);
 await assert.rejects(c.execute(grant,{type:"back"}),/grant used/);
 await assert.rejects(c.execute(c.issueControlGrant(),{type:"upload",file:"a"}),/Command refused/);
 assert.deepEqual(c.audit().map(x=>x.type),["search"]);
 c.close();
 assert.throws(()=>c.read(read),/Unauthorized/);
});
