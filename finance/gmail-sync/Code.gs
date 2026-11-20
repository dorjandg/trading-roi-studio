/**
 * Finance Hub Gmail finance-only reader. Gmail advanced service must be enabled.
 * Required OAuth: gmail.readonly (never send, edit, delete or mark read).
 * Source email content is reduced to financial metadata before leaving Google.
 *
 * Script Properties (never in GitHub):
 * FINANCE_INGEST_URL=https://fin-kac.pages.dev/api/gmail-ingest
 * FINANCE_SYNC_SECRET=<same random secret as Cloudflare FINANCE_GMAIL_SYNC_SECRET>
 * FINANCE_ACCESS_CLIENT_ID=<Cloudflare Access service token client ID>
 * FINANCE_ACCESS_CLIENT_SECRET=<Cloudflare Access service token secret>
 *
 * In Cloudflare configure FINANCE_GMAIL_SYNC_EMAIL to the Finance Hub owner.
 */
const FINANCE_QUERY = '{subject:payment subject:receipt subject:invoice subject:transaction subject:deposit subject:withdrawal subject:transfer subject:payout subject:refund subject:purchase subject:charged subject:charge subject:billing subject:subscription subject:statement subject:order subject:booking subject:paid subject:expense subject:credit subject:debit subject:balance subject:salary subject:rent subject:utility subject:fee from:(notifications@bybit.com) from:(confirmo.net) from:(topstep.com) from:(ftmo.com) from:(swaymarkets.com) from:(liquidbrokers.com)} -in:spam -in:trash';
const FINANCE_BACKFILL_PAGE = 10;
const FINANCE_RECHECK_DAYS = 21;
const FINANCE_MAX_MESSAGES_PER_RUN = 70;
const FINANCE_QUOTA_COOLDOWN_MS = 180000;
function gmailQuotaError_(err){
 return /quota exceeded|rate.?limit|too many requests|resource exhausted|userRateLimitExceeded|rateLimitExceeded/i.test(String(err));
}
function gmailCoolingDown_(store){
 const until=Number(store.getProperty('FINANCE_GMAIL_COOLDOWN_UNTIL')||0);
 if(until>Date.now()){console.log('Gmail cooldown: '+Math.ceil((until-Date.now())/1000)+' seconds remaining. Saved cursor unchanged.');return true}
 if(until)store.deleteProperty('FINANCE_GMAIL_COOLDOWN_UNTIL');
 return false;
}
function pauseGmailQuota_(store,err){
 store.setProperty('FINANCE_GMAIL_COOLDOWN_UNTIL',String(Date.now()+FINANCE_QUOTA_COOLDOWN_MS));
 console.warn('Gmail quota reached: pausing 3 minutes. Failed page cursor was not advanced. '+String(err).slice(0,150));
}

