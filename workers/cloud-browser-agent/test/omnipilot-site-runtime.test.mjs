import test from 'node:test';
import assert from 'node:assert/strict';
import {createSiteControlScript,executeSiteControl} from '../src/omnipilot-site-runtime.mjs';
const grants=JSON.stringify({version:1,sites:[
  {origin:'https://www.wikipedia.org',mode:'read'},
  {origin:'https://demo.playwright.dev',mode:'draft'}]});
const read=()=>({mode:'read',url:'https://www.wikipedia.org/'});
const draft=()=>({mode:'draft',url:'https://demo.playwright.dev/todomvc/',
  actions:[{op:'fill',selector:'input.new-todo',value:'safe staged draft'},
    {op:'click',selector:'input.toggle'}]});
const jpeg=Buffer.from([255,216,255,...Array(90).fill(1),255,217]).toString('base64');
const payload=(mode='read',url='https://www.wikipedia.org/')=>({success:true,
  result:{ok:true,origin:new URL(url).origin,url,title:'Demo',mode,headings:['Heading'],
    actionCount:mode==='read'?0:2,submitted:false,persisted:false,
    screenshotMime:'image/jpeg',screenshotBase64:jpeg}});
const browser=(response=payload())=>{
  const events={acquire:[],script:[],close:[]};
  return {events,
    async acquire(opts){events.acquire.push(opts);return {sessionId:'site-session-test-12345'};},
    async script(code,opts){events.script.push({code,opts});
      return new Response(JSON.stringify(response),{status:200});},
    async closeSession(id){events.close.push(id);return {status:'closed'};}
  };
};
test('read-only script is self-contained with strict GET, exact-origin and popup guards',()=>{
  const script=createSiteControlScript(read(),grants);
  assert.doesNotMatch(script,/allowedDomains/); // host guard enforced at acquire, not script.
  assert.match(script,/context\.route/);
  assert.match(script,/req\.method\(\)/);
  assert.match(script,/u\.origin!==origin/);
  assert.match(script,/page\.screenshot/);
  assert.match(script,/quality:12/);
  assert.match(script,/quality:7/);
  assert.match(script,/pixels\.length>36000/);
  assert.match(script,/SITE_REDIRECT_REFUSED/);
  assert.match(script,/current\.hash='';/); // SPA fragments are normalized, not treated as cross-origin.
  assert.match(script,/submitted:false,persisted:false/);
  const callable=Function('return ('+script+')')();
  assert.equal(typeof callable,'function');
  assert.ok(script.includes('"hostname":"www.wikipedia.org"'));
  assert.ok(!script.includes('http://localhost'));
});
test('draft source prevents form submit, sensitive input and off-site clicks',()=>{
  const script=createSiteControlScript(draft(),grants);
  assert.match(script,/SITE_SENSITIVE_ELEMENT/);
  assert.match(script,/SITE_CLICK_NOT_APPROVED/);
  assert.match(script,/SITE_FILL_NOT_APPROVED/);
  assert.match(script,/checked\.insideForm/);
  assert.match(script,/navigationAllowed\(destination\)/);
  assert.match(script,/SITE_ORIGIN_CHANGED/);
  assert.doesNotMatch(script,/eval\s*\(|new Function/);
  assert.equal(typeof Function('return ('+script+')')(),'function');
});
test('owned read-only session acquires exact hostname, executes once and closes',async()=>{
  const b=browser();
  const r=await executeSiteControl(b,read(),grants);
  assert.equal(r.ok,true);
  assert.equal(r.origin,'https://www.wikipedia.org');
  assert.equal(r.submitted,false);
  assert.equal(r.persisted,false);
  assert.equal(r.screenshotBase64,jpeg);
  assert.deepEqual(b.events.acquire,[{guardrails:{allowedDomains:['www.wikipedia.org']},keepAlive:10000}]);
  assert.deepEqual(b.events.script[0].opts,
    {sessionId:'site-session-test-12345',library:'playwright',timeout:45000});
  assert.deepEqual(b.events.close,['site-session-test-12345']);
});
test('draft session can run only with its own site permission',async()=>{
  const b=browser(payload('draft','https://demo.playwright.dev/todomvc/'));
  const r=await executeSiteControl(b,draft(),grants);
  assert.equal(r.ok,true);
  assert.equal(r.mode,'draft');
  assert.equal(r.actionCount,2);
  assert.deepEqual(b.events.acquire[0].guardrails.allowedDomains,['demo.playwright.dev']);
  assert.equal(b.events.script.length,1);
  assert.deepEqual(b.events.close,['site-session-test-12345']);
});
test('unapproved or malformed requests cannot acquire a browser session',async()=>{
  const b=browser();
  await assert.rejects(executeSiteControl(b,{mode:'read',url:'https://fin-kac.pages.dev/'},grants),
    {code:'SITE_GRANT_REFUSED'});
  await assert.rejects(executeSiteControl(b,{mode:'draft',url:'https://www.wikipedia.org/',actions:[
    {op:'click',selector:'a'}]},grants),{code:'SITE_GRANT_REFUSED'});
  await assert.rejects(executeSiteControl(b,read(),''),{code:'SITE_GRANT_REFUSED'});
  assert.equal(b.events.acquire.length,0);
  assert.equal(b.events.script.length,0);
  assert.equal(b.events.close.length,0);
});
test('failed, forged or uncertain browser results never auto-retry',async()=>{
  for(const result of [{success:false},payload('draft'),{
    success:true,result:{...payload().result,origin:'https://evil.example.com'}},{
    success:true,result:{...payload().result,submitted:true}},{
    success:true,result:{...payload().result,screenshotBase64:'not-jpeg'}},{
    success:true,result:{...payload().result,url:'https://www.wikipedia.org/?leak=yes'}}]){
    const b=browser(result),r=await executeSiteControl(b,read(),grants);
    assert.equal(r.ok,false);
    assert.equal(r.retrySafe,false);
    assert.equal(r.outcomeUnknown,true);
    assert.equal(b.events.script.length,1);
    assert.equal(b.events.close.length,1);
  }
});
test('session receipts and cleanup are mandatory, not best effort',async()=>{
  const missing=browser();
  missing.acquire=async()=>({sessionId:null});
  const r=await executeSiteControl(missing,read(),grants);
  assert.equal(r.code,'SITE_SESSION_UNTRACKED');
  assert.equal(missing.events.script.length,0);
  const cleanup=browser();
  cleanup.closeSession=async()=>{throw Error('unknown closure');};
  const after=await executeSiteControl(cleanup,read(),grants);
  assert.equal(after.code,'SITE_CLEANUP_UNVERIFIED');
  assert.equal(after.retrySafe,false);
  const crashed=browser();
  crashed.script=async()=>{throw Error('sensitive details not logged');};
  const failed=await executeSiteControl(crashed,read(),grants);
  assert.equal(failed.code,'SITE_EXECUTION_UNCERTAIN');
  assert.equal(failed.retrySafe,false);
  assert.equal(crashed.events.close.length,1);
});
