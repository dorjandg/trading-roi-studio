'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'..','functions','api','finance-sheet-sync.js'),'utf8')
 .replace('export async function onRequestPost','async function onRequestPost')+'\nglobalThis.sheetHandler=onRequestPost;';
const ctx={TextEncoder,TextDecoder,Request,Response,crypto:webcrypto,Date,Set,Uint8Array,Number,String,JSON,Math,RegExp,Error};
vm.createContext(ctx);vm.runInContext(source,ctx);
const secret='unit-test-secret-keep-private',owner='owner@example.test';
let row=null;
const db={prepare(sql){return {bind(...args){return{
 async first(){
  if(sql.includes('FROM users u JOIN memberships')){assert.equal(args[0],owner);return {id:'owner-id',workspace_id:'ws',role:'owner'}}
  if(sql.includes('FROM finance_snapshots'))return row;
  throw Error('Unexpected first '+sql);
 },
 async run(){
  if(sql.startsWith('INSERT OR IGNORE INTO finance_snapshots')){
   if(row)return {meta:{changes:0}};
   row={revision:1,payload:args[3]};
   return {meta:{changes:1}};
  }
  if(sql.startsWith('UPDATE finance_snapshots')){
   if(!row||row.revision!==args[3])return {meta:{changes:0}};
   row={revision:row.revision+1,payload:args[0]};
   return {meta:{changes:1}};
  }
  throw Error('Unexpected run '+sql);
 }
 }}}}};
const env={FINANCE_DB:db,FINANCE_GMAIL_SYNC_SECRET:secret,FINANCE_GMAIL_SYNC_EMAIL:owner};
async function request(records,valid=true){
 const body=JSON.stringify({records}),stamp=String(Date.now());
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hex=Buffer.from(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(stamp+'\n'+body))).toString('hex');
 const req=new Request('https://fin-kac.pages.dev/api/finance-sheet-sync',{method:'POST',headers:{
  'x-finance-timestamp':stamp,'x-finance-signature':valid?hex:'0'.repeat(64)
 },body});
 const res=await ctx.sheetHandler({request:req,env});
 return {status:res.status,data:await res.json()};
}
const base={date:'2026-11-20',provider:'Cloudflare',description:'Receipt for Your Payment to Cloudflare Inc',
 amount:11.17,currency:'USD',direction:'Expense',payment_status:'Confirmed payment',
 source_id:'gmail:abcdef1234567890',review_state:'Approved',category:'Business',notes:'Confirmed in Google Sheet'};
(async()=>{
 assert.equal((await request([base],false)).status,401,'Unsigned submissions cannot write');
 assert.equal((await request([{...base,review_state:'Review'}])).data.imported,0,'Review must not post');
 assert.equal(row,null,'A review-only batch must not create a ledger');
 const result=await request([base,{...base,source_id:'gmail:1234567890abcdef',direction:'Income',payment_status:'payout_approved'},
   {...base,source_id:'gmail:9999999999999999',amount:0}]);
 assert.equal(result.status,200);
 assert.equal(result.data.imported,1,'Only verified settled expense posted');
 assert.equal(result.data.held,2,'Payout approved and invalid amount held');
 assert.equal(JSON.parse(row.payload).transactions[0].type,'Expense');
 assert.equal((await request([base])).data.duplicates,1,'Repeat is deduplicated');
 assert.equal(JSON.parse(row.payload).transactions.length,1,'No duplicate ledger postings');
 console.log('PASS signed Sheet bridge: review gating, no pending payouts, amount checks, idempotent writes.');
})().catch(e=>{console.error(e);process.exitCode=1});