function config_() {
  const prop = PropertiesService.getScriptProperties();
  const names=['FINANCE_INGEST_URL','FINANCE_SYNC_SECRET','FINANCE_ACCESS_CLIENT_ID','FINANCE_ACCESS_CLIENT_SECRET'];
  const v={};for(const n of names){v[n]=prop.getProperty(n)||'';if(!v[n])throw Error('Missing Script Property: '+n);}
  if(v.FINANCE_INGEST_URL!=='https://fin-kac.pages.dev/api/gmail-ingest')throw Error('Unexpected destination; review the endpoint before sending financial metadata.');
  return v;
}
function extractHeader_(data,name){
  const v=(data.payload?.headers||[]).find(h=>String(h.name).toLowerCase()===name);
  return v?.value||'';
}
function decodeFinanceHtml_(markup){
 // Normalize HTML-only receipts while retaining separators around tables.
 // Never upload raw HTML or message bodies to Finance Hub.
 return markup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
   .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
   .replace(/<\/(?:tr|td|th|div|p|li|h[1-6])>|<br\b[^>]*\/?>/gi,' | ')
   .replace(/<[^>]*>/g,' ')
   .replace(/&(?:nbsp|thinsp|ensp|emsp);|&#(?:160|8239);/gi,' ')
   .replace(/&(?:euro|#8364);/gi,' € ').replace(/&(?:pound|#163);/gi,' £ ')
   .replace(/&(?:dollar|#36);/gi,' $ ')
   .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function plainParts_(part,found){
 if(!part)return;
 if((part.mimeType==='text/plain'||part.mimeType==='text/html')&&part.body?.data){
   try{
     const decoded=Utilities.newBlob(Utilities.base64DecodeWebSafe(part.body.data)).getDataAsString('UTF-8');
     found.push(part.mimeType==='text/html'?decodeFinanceHtml_(decoded):decoded);
   }catch(e){}
 }
 for(const child of part.parts||[])plainParts_(child,found);
}
function financialText_(msg){
 const parts=[];plainParts_(msg.payload,parts);
 // Many bank, airline and prop-firm receipts use HTML-only email templates.
 const text=parts.join(' | ');
 return text.replace(/https?:\/\/\S+/g,' ').replace(/\s+/g,' ').slice(0,24000);
}
function providerFor_(sender,subject,body){
  const text=(sender+' '+subject).toLowerCase();
  const known=[
    [/ftmo/,['FTMO','Prop firms']],[/topstep/,['Topstep','Prop firms']],
    [/apex trader/,['Apex Trader Funding','Prop firms']],
    [/holaprime|hola prime/,['Hola Prime','Prop firms']],
    [/aquafunded|aqua funded/,['AquaFunded','Prop firms']],
    [/aquafutures/,['AquaFutures','Prop firms']],
    [/blue guardian/,['Blue Guardian','Prop firms']],
    [/fundednext/,['FundedNext','Prop firms']],
    [/lucid trading/,['Lucid Trading','Prop firms']],
    [/my funded futures|mffu/,['My Funded Futures','Prop firms']],
    [/sway markets/,['Sway Markets','Broker investments']],
    [/liquid brokers/,['Liquid Brokers','Broker investments']],
    [/ic markets|raw trading/,['IC Markets','Broker investments']],
    [/bybit|binance/,['Crypto exchange','Crypto & transfers']],
    [/\bliv\b|emirates nbd|adcb|mashreq/,['Banking provider','Banking']],
    [/dewa|electricity and water authority/,['DEWA','Housing & utilities']],
    [/careem|wolt|wingsters|domino|restaurant|delivery/,['Food / delivery','Food & delivery']],
    [/booking\.com|airbnb|hotel|flydubai|wizz air|emirates airline/,['Travel provider','Travel']],
    [/cloudflare|heygen|anthropic|google play|google workspace|tradingview|duplikium|suno|kapwing/,['Software provider','Software']],
  ];
  for(const [re,val] of known)if(re.test(text))return val;
  if(/subscription|workspace|saas|license/i.test(subject))return ['Other software','Software'];
  if(/invoice|receipt|paid|payment|transaction|charge|deposit|withdraw|refund|payout|transfer/i.test(subject))return ['Other merchant','Unclassified'];
  return null;
}
function nonFinancialHeadline_(subject){
 // Reject obvious marketing/financial-news announcements, not invoices,
 // payout approvals or bank transfers. Kept narrow to avoid false negatives.
 return /\b(?:goes public|going public|ipo announcement|ipo launches?|join (?:our|the) webinar|register for (?:our|the) webinar)\b/i.test(subject);
}
function statusFor_(subject,content){
  const s=(subject+' '+content.slice(0,400)).toLowerCase();
  // Security/login messages are never financial evidence. Check the subject
  // independently so a noisy template body cannot hide the actual message type.
  if(/\b(?:authentication|verification|security|sign[ -]?in|login|access|one[ -]?time|two[ -]?factor|2fa)\s+(?:codes?|pins?|passwords?)\b|\botp\b|password reset|reset your password|magic link|verify your (?:email|account|identity)/i.test(subject))return null;
  if(/otp|verification code|security code|password reset|sign.in code|two.factor/.test(s))return null;
  if(/declined|failed|suspended|cancelled|canceled|payment reminder/.test(s))return 'needs_review';
  if(/authorization|approve your transaction|securepass/.test(s))return 'authorization_only';
  if(/refund (has been )?(issued|sent|processed)/.test(s))return 'refund_issued';
  if(/payout (has been )?approved/.test(s))return 'payout_approved';
  if(/payout.*(processing|being processed)/.test(s))return 'payout_processing';
  if(/withdrawal (success|completed|confirmed)|successfully withdrawn/.test(s))return 'withdrawal_confirmed';
  if(/internal transfer|transfer (executed|completed)/.test(s))return 'transfer_confirmed';
  if(/deposit (request.*executed|confirmation|completed)|deposit has been|deposit.*(credited|received)/.test(s))return 'deposit_confirmed';
  if(/payment.*(complete|successful)|payment receipt|paid visa|receipt for your payment/.test(s))return 'payment_confirmed';
  if(/order.*(confirmed|complete)|booking.*confirmed/.test(s))return 'order_confirmed';
  return 'needs_review';
}
function moneyFor_(subject,text){
 // Only record a value when amount and currency are visible together,
 // preferably beside a payment/receipt/transfer label. Never infer currency
 // from the sender or from a different part of the email.
 const s=(subject+' | '+text).slice(0,24000);
 const currency='(?:USD|EUR|AED|GBP|USDT|USDC|SAR|TRY|CHF|CAD|AUD|INR|BTC|ETH)';
 const value='(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\\.[0-9]{1,8})?';
 const label='(?:amount(?:\\s+(?:paid|charged|debited|credited|received|due))?|payment(?:\\s+amount)?|total(?:\\s+(?:paid|charged|due|price|amount))?|grand\\s+total|paid|charged|debited|credited|received|transferred|withdrawn|deposit(?:ed)?|payout|price|invoice\\s+total)';
 const patterns=[
   new RegExp('\\b'+label+'\\b\\s*(?:of|is|was|:|=|[-|])?\\s*('+currency+')\\s*('+value+')\\b','i'),
   new RegExp('\\b'+label+'\\b\\s*(?:of|is|was|:|=|[-|])?\\s*([$€£])\\s*('+value+')\\b','i'),
   new RegExp('\\b'+label+'\\b\\s*(?:of|is|was|:|=|[-|])?\\s*('+value+')\\s*('+currency+')\\b','i'),
   new RegExp('\\b'+label+'\\b[\\s|:=-]{0,28}('+currency+')\\s*('+value+')\\b','i'),
   new RegExp('\\b'+label+'\\b[\\s|:=-]{0,28}('+value+')[\\s|:=-]{0,12}('+currency+')\\b','i'),
   new RegExp('\\b('+currency+')\\s*('+value+')\\b','i'),
   new RegExp('([$€£])\\s*('+value+')\\b','i'),
   new RegExp('\\b('+value+')\\s*('+currency+')\\b','i')
 ];
 const symbolCurrency={'$':'USD','€':'EUR','£':'GBP'};
 for(let i=0;i<patterns.length;i++){
   const m=s.match(patterns[i]);if(!m)continue;
   let amount='',code='';
   if(i===1||i===6){code=symbolCurrency[m[1]];amount=m[2];}
   else if(i===2||i===4||i===7){amount=m[1];code=m[2];}
   else{code=m[1];amount=m[2];}
   amount=amount.replace(/,/g,'');code=String(code).toUpperCase();
   if(!/^[0-9]+(?:\.[0-9]{1,8})?$/.test(amount)||!code||!Number.isFinite(Number(amount))||Number(amount)<=0)continue;
   // Keep eight-decimal precision for crypto; numeric bounds prevent capturing
   // enormous account numbers as plausible cash amounts.
   if(Number(amount)>1e12)continue;
   return {amount,currency:code};
 }
 return {amount:'',currency:''};
}
function recordFrom_(message){
  const subject=extractHeader_(message,'subject').slice(0,180);
  const sender=extractHeader_(message,'from');
  const text=financialText_(message);
  if(nonFinancialHeadline_(subject))return null;
  // Owner request: exclude Karim expenses from the evidence feed.
  if(/\bkarim\b/i.test(sender+' '+subject))return null;
  const provider=providerFor_(sender,subject,text);
  if(!provider)return null;
  const status=statusFor_(subject,text);if(!status)return null;
  const m=moneyFor_(subject,text);
  const date=Utilities.formatDate(new Date(Number(message.internalDate)),'Etc/UTC','yyyy-MM-dd');
  return {
    source_id:'gmail:'+message.id,date,provider:provider[0],
    description:subject.slice(0,180),
    amount:m.amount,currency:m.currency,
    category:provider[1],status,
    reference:'gmail:'+message.id
  };
}
function signedPost_(records,config){
  const data=JSON.stringify({records});
  const stamp=String(Date.now());
  // Sign the explicit UTF-8 representation of the JSON and transmit those
  // same bytes. UrlFetchApp can otherwise encode a string payload differently
  // when Gmail subjects contain non-ASCII characters (€, accented text, etc.).
  const utf8Payload=Utilities.newBlob(data,'application/json').getBytes();
  const signature=Utilities.computeHmacSha256Signature(stamp+'\n'+data,config.FINANCE_SYNC_SECRET,Utilities.Charset.UTF_8)
    .map(x=>(x<0?x+256:x).toString(16).padStart(2,'0')).join('');
  // Non-secret diagnostic proof: never log credentials or the HMAC value.
  const keyproof=Utilities.computeHmacSha256Signature('finance-keycheck-v1:'+stamp,config.FINANCE_SYNC_SECRET,Utilities.Charset.UTF_8)
    .map(x=>(x<0?x+256:x).toString(16).padStart(2,'0')).join('');
  const response=UrlFetchApp.fetch(config.FINANCE_INGEST_URL,{
    method:'post',contentType:'application/json; charset=UTF-8',payload:utf8Payload,muteHttpExceptions:true,
    headers:{'x-finance-timestamp':stamp,'x-finance-signature':signature,'x-finance-keyproof':keyproof,
      'CF-Access-Client-Id':config.FINANCE_ACCESS_CLIENT_ID,
      'CF-Access-Client-Secret':config.FINANCE_ACCESS_CLIENT_SECRET}
  });
  if(response.getResponseCode()!==200)throw Error('Finance Hub rejected batch: HTTP '+response.getResponseCode()+' '+response.getContentText().slice(0,300));
  const result=JSON.parse(response.getContentText());
  // Every scheduled batch must receive an internally consistent deduplication
  // receipt from D1; stop paging if anything looks wrong.
  const ignored=Number(result.ignoredSecurity||0);
  if(result.accepted!==records.length||!Number.isInteger(result.inserted)||
      !Number.isInteger(result.duplicates)||!Number.isInteger(ignored)||
      result.inserted<0||result.duplicates<0||ignored<0||
      result.inserted+result.duplicates+ignored!==result.accepted)
    throw Error('Gmail duplicate audit failed: invalid database reconciliation receipt');
  return result;
}
/**
 * Diagnostics only: signs and submits an empty ASCII-only record batch.
 * Does not read Gmail, install triggers, or create financial records.
 * If this works while normal sync fails, inspect Unicode payload serialization.
 */
function testGmailSyncSigning(){
  const result=signedPost_([],config_());
  if(result.accepted!==0||result.inserted!==0)throw Error('Unexpected nonempty signing test response');
  console.log('Gmail signing test PASSED: accepted=0 inserted=0. No financial records changed.');
}
function syncPage_(query,token,config){
  let page=Gmail.Users.Messages.list('me',{q:query,maxResults:FINANCE_BACKFILL_PAGE,pageToken:token||undefined});
  const candidates=[],ids=(page.messages||[]).slice(0,FINANCE_MAX_MESSAGES_PER_RUN);
  for(const item of ids){
    try{
      const msg=Gmail.Users.Messages.get('me',item.id,{format:'full'});
      const record=recordFrom_(msg);if(record)candidates.push(record);
    }catch(err){
      // A deleted message is harmless; retry any other Gmail API failure rather
      // than advancing past evidence that was never inspected.
      if(/(?:404|not found)/i.test(String(err)))console.warn('Deleted Gmail message skipped: '+item.id);
      else throw err;
    }
  }
  // Send even empty batches; verified destination check precedes advancing cursor.
  const result=signedPost_(candidates,config);
  return {pageToken:page.nextPageToken||'',result};
}
/**
 * Historical catch-up. Runs for up to ~3 minutes or 8 pages (up to
 * 80 Gmail candidates), whichever occurs first. Retains progress in Script
 * Properties and safely skips duplicate Gmail IDs in D1. Can be run repeatedly.
 * The existing 15-minute trigger remains unchanged.
 */
/**
 * Start temporary, self-removing catch-up runs every five minutes.
 * The normal 15-minute sync remains untouched. Safe to run more than once.
 */
function ensureEnrichmentVersion_(store){
 const version='finance-html-amount-enrich-v1';
 if(store.getProperty('FINANCE_ENRICH_VERSION')!==version){
  store.deleteProperty('FINANCE_ENRICH_PAGE_TOKEN');
  store.deleteProperty('FINANCE_ENRICH_DONE');
  store.setProperty('FINANCE_ENRICH_VERSION',version);
  console.log('HTML amount enrichment scheduled to revisit financial messages from newest.');
 }
}
function startGmailHistoryAutoImport(){
 config_();
 const store=PropertiesService.getScriptProperties();
 ensureEnrichmentVersion_(store);
 if(store.getProperty('FINANCE_BACKFILL_DONE')==='1'&&store.getProperty('FINANCE_ENRICH_DONE')==='1'){
  stopGmailHistoryAutoImport_();
  console.log('Historical import and amount enrichment already complete.');
  return;
 }
 const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='importGmailHistoryNow');
 if(!existing.length){
  ScriptApp.newTrigger('importGmailHistoryNow').timeBased().everyMinutes(5).create();
  console.log('Temporary five-minute history and amount-enrichment trigger enabled.');
 }else console.log('Temporary historical import trigger already exists.');
 importGmailHistoryNow();
}
/** Only delete the temporary history trigger, never the regular sync trigger. */
function stopGmailHistoryAutoImport_(){
 for(const trigger of ScriptApp.getProjectTriggers()){
  if(trigger.getHandlerFunction()==='importGmailHistoryNow')ScriptApp.deleteTrigger(trigger);
 }
}
function stopGmailHistoryAutoImport(){
 stopGmailHistoryAutoImport_();
 console.log('Temporary Gmail catch-up stopped. Regular fifteen-minute sync unchanged.');
}
function runHistoryPass_(store,config,phase,maxPages,deadline){
 const enrich=phase==='enrichment',tokenKey=enrich?'FINANCE_ENRICH_PAGE_TOKEN':'FINANCE_BACKFILL_PAGE_TOKEN';
 const doneKey=enrich?'FINANCE_ENRICH_DONE':'FINANCE_BACKFILL_DONE';
 let pages=0,inserted=0,duplicates=0,accepted=0,enriched=0,rateLimited=false,complete=store.getProperty(doneKey)==='1';
 while(!complete&&pages<maxPages&&Date.now()<deadline){
  const token=store.getProperty(tokenKey)||'';
  let page;
  try{page=syncPage_(FINANCE_QUERY,token,config)}
  catch(err){
   if(gmailQuotaError_(err)){pauseGmailQuota_(store,err);rateLimited=true;break}
   if(token&&/page.?token|invalid argument/i.test(String(err))){
    store.deleteProperty(tokenKey);
    throw Error('Gmail '+phase+' cursor expired. Next run restarts at newest with source-ID deduplication. '+err.message);
   }
   throw err;
  }
  accepted+=page.result.accepted;
  inserted+=page.result.inserted;
  duplicates+=page.result.duplicates;
  enriched+=Number(page.result.enriched||0);
  pages++;
  if(page.pageToken)store.setProperty(tokenKey,page.pageToken);
  else{store.deleteProperty(tokenKey);store.setProperty(doneKey,'1');complete=true}
  if(!complete&&pages<maxPages&&Date.now()+12000<deadline)Utilities.sleep(12000);
 }
 console.log('Gmail '+phase+': pages='+pages+' accepted='+accepted+' inserted='+inserted+' duplicates='+duplicates+' enriched='+enriched+' complete='+complete+' rateLimited='+rateLimited);
 return {complete,rateLimited};
}
/** Resumable two-stage import: first capture messages, then revisit old HTML receipts. */
function importGmailHistoryNow(){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(1000)){console.log('Another Gmail import is active; skipped concurrent run.');return}
 try{
  const config=config_(),store=PropertiesService.getScriptProperties();
  if(gmailCoolingDown_(store))return;
  const version='finance-search-20261120-v2';
  if(store.getProperty('FINANCE_QUERY_VERSION')!==version){
   store.deleteProperty('FINANCE_BACKFILL_DONE');
   store.deleteProperty('FINANCE_BACKFILL_PAGE_TOKEN');
   store.deleteProperty('FINANCE_RECENT_PAGE_TOKEN');
   store.setProperty('FINANCE_QUERY_VERSION',version);
  }
  ensureEnrichmentVersion_(store);
  const phase=store.getProperty('FINANCE_BACKFILL_DONE')==='1'?'enrichment':'historical';
  if(phase==='enrichment'&&store.getProperty('FINANCE_ENRICH_DONE')==='1'){
   stopGmailHistoryAutoImport_();
   console.log('All historical capture and amount enrichment completed. Regular sync remains enabled.');
   return;
  }
  const result=runHistoryPass_(store,config,phase,8,Date.now()+160000);
  if(result.complete&&phase==='historical')console.log('Historical capture completed. Next temporary run revisits older messages to fill blank amounts.');
  if(result.complete&&phase==='enrichment'){
   stopGmailHistoryAutoImport_();
   console.log('Gmail amount enrichment complete; temporary trigger removed.');
  }
 }finally{lock.releaseLock()}
}
/** Fifteen-minute refresh continues even after both historical phases complete. */
function syncGmailFinance(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{
  const config=config_(),store=PropertiesService.getScriptProperties();
  if(gmailCoolingDown_(store))return;
  ensureEnrichmentVersion_(store);
  const recent='after:'+Utilities.formatDate(new Date(Date.now()-FINANCE_RECHECK_DAYS*86400000),'Etc/UTC','yyyy/MM/dd')+' '+FINANCE_QUERY;
  const recentToken=store.getProperty('FINANCE_RECENT_PAGE_TOKEN')||'';
  let recentResult;
  try{recentResult=syncPage_(recent,recentToken,config)}
  catch(err){
   if(gmailQuotaError_(err)){pauseGmailQuota_(store,err);return}
   if(recentToken){store.deleteProperty('FINANCE_RECENT_PAGE_TOKEN');throw Error('Recent paging cursor expired. Retry newest: '+err.message)}
   throw err;
  }
  console.log('Recent Gmail evidence: '+JSON.stringify(recentResult.result));
  if(recentResult.pageToken)store.setProperty('FINANCE_RECENT_PAGE_TOKEN',recentResult.pageToken);
  else store.deleteProperty('FINANCE_RECENT_PAGE_TOKEN');
  const phase=store.getProperty('FINANCE_BACKFILL_DONE')==='1'?'enrichment':'historical';
  const doneKey=phase==='enrichment'?'FINANCE_ENRICH_DONE':'FINANCE_BACKFILL_DONE';
  if(store.getProperty(doneKey)!=='1'){
   const result=runHistoryPass_(store,config,phase,2,Date.now()+60000);
   if(result.complete&&phase==='enrichment')stopGmailHistoryAutoImport_();
  }
 }finally{lock.releaseLock()}
}
function installGmailFinanceSync(){
  config_();const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='syncGmailFinance');
  if(!existing.length)ScriptApp.newTrigger('syncGmailFinance').timeBased().everyMinutes(15).create();
  syncGmailFinance();
}
function resetGmailBackfill(){
  const p=PropertiesService.getScriptProperties();
  p.deleteProperty('FINANCE_BACKFILL_DONE');p.deleteProperty('FINANCE_BACKFILL_PAGE_TOKEN');
}
