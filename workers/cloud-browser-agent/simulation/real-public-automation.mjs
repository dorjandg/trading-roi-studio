// API 1: real-public-site automation proof of concept. TEST/CI ONLY.
// No production Worker or MCP imports, credentials, arbitrary URL input, POST requests or website writes.
// This workflow uses a fresh, discarded Chromium context per request.
const HOME="https://en.wikipedia.org/wiki/Main_Page";
const HOST="en.wikipedia.org";
const PNG_HEADER="89504e470d0a1a0a";
const safeUrl=raw=>{
 const u=new URL(raw);
 if(u.protocol!=="https:"||u.hostname!==HOST||u.username||u.password||u.port||
   !(u.pathname.startsWith("/wiki/")||u.pathname==="/w/index.php"))throw Error("Unapproved Wikipedia URL");
 return u;
};
const validQuery=q=>typeof q==="string"&&q.length>=3&&q.length<=80&&/^[A-Za-z0-9 ,.'-]+$/.test(q);
export async function runRealWikipediaAutomation(chromium,{query="James Webb Space Telescope",routeFixture,timeoutMs=20000}={}){
 if(!validQuery(query))throw Error("Invalid search query");
 if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>60000)throw Error("Invalid timeout");
 if(!chromium||typeof chromium.launch!=="function")throw Error("Chromium required");
 const browser=await chromium.launch({headless:true,timeout:timeoutMs});
 let context;
 const steps=[],screenshots=[];
 let blockedRequests=0,approvedRequests=0;
 try{
  context=await browser.newContext({viewport:{width:1100,height:750},serviceWorkers:"block",acceptDownloads:false,permissions:[],javaScriptEnabled:false});
  await context.route("**/*",async route=>{
   const req=route.request();
   let u;
   try{u=safeUrl(req.url());}catch{blockedRequests++;return route.abort();}
   if(!["GET","HEAD"].includes(req.method())){blockedRequests++;return route.abort();}
   approvedRequests++;
   if(routeFixture)return routeFixture(route);
   return route.continue();
  });
  const page=await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  page.on("dialog",d=>{void d.dismiss().catch(()=>{});});
  page.on("popup",p=>{void p.close().catch(()=>{});});
  const record=async action=>{
   const url=safeUrl(page.url()).href;
   const title=(await page.title()).slice(0,180);
   const heading=(await page.locator("h1").first().textContent().catch(()=>"")||"").trim().slice(0,180);
   // Wikipedia may load without external styles; move the article heading into the captured viewport.
   const headingNode=page.locator("h1").first();
   if(await headingNode.count())await headingNode.scrollIntoViewIfNeeded({timeout:timeoutMs});
   const png=await page.screenshot({type:"png",animations:"disabled",timeout:timeoutMs});
   if(png.length>2_000_000||png.subarray(0,8).toString("hex")!==PNG_HEADER)throw Error("Invalid or oversized screenshot");
   const screenshot={action,mimeType:"image/png",base64:png.toString("base64"),bytes:png.length};
   screenshots.push(screenshot);
   steps.push({action,url,title,heading,screenshotIndex:screenshots.length-1});
   return {url,title,heading};
  };
  await page.goto(HOME,{waitUntil:"domcontentloaded",timeout:timeoutMs});
  await record("navigate");
  // The browser MUST type into a real public GET search field, rather than only opening a search URL.
  const inputs=page.locator('input[name="search"], input#searchInput');
  let input;
  for(let i=0;i<Math.min(await inputs.count(),10);i++){
   const candidate=inputs.nth(i);
   if(!await candidate.isVisible()||!await candidate.isEnabled())continue;
   const form=await candidate.evaluate(el=>{
    const f=el.closest("form");
    return f?{method:(f.getAttribute("method")||"get").toLowerCase(),action:f.action}:{method:"",action:""};
   });
   if(form.method!=="get")continue;
   try{safeUrl(form.action);}catch{continue;}
   input=candidate;break;
  }
  if(!input)throw Error("Public GET search field unavailable");
  await input.fill(query);
  const entered=await input.inputValue();
  if(entered!==query)throw Error("Search field typing failed");
  const prior=page.url();
  await Promise.all([
   page.waitForURL(url=>url.href!==prior,{timeout:timeoutMs}),
   input.press("Enter",{timeout:timeoutMs})
  ]);
  await page.waitForLoadState("domcontentloaded",{timeout:timeoutMs});
  await record("search");
  // Click a REAL rendered article link within the current Wikipedia content.
  // Never accept arbitrary URLs, account pages, upload/edit actions or foreign origins.
  const anchors=page.locator('#mw-content-text a[href], .mw-search-results a[href], main a[href]');
  const candidates=await anchors.evaluateAll((nodes,current)=>{
   return nodes.map((a,index)=>({index,href:a.href,text:(a.textContent||"").trim().slice(0,90),visible:!!a.getClientRects().length}))
    .filter(x=>x.visible&&x.text.length>=3&&x.href!==current);
  },page.url());
  const current=safeUrl(page.url());
  const approved=candidates.filter(x=>{
   try{
    const u=safeUrl(x.href);
    return !x.href.includes("#")&&u.pathname.startsWith("/wiki/")&&!u.pathname.slice(6).includes(":")&&
      (u.pathname!==current.pathname||u.search!==current.search);
   }catch{return false;}
  });
  if(!approved.length)throw Error("No approved visible article link");
  const term=query.toLowerCase().replace(/\s+/g,"_");
  approved.sort((a,b)=>{
   const score=x=>x.href.toLowerCase().includes(term)?0:x.text.toLowerCase().includes(query.toLowerCase())?1:2;
   return score(a)-score(b);
  });
  let clicked;
  for(const item of approved.slice(0,80)){
   const anchor=anchors.nth(item.index);
   if(!await anchor.isVisible()||!await anchor.isEnabled())continue;
   const before=page.url();
   try{
    await Promise.all([
     page.waitForURL(url=>url.origin==="https://"+HOST&&
       (url.pathname!==new URL(before).pathname||url.search!==new URL(before).search),
       {timeout:Math.min(timeoutMs,8000)}),
     anchor.click({timeout:Math.min(timeoutMs,8000)})
    ]);
    const after=safeUrl(page.url());
    const prev=safeUrl(before);
    if(after.pathname===prev.pathname&&after.search===prev.search)throw Error("Fragment-only click refused");
    clicked={label:item.text,href:after.href};
    break;
   }catch{
    // Never retry a new click after the page might have navigated.
    if(page.url()!==before)throw Error("Clicked destination did not complete safely");
   }
  }
  if(!clicked)throw Error("No approved clickable article link");
  await page.waitForLoadState("domcontentloaded",{timeout:timeoutMs});
  await record("click");
  const extracted=await page.evaluate(()=>{
   const heading=(document.querySelector("h1")?.textContent||"").trim();
   const paragraphs=[...document.querySelectorAll("#mw-content-text p, main p")]
    .map(p=>(p.textContent||"").replace(/\s+/g," ").trim())
    .filter(x=>x.length>=30).slice(0,4);
   return {heading,paragraphs};
  });
  if(!extracted.heading||!extracted.paragraphs.length)throw Error("Article extraction failed");
  return {status:"passed",task:"wikipedia-demo",source:"LIVE_CHROMIUM",website:HOST,query,
   searchedWithVisibleInput:true,clickedLink:clicked,steps,screenshots,extracted,
   approvedRequests,blockedRequests,readOnly:true,productionWritesAllowed:false,thirdPartyAutomationUsed:false};
 }finally{
  if(context)await context.close().catch(()=>{});
  await browser.close().catch(()=>{});
 }
}
