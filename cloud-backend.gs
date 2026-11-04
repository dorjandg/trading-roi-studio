/**
 * 4Ds Trading Studio — cloud storage backend (Google Apps Script).
 * Deploy as a Web App: Execute as ME; access ANYONE.
 * This is intentionally passwordless: ANYONE with the website URL / web-app endpoint
 * can read and edit the profiles of Doen, Dori, Dona and Dion.
 * Do NOT store credentials, broker account numbers, medical details, or other secrets.
 * Profiles are saved as four JSON files in the script owner's Google Drive.
 */
const DS_USERS = Object.freeze(['doen','dori','dona','dion']);
const DS_FOLDER = '4Ds Trading Studio Cloud Data';
const DS_MAX_BYTES = 900000;

function dsUser_(name) {
  const user = String(name || '').toLowerCase();
  if (DS_USERS.indexOf(user) < 0) throw new Error('Invalid 4Ds user');
  return user;
}
function dsFolder_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('4ds-folder-id');
  if (id) { try { return DriveApp.getFolderById(id); } catch (_) {} }
  const folder = DriveApp.createFolder(DS_FOLDER);
  props.setProperty('4ds-folder-id', folder.getId());
  return folder;
}
function dsFile_(user, create) {
  const props = PropertiesService.getScriptProperties(), key = '4ds-file:'+user;
  const id = props.getProperty(key);
  if (id) { try { return DriveApp.getFileById(id); } catch (_) {} }
  if (!create) return null;
  const f = dsFolder_().createFile('4ds-'+user+'.json','{}',MimeType.PLAIN_TEXT);
  props.setProperty(key,f.getId());
  return f;
}
function dsRead_(user) {
  const f=dsFile_(user,false);
  if (!f) return {revision:null,snapshot:null};
  try {
    const data=JSON.parse(f.getBlob().getDataAsString('UTF-8'));
    if(data&&data.schema==='4ds-cloud-v1'&&data.user===user)
      return {revision:data.revision||null,snapshot:data.snapshot||null};
  }catch(_){}
  return {revision:null,snapshot:null};
}
function dsResponse_(obj, callback) {
  const name=String(callback||'');
  if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,70}$/.test(name)) throw new Error('Invalid JSONP callback');
  return ContentService.createTextOutput(name+'('+JSON.stringify(obj).replace(/</g,'\\u003c').replace(/\u2028|\u2029/g,' ')+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function doGet(e) {
  let out;
  try {
    const user=dsUser_(e.parameter.user);
    out={ok:true,user,...dsRead_(user)};
  }catch(err){out={ok:false,error:String(err.message||err)};}
  return dsResponse_(out,e.parameter.callback);
}
function doPost(e) {
  const lock=LockService.getScriptLock();
  try{
    lock.waitLock(20000);
    const user=dsUser_(e.parameter.user);
    const raw=String(e.parameter.snapshot||'');
    if(!raw||raw.length>DS_MAX_BYTES)throw new Error('Invalid or excessive payload');
    const snapshot=JSON.parse(raw);
    if(!snapshot||snapshot.schema!=='4ds-profile-export-v1'||snapshot.user!==user||!snapshot.entries||typeof snapshot.entries!=='object')throw new Error('Invalid snapshot');
    if(Object.keys(snapshot.entries).length>500)throw new Error('Too many entries');
    for (const [key,value] of Object.entries(snapshot.entries)){
      if(!key.startsWith('4ds:v1:'+user+':')||typeof value!=='string'||value.length>DS_MAX_BYTES)throw new Error('Invalid entry');
    }
    const current=dsRead_(user);
    const expected=String(e.parameter.expectedRevision||'');
    if(current.revision&&current.revision!==expected&&e.parameter.force!=='yes')
      return ContentService.createTextOutput(JSON.stringify({ok:false,error:'revision_conflict',revision:current.revision})).setMimeType(ContentService.MimeType.JSON);
    const revision=Utilities.getUuid();
    const file=dsFile_(user,true);
    file.setContent(JSON.stringify({schema:'4ds-cloud-v1',user,revision,snapshot,updatedAt:new Date().toISOString()}));
    return ContentService.createTextOutput(JSON.stringify({ok:true,revision})).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(err.message||err)})).setMimeType(ContentService.MimeType.JSON);
  }finally{try{lock.releaseLock()}catch(_){}}
}
