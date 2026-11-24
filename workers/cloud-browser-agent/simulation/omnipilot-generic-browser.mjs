// Transport-free primitives for a trusted, exclusively owned browser context.
// No browser launch, network policy installation, credentials, profiles or MCP wiring.
// The injected egress lease is a prerequisite supplied by trusted runtime code, NOT
// proof created here of DNS, redirect, subresource, protocol or network enforcement.
const owners = new WeakMap(), claimedContexts = new WeakSet(), ownErrors = new WeakSet();
const MAX_TEXT = 4096, MAX_SNAPSHOT_BYTES = 32768, MAX_PNG_BYTES = 2_000_000;
const MASK = 'input, textarea, select, [contenteditable], [data-sensitive], [data-omnipilot-sensitive]';
const KEYS = new Set(['Enter','Escape','Tab','Shift+Tab','Space','Backspace','Delete',
  'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown',
  'Control+A','Meta+A','Shift+ArrowUp','Shift+ArrowDown','Shift+ArrowLeft','Shift+ArrowRight']);
const SPEC = Object.freeze({
  status: [], 'tabs.list': [], 'tabs.create': [], 'tabs.select': [], 'tabs.close': [],
  navigate: ['url'], back: [], forward: [], reload: [], snapshot: ['selector','maxChars'],
  screenshot: ['x','y','width','height'], click: ['selector','x','y'],
  doubleClick: ['selector','x','y'], move: ['x','y'], type: ['text'], press: ['key'],
  fill: ['selector','value'], select: ['selector','values'], scroll: ['dx','dy'],
  wait: ['selector','state']
});
const NO_TAB = new Set(['status','tabs.list','tabs.create']);
function fail(code, dispatched = false, outcomeUnknown = false) {
  const error = Error('Browser operation refused: ' + code);
  Object.assign(error, {code, dispatched, outcomeUnknown, retrySafe: false});
  ownErrors.add(error);
  return error;
}
function record(value, maxKeys = 10) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw fail('INVALID_INPUT');
  const keys = Reflect.ownKeys(value);
  if (keys.length > maxKeys) throw fail('INVALID_INPUT');
  const out = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !Object.hasOwn(descriptor,'value') ||
        !descriptor.enumerable || ['__proto__','constructor','prototype'].includes(key)) throw fail('INVALID_INPUT');
    out[key] = descriptor.value;
  }
  return out;
}
function text(value, max, multiline = false) {
  if (typeof value !== 'string' || value.length > max ||
      (multiline ? /[\u0000-\u0008\u000b-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value) ||
      Buffer.from(value).toString('utf8') !== value) throw fail('INVALID_INPUT');
  return value;
}
function number(value, min, max, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isSafeInteger(value))) throw fail('INVALID_INPUT');
  return value;
}
function selector(value) { if (!text(value,512).trim()) throw fail('INVALID_INPUT'); return value; }
function url(value) {
  text(value,2048);
  let parsed;
  try { parsed = new URL(value); } catch { throw fail('INVALID_INPUT'); }
  if (value.trim() !== value || parsed.protocol !== 'https:' || parsed.username ||
      parsed.password || parsed.port || !parsed.hostname) throw fail('INVALID_INPUT');
  // Deliberately no claim that parsing a hostname makes its network destination safe.
  return parsed.href;
}
function stringArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length < 1 || value.length > 16 || Reflect.ownKeys(value).length !== value.length + 1) throw fail('INVALID_INPUT');
  const result = [];
  for (let i=0; i<value.length; i++) {
    const d = Object.getOwnPropertyDescriptor(value,String(i));
    if (!d || !Object.hasOwn(d,'value') || !d.enumerable) throw fail('INVALID_INPUT');
    result.push(text(d.value,128));
  }
  return Object.freeze(result);
}
function command(input) {
  const c = record(input), op = c.op;
  if (typeof op !== 'string' || !Object.hasOwn(SPEC,op)) throw fail('INVALID_INPUT');
  const allowed = ['op','timeoutMs',...SPEC[op],...(NO_TAB.has(op)?[]:['tabId'])];
  if (Object.keys(c).some(key=>!allowed.includes(key))) throw fail('INVALID_INPUT');
  const out = {op,timeoutMs:number(c.timeoutMs ?? 5000,10,15000,true)};
  if (!NO_TAB.has(op)) {
    if (typeof c.tabId !== 'string' || !/^tab-[1-9][0-9]{0,8}$/.test(c.tabId)) throw fail('INVALID_INPUT');
    out.tabId = c.tabId;
  }
  if (op === 'navigate') out.url = url(c.url);
  if (op === 'snapshot') { out.selector=selector(c.selector ?? 'body'); out.maxChars=number(c.maxChars ?? 8000,1,16000,true); }
  if (op === 'screenshot') {
    out.x=number(c.x ?? 0,0,8192); out.y=number(c.y ?? 0,0,8192);
    out.width=c.width===undefined?null:number(c.width,1,1920,true);
    out.height=c.height===undefined?null:number(c.height,1,1200,true);
    if (out.width!==null && out.height!==null && out.width*out.height>2_000_000) throw fail('INVALID_INPUT');
  }
  if (['click','doubleClick'].includes(op)) {
    if (Object.hasOwn(c,'selector')) {
      if (Object.hasOwn(c,'x') || Object.hasOwn(c,'y')) throw fail('INVALID_INPUT');
      out.selector=selector(c.selector);
    } else { out.x=number(c.x,0,8192); out.y=number(c.y,0,8192); }
  }
  if (op === 'move') { out.x=number(c.x,0,8192); out.y=number(c.y,0,8192); }
  if (op === 'type') out.text=text(c.text,MAX_TEXT,true);
  if (op === 'press') { if (!KEYS.has(c.key)) throw fail('INVALID_INPUT'); out.key=c.key; }
  if (op === 'fill') { out.selector=selector(c.selector); out.value=text(c.value,MAX_TEXT,true); }
  if (op === 'select') { out.selector=selector(c.selector); out.values=stringArray(c.values); }
  if (op === 'scroll') { out.dx=number(c.dx,-5000,5000); out.dy=number(c.dy,-5000,5000); }
  if (op === 'wait') {
    out.selector=selector(c.selector); out.state=c.state ?? 'visible';
    if (!['visible','hidden','attached','detached'].includes(out.state)) throw fail('INVALID_INPUT');
  }
  return Object.freeze(out);
}

