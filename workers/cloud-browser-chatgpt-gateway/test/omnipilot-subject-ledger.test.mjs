import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createSubjectProposal,transitionSubjectGrant,verifySubjectAudit}
  from '../src/omnipilot-subject-ledger.mjs';
import {evaluateSubjectGrant} from '../src/omnipilot-subject-authority.mjs';

const NOW=1764000000000, SUBJECT='a'.repeat(64),OPERATOR='b'.repeat(64),
  ATTACKER='c'.repeat(64);
const iso=ms=>new Date(NOW+ms).toISOString();
const policy=JSON.stringify({version:2,sites:[{
  origin:'https://en.wikipedia.org',mode:'read',pathPrefix:'/wiki/',
  expiresAt:iso(4*3600000),maxActions:0
}]});
const candidate={origin:'https://en.wikipedia.org',mode:'read',
  pathPrefix:'/wiki/',expiresAt:iso(3600000),maxActions:0};
const request={mode:'read',url:'https://en.wikipedia.org/wiki/Browser_automation'};
let lastId=0;
function idFactory(){
  lastId++;
  return '00000000-0000-4000-8000-'+lastId.toString(16).padStart(12,'0');
}
const key=async()=>webcrypto.subtle.importKey('raw',new Uint8Array(32).fill(42),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
const propose=async(auditKey,extras={})=>createSubjectProposal({
  subjectKey:SUBJECT,requesterKey:SUBJECT,candidate,
  operatorPolicy:policy,nowMs:NOW,auditKey,idFactory,...extras
});
const approve=async(state,auditKey,extras={})=>transitionSubjectGrant({
  state,operation:'approve',actorKey:OPERATOR,operatorKey:OPERATOR,
  expectedRevision:state.record.revision,operatorPolicy:policy,
  nowMs:NOW+1000,auditKey,idFactory,...extras
});
const revoked=async(state,auditKey,extras={})=>transitionSubjectGrant({
  state,operation:'revoke',actorKey:SUBJECT,operatorKey:OPERATOR,
  expectedRevision:state.record.revision,operatorPolicy:policy,
  nowMs:NOW+2000,auditKey,idFactory,...extras
});

test('a subject may request a narrowly bounded grant; request never authorizes browsing',async()=>{
  const auditKey=await key(),state=await propose(auditKey);
  assert.equal(state.record.status,'PENDING');
  assert.equal(state.record.revision,1);
  assert.equal(state.record.approvedByKey,null);
  assert.equal(state.events.length,1);
  assert.equal(state.events[0].type,'REQUESTED');
  assert.equal(await verifySubjectAudit(state,auditKey),true);
  assert.equal(Object.isFrozen(state.record),true);
  assert.equal(Object.isFrozen(state.events),true);
  assert.equal(state.events[0].targetDigest.length,64);
  assert.equal(state.events[0].termsDigest.length,64);
  const journal=JSON.stringify(state.events);
  for(const secret of ['en.wikipedia.org','/wiki/','google-subject','email',
    'Bearer','password','Browser_automation'])assert.ok(!journal.includes(secret));
  assert.throws(()=>evaluateSubjectGrant({
    subjectKey:SUBJECT,oauthScopes:['mcp:read','mcp:site.read'],
    request,operatorPolicy:policy,record:state.record,nowMs:NOW
  }),{code:'SUBJECT_GRANT_DENIED'});
});
test('approval requires a separate trusted operator and a current revision',async()=>{
  const auditKey=await key(),state=await propose(auditKey);
  await assert.rejects(approve(state,auditKey,{actorKey:SUBJECT,operatorKey:SUBJECT}),
    {code:'INDEPENDENT_OPERATOR_REQUIRED'});
  await assert.rejects(approve(state,auditKey,{actorKey:ATTACKER}),
    {code:'INDEPENDENT_OPERATOR_REQUIRED'});
  await assert.rejects(approve(state,auditKey,{expectedRevision:0}),
    {code:'STALE_GRANT_REVISION'});
  const active=await approve(state,auditKey);
  assert.equal(active.record.status,'ACTIVE');
  assert.equal(active.record.revision,2);
  assert.equal(active.record.approvedByKey,OPERATOR);
  assert.equal(active.events[1].type,'APPROVED');
  assert.equal(await verifySubjectAudit(active,auditKey),true);
  assert.equal(evaluateSubjectGrant({
    subjectKey:SUBJECT,oauthScopes:['mcp:read','mcp:site.read'],
    request,operatorPolicy:policy,record:active.record,nowMs:NOW+1500
  }).allowed,true);
  await assert.rejects(approve(active,auditKey));
});
test('the subject can revoke an active grant; retries are idempotent',async()=>{
  const auditKey=await key(),pending=await propose(auditKey);
  const active=await approve(pending,auditKey);
  const stopped=await revoked(active,auditKey);
  assert.equal(stopped.record.status,'REVOKED');
  assert.equal(stopped.record.revision,3);
  assert.equal(stopped.events.at(-1).type,'REVOKED');
  assert.equal(await verifySubjectAudit(stopped,auditKey),true);
  const retry=await revoked(stopped,auditKey,{expectedRevision:2});
  assert.strictEqual(retry,stopped);
  assert.equal(retry.events.length,3);
  assert.throws(()=>evaluateSubjectGrant({
    subjectKey:SUBJECT,oauthScopes:['mcp:read','mcp:site.read'],
    request,operatorPolicy:policy,record:stopped.record,nowMs:NOW+3000
  }),{code:'SUBJECT_GRANT_DENIED'});
  await assert.rejects(revoked(stopped,auditKey,{actorKey:ATTACKER}),
    {code:'GRANT_REVOKER_UNAUTHORIZED'});
});
test('operators may revoke pending grants and deny before approval',async()=>{
  const auditKey=await key(),pending=await propose(auditKey);
  const canceled=await transitionSubjectGrant({
    state:pending,operation:'revoke',actorKey:OPERATOR,operatorKey:OPERATOR,
    expectedRevision:1,operatorPolicy:policy,nowMs:NOW+1000,auditKey,idFactory});
  assert.equal(canceled.record.status,'REVOKED');
  assert.equal(await verifySubjectAudit(canceled,auditKey),true);
  await assert.rejects(approve(canceled,auditKey));
  const denied=await transitionSubjectGrant({
    state:pending,operation:'deny',actorKey:OPERATOR,operatorKey:OPERATOR,
    expectedRevision:1,operatorPolicy:policy,nowMs:NOW+1000,auditKey,idFactory});
  assert.equal(denied.record.status,'DENIED');
  assert.equal(denied.record.approvedByKey,null);
  assert.equal(await verifySubjectAudit(denied,auditKey),true);
  await assert.rejects(revoked(denied,auditKey));
});
test('expired proposals or revoked operator policy cannot be approved',async()=>{
  const auditKey=await key(),pending=await propose(auditKey);
  await assert.rejects(approve(pending,auditKey,{nowMs:NOW+3600001}),
    {code:'GRANT_EXPIRED'});
  const weakened=JSON.stringify({version:2,sites:[{
    origin:'https://en.wikipedia.org',mode:'read',
    pathPrefix:'/wiki/Restricted/',expiresAt:iso(3600000),maxActions:0
  }]});
  await assert.rejects(approve(pending,auditKey,{operatorPolicy:weakened}));
  await assert.rejects(propose(auditKey,{requesterKey:ATTACKER}));
  await assert.rejects(propose(auditKey,{
    candidate:{...candidate,origin:'https://fin-kac.pages.dev'}
  }));
});
test('HMAC-linked audit rejects modified scope, actor, event or removed history',async()=>{
  const auditKey=await key(),pending=await propose(auditKey);
  const active=await approve(pending,auditKey);
  const corrupt=[
    {...active,record:{...active.record,maxActions:3}},
    {...active,record:{...active.record,expiresAtMs:NOW+7200000}},
    {...active,record:{...active.record,requestedByKey:ATTACKER}},
    {...active,record:{...active.record,approvedByKey:ATTACKER}},
    {...active,record:{...active.record,auditHead:'0'.repeat(64)}},
    {...active,events:[active.events[1]]},
    {...active,events:[{...active.events[0],actorKey:ATTACKER},active.events[1]]},
    {...active,events:[active.events[0],{...active.events[1],type:'REVOKED'}]},
    {...active,events:[active.events[0],{...active.events[1],previousHash:'0'.repeat(64)}]},
    {...active,events:[active.events[0],{...active.events[1],termsDigest:'0'.repeat(64)}]}
  ];
  for(const entry of corrupt)assert.equal(await verifySubjectAudit(entry,auditKey),false);
  await assert.rejects(approve({...active,record:{...active.record,mode:'draft'}},auditKey),
    {code:'GRANT_TRANSITION_DENIED'});
});
test('audit key loss and stale clock fail closed without partial transitions',async()=>{
  const auditKey=await key();
  await assert.rejects(propose(null),{code:'AUDIT_KEY_UNAVAILABLE'});
  const pending=await propose(auditKey);
  await assert.rejects(approve(pending,auditKey,{auditKey:null}),
    {code:'GRANT_TRANSITION_DENIED'});
  await assert.rejects(approve(pending,auditKey,{nowMs:NOW-1}),
    {code:'GRANT_TRANSITION_DENIED'});
  assert.equal(pending.record.status,'PENDING');
  assert.equal(pending.events.length,1);
});
