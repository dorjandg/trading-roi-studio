import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {runAutomaticSyntheticBrowser,AUTO_BROWSER_LABELS} from "../simulation/automatic-synthetic-browser-demo.mjs";
test("automatic synthetic browser navigates all four tabs without manual actions or network",async()=>{
 const result=await runAutomaticSyntheticBrowser(chromium);
 assert.deepEqual([...result.labels],["Google","YouTube","GitHub","JP Realty"]);
 assert.deepEqual(result.frames.map(f=>f.tab),["google","youtube","github","staging"]);
 assert.equal(result.frames.length,4);
 assert.equal(result.networkRequests,0);
 assert.equal(result.live,false);
 assert.equal(result.readOnly,true);
 assert.deepEqual(result.events.map(e=>e.type),["session-start","tab-switch","tab-switch","tab-switch"]);
 for(const frame of result.frames){
  const png=Buffer.from(frame.pngBase64,"base64");
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.ok(png.length>1000&&png.length<2_000_000);
 }
});
