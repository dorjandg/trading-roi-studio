// Fake Context/Page/DOM only. No Playwright/browser, listener, network or real account.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGenericBrowserOwner,createGenericBrowserAdapter} from '../simulation/omnipilot-generic-browser.mjs';

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKrkAAAAASUVORK5CYII=','base64');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const document={defaultView:{getComputedStyle:node=>node.style}};
function textNode(value){return {nodeType:3,nodeValue:value,firstChild:null,nextSibling:null,ownerDocument:document};}
function element(tag='div',attributes={},children=[]){
  const node={nodeType:1,tagName:tag.toUpperCase(),ownerDocument:document,parentElement:null,nextSibling:null,
    style:{display:'block',visibility:'visible'},firstChild:children[0] ?? null,
    hasAttribute:key=>Object.hasOwn(attributes,key),getAttribute:key=>attributes[key] ?? null};
  for(let i=0;i<children.length;i++){children[i].parentElement=node;children[i].nextSibling=children[i+1] ?? null;}
  return node;
}
function fakeContext(){
  const listeners=new Map(), list=[], calls=[];
  let pageNumber=0;
  const context={calls,list,hook:async()=>{},counts:new Map(),roots:new Map(),png:PNG,
    pages:()=>[...list],
    on(name,callback){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(callback);},
    off(name,callback){listeners.get(name)?.delete(callback);},
    emit(name,value){for(const callback of [...(listeners.get(name) ?? [])])callback(value);},
    async newPage(){await invoke('context.newPage',null,[]);const page=makePage();context.emit('page',page);return page;}
  };
  async function invoke(method,page,args){calls.push({method,page:page?.label ?? null,args});return context.hook(method,page,args);}
  function makePage(){
    let address='about:blank',closed=false;
    const page={label:'p'+ ++pageNumber,size:{width:1280,height:720},
      context:()=>context,isClosed:()=>closed,url:()=>address,viewportSize:()=>({...page.size}),
      setUrl:value=>{address=value;},
      async goto(value,options){await invoke('goto',page,[value,options]);address=value;},
      goBack:options=>invoke('goBack',page,[options]),goForward:options=>invoke('goForward',page,[options]),
      reload:options=>invoke('reload',page,[options]),bringToFront:()=>invoke('bringToFront',page,[]),
      async close(options){await invoke('close',page,[options]);closed=true;list.splice(list.indexOf(page),1);},
      async screenshot(options){await invoke('screenshot',page,[options]);return context.png;},
      locator(query){return {
        query,count:async()=>{await invoke('count',page,[query]);return context.counts.get(query) ?? 1;},
        async evaluate(callback,arg){
          await invoke('evaluate',page,[query]);
          const root=context.roots.get(query) ?? (query==='body'?element('body',{},[textNode('Public fixture text')]):element('input',{type:'text'}));
          return callback(root,arg);
        },
        click:options=>invoke('locator.click',page,[query,options]),dblclick:options=>invoke('locator.dblclick',page,[query,options]),
        fill:(value,options)=>invoke('fill',page,[query,value,options]),
        selectOption:(values,options)=>invoke('selectOption',page,[query,values,options]),
        waitFor:options=>invoke('waitFor',page,[query,options])
      };},
      mouse:{},keyboard:{}
    };
    for(const name of ['click','dblclick','move','wheel'])page.mouse[name]=(...args)=>invoke('mouse.'+name,page,args);
    for(const name of ['insertText','press'])page.keyboard[name]=(...args)=>invoke('keyboard.'+name,page,args);
    list.push(page);return page;
  }
  context.makePage=makePage;makePage();return context;
}
function fakeGuard(context){
  const revoked=new AbortController();
  const state={active:true,navigations:[],isolation:[],onAssert:null,authorize:async()=>{}};
  const lease={context,revocationSignal:revoked.signal,
    assertActive(){state.onAssert?.();if(!state.active)throw Error('synthetic guard unavailable');},
    async authorizeNavigation(value){state.navigations.push(value);return state.authorize(value);},
    isolate(reason){state.isolation.push(reason);}
  };
  return {state,lease,revoked,guard:{bindContext:bound=>{assert.equal(bound,context);return lease;}}};
}
function harness(t,options={}){
  const context=fakeContext(), guard=fakeGuard(context);
  const owner=createGenericBrowserOwner({context,egressGuard:guard.guard,...options});
  const adapter=createGenericBrowserAdapter(owner.capability);
  t.after(()=>owner.stop());
  return {context,guard,owner,adapter,execute:command=>adapter.execute(command)};
}
function rejection(code,{dispatched,outcomeUnknown}={}){return error=>{
  assert.equal(error.code,code);assert.equal(error.retrySafe,false);
  if(dispatched!==undefined)assert.equal(error.dispatched,dispatched);
  if(outcomeUnknown!==undefined)assert.equal(error.outcomeUnknown,outcomeUnknown);
  return true;
};}

