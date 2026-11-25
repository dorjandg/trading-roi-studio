import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createSubjectProposal,transitionSubjectGrant} from '../src/omnipilot-subject-ledger.mjs';
import {loadFreshActiveSubjectGrant,readVerifiedGrantById,
  insertPendingSubjectGrant,commitSubjectGrantTransition}
  from '../src/omnipilot-subject-store.mjs';

const NOW=1764000000000,SUBJECT='a'.repeat(64),OPERATOR='b'.repeat(64);
const candidate={origin:'https://en.wikipedia.org',mode:'read',pathPrefix:'/wiki/',
  expiresAt:new Date(NOW+3600000).toISOString(),maxActions:0};
const operatorPolicy=JSON.stringify({version:2,sites:[{
  ...candidate,expiresAt:new Date(NOW+7200000).toISOString()}]});
const key=()=>webcrypto.subtle.importKey('raw',new Uint8Array(32).fill(42),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
let counter=0;
const idFactory=()=>('00000000-0000-4000-8000-'+(++counter).toString(16).padStart(12,'0'));
const makePending=auditKey=>createSubjectProposal({
  subjectKey:SUBJECT,requesterKey:SUBJECT,candidate,operatorPolicy,
  nowMs:NOW,auditKey,idFactory
});
const approve=(state,auditKey)=>transitionSubjectGrant({
  state,operation:'approve',actorKey:OPERATOR,operatorKey:OPERATOR,
  expectedRevision:1,operatorPolicy,nowMs:NOW+1000,auditKey,idFactory});
const revoke=(state,auditKey)=>transitionSubjectGrant({
  state,operation:'revoke',actorKey:SUBJECT,operatorKey:OPERATOR,
  expectedRevision:2,operatorPolicy,nowMs:NOW+2000,auditKey,idFactory});

const grantToRow=r=>({
  grant_id:r.grantId,subject_key:r.subjectKey,requested_by_key:r.requestedByKey,
  approved_by_key:r.approvedByKey,origin:r.origin,path_prefix:r.pathPrefix,
  mode:r.mode,expires_at_ms:r.expiresAtMs,max_actions:r.maxActions,
  status:r.status,revision:r.revision,created_at_ms:r.createdAtMs,
  updated_at_ms:r.updatedAtMs,audit_head:r.auditHead
});
const eventToRow=e=>({
  event_id:e.eventId,grant_id:e.grantId,revision:e.revision,
  event_type:e.type,actor_key:e.actorKey,subject_key:e.subjectKey,
  target_digest:e.targetDigest,terms_digest:e.termsDigest,
  previous_hash:e.previousHash,event_hash:e.hash,occurred_at_ms:e.occurredAtMs
});
function fakeD1(initial=null){
  let state=initial,next=null;
  const operations=[],sessions=[];
  const table={get state(){return state;},set next(s){next=s;},operations,sessions};
  function statement(sql){
    return {
      bind(...args){
        operations.push({sql,args});
        return {
          async first(){
            if(sql.startsWith('SELECT grant_id FROM')){
              const [subjectKey,origin]=args;
              return state?.record.status==='ACTIVE'&&state.record.subjectKey===subjectKey
                &&state.record.origin===origin?{grant_id:state.record.grantId}:null;
            }
            if(sql.startsWith('SELECT grant_id,subject_key')){
              return state?.record.grantId===args[0]?grantToRow(state.record):null;
            }
            if(sql.startsWith('UPDATE omnipilot_subject_grants')){
              if(!state||!next||state.record.grantId!==args[11]||
                 state.record.subjectKey!==args[12]||
                 state.record.revision!==args[13]||
                 state.record.auditHead!==args[14]||
                 state.record.status!==args[15])return null;
              state=next;next=null;
              return {revision:state.record.revision};
            }
            throw Error('UNEXPECTED_SQL_FIRST');
          },
          async all(){
            if(!sql.startsWith('SELECT event_id,grant_id'))throw Error('UNEXPECTED_SQL_ALL');
            return {results:state?.record.grantId===args[0]?
              state.events.map(eventToRow):[]};
          },
          async run(){
            if(!sql.startsWith('INSERT INTO omnipilot_subject_grants'))
              throw Error('UNEXPECTED_SQL_RUN');
            if(state||!next)throw Error('DUPLICATE_OR_MISSING_PROPOSAL');
            state=next;next=null;return {success:true};
          }
        };
      }
    };
  }
  table.prepare=statement;
  table.withSession=(mode)=>{
    sessions.push(mode);
    if(mode!=='first-primary')throw Error('STALE_REPLICA_NOT_ALLOWED');
    return {prepare:statement};
  };
  return table;
}
test('new proposals use parameterized D1 insert and verify append-only audit after write',async()=>{
  const auditKey=await key(),pending=await makePending(auditKey);
  const db=fakeD1();db.next=pending;
  const saved=await insertPendingSubjectGrant(db,pending,auditKey);
  assert.equal(saved.recorded,true);
  assert.equal(saved.status,'PENDING');
  assert.equal(db.state.record.grantId,pending.record.grantId);
  assert.deepEqual(db.sessions,['first-primary']);
  const insert=db.operations.find(x=>x.sql.startsWith('INSERT INTO'));
  assert.equal(insert.args[0],pending.record.grantId);
  assert.equal(insert.args[1],SUBJECT);
  assert.equal(insert.sql.includes('VALUES (?,?,?,?,?'),true);
  assert.ok(!JSON.stringify(db.operations).includes('private@example.org'));
  assert.deepEqual((await readVerifiedGrantById(db,pending.record.grantId,auditKey)).record,
    pending.record);
});
test('approval and revocation use stale-proof revision CAS and primary audit reads',async()=>{
  const auditKey=await key(),pending=await makePending(auditKey);
  const db=fakeD1(pending),active=await approve(pending,auditKey);
  db.next=active;
  const receipt=await commitSubjectGrantTransition(db,pending,active,auditKey);
  assert.deepEqual(receipt,{grantId:active.record.grantId,revision:2,
    status:'ACTIVE',recorded:true});
  const loaded=await loadFreshActiveSubjectGrant(db,
    {subjectKey:SUBJECT,origin:'https://en.wikipedia.org'},auditKey);
  assert.equal(loaded.status,'ACTIVE');
  assert.equal(loaded.auditHead,active.record.auditHead);
  assert.equal(db.sessions.every(x=>x==='first-primary'),true);
  await assert.rejects(commitSubjectGrantTransition(db,pending,active,auditKey),
    {code:'STALE_GRANT_REVISION'});
  const stopped=await revoke(active,auditKey);
  db.next=stopped;
  assert.equal((await commitSubjectGrantTransition(db,active,stopped,auditKey)).status,
    'REVOKED');
  assert.equal(await loadFreshActiveSubjectGrant(db,
    {subjectKey:SUBJECT,origin:'https://en.wikipedia.org'},auditKey),null);
  const updatedSql=db.operations.find(x=>x.sql.startsWith('UPDATE '));
  assert.ok(updatedSql.sql.includes('revision=? AND audit_head=? AND status=?'));
});
test('a different OAuth subject cannot load another user’s grant',async()=>{
  const auditKey=await key(),pending=await makePending(auditKey);
  const active=await approve(pending,auditKey),db=fakeD1(active);
  assert.equal(await loadFreshActiveSubjectGrant(db,
    {subjectKey:'c'.repeat(64),origin:'https://en.wikipedia.org'},auditKey),null);
});
test('corrupt audit and absent primary session fail closed before authorizing',async()=>{
  const auditKey=await key(),pending=await makePending(auditKey);
  const active=await approve(pending,auditKey);
  const corrupted={...active,events:[
    {...active.events[0],termsDigest:'0'.repeat(64)},active.events[1]]};
  const db=fakeD1(corrupted);
  await assert.rejects(loadFreshActiveSubjectGrant(db,
    {subjectKey:SUBJECT,origin:'https://en.wikipedia.org'},auditKey),
    {code:'SUBJECT_AUDIT_INVALID'});
  await assert.rejects(readVerifiedGrantById({prepare(){}},active.record.grantId,auditKey),
    {code:'SUBJECT_STORE_UNAVAILABLE'});
  await assert.rejects(loadFreshActiveSubjectGrant(db,{
    subjectKey:'not-a-hash',origin:'https://en.wikipedia.org'},auditKey));
});
test('DB errors and uncertain commits never silently retry website actions',async()=>{
  const auditKey=await key(),pending=await makePending(auditKey);
  const db=fakeD1();
  await assert.rejects(insertPendingSubjectGrant(db,pending,auditKey),
    {code:'GRANT_COMMIT_UNCERTAIN_NO_AUTO_RETRY'});
  const active=await approve(pending,auditKey);
  await assert.rejects(commitSubjectGrantTransition(db,pending,active,auditKey),
    {code:'STALE_GRANT_REVISION'});
  assert.equal(db.operations.filter(x=>x.sql.startsWith('UPDATE ')).length,1);
});
test('malformed transition records are rejected before any SQL',async()=>{
  const auditKey=await key(),pending=await makePending(auditKey);
  const active=await approve(pending,auditKey);
  const db=fakeD1(pending);
  await assert.rejects(commitSubjectGrantTransition(db,pending,
    {...active,record:{...active.record,origin:'https://evil.example.org'}},auditKey),
    {code:'SUBJECT_AUDIT_INVALID'});
  assert.equal(db.operations.length,0);
});
