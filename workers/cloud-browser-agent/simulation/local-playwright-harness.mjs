// Disposable browser test harness ONLY. Never imported by worker/MCP runtime.
// The harness owns its page; it accepts no URLs, existing pages, or network access.
import {validateInteractionProposal} from "../src/interaction-policy.mjs";
import {prepareBrowserInteraction} from "./browser-interaction-adapter.mjs";
import {createHash,randomUUID} from "node:crypto";
const approvals=new WeakMap();
const digest=proposal=>createHash("sha256").update(JSON.stringify(proposal)).digest("hex");
const fixtureHTML=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"></head><body><button type="button" data-testid="open-menu">Menu</button><button type="button" data-testid="navigate-test">Navigation test</button><button type="button" data-testid="dialog-test">Dialog test</button><input type="search" data-testid="search-input"><output id="status">closed</output></body></html>`;
export async function createLocalPlaywrightHarness(chromium) {
 if(!chromium || typeof chromium.launch!=="function")throw new Error("Chromium required");
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({serviceWorkers:"block",acceptDownloads:false});
 await context.route("**/*",route=>{networkRequests++;return route.abort();});
 const page=await context.newPage();
 const sessionId=randomUUID();
 const receipts=[];
 let busy=false;
 let blockedEvents=0;
 page.on("dialog",dialog=>{blockedEvents++;void dialog.dismiss().catch(()=>{});});
 page.on("popup",popup=>{blockedEvents++;void popup.close().catch(()=>{});});
 page.on("download",download=>{blockedEvents++;void download.cancel().catch(()=>{});});
 let navigationAttempted=false;
 let networkRequests=0;
 page.on("framenavigated",frame=>{if(frame===page.mainFrame()&&frame.url()!=="about:blank")navigationAttempted=true;});
 await page.goto("about:blank");
 await page.setContent(fixtureHTML,{waitUntil:"domcontentloaded"});
 await page.getByTestId("navigate-test").evaluate(el=>el.addEventListener("click",()=>{location.href="https://example.com/forbidden"}));
 await page.getByTestId("dialog-test").evaluate(el=>el.addEventListener("click",()=>alert("blocked")));
 let closed=false;
 let closing=null;
 let activeAction=null;
 let poisoned=false;
 return Object.freeze({
  approve(proposal){
   if(closed || closing || poisoned)throw new Error("Harness closed");
   const validated=validateInteractionProposal(proposal);
   const token=Object.freeze({kind:validated.kind,testId:validated.testId,value:validated.kind==="fill"?validated.value:null});
   approvals.set(token,{sessionId});
   return token;
  },
  async perform(proposal,token,options={}) {
   if(closed || closing || poisoned)throw new Error("Harness closed");
   if(busy)throw new Error("Concurrent fixture action rejected");
   busy=true;
   let finishAction;
   activeAction=new Promise(resolve=>{finishAction=resolve;});
   let dispatched=false;
   try {
   if(!options || Object.getPrototypeOf(options)!==Object.prototype || Object.keys(options).some(k=>k!=="signal"))throw new Error("Invalid action options");
   const signal=options.signal;
   if(signal!==undefined && (!(signal instanceof AbortSignal)))throw new Error("Invalid cancellation signal");
   if(signal?.aborted)throw new Error("Fixture action cancelled");
   const validated=validateInteractionProposal(proposal);
   const grant=token && approvals.get(token);
   if(!grant || grant.sessionId!==sessionId)throw new Error("One-time approval required");
   approvals.delete(token);
   if(token.kind!==validated.kind || token.testId!==validated.testId ||
      token.value!==(validated.kind==="fill"?validated.value:null))throw new Error("Approval does not match action");
   if(page.url()!=="about:blank" || navigationAttempted)throw new Error("Fixture origin changed");
   // Only known inert fixture controls can be actuated. Test-only hostile controls never run.
   if((validated.kind==="click" && validated.testId!=="open-menu") ||
      (validated.kind==="fill" && validated.testId!=="search-input"))throw new Error("Unsafe fixture action prevented");
   const beforeEvents=blockedEvents;
   await prepareBrowserInteraction(page,proposal,{approved:true,scope:"isolated-browser-test"});
   if(signal?.aborted || closed || closing)throw new Error("Fixture action cancelled");
   const locator=page.getByTestId(validated.testId);
   dispatched=true;
   if(validated.kind==="click")await locator.click({timeout:1000});
   else await locator.fill(validated.value,{timeout:1000});
   await page.waitForTimeout(100);
   if(signal?.aborted || closed || closing)throw new Error("Fixture action cancelled");
   if(page.url()!=="about:blank" || navigationAttempted || networkRequests>0 || blockedEvents!==beforeEvents)throw new Error("Fixture navigation forbidden or browser event forbidden");
   const receipt=Object.freeze({id:randomUUID(),sessionId,sequence:receipts.length+1,kind:validated.kind,testId:validated.testId,proposalDigest:digest(validated),executedInDisposableFixture:true,productionWritesAllowed:false});
   receipts.push(receipt);
   return receipt;
   } catch(error) {if(dispatched)poisoned=true;throw error;} finally {busy=false;finishAction();activeAction=null;}
  },
  auditReceipts(){return Object.freeze([...receipts]);},
  async read(testId) {
   if(closed)throw new Error("Harness closed");
   if(testId==="search-input")return page.getByTestId(testId).inputValue();
   if(testId==="open-menu")return page.getByTestId(testId).evaluate(el=>el.dataset.testid);
   throw new Error("Unknown fixture field");
  },
  async close(){if(!closing){closed=true;closing=(async()=>{if(activeAction)await activeAction;await context.close();await browser.close();})();}await closing;}
 });
}
