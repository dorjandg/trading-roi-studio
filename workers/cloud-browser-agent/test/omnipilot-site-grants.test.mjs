import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSiteGrants,planSiteControl,validateOrigin,validateSiteUrl}
  from '../src/omnipilot-site-grants.mjs';

const policy=JSON.stringify({version:1,sites:[
  {origin:'https://www.wikipedia.org',mode:'read'},
  {origin:'https://demo.playwright.dev',mode:'draft'}
]});
const draft=()=>({url:'https://demo.playwright.dev/todomvc/',mode:'draft',actions:[
  {op:'fill',selector:'input.new-todo',value:'isolated website draft'},
  {op:'click',selector:'.todo-list li .toggle'}
]});
const refused=fn=>assert.throws(fn,{code:'SITE_GRANT_REFUSED'});

test('exact-domain read and draft grants never infer permission from ALLOWED_ORIGINS',()=>{
  const grants=parseSiteGrants(policy);
  assert.equal(grants.length,2);
  assert.equal(Object.isFrozen(grants),true);
  assert.deepEqual(grants.map(x=>x.origin),
    ['https://www.wikipedia.org','https://demo.playwright.dev']);
  const read=planSiteControl({mode:'read',url:'https://www.wikipedia.org/'},policy);
  assert.equal(read.mode,'read');
  assert.equal(read.actions.length,0);
  assert.equal(read.hostname,'www.wikipedia.org');
  const prepared=planSiteControl(draft(),policy);
  assert.equal(prepared.mode,'draft');
  assert.equal(prepared.actions.length,2);
  assert.equal(Object.isFrozen(prepared.actions),true);
  refused(()=>planSiteControl({mode:'draft',url:'https://www.wikipedia.org/',
    actions:[{op:'click',selector:'a'}]},policy));
  refused(()=>planSiteControl({mode:'read',url:'https://other.wikipedia.org/'},policy));
});
test('fail closed without explicit, valid grants or on duplicate or wildcard entries',()=>{
  for(const raw of [undefined,'',null,'{}','{"version":1,"sites":[]}',
    JSON.stringify({version:1,sites:[{origin:'https://*.example.com',mode:'read'}]}),
    JSON.stringify({version:1,sites:[
      {origin:'https://demo.playwright.dev',mode:'read'},
      {origin:'https://demo.playwright.dev',mode:'draft'}
    ]}),
    JSON.stringify({version:1,sites:[{origin:'https://www.wikipedia.org',mode:'write'}]}),
    JSON.stringify({version:1,sites:[{origin:'https://www.wikipedia.org',mode:'read',extra:true}]}),
    JSON.stringify({version:1,sites:Array(17).fill({origin:'https://www.wikipedia.org',mode:'read'})})])
    refused(()=>parseSiteGrants(raw));
});
test('block private/IP, production and Finance sites even if operator JSON is malformed or permissive',()=>{
  for(const origin of ['http://www.wikipedia.org','https://localhost',
    'https://127.0.0.1','https://[::1]','https://service.internal',
    'https://device.local','https://foo.nip.io','https://a.sslip.io',
    'https://fin-kac.pages.dev','https://trading-roi-studio.pages.dev',
    'https://hub.immamarketing.com','https://www.glam-lingerie.com',
    'https://cloud-browser-agent-stage.dorjan-gjoni-dg.workers.dev',
    'https://finance-mcp-gateway-stage.dorjan-gjoni-dg.workers.dev',
    'https://a.xip.io','https://xn--bcher-kva.example','https://www.wikipedia.org:444',
    'https://www.wikipedia.org/','https://username:secret@www.wikipedia.org'])
    refused(()=>validateOrigin(origin));
});
test('reject credentials, queries, fragments and state-changing or encoded paths',()=>{
  for(const url of [
    'https://www.wikipedia.org/?q=anything','https://www.wikipedia.org/#secret',
    'https://admin:password@www.wikipedia.org/',
    'https://www.wikipedia.org/admin','https://www.wikipedia.org/api/foo',
    'https://www.wikipedia.org/save','https://www.wikipedia.org/order/3',
    'https://www.wikipedia.org/checkout/confirm',
    'https://www.wikipedia.org/%2e%2e/api/',
    'https://www.wikipedia.org/a%2Fb',
    'https://www.wikipedia.org//path',
    'http://www.wikipedia.org/',
    'https://www.wikipedia.org:444/',
    'https://www.wikipedia.org'
  ])refused(()=>validateSiteUrl(url));
  assert.equal(validateSiteUrl('https://www.wikipedia.org/wiki/Computer').origin,
    'https://www.wikipedia.org');
});
test('only non-submitting, bounded draft actions are accepted',()=>{
  const defaults=draft();
  for(const action of [
    {op:'press',selector:'input.new-todo',key:'Enter'},
    {op:'press',selector:'input.new-todo',key:'Control+L'},
    {op:'fill',selector:'input[type=password]',value:'token'},
    {op:'fill',selector:'#creditCard',value:'4111'},
    {op:'fill',selector:'input.new-todo',value:'x'.repeat(257)},
    {op:'click',selector:'button.submit'},
    {op:'upload',selector:'input.new-todo'},
    {op:'click',selector:'button',extra:1}
  ])refused(()=>planSiteControl({...defaults,actions:[action]},policy));
  refused(()=>planSiteControl({...defaults,actions:[]},policy));
  refused(()=>planSiteControl({...defaults,actions:Array(6).fill({op:'wait',selector:'body'})},policy));
  refused(()=>planSiteControl({...defaults,actions:[{op:'fill',selector:'input.new-todo',
    value:'\ud800'}]},policy));
  refused(()=>planSiteControl({mode:'read',url:'https://www.wikipedia.org/',actions:[]},policy));
  const safe=planSiteControl({...defaults,actions:[
    {op:'press',selector:'input.new-todo',key:'Tab'},
    {op:'wait',selector:'h1'}
  ]},policy);
  assert.deepEqual(safe.actions.map(x=>x.op),['press','wait']);
});
test('untrusted objects cannot execute getters or inherited fields during planning',()=>{
  let reads=0;
  const trick={url:'https://www.wikipedia.org/',mode:'read'};
  Object.defineProperty(trick,'actions',{enumerable:true,get(){reads++;throw Error('untrusted getter');}});
  refused(()=>planSiteControl(trick,policy));
  assert.equal(reads,0);
  refused(()=>planSiteControl(Object.assign(Object.create({mode:'read'}),{
    url:'https://www.wikipedia.org/'}),policy));
});

test('a granted site may draft a uniquely targeted same-origin anchor without wildcard or query',()=>{
  const p=JSON.stringify({version:1,sites:[{origin:'https://en.wikipedia.org',mode:'draft'}]});
  const plan=planSiteControl({mode:'draft',
    url:'https://en.wikipedia.org/wiki/Headless_browser',
    actions:[{op:'click',selector:'a[href="/wiki/Category:Web_browsers"]'}]},p);
  assert.deepEqual(plan.actions,[{op:'click',selector:'a[href="/wiki/Category:Web_browsers"]'}]);
  for(const selector of [
    'a[href="/wiki/Foo?secret=x"]',
    'a[href="/api/delete"]',
    'a[href="/wiki/../admin"]',
    'a[href="https://evil.example.com/"]'
  ]){
    refused(()=>planSiteControl({mode:'draft',
      url:'https://en.wikipedia.org/wiki/Headless_browser',
      actions:[{op:'click',selector}]},p));
  }
});
