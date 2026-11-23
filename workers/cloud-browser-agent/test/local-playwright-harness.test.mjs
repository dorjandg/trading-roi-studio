// This test runs separately in CI with an actual local Chromium process.
import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createLocalPlaywrightHarness} from "../simulation/local-playwright-harness.mjs";
test("real Chromium performs approved local click and fill only",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 try {
  const click={kind:"click",testId:"open-menu"}, fill={kind:"fill",testId:"search-input",value:"gold"};
  const c=h.approve(click);
  const receipt=await h.perform(click,c);
  assert.equal(receipt.executedInDisposableFixture,true);
  assert.equal(receipt.sequence,1);
  assert.equal(receipt.proposalDigest.length,64);
  await assert.rejects(h.perform(click,c),/One-time approval/);
  const f=h.approve(fill);
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
  const token=h.approve(fill);
  await assert.rejects(h.perform({...fill,value:"changed"},token),/does not match/);
  await assert.rejects(h.perform(fill,token),/One-time approval/);
  assert.equal(await h.read("search-input"),"");
  assert.throws(()=>h.approve({kind:"click",testId:"submitOrder"}));
 }finally{await h.close();}
});
test("arbitrary browser targets and URLs are never accepted",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 try {
  const bad={kind:"click",testId:"open-menu",url:"https://example.com"};
  await assert.rejects(h.perform(bad,h.approve({kind:"click",testId:"open-menu"})));
 }finally{await h.close();}
});

test("fixture navigation is blocked and never receives an audit success receipt",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 try {
  const p={kind:"click",testId:"navigate-test"};
  const token=h.approve(p);
  await assert.rejects(h.perform(p,token),/Unsafe fixture action prevented/);
  assert.equal(h.auditReceipts().length,0);
  await assert.rejects(h.perform(p,token),/One-time approval/);
 }finally{await h.close();}
});
test("failed approvals leave no audit success and receipts are isolated per session",async()=>{
 const first=await createLocalPlaywrightHarness(chromium);
 const second=await createLocalPlaywrightHarness(chromium);
 try {
  const p={kind:"fill",testId:"search-input",value:"local"};
  const token=first.approve(p);
  await first.perform(p,token);
  assert.equal(first.auditReceipts().length,1);
  assert.equal(second.auditReceipts().length,0);
  await assert.rejects(second.perform(p,token),/One-time approval/);
 }finally{await first.close();await second.close();}
});

test("session-bound approval cannot be used by another browser session",async()=>{
 const first=await createLocalPlaywrightHarness(chromium);
 const second=await createLocalPlaywrightHarness(chromium);
 try {
  const p={kind:"fill",testId:"search-input",value:"owned"};
  const token=first.approve(p);
  await assert.rejects(second.perform(p,token),/One-time approval/);
  assert.equal(await second.read("search-input"),"");
  const receipt=await first.perform(p,token);
  assert.equal(receipt.sequence,1);
 }finally{await first.close();await second.close();}
});
test("concurrent requests cannot execute using the same approval",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 try {
  const p={kind:"fill",testId:"search-input",value:"once"};
  const token=h.approve(p);
  const results=await Promise.allSettled([h.perform(p,token),h.perform(p,token)]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(results.filter(r=>r.status==="rejected").length,1);
  assert.equal(h.auditReceipts().length,1);
 }finally{await h.close();}
});
test("dialog side effect blocks receipt and consumes approval",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 try {
  const p={kind:"click",testId:"dialog-test"};
  const token=h.approve(p);
  await assert.rejects(h.perform(p,token),/Unsafe fixture action prevented/);
  assert.equal(h.auditReceipts().length,0);
  await assert.rejects(h.perform(p,token),/One-time approval/);
 }finally{await h.close();}
});

test("closing session rejects approvals and action attempts",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 await h.close();
 assert.throws(()=>h.approve({kind:"click",testId:"open-menu"}),/Harness closed/);
 await assert.rejects(h.perform({kind:"click",testId:"open-menu"},{}),/Harness closed/);
 await h.close();
});
test("an approval is never valid outside the issuing session",async()=>{
 const first=await createLocalPlaywrightHarness(chromium);
 const second=await createLocalPlaywrightHarness(chromium);
 try {
  const p={kind:"click",testId:"open-menu"};
  const token=first.approve(p);
  await assert.rejects(second.perform(p,token),/One-time approval/);
  assert.equal(second.auditReceipts().length,0);
  assert.equal((await first.perform(p,token)).sequence,1);
 }finally{await first.close();await second.close();}
});

test("pre-aborted action does not touch disposable input",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 try {
  const p={kind:"fill",testId:"search-input",value:"never"};
  const controller=new AbortController();
  controller.abort();
  const token=h.approve(p);
  await assert.rejects(h.perform(p,token,{signal:controller.signal}),/Fixture action cancelled/);
  assert.equal(await h.read("search-input"),"");
  assert.equal(h.auditReceipts().length,0);
 }finally{await h.close();}
});
test("cancellation during settling prevents a successful receipt",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 try {
  const p={kind:"fill",testId:"search-input",value:"temporary"};
  const controller=new AbortController();
  const token=h.approve(p);
  const pending=h.perform(p,token,{signal:controller.signal});
  controller.abort();
  await assert.rejects(pending,/Fixture action cancelled/);
  assert.equal(h.auditReceipts().length,0);
 }finally{await h.close();}
});
test("unrecognized cancellation options fail closed",async()=>{
 const h=await createLocalPlaywrightHarness(chromium);
 try {
  const p={kind:"click",testId:"open-menu"};
  await assert.rejects(h.perform(p,h.approve(p),{signal:"not-a-signal"}),/Invalid cancellation signal/);
  assert.equal(h.auditReceipts().length,0);
 }finally{await h.close();}
});
