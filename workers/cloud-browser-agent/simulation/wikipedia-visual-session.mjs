// API1 isolated REAL-WEBSITE viewer session. Local-only, never imported by Worker/MCP.
// Public Wikipedia read-only navigation; no credentials, POST, uploads, or arbitrary URLs.
const HOME="https://en.wikipedia.org/wiki/Main_Page";
function permitted(raw){
 const u=new URL(raw);
 if(u.protocol!=="https:"||u.hostname!=="en.wikipedia.org"||u.port||u.username||u.password||!u.pathname.startsWith("/wiki/"))throw Error("Destination refused");
 return u.href;
}
export async function createWikipediaVisualSession(chromium,{fixture,timeoutMs=15000}={}){
 const browser=await chromium.launch({headless:true,timeout:timeoutMs});
 let context,closed=false,sequence=0;
 const events=[];
 try{
  context=await browser.newContext({viewport:{width:1080,height:720},serviceWorkers:"block",acceptDownloads:false,permissions:[]});
  await context.route("**/*",route=>{
   if(fixture)return fixture(route);
   const req=route.request();
   let u;try{u=new URL(req.url());}catch{return route.abort();}
   if(!["GET","HEAD"].includes(req.method())||u.protocol!=="https:"||u.hostname!=="en.wikipedia.org"||u.username||u.password||u.port)return route.abort();
   return route.continue();
  });
  const page=await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  page.on("dialog",d=>d.dismiss().catch(()=>{}));
  async function record(type){
   const url=permitted(page.url());
   events.push({sequence:++sequence,type,url,title:await page.title()});
   return state();
  }
  function state(){
   if(closed)throw Error("Session closed");
   return {sequence,url:page.url(),title:events.at(-1)?.title||"",events:[...events],readOnly:true,productionWritesAllowed:false};
  }
  await page.goto(HOME,{waitUntil:"domcontentloaded",timeout:timeoutMs});
  await record("home");
  return Object.freeze({
   state,
   async search(term){
    if(typeof term!=="string"||!/^[a-zA-Z0-9 ,.'-]{3,80}$/.test(term))throw Error("Invalid search");
    // Wikipedia's public search via GET, no form submission or account interaction.
    await page.goto("https://en.wikipedia.org/wiki/Special:Search?search="+encodeURIComponent(term),{waitUntil:"domcontentloaded",timeout:timeoutMs});
    return record("search");
   },
   async click(href){
    const target=permitted(href);
    const anchor=page.locator("a[href]").filter({visible:true});
    const count=Math.min(await anchor.count(),200);
    let found=false;
    for(let i=0;i<count;i++){
     const el=anchor.nth(i),attr=await el.getAttribute("href");
     if(!attr)continue;
     if(new URL(attr,page.url()).href!==target)continue;
     await el.click({timeout:Math.min(timeoutMs,5000)});found=true;break;
    }
    if(!found)throw Error("Visible approved link not found");
    await page.waitForLoadState("domcontentloaded",{timeout:timeoutMs});
    if(permitted(page.url())!==target)throw Error("Unexpected navigation");
    return record("click");
   },
   async back(){
    await page.goBack({waitUntil:"domcontentloaded",timeout:timeoutMs});
    return record("back");
   },
   async links(){
    return (await page.locator("a[href]").evaluateAll(nodes=>nodes.map(n=>({href:n.href,label:(n.textContent||"").trim().slice(0,80)})).filter(n=>n.href.startsWith("https://en.wikipedia.org/wiki/")).slice(0,80)));
   },
   async frame(){
    if(closed)throw Error("Session closed");
    const png=await page.screenshot({type:"png",animations:"disabled",timeout:timeoutMs});
    if(png.length>3_000_000)throw Error("Frame too large");
    return {sequence,png};
   },
   async close(){if(closed)return;closed=true;await context.close();await browser.close();}
  });
 }catch(e){if(context)await context.close().catch(()=>{});await browser.close().catch(()=>{});throw e;}
}