test('opaque context-bound authority is required; predicates and booleans cannot grant it',t=>{
  assert.throws(()=>createGenericBrowserAdapter({}),rejection('OWNER_CAPABILITY_REQUIRED'));
  const context=fakeContext(), guard=fakeGuard(context);
  assert.throws(()=>createGenericBrowserOwner({context,egressGuard:()=>true}));
  assert.throws(()=>createGenericBrowserOwner({context,egressGuard:{bindContext:()=>true}}));
  assert.throws(()=>createGenericBrowserOwner({context,egressGuard:{bindContext:()=>({...guard.lease,context:{}})}}));
  const invalidContext=fakeContext(),invalidGuard=fakeGuard(invalidContext);
  assert.throws(()=>createGenericBrowserOwner({context:invalidContext,egressGuard:{bindContext:()=>({...invalidGuard.lease,assertActive:()=>true})}}));
  const owner=createGenericBrowserOwner({context,egressGuard:guard.guard});t.after(()=>owner.stop());
  assert.throws(()=>createGenericBrowserAdapter({...owner.capability}),rejection('OWNER_CAPABILITY_REQUIRED'));
  assert.throws(()=>createGenericBrowserOwner({context,egressGuard:guard.guard}),rejection('CONTEXT_ALREADY_OWNED'));
  assert.equal(Object.keys(owner.capability).length,0);
});

test('generic tabs and navigation use explicit IDs and redact URL paths and queries',async t=>{
  const h=harness(t);
  assert.equal((await h.execute({op:'status'})).data.tabCount,1);
  await h.execute({op:'navigate',tabId:'tab-1',url:'https://public.example/path?synthetic_token=DO_NOT_ECHO#section'});
  const listing=await h.execute({op:'tabs.list'});
  assert.equal(listing.data.tabs[0].origin,'https://public.example');
  assert.ok(!JSON.stringify(listing).includes('DO_NOT_ECHO'));
  const created=await h.execute({op:'tabs.create'});
  assert.equal(created.data.tabId,'tab-2');
  await h.execute({op:'tabs.select',tabId:'tab-1'});
  for(const op of ['back','forward','reload'])await h.execute({op,tabId:'tab-1'});
  await h.execute({op:'tabs.close',tabId:'tab-2'});
  assert.equal((await h.execute({op:'status'})).data.tabCount,1);
  assert.equal(h.guard.state.navigations.length,1);
  assert.deepEqual(h.context.calls.filter(c=>['goto','goBack','goForward','reload'].includes(c.method)).map(c=>c.method),
    ['goto','goBack','goForward','reload']);
  assert.equal(h.owner.diagnostics().browserTerminationVerified,false);
});

