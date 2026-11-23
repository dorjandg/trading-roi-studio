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
  const receipt=await h.perform(click,c);
  assert.equal(receipt.executedInDisposableFixture,true);
  assert.equal(receipt.sequence,1);
  assert.equal(receipt.proposalDigest.length,64);
  await assert.rejects(h.perform(click,c),/One-time approval/);
  const f=approveFixtureAction(fill);
  const fillReceipt=await h.perform(fill,f);
  assert.equal(fillReceipt.sequence,2);
  assert.equal(fillReceipt.sessionId,receipt.sessionId);
  assert.equal(h.auditReceipts().length,2);
  assert.equal(Object.isFrozen(h.auditReceipts()[0]),true);
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

test("fixture navigation is blocked and never receives an audit success receipt",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 try {
  const p={kind:"click",testId:"navigate-test"};
  const token=approveFixtureAction(p);
  await assert.rejects(h.perform(p,token),/Fixture navigation forbidden/);
  assert.equal(h.auditReceipts().length,0);
  await assert.rejects(h.perform(p,token),/One-time approval/);
 }finally{await h.close();}
});
test("failed approvals leave no audit success and receipts are isolated per session",async()=>{
 const first=await createLocalPlaywrightHarness(chromium);
 const second=await createLocalPlaywrightHarness(chromium);
 try {
  const p={kind:"fill",testId:"search-input",value:"local"};
  const token=approveFixtureAction(p);
  await first.perform(p,token);
  assert.equal(first.auditReceipts().length,1);
  assert.equal(second.auditReceipts().length,0);
  await assert.rejects(second.perform(p,token),/One-time approval/);
 }finally{await first.close();await second.close();}
});
