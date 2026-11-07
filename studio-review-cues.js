/* 4Ds Trading Studio — free GPT review cue bridge.
   Automatic submissions contain only fixed-formula diagnostic IDs, no private run contents.
   Manual question cues require an explicit click. All cloud writes are read/verify/compare. */
(function(root){'use strict';
const allowedUsers=['doen','dori','dona','dion'];
const selected=()=>{try{const u=localStorage.getItem('4ds:active-user:v1');return allowedUsers.includes(u)?u:'dori'}catch(_){return 'dori'}};
const cueKey=u=>'4ds:v1:'+u+':studio-review-cues:v1';
const reviewKey=u=>'4ds:v1:'+u+':gpt-review-requests:v1';
const endpoint=()=>String(root.FOUR_DS_CLOUD_ENDPOINT||'').trim();
const configured=()=>/^https:\/\/script\.google\.com\/macros\/s\/[^/?]+\/exec(?:\?.*)?$/.test(endpoint());
const clean=s=>String(s||'').replace(/https?:\/\/\S+/gi,'[link removed]').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email removed]').replace(/\b\d{10,}\b/g,'[number removed]').replace(/\s+/g,' ').trim().slice(0,240);
const date=()=>new Date().toISOString(),day=()=>date().slice(0,10);
function read(){try{let v=JSON.parse(localStorage.getItem(cueKey(selected()))||'[]');return Array.isArray(v)?v.filter(x=>x&&x.id&&x.kind).slice(-40):[]}catch(_){return []}}
function write(a){try{localStorage.setItem(cueKey(selected()),JSON.stringify(a.slice(-40)));root.dispatchEvent?.(new Event('studio:cues-updated'))}catch(_){}}
function announce(s){const x=document.querySelector('[data-studio-cue-status]');if(x)x.textContent=s}
function normalizeQueue(items){
 const seen=new Set();return items.filter(x=>x&&typeof x.id==='string'&&typeof x.timestamp==='string'&&!seen.has(x.id)&&(seen.add(x.id),true))
 .sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,12);
}
function readRemote(user){
 return new Promise((resolve,reject)=>{
  if(!configured())return reject(Error('Cloud endpoint unavailable'));
  const cb='studioCue'+Math.random().toString(36).slice(2),script=document.createElement('script');
  const timeout=setTimeout(()=>{finish();reject(Error('Cloud read timed out'))},14000);
  function finish(){clearTimeout(timeout);try{delete root[cb]}catch(_){}script.remove()}
  root[cb]=value=>{finish();value?.ok===true?resolve(value):reject(Error(value?.error||'Cloud read rejected'))};
  script.onerror=()=>{finish();reject(Error('Cloud read failed'))};
  script.src=endpoint()+(endpoint().includes('?')?'&':'?')+new URLSearchParams({user,callback:cb,t:Date.now()});
  document.head.appendChild(script);
 });
}
let busy=false;
async function queue({kind='manual',label='',note='',automatic=false,fingerprint='' }={}){
 const user=selected(),existing=read(),idKey=String(fingerprint||kind+':'+clean(label).toLowerCase()).slice(0,170);
 const prior=existing.find(x=>x.fingerprint===idKey&&(!automatic||x.day===day())&&['queued-cloud','verified','sending','queued','review-verified','review-published','under-review','needs-attention'].includes(x.status));
 if(prior)return {ok:['queued-cloud','verified','review-verified','review-published','under-review'].includes(prior.status),status:prior.status,duplicate:true};
 if(busy)return {ok:false,status:'busy'};
 const today=existing.filter(x=>x.day===day()&&x.automatic&&['queued-cloud','verified','sending'].includes(x.status)).length;
 if(automatic&&today>=2)return {ok:false,status:'daily-limit'};
 if(!configured())return {ok:false,status:'unavailable'};
 busy=true;
 const cue={id:'studio-cue-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),kind,label:clean(label).slice(0,100),
  fingerprint:idKey,automatic,day:day(),timestamp:date(),status:'sending'};
 write([...existing,cue]);announce('Sending review cue to cloud; awaiting verification…');
 const entry={id:cue.id,timestamp:cue.timestamp,user,source:'studio-ai-evidence-cue',status:'requested',
   requestType:automatic?'studio-ai-formula-alert':'studio-ai-question-review',
   note:clean(note).slice(0,600)};
 let success=false,reason='';
 try{
  for(let attempt=0;attempt<2&&!success;attempt++){
   const remote=await readRemote(user),snap=remote.snapshot;
   if(snap&&(snap.schema!=='4ds-profile-export-v1'||snap.user!==user||!snap.entries||typeof snap.entries!=='object'))throw Error('Cloud profile mismatch');
   let priorQueue=[];try{priorQueue=JSON.parse(snap?.entries?.[reviewKey(user)]||'[]')}catch(_){}
   let localQueue=[];try{localQueue=JSON.parse(localStorage.getItem(reviewKey(user))||'[]')}catch(_){}
   const merged=normalizeQueue([entry,...(Array.isArray(priorQueue)?priorQueue:[]),...(Array.isArray(localQueue)?localQueue:[])]);
   const nonce='cue-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
   const snapshot={schema:'4ds-profile-export-v1',user,nonce,entries:{...(snap?.entries||{}),[reviewKey(user)]:JSON.stringify(merged)}};
   const serialized=JSON.stringify(snapshot);
   if(serialized.length>850000)throw Error('Cloud profile size limit reached');
   const form=new URLSearchParams({user,expectedRevision:remote.revision||'',force:'no',snapshot:serialized});
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
   try{await fetch(endpoint(),{method:'POST',mode:'no-cors',body:form,cache:'no-store',signal:controller.signal})}finally{clearTimeout(timer)}
   const verify=await readRemote(user);
   let online=[];try{online=JSON.parse(verify.snapshot?.entries?.[reviewKey(user)]||'[]')}catch(_){}
   if(verify.snapshot?.nonce===nonce&&Array.isArray(online)&&online.some(x=>x.id===entry.id)){
    success=true;try{localStorage.setItem(reviewKey(user),JSON.stringify(merged))}catch(_){}
   }
  }
  if(!success)reason='Cloud revision could not be verified';
 }catch(e){reason=e?.message||String(e)}
 finally{
  busy=false;
  const updated=read().map(x=>x.id===cue.id?{...x,status:success?'queued-cloud':'not-confirmed',error:success?'':String(reason).slice(0,100)}:x);
  write(updated);announce(success?'Cue saved and verified in cloud. It is queued for scheduled GPT review; review has not run.':'Cue not confirmed in cloud: '+reason+'. Retry manually.');
 }
 return {ok:success,status:success?'queued-cloud':'not-confirmed'};
}
function formulaFindings(){
 const result=root.StudioAdvisorReadOnly?.getCurrent?.();
 if(!result?.visible||result.stale||!root.StudioFormulaAudit?.audit)return [];
 return root.StudioFormulaAudit.audit(result.results).slice(0,3);
}
function inspect(){
 const findings=formulaFindings();
 for(const finding of findings){
  // Deterministic formula identities ONLY: do not auto-escalate poor performance or historical assumptions.
  const existing=read().find(x=>x.fingerprint==='formula:'+finding.key&&x.day===day());
  if(existing)continue;
  queue({kind:'formula-audit',automatic:true,fingerprint:'formula:'+finding.key,label:finding.title,
    note:'Reproduce and inspect deterministic Studio formula audit: '+finding.metric+' for program '+finding.program+'. Reference '+finding.source+'. No private simulation records attached; inspect permitted cloud run history and source code. Do not change strategies.'});
 }
 return findings;
}

