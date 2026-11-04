/* 4Ds cloud sync client.
 * Public, passwordless shared workspace: anyone can choose any user.
 * Requires cloud-config.js to specify an authorized Google Apps Script web app URL.
 */
(()=>{
 'use strict';
 const endpoint=String(window.FOUR_DS_CLOUD_ENDPOINT||'').trim();
 const users=['doen','dori','dona','dion'];
 const user=window.FOUR_DS_CURRENT_USER;
 const status=document.getElementById('cloudSyncStatus');
 const upload=document.getElementById('cloudUpload');
 const download=document.getElementById('cloudDownload');
 const valid=/^https:\/\/script\.google\.com\/macros\/s\/[^/?]+\/exec(?:\?.*)?$/.test(endpoint);
 if(!status||!users.includes(user))return;
 let ready=false,busy=false,dirty=false,timer=null,remoteRev=null,lastSnapshot=null;
 const revKey='4ds:cloud:last-revision:'+user;
 const dirtyKey='4ds:cloud:unsynced:'+user;
 const setStatus=(message)=>{status.textContent=message};
 const prefix='4ds:v1:'+user+':';
 function snapshot(){
  const entries={};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(prefix))entries[k]=localStorage.getItem(k)}
  return {schema:'4ds-profile-export-v1',user,nonce:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),entries};
 }
 function isLocalPopulated(){return Object.keys(snapshot().entries).length>0}
 function applyRemote(snap,revision){
  if(!snap||snap.schema!=='4ds-profile-export-v1'||snap.user!==user||typeof snap.entries!=='object')return false;
  for(const [k,value] of Object.entries(snap.entries)){if(!k.startsWith(prefix)||typeof value!=='string')return false;}
  const stored=Object.keys(snap.entries);
  for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith(prefix)&&!Object.prototype.hasOwnProperty.call(snap.entries,k))localStorage.removeItem(k)}
  for(const k of stored)localStorage.setItem(k,snap.entries[k]);
  localStorage.setItem(revKey,revision||'');localStorage.removeItem(dirtyKey);
  return true;
 }
 function getRemote(){
  return new Promise((resolve,reject)=>{
   const cb='fourDsCb_'+Math.random().toString(36).slice(2),el=document.createElement('script');
   const id=setTimeout(()=>{cleanup();reject(new Error('Google sync timed out'))},14000);
   function cleanup(){clearTimeout(id);delete window[cb];el.remove()}
   window[cb]=data=>{cleanup();if(data?.ok===true)resolve(data);else reject(new Error(data?.error||'Cloud returned an error'))};
   el.onerror=()=>{cleanup();reject(new Error('Cloud request failed'))};
   el.src=endpoint+(endpoint.includes('?')?'&':'?')+new URLSearchParams({user,callback:cb,t:String(Date.now())});
   document.head.appendChild(el);
  });
 }
 function markLocalChanged(){
  if(!valid)return;
  dirty=true;try{localStorage.setItem(dirtyKey,'1')}catch(_){}
  if(!ready)return;
  clearTimeout(timer);timer=setTimeout(()=>uploadNow(false),1800);
  setStatus('Local changes saved · Cloud sync pending');
 }
 async function uploadNow(force=false){
  if(!ready||busy)return;
  busy=true;clearTimeout(timer);
  try{
   const current=await getRemote();
   if(current.revision&&current.revision!==remoteRev&&!force){setStatus('Sync conflict · Cloud has newer changes. Choose Load cloud or Overwrite cloud.');return}
   const snap=snapshot();
   if(JSON.stringify(snap).length>900000)throw new Error('Profile too large; export a backup first');
   const req=new URLSearchParams({user,expectedRevision:force?'':(remoteRev||''),force:force?'yes':'no',snapshot:JSON.stringify(snap)});
   setStatus('Saving to Google cloud…');
   await fetch(endpoint,{method:'POST',mode:'no-cors',body:req,cache:'no-store'});
   await new Promise(ok=>setTimeout(ok,800));
   const check=await getRemote();
   if(check.snapshot?.nonce!==snap.nonce)throw new Error('Cloud did not confirm the save. Your local data is safe.');
   remoteRev=check.revision;localStorage.setItem(revKey,remoteRev);
   localStorage.removeItem(dirtyKey);dirty=false;setStatus('Cloud synced · '+new Date().toLocaleTimeString());
  }catch(err){setStatus('Cloud sync failed: '+err.message+' · Local copy saved')}finally{busy=false}
 }
 async function loadCloud(force=false){
  if(busy)return;busy=true;
  try{
   const data=await getRemote();
   if(!data.snapshot){setStatus('No cloud profile exists for '+user+'. Changes will create one.');remoteRev=null;return}
   if(!force&&(dirty||localStorage.getItem(dirtyKey)==='1')){setStatus('Unsynced edits on this device · Choose Load cloud to replace local changes, or Overwrite cloud.');return}
   if(!applyRemote(data.snapshot,data.revision))throw new Error('Invalid cloud profile');
   setStatus('Cloud downloaded. Refreshing…');location.reload();
  }catch(err){setStatus('Cloud load failed: '+err.message)}finally{busy=false}
 }
 upload?.addEventListener('click',()=>{
  if(!valid)return;
  if(confirm('Overwrite the selected user’s cloud profile with this device’s settings? This replaces that user’s cloud copy.'))uploadNow(true);
 });
 download?.addEventListener('click',()=>{
  if(!valid)return;
  if(confirm('Replace this device’s settings for '+user+' with the cloud copy? Unsynced local edits will be lost.')){dirty=false;loadCloud(true)}
 });
 window.fourDsQueueCloudSave=markLocalChanged;
 window.fourDsPushCloud=()=>uploadNow(false);
 if(!valid){setStatus('Local-only saving · Google cloud connection not deployed');upload.disabled=true;download.disabled=true;return}
 setStatus('Connecting to Google cloud…');
 (async()=>{
  try{
   const data=await getRemote();remoteRev=data.revision||null;
   const synced=localStorage.getItem(revKey);
   dirty=localStorage.getItem(dirtyKey)==='1';
   ready=true;
   if(data.snapshot&&data.revision!==synced){
    if(!dirty&&(!isLocalPopulated()||synced)){if(applyRemote(data.snapshot,data.revision))location.reload();else setStatus('Invalid cloud profile; local data preserved');return}
    setStatus('Cloud and this device both have profiles · Choose Load cloud or Overwrite cloud');return;
   }
   if(!data.snapshot&&isLocalPopulated()){markLocalChanged();setStatus('Local data found · Creating cloud backup…');return}
   if(dirty){markLocalChanged();return}
   setStatus('Cloud synced · '+(data.revision?'Profile loaded':'No data yet'));
  }catch(err){ready=false;setStatus('Cloud unavailable · Local saving still works: '+err.message)}
 })();
 setInterval(async()=>{
  if(!ready||busy||dirty||document.hidden)return;
  try{
   const data=await getRemote();
   if(data.revision!==remoteRev&&data.snapshot){
    if(applyRemote(data.snapshot,data.revision))location.reload();
   }
  }catch(err){setStatus('Cloud temporarily unreachable · Local settings remain saved')}
 },60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready&&!busy&&!dirty)getRemote().then(d=>{if(d.snapshot&&d.revision!==remoteRev&&applyRemote(d.snapshot,d.revision))location.reload()}).catch(()=>{})});
})();
