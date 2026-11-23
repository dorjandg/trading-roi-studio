import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createMultiTabViewerSession} from "../simulation/multi-tab-viewer-session.mjs";
import {createPrivateBrowserGateway} from "../simulation/private-browser-gateway.mjs";
import {createReadOnlyViewerRelay} from "../simulation/read-only-viewer-relay.mjs";
import {createMockViewerIngress} from "../simulation/mock-viewer-ingress.mjs";

// Browser-level CI acceptance: the controls must work in an actual authenticated
// Chromium page, not merely exist in a JavaScript string or accept API commands.
test("CI-only authenticated viewer switches persistent Chromium tabs through its UI", {timeout: 90000}, async()=>{
 const gateway=await createPrivateBrowserGateway(chromium,{sessionFactory:createMultiTabViewerSession});
 let relay,ingress,browser;
 try{
  relay=await createReadOnlyViewerRelay(gateway);
  ingress=await createMockViewerIngress(relay,{controllerGateway:gateway});
  browser=await chromium.launch({headless:true});
  const login=async (bootstrap)=>{
   const response=await fetch(ingress.url+"/mock-login",{method:"POST",headers:{"x-mock-bootstrap":bootstrap}});
   assert.equal(response.status,200);
   const context=await browser.newContext();
   await context.addCookies(response.headers.getSetCookie().map(header=>{
    const [name,value]=header.split(";")[0].split("=");
    return {name,value,url:ingress.url,sameSite:"Strict"};
   }));
   return context;
  };
  const controller=await login(ingress.mockControlBootstrap);
  const page=await controller.newPage();
  const documentResponse=await page.goto(ingress.url+"/");
  assert.match(documentResponse.headers()["content-security-policy"],/img-src .*blob:/);
  await assert.doesNotReject(()=>page.locator("#tabs button").first().waitFor());
  assert.equal(await page.locator("#tabs button").count(),4);
  await page.getByRole("button",{name:"youtube",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector("#url")?.textContent?.includes("youtube.example.invalid"));
  assert.equal((await(await fetch(ingress.url+"/api/state",{headers:{cookie:(await controller.cookies()).map(c=>c.name+"="+c.value).join("; ")}})).json()).activeTab,"youtube");
  await page.getByRole("button",{name:"github",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector("#url")?.textContent?.includes("github.example.invalid"));
  await page.waitForFunction(()=>{const img=document.querySelector("#frame");return img?.complete&&img.naturalWidth>0;});
  const viewer=await login(ingress.mockBootstrap);
  const readOnlyPage=await viewer.newPage();
  await readOnlyPage.goto(ingress.url+"/");
  await readOnlyPage.getByRole("button",{name:"staging",exact:true}).click();
  await readOnlyPage.getByText("Viewer-only permission").waitFor();
  const after=await fetch(ingress.url+"/api/state",{headers:{cookie:(await viewer.cookies()).map(c=>c.name+"="+c.value).join("; ")}});
  assert.equal((await after.json()).activeTab,"github");
  await viewer.close();
  await controller.close();
 }finally{
  if(browser)await browser.close();
  if(ingress)await ingress.close();
  if(relay)await relay.close();
  await gateway.close();
 }
});
