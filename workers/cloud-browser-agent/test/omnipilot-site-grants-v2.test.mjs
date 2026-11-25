import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSiteGrants,planSiteControl} from '../src/omnipilot-site-grants.mjs';
import {createSiteControlScript,executeSiteControl} from '../src/omnipilot-site-runtime.mjs';

const NOW=1764000000000;
const iso=delta=>new Date(NOW+delta).toISOString();
const raw=(site)=>JSON.stringify({version:2,sites:[site]});
const read=(overrides={})=>({origin:'https://en.wikipedia.org',mode:'read',
  pathPrefix:'/wiki/',expiresAt:iso(86400000),maxActions:0,...overrides});
const draft=(overrides={})=>({origin:'https://demo.playwright.dev',mode:'draft',
  pathPrefix:'/todomvc/',expiresAt:iso(3600000),maxActions:2,...overrides});
const input=(mode='read')=>mode==='read'?
  {mode:'read',url:'https://en.wikipedia.org/wiki/Browser_automation'}:
  {mode:'draft',url:'https://demo.playwright.dev/todomvc/',actions:[
    {op:'fill',selector:'input.new-todo',value:'short lived approval'},
    {op:'press',selector:'input.new-todo',key:'Tab'}]};
const denied=fn=>assert.throws(fn,{code:'SITE_GRANT_REFUSED'});

test('legacy version-1 grants still parse with exactly the old capabilities',()=>{
  const previous=JSON.stringify({version:1,sites:[
    {origin:'https://demo.playwright.dev',mode:'draft'}]});
  const plan=planSiteControl(input('draft'),previous,NOW);
  assert.equal(plan.mode,'draft');
  assert.equal(plan.actions.length,2);
  assert.equal(plan.pathPrefix,undefined);
  assert.equal(plan.expiresAtMs,undefined);
  assert.equal(plan.maxActions,undefined);
  assert.deepEqual(parseSiteGrants(previous,NOW).map(v=>Object.keys(v)),
    [['origin','hostname','mode']]);
});

test('v2 grants require exact origin, path prefix, expiry and finite action budget',()=>{
  const policy=raw(read());
  const list=parseSiteGrants(policy,NOW);
  assert.deepEqual(list.map(x=>x.pathPrefix),['/wiki/']);
  assert.deepEqual(list.map(x=>x.maxActions),[0]);
  assert.equal(Object.isFrozen(list[0]),true);
  const plan=planSiteControl(input(),policy,NOW);
  assert.equal(plan.pathPrefix,'/wiki/');
  assert.equal(plan.expiresAtMs,Date.parse(iso(86400000)));
  assert.equal(plan.actions.length,0);
  denied(()=>planSiteControl({mode:'read',url:'https://en.wikipedia.org/'},policy,NOW));
  denied(()=>planSiteControl({mode:'read',url:'https://en.wikipedia.org/wiki-other/'},policy,NOW));
  denied(()=>planSiteControl({mode:'draft',url:input().url,actions:[{op:'wait',selector:'h1'}]},policy,NOW));
});

test('expiry is fail-closed and capped at 30 days for read, 24 hours for draft',()=>{
  for(const delta of [0,-1,31*86400000]){
    denied(()=>parseSiteGrants(raw(read({expiresAt:iso(delta)})),NOW));
  }
  denied(()=>parseSiteGrants(raw(draft({expiresAt:iso(86400001)})),NOW));
  const policy=raw(draft());
  assert.equal(planSiteControl(input('draft'),policy,NOW).mode,'draft');
  denied(()=>planSiteControl(input('draft'),policy,NOW+3600001));
  denied(()=>parseSiteGrants(policy,NaN));
  denied(()=>parseSiteGrants(policy,-10));
});

