// Disposable browser test harness ONLY. Never imported by worker/MCP runtime.
// The harness owns its page; it accepts no URLs, existing pages, or network access.
import {validateInteractionProposal} from "../src/interaction-policy.mjs";
import {prepareBrowserInteraction} from "./browser-interaction-adapter.mjs";
const approvals=new WeakSet();
const fixtureHTML=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"></head><body><button type="button" data-testid="open-menu">Menu</button><input type="search" data-testid="search-input"><output id="status">closed</output></body></html>`;
export function approveFixtureAction(proposal) {
 const validated=validateInteractionProposal(proposal);
 const token=Object.freeze({kind:validated.kind,testId:validated.testId,value:validated.kind==="fill"?validated.value:null});
 approvals.add(token);
 return token;
}
export async function createLocalPlaywrightHarness(chromium) {
 if(!chromium || typeof chromium.launch!=="function")throw new Error("Chromium required");
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({serviceWorkers:"block",acceptDownloads:false});
 await context.route("**/*",route=>route.abort());
 const page=await context.newPage();
 await page.goto("about:blank");
 await page.setContent(fixtureHTML,{waitUntil:"domcontentloaded"});
 let closed=false;
 return Object.freeze({
  async perform(proposal,token) {
   if(closed)throw new Error("Harness closed");
   const validated=validateInteractionProposal(proposal);
   if(!token || !approvals.has(token))throw new Error("One-time approval required");
   approvals.delete(token);
   if(token.kind!==validated.kind || token.testId!==validated.testId ||
      token.value!==(validated.kind==="fill"?validated.value:null))throw new Error("Approval does not match action");
   if(page.url()!=="about:blank")throw new Error("Fixture origin changed");
   await prepareBrowserInteraction(page,proposal,{approved:true,scope:"isolated-browser-test"});
   const locator=page.getByTestId(validated.testId);
   if(validated.kind==="click")await locator.click({timeout:1000});
   else await locator.fill(validated.value,{timeout:1000});
   if(page.url()!=="about:blank")throw new Error("Fixture navigation forbidden");
   return Object.freeze({executedInDisposableFixture:true,productionWritesAllowed:false,kind:validated.kind});
  },
  async read(testId) {
   if(closed)throw new Error("Harness closed");
   if(testId==="search-input")return page.getByTestId(testId).inputValue();
   if(testId==="open-menu")return page.getByTestId(testId).evaluate(el=>el.dataset.testid);
   throw new Error("Unknown fixture field");
  },
  async close(){if(!closed){closed=true;await context.close();await browser.close();}}
 });
}