test('pointer, keyboard, form, scrolling and waiting primitives dispatch bounded fixed methods',async t=>{
  const h=harness(t);
  const commands=[{op:'click',selector:'#button'},{op:'doubleClick',selector:'#button'},
    {op:'click',x:10,y:20},{op:'doubleClick',x:10,y:20},{op:'move',x:2,y:3},
    {op:'type',text:'owned fixture'},{op:'press',key:'Enter'},
    {op:'fill',selector:'#field',value:'fixture value'},
    {op:'select',selector:'#select',values:['a','b']},{op:'scroll',dx:0,dy:500},
    {op:'wait',selector:'#message',state:'visible'}];
  for(const c of commands){const result=await h.execute({...c,tabId:'tab-1'});assert.equal(result.data.completed,true);}
  for(const method of ['locator.click','locator.dblclick','mouse.click','mouse.dblclick','mouse.move',
    'keyboard.insertText','keyboard.press','fill','selectOption','mouse.wheel','waitFor'])
    assert.ok(h.context.calls.some(call=>call.method===method),method);
  for(const call of h.context.calls){
    for(const arg of call.args)if(arg && typeof arg==='object' && Object.hasOwn(arg,'timeout'))
      assert.ok(arg.timeout>0 && arg.timeout<=5000);
  }
});

test('fixed snapshot extraction excludes fields, hidden ancestors and sensitive subtrees',async t=>{
  const h=harness(t);let valuesRead=0;
  const input=element('input',{type:'password'});
  Object.defineProperty(input,'value',{get(){valuesRead++;throw Error('must not read');}});
  const hiddenChild=element('span',{},[textNode('HIDDEN_SECRET')]);
  const hidden=element('div',{hidden:''},[hiddenChild]);
  const body=element('body',{},[textNode('Visible before '),input,
    element('textarea',{},[textNode('TEXTAREA_SECRET')]),hidden,
    element('div',{'data-sensitive':''},[textNode('SENSITIVE_SECRET')]),
    element('div',{contenteditable:'true'},[textNode('EDITABLE_SECRET')]),
    element('script',{},[textNode('SCRIPT_SECRET')]),textNode('visible after')]);
  h.context.roots.set('body',body);h.context.roots.set('#hidden-child',hiddenChild);
  const result=await h.execute({op:'snapshot',tabId:'tab-1'});
  assert.equal(result.data.text,'Visible before visible after');assert.equal(valuesRead,0);
  assert.ok(!JSON.stringify(result).includes('SECRET'));
  assert.equal((await h.execute({op:'snapshot',tabId:'tab-1',selector:'#hidden-child'})).data.text,'');
  assert.equal(result.untrustedContent,true);
});

test('snapshot output bytes and traversal work are bounded',async t=>{
  const h=harness(t);
  h.context.roots.set('body',element('body',{},[textNode('界'.repeat(17000))]));
  const large=await h.execute({op:'snapshot',tabId:'tab-1',maxChars:16000});
  assert.ok(Buffer.byteLength(large.data.text)<=32768);assert.equal(large.data.truncated,true);
  assert.ok(!large.data.text.includes('\ufffd'));
  h.context.roots.set('body',element('body',{},Array.from({length:2500},()=>element('span',{},[textNode('x')]))));
  const many=await h.execute({op:'snapshot',tabId:'tab-1',maxChars:16000});
  assert.equal(many.data.visited,4000);assert.equal(many.data.truncated,true);
});

test('screenshots are clipped, masked, bounded PNG evidence with incomplete-redaction flag',async t=>{
  const h=harness(t);h.context.list[0].size={width:375,height:812};
  const result=await h.execute({op:'screenshot',tabId:'tab-1'});
  assert.equal(result.data.redactionComplete,false);
  assert.deepEqual(Buffer.from(result.data.base64,'base64'),PNG);
  const options=h.context.calls.find(c=>c.method==='screenshot').args[0];
  assert.deepEqual(options.clip,{x:0,y:0,width:375,height:720});assert.equal(options.fullPage,false);
  assert.equal(options.animations,'allow');assert.equal(options.caret,'initial');
  assert.equal(options.mask.length,1);assert.match(options.mask[0].query,/input/);assert.ok(!('path' in options));
  h.context.png=Buffer.alloc(2_000_001);
  await assert.rejects(h.execute({op:'screenshot',tabId:'tab-1'}),rejection('OPERATION_UNCERTAIN',{outcomeUnknown:true}));
});

