'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const file=fs.readFileSync(path.join(__dirname,'..','functions','api','gmail-ingest.js'),'utf8').replace('export async function onRequestPost','async function onRequestPost')+'\nglobalThis.gmailHandler=onRequestPost;';
const gas=fs.readFileSync(path.join(__dirname,'gmail-sync','Code.gs'),'utf8');
const financeUi=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.match(financeUi,/const existing=new Map\(\);\s*let localDuplicates=0;/,'Cloud refresh must reconcile local copies');
assert.match(financeUi,/if\(newCount\|\|localDuplicates\)/,'Cloud refresh must persist cleanup even with zero new items');
assert.match(financeUi,/existing\.has\(rec\.source_id\)/,'Downloaded Gmail records must be deduplicated');
assert.match(financeUi,/gmailRemoteOwner/,'Evidence preview is scoped to the authenticated owner');
assert.match(financeUi,/allGmailEvidence\(\)/,'Full cloud evidence remains visible beyond browser snapshot limits');
assert.match(financeUi,/gmailEvidenceMore/,'More than 250 matching records can be browsed');
assert.match(financeUi,/Missing amount/,'Gmail evidence dashboard shows missing amount review count');
assert.match(financeUi,/Needs review/,'Gmail evidence dashboard shows needs-review count');
assert.match(financeUi,/syncButton\.textContent='Checking…'/,'Gmail sync button shows running feedback');
assert.match(financeUi,/This does not trigger Gmail imports/,'Gmail refresh clarifies that imports run in Apps Script');

assert.match(gas,/function importGmailHistoryNow\(\)/,'Manual historical catch-up is available');
assert.match(gas,/function startGmailHistoryAutoImport\(\)/,'One-click unattended Gmail historical import exists');
assert.match(gas,/everyMinutes\(5\)/,'Temporary catch-up scheduler is five-minute');
assert.match(gas,/function stopGmailHistoryAutoImport_\(\)/,'History trigger has automatic cleanup');
assert.match(gas,/trigger\.getHandlerFunction\(\)==='importGmailHistoryNow'/,'Cleanup only targets historical catch-up trigger');
assert.match(gas,/if\(result\.complete&&phase==='enrichment'\)/,'Temporary trigger removed after enrichment completes');

assert.match(gas,/FINANCE_BACKFILL_PAGE_TOKEN/,'Historical catch-up saves its paging cursor');
assert.match(gas,/const FINANCE_BACKFILL_PAGE = 10;/,'Historical Gmail reads use smaller pages');
assert.match(gas,/function gmailQuotaError_\(err\)/,'Gmail API quota failures are recognized');
assert.match(gas,/function pauseGmailQuota_\(store,err\)/,'Gmail quota failures trigger automatic cooldown');
assert.match(gas,/rateLimited=true;break/,'Historical importer retains cursor and pauses on quota');
assert.match(gas,/Utilities\.sleep\(12000\)/,'Manual backfill throttles Google API requests');
assert.match(gas,/if\(gmailCoolingDown_\(store\)\)return/,'Scheduled runs honor quota cooldown');


assert.match(gas,/Utilities\.newBlob\(data,'application\/json'\)\.getBytes\(\)/,'Apps Script sends explicit UTF-8 bytes');
assert.match(gas,/Utilities\.computeHmacSha256Signature\(stamp\+'\\n'\+data,config\.FINANCE_SYNC_SECRET,Utilities\.Charset\.UTF_8\)/,'Apps Script signs explicit UTF-8 text');
assert.match(gas,/payload:utf8Payload/,'Gmail payload uses the same bytes');
assert.match(gas,/result\.inserted\+result\.duplicates\+ignored!==result\.accepted/,'Every scheduled batch audits duplicates plus ignored security messages');
assert.match(gas,/function ensureEnrichmentVersion_\(store\)/,'Enrichment pass has resumable independent cursor');
assert.match(gas,/function decodeFinanceHtml_\(markup\)/,'HTML-only financial receipt support is present');
const parserContext={};vm.createContext(parserContext);
vm.runInContext(gas+'\nthis.moneyFor=moneyFor_;this.html=decodeFinanceHtml_;',parserContext);
const cases=[
 ['Payment receipt','Total paid: AED 125.50','125.50','AED'],
 ['Bank transfer','Amount: 250.00 EUR','250.00','EUR'],
 ['Receipt','Your payment of $49.00 was successful','49.00','USD'],
 ['Transfer executed','Amount: USD 1,235.60','1235.60','USD'],
 ['Invoice','<tr><td>Grand Total</td><td>€39.99</td></tr>','39.99','EUR'],
 ['Fee charged','amount | 15.25 | AED','15.25','AED'],
 ['Trading account ready','Account size 50,000','','']
];
for(const [subject,source,amount,currency] of cases){
 const text=source.startsWith('<')?parserContext.html(source):source;
 const result=parserContext.moneyFor(subject,text);
 assert.equal(result.amount,amount,'Amount extraction for '+subject);
 assert.equal(result.currency,currency,'Currency extraction for '+subject);
}

