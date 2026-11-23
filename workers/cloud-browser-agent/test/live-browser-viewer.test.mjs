import test from "node:test";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
const file=fileURLToPath(new URL("../simulation/live-browser-viewer.html",import.meta.url));
test("offline multi-tab viewer navigates independently with back and forward",async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({serviceWorkers:"block",acceptDownloads:false});
  let external=0;
  await context.route("**/*",route=>{if(!route.request().url().startsWith("file:")){external++;return route.abort();}return route.continue();});
  const page=await context.newPage();
  await page.goto("file://"+file);
  assert.match(await page.locator("#address").innerText(),/google\.example\.invalid\/home/);
  await page.getByRole("button",{name:"Search results"}).click();
  assert.match(await page.locator("#address").innerText(),/search-results/);
  await page.getByRole("button",{name:"YouTube"}).click();
  assert.match(await page.locator("#address").innerText(),/youtube\.example\.invalid\/home/);
  await page.getByRole("button",{name:"Channels"}).click();
  await page.getByRole("button",{name:"Google"}).click();
  assert.match(await page.locator("#address").innerText(),/search-results/);
  await page.getByRole("button",{name:"Back"}).click();
  assert.match(await page.locator("#address").innerText(),/\/home$/);
  await page.getByRole("button",{name:"Forward"}).click();
  assert.match(await page.locator("#address").innerText(),/search-results/);
  assert.equal(external,0);
  assert.match(await page.frameLocator("#view").locator("body").innerText(),/offline illustration/);
  assert.equal(await page.locator("#view").getAttribute("sandbox"),"");
  await context.close();
 }finally{await browser.close();}
});