test('rejects stale, noncanonical or incomplete operator grants and dangerous paths',()=>{
  const examples=[
    {pathPrefix:'/wiki'}, {pathPrefix:'/wiki//'},
    {pathPrefix:'/wiki/../admin/'},{pathPrefix:'/%2e%2e/'},
    {pathPrefix:'//'}, {pathPrefix:'/wiki/?q=x'},
    {pathPrefix:'/wiki/#hash'}, {pathPrefix:'/wiki/;'},
    {pathPrefix:'/wiki/å/'}, {expiresAt:'2030-01-01'},
    {expiresAt:'2026-01-01T00:00:00Z'},
    {maxActions:1}, {maxActions:-1}, {maxActions:4}
  ];
  for(const invalid of examples)denied(()=>parseSiteGrants(raw(read(invalid)),NOW));
  for(const invalid of [
    {maxActions:0},{maxActions:4},{expiresAt:iso(90000000)},
    {pathPrefix:'/settings'},{pathPrefix:'/*/'}
  ])denied(()=>parseSiteGrants(raw(draft(invalid)),NOW));
  denied(()=>parseSiteGrants(JSON.stringify({version:2,sites:[
    {...read(),allowRedirects:true}]}),NOW));
  denied(()=>parseSiteGrants(JSON.stringify({version:2,sites:[
    read(),read({mode:'draft',maxActions:1})]}),NOW));
});

test('v2 draft action budget is an additional restriction, not a relaxation',()=>{
  const policy=raw(draft({maxActions:1}));
  denied(()=>planSiteControl(input('draft'),policy,NOW));
  const short={...input('draft'),actions:[{op:'fill',selector:'input.new-todo',value:'ok'}]};
  assert.equal(planSiteControl(short,policy,NOW).actions.length,1);
  const readGrant=raw(read());
  denied(()=>planSiteControl({mode:'draft',url:input().url,
    actions:[{op:'fill',selector:'input.new-todo',value:'not allowed'}]},readGrant,NOW));
});

test('the serialized browser script enforces boundaries on redirects, clicks and fetch navigation',()=>{
  const policy=raw(read({expiresAt:new Date(Date.now()+3600000).toISOString()}));
  const script=createSiteControlScript(input(),policy);
  assert.match(script,/plan\.pathPrefix/);
  assert.match(script,/u\.pathname\.startsWith\(plan\.pathPrefix\)/);
  assert.match(script,/req\.isNavigationRequest\(\)/);
  assert.match(script,/SITE_GRANT_EXPIRED/);
  assert.match(script,/SITE_NAVIGATION_REFUSED/);
  assert.match(script,/context\.route/);
  assert.equal(typeof Function('return ('+script+')')(),'function');
});

test('v2 runtime acquires only approved hostname and closes after returned screenshot',async()=>{
  const source={mode:'read',url:'https://en.wikipedia.org/wiki/Browser_automation'};
  const policy=raw(read({expiresAt:new Date(Date.now()+3600000).toISOString()}));
  const image=Buffer.from([255,216,255,...Array(90).fill(0),255,217]).toString('base64');
  let acquisitions=0,closed=0;
  const binding={
    async acquire(opts){
      acquisitions++;
      assert.deepEqual(opts.guardrails.allowedDomains,['en.wikipedia.org']);
      return {sessionId:'site-session-v2-test-12345'};
    },
    async script(code,opts){
      assert.match(code,/pathPrefix/);
      assert.equal(opts.sessionId,'site-session-v2-test-12345');
      return Response.json({success:true,result:{ok:true,url:source.url,
        origin:'https://en.wikipedia.org',title:'Browser automation',
        mode:'read',headings:['Browser automation'],actionCount:0,
        submitted:false,persisted:false,screenshotMime:'image/jpeg',
        screenshotBase64:image}});
    },
    async closeSession(){closed++;return {status:'closed'};}
  };
  const result=await executeSiteControl(binding,source,policy);
  assert.equal(result.ok,true);
  assert.equal(result.mode,'read');
  assert.equal(closed,1);
  assert.equal(acquisitions,1);
});
