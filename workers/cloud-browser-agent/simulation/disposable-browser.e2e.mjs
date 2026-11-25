import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {startDisposableSite} from "./disposable-site.mjs";

test("real Chromium browser performs approved disposable-site edit and rollback",async()=>{
 const fixture=await startDisposableSite();
 let browser;
 try {
  browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext();
  // No browser request can leave the disposable localhost server.
  await ctx.route("**/*",route=>{
   const u=new URL(route.request().url());
   if(u.origin!==fixture.url)return route.abort("blockedbyclient");
   return route.continue();
  });
  const page=await ctx.newPage();
  await page.goto(fixture.url,{waitUntil:"load"});
  assert.equal(await page.locator("#current-title").textContent(),"Original test title");
  await page.locator("#next-value").fill("Approved disposable title");
  await page.getByRole("button",{name:"Create proposal"}).click();
  await page.waitForFunction(()=>document.querySelector("#status").textContent==="PROPOSED");
  assert.equal(await page.locator("#current-title").textContent(),"Original test title");
  await page.getByRole("button",{name:"Approve as independent reviewer"}).click();
  await page.waitForFunction(()=>document.querySelector("#status").textContent==="APPROVED");
  await page.getByRole("button",{name:"Apply approved fixture edit"}).click();
  await page.waitForFunction(()=>document.querySelector("#status").textContent==="EXECUTED");
  assert.equal(await page.locator("#current-title").textContent(),"Approved disposable title");
  assert.equal(await page.locator("#revision").textContent(),"2");
  // A second browser session cannot execute a grant that has already been consumed.
  const events=await (await ctx.request.get(fixture.url+"/api/events")).json();
  const id=events.events[0].proposalId,digest=events.events[0].digest;
  const replay=await ctx.request.post(fixture.url+"/api/execute",{
    headers:{"Content-Type":"application/json","X-Test-Actor":"creator-01"},
    data:{proposalId:id,digest,requestId:"request-02",expectedRevision:2}
  });
  assert.equal(replay.status(),400);
  assert.equal((await replay.json()).code,"APPROVAL_REQUIRED_OR_USED");
  await page.getByRole("button",{name:"Rollback fixture edit"}).click();
  await page.waitForFunction(()=>document.querySelector("#status").textContent==="ROLLED_BACK");
  assert.equal(await page.locator("#current-title").textContent(),"Original test title");
  assert.equal(await page.locator("#revision").textContent(),"3");
  const audit=await (await ctx.request.get(fixture.url+"/api/events")).json();
  assert.equal(audit.verified,true);
  assert.deepEqual(audit.events.map(x=>x.kind),["PROPOSED","APPROVED","EXECUTED","ROLLED_BACK"]);
  assert.equal(JSON.stringify(audit).includes("Approved disposable title"),false);
  await ctx.close();
 } finally {
  await browser?.close();
  await fixture.close();
 }
});

test("disposable server denies unapproved and arbitrary requests",async()=>{
 const fixture=await startDisposableSite();
 try{
  const unapproved=await fetch(fixture.url+"/api/execute",{method:"POST",headers:{"Content-Type":"application/json","X-Test-Actor":"creator-01"},body:JSON.stringify({proposalId:"fake",digest:"0".repeat(64),requestId:"request-01",expectedRevision:1})});
  assert.equal(unapproved.status,400);
  const forbidden=await fetch(fixture.url+"/api/propose",{method:"POST",headers:{"Content-Type":"application/json","X-Test-Actor":"reviewer-02"},body:JSON.stringify({nextValue:"Not allowed"})});
  assert.equal(forbidden.status,400);
  const unexpected=await fetch(fixture.url+"/api/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  assert.equal(unexpected.status,404);
  assert.deepEqual(fixture.lab.inspect("fixture:title"),{value:"Original test title",revision:1});
 }finally{await fixture.close();}
});
