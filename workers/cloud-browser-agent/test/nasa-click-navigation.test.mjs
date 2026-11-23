import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {runNasaClickNavigation} from "../simulation/nasa-click-navigation.mjs";
test("real Chromium clicks an internal NASA link, changes page, and captures PNG",async()=>{
 let external=0;
 const fixture=route=>{
  const req=route.request(),u=new URL(req.url());
  if(req.method()!=="GET"||u.hostname!=="science.nasa.gov"){external++;return route.abort();}
  const page=u.pathname==="/mission/webb/"?"Home":"Science";
  return route.fulfill({status:200,contentType:"text/html",body:`<!doctype html><title>${page}</title><h1>${page}</h1><a href="/mission/webb/science/">Science</a>`});
 };
 const result=await runNasaClickNavigation(chromium,{fixture,timeoutMs:10000});
 assert.equal(result.before,"https://science.nasa.gov/mission/webb/");
 assert.equal(result.after,"https://science.nasa.gov/mission/webb/science/");
 assert.equal(result.linkText,"Science");
 assert.equal(external,0);
 assert.deepEqual([...Buffer.from(result.screenshot,"base64").subarray(0,8)],[137,80,78,71,13,10,26,10]);
});
test("external links are never selected for clicking",async()=>{
 const fixture=route=>route.fulfill({status:200,contentType:"text/html",body:'<a href="https://example.org/">External</a>'});
 await assert.rejects(runNasaClickNavigation(chromium,{fixture,timeoutMs:10000}),/No safe internal navigation link/);
});
