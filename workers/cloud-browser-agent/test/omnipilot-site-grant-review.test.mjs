import test from 'node:test';
import assert from 'node:assert/strict';
import {previewAdditionalSiteGrant} from '../src/omnipilot-site-grant-review.mjs';
import {planSiteControl} from '../src/omnipilot-site-grants.mjs';
const NOW=1764000000000;
const empty='{"version":2,"sites":[]}';
const read={origin:'https://en.wikipedia.org',mode:'read',
  pathPrefix:'/wiki/',ttlMinutes:60,maxActions:0};
const draft={origin:'https://demo.playwright.dev',mode:'draft',
  pathPrefix:'/todomvc/',ttlMinutes:20,maxActions:2};
const denied=(fn,code='SITE_GRANT_REVIEW_INVALID')=>assert.throws(fn,{code});

test('operator can preview a narrow, expiring read grant but cannot apply it',()=>{
  const req={...read},preview=previewAdditionalSiteGrant(empty,req,NOW);
  assert.equal(preview.applied,false);
  assert.equal(preview.requiresOperatorReview,true);
  assert.equal(preview.candidateOrigin,read.origin);
  assert.equal(preview.mode,'read');
  assert.equal(preview.pathPrefix,'/wiki/');
  assert.equal(preview.maxActions,0);
  assert.equal(preview.count,1);
  assert.equal(preview.expiresAt,new Date(NOW+60*60000).toISOString());
  assert.deepEqual(JSON.parse(preview.proposedPolicyJson).sites.map(x=>x.origin),
    [read.origin]);
  assert.deepEqual(req,read); // No changes to caller-owned values.
  assert.equal(planSiteControl({mode:'read',url:'https://en.wikipedia.org/wiki/Main_Page'},
    preview.proposedPolicyJson,NOW).mode,'read');
});
test('an additional site must be separately reviewed and has a short draft budget',()=>{
  const first=previewAdditionalSiteGrant(empty,read,NOW);
  const second=previewAdditionalSiteGrant(first.proposedPolicyJson,draft,NOW);
  assert.deepEqual(JSON.parse(second.proposedPolicyJson).sites.map(x=>x.origin),
    [read.origin,draft.origin]);
  assert.equal(second.applied,false);
  assert.equal(second.count,2);
  assert.equal(second.maxActions,2);
  const request={mode:'draft',url:'https://demo.playwright.dev/todomvc/',
    actions:[{op:'fill',selector:'input.new-todo',value:'safe'}]};
  assert.equal(planSiteControl(request,second.proposedPolicyJson,NOW).actions.length,1);
  denied(()=>previewAdditionalSiteGrant(second.proposedPolicyJson,draft,NOW));
});
test('legacy indefinite v1 is never silently migrated into new grants',()=>{
  const current=JSON.stringify({version:1,sites:[{origin:read.origin,mode:'read'}]});
  denied(()=>previewAdditionalSiteGrant(current,draft,NOW),
    'SITE_GRANT_MIGRATION_REVIEW_REQUIRED');
});
test('reject Finance and production sites, wildcard, private-IP and action paths',()=>{
  for(const origin of ['https://fin-kac.pages.dev','https://trading-roi-studio.pages.dev',
    'https://hub.immamarketing.com','https://www.glam-lingerie.com',
    'https://cloud-browser-agent-stage.dorjan-gjoni-dg.workers.dev',
    'https://127.0.0.1','https://foo.nip.io','https://*.example.com']){
    denied(()=>previewAdditionalSiteGrant(empty,{...read,origin},NOW));
  }
  for(const pathPrefix of ['/api/','/wiki/../','/%2e%2e/','/wiki?x=1','//']){
    denied(()=>previewAdditionalSiteGrant(empty,{...read,pathPrefix},NOW));
  }
});
test('read and draft scopes cannot use long-lived, unlimited or malformed budgets',()=>{
  const cases=[
    {...read,ttlMinutes:43201},
    {...read,ttlMinutes:0},
    {...read,maxActions:1},
    {...draft,ttlMinutes:1441},
    {...draft,maxActions:0},
    {...draft,maxActions:4},
    {...draft,secret:'injected'},
    {...read,origin:'http://en.wikipedia.org'}
  ];
  for(const request of cases)denied(()=>previewAdditionalSiteGrant(empty,request,NOW));
  denied(()=>previewAdditionalSiteGrant('not-json',read,NOW));
  denied(()=>previewAdditionalSiteGrant('{}',read,NOW));
  denied(()=>previewAdditionalSiteGrant(empty,read,-1));
});
test('expired and malformed existing site grants block all further proposals',()=>{
  const expired=JSON.stringify({version:2,sites:[{
    origin:'https://en.wikipedia.org',mode:'read',pathPrefix:'/wiki/',
    expiresAt:new Date(NOW-1000).toISOString(),maxActions:0
  }]});
  denied(()=>previewAdditionalSiteGrant(expired,draft,NOW));
  const unknown=JSON.stringify({version:2,sites:[{...read,expiresAt:new Date(NOW+3600000).toISOString()}]});
  denied(()=>previewAdditionalSiteGrant(unknown,draft,NOW));
});
