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
  // Payment processors (e.g., Confirmo) may not name FTMO in the subject.
  // Determine provider from payment destination without accepting unrelated crypto notices.
  if(/confirmo\.net/i.test(sender)&&/\bFTMO Evaluation Global\b/i.test(body))return ['FTMO','Prop firms'];
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
 // Promotional prize values and provider-wide reward totals must never be
 // mistaken for the signed-in person's payments.
 return /\b(?:goes public|going public|ipo announcement|ipo launches?|join (?:our|the) webinar|register for (?:our|the) webinar|chance to win|win up to|enter (?:the )?(?:draw|giveaway)|giveaway|sweepstakes|prize draw|limited.time offer|exclusive offer|promotional offer|special promotion|paid in rewards|in rewards (?:last|this)|million(?:s)? (?:in|of) rewards|claim your bonus|invite friends|refer (?:a |your )?friend|cashback campaign|cashback promotion)\b|\b\$?[0-9]+(?:\.[0-9]+)?[mb]\+?\s+paid in rewards\b/i.test(subject);
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
  // An activation charge explicitly reported as processed is an expense
  // candidate, while account activation alone does not prove a payment.
  if(/activation fee(?: of|:)?[\s\S]{0,60}(?:processed|charged|paid)/.test(s))return 'activation_fee_processed';
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
function financePaymentSubject_(subject){
 // Strict financial evidence; no market/news/education/marketing/account-size
 // messages. An "order confirmation" on its own is not a settled charge.
 if(/news alerts?|market recap|market update|trading week ahead|webinar|newsletter|breaking news|economic calendar|market impact|trade ideas|trading psychology|market outlook|volatility|upcoming releases|weekly outlook/i.test(subject))return false;
 if(/order confirmation|order placed|account passed|login credentials|account agreement|challenge.*violation|account breached/i.test(subject))return false;
 // Topstep order email contains a real charged-card receipt, unlike FTMO's unpaid order confirmation.
 if(/order confirmed\. your trading combine is ready/i.test(subject))return true;
 return /receipt|payment|paid|charged|charge|fee refund|refund|invoice|billing|subscription|activation fee|express funded account (?:is )?activated|google play order|withdrawal|deposit|transfer|transaction|payout|funds credited/i.test(subject);
}
function recordFrom_(message){
 const subject=extractHeader_(message,'subject').slice(0,180);
 // Short-circuit before decoding HTML bodies and their embedded market figures.
 if(nonFinancialHeadline_(subject)||!financePaymentSubject_(subject))return null;
 const sender=extractHeader_(message,'from');
 // Owner request: exclude Karim expenses from the evidence feed.
 if(/\bkarim\b/i.test(sender+' '+subject))return null;
 const text=financialText_(message);
 const provider=providerFor_(sender,subject,text);
 if(!provider||!['FTMO','Topstep'].includes(provider[0]))return null;
 let status=statusFor_(subject,text);
 if(provider[0]==='Topstep'&&/order confirmed\. your trading combine is ready/i.test(subject)&&
    /you have successfully been charged\s*\$\s*[\d,.]+/i.test(text))status='payment_confirmed';
 if(!status)return null;
 // "needs_review" is not a confirmation. Retain only financial-status events
 // that may contain actual paid/received/settled transaction evidence.
 if(!['payment_confirmed','activation_fee_processed','refund_issued','withdrawal_confirmed',
       'transfer_confirmed','deposit_confirmed','payout_approved','payout_processing'].includes(status))return null;
 const m=moneyFor_(subject,text);
 // Prefer the actual one-time charged amount over future recurring subscription
 // amounts or trading account balances in the same Topstep email.
 if(provider[0]==='Topstep'&&/order confirmed\. your trading combine is ready/i.test(subject)){
  const paid=text.match(/you have successfully been charged\s*\$\s*([\d,]+(?:\.\d{1,2})?)/i);
  if(paid){m.amount=paid[1].replace(/,/g,'');m.currency='USD'}
 }
 const date=Utilities.formatDate(new Date(Number(message.internalDate)),'Etc/UTC','yyyy-MM-dd');
 return {
   source_id:'gmail:'+message.id,date,provider:provider[0],
   description:subject.slice(0,180),amount:m.amount,currency:m.currency,
   category:provider[1],status,reference:'gmail:'+message.id
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
  // Mirror the same source IDs into the private review sheet; a Sheet failure
  // never changes what the signed Gmail receipt ingestion already accepted.
  try{mirrorFinanceEvidenceSheet_(candidates)}catch(err){console.warn('Sheet staging needs attention: '+String(err).slice(0,160))}
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
  if(store.getProperty('FINANCE_ALLMAIL_STARTED')&&store.getProperty('FINANCE_ALLMAIL_COMPLETE')!=='1'){
   console.log('Full Gmail scan has priority. Historical keyword import postponed, cursor preserved.');
   return;
  }
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
  // Publish only rows explicitly approved in Google Sheet; independent of Gmail quota.
  try{pushApprovedFinanceSheet_()}catch(err){console.warn('Approved Sheet sync pending: '+String(err).slice(0,160))}
  // While full-history scanning, do not run a second Gmail reader against
  // the same account and compete for quota. Approved Sheet rows still sync.
  if(store.getProperty('FINANCE_ALLMAIL_STARTED')&&store.getProperty('FINANCE_ALLMAIL_COMPLETE')!=='1'){
   console.log('Full mailbox backfill owns Gmail reads; legacy incremental sync paused.');return;
  }
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


// Optional human-readable review layer for the Finance Hub pipeline.
// Set FINANCE_SHEET_ID in Apps Script Properties; never put the ID or any
// credentials in this public repository. Uses only metadata already parsed.
function financeReviewSheet_(){
 const id=PropertiesService.getScriptProperties().getProperty('FINANCE_SHEET_ID');
 if(!id)return null;
 const tab=SpreadsheetApp.openById(id).getSheetByName('Source Inbox');
 if(!tab)throw Error('Missing Source Inbox tab');
 return tab;
}
function mirrorFinanceEvidenceSheet_(records){
 const tab=financeReviewSheet_();if(!tab||!records.length)return;
 const count=Math.max(0,tab.getLastRow()-1);
 const old=count?tab.getRange(2,1,count,11).getValues():[];
 const byId=new Map();
 for(let i=0;i<old.length;i++)if(old[i][7])byId.set(String(old[i][7]).toLowerCase(),i);
 const added=[];let enriched=0;
 for(const r of records){
  if(!r?.source_id||!['FTMO','Topstep'].includes(String(r.provider)))continue;
  const id=String(r.source_id).toLowerCase(),ix=byId.get(id);
  if(ix!==undefined){
   // Never overwrite owner edits or silently change a previously approved row.
   if(!old[ix][3]&&r.amount&&String(old[ix][8])==='Review'){
    tab.getRange(ix+2,4,1,2).setValues([[Number(r.amount),String(r.currency||'')]]);
    enriched++;
   }
   continue;
  }
  const pending=/payout_approved|payout_processing|authorization_only|order_confirmed|needs_review/.test(String(r.status));
  const direction=pending?'Unknown':/refund_issued/.test(String(r.status))?'Refund / review':
   /deposit_confirmed|transfer_confirmed|withdrawal_confirmed/.test(String(r.status))?'Transfer / review':
   'Expense candidate';
  const review=pending?'Blocked':'Review';
  const amount=r.amount&&Number.isFinite(Number(r.amount))?Number(r.amount):'';
  const line=[r.date,r.provider,r.description,amount,r.currency||'',direction,r.status,id,review,r.category||'Other','Auto-captured; verify payment total, date, direction and duplicate before Approved'];
  added.push(line);byId.set(id,old.length+added.length-1);
 }
 if(added.length)tab.getRange(tab.getLastRow()+1,1,added.length,11).setValues(added);
 console.log('Sheet staging: new='+added.length+' enriched='+enriched+'; no automatic approval');
}


// Review-gated one-way bridge: Source Inbox -> Finance Hub ledger.
// No row moves to the website until its Review State is exactly "Approved".
// The spreadsheet ID lives in Script Properties, not in source control.
function pushApprovedFinanceSheet_(){
 const sheetId=PropertiesService.getScriptProperties().getProperty('FINANCE_SHEET_ID');
 if(!sheetId)throw Error('Missing FINANCE_SHEET_ID script property');
 const sheet=SpreadsheetApp.openById(sheetId).getSheetByName('Approved Ledger');
 if(!sheet)throw Error('Missing Approved Ledger tab');
 if(!sheet||sheet.getLastRow()<=1)return;
 const count=sheet.getLastRow()-1,rows=sheet.getRange(2,1,count,11).getDisplayValues();
 const approved=[];
 for(const row of rows){
  if(String(row[8]).trim()!=='Approved'||!['FTMO','Topstep','Apex Trader Funding'].includes(String(row[1]).trim()))continue;
  const amount=String(row[3]).replace(/,/g,'').trim();
  const date=String(row[0]).trim();
  if(!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(date)||!amount)continue;
  approved.push({date,provider:String(row[1]),description:String(row[2]),
   amount:Number(amount),currency:String(row[4]).toUpperCase(),direction:String(row[5]),
   payment_status:String(row[6]),source_id:String(row[7]).toLowerCase(),
   review_state:'Approved',category:String(row[9]),notes:String(row[10])});
 }
 if(!approved.length){console.log('Sheet approved ledger is empty; no accounting changes.');return}
 const config=config_();
 const endpoint='https://fin-kac.pages.dev/api/finance-sheet-sync';
 let accepted=0,duplicates=0,held=0,imported=0;
 for(let i=0;i<approved.length;i+=50){
  const data=JSON.stringify({records:approved.slice(i,i+50)});
  const stamp=String(Date.now());
  const signature=Utilities.computeHmacSha256Signature(stamp+'\n'+data,config.FINANCE_SYNC_SECRET,Utilities.Charset.UTF_8)
   .map(x=>(x<0?x+256:x).toString(16).padStart(2,'0')).join('');
  const response=UrlFetchApp.fetch(endpoint,{method:'post',contentType:'application/json; charset=UTF-8',
   payload:Utilities.newBlob(data,'application/json').getBytes(),muteHttpExceptions:true,
   headers:{'x-finance-timestamp':stamp,'x-finance-signature':signature,
    'CF-Access-Client-Id':config.FINANCE_ACCESS_CLIENT_ID,
    'CF-Access-Client-Secret':config.FINANCE_ACCESS_CLIENT_SECRET}});
  if(response.getResponseCode()!==200)throw Error('Sheet sync HTTP '+response.getResponseCode()+': '+response.getContentText().slice(0,150));
  const result=JSON.parse(response.getContentText());
  if(![result.imported,result.duplicates,result.held].every(x=>Number.isSafeInteger(x)&&x>=0))
   throw Error('Sheet sync returned invalid reconciliation');
  accepted+=Math.min(50,approved.length-i);imported+=result.imported;duplicates+=result.duplicates;held+=result.held;
 }
 console.log('Approved Sheet -> Finance Hub: sent='+accepted+' imported='+imported+' duplicate='+duplicates+' held='+held);
}


/**
 * COMPLETE MAILBOX AUDIT
 *
 * Scans Gmail's entire mailbox, page by page, including archived, Sent, Spam
 * and Trash messages for coverage. Spam/Trash are inspected but never staged
 * as payable evidence. Only financial candidates are placed in Source Inbox.
 *
 * This has a separate cursor and trigger from the legacy finance-keyword
 * importer. Every successfully staged page is checkpointed. Any Gmail or
 * Sheets failure leaves the current page available for retry. When all pages
 * have been visited, only the temporary full-scan trigger is removed.
 */
const FINANCE_ALLMAIL_PAGE_SIZE_ = 10;
const FINANCE_ALLMAIL_PAGES_PER_RUN_ = 1;
const FINANCE_ALLMAIL_LIMIT_MS_ = 190000;
const FINANCE_ALLMAIL_TRIGGER_ = 'continueFullMailboxScan';

// Back off longer than the short-term burst quota window and expose the
// next attempt on the review Sheet. The cursor and approved accounting stay safe.
function pauseFullMailboxQuota_(store,err){
 const n=Number(store.getProperty('FINANCE_ALLMAIL_QUOTA_PAUSES')||0)+1;
 const minutes=Math.min(240,Math.max(15,15*Math.pow(2,Math.min(n-1,4))));
 const resume=Date.now()+minutes*60000;
 store.setProperty('FINANCE_ALLMAIL_QUOTA_PAUSES',String(n));
 store.setProperty('FINANCE_ALLMAIL_COOLDOWN',String(resume));
 store.setProperty('FINANCE_ALLMAIL_LAST_ERROR',String(err).slice(0,200));
 console.warn('Gmail quota pause '+n+'; next automatic attempt '+new Date(resume).toISOString()+'; saved cursor unchanged.');
 fullMailboxScanStatusSheet_(fullMailboxScanState_());
}
function fullMailboxScanState_() {
 const p=PropertiesService.getScriptProperties();
 const asNumber=k=>Number(p.getProperty(k)||0);
 const resume=Number(p.getProperty('FINANCE_ALLMAIL_COOLDOWN')||0);
 return {
  nextRetry:resume>Date.now()?new Date(resume).toISOString():'',
  quotaPauses:asNumber('FINANCE_ALLMAIL_QUOTA_PAUSES'),
  lastError:p.getProperty('FINANCE_ALLMAIL_LAST_ERROR')||'',
  status:p.getProperty('FINANCE_ALLMAIL_COMPLETE')==='1'?'Complete':
   p.getProperty('FINANCE_ALLMAIL_COOLDOWN')&&Number(p.getProperty('FINANCE_ALLMAIL_COOLDOWN'))>Date.now()?'Paused: Gmail quota':'Scanning',
  scanned:asNumber('FINANCE_ALLMAIL_SCANNED'),
  financial:asNumber('FINANCE_ALLMAIL_FINANCIAL'),
  excluded:asNumber('FINANCE_ALLMAIL_EXCLUDED'),
  pages:asNumber('FINANCE_ALLMAIL_PAGES'),
  estimate:asNumber('FINANCE_ALLMAIL_ESTIMATE'),
  started:p.getProperty('FINANCE_ALLMAIL_STARTED')||'',
  updated:p.getProperty('FINANCE_ALLMAIL_UPDATED')||'',
  completed:p.getProperty('FINANCE_ALLMAIL_FINISHED')||''
 };
}
function fullMailboxScanStatusSheet_(state){
 const fileId=PropertiesService.getScriptProperties().getProperty('FINANCE_SHEET_ID');
 if(!fileId)throw Error('Set FINANCE_SHEET_ID in private Script Properties first');
 const book=SpreadsheetApp.openById(fileId);
 const tab=book.getSheetByName('Scan Progress')||book.insertSheet('Scan Progress');
 const rows=[
  ['Full Gmail mailbox audit','Value'],
  ['State',state.status],
  ['Emails checked',state.scanned],
  ['Financial candidates',state.financial],
  ['Other/unsafe messages skipped',state.excluded],
  ['Pages completed',state.pages],
  ['Gmail estimated mailbox count',state.estimate],
  ['Started (UTC)',state.started],
  ['Last successful page (UTC)',state.updated],
  ['Completed (UTC)',state.completed],
  ['Next automatic retry (UTC)',state.nextRetry||'Not paused'],
  ['Gmail quota pauses',state.quotaPauses],
  ['Last warning',state.lastError],
  ['Scope','All Gmail messages, including archived/Sent/Spam/Trash; unsafe messages are excluded from financial staging'],
  ['Accounting','Only manually Approved rows can be sent to Finance Hub']
 ];
 tab.getRange(1,1,rows.length,2).setValues(rows);
 tab.setFrozenRows(1);
 tab.setColumnWidth(1,260);
 tab.setColumnWidth(2,620);
}
function stopFullMailboxScanTrigger_(){
 for(const trigger of ScriptApp.getProjectTriggers())
  if(trigger.getHandlerFunction()===FINANCE_ALLMAIL_TRIGGER_)ScriptApp.deleteTrigger(trigger);
}
function startFullMailboxScan(){
 const store=PropertiesService.getScriptProperties();
 if(!financeReviewSheet_())throw Error('Set FINANCE_SHEET_ID before starting the full scan');
 if(store.getProperty('FINANCE_ALLMAIL_COMPLETE')==='1'){
  fullMailboxScanStatusSheet_(fullMailboxScanState_());
  console.log('Full historical mailbox already scanned. Use restartFullMailboxScan only to deliberately rescan.');
  return;
 }
 if(!store.getProperty('FINANCE_ALLMAIL_STARTED'))
  store.setProperty('FINANCE_ALLMAIL_STARTED',new Date().toISOString());
 const installed=ScriptApp.getProjectTriggers().some(x=>x.getHandlerFunction()===FINANCE_ALLMAIL_TRIGGER_);
 if(!installed)ScriptApp.newTrigger(FINANCE_ALLMAIL_TRIGGER_).timeBased().everyMinutes(5).create();
 fullMailboxScanStatusSheet_(fullMailboxScanState_());
 continueFullMailboxScan();
}
function continueFullMailboxScan(){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(1000)){console.log('Another Gmail finance scan is active; retry by trigger');return}
 try{
  const store=PropertiesService.getScriptProperties();
  if(store.getProperty('FINANCE_ALLMAIL_COMPLETE')==='1'){
   stopFullMailboxScanTrigger_();
   fullMailboxScanStatusSheet_(fullMailboxScanState_());
   return;
  }
  const until=Number(store.getProperty('FINANCE_ALLMAIL_COOLDOWN')||0);
  if(until>Date.now()){
   console.log('Full mailbox scan quota cooldown; resume automatically after '+new Date(until).toISOString());
   fullMailboxScanStatusSheet_(fullMailboxScanState_());return;
  }
  if(!financeReviewSheet_())throw Error('Private review Sheet is not connected');
  const deadline=Date.now()+FINANCE_ALLMAIL_LIMIT_MS_;
  for(let pageNo=0;pageNo<FINANCE_ALLMAIL_PAGES_PER_RUN_&&Date.now()<deadline;pageNo++){
   const cursor=store.getProperty('FINANCE_ALLMAIL_CURSOR')||'';
   let page;
   try{
    page=Gmail.Users.Messages.list('me',{
     maxResults:FINANCE_ALLMAIL_PAGE_SIZE_,
     includeSpamTrash:true,
     pageToken:cursor||undefined
    });
   }catch(err){
    if(gmailQuotaError_(err)){
     pauseFullMailboxQuota_(store,err);break;
    }
    if(cursor&&/page.?token|invalid argument/i.test(String(err))){
     store.deleteProperty('FINANCE_ALLMAIL_CURSOR');
     store.setProperty('FINANCE_ALLMAIL_SCANNED','0');
     store.setProperty('FINANCE_ALLMAIL_FINANCIAL','0');
     store.setProperty('FINANCE_ALLMAIL_EXCLUDED','0');
     store.setProperty('FINANCE_ALLMAIL_PAGES','0');
     console.warn('Gmail page cursor expired; restart from newest with Sheet source-ID deduplication');
     break;
    }
    throw err;
   }
   const messages=page.messages||[],candidates=[];
   let checked=0,excluded=0;
   try{
    for(const item of messages){
     let message;
     try{message=Gmail.Users.Messages.get('me',item.id,{format:'full'})}
     catch(err){
      if(/(?:404|not found)/i.test(String(err))){checked++;excluded++;continue}
      throw err;
     }
     checked++;
     // Count every email for coverage, but never turn junk/deleted mail
     // into a payment candidate.
     const labels=message.labelIds||[];
     if(labels.includes('SPAM')||labels.includes('TRASH')){excluded++;continue}
     const evidence=recordFrom_(message);
     if(evidence)candidates.push(evidence);else excluded++;
    }
    // A successful page requires the Sheet to accept all candidate rows.
    // Nothing is checkpointed if this write throws.
    mirrorFinanceEvidenceSheet_(candidates);
   }catch(err){
    if(gmailQuotaError_(err)){
     pauseFullMailboxQuota_(store,err);break;
    }
    throw err;
   }
   const totals=fullMailboxScanState_(),now=new Date().toISOString();
   const next=page.nextPageToken||'';
   const properties={
    FINANCE_ALLMAIL_SCANNED:String(totals.scanned+checked),
    FINANCE_ALLMAIL_FINANCIAL:String(totals.financial+candidates.length),
    FINANCE_ALLMAIL_EXCLUDED:String(totals.excluded+excluded),
    FINANCE_ALLMAIL_PAGES:String(totals.pages+1),
    FINANCE_ALLMAIL_ESTIMATE:String(page.resultSizeEstimate||totals.estimate||0),
    FINANCE_ALLMAIL_UPDATED:now
   };
   if(next)properties.FINANCE_ALLMAIL_CURSOR=next;
   else{
    properties.FINANCE_ALLMAIL_COMPLETE='1';
    properties.FINANCE_ALLMAIL_FINISHED=now;
   }
   store.setProperties(properties,false);
   store.deleteProperty('FINANCE_ALLMAIL_LAST_ERROR');
   if(!next)store.deleteProperty('FINANCE_ALLMAIL_CURSOR');
   console.log('Full Gmail page '+(totals.pages+1)+': checked='+checked+' finance='+candidates.length+' excluded='+excluded+' next='+(next?'yes':'no'));
   fullMailboxScanStatusSheet_(fullMailboxScanState_());
   if(!next){stopFullMailboxScanTrigger_();console.log('Full Gmail historical mailbox scan COMPLETE');break}
  }
 }finally{lock.releaseLock()}
}
/** Deliberate rescan; earlier evidence, manual reviews and ledger remain intact. */
function restartFullMailboxScan(){
 const p=PropertiesService.getScriptProperties();
 for(const name of ['FINANCE_ALLMAIL_CURSOR','FINANCE_ALLMAIL_COMPLETE',
  'FINANCE_ALLMAIL_FINISHED','FINANCE_ALLMAIL_SCANNED',
  'FINANCE_ALLMAIL_FINANCIAL','FINANCE_ALLMAIL_EXCLUDED',
  'FINANCE_ALLMAIL_PAGES','FINANCE_ALLMAIL_ESTIMATE',
  'FINANCE_ALLMAIL_COOLDOWN','FINANCE_ALLMAIL_QUOTA_PAUSES',
  'FINANCE_ALLMAIL_LAST_ERROR','FINANCE_ALLMAIL_STARTED',
  'FINANCE_ALLMAIL_UPDATED'])p.deleteProperty(name);
 startFullMailboxScan();
}
/** Stop historical scanning only; the regular 15-minute finance sync is unchanged. */
function stopFullMailboxScan(){
 stopFullMailboxScanTrigger_();
 fullMailboxScanStatusSheet_({...fullMailboxScanState_(),status:'Stopped manually'});
}

/** Manual one-click import of approved Finance Hub ledger transactions. */
function runApexFinanceImport(){
 pushApprovedFinanceSheet_();
}

/**
 * One-time quota recovery: pause Gmail polling and schedule approved-ledger
 * import retry. Does not delete transaction data or existing script properties.
 * Install by running scheduleApexImportAfterQuotaReset once.
 */
function scheduleApexImportAfterQuotaReset(){
 const p=PropertiesService.getScriptProperties();
 const existing=ScriptApp.getProjectTriggers();
 const paused=[];
 for(const trigger of existing){
  const fn=trigger.getHandlerFunction();
  if(['syncGmailFinance','importGmailHistoryNow','continueFullMailboxScan'].includes(fn)){
   paused.push(fn);
   ScriptApp.deleteTrigger(trigger);
  }
  if(fn==='retryApexFinanceImport')ScriptApp.deleteTrigger(trigger);
 }
 p.setProperty('APEX_PAUSED_FINANCE_TRIGGERS',JSON.stringify([...new Set(paused)]));
 ScriptApp.newTrigger('retryApexFinanceImport').timeBased().after(26*60*60*1000).create();
 console.log('Scheduled Apex ledger import retry after 26 hours; paused Gmail triggers: '+paused.join(', '));
}
function retryApexFinanceImport(){
 try{
  pushApprovedFinanceSheet_();
 }catch(err){
  if(/Service invoked too many times for one day: urlfetch/i.test(String(err))){
   console.warn('UrlFetch daily quota still exhausted; retry in 12 hours.');
   for(const t of ScriptApp.getProjectTriggers())if(t.getHandlerFunction()==='retryApexFinanceImport')ScriptApp.deleteTrigger(t);
   ScriptApp.newTrigger('retryApexFinanceImport').timeBased().after(12*60*60*1000).create();
   return;
  }
  throw err;
 }
 for(const t of ScriptApp.getProjectTriggers())if(t.getHandlerFunction()==='retryApexFinanceImport')ScriptApp.deleteTrigger(t);
 const p=PropertiesService.getScriptProperties();
 const paused=JSON.parse(p.getProperty('APEX_PAUSED_FINANCE_TRIGGERS')||'[]');
 const active=new Set(ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction()));
 for(const fn of paused){
  if(active.has(fn))continue;
  if(fn==='syncGmailFinance')ScriptApp.newTrigger(fn).timeBased().everyMinutes(15).create();
  else ScriptApp.newTrigger(fn).timeBased().everyMinutes(5).create();
 }
 p.deleteProperty('APEX_PAUSED_FINANCE_TRIGGERS');
 console.log('Apex import completed; restored paused Gmail triggers: '+paused.join(', '));
}
