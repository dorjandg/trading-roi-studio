/*
 * 4Ds cloud-first startup.
 * Hydrate an untouched/new device before the calculator and rule iframe load.
 * Never overwrite profiles with unsynced local work or an unknown local history.
 */
(()=>{
 'use strict';
 const endpoint=String(window.FOUR_DS_CLOUD_ENDPOINT||'').trim();
 const valid=/^https:\/\/script\.google\.com\/macros\/s\/[^/?]+\/exec(?:\?.*)?$/.test(endpoint);
 const users=['doen','dori','dona','dion'];
 let user='dori';
 try{const v=localStorage.getItem('4ds:active-user:v1');if(users.includes(v))user=v}catch(_){}
 const prefix='4ds:v1:'+user+':';
 const revKey='4ds:cloud:last-revision:'+user;
 const dirtyKey='4ds:cloud:unsynced:'+user;
 const result=window.FOUR_DS_BOOTSTRAP_INFO={user,status:'starting'};
 function localKeys(){const out=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(prefix))out.push(key)}return out}
 function accept(snap){
  if(!snap||snap.schema!=='4ds-profile-export-v1'||snap.user!==user||!snap.entries||typeof snap.entries!=='object'||Array.isArray(snap.entries))return false;
  const entries=Object.entries(snap.entries);
  if(entries.length>500)return false;
  for(const [key,value] of entries)if(!key.startsWith(prefix)||typeof value!=='string')return false;
  const json=JSON.stringify(snap);
  if(json.length>1000000)return false;
  // All fields validated before modifying the device's saved settings.
  for(const key of localKeys())localStorage.removeItem(key);
  for(const [key,value] of entries)localStorage.setItem(key,value);
  return true;
 }
 window.FOUR_DS_BOOTSTRAP=new Promise(resolve=>{
  const finish=(value)=>{result.status=value;resolve(value)};
  if(!valid){finish('not-configured');return}
  let oldRev='',hasDirty=false,hasLocal=false;
  try{oldRev=localStorage.getItem(revKey)||'';hasDirty=localStorage.getItem(dirtyKey)==='1';hasLocal=localKeys().length>0}catch(_){finish('storage-unavailable');return}
  if(hasDirty){finish('pending-local-changes');return}
  // Local history with no confirmed cloud revision must not be overwritten:
  // the user may have edited it before cloud sync was installed.
  if(hasLocal&&!oldRev){finish('unknown-local-history');return}
  const callback='fourDsBoot_'+Math.random().toString(36).slice(2);
  const script=document.createElement('script');
  let done=false;
  const timeout=setTimeout(()=>complete('cloud-timeout'),12000);
  function cleanup(){clearTimeout(timeout);try{delete window[callback]}catch(_){}script.remove()}
  function complete(value){if(done)return;done=true;cleanup();finish(value)}
  window[callback]=(data)=>{
   try{
    if(!data||data.ok!==true){complete('cloud-error');return}
    if(!data.snapshot){complete('cloud-empty');return}
    if(!data.revision||typeof data.revision!=='string'){complete('unverified-revision');return}
    if(data.revision===oldRev){complete('up-to-date');return}
    if(!accept(data.snapshot)){complete('invalid-cloud-data');return}
    localStorage.setItem(revKey,data.revision);
    localStorage.removeItem(dirtyKey);
    complete('cloud-loaded');
   }catch(_){complete('cloud-apply-failed')}
  };
  script.onerror=()=>complete('network-error');
  script.src=endpoint+(endpoint.includes('?')?'&':'?')+new URLSearchParams({user,callback,t:String(Date.now())});
  document.head.appendChild(script);
 });
})();
