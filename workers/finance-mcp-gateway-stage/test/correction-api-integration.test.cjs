'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('functions/api/finance.js','utf8').replace('export const onRequest=handler;','globalThis.handler=handler;');
const txid='9d1216ae-992c-4eed-8ee2-9efc28e19fe3';
const snapshot={format:'finance-hub-backup',version:2,transactions:[{id:txid,category:'Prop firm',provider:'Apex Trader Funding',type:'Expense',amount:19.7,currency:'USD',date:'2026-02-24',notes:'preserve this'}],propAccounts:[],propEvents:[],propAudit:[],subscriptions:[],invoices:[]};
const state={revision:19,payload:JSON.stringify(snapshot),backups:[],audit:[]};
const normalize=s=>s.toLowerCase().replace(/\s+/g,' ');
const db={
 prepare(sql){return{bind(...args){return{
  async first(){const q=normalize(sql);if(q.includes('from memberships m join users u'))return {workspace_id:'w',role:args[0]==='owner'?'owner':'member'};if(q.includes('from finance_snapshots'))return {revision:state.revision,payload:state.payload,updated_at:'now'};throw Error('Unexpected first '+sql)},
  async run(){throw Error('Unexpected run '+sql)}
 }}}},
 async batch(statements){throw Error('Save intentionally disabled in integration test')}
};
async function main(){
 const pair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await webcrypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='kid';
 const issuer='https://test.cloudflareaccess.com',aud='test-aud';
 const sandbox={Response,Request,URL,TextDecoder,TextEncoder,atob,btoa,crypto:webcrypto,structuredClone,fetch:async()=>new Response(JSON.stringify({keys:[jwk]}))};
 vm.runInNewContext(source,sandbox);
 const env={FINANCE_DB:db,CF_ACCESS_TEAM_DOMAIN:issuer,CF_ACCESS_AUD:aud,FINANCE_CORRECTION_SIGNING_KEY:'isolated-testing-secret-at-least-32-characters'};
 async function req(user,resource,body){
  const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const h=b64({alg:'RS256',kid:'kid'}),p=b64({iss:issuer,aud:[aud],sub:user,email:user+'@example.com',exp:Math.floor(Date.now()/1000)+3600});
  const signature=Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url');
  const response=await sandbox.handler({env,request:new Request('https://test.example/api/finance?resource='+resource,{method:'POST',headers:{'cf-access-jwt-assertion':h+'.'+p+'.'+signature,'content-type':'application/json'},body:JSON.stringify(body)})});
  return{status:response.status,data:await response.json()};
 }
 const proposal={transaction_id:txid,field:'category',expected_revision:19,expected_value:'Prop firm',new_value:'Trading expenses'};
 const preview=await req('owner','transaction-change-preview',proposal);
 assert.equal(preview.status,200,JSON.stringify(preview.data));
 assert.equal(preview.data.saved,false);
 assert.ok(preview.data.approval_ticket);
 assert.equal(preview.data.before,'Prop firm');
 assert.equal(preview.data.after,'Trading expenses');
 assert.equal((await req('owner','transaction-change-preview',{...proposal,expected_value:'incorrect'})).status,409);
 assert.equal((await req('owner','transaction-change-preview',{...proposal,expected_revision:18})).status,409);
 assert.equal((await req('owner','transaction-change-preview',{...proposal,transaction_id:'00000000-0000-0000-0000-000000000000'})).status,409);
 assert.equal((await req('owner','transaction-change-preview',{...proposal,field:'amount'})).status,400);
 const saved={...proposal,approval_ticket:preview.data.approval_ticket,confirmed:true};
 assert.equal((await req('owner','transaction-change-save',saved)).status,503,'disabled by default');
 env.FINANCE_TRANSACTION_CORRECTIONS_ENABLED='true';
 assert.equal((await req('member','transaction-change-save',saved)).status,403,'member cannot save');
 assert.equal((await req('owner','transaction-change-save',{...saved,confirmed:false})).status,400,'explicit confirmation mandatory');
 assert.equal((await req('owner','transaction-change-save',{...saved,new_value:'changed without preview'})).status,403,'tampered value rejected');
 assert.equal((await req('owner','transaction-change-save',{...saved,expected_revision:20})).status,403,'tampered revision rejected');
 assert.equal((await req('owner','transaction-change-save',{...saved,approval_ticket:'invalid'})).status,403,'invalid ticket rejected');
 assert.equal((await req('owner','transaction-change-save',saved)).status,409,'database unavailable for save test; no writes');
 assert.equal(state.revision,19);
 assert.equal(state.payload,JSON.stringify(snapshot));
 console.log('PASS Finance correction API: real JWT, signed preview, exact-change scope, owner approval, feature flag, no writes.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
