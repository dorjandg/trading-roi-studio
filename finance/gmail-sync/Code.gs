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
function plainParts_(part,found){
  if(!part)return;
  if(part.mimeType==='text/plain'&&part.body?.data) {
    try{found.push(Utilities.newBlob(Utilities.base64DecodeWebSafe(part.body.data)).getDataAsString('UTF-8'))}catch(e){}
  }
  for(const child of part.parts||[])plainParts_(child,found);
}
function financialText_(msg){
  const parts=[];plainParts_(msg.payload,parts);
  let text=parts.join('\n');
  if(!text && msg.payload?.body?.data){
    try{text=Utilities.newBlob(Utilities.base64DecodeWebSafe(msg.payload.body.data)).getDataAsString('UTF-8')}catch(e){}
  }
  return text.replace(/<[^>]*>/g,' ').replace(/https?:\/\/\S+/g,' ').replace(/\s+/g,' ').slice(0,12000);
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
  const s=(subject+' '+text).slice(0,4500);
  const patterns=[
    /(?:payment of|amount of|total amount paid|deposit of|deposit request for|payment amount:|total:|amount:)\s*(?:USD|EUR|AED|GBP|USDT)?\s*(?:\$|€|£)?\s*([\d,]+(?:\.\d{1,8})?)\s*(USD|EUR|AED|GBP|USDT|USDC|BTC|ETH)?/i,
    /(?:USD|EUR|AED|GBP|USDT|USDC)\s*([\d,]+(?:\.\d{1,8})?)/i
  ];
  for(const p of patterns){const m=s.match(p);if(m){
    const amount=m[1].replace(/,/g,'');if(!/^\d+(?:\.\d{1,8})?$/.test(amount))continue;
    const currency=(m[2]||s.match(/\b(?:USDT|USDC|USD|EUR|AED|GBP)\b|\$/i)?.[0]||'').toUpperCase().replace('$','USD');
    if(currency)return {amount,currency};
  }}
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
 * Manual historical catch-up. Runs for up to ~3 minutes or 60 pages (up to
 * 1,200 Gmail candidates), whichever occurs first. Retains progress in Script
 * Properties and safely skips duplicate Gmail IDs in D1. Can be run repeatedly.
 * The existing 15-minute trigger remains unchanged.
 */
function importGmailHistoryNow(){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)){console.log('Another Gmail import is active; no duplicate worker started.');return;}
  try{
    const config=config_(),store=PropertiesService.getScriptProperties();
    if(gmailCoolingDown_(store))return;
    const version='finance-search-20261120-v2';
    if(store.getProperty('FINANCE_QUERY_VERSION')!==version){
      store.deleteProperty('FINANCE_BACKFILL_DONE');
      store.deleteProperty('FINANCE_BACKFILL_PAGE_TOKEN');
      store.deleteProperty('FINANCE_RECENT_PAGE_TOKEN');
      store.setProperty('FINANCE_QUERY_VERSION',version);
      console.log('Expanded financial Gmail search started from newest; existing records are deduplicated.');
    }
    const deadline=Date.now()+160000;
    let pages=0,accepted=0,inserted=0,duplicates=0,done=store.getProperty('FINANCE_BACKFILL_DONE')==='1',rateLimited=false;
    while(!done&&pages<8&&Date.now()<deadline){
      const token=store.getProperty('FINANCE_BACKFILL_PAGE_TOKEN')||'';
      let page;
      try{page=syncPage_(FINANCE_QUERY,token,config)}
      catch(err){
        if(gmailQuotaError_(err)){pauseGmailQuota_(store,err);rateLimited=true;break;}
        if(token&&/page.?token|invalid argument/i.test(String(err))){
          store.deleteProperty('FINANCE_BACKFILL_PAGE_TOKEN');
          throw Error('Gmail page cursor expired. Next run restarts safely with deduplication. '+err.message);
        }
        throw err;
      }
      accepted+=page.result.accepted;inserted+=page.result.inserted;duplicates+=page.result.duplicates;
      pages++;
      if(page.pageToken)store.setProperty('FINANCE_BACKFILL_PAGE_TOKEN',page.pageToken);
      else{
        store.deleteProperty('FINANCE_BACKFILL_PAGE_TOKEN');
        store.setProperty('FINANCE_BACKFILL_DONE','1');
        done=true;
      }
      if(!done&&pages<8&&Date.now()+12000<deadline)Utilities.sleep(12000);
    }
    console.log('Historical catch-up: pages='+pages+' accepted='+accepted+' inserted='+inserted+' duplicates='+duplicates+' complete='+done+' rateLimited='+rateLimited+'. '+(done?'The financial search backfill reached its end.':'Run importGmailHistoryNow again for the next pages.'));
  }finally{lock.releaseLock()}
}
/** One cycle: recent changes plus bounded historical pages. Idempotent in D1 by message ID. */
function syncGmailFinance(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try{
    const config=config_(),store=PropertiesService.getScriptProperties();
    if(gmailCoolingDown_(store))return;
    const recent='after:'+Utilities.formatDate(new Date(Date.now()-FINANCE_RECHECK_DAYS*86400000),'Etc/UTC','yyyy/MM/dd')+' '+FINANCE_QUERY;
    const recentToken=store.getProperty('FINANCE_RECENT_PAGE_TOKEN')||'';
    let recentResult;
    try{recentResult=syncPage_(recent,recentToken,config)}
    catch(err){
      if(gmailQuotaError_(err)){pauseGmailQuota_(store,err);return;}
      // Gmail page tokens may become invalid if the mailbox has shifted.
      // Retry the newest page on the next trigger rather than losing coverage.
      if(recentToken){store.deleteProperty('FINANCE_RECENT_PAGE_TOKEN');throw Error('Recent paging cursor expired; restart next run: '+err.message)}
      throw err;
    }
    console.log('Recent Gmail evidence: '+JSON.stringify(recentResult.result));
    if(recentResult.pageToken)store.setProperty('FINANCE_RECENT_PAGE_TOKEN',recentResult.pageToken);
    else store.deleteProperty('FINANCE_RECENT_PAGE_TOKEN');
    // Bound scheduled history scans to avoid consuming Gmail API user quota.
    const historicalDeadline=Date.now()+60000;
    for(let pageIndex=0;pageIndex<2&&Date.now()<historicalDeadline&&store.getProperty('FINANCE_BACKFILL_DONE')!=='1';pageIndex++){
      const oldToken=store.getProperty('FINANCE_BACKFILL_PAGE_TOKEN')||'';
      let historic;
      try{historic=syncPage_(FINANCE_QUERY,oldToken,config)}
      catch(err){
        if(gmailQuotaError_(err)){pauseGmailQuota_(store,err);return;}
        if(oldToken&&/page.?token|invalid argument/i.test(String(err)))store.deleteProperty('FINANCE_BACKFILL_PAGE_TOKEN');
        throw Error('Historical backfill page retry needed: '+err.message);
      }
      if(historic.pageToken)store.setProperty('FINANCE_BACKFILL_PAGE_TOKEN',historic.pageToken);
      else{store.deleteProperty('FINANCE_BACKFILL_PAGE_TOKEN');store.setProperty('FINANCE_BACKFILL_DONE','1')}
      console.log('Historical Gmail evidence page '+(pageIndex+1)+': '+JSON.stringify(historic.result));
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
