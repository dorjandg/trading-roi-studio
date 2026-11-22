'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('functions/api/finance.js','utf8').replace('export const onRequest=handler;','globalThis.handler=handler;');
const txid='9d1216ae-992c-4eed-8ee2-9efc28e19fe3';
const snapshot={format:'finance-hub-backup',version:2,transactions:[{id:txid,category:'Prop firm',provider:'Apex Trader Funding',type:'Expense',amount:19.7,currency:'USD',date:'2026-02-24',notes:'preserve this'}],propAccounts:[],propEvents:[],propAudit:[],subscriptions:[],invoices:[]};
const state={revision:19,payload:JSON.stringify(snapshot),backups:[],audit:[],failAudit:false,simulateConflict:false};
const normalize=s=>s.toLowerCase().replace(/\s+/g,' ');
const db={
 prepare(sql){return{bind(...args){return{sql,args,
  async first(){const q=normalize(sql);if(q.includes('from memberships m join users u'))return {workspace_id:'w',role:args[0]==='owner'?'owner':'member'};if(q.includes('from finance_snapshots'))return {revision:state.revision,payload:state.payload,updated_at:'now'};throw Error('Unexpected first '+sql)},
  async run(){throw Error('Unexpected run '+sql)}
 }}}},
 async batch(statements){
  assert.equal(statements.length,3);
  const before={revision:state.revision,payload:state.payload,backups:[...state.backups],audit:[...state.audit]};
  try{
   const [backup,update,audit]=statements;
   assert.match(backup.sql,/INSERT INTO finance_mcp_direct_backups/);
   assert.match(update.sql,/UPDATE finance_snapshots SET payload/);
   assert.match(audit.sql,/INSERT INTO finance_mcp_direct_audit/);
   state.backups.push({id:backup.args[0],revision:backup.args[3],payload:backup.args[4]});
   const changes=(!state.simulateConflict&&state.revision===update.args[3])?1:0;
   if(changes){state.payload=update.args[0];state.revision++}
   if(state.failAudit||changes!==1)throw Error('NOT NULL constraint failed: finance_mcp_direct_audit.new_revision');
   state.audit.push({id:audit.args[0],backup_id:audit.args[1],transaction_id:audit.args[4],field:audit.args[5],old:audit.args[6],new:audit.args[7],revision:state.revision});
   return [{meta:{changes:1}},{meta:{changes}},{meta:{changes:1}}];
  }catch(e){
   Object.assign(state,before);throw e;
  }
 }
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
 state.failAudit=true;
 assert.equal((await req('owner','transaction-change-save',saved)).status,409,'audit failure rolls back');
 assert.equal(state.revision,19);
 assert.equal(state.backups.length,0);
 assert.equal(state.audit.length,0);
 state.failAudit=false;state.simulateConflict=true;
 assert.equal((await req('owner','transaction-change-save',saved)).status,409,'concurrent CAS conflict rolls back');
 assert.equal(state.revision,19);
 assert.equal(state.backups.length,0);
 state.simulateConflict=false;
 const success=await req('owner','transaction-change-save',saved);
 assert.equal(success.status,200,JSON.stringify(success.data));
 assert.equal(success.data.saved,true);
 assert.equal(success.data.revision,20);
 assert.equal(state.revision,20);
 assert.equal(state.backups.length,1);
 assert.equal(state.backups[0].payload,JSON.stringify(snapshot));
 assert.equal(state.audit.length,1);
 assert.equal(state.audit[0].transaction_id,txid);
 const updated=JSON.parse(state.payload);
 assert.equal(updated.transactions[0].category,'Trading expenses');
 assert.equal(updated.transactions[0].amount,19.7);
 assert.equal(updated.transactions[0].currency,'USD');
 assert.equal(updated.transactions[0].notes,'preserve this');
 assert.equal((await req('owner','transaction-change-save',saved)).status,409,'replay blocked by revision');
 assert.equal(state.backups.length,1);
 assert.equal(state.audit.length,1);
 console.log('PASS Finance correction API: JWT, signed approval, simulated D1 batch success, audit rollback, CAS conflict, replay denial and untouched financial fields.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
