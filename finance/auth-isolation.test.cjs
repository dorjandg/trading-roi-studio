'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'..','functions','api','finance.js'),'utf8').replace('export const onRequest=handler;','globalThis.financeHandler=handler;');
const issuer='https://finance-test.cloudflareaccess.com',audience='finance-test-audience';
const rows={users:new Map([['owner-id',{email:'owner@example.com'}],['member-id',{email:'member@example.com'}]]),memberships:new Map([['owner-id',{workspace_id:'test-workspace',role:'owner'}],['member-id',{workspace_id:'test-workspace',role:'member'}]]),snapshots:new Map()};
const normalized=s=>s.toLowerCase().replace(/\s+/g,' ').trim();
function db(){
 return {
  prepare(sql){return{bind(...args){return{
   async first(){
    const q=normalized(sql);
    if(q.includes('from memberships m join users u'))return rows.memberships.get(args[0])||null;
    if(q.includes('from invitations'))return null;
    if(q.includes('from finance_snapshots')){const row=rows.snapshots.get(args[0]+'|'+args[1]);if(!row)return null;return q.includes('payload')?row:{revision:row.revision,updated_at:row.updated_at}}
    throw Error('Unexpected SQL first '+sql);
   },
   async run(){
    const q=normalized(sql);
    if(q.startsWith('insert or ignore into finance_snapshots')){
     const key=args[0]+'|'+args[1];
     if(rows.snapshots.has(key))return{meta:{changes:0}};
     rows.snapshots.set(key,{revision:1,payload:args[2],updated_at:'2026-11-19'});
     return{meta:{changes:1}};
    }
    if(q.startsWith('update finance_snapshots set payload')){
     const key=args[1]+'|'+args[2],row=rows.snapshots.get(key);
     if(!row||row.revision!==args[3])return{meta:{changes:0}};
     row.payload=args[0];row.revision++;return{meta:{changes:1}};
    }
    throw Error('Unexpected SQL run '+sql);
   }
  }}}},async batch(){throw Error('Not needed in seeded tests')}
 };
}
const payload={format:'finance-hub-backup',version:2,transactions:[],propAccounts:[],propEvents:[],propAudit:[],subscriptions:[],invoices:[]};
async function main(){
 const key=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const publicKey=await webcrypto.subtle.exportKey('jwk',key.publicKey);publicKey.kid='test-kid';publicKey.alg='RS256';
 const sandbox={Response,Request,URL,TextDecoder,TextEncoder,atob,crypto:webcrypto,fetch:async()=>new Response(JSON.stringify({keys:[publicKey]}),{status:200})};
 vm.runInNewContext(source,sandbox,{filename:'finance.js'});
 const env={FINANCE_DB:db(),CF_ACCESS_TEAM_DOMAIN:issuer,CF_ACCESS_AUD:audience,FINANCE_BOOTSTRAP_EMAIL:'owner@example.com'};
 const b64=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');
 async function token(id,email){
  const head=b64({alg:'RS256',kid:'test-kid'}),body=b64({iss:issuer,aud:[audience],sub:id,email,exp:Math.floor(Date.now()/1000)+3600});
  const sig=await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',key.privateKey,new TextEncoder().encode(head+'.'+body));
  return head+'.'+body+'.'+Buffer.from(sig).toString('base64url');
 }
 async function req(id,email,resource,method='GET',data){
  const headers={};if(id)headers['cf-access-jwt-assertion']=await token(id,email);
  if(data)headers['content-type']='application/json';
  const request=new Request('https://finance.example/api/finance?resource='+resource,{method,headers,body:data?JSON.stringify(data):undefined});
  const response=await sandbox.financeHandler({request,env});
  return{status:response.status,data:await response.json()};
 }
 assert.equal((await req(null,null,'me')).status,401,'Missing JWT rejected');
 assert.equal((await req('stranger-id','stranger@example.com','me')).status,403,'Uninvited member denied');
 assert.equal((await req('owner-id','owner@example.com','me')).data.role,'owner');
 assert.equal((await req('member-id','member@example.com','me')).data.role,'member');
 assert.equal((await req('owner-id','owner@example.com','snapshot','PUT',{expectedRevision:0,data:payload})).data.revision,1);
 assert.equal((await req('member-id','member@example.com','snapshot')).data.data,null,'Member cannot read owner backup');
 assert.equal((await req('member-id','member@example.com','snapshot-meta')).data.revision,0,'Member sees only own revision');
 assert.equal((await req('member-id','member@example.com','snapshot','PUT',{expectedRevision:0,data:{...payload,transactions:[{id:'private-member-data'}]}})).status,200);
 assert.equal((await req('owner-id','owner@example.com','snapshot')).data.data.transactions.length,0,'Owner cannot read member backup');
 assert.equal((await req('owner-id','owner@example.com','snapshot','PUT',{expectedRevision:0,data:payload})).status,409,'Stale save rejected');
 assert.equal((await req('owner-id','owner@example.com','snapshot','PUT',{expectedRevision:1,data:payload})).data.revision,2,'Revision increments safely');
 assert.equal((await req('member-id','member@example.com','members')).status,403,'Member cannot enumerate others');
 console.log('PASS Finance Hub: signed JWT, owner/member snapshot isolation, uninvited denial, stale-write protection.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
