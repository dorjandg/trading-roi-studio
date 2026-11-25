import {planSiteControl,validateSiteUrl} from './omnipilot-site-grants.mjs';

// This function is serialized into Browser Run. Never evaluate user-supplied code.
const siteBrowserScript=async ({page,context})=>{
  const plan = null; // Exactly replaced with JSON-encoded validated plan.
  const origin=new URL(plan.url).origin;
  const expired=()=>Number.isSafeInteger(plan.expiresAtMs)&&Date.now()>=plan.expiresAtMs;
  const navigationAllowed=u=>u.protocol==='https:'&&u.origin===origin&&!u.search
    &&(!plan.pathPrefix||u.pathname.startsWith(plan.pathPrefix))
    &&!u.pathname.includes('//')&&!/[%\\]/.test(u.pathname)
    &&!/(?:^|\/)(?:api|admin|auth|login|logout|token|delete|remove|save|submit|order|checkout|buy|purchase|transfer|confirm|upload|download)(?:\/|$)/i.test(u.pathname);
  if(expired())throw Error('SITE_GRANT_EXPIRED');
  await context.route('**/*',async route=>{
    const req=route.request();
    let u;try{u=new URL(req.url())}catch{return route.abort()}
    if(u.protocol!=='https:'||u.origin!==origin||
      !['GET','HEAD'].includes(req.method()))return route.abort();
    if(req.isNavigationRequest()&&(!navigationAllowed(u)||expired()))return route.abort();
    return route.continue();
  });
  page.on('dialog',d=>{d.dismiss().catch(()=>{})});
  page.on('download',d=>{d.cancel().catch(()=>{})});
  context.on('page',p=>{if(p!==page)p.close().catch(()=>{})});
  await page.setViewportSize({width:800,height:520});
  await page.goto(plan.url,{waitUntil:'domcontentloaded',timeout:18000});
  if(page.url().split(/[?#]/)[0]!==plan.url)throw Error('SITE_REDIRECT_REFUSED');
  if(!navigationAllowed(new URL(page.url()))||expired())throw Error('SITE_NAVIGATION_REFUSED');
  for(const action of plan.actions){
    if(expired())throw Error('SITE_GRANT_EXPIRED');
    const locator=page.locator(action.selector);
    if(await locator.count()!==1)throw Error('SITE_TARGET_NOT_UNIQUE');
    await locator.waitFor({state:'visible',timeout:4000});
    if(action.op==='wait')continue;
    const checked=await locator.evaluate(el=>{
      const tag=el.tagName.toLowerCase(),type=(el.getAttribute('type')||el.type||'').toLowerCase(),
        ac=(el.getAttribute('autocomplete')||'').toLowerCase();
      const info=(el.getAttribute('name')||'')+' '+(el.getAttribute('id')||'')+' '+(el.getAttribute('aria-label')||'');
      return {tag,type,ac,info,readonly:el.readOnly===true,disabled:el.disabled===true,
        sensitive:!!el.closest('[data-sensitive],[data-omnipilot-sensitive]'),
        insideForm:!!el.closest('form'),
        href:tag==='a'?el.getAttribute('href'):null};
    });
    if(checked.sensitive||checked.disabled||
      /password|token|otp|secret|credit|card|payment|csrf|auth|login|email|phone|address/i.test(checked.info+' '+checked.ac))
      throw Error('SITE_SENSITIVE_ELEMENT');
    if(action.op==='fill'){
      if(checked.readonly||
        !(checked.tag==='textarea'||(checked.tag==='input'&&['text','search'].includes(checked.type))))
        throw Error('SITE_FILL_NOT_APPROVED');
      await locator.fill(action.value,{timeout:4000});
    }else if(action.op==='press'){
      await locator.press(action.key,{timeout:4000});
    }else if(action.op==='click'){
      if(checked.tag==='input'&&checked.type==='checkbox'&&!checked.insideForm){
        await locator.click({timeout:4000});
      }else if(checked.tag==='a'&&typeof checked.href==='string'){
        let destination;try{destination=new URL(checked.href,page.url())}catch{
          throw Error('SITE_CLICK_URL_INVALID');
        }
        if(!navigationAllowed(destination)||destination.hash)
          throw Error('SITE_CLICK_NOT_APPROVED');
        await locator.click({timeout:4000});
      }else throw Error('SITE_CLICK_NOT_APPROVED');
    }
    const next=new URL(page.url());
    if(!navigationAllowed(next)||expired())throw Error('SITE_NAVIGATION_REFUSED');
  }
  const current=new URL(page.url());
  if(!navigationAllowed(current)||expired())throw Error('SITE_ORIGIN_CHANGED');
  current.hash=''; // Same-document SPA fragments are not network destinations.
  const headings=(await page.locator('h1,h2').allTextContents()).slice(0,10)
    .map(x=>x.trim().slice(0,160));
  let pixels=await page.screenshot({type:'jpeg',quality:25,fullPage:false});
  // Keep MCP image payload bounded even when complex websites compress poorly.
  // Never increase the 36 KB limit or return a partial base64 payload.
  if(pixels.length>36000){
    await page.setViewportSize({width:640,height:360});
    pixels=await page.screenshot({type:'jpeg',quality:12,fullPage:false});
  }
  if(pixels.length>36000){
    await page.setViewportSize({width:512,height:320});
    pixels=await page.screenshot({type:'jpeg',quality:7,fullPage:false});
  }
  if(pixels.length<6||pixels.length>36000)throw Error('SITE_IMAGE_LIMIT');
  let binary='';
  for(let i=0;i<pixels.length;i+=8192)
    binary+=String.fromCharCode(...pixels.subarray(i,i+8192));
  return {ok:true,url:current.href,origin,mode:plan.mode,
    title:(await page.title()).slice(0,120),headings,
    actionCount:plan.actions.length,submitted:false,persisted:false,
    screenshotMime:'image/jpeg',screenshotBase64:btoa(binary)};
};
export function createSiteControlScript(request,rawGrants){
  const plan=planSiteControl(request,rawGrants);
  const marker='const plan = null;';
  const serialized=siteBrowserScript.toString();
  if(serialized.split(marker).length!==2)throw Error('SITE_SCRIPT_TEMPLATE_INVALID');
  return serialized.replace(marker,'const plan = '+JSON.stringify(plan)+';');
}
const fail=code=>Object.freeze({ok:false,code,outcomeUnknown:true,retrySafe:false});
export async function executeSiteControl(browser,request,rawGrants){
  const plan=planSiteControl(request,rawGrants); // Validate BEFORE browser I/O.
  if(!browser||typeof browser.acquire!=='function'||typeof browser.script!=='function'
    ||typeof browser.closeSession!=='function')
    return Object.freeze({ok:false,code:'SITE_BROWSER_UNAVAILABLE',retrySafe:false});
  const code=createSiteControlScript(request,rawGrants);
  let sessionId=null,outcome=fail('SITE_EXECUTION_UNCERTAIN');
  try{
    const acquired=await browser.acquire({guardrails:{allowedDomains:[plan.hostname]},keepAlive:10000});
    if(typeof acquired?.sessionId==='string'&&/^[A-Za-z0-9-]{10,128}$/.test(acquired.sessionId))
      sessionId=acquired.sessionId;
    if(!sessionId)outcome=fail('SITE_SESSION_UNTRACKED');
    else{
      const response=await browser.script(code,{sessionId,library:'playwright',timeout:45000});
      if(!response?.ok)outcome=fail('SITE_EXECUTION_UNCERTAIN');
      else{
        const body=await response.json(),v=body?.result;
        let valid=body?.success===true&&v?.ok===true&&v?.origin===plan.origin
          &&typeof v.url==='string'&&v.url.startsWith(plan.origin+'/')
          &&v.mode===plan.mode&&typeof v.title==='string'&&v.title.length<=120
          &&Array.isArray(v.headings)&&v.headings.length<=10
          &&v.headings.every(x=>typeof x==='string'&&x.length<=160)
          &&v.actionCount===plan.actions.length
          &&v.submitted===false&&v.persisted===false
          &&v.screenshotMime==='image/jpeg'
          &&typeof v.screenshotBase64==='string'
          &&v.screenshotBase64.length<48000
          &&/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(v.screenshotBase64);
        if(valid){
          try{
            const u=validateSiteUrl(v.url);
            if(u.origin!==plan.origin)valid=false;
            const bytes=atob(v.screenshotBase64);
            if(bytes.length<6||bytes.length>36000||
              bytes.charCodeAt(0)!==255||bytes.charCodeAt(1)!==216||
              bytes.charCodeAt(bytes.length-2)!==255||
              bytes.charCodeAt(bytes.length-1)!==217)valid=false;
          }catch{valid=false}
        }
        outcome=valid?Object.freeze({ok:true,url:v.url,origin:v.origin,title:v.title,
          headings:[...v.headings],mode:v.mode,actionCount:v.actionCount,
          submitted:false,persisted:false,screenshotMime:v.screenshotMime,
          screenshotBase64:v.screenshotBase64}):fail('SITE_RESULT_INVALID');
      }
    }
  }catch{outcome=fail('SITE_EXECUTION_UNCERTAIN')}
  finally{
    if(sessionId){
      try{
        const closed=await browser.closeSession(sessionId);
        const status=typeof closed==='string'?closed:closed?.status??closed?.result?.status;
        if(status!=='closed'&&status!=='closing')outcome=fail('SITE_CLEANUP_UNVERIFIED');
      }catch{outcome=fail('SITE_CLEANUP_UNVERIFIED')}
    }
  }
  return outcome;
}