test('input shape, accessors, scripts, unsafe URL forms and unsupported shortcuts fail before dispatch',async t=>{
  const h=harness(t);let getters=0;
  const accessor={op:'fill',tabId:'tab-1',selector:'#field',get value(){getters++;return 'unsafe';}};
  const sparse=[];sparse.length=2;sparse[1]='b';
  const invalid=[null,[],Object.create({op:'status'}),accessor,{op:'evaluate',script:'alert(1)'},
    {op:'status',extra:true},{op:'status',[Symbol('x')]:true},{op:'click',tabId:'tab-1',selector:'#a',x:1,y:1},
    {op:'move',tabId:'tab-1',x:NaN,y:1},{op:'fill',tabId:'tab-1',selector:'#a',value:'x'.repeat(4097)},
    {op:'fill',tabId:'tab-1',selector:'#a',value:'\ud800'},
    {op:'select',tabId:'tab-1',selector:'#a',values:sparse},{op:'press',tabId:'tab-1',key:'Control+L'},
    {op:'navigate',tabId:'tab-1',url:'file:///tmp/private'},{op:'navigate',tabId:'tab-1',url:'javascript:alert(1)'},
    {op:'navigate',tabId:'tab-1',url:'https://user:password@public.example/'},
    {op:'navigate',tabId:'tab-1',url:'http://public.example/'},{op:'status',timeoutMs:15001},
    {op:'click',x:1,y:1},{op:'screenshot',tabId:'tab-1',width:1920,height:1200}];
  for(const value of invalid)await assert.rejects(h.execute(value),rejection('INVALID_INPUT'));
  assert.equal(getters,0);assert.deepEqual(h.context.calls,[]);
});

test('password, hidden, file and one-time-code fills never reach the input method',async t=>{
  const h=harness(t);
  for(const attributes of [{type:'password'},{type:'hidden'},{type:'file'},{type:'text',autocomplete:'one-time-code'}]){
    h.context.roots.set('#field',element('input',attributes));
    await assert.rejects(h.execute({op:'fill',tabId:'tab-1',selector:'#field',value:'synthetic'}),rejection('SENSITIVE_FIELD_REFUSED'));
  }
  assert.ok(!h.context.calls.some(call=>call.method==='fill'));
});

test('typing and text-affecting keys inspect focused fields and cannot bypass sensitive-field refusal',async t=>{
  const h=harness(t);
  for(const attributes of [{type:'password'},{type:'hidden'},{type:'file'},{type:'text',autocomplete:'one-time-code'}]){
    h.context.roots.set(':focus',element('input',attributes));
    await assert.rejects(h.execute({op:'type',tabId:'tab-1',text:'synthetic'}),rejection('SENSITIVE_FIELD_REFUSED'));
    for(const key of ['Space','Enter','Backspace','Delete','Control+A'])
      await assert.rejects(h.execute({op:'press',tabId:'tab-1',key}),rejection('SENSITIVE_FIELD_REFUSED'));
  }
  assert.ok(!h.context.calls.some(call=>call.method.startsWith('keyboard.')));
  await h.execute({op:'press',tabId:'tab-1',key:'Tab'});
  h.context.counts.set(':focus',0);
  await assert.rejects(h.execute({op:'type',tabId:'tab-1',text:'synthetic'}),rejection('SENSITIVE_FIELD_REFUSED'));
  assert.equal(h.context.calls.filter(call=>call.method==='keyboard.press').length,1);
});

test('queued input records and arrays are immutable snapshots, with FIFO dispatch',async t=>{
  const h=harness(t),started=deferred(),release=deferred();
  h.context.hook=async method=>{if(method==='goto'){started.resolve();await release.promise;}};
  const first=h.execute({op:'navigate',tabId:'tab-1',url:'https://public.example/'});
  await started.promise;
  const fill={op:'fill',tabId:'tab-1',selector:'#field',value:'original'};
  const values=['original'];
  const second=h.execute(fill),third=h.execute({op:'select',tabId:'tab-1',selector:'#select',values});
  fill.value='mutated';values[0]='mutated';release.resolve();
  await Promise.all([first,second,third]);
  assert.equal(h.context.calls.find(c=>c.method==='fill').args[1],'original');
  assert.deepEqual(h.context.calls.find(c=>c.method==='selectOption').args[1],['original']);
  assert.deepEqual(h.context.calls.filter(c=>['goto','fill','selectOption'].includes(c.method)).map(c=>c.method),['goto','fill','selectOption']);
});