assert.match(gas,/function runHistoryPass_\(store,config,phase,maxPages,deadline\)/,'History and enrichment run as distinct passes');
assert.match(file,/UPDATE gmail_financial_evidence SET amount=\?, currency=\?/,'Only blank historical amounts are enriched');
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
    if(sql.startsWith('UPDATE gmail_financial_evidence')){
      const [amount,currency,userId,sourceId]=args;
      assert.equal(userId,personId);
      const key=userId+'|'+sourceId,existing=records.get(key);
      if(!existing||existing[5]||existing[6])return {meta:{changes:0}};
      existing[5]=amount;existing[6]=currency;
      return {meta:{changes:1}};
    }
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
 assert.match(gas,/authentication\|verification/,'Apps Script must filter login/security codes before upload');
 assert.match(financeUi,/GMAIL_SECURITY_SUBJECT/,'Dashboard must suppress existing login/security evidence');
 const security={source_id:'gmail:topstep-otp',date:'2026-11-20',provider:'Topstep',description:'Your Topstep authentication code',amount:'',currency:'',category:'Prop firms',status:'needs_review',reference:'gmail:topstep-otp'};
 let ignoredResponse=await request(JSON.stringify({records:[security]}));
 assert.equal(ignoredResponse.status,200);
 assert.deepEqual(await ignoredResponse.json(),{accepted:1,inserted:0,duplicates:0,ignoredSecurity:1,enriched:0});
 assert.equal(records.size,0,'Authentication code must not create financial evidence');
 const news={...security,source_id:'gmail:ipo-news',reference:'gmail:ipo-news',description:'Tomorrow: Anthropic goes public!'};
 const newsResponse=await request(JSON.stringify({records:[news]}));
 assert.equal(newsResponse.status,200);
 assert.deepEqual(await newsResponse.json(),{accepted:1,inserted:0,duplicates:0,ignoredSecurity:1,enriched:0});
 assert.equal(records.size,0,'Marketing and market news must not create financial evidence');
 assert.match(financeUi,/GMAIL_NONFINANCIAL_HEADLINE/,'Dashboard hides marketing headlines');
 assert.match(gas,/function nonFinancialHeadline_\(subject\)/,'Gmail importer ignores market news headlines');
 assert.equal(vm.runInContext("nonFinancialHeadline_('Transfer in foreign currency for a chance to win up to AED 10,000 cashback')",parserContext),true,'Promotional cashback prize must be rejected');
 assert.equal(vm.runInContext("nonFinancialHeadline_('$3.28M+ paid in rewards last month')",parserContext),true,'Global platform rewards must be rejected');
 assert.equal(vm.runInContext("nonFinancialHeadline_('Your payment receipt AED 125.50')",parserContext),false,'Real receipt subject must remain eligible');
 const promo={...security,source_id:'gmail:prize',reference:'gmail:prize',description:'Transfer in foreign currency for a chance to win up to AED 10,000 cashback',amount:'10000',currency:'AED'};
 const promoResult=await request(JSON.stringify({records:[promo]}));
 assert.equal((await promoResult.json()).ignoredSecurity,1,'Server rejects promotional prize as nonfinancial');
 const reward={...security,source_id:'gmail:rewards',reference:'gmail:rewards',description:'$3.28M+ paid in rewards last month',amount:'3.28',currency:'USD'};
 const rewardResult=await request(JSON.stringify({records:[reward]}));
 assert.equal((await rewardResult.json()).ignoredSecurity,1,'Server rejects provider-wide reward announcement');
 assert.match(financeUi,/chance to win/,'Older promotional emails are filtered in the browser');


 const row={source_id:'gmail:abc123',date:'2026-11-20',provider:'FTMO',description:'Payment receipt',amount:'100.01',currency:'USDT',category:'Prop firms',status:'payment_confirmed',reference:'gmail:abc123'};
 const data=JSON.stringify({records:[row]});
 res=await request(data);assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{accepted:1,inserted:1,duplicates:0,ignoredSecurity:0,enriched:0});
 res=await request(data);assert.equal(res.status,200);
 assert.equal((await res.json()).duplicates,1,'Re-imported Gmail source must not duplicate');
 assert.equal(records.size,1,'Only one private evidence row should exist');
 // The same message can occur twice inside one upstream page, and can be retried
 // again by the scheduled trigger. Neither case may create another database row.
 res=await request(JSON.stringify({records:[row,row]}));assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{accepted:2,inserted:0,duplicates:2,ignoredSecurity:0,enriched:0});
 assert.equal(records.size,1,'Duplicate Gmail IDs inside a batch must not duplicate');
 const blank={...row,source_id:'gmail:htmlreceipt',reference:'gmail:htmlreceipt',amount:'',currency:''};
 res=await request(JSON.stringify({records:[blank]}));
 assert.equal((await res.json()).inserted,1,'Historical blank amount must import');
 res=await request(JSON.stringify({records:[{...blank,amount:'245.50',currency:'AED'}]}));
 assert.deepEqual(await res.json(),{accepted:1,inserted:0,duplicates:1,ignoredSecurity:0,enriched:1});
 assert.equal(records.get(personId+'|gmail:htmlreceipt')[5],'245.50','Existing blank amount can be enriched');
 assert.equal(records.get(personId+'|gmail:htmlreceipt')[6],'AED','Enriched currency is preserved');
 res=await request(JSON.stringify({records:[{...blank,amount:'999',currency:'USD'}]}));
 assert.equal((await res.json()).enriched,0,'Existing amount must never be overwritten');
 assert.equal(records.get(personId+'|gmail:htmlreceipt')[5],'245.50');
 res=await request(JSON.stringify({records:[{...row,source_id:'gmail:bad',date:'wrong'}]}));
 assert.equal(res.status,400,'Invalid data must be rejected');
 const hijack=JSON.stringify({target_user:'someone-else',records:[{...row,source_id:'gmail:another'}]});
 res=await request(hijack);assert.equal(res.status,200);
 assert.equal(records.size,3);
 for(const args of records.values())assert.equal(args[0],personId,'Uploader cannot choose another account');
 console.log('PASS Gmail HMAC, owner scoping, data validation and duplicate prevention.');
})().catch(e=>{console.error(e);process.exitCode=1});