// Fixed owned DOM extraction, never a caller-provided expression. Visits at most
// 4,000 nodes and depth 64, excludes form/editable/hidden/sensitive subtrees, and
// reads text-node content only. It does not read HTML, input values or attributes
// that could contain credentials. Visible ordinary text can STILL contain secrets.
function visibleText(root, {maxChars}) {
  const forbidden = new Set(['INPUT','TEXTAREA','SELECT','OPTION','SCRIPT','STYLE','NOSCRIPT','TEMPLATE']);
  const view = root.ownerDocument?.defaultView;
  function excluded(node) {
    if (forbidden.has(node.tagName) || node.hasAttribute('hidden') ||
        node.getAttribute('aria-hidden')==='true' || node.hasAttribute('contenteditable') ||
        node.hasAttribute('data-sensitive') || node.hasAttribute('data-omnipilot-sensitive')) return true;
    const style=view?.getComputedStyle(node);
    return !style || style.display==='none' || ['hidden','collapse'].includes(style.visibility);
  }
  let ancestor=root, ancestors=0;
  while (ancestor && ancestors++<64) {
    if (ancestor.nodeType===1 && excluded(ancestor)) return {text:'',visited:0,truncated:false};
    ancestor=ancestor.parentElement;
  }
  if (ancestor) return {text:'',visited:0,truncated:true};
  let visited=0, output='', truncated=false;
  const stack=[{node:root,depth:0}];
  while (stack.length && visited<4000 && output.length<maxChars) {
    const {node,depth}=stack.pop(); visited++;
    if (node !== root && node.nextSibling) stack.push({node:node.nextSibling,depth});
    if (depth>64) { truncated=true; continue; }
    if (node.nodeType===1) {
      if (excluded(node)) continue;
    } else if (node.nodeType===3) {
      const value=node.nodeValue || '';
      const remaining=maxChars-output.length;
      output+=value.slice(0,remaining);
      if (value.length>remaining) truncated=true;
    }
    // Only one sibling and one child are retained per traversal step; no whole-DOM array.
    if (node.firstChild) stack.push({node:node.firstChild,depth:depth+1});
  }
  return {text:output,visited,truncated:truncated || stack.length>0};
}
function fieldMetadata(element) {
  return {tag:element.tagName?.toLowerCase(),type:(element.getAttribute('type') || '').toLowerCase(),
    autocomplete:(element.getAttribute('autocomplete') || '').toLowerCase()};
}
function sensitiveField(meta) {
  return !meta || ['password','hidden','file'].includes(meta.type) ||
    typeof meta.autocomplete!=='string' || /(?:password|one-time-code)/.test(meta.autocomplete);
}
function boundedText(value) {
  if (typeof value !== 'string' || value.length>16000) throw fail('EVIDENCE_LIMIT');
  const bytes=Buffer.from(value);
  if (bytes.length<=MAX_SNAPSHOT_BYTES) return {text:value,truncated:false};
  let end=MAX_SNAPSHOT_BYTES;
  const decoder=new TextDecoder('utf-8',{fatal:true});
  while (end>MAX_SNAPSHOT_BYTES-4) {
    try { return {text:decoder.decode(bytes.subarray(0,end)),truncated:true}; } catch { end--; }
  }
  throw fail('EVIDENCE_LIMIT');
}
function required(object,name) {
  if (!object || typeof object[name] !== 'function') throw fail('DRIVER_UNSUPPORTED');
  return object[name].bind(object);
}