test('queued commands expire before dispatch and queue overflow adds no work',async t=>{
  const h=harness(t,{maxPendingCommands:1}),started=deferred(),release=deferred();
  h.context.hook=async method=>{if(method==='goto'){started.resolve();await release.promise;}};
  const first=h.execute({op:'navigate',tabId:'tab-1',url:'https://public.example/',timeoutMs:1000});await started.promise;
  const expired=assert.rejects(h.execute({op:'click',tabId:'tab-1',x:1,y:1,timeoutMs:10}),rejection('DEADLINE_EXCEEDED',{dispatched:false,outcomeUnknown:false}));
  await assert.rejects(h.execute({op:'click',tabId:'tab-1',x:2,y:2}),rejection('QUEUE_FULL'));
  await expired;release.resolve();await first;
  assert.ok(!h.context.calls.some(c=>c.method==='mouse.click'));assert.equal(h.owner.diagnostics().closed,false);
});

test('stop before dispatch cancels admission permanently and requests containment once',async t=>{
  const h=harness(t);
  const rejected=assert.rejects(h.execute({op:'click',tabId:'tab-1',x:1,y:1}),rejection('OWNER_STOPPED',{dispatched:false,outcomeUnknown:false}));
  h.owner.stop();h.owner.stop();await rejected;
  await assert.rejects(h.execute({op:'status'}),rejection('OWNER_STOPPED'));
  assert.deepEqual(h.context.calls,[]);assert.equal(h.guard.state.isolation.length,1);
  assert.equal(h.owner.diagnostics().browserTerminationVerified,false);
});

test('in-flight stop settles callers without waiting and preserves uncertain late effects',async t=>{
  const h=harness(t),started=deferred(),release=deferred();
  h.context.hook=async method=>{if(method==='goto'){started.resolve();await release.promise;}};
  const active=assert.rejects(h.execute({op:'navigate',tabId:'tab-1',url:'https://public.example/'}),
    rejection('OWNER_STOPPED',{dispatched:true,outcomeUnknown:true}));
  await started.promise;
  const queued=assert.rejects(h.execute({op:'click',tabId:'tab-1',x:1,y:1}),rejection('OWNER_STOPPED',{dispatched:false,outcomeUnknown:false}));
  h.owner.stop();await Promise.all([active,queued]);
  assert.equal(h.owner.diagnostics().active,true);assert.equal(h.owner.diagnostics().activeOutcome,'unknown');
  release.resolve();await tick();
  assert.equal(h.context.list[0].url(),'https://public.example/','the fake late effect is not falsely described as cancelled');
  assert.equal(h.owner.diagnostics().sequence,0);assert.ok(!h.context.calls.some(c=>c.method==='mouse.click'));
});

test('a side-effect deadline poisons the owner and never dispatches later queued work',async t=>{
  const h=harness(t),started=deferred(),release=deferred();
  h.context.hook=async method=>{if(method==='goto'){started.resolve();await release.promise;}};
  const active=assert.rejects(h.execute({op:'navigate',tabId:'tab-1',url:'https://public.example/',timeoutMs:10}),
    rejection('DEADLINE_EXCEEDED',{dispatched:true,outcomeUnknown:true}));
  await started.promise;
  const queued=assert.rejects(h.execute({op:'click',tabId:'tab-1',x:1,y:1}),rejection('DEADLINE_EXCEEDED',{dispatched:false}));
  await Promise.all([active,queued]);
  assert.equal(h.owner.diagnostics().closed,true);
  await assert.rejects(h.execute({op:'status'}),rejection('DEADLINE_EXCEEDED'));
  release.resolve();await tick();assert.equal(h.context.calls.filter(c=>c.method==='goto').length,1);
});