async function refreshPublished(){
 try{
  const res=await fetch('gpt-research-reports.json',{cache:'no-store'});
  if(!res.ok)throw Error('Published report feed unavailable');
  const data=await res.json();
  const rows=Array.isArray(data?.reviews)?data.reviews:[];
  let linked=0;
  const cues=read().map(cue=>{
   const report=rows.find(r=>Array.isArray(r.reviewedRequestIds)&&r.reviewedRequestIds.includes(cue.id));
   if(!report)return cue;
   linked++;
   const status=report.status==='verified'?'review-verified':report.status==='needs-review'?'needs-attention':report.status==='pending-review'?'under-review':'review-published';
   return {...cue,status,reportId:String(report.id||'').slice(0,90)};
  });
  if(linked)write(cues);
  return {linked,total:cues.length};
 }catch(e){return {linked:0,error:String(e?.message||e)}}
}
function mount(){
 const host=document.querySelector('#gptResearchPanel .numbered-content');
 if(!host||document.getElementById('studioCuePanel'))return;
 const details=document.createElement('details');details.id='studioCuePanel';details.className='gpt-research-item';
 details.innerHTML='<summary><strong>Studio AI → GPT review cues</strong><span class="sim-charts-summary"> · Formula audit · Cloud queue status</span></summary><div class="gpt-research-content"><p class="hint">Only hard formula inconsistencies auto-escalate (max two per day). Unanswered questions need a manual Queue action in Studio AI. Review runs on its scheduled task, never instantly.</p><div class="actions"><button type="button" data-studio-audit>Check current formulas</button><button type="button" data-studio-refresh>Refresh cue status</button></div><p data-studio-cue-status class="hint">No check run yet.</p><div data-studio-cues></div></div>';
 host.insertBefore(details,host.firstChild);
 const list=details.querySelector('[data-studio-cues]');
 function redraw(){list.replaceChildren();for(const x of read().slice(-12).reverse()){const p=document.createElement('p');p.className='hint';p.textContent=x.timestamp.slice(0,16)+' · '+x.label+' · '+(x.status==='queued-cloud'||x.status==='verified'?'Queued (cloud verified; GPT not yet reviewed)':x.status==='not-confirmed'?'Needs attention — cloud not confirmed':x.status)+(x.error?' · '+x.error:'');list.append(p)}}
 details.addEventListener('click',e=>{if(e.target.closest('[data-studio-audit]')){const x=inspect();announce(x.length?x.length+' strict formula issue(s) detected; cloud verification may still be in progress.':'No strict arithmetic or funnel invariant failures in the displayed report. This does not validate all model assumptions.');redraw()}if(e.target.closest('[data-studio-refresh]')){announce('Checking published reports for explicitly linked cue IDs…');refreshPublished().then(v=>{announce(v.error?'Published report status unavailable: '+v.error:v.linked+' of '+v.total+' cue(s) explicitly linked to published reports. Unlinked cues remain queued or unknown.');redraw()})}});
 root.addEventListener?.('studio:cues-updated',redraw);redraw();
}
root.StudioReviewCues={queue,inspect,read,refreshPublished,formulaFindings,mount};
root.addEventListener?.('studio:report-rendered',inspect);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);