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
    '  return {ok:true,origin:"https://demo.playwright.dev",title:(await page.title()).slice(0,120),',
    '    itemCount:Math.min(items.length,100),items:items.slice(0,12).map(x=>x.slice(0,256))};',
    '}'
  ];
  return lines.join('\n');
}
export async function executeManagedPilot(browser,request){
  const code=createManagedPilotScript(request); // Validate before any browser request.
  if(!browser||typeof browser.script!=='function')
    return Object.freeze({ok:false,code:'PILOT_BROWSER_UNAVAILABLE',retrySafe:false});
  try{
    const response=await browser.script(code,{library:'playwright',timeout:45000,keepAlive:10000});
    if(!response?.ok)return Object.freeze({ok:false,code:'PILOT_EXECUTION_UNCERTAIN',
      outcomeUnknown:true,retrySafe:false});
    const raw=await response.json();
    const data=raw?.result;
    if(raw?.success!==true||data?.ok!==true||data.origin!=='https://demo.playwright.dev'
       ||!Number.isSafeInteger(data.itemCount)||data.itemCount<0
       ||!Array.isArray(data.items)||data.items.length>12)
      return Object.freeze({ok:false,code:'PILOT_RESULT_INVALID',outcomeUnknown:true,retrySafe:false});
    return Object.freeze({ok:true,origin:data.origin,title:String(data.title||'').slice(0,120),
      itemCount:data.itemCount,items:data.items.map(v=>String(v).slice(0,256))});
  }catch{
    return Object.freeze({ok:false,code:'PILOT_EXECUTION_UNCERTAIN',outcomeUnknown:true,retrySafe:false});
  }
}