test('post-dispatch failure is sanitized and treated as an uncertain effect',async t=>{
  const h=harness(t);h.context.hook=async method=>{if(method==='mouse.click')throw Error('SECRET synthetic browser error https://private.example/');};
  await assert.rejects(h.execute({op:'click',tabId:'tab-1',x:1,y:1}),error=>{
    rejection('OPERATION_UNCERTAIN',{dispatched:true,outcomeUnknown:true})(error);
    assert.ok(!error.message.includes('SECRET'));assert.ok(!error.message.includes('private.example'));return true;
  });
  assert.equal(h.owner.diagnostics().closed,true);
});

test('guard revocation stops active and queued work immediately',async t=>{
  const h=harness(t),started=deferred(),release=deferred();
  h.context.hook=async method=>{if(method==='goto'){started.resolve();await release.promise;}};
  const active=assert.rejects(h.execute({op:'navigate',tabId:'tab-1',url:'https://public.example/'}),rejection('EGRESS_REVOKED',{outcomeUnknown:true}));
  await started.promise;
  const queued=assert.rejects(h.execute({op:'status'}),rejection('EGRESS_REVOKED',{dispatched:false}));
  h.guard.revoked.abort();await Promise.all([active,queued]);release.resolve();await tick();
  assert.equal(h.guard.state.isolation.length,1);
});

test('uncertain guard liveness and boolean navigation permission cannot dispatch',async t=>{
  const h=harness(t);h.guard.state.active=false;
  await assert.rejects(h.execute({op:'navigate',tabId:'tab-1',url:'https://public.example/'}),rejection('EGRESS_UNAVAILABLE'));
  assert.deepEqual(h.context.calls,[]);
  const other=harness(t);other.guard.state.authorize=async()=>true;
  await assert.rejects(other.execute({op:'navigate',tabId:'tab-1',url:'https://public.example/'}),rejection('EGRESS_UNAVAILABLE',{dispatched:false}));
  assert.ok(!other.context.calls.some(call=>call.method==='goto'));
});

test('navigation guard delay consumes the same deadline and cannot dispatch after late approval',async t=>{
  const h=harness(t),release=deferred();h.guard.state.authorize=()=>release.promise;
  await assert.rejects(h.execute({op:'navigate',tabId:'tab-1',url:'https://public.example/',timeoutMs:10}),
    rejection('DEADLINE_EXCEEDED',{dispatched:false,outcomeUnknown:false}));
  release.resolve();await tick();assert.deepEqual(h.context.calls,[]);
});

test('guard revocation inside liveness callback is checked before any driver action',async t=>{
  const h=harness(t);h.guard.state.onAssert=()=>h.guard.revoked.abort();
  await assert.rejects(h.execute({op:'click',tabId:'tab-1',x:1,y:1}),rejection('EGRESS_REVOKED',{dispatched:false}));
  assert.deepEqual(h.context.calls,[]);
});

test('tab limit and external context close invalidate the owner without claiming termination',async t=>{
  const h=harness(t,{maxTabs:1});
  await assert.rejects(h.execute({op:'tabs.create'}),rejection('TAB_LIMIT'));assert.equal(h.owner.diagnostics().closed,false);
  const popup=h.context.makePage();h.context.emit('page',popup);
  assert.equal(h.owner.diagnostics().stopReason,'TAB_LIMIT');assert.equal(h.owner.diagnostics().browserTerminationVerified,false);
  const other=harness(t);other.context.emit('close');
  await assert.rejects(other.execute({op:'status'}),rejection('CONTEXT_CLOSED'));
});

test('changed current page scheme blocks evidence access and cross-context pages are rejected',async t=>{
  const h=harness(t);h.context.list[0].setUrl('file:///synthetic/private');
  await assert.rejects(h.execute({op:'snapshot',tabId:'tab-1'}),rejection('UNSAFE_PAGE_STATE'));
  assert.deepEqual(h.context.calls,[]);
  const other=harness(t),foreign=fakeContext();other.context.list.push(foreign.list[0]);
  await assert.rejects(other.execute({op:'status'}),rejection('CONTEXT_MISMATCH'));
  assert.equal(other.owner.diagnostics().closed,true);
});

