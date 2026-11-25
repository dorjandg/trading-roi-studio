import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {trustedGooglePrincipalFromOAuthProps,deriveSubjectKey,
  constrainSubjectGrant,evaluateSubjectGrant,evaluateFreshSubjectGrant}
  from '../src/omnipilot-subject-authority.mjs';
const NOW=1764000000000;
const iso=x=>new Date(NOW+x).toISOString();
const raw=JSON.stringify({version:2,sites:[
  {origin:'https://en.wikipedia.org',mode:'read',pathPrefix:'/wiki/',
    expiresAt:iso(4*3600000),maxActions:0},
  {origin:'https://demo.playwright.dev',mode:'draft',pathPrefix:'/todomvc/',
    expiresAt:iso(3600000),maxActions:3}
]});
const candidate=(overrides={})=>({
  origin:'https://en.wikipedia.org',mode:'read',pathPrefix:'/wiki/',
  expiresAt:iso(3600000),maxActions:0,...overrides
});
const request=(mode='read')=>mode==='read'?
  {mode:'read',url:'https://en.wikipedia.org/wiki/Browser_automation'}:
  {mode:'draft',url:'https://demo.playwright.dev/todomvc/',actions:[
    {op:'fill',selector:'input.new-todo',value:'isolated draft'}
  ]};
