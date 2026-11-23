import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {runPublicSearchPrototype} from "../simulation/public-search-browser-prototype.mjs";
const fixture=async route=>{
 const u=new URL(route.request().url());
 if(route.request().method()!=="GET"||!["www.google.com","science.nasa.gov"].includes(u.hostname))return route.abort();
 const heading=u.hostname==="science.nasa.gov"?"NASA Webb":u.searchParams.get("udm")==="2"?"Google Images":u.pathname==="/search"?"Google Search":"Google Home";
 return route.fulfill({status:200,contentType:"text/html",body:`<!doctype html><title>${heading}</title><h1>${heading}</h1>`});
};
test("four real HTTPS destinations are navigated in Chromium using offline CI fixtures",async()=>{
 const result=await runPublicSearchPrototype(chromium,{routeFixture:fixture,timeoutMs:10000});
 assert.deepEqual(result.steps.map(s=>s.label),["Google home","Google results","Google Images","Official NASA result"]);
 assert.deepEqual(result.steps.map(s=>s.title),["Google Home","Google Search","Google Images","NASA Webb"]);
 assert.equal(result.readOnly,true);
 assert.equal(result.productionWritesAllowed,false);
 assert.equal(result.screenshots.length,4);
 for(const shot of result.screenshots){
  const b=Buffer.from(shot.pngBase64,"base64");
  assert.deepEqual([...b.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 }
});
test("invalid queries and timeouts are rejected before Chromium launch",async()=>{
 const forbidden={launch:()=>{throw Error("Browser must not launch");}};
 await assert.rejects(runPublicSearchPrototype(forbidden,{query:"\n"}),/Invalid query/);
 await assert.rejects(runPublicSearchPrototype(forbidden,{timeoutMs:1}),/Invalid timeout/);
});
test("fixture redirects to unapproved public sites are rejected before screenshot",async()=>{
 const redirect=async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==="www.google.com")return route.fulfill({status:302,headers:{location:"https://example.org/"}});
  return route.abort();
 };
 await assert.rejects(runPublicSearchPrototype(chromium,{routeFixture:redirect,timeoutMs:5000}));
});
