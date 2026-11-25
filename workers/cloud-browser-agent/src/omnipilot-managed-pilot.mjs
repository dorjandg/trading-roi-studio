// Cloudflare Browser Run opt-in proof of real, bounded interaction.
// Isolated public TodoMVC fixture only. NOT a general egress or authorization boundary.
// Neither module import nor planning makes a browser/network request.
const DEMO='https://demo.playwright.dev/todomvc/';
const ACTIONS=new Set(['fill','press','click','wait']);
const PLAIN=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const KEYS=new Set(['Enter','Escape','Tab','Space']);
const fail=()=>Object.assign(Error('PILOT_INPUT_REFUSED'),{code:'PILOT_INPUT_REFUSED'});
function fields(value,allowed,required=allowed){
  if(!PLAIN(value))throw fail();
  const out=Object.create(null),d=Object.getOwnPropertyDescriptors(value);
  for(const key of Reflect.ownKeys(d)){
    if(typeof key!=='string'||!allowed.includes(key)||!d[key].enumerable
      ||!Object.hasOwn(d[key],'value'))throw fail();
    out[key]=d[key].value;
  }
  if(required.some(k=>!Object.hasOwn(out,k)))throw fail();
  return out;
}
function safeText(value,max){
  if(typeof value!=='string'||value.length<1||value.length>max
    ||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)
    ||new TextEncoder().encode(value).length>max*3
    ||new TextDecoder('utf-8',{fatal:true}).decode(new TextEncoder().encode(value))!==value)throw fail();
  return value;
}
function safeSelector(value){
  safeText(value,120);
  // Only simple CSS selectors needed for the disposable fixture.
  if(!/^[a-zA-Z0-9_#. >:[\]="'\-]+$/.test(value)
     ||/password|secret|token|hidden|file|otp|one-time|csrf/i.test(value))
    throw fail();
  return value;
}
export function validateManagedPilot(request){
  const top=fields(request,['url','actions']);
  if(top.url!==DEMO||!Array.isArray(top.actions)||top.actions.length<1
     ||top.actions.length>5||!Object.keys(top.actions).every(k=>/^(?:0|[1-9]\d*)$/.test(k))
     ||top.actions.length!==Object.keys(top.actions).length)throw fail();
  const actions=top.actions.map(raw=>{
    const action=fields(raw,['op','selector','value','key'],['op','selector']);
    if(!ACTIONS.has(action.op))throw fail();
    const selector=safeSelector(action.selector);
    const keys=Object.keys(action).sort().join(',');
    if(action.op==='fill'){
      if(keys!=='op,selector,value')throw fail();
      return Object.freeze({op:'fill',selector,value:safeText(action.value,256)});
    }
    if(action.op==='press'){
      if(keys!=='key,op,selector'||!KEYS.has(action.key))throw fail();
      return Object.freeze({op:'press',selector,key:action.key});
    }
    if(keys!=='op,selector')throw fail();
    return Object.freeze({op:action.op,selector});
  });
  return Object.freeze({url:DEMO,actions:Object.freeze(actions)});
}
export function createManagedPilotScript(request){
  const task=validateManagedPilot(request);
  // The only interpolated value is a JSON-encoded, strictly validated data object.
  // No caller-supplied JavaScript, evaluate, network URL, file or credential inputs.
  const lines=[
    'async ({ page, context }) => {',
    '  const task = '+JSON.stringify(task)+';',
    '  await context.route("**/*", async route => {',
    '    const req=route.request();',
    '    let url;',
    '    try { url=new URL(req.url()); } catch { return route.abort(); }',
    '    if(url.protocol!=="https:" || url.hostname!=="demo.playwright.dev" ||',
    '       url.port || !["GET","HEAD"].includes(req.method())) return route.abort();',
    '    return route.continue();',
    '  });',
    '  page.on("dialog", dialog => { dialog.dismiss().catch(()=>{}); });',
    '  context.on("page", p => { if(p!==page) p.close().catch(()=>{}); });',
    '  await page.setViewportSize({width:900,height:620});',
    '  await page.goto(task.url,{waitUntil:"domcontentloaded",timeout:18000});',
    '  for (const action of task.actions) {',
    '    const locator=page.locator(action.selector);',
    '    if(await locator.count()!==1) throw Error("PILOT_TARGET_NOT_UNIQUE");',
    '    await locator.waitFor({state:"visible",timeout:4000});',
    '    if(action.op==="fill") {',
    '      const sensitive=await locator.evaluate(el=>{',
    '        const t=(el.getAttribute("type")||"").toLowerCase();',
    '        const ac=(el.getAttribute("autocomplete")||"").toLowerCase();',
    '        return ["password","hidden","file"].includes(t) ||',
    '          /one-time-code|cc-|password/.test(ac) ||',
    '          !!el.closest("[data-sensitive],[data-omnipilot-sensitive]");',
    '      });',
    '      if(sensitive)throw Error("PILOT_SENSITIVE_FIELD");',
    '      await locator.fill(action.value,{timeout:4000});',
    '    } else if(action.op==="press") await locator.press(action.key,{timeout:4000});',
    '    else if(action.op==="click") await locator.click({timeout:4000});',
    '  }',
    '  if(new URL(page.url()).origin!=="https://demo.playwright.dev")',
    '    throw Error("PILOT_ORIGIN_CHANGED");',
    '  const items=await page.locator(".todo-list li").allInnerTexts();',
    '  const pixels=await page.screenshot({type:"jpeg",quality:45,fullPage:false});',
    '  if(pixels.length<6||pixels.length>36000)throw Error("PILOT_SCREENSHOT_TOO_LARGE");',
    '  let binary="";',
    '  for(let i=0;i<pixels.length;i+=8192)binary+=String.fromCharCode(...pixels.subarray(i,i+8192));',
    '  const screenshotBase64=btoa(binary);',
    '  return {ok:true,origin:"https://demo.playwright.dev",title:(await page.title()).slice(0,120),',
    '    itemCount:Math.min(items.length,100),items:items.slice(0,12).map(x=>x.slice(0,256)),',
    '    screenshotMime:"image/jpeg",screenshotBase64};',
    '}'
  ];
  return lines.join('\n');
}
export async function executeManagedPilot(browser,request){
  const code=createManagedPilotScript(request); // Validate before any browser request.
  if(!browser||typeof browser.acquire!=='function'||typeof browser.script!=='function'
     ||typeof browser.closeSession!=='function')
    return Object.freeze({ok:false,code:'PILOT_BROWSER_UNAVAILABLE',retrySafe:false});
  const failure=(code)=>Object.freeze({ok:false,code,outcomeUnknown:true,retrySafe:false});
  let outcome=failure('PILOT_EXECUTION_UNCERTAIN'),sessionId=null;
  try{
    // This platform-enforced hostname allowlist is fixed at browser acquisition,
    // BEFORE navigation and subresources. The script's route guard adds defense
    // in depth but is not the primary egress security boundary.
    const acquired=await browser.acquire({
      guardrails:{allowedDomains:['demo.playwright.dev']},keepAlive:10000
    });
    const candidate=acquired?.sessionId;
    if(typeof candidate==='string'&&/^[A-Za-z0-9-]{10,128}$/.test(candidate))
      sessionId=candidate;
    if(!sessionId)outcome=failure('PILOT_SESSION_UNTRACKED');
    else{
      const response=await browser.script(code,{
        sessionId,library:'playwright',timeout:45000
      });
      if(!response?.ok)outcome=failure('PILOT_EXECUTION_UNCERTAIN');
      else{
        const raw=await response.json(),data=raw?.result;
        if(raw?.success!==true||data?.ok!==true||data.origin!=='https://demo.playwright.dev'
           ||!Number.isSafeInteger(data.itemCount)||data.itemCount<0
           ||!Array.isArray(data.items)||data.items.length>12
           ||data.items.some(v=>typeof v!=='string'||v.length>256)
           ||typeof data.title!=='string'||data.title.length>120
           ||data.screenshotMime!=='image/jpeg'
           ||typeof data.screenshotBase64!=='string'
           ||data.screenshotBase64.length<8||data.screenshotBase64.length>48000
           ||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(data.screenshotBase64))
          outcome=failure('PILOT_RESULT_INVALID');
        else {
          let validImage=false;
          try {
            const bytes=atob(data.screenshotBase64);
            validImage=bytes.length>=6&&bytes.length<=36000
              &&bytes.charCodeAt(0)===255&&bytes.charCodeAt(1)===216
              &&bytes.charCodeAt(2)===255
              &&bytes.charCodeAt(bytes.length-2)===255&&bytes.charCodeAt(bytes.length-1)===217;
          } catch {}
          outcome=validImage?Object.freeze({ok:true,origin:data.origin,title:data.title,
            itemCount:data.itemCount,items:[...data.items],
            screenshotMime:'image/jpeg',screenshotBase64:data.screenshotBase64})
            :failure('PILOT_RESULT_INVALID');
        }
      }
    }
  }catch{
    outcome=failure('PILOT_EXECUTION_UNCERTAIN');
  }finally{
    // Close the owned session whether execution succeeded, failed or timed out.
    // Never auto-retry a possibly dispatched website action.
    if(sessionId){
      try{
        const closed=await browser.closeSession(sessionId);
        const status=typeof closed==='string'?closed:closed?.status??closed?.result?.status;
        if(status!=='closed'&&status!=='closing')
          outcome=failure('PILOT_CLEANUP_UNVERIFIED');
      }catch{
        outcome=failure('PILOT_CLEANUP_UNVERIFIED');
      }
    }
  }
  return outcome;
}
