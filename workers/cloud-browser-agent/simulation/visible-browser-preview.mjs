// Offline screenshot preview prototype. No URL input, network, staging credentials or website actions.
// Never imported by deployed Worker/MCP code.
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font-family:system-ui;background:#f4f7fa;color:#142b42;margin:0}.top{background:#183451;color:white;padding:18px 28px}main{margin:30px auto;max-width:850px;background:white;border:1px solid #dbe3ea;border-radius:14px;padding:32px}h1{margin-top:0}.pill{display:inline-block;background:#e5f2ed;color:#22634c;border-radius:24px;padding:7px 12px}.box{border:1px solid #cdd9e5;padding:16px;border-radius:8px;margin-top:20px}</style></head><body><div class="top">API 1 · Isolated Browser Preview</div><main><span class="pill">READ ONLY · LOCAL FIXTURE</span><h1>Visible browser preview</h1><p>This is a screenshot of a disposable local HTML fixture, not a live website or embedded browser window.</p><div class="box"><strong>Safety</strong><p>No navigation, login, form submission, or website modification.</p></div></main></body></html>`;
export async function captureOfflineBrowserPreview(chromium,outputDirectory){
 if(!chromium||typeof chromium.launch!=="function")throw Error("Chromium required");
 if(typeof outputDirectory!=="string"||!outputDirectory.startsWith("/")||outputDirectory.includes("\0"))throw Error("Absolute output directory required");
 const dir=resolve(outputDirectory);
 await mkdir(dir,{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1024,height:768},serviceWorkers:"block",acceptDownloads:false});
  try{
   let attempted=0;
   await context.route("**/*",route=>{attempted++;return route.abort();});
   const page=await context.newPage();
   await page.goto("about:blank");
   await page.setContent(fixture,{waitUntil:"domcontentloaded"});
   if(page.url()!=="about:blank"||attempted!==0)throw Error("Offline fixture boundary violated");
   const path=resolve(dir,"api1-local-browser-preview.png");
   await page.screenshot({path,fullPage:true,animations:"disabled"});
   return Object.freeze({path,source:"DISPOSABLE_LOCAL_FIXTURE",networkRequests:attempted,readOnly:true,embeddedBrowser:false,productionWritesAllowed:false});
  }finally{await context.close();}
 }finally{await browser.close();}
}
