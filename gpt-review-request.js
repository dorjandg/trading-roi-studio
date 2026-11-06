/* Queue a manual GPT research request in the selected 4Ds workspace.
   This module never starts ChatGPT, never exposes credentials and never claims execution.
   Shared cloud profiles are not authenticated; use only non-sensitive instructions. */
(function(root){
'use strict';
const button=document.getElementById('gptReviewRequestNow');
const note=document.getElementById('gptReviewNote');
const status=document.getElementById('gptReviewRequestStatus');
if(!button||!note||!status)return;
const endpoint=String(root.FOUR_DS_CLOUD_ENDPOINT||'').trim();
const configured=/^https:\/\/script\.google\.com\/macros\/s\/[^/?]+\/exec(?:\?.*)?$/.test(endpoint);
const saved=()=>{try{return localStorage.getItem('4ds:active-user:v1')}catch(_){return null}};
const user=['doen','dori','dona','dion'].includes(saved())?saved():'dori';
const key='4ds:v1:'+user+':gpt-review-requests:v1';
let busy=false;
function setStatus(message){status.textContent=message;}
function normalize(records){
 const seen=new Set();
 return (Array.isArray(records)?records:[]).filter(x=>{
  if(!x||typeof x.id!=='string'||!x.timestamp||seen.has(x.id))return false;
  seen.add(x.id);return true;
 }).sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp))).slice(0,12);
}
function readLocal(){
 try{return normalize(JSON.parse(localStorage.getItem(key)||'[]'))}catch(_){return []}
}
function readRemote(){
 return new Promise((resolve,reject)=>{
  if(!configured){reject(Error('Cloud endpoint unavailable'));return;}
  const callback='fourDsReviewRequest'+Math.random().toString(36).slice(2);
  const script=document.createElement('script');
  const timeout=setTimeout(()=>{cleanup();reject(Error('Cloud read timeout'));},14000);
  function cleanup(){clearTimeout(timeout);try{delete root[callback]}catch(_){}script.remove();}
  root[callback]=data=>{cleanup();data?.ok===true?resolve(data):reject(Error(data?.error||'Cloud read rejected'))};
  script.onerror=()=>{cleanup();reject(Error('Cloud read failed'))};
  script.src=endpoint+(endpoint.includes('?')?'&':'?')+
   new URLSearchParams({user,callback,t:Date.now()});
  document.head.append(script);
 });
}
async function send(){
 if(busy)return;
 if(!configured){setStatus('Cloud endpoint unavailable; request was not sent.');return;}
 busy=true;button.disabled=true;
 const entry={id:'review-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),
  timestamp:new Date().toISOString(),user,
  source:'portfolio-simulator-section-11',status:'requested',
  requestType:'review-latest-simulations',note:String(note.value||'').trim().slice(0,600)};
 let confirmed=false;
 try{
  for(let attempt=1;attempt<=3;attempt++){
   setStatus('Sending to cloud · attempt '+attempt+'/3…');
   const latest=await readRemote(),snapshot=latest.snapshot;
   if(snapshot&&(snapshot.schema!=='4ds-profile-export-v1'||snapshot.user!==user||
      !snapshot.entries||typeof snapshot.entries!=='object'))
    throw Error('Unexpected cloud profile format');
   let remoteQueue=[];
   try{remoteQueue=JSON.parse(snapshot?.entries?.[key]||'[]')}catch(_){}
   const queue=normalize([entry,...readLocal(),...(Array.isArray(remoteQueue)?remoteQueue:[])]);
   const nonce=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
   const candidate={schema:'4ds-profile-export-v1',user,nonce,
    entries:{...(snapshot?.entries||{}),[key]:JSON.stringify(queue)}};
   const serialized=JSON.stringify(candidate);
   if(serialized.length>850000)throw Error('Cloud profile storage cap reached; request not sent');
   const form=new URLSearchParams({user,expectedRevision:latest.revision||'',force:'no',snapshot:serialized});
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
   try{await fetch(endpoint,{method:'POST',mode:'no-cors',body:form,cache:'no-store',signal:controller.signal})}
   finally{clearTimeout(timeout)}
   const verified=await readRemote();
   let online=[];
   try{online=JSON.parse(verified.snapshot?.entries?.[key]||'[]')}catch(_){}
   if(verified.snapshot?.nonce===nonce&&Array.isArray(online)&&online.some(x=>x.id===entry.id)){
    try{localStorage.setItem(key,JSON.stringify(queue))}catch(_){}
    confirmed=true;note.value='';
    setStatus('Request saved and cloud verified · '+new Date().toLocaleTimeString()+
     '. Waiting for the next scheduled GPT review; this is not an immediate ChatGPT run.');
    break;
   }
  }
  if(!confirmed)throw Error('Cloud revision changed; retry sending');
 }catch(error){setStatus('Request NOT confirmed in cloud: '+(error?.message||String(error))+
  '. Try again; no GPT review has been started.');}
 finally{busy=false;button.disabled=false;}
}
const live=document.getElementById('gptReviewLive');
const livePrompt='Run my existing enabled Trading Studio GPT Review scheduled task now, once, without changing its daily schedule. Inspect the newest Google Drive Trading Studio Cloud Data simulation history, Section 11 GPT review request queue, Results Advisor questions and existing GitHub research reports. Investigate anomalies, test relevant issues, publish evidence-based non-personal findings to Section 11, preserve private data and do not alter my risk strategies without approval. Report what was verified, published and still needs review.';
function openLive(){
 // This is a ChatGPT handoff, not an API call, embedded model or instant execution.
 // Optional local notes are intentionally not placed in the external URL.
 const target='https://chatgpt.com/?prompt='+encodeURIComponent(livePrompt);
 const link=document.createElement('a');
 link.href=target;link.target='_blank';link.rel='noopener noreferrer';
 document.body.appendChild(link);link.click();link.remove();
 const guidance=document.getElementById('gptRequestGuidance');
 if(guidance)guidance.textContent='Live review: ChatGPT requested in a new tab. Press Send there to run the existing task once. If the draft is not prefilled, ask ChatGPT to run Trading Studio GPT Review now. The optional local note was not shared in the link. Queued requests remain available here.';
}
live?.addEventListener('click',openLive);
button.addEventListener('click',send);
setStatus(configured?'Ready to send to the selected workspace cloud profile ('+user+').':
 'Cloud endpoint unavailable; manual requests cannot be saved.');
})(typeof window!=='undefined'?window:globalThis);
