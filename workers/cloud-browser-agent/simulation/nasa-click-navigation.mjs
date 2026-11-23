// TEST-ONLY public browser interaction. No production imports, credentials or arbitrary destinations.
// Only GET navigations to the NASA Webb mission subtree; CI uses deterministic fixtures.
const ROOT="https://science.nasa.gov/mission/webb/";
function safe(url){
 const u=new URL(url,ROOT);
 if(u.protocol!=="https:"||u.hostname!=="science.nasa.gov"||u.port||u.username||u.password||!u.pathname.startsWith("/mission/webb/"))throw Error("Navigation refused");
 return u.href;
}
export async function runNasaClickNavigation(chromium,{fixture,timeoutMs=15000}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>60000)throw Error("Invalid timeout");
 const browser=await chromium.launch({headless:true,timeout:timeoutMs});
 let context;
 try{
  context=await browser.newContext({viewport:{width:1100,height:750},serviceWorkers:"block",acceptDownloads:false,permissions:[]});
  await context.route("**/*",route=>{
   if(fixture)return fixture(route);
   const req=route.request();
   let u;try{u=new URL(req.url());}catch{return route.abort();}
   if(!["GET","HEAD"].includes(req.method())||u.protocol!=="https:"||u.hostname!=="science.nasa.gov"||u.port||u.username||u.password)return route.abort();
   return route.continue();
  });
  const page=await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  await page.goto(ROOT,{waitUntil:"domcontentloaded",timeout:timeoutMs});
  const before=safe(page.url());
  const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>({href:n.href,text:(n.innerText||n.textContent||"").trim().slice(0,90)})));
  const target=links.find(l=>{try{const u=new URL(l.href);return u.origin==="https://science.nasa.gov"&&u.pathname.startsWith("/mission/webb/")&&u.pathname!=="/mission/webb/"&&!u.hash;}catch{return false;}});
  if(!target)throw Error("No safe internal navigation link");
  safe(target.href);
  // Navigation by clicking an actual link, not constructing the destination.
  // Resolve a visible and enabled matching link; hidden navigation entries are not clickable.
  const candidates=page.locator('a[href]');
  let clicked=false;
  for(let i=0;i<Math.min(await candidates.count(),150);i++){
   const node=candidates.nth(i);
   const href=await node.getAttribute("href");
   if(!href)continue;
   let destination;try{destination=safe(new URL(href,page.url()).href);}catch{continue;}
   if(new URL(destination).pathname==="/mission/webb/")continue;
   if(!await node.isVisible()||!await node.isEnabled())continue;
   try{await node.click({timeout:Math.min(timeoutMs,3000)});clicked=true;break;}catch{}
  }
  if(!clicked)throw Error("No clickable approved internal link");
  await page.waitForLoadState("domcontentloaded",{timeout:timeoutMs});
  const after=safe(page.url());
  if(new URL(after).pathname===new URL(before).pathname)throw Error("No page navigation");
  const png=await page.screenshot({type:"png",timeout:timeoutMs,animations:"disabled"});
  if(png.length>2_000_000)throw Error("Screenshot too large");
  return {before,after,linkText:target.text,screenshot:png.toString("base64"),readOnly:true};
 }finally{if(context)await context.close().catch(()=>{});await browser.close().catch(()=>{});}
}
