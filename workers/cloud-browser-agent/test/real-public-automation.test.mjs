import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {runRealWikipediaAutomation} from "../simulation/real-public-automation.mjs";
import {createRealPublicAutomationApi} from "../simulation/real-public-automation-api.mjs";
const query="James Webb Space Telescope";
const fixture=route=>{
 const req=route.request(),u=new URL(req.url());
 assert.equal(req.method(),"GET");
 assert.equal(u.hostname,"en.wikipedia.org");
 if(u.pathname==="/wiki/Main_Page")return route.fulfill({status:200,contentType:"text/html",
  body:'<!doctype html><html><head><title>Wikipedia Home</title></head><body><h1>Main Page</h1><form method="get" action="/wiki/Special:Search"><input name="search" type="search"><button>Search</button></form><img src="https://unsafe.example.invalid/pixel"></body></html>'});
 if(u.pathname==="/wiki/Special:Search")return route.fulfill({status:200,contentType:"text/html",
  body:'<!doctype html><title>Search results</title><h1>Search results</h1><main id="mw-content-text"><a href="https://unsafe.example.invalid/bad">Bad external link</a><a href="/wiki/James_Webb_Space_Telescope">James Webb Space Telescope</a></main>'});
 if(u.pathname==="/wiki/James_Webb_Space_Telescope")return route.fulfill({status:200,contentType:"text/html",
  body:'<!doctype html><title>James Webb Space Telescope</title><h1>James Webb Space Telescope</h1><main id="mw-content-text"><p>The James Webb Space Telescope is a large, space-based observatory constructed to study the universe and its earliest galaxies.</p></main>'});
 return route.abort();
};
const png=base64=>Buffer.from(base64,"base64").subarray(0,8).toString("hex");
test("real Chromium fills a GET search field, clicks a Wikipedia result, extracts text and screenshots",async()=>{
 const result=await runRealWikipediaAutomation(chromium,{query,routeFixture:fixture,timeoutMs:12000});
 assert.equal(result.status,"passed");
 assert.equal(result.searchedWithVisibleInput,true);
 assert.deepEqual(result.steps.map(x=>x.action),["navigate","search","click"]);
 assert.match(result.steps[1].url,/^https:\/\/en\.wikipedia\.org\/wiki\//);
 assert.notEqual(result.steps[1].url,result.steps[0].url);
 assert.match(result.clickedLink.href,/James_Webb_Space_Telescope/);
 assert.notEqual(new URL(result.steps[1].url).pathname,new URL(result.steps[2].url).pathname);
 assert.equal(result.clickedLink.href.includes("#"),false);
 assert.match(result.extracted.heading,/James Webb/);
 assert.match(result.extracted.paragraphs[0],/earliest galaxies/);
 assert.equal(result.productionWritesAllowed,false);
 assert.equal(result.thirdPartyAutomationUsed,false);
 assert.equal(result.screenshots.length,3);
 for(const shot of result.screenshots)assert.equal(png(shot.base64),"89504e470d0a1a0a");
});
test("isolated API requires token, rejects arbitrary tasks, and returns complete structured live-browser result",async()=>{
 const api=await createRealPublicAutomationApi(chromium,{routeFixture:fixture,timeoutMs:12000});
 try{
  const url=api.url;
  assert.match(url,/^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal((await fetch(url+"/health")).status,401);
  const headers={authorization:"Bearer "+api.apiKey,"content-type":"application/json"};
  assert.equal((await fetch(url+"/health",{headers:{authorization:"Bearer "+api.apiKey}})).status,200);
  assert.equal((await fetch(url+"/run",{method:"POST",headers,body:JSON.stringify({task:"arbitrary-url",query})})).status,400);
  assert.equal((await fetch(url+"/run",{method:"POST",headers,body:JSON.stringify({task:"wikipedia-demo",query:"https://evil.invalid"})})).status,400);
  assert.equal((await fetch(url+"/run",{method:"POST",headers:{...headers,origin:"https://evil.invalid"},body:JSON.stringify({task:"wikipedia-demo",query})})).status,403);
  assert.equal((await fetch(url+"/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task:"wikipedia-demo",query})})).status,401);
  const response=await fetch(url+"/run",{method:"POST",headers,body:JSON.stringify({task:"wikipedia-demo",query})});
  assert.equal(response.status,200);
  assert.equal(response.headers.get("cache-control"),"no-store");
  const result=await response.json();
  assert.equal(result.status,"passed");
  assert.equal(result.task,"wikipedia-demo");
  assert.deepEqual(result.steps.map(s=>s.action),["navigate","search","click"]);
  assert.ok(result.extracted.paragraphs.length>0);
  assert.notEqual(new URL(result.steps[1].url).pathname,new URL(result.steps[2].url).pathname);
  assert.equal(png(result.screenshots[2].base64),"89504e470d0a1a0a");
  assert.equal(result.productionWritesAllowed,false);
 }finally{await api.close();}
});
test("invalid request fails before launching Chromium",async()=>{
 let launches=0;
 const forbidden={launch:()=>{launches++;throw Error("Should never launch");}};
 await assert.rejects(runRealWikipediaAutomation(forbidden,{query:"https://example.com"}),/Invalid search query/);
 await assert.rejects(runRealWikipediaAutomation(forbidden,{query:"ok"}),/Invalid search query/);
 assert.equal(launches,0);
});
test("POST search forms are refused without website writes",async()=>{
 const postFixture=route=>route.fulfill({status:200,contentType:"text/html",body:'<h1>Unsafe search</h1><form method="post" action="/w/index.php"><input name="search" type="search"></form>'});
 await assert.rejects(runRealWikipediaAutomation(chromium,{query,routeFixture:postFixture,timeoutMs:8000}),/Public GET search field unavailable/);
});