test('explicit queued tab IDs cannot drift with selected-tab changes',async t=>{
  const h=harness(t);await h.execute({op:'tabs.create'});
  const selected=h.execute({op:'tabs.select',tabId:'tab-2'});
  const clicked=h.execute({op:'click',tabId:'tab-1',x:1,y:1});await Promise.all([selected,clicked]);
  assert.equal(h.context.calls.find(c=>c.method==='mouse.click').page,'p1');
  await h.execute({op:'tabs.close',tabId:'tab-1'});
  await assert.rejects(h.execute({op:'click',tabId:'tab-1',x:1,y:1}),rejection('TAB_UNAVAILABLE'));
});

test('a read deadline also stops ownership until the outstanding driver call settles',async t=>{
  const h=harness(t),release=deferred();h.context.hook=method=>method==='count'?release.promise:Promise.resolve();
  await assert.rejects(h.execute({op:'snapshot',tabId:'tab-1',timeoutMs:10}),rejection('DEADLINE_EXCEEDED',{dispatched:true,outcomeUnknown:false}));
  assert.equal(h.owner.diagnostics().closed,true);release.resolve();await tick();
  assert.ok(!h.context.calls.some(c=>c.method==='evaluate'));
});

test('containment failure is observable but never changes unknown effects into safe retries',async t=>{
  const context=fakeContext(),guard=fakeGuard(context);
  guard.lease.isolate=()=>{throw Error('synthetic containment failure');};
  const owner=createGenericBrowserOwner({context,egressGuard:guard.guard});t.after(()=>owner.stop());
  owner.stop();assert.equal(owner.diagnostics().isolationState,'failed');
  assert.equal(owner.diagnostics().browserTerminationVerified,false);
  await assert.rejects(createGenericBrowserAdapter(owner.capability).execute({op:'status'}),rejection('OWNER_STOPPED'));
});

test('throwing listener cleanup cannot prevent containment or pending rejection',async t=>{
  const context=fakeContext(),guard=fakeGuard(context);
  context.off=()=>{throw Error('SECRET cleanup failure');};
  const owner=createGenericBrowserOwner({context,egressGuard:guard.guard});t.after(()=>owner.stop());
  const pending=assert.rejects(createGenericBrowserAdapter(owner.capability).execute({op:'status'}),rejection('OWNER_STOPPED'));
  const result=owner.stop();await pending;
  assert.equal(guard.state.isolation.length,1);assert.equal(result.listenerCleanupFailed,true);
  assert.ok(!JSON.stringify(result).includes('SECRET'));
});

test('listener registration failure attempts containment and exposes only a sanitized initialization error',()=>{
  const context=fakeContext(),guard=fakeGuard(context);
  context.on=()=>{throw Error('SECRET registration failure');};
  context.off=()=>{throw Error('SECRET cleanup failure');};
  assert.throws(()=>createGenericBrowserOwner({context,egressGuard:guard.guard}),error=>{
    rejection('OWNER_INITIALIZATION_FAILED')(error);assert.ok(!error.message.includes('SECRET'));return true;
  });
  assert.equal(guard.state.isolation.length,1);
});

test('absolute deadline rejects late driver success even before an overdue timer can run',async t=>{
  const h=harness(t);
  h.context.hook=async method=>{
    if(method==='mouse.click'){const until=performance.now()+25;while(performance.now()<until){ /* owned bounded blocking fixture */ }}
  };
  await assert.rejects(h.execute({op:'click',tabId:'tab-1',x:1,y:1,timeoutMs:10}),
    rejection('DEADLINE_EXCEEDED',{dispatched:true,outcomeUnknown:true}));
  assert.equal(h.owner.diagnostics().sequence,0);assert.equal(h.owner.diagnostics().closed,true);
});

test('screenshot timeout remains conservative about possible capture side effects',async t=>{
  const h=harness(t),release=deferred();h.context.hook=method=>method==='screenshot'?release.promise:Promise.resolve();
  await assert.rejects(h.execute({op:'screenshot',tabId:'tab-1',timeoutMs:10}),
    rejection('DEADLINE_EXCEEDED',{dispatched:true,outcomeUnknown:true}));
  release.resolve();await tick();assert.equal(h.owner.diagnostics().sequence,0);
});
