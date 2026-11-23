import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createPersistentVisualSession} from "../simulation/persistent-visual-session.mjs";
test("persistent Chromium tabs provide ordered live PNG frames and independent history",async()=>{
 const session=await createPersistentVisualSession(chromium);
 try{
  assert.deepEqual(session.tabs(),["google","youtube","github","staging"]);
  const first=await session.frame();
  assert.equal(first.tab,"google");
  assert.equal(first.sequence,1);
  assert.deepEqual([...first.png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  await session.navigate(1);
  const second=await session.frame();
  assert.equal(second.page,"Search results");
  assert.ok(second.sequence>first.sequence);
  assert.notDeepEqual(second.png,first.png);
  await session.switchTab("youtube");
  await session.navigate(2);
  assert.equal((await session.frame()).page,"Videos");
  await session.switchTab("google");
  assert.equal((await session.frame()).page,"Search results");
  await session.history(-1);
  assert.equal((await session.frame()).page,"Home");
  await session.history(1);
  assert.equal((await session.frame()).page,"Search results");
  assert.equal(session.state().externalRequests,0);
  assert.equal(session.state().productionWritesAllowed,false);
  assert.deepEqual(session.events().map(e=>e.sequence),[1,2,3,4,5,6,7]);
  await assert.rejects(session.navigate(99),/Unknown fixture page/);
  await assert.rejects(session.switchTab("https://youtube.com"),/Unknown tab/);
 }finally{await session.close();}
 await assert.rejects(session.frame(),/Session closed/);
});
test("session rejects missing Chromium before launch",async()=>{
 await assert.rejects(createPersistentVisualSession(null),/Chromium required/);
});
