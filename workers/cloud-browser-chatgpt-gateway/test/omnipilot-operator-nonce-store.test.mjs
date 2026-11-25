import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {issueOperatorNonce,consumeOperatorNonce}
  from '../src/omnipilot-operator-nonce-store.mjs';
const NOW=1764000000000,OP='a'.repeat(64),SESSION='b'.repeat(64),
  STRANGER='c'.repeat(64),NONCE='n'.repeat(43);
const hmacKey=()=>webcrypto.subtle.importKey('raw',new Uint8Array(32).fill(90),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
function fakeD1(){
  const records=new Map(),operations=[];
  const db={records,operations,
    prepare(sql){
      return {bind(...values){
        operations.push({sql,values});
        return {
          async run(){
            if(!sql.startsWith('INSERT INTO omnipilot_operator_nonces'))throw Error('SQL_NOT_APPROVED');
            const [digest,operatorKey,sessionKey,issued,expires,status]=values;
            if(records.has(digest))throw Error('DUPLICATE');
            records.set(digest,{digest,operatorKey,sessionKey,issued,expires,status});
            return {success:true};
          },
          async first(){
            if(!sql.startsWith('UPDATE omnipilot_operator_nonces'))throw Error('SQL_NOT_APPROVED');
            const [now,digest,operatorKey,sessionKey,checkA,checkB]=values;
            const row=records.get(digest);
            if(!row||row.operatorKey!==operatorKey||row.sessionKey!==sessionKey||
              row.status!=='ISSUED'||row.issued>checkA||row.expires<=checkB)return null;
            row.status='USED';row.consumedAt=now;
            return {nonce_digest:digest};
          }
        };
      }};
    }
  };
  return db;
}
const issue=async(db,key,changes={})=>issueOperatorNonce({db,hmacKey:key,
  operatorKey:OP,sessionKey:SESSION,nowMs:NOW,nonceFactory:()=>NONCE,...changes});
const consume=async(db,key,changes={})=>consumeOperatorNonce({db,hmacKey:key,
  nonce:NONCE,operatorKey:OP,sessionKey:SESSION,nowMs:NOW+60000,...changes});
test('issued operator nonce exists only in caller response, D1 stores HMAC',async()=>{
  const db=fakeD1(),key=await hmacKey();
  const issued=await issue(db,key);
  assert.equal(issued.nonce,NONCE);
  assert.equal(issued.expiresAtMs,NOW+300000);
  assert.equal(issued.retrySafe,false);
  assert.equal(issued.storedAsDigest,true);
  assert.equal(db.records.size,1);
  const row=[...db.records.values()][0];
  assert.match(row.digest,/^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(row).includes(NONCE));
  assert.equal(row.operatorKey,OP);assert.equal(row.sessionKey,SESSION);
  assert.equal(db.operations[0].sql.includes('VALUES (?,?,?,?,?,?)'),true);
});
test('same nonce may be consumed exactly once, including concurrent attempts',async()=>{
  const db=fakeD1(),key=await hmacKey();
  await issue(db,key);
  const result=await Promise.all([consume(db,key),consume(db,key)]);
  assert.deepEqual(result.sort(),[false,true]);
  assert.equal(await consume(db,key),false);
  const row=[...db.records.values()][0];
  assert.equal(row.status,'USED');
});
test('different operator, session or HMAC key never consumes another nonce',async()=>{
  const db=fakeD1(),key=await hmacKey();
  await issue(db,key);
  assert.equal(await consume(db,key,{operatorKey:STRANGER}),false);
  assert.equal(await consume(db,key,{sessionKey:STRANGER}),false);
  const wrongKey=await webcrypto.subtle.importKey('raw',new Uint8Array(32).fill(91),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  assert.equal(await consume(db,wrongKey),false);
  assert.equal(await consume(db,key),true);
});
test('expired nonce, future nonce and malformed arguments are rejected',async()=>{
  const db=fakeD1(),key=await hmacKey();
  await issue(db,key);
  assert.equal(await consume(db,key,{nowMs:NOW+300000}),false);
  assert.equal(await consume(db,key,{nowMs:NOW-1}),false);
  await assert.rejects(issue(db,key,{nonceFactory:()=>'<script>'}),
    {code:'NONCE_FORMAT_INVALID'});
  await assert.rejects(issue(db,key,{operatorKey:'unverified'}),
    {code:'NONCE_IDENTITY_UNVERIFIED'});
  await assert.rejects(issue(db,null),{code:'NONCE_KEY_UNAVAILABLE'});
  await assert.rejects(consume(db,key,{nonce:'garbage'}),
    {code:'NONCE_STORE_UNAVAILABLE'});
});
test('ambiguous commit and unavailable database fail closed without retry',async()=>{
  const key=await hmacKey(),db=fakeD1();
  const failDb={prepare(){return {bind(){return {run:async()=>({success:false}),
    first:async()=>{throw Error('db unavailable')}}}}}};
  await assert.rejects(issue(failDb,key),
    {code:'NONCE_ISSUE_UNCERTAIN_NO_RETRY'});
  await assert.rejects(consume(failDb,key),
    {code:'NONCE_CONSUMPTION_UNCERTAIN_NO_RETRY'});
  await assert.rejects(issue(null,key),{code:'NONCE_STORE_UNAVAILABLE'});
  await issue(db,key);
  await assert.rejects(issue(db,key),{code:'NONCE_ISSUE_UNCERTAIN_NO_RETRY'});
  assert.equal(db.records.size,1);
});
