'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const file=fs.readFileSync(path.join(__dirname,'..','functions','api','gmail-ingest.js'),'utf8').replace('export async function onRequestPost','async function onRequestPost')+'\nglobalThis.gmailHandler=onRequestPost;';
const gas=fs.readFileSync(path.join(__dirname,'gmail-sync','Code.gs'),'utf8');
assert.match(gas,/Utilities\.newBlob\(data,'application\/json'\)\.getBytes\(\)/,'Apps Script sends explicit UTF-8 bytes');
assert.match(gas,/Utilities\.computeHmacSha256Signature\(stamp\+'\\n'\+data,config\.FINANCE_SYNC_SECRET,Utilities\.Charset\.UTF_8\)/,'Apps Script signs explicit UTF-8 text');
assert.match(gas,/payload:utf8Payload/,'Gmail payload uses the same bytes');
assert.match(gas,/function testGmailSyncSigning\(\)/,'Zero-record signature-only diagnostic is available');
assert.match(gas,/signedPost_\(\[\],config_\(\)\)/,'Diagnostic sends empty batch only');
const records=new Map(),personId='dori-user-id',ownerEmail='owner@example.com';
const db={
 prepare(sql){
  return {bind(...args){return{
   async first(){
    assert.match(sql,/JOIN memberships m/);
    assert.equal(args[0],ownerEmail);
    return {id:personId};
   },
   async run(){
    assert.match(sql,/INSERT OR IGNORE INTO gmail_financial_evidence/);
    assert.equal(args[0],personId);
    const key=args[0]+'|'+args[1];
    if(records.has(key))return {meta:{changes:0}};
    records.set(key,args);
    return {meta:{changes:1}};
   }
  }}};
 }
};
const secret='testing-hmac-secret-32-random-chars-long';
const runtime={TextEncoder,TextDecoder,Response,crypto:webcrypto,Date,Uint8Array,JSON,Number,String,Math,RegExp,Error,Set};
vm.createContext(runtime);vm.runInContext(file,runtime);
async function request(body,signature,proofOverride){
 const stamp=String(Date.now());
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hex=Array.from(new Uint8Array(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(stamp+'\n'+body)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const proof=Array.from(new Uint8Array(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode('finance-keycheck-v1:'+stamp)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 return runtime.gmailHandler({request:new Request('https://fin-kac.pages.dev/api/gmail-ingest',{method:'POST',headers:{'x-finance-timestamp':stamp,'x-finance-signature':signature===undefined?hex:signature,'x-finance-keyproof':proofOverride===undefined?proof:proofOverride,'content-type':'application/json'},body}),env:{FINANCE_DB:db,FINANCE_GMAIL_SYNC_SECRET:secret,FINANCE_GMAIL_SYNC_EMAIL:ownerEmail}});
}
(async()=>{
 let res=await request(JSON.stringify({records:[]}),null);
 assert.equal(res.status,401,'Unsigned Gmail upload must fail');
 let fail=await request(JSON.stringify({records:[]}),null,'0'.repeat(64));
 assert.equal(fail.status,401);
 assert.equal((await fail.json()).reason,'saved_secrets_differ','Key check diagnoses secret mismatches');
 fail=await request(JSON.stringify({records:[]}),null);
 assert.equal(fail.status,401);
 assert.equal((await fail.json()).reason,'payload_signature_mismatch','Key match diagnoses body signature mistakes');
 const row={source_id:'gmail:abc123',date:'2026-11-20',provider:'FTMO',description:'Payment receipt',amount:'100.01',currency:'USDT',category:'Prop firms',status:'payment_confirmed',reference:'gmail:abc123'};
 const data=JSON.stringify({records:[row]});
 res=await request(data);assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{accepted:1,inserted:1,duplicates:0});
 res=await request(data);assert.equal(res.status,200);
 assert.equal((await res.json()).duplicates,1,'Re-imported Gmail source must not duplicate');
 assert.equal(records.size,1,'Only one private evidence row should exist');
 res=await request(JSON.stringify({records:[{...row,source_id:'gmail:bad',date:'wrong'}]}));
 assert.equal(res.status,400,'Invalid data must be rejected');
 const hijack=JSON.stringify({target_user:'someone-else',records:[{...row,source_id:'gmail:another'}]});
 res=await request(hijack);assert.equal(res.status,200);
 assert.equal(records.size,2);
 for(const args of records.values())assert.equal(args[0],personId,'Uploader cannot choose another account');
 console.log('PASS Gmail HMAC, owner scoping, data validation and duplicate prevention.');
})().catch(e=>{console.error(e);process.exitCode=1});
