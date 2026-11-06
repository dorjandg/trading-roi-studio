/*
 * JJ Academy — standalone unanswered-question intake for Google Apps Script.
 * Copy to a NEW Google Apps Script project, then Deploy > Web app.
 * Run setupJjAcademy() ONCE from Apps Script editor to create PRIVATE spreadsheet.
 * Deploy execute as: Me; Access: Anyone. Never publish the spreadsheet.
 *
 * No public question listing. Public GET only verifies possession of random receipt.
 * Apps Script receives form-encoded no-cors POSTs and JSONP receipt probes.
 */
var JJ_COLS=['ID','Submitted UTC','Question','Normalized','Reason','Source matches','Status','Occurrences','Last seen UTC','GPT research notes','Proposed answer','Evidence IDs','Reviewed UTC','Published commit'];
var JJ_CAP_PER_DAY=300;
var JJ_CAP_PER_MINUTE=15;
function setupJjAcademy(){
 var props=PropertiesService.getScriptProperties();
 var id=props.getProperty('JJ_SHEET_ID');
 if(id){Logger.log('Existing private queue: https://docs.google.com/spreadsheets/d/'+id+'/edit');return id;}
 var book=SpreadsheetApp.create('JJ Academy — Private Unanswered Questions');
 var tab=book.getSheets()[0];tab.setName('Unanswered Questions');
 tab.getRange(1,1,1,JJ_COLS.length).setValues([JJ_COLS]);
 tab.setFrozenRows(1);tab.getRange(1,1,1,JJ_COLS.length).setFontWeight('bold');
 tab.setColumnWidth(3,460);tab.setColumnWidth(10,460);tab.setColumnWidth(11,460);
 // Do not share this workbook publicly. Apps Script's owner retains access.
 props.setProperty('JJ_SHEET_ID',book.getId());
 Logger.log('Private review sheet: '+book.getUrl());
 return book.getId();
}
function jjSheet_(){
 var id=PropertiesService.getScriptProperties().getProperty('JJ_SHEET_ID');
 if(!id)throw new Error('Run setupJjAcademy once first');
 return SpreadsheetApp.openById(id).getSheetByName('Unanswered Questions');
}
function jjNormalize_(s){return String(s||'').toLowerCase().replace(/\s+/g,' ').trim();}
function jjJsonp_(callback,object){
 var out=JSON.stringify(object);
 // Accept only a short JS callback identifier. Never interpolate arbitrary code.
 if(!/^[A-Za-z_$][A-Za-z0-9_$]{0,75}$/.test(String(callback||'')))
   return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Invalid callback'})).setMimeType(ContentService.MimeType.JSON);
 return ContentService.createTextOutput(callback+'('+out+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function jjHash_(text){
 var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8);
 return bytes.map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2)}).join('');
}
function jjError_(text){return ContentService.createTextOutput(JSON.stringify({ok:false,error:text})).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){
 var p=(e&&e.parameter)||{};
 try{
  if(p.action!=='submit')return jjError_('Unknown action');
  var question=String(p.question||'').trim();
  var reason=String(p.reason||'No matching course source').slice(0,150);
  var token=String(p.receipt||'');
  var n=Number(p.matchCount);
  if(question.length<8||question.length>1000||!/^[a-zA-Z0-9_-]{32,90}$/.test(token))return jjError_('Invalid question or receipt');
  if(!isFinite(n)||n<0||n>1000)return jjError_('Invalid source count');
  // Reject obvious secret strings; users must not submit personal data.
  if(/(?:password|private.?key|api.?key)\s*[:=]/i.test(question))return jjError_('Sensitive content not accepted');
  var lock=LockService.getScriptLock();if(!lock.tryLock(8000))return jjError_('Busy — retry');
  try{
   var props=PropertiesService.getScriptProperties();
   var minute=Utilities.formatDate(new Date(),'Etc/UTC','yyyyMMddHHmm');
   var day=minute.slice(0,8);
   // Best-effort global throttling; serious abuse requires a protected gateway.
   var perMinuteKey='jjm:'+minute,perDayKey='jjd:'+day;
   var perMinute=Number(props.getProperty(perMinuteKey)||0),perDay=Number(props.getProperty(perDayKey)||0);
   if(perMinute>=JJ_CAP_PER_MINUTE||perDay>=JJ_CAP_PER_DAY)return jjError_('Submission limit reached');
   var sheet=jjSheet_();
   var normalized=jjNormalize_(question),fingerprint=jjHash_(normalized);
   // Avoid scanning an unbounded sheet: a capped active window is enough.
   var last=sheet.getLastRow(),start=Math.max(2,last-1998),found=0;
   if(last>=start){
    var rows=sheet.getRange(start,1,last-start+1,4).getValues();
    for(var i=rows.length-1;i>=0;i--)if(rows[i][3]===normalized){found=start+i;break}
   }
   var now=new Date().toISOString();
   if(found){
    sheet.getRange(found,8).setValue(Number(sheet.getRange(found,8).getValue()||0)+1);
    sheet.getRange(found,9).setValue(now);
   }else{
    sheet.appendRow(['uq_'+fingerprint.slice(0,22),now,question,normalized,reason,n,'new',1,now,'','','','','']);
   }
   // Receipt tokens never go in public sheets or public URLs; verify via hash key.
   var receiptHash=jjHash_(token);
   var id='uq_'+fingerprint.slice(0,22);
   CacheService.getScriptCache().put('jjreceipt:'+receiptHash,id,21600);
   // Durable receipt with 48 h TTL via Script Properties, pruned opportunistically.
   props.setProperty('jjreceipt:'+receiptHash,id+'|'+(Date.now()+48*3600000));
   props.setProperty(perMinuteKey,String(perMinute+1));props.setProperty(perDayKey,String(perDay+1));
   return ContentService.createTextOutput(JSON.stringify({ok:true,id:id})).setMimeType(ContentService.MimeType.JSON);
  }finally{lock.releaseLock();}
 }catch(error){return jjError_('Question storage unavailable')}
}
function doGet(e){
 var p=(e&&e.parameter)||{};
 if(p.action!=='verify')return jjJsonp_(p.callback,{ok:false,error:'Only receipt verification is public'});
 var token=String(p.receipt||'');
 if(!/^[a-zA-Z0-9_-]{32,90}$/.test(token))return jjJsonp_(p.callback,{ok:false,error:'Invalid receipt'});
 var hash=jjHash_(token),cache=CacheService.getScriptCache().get('jjreceipt:'+hash);
 var saved=PropertiesService.getScriptProperties().getProperty('jjreceipt:'+hash);
 var parts=saved?String(saved).split('|'):[];
 var valid=parts.length===2&&Number(parts[1])>Date.now();
 return jjJsonp_(p.callback,valid?{ok:true,id:parts[0],status:'queued'}:{ok:false,error:'Not verified'});
}
