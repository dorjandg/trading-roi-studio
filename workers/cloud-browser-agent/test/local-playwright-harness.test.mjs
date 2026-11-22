// This test runs separately in CI with an actual local Chromium process.
import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {approveFixtureAction,createLocalPlaywrightHarness} from "../simulation/local-playwright-harness.mjs";
test("real Chromium performs approved local click and fill only",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 try {
  const click={kind:"click",testId:"open-menu"}, fill={kind:"fill",testId:"search-input",value:"gold"};
  const c=approveFixtureAction(click);
  assert.equal((await h.perform(click,c)).executedInDisposableFixture,true);
  await assert.rejects(h.perform(click,c),/One-time approval/);
  const f=approveFixtureAction(fill);
  await h.perform(fill,f);
  assert.equal(await h.read("search-input"),"gold");
 }finally{await h.close();}
});
test("missing, mismatched and unsafe approvals cannot change fixture",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 try {
  const fill={kind:"fill",testId:"search-input",value:"safe"};
  await assert.rejects(h.perform(fill,undefined),/approval/);
  const token=approveFixtureAction(fill);
  await assert.rejects(h.perform({...fill,value:"changed"},token),/does not match/);
  await assert.rejects(h.perform(fill,token),/One-time approval/);
  assert.equal(await h.read("search-input"),"");
  assert.throws(()=>approveFixtureAction({kind:"click",testId:"submitOrder"}));
 }finally{await h.close();}
});
test("arbitrary browser targets and URLs are never accepted",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 try {
  const bad={kind:"click",testId:"open-menu",url:"https://example.com"};
  await assert.rejects(h.perform(bad,approveFixtureAction({kind:"click",testId:"open-menu"})));
 }finally{await h.close();}
});
