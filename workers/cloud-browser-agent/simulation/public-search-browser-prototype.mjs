// Isolated research prototype ONLY. Never imported into deployed Worker/MCP.
// Real public GET navigation is opt-in; CI uses deterministic route fixtures.
const ALLOWED=new Set(["www.google.com","google.com","science.nasa.gov"]);
const ASSETS=new Set(["www.gstatic.com","fonts.gstatic.com","ssl.gstatic.com","www.google.com","google.com","science.nasa.gov","images-assets.nasa.gov"]);
function approved(raw){
 const u=new URL(raw);
 if(u.protocol!=="https:"||u.username||u.password||u.port||!ALLOWED.has(u.hostname))throw Error("Destination refused");
 return u;
}
export async function runPublicSearchPrototype(chromium,{query="James Webb Space Telescope NASA",routeFixture,timeoutMs=20000}={}){
 if(typeof query!=="string"||query.length<3||query.length>100||/[\r\n]/.test(query))throw Error("Invalid query");
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>60000)throw Error("Invalid timeout");
 const browser=await chromium.launch({headless:true,timeout:timeoutMs});
 let context;
 const steps=[],screenshots=[];
 try{
  context=await browser.newContext({viewport:{width:1100,height:750},serviceWorkers:"block",acceptDownloads:false,permissions:[],javaScriptEnabled:true});
  await context.route("**/*",async route=>{
   const req=route.request(),url=req.url();
   if(routeFixture)return routeFixture(route);
   let u;
   try{u=new URL(url);}catch{return route.abort();}
   if(!["GET","HEAD"].includes(req.method())||u.protocol!=="https:"||!ASSETS.has(u.hostname)||u.username||u.password||u.port)return route.abort();
   return route.continue();
  });
  const page=await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  page.on("dialog",dialog=>dialog.dismiss().catch(()=>{}));
  const record=async (label,expectedPath)=>{
   const url=page.url();
   const parsed=approved(url);
   if(expectedPath&&parsed.pathname!==expectedPath)throw Error("Unexpected navigation or access challenge: "+label);
   const png=await page.screenshot({type:"png",animations:"disabled",timeout:timeoutMs});
   if(png.length>2_000_000)throw Error("Screenshot too large");
   screenshots.push({label,url,pngBase64:png.toString("base64"),mimeType:"image/png"});
   steps.push({label,url,title:await page.title()});
  };
  await page.goto("https://www.google.com/",{waitUntil:"domcontentloaded",timeout:timeoutMs});
  await record("Google home","/");
  // Explicitly construct an encoded public GET search; never submit POST forms.
  await page.goto("https://www.google.com/search?q="+encodeURIComponent(query),{waitUntil:"domcontentloaded",timeout:timeoutMs});
  await record("Google results","/search");
  await page.goto("https://www.google.com/search?udm=2&q="+encodeURIComponent(query),{waitUntil:"domcontentloaded",timeout:timeoutMs});
  await record("Google Images","/search");
  await page.goto("https://science.nasa.gov/mission/webb/",{waitUntil:"domcontentloaded",timeout:timeoutMs});
  await record("Official NASA result","/mission/webb/");
  return {steps,screenshots,readOnly:true,productionWritesAllowed:false};
 }finally{if(context)await context.close().catch(()=>{});await browser.close().catch(()=>{});}
}