/** Trusted runtime entry point. Never expose through a tool or accept request-supplied
 * context/guard objects. Before binding, the owner must install and independently
 * verify full-context egress/protocol enforcement, including redirects, DNS changes,
 * subresources, workers, WebSockets, popups, and local/infrastructure destinations.
 * bindContext must synchronously return the exact context, an AbortSignal and three
 * methods: assertActive() -> undefined, authorizeNavigation(url) -> void/Promise<void>,
 * isolate(reason) -> void/Promise<void>. None of those declarations proves enforcement.
 */
export function createGenericBrowserOwner({context,egressGuard,maxPendingCommands=16,maxTabs=8}={}) {
  number(maxPendingCommands,1,64,true); number(maxTabs,1,16,true);
  const pages=required(context,'pages'), newPage=required(context,'newPage');
  const on=required(context,'on'), off=required(context,'off');
  if (claimedContexts.has(context)) throw fail('CONTEXT_ALREADY_OWNED');
  let lease;
  try { lease=required(egressGuard,'bindContext')(context); } catch { throw fail('EGRESS_REQUIRED'); }
  if (!lease || lease.context!==context || !(lease.revocationSignal instanceof AbortSignal)) throw fail('EGRESS_REQUIRED');
  const assertGuard=required(lease,'assertActive'), authorizeNavigation=required(lease,'authorizeNavigation');
  const isolate=required(lease,'isolate'), signal=lease.revocationSignal;
  const capability=Object.freeze(Object.create(null));
  const pending=[], tabs=new Map(), ids=new WeakMap();
  let active=null, selected=null, nextTab=1, generation=0, scheduled=false, closed=false, sequence=0;
  let stopReason=null, isolationRequested=false, isolationState='not-requested', listenerCleanupFailed=false;
  function outcome(entry, code) { return fail(code,!!entry?.dispatched,!!entry?.effectDispatched); }
  function settle(entry,error,result) {
    if (entry.done) return;
    entry.done=true; clearTimeout(entry.timer);
    if (error) entry.reject(error); else entry.resolve(result);
  }
  function diagnostics() { return Object.freeze({closed,stopReason,generation,pending:pending.length,
    active:active!==null,activeOutcome:active?.effectDispatched?'unknown':active?'not-dispatched':'none',
    isolationRequested,isolationState,listenerCleanupFailed,browserTerminationVerified:false,sequence}); }
  function stop(code='OWNER_STOPPED') {
    if (closed) return diagnostics();
    closed=true; generation++; stopReason=code;
    for (const entry of pending.splice(0)) settle(entry,outcome(entry,code));
    if (active) settle(active,outcome(active,code));
    // Cleanup is best-effort. A driver throwing from off() must never prevent
    // containment from being requested or replace the sanitized command outcome.
    for (const remove of [()=>signal.removeEventListener('abort',revoked),
      ()=>off('close',contextClosed),()=>off('page',pageAdded)]) {
      try { remove(); } catch { listenerCleanupFailed=true; }
    }
    isolationRequested=true; isolationState='requested';
    try {
      Promise.resolve(isolate(code)).then(value=>{
        isolationState=value===undefined?'acknowledged':'failed';
      },()=>{isolationState='failed';});
    } catch { isolationState='failed'; }
    return diagnostics();
  }
  function live(entry) {
    if (closed || entry && (entry.done || entry.generation!==generation)) throw outcome(entry,stopReason || 'OWNER_STOPPED');
    // An overdue timer can run after promise microtasks. The absolute deadline
    // is checked here as well, including after awaited calls and before success.
    if (entry && performance.now()>=entry.deadline) {
      stop('DEADLINE_EXCEEDED'); throw outcome(entry,'DEADLINE_EXCEEDED');
    }
    try {
      if (signal.aborted || assertGuard()!==undefined) throw Error();
    } catch { stop('EGRESS_UNAVAILABLE'); throw outcome(entry,'EGRESS_UNAVAILABLE'); }
    if (closed) throw outcome(entry,stopReason);
  }
  function origin(page) {
    const raw=required(page,'url')();
    if (raw==='about:blank') return raw;
    try {
      if (typeof raw!=='string' || raw.length>8192) throw Error();
      const parsed=new URL(raw);
      if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.port) throw Error();
      return parsed.origin;
    } catch { stop('UNSAFE_PAGE_STATE'); throw fail('UNSAFE_PAGE_STATE'); }
  }
  function refresh() {
    const list=pages();
    if (!Array.isArray(list) || list.length>maxTabs) { stop('TAB_LIMIT'); throw fail('TAB_LIMIT'); }
    const present=new Set(list);
    for (const [id,page] of tabs) if (!present.has(page) || required(page,'isClosed')()) tabs.delete(id);
    for (const page of list) {
      if (required(page,'context')()!==context) { stop('CONTEXT_MISMATCH'); throw fail('CONTEXT_MISMATCH'); }
      if (required(page,'isClosed')()) continue;
      if (!ids.has(page)) {
        if (nextTab>999999999) { stop('TAB_LIMIT'); throw fail('TAB_LIMIT'); }
        ids.set(page,'tab-'+nextTab++);
      }
      tabs.set(ids.get(page),page); origin(page);
    }
    if (!tabs.has(selected)) selected=tabs.keys().next().value ?? null;
  }
  function pageFor(id) {
    const page=tabs.get(id);
    if (!page || required(page,'isClosed')() || required(page,'context')()!==context) throw fail('TAB_UNAVAILABLE');
    origin(page); return page;
  }
  async function run(entry) {
    const c=entry.command;
    live(entry); refresh(); live(entry);
    const remaining=()=>Math.max(1,Math.floor(entry.deadline-performance.now()));
    async function step(call,effect=false) {
      live(entry);
      if (performance.now()>=entry.deadline) { stop('DEADLINE_EXCEEDED'); throw outcome(entry,'DEADLINE_EXCEEDED'); }
      entry.dispatched=true; if (effect) entry.effectDispatched=true;
      const value=await call(remaining());
      live(entry); return value;
    }
    if (c.op==='status') return {tabCount:tabs.size,selectedTabId:selected};
    if (c.op==='tabs.list') return {tabs:Object.freeze([...tabs].map(([id,page])=>Object.freeze({id,selected:id===selected,origin:origin(page)})))};
    if (c.op==='tabs.create') {
      if (tabs.size>=maxTabs) throw fail('TAB_LIMIT');
      const page=await step(()=>newPage(),true);
      refresh();
      if (!ids.has(page) || tabs.get(ids.get(page))!==page) { stop('CONTEXT_MISMATCH'); throw fail('CONTEXT_MISMATCH'); }
      selected=ids.get(page); return {tabId:selected,origin:origin(page)};
    }
    const page=pageFor(c.tabId);
    const viewport=()=>{
      const size=required(page,'viewportSize')();
      if (!size || !Number.isSafeInteger(size.width) || !Number.isSafeInteger(size.height) ||
          size.width<1 || size.height<1 || size.width>8192 || size.height>8192) throw fail('VIEWPORT_REQUIRED');
      return size;
    };
    const point=()=>{ const size=viewport(); if(c.x>=size.width || c.y>=size.height) throw fail('INVALID_INPUT'); };
    const locator=()=>required(page,'locator')(c.selector);
    async function unique() {
      const target=locator();
      if (await step(()=>required(target,'count')())!==1) throw fail('TARGET_NOT_UNIQUE');
      return target;
    }
    async function focusedField(requireTextField) {
      const target=required(page,'locator')(':focus');
      const count=await step(()=>required(target,'count')());
      if (count!==1) { if(requireTextField || count!==0)throw fail('SENSITIVE_FIELD_REFUSED'); return; }
      const meta=await step(()=>required(target,'evaluate')(fieldMetadata));
      if (sensitiveField(meta) || requireTextField && !['input','textarea'].includes(meta.tag))
        throw fail('SENSITIVE_FIELD_REFUSED');
      // Advisory fixed inspection only: page scripts may change focus/type after
      // this check. It is not an atomic credential-entry or authenticated-profile boundary.
    }
    if (c.op==='tabs.select') { await step(()=>required(page,'bringToFront')(),true); selected=c.tabId; }
    else if (c.op==='tabs.close') { await step(()=>required(page,'close')({runBeforeUnload:false}),true); refresh(); }
    else if (c.op==='navigate') {
      const permission=await authorizeNavigation(c.url);
      live(entry);
      if (permission!==undefined) { stop('EGRESS_UNAVAILABLE'); throw fail('EGRESS_UNAVAILABLE'); }
      await step(timeout=>required(page,'goto')(c.url,{timeout,waitUntil:'domcontentloaded'}),true);
      origin(page);
    } else if (['back','forward','reload'].includes(c.op)) {
      const method={back:'goBack',forward:'goForward',reload:'reload'}[c.op];
      await step(timeout=>required(page,method)({timeout,waitUntil:'domcontentloaded'}),true); origin(page);
    } else if (c.op==='snapshot') {
      const target=await unique();
      const evidence=await step(()=>required(target,'evaluate')(visibleText,{maxChars:c.maxChars}));
      if (!evidence || !Number.isSafeInteger(evidence.visited) || evidence.visited<0 || evidence.visited>4000 ||
          typeof evidence.truncated!=='boolean') throw fail('EVIDENCE_LIMIT');
      const result=boundedText(evidence.text);
      return {...result,truncated:result.truncated || evidence.truncated,visited:evidence.visited};
    } else if (c.op==='screenshot') {
      const size=viewport(), clip={x:c.x,y:c.y,width:c.width ?? Math.min(1280,size.width-c.x),height:c.height ?? Math.min(720,size.height-c.y)};
      if (clip.width<1 || clip.height<1 || clip.width*clip.height>2_000_000 ||
          clip.x+clip.width>size.width || clip.y+clip.height>size.height) throw fail('INVALID_INPUT');
      const bytes=await step(timeout=>required(page,'screenshot')({type:'png',timeout,clip,fullPage:false,
        scale:'css',animations:'allow',caret:'initial',mask:[required(page,'locator')(MASK)]}),true);
      if (!(bytes instanceof Uint8Array) || bytes.byteLength<24 || bytes.byteLength>MAX_PNG_BYTES) throw fail('EVIDENCE_LIMIT');
      const png=Buffer.from(bytes);
      if (png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' ||
          png.readUInt32BE(16)<1 || png.readUInt32BE(20)<1 ||
          png.readUInt32BE(16)>clip.width || png.readUInt32BE(20)>clip.height) throw fail('EVIDENCE_LIMIT');
      return {mimeType:'image/png',base64:png.toString('base64'),width:png.readUInt32BE(16),height:png.readUInt32BE(20),
        redactionComplete:false};
    } else if (['click','doubleClick'].includes(c.op)) {
      const method=c.op==='click'?'click':'dblclick';
      if (c.selector) {
        const target=await unique(); await step(timeout=>required(target,method)({timeout}),true);
      } else { point(); await step(()=>required(page.mouse,method)(c.x,c.y),true); }
      origin(page);
    } else if (c.op==='move') { point(); await step(()=>required(page.mouse,'move')(c.x,c.y),true); }
    else if (c.op==='type') { await focusedField(true); await step(()=>required(page.keyboard,'insertText')(c.text),true); }
    else if (c.op==='press') {
      if (!['Tab','Shift+Tab','Escape'].includes(c.key)) await focusedField(false);
      await step(()=>required(page.keyboard,'press')(c.key),true);
    }
    else if (c.op==='fill') {
      const target=await unique(), meta=await step(()=>required(target,'evaluate')(fieldMetadata));
      if (sensitiveField(meta) || !['input','textarea'].includes(meta.tag)) throw fail('SENSITIVE_FIELD_REFUSED');
      await step(timeout=>required(target,'fill')(c.value,{timeout}),true);
    } else if (c.op==='select') {
      const target=await unique(); await step(timeout=>required(target,'selectOption')([...c.values],{timeout}),true);
    } else if (c.op==='scroll') await step(()=>required(page.mouse,'wheel')(c.dx,c.dy),true);
    else if (c.op==='wait') await step(timeout=>required(locator(),'waitFor')({state:c.state,timeout}));
    if (c.op!=='tabs.close') origin(page);
    return {tabId:c.tabId,completed:true};
  }
  function schedule() {
    if (scheduled || active || closed || pending.length===0) return;
    scheduled=true;
    queueMicrotask(()=>{
      scheduled=false;
      if (closed || active) return;
      const entry=pending.shift();
      if (!entry) return;
      active=entry;
      run(entry).then(data=>{
        if (entry.done) return;
        live(entry);
        settle(entry,null,Object.freeze({op:entry.command.op,sequence:++sequence,untrustedContent:true,data:Object.freeze(data)}));
      }).catch(error=>{
        if (entry.done) return;
        if (entry.effectDispatched) stop('OPERATION_UNCERTAIN');
        else settle(entry,outcome(entry,ownErrors.has(error)?error.code:'DRIVER_FAILED'));
      }).finally(()=>{active=null;schedule();});
    });
  }
  async function execute(input) {
    const normalized=command(input);
    live();
    if (pending.length>=maxPendingCommands) throw fail('QUEUE_FULL');
    return new Promise((resolve,reject)=>{
      const entry={command:normalized,generation,resolve,reject,done:false,dispatched:false,effectDispatched:false,
        deadline:performance.now()+normalized.timeoutMs,timer:null};
      entry.timer=setTimeout(()=>{
        if (entry.done) return;
        if (active===entry) stop('DEADLINE_EXCEEDED');
        else {
          const index=pending.indexOf(entry); if(index>=0)pending.splice(index,1);
          settle(entry,outcome(entry,'DEADLINE_EXCEEDED'));
        }
      },normalized.timeoutMs);
      pending.push(entry); schedule();
    });
  }
  function revoked() { stop('EGRESS_REVOKED'); }
  function contextClosed() { stop('CONTEXT_CLOSED'); }
  function pageAdded() {
    try { live(); if(pages().length>maxTabs)stop('TAB_LIMIT'); } catch { stop('EGRESS_UNAVAILABLE'); }
  }
  claimedContexts.add(context);
  try {
    on('close',contextClosed); on('page',pageAdded); signal.addEventListener('abort',revoked,{once:true});
    live(); refresh();
  } catch { stop('OWNER_INITIALIZATION_FAILED'); throw fail('OWNER_INITIALIZATION_FAILED'); }
  owners.set(capability,{execute});
  return Object.freeze({capability,stop:()=>stop(),diagnostics});
}

export function createGenericBrowserAdapter(capability) {
  const owner=capability && owners.get(capability);
  if (!owner) throw fail('OWNER_CAPABILITY_REQUIRED');
  return Object.freeze({execute:input=>owner.execute(input)});
}
