import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createWikipediaViewerServer} from "../simulation/wikipedia-visual-viewer-server.mjs";
const fixture=route=>{
 const u=new URL(route.request().url());
 if(route.request().method()!=="GET"||u.hostname!=="en.wikipedia.org")return route.abort();
 const title=u.pathname.includes("Special:Search")?"Results":u.pathname.includes("James_Webb")?"Webb":"Main";
 const link=title==="Results"?'<a href="/wiki/James_Webb_Space_Telescope">James Webb</a>':'<a href="/wiki/Main_Page">Main</a>';
 return route.fulfill({status:200,contentType:"text/html",body:`<!doctype html><title>${title}</title><h1>${title}</h1>${link}`});
};
test("local viewer serves real Chromium frames and controls search and click",async()=>{
 const v=await createWikipediaViewerServer(chromium,{fixture,timeoutMs:10000});
 try{
  const get=async path=>fetch(v.url+path);
  assert.match(await(await get("/")).text(),/Real Wikipedia Browser/);
  const before=await(await get("/state")).json();
  assert.match(before.url,/Main_Page/);
  const send=async c=>fetch(v.url+"/command",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(c)});
  assert.equal((await send({type:"search",term:"James Webb Space Telescope"})).status,200);
  const links=await(await get("/links")).json();
  assert.ok(links.some(l=>l.href.endsWith("James_Webb_Space_Telescope")));
  assert.equal((await send({type:"click",href:"https://en.wikipedia.org/wiki/James_Webb_Space_Telescope"})).status,200);
  assert.match((await(await get("/state")).json()).url,/James_Webb_Space_Telescope/);
  const png=Buffer.from(await(await get("/frame")).arrayBuffer());
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal((await send({type:"click",href:"https://example.org/"})).status,400);
  assert.equal((await send({type:"back"})).status,200);
  assert.equal((await send({type:"navigate",url:"https://example.org"})).status,400);
 }finally{await v.close();}
});