const A='a'.repeat(64),B='b'.repeat(64);
const grant=(overrides={})=>({
  grantId:'00000000-0000-4000-8000-000000000001',
  subjectKey:A,mode:'read',origin:'https://en.wikipedia.org',
  pathPrefix:'/wiki/',expiresAtMs:NOW+3600000,
  maxActions:0,revision:2,auditHead:'f'.repeat(64),status:'ACTIVE',...overrides
});
const scopes=['mcp:read','mcp:site.read'];
const deny=fn=>assert.throws(fn,e=>typeof e?.code==='string');
test('identity binding uses only the verified Google sub and a server-side HMAC key',async()=>{
  const key=await webcrypto.subtle.importKey('raw',new Uint8Array(32).fill(7),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const principal=trustedGooglePrincipalFromOAuthProps({
    userId:'google-subject-123456',email:'private@example.org',extra:'ignored'});
  assert.deepEqual(principal,{issuer:'https://accounts.google.com',
    subject:'google-subject-123456'});
  const fingerprint=await deriveSubjectKey(principal,key);
  assert.match(fingerprint,/^[0-9a-f]{64}$/);
  assert.equal(fingerprint,await deriveSubjectKey(principal,key));
  assert.notEqual(fingerprint,await deriveSubjectKey({
    ...principal,subject:'google-subject-123457'},key));
  assert.notEqual(fingerprint,await deriveSubjectKey(principal,
    await webcrypto.subtle.importKey('raw',new Uint8Array(32).fill(8),
      {name:'HMAC',hash:'SHA-256'},false,['sign'])));
  assert.ok(!fingerprint.includes('google-subject'));
  deny(()=>trustedGooglePrincipalFromOAuthProps({email:'private@example.org'}));
  deny(()=>trustedGooglePrincipalFromOAuthProps({userId:'a'}));
  await assert.rejects(deriveSubjectKey({issuer:'https://evil.example.org',
    subject:'google-subject-123456'},key));
  await assert.rejects(deriveSubjectKey(principal,null));
});
test('per-subject grant must be narrower than current operator v2 site policy',()=>{
  const result=constrainSubjectGrant(candidate(),raw,NOW);
  assert.equal(result.mode,'read');
  assert.equal(result.pathPrefix,'/wiki/');
  assert.equal(result.expiresAtMs,NOW+3600000);
  assert.equal(Object.isFrozen(result),true);
  for(const change of [
    {origin:'https://finance-mcp-gateway-stage.dorjan-gjoni-dg.workers.dev'},
    {origin:'https://fin-kac.pages.dev'},
    {origin:'https://evil.example.org'},
    {pathPrefix:'/'},{pathPrefix:'/wiki-other/'},
    {expiresAt:iso(5*3600000)},
    {mode:'draft',maxActions:1},
    {maxActions:1}
  ])deny(()=>constrainSubjectGrant(candidate(change),raw,NOW));
  deny(()=>constrainSubjectGrant(candidate(),
    '{"version":1,"sites":[{"origin":"https://en.wikipedia.org","mode":"read"}]}',NOW));
});
test('verified OAuth scope plus exact subject and ACTIVE grant authorizes read',()=>{
  const response=evaluateSubjectGrant({subjectKey:A,oauthScopes:scopes,request:request(),
    operatorPolicy:raw,record:grant(),nowMs:NOW});
  assert.equal(response.allowed,true);
  assert.equal(response.grantRevision,2);
  assert.equal(response.actionCount,0);
  assert.equal(response.approvalState,'ACTIVE');
  assert.equal(response.persisted,false);
  assert.equal(Object.isFrozen(response),true);
  assert.equal(response.subjectKey,undefined); // Never return pseudonymous identity to MCP callers.
});
test('other users, wrong scopes, drafts, expired or revoked grants fail closed',()=>{
  const base={subjectKey:A,oauthScopes:scopes,request:request(),
    operatorPolicy:raw,record:grant(),nowMs:NOW};
  for(const patch of [
    {subjectKey:B},{oauthScopes:['mcp:read']},
    {oauthScopes:[]},{record:grant({status:'REVOKED'})},
    {record:grant({status:'PENDING'})},
    {record:grant({expiresAtMs:NOW})},
    {record:grant({subjectKey:B})},
    {record:grant({revision:1})},
    {record:grant({pathPrefix:'/wiki/Article/'})},
    {record:grant({auditHead:'unverified'})},
    {request:{mode:'read',url:'https://en.wikipedia.org/'}},
    {request:{mode:'read',url:'https://en.wikipedia.org/wiki-other/'}},
    {request:{mode:'read',url:'https://en.wikipedia.org/wiki/Browser_automation?x=1'}}
  ])deny(()=>evaluateSubjectGrant({...base,...patch}));
  const draftBase={...base,request:request('draft'),
    oauthScopes:['mcp:read','mcp:site.read','mcp:site.interact'],
    record:grant({origin:'https://demo.playwright.dev',mode:'draft',
      pathPrefix:'/todomvc/',expiresAtMs:NOW+1800000,maxActions:1})};
  assert.equal(evaluateSubjectGrant(draftBase).allowed,true);
  deny(()=>evaluateSubjectGrant({...draftBase,oauthScopes:scopes}));
  deny(()=>evaluateSubjectGrant({...draftBase,record:grant({
    ...draftBase.record,maxActions:0})}));
  deny(()=>evaluateSubjectGrant({...draftBase,request:{...request('draft'),
    actions:[...request('draft').actions,...request('draft').actions]}}));
});
test('fresh access decision performs an authoritative load for every request',async()=>{
  let state=grant(),calls=0;
  const args={subjectKey:A,oauthScopes:scopes,request:request(),
    operatorPolicy:raw,nowMs:NOW,
    async loadLatest({subjectKey,origin}){
      calls++;
      assert.equal(subjectKey,A);assert.equal(origin,'https://en.wikipedia.org');
      return state;
    }
  };
  assert.equal((await evaluateFreshSubjectGrant(args)).allowed,true);
  state=grant({status:'REVOKED',revision:3});
  await assert.rejects(evaluateFreshSubjectGrant(args));
  assert.equal(calls,2);
  await assert.rejects(evaluateFreshSubjectGrant({...args,loadLatest:null}));
  await assert.rejects(evaluateFreshSubjectGrant({...args,
    loadLatest:async()=>{throw Error('private database details');}}),
    {code:'SUBJECT_GRANT_STORAGE_UNAVAILABLE'});
});
test('URL inputs and grant records cannot substitute for trusted subject identity',()=>{
  const base={subjectKey:A,oauthScopes:scopes,request:request(),
    operatorPolicy:raw,record:grant(),nowMs:NOW};
  deny(()=>evaluateSubjectGrant({...base,request:{...request(),subjectKey:A}}));
  deny(()=>evaluateSubjectGrant({...base,request:{...request(),isOperator:true}}));
  deny(()=>evaluateSubjectGrant({...base,subjectKey:'google-subject-123456'}));
  deny(()=>evaluateSubjectGrant({...base,record:grant({mode:'draft',
    origin:'https://example.org'})}));
});
