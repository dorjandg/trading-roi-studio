/* Compact Studio AI Health Monitor — checks never alter risk profiles or simulate trades. */
(function(root){'use strict';
if(root.self!==root.top)return;
const panel=document.getElementById('studioFloatingAI');
if(!panel||document.getElementById('studioAiHealth'))return;
const style=document.createElement('style');
style.textContent='#studioAiHealth{border-top:1px solid #34485c;margin-top:7px;padding-top:5px;flex-shrink:0}#studioAiHealth summary{cursor:pointer;font-size:11px;color:#c9d9ec;padding:4px 1px}#studioAiHealth .studio-health-body{max-height:min(32vh,240px);overflow-y:auto;overscroll-behavior:contain;padding:4px 1px 6px}#studioAiHealth .studio-health-line{display:flex;justify-content:space-between;gap:10px;padding:5px 2px;border-bottom:1px solid #29394b;font-size:11px}#studioAiHealth .studio-health-line span:last-child{max-width:62%;text-align:right;overflow-wrap:anywhere}#studioAiHealth [data-health-refresh]{margin-top:7px}@media(max-width:600px){#studioAiHealth .studio-health-body{max-height:25dvh}.studio-ai-input{flex-shrink:0}.studio-ai-suggestions{max-height:65px;overflow-y:auto;overscroll-behavior:contain}}';
document.head.appendChild(style);
const health=document.createElement('details');health.id='studioAiHealth';
health.innerHTML='<summary>AI Health · Formula / Cloud / GPT / Knowledge</summary><div class="studio-health-body"><div data-health-lines></div><button type="button" data-health-refresh>Refresh checks (read-only)</button><p class="studio-ai-note" data-health-info>Checks are read-only. Cloud read checks require network access; GPT task runs cannot be triggered here.</p></div>';
panel.insertBefore(health,panel.querySelector('.studio-ai-saved'));
const lines=health.querySelector('[data-health-lines]'),info=health.querySelector('[data-health-info]'),button=health.querySelector('[data-health-refresh]');
function add(title,value){
 const row=document.createElement('div');row.className='studio-health-line';
 const left=document.createElement('span');left.textContent=title;const right=document.createElement('span');right.textContent=value;
 row.append(left,right);lines.append(row);
}
function counts(){
 const cues=root.StudioReviewCues?.read?.()||[];
 const queue=cues.filter(x=>['queued-cloud','verified','sending','queued'].includes(x.status)).length;
 const reviewed=cues.filter(x=>['review-verified','review-published'].includes(x.status)).length;
 const attention=cues.filter(x=>['not-confirmed','needs-attention'].includes(x.status)).length;
 const unresolved=cues.filter(x=>['under-review'].includes(x.status)).length;
 return {queue,reviewed,attention,unresolved,total:cues.length};
}
function snapshot(){
 lines.replaceChildren();
 const report=root.StudioAdvisorReadOnly?.getCurrent?.();
 const findings=report?.visible&&!report.stale?root.StudioFormulaAudit?.audit?.(report.results)||[]:null;
 add('Formula audit',!report?.visible?'No full report in current page':report.stale?'Report is stale':findings?.length?'⚠ '+findings.length+' strict mismatch(es)':'Checked · 0 strict mismatches');
 const cloud=root.StudioReviewCues?.cloudState?.();
 add('Cloud connection',cloud?.status==='read-verified'?'Read verified · '+new Date(cloud.checkedAt).toLocaleTimeString():cloud?.status==='unavailable'?'Read unavailable':cloud?.configured?'Configured, not yet tested':'Not configured');
 const q=counts();
 add('GPT review queue',q.queue+' queued · '+q.reviewed+' published-linked'+(q.attention?' · '+q.attention+' attention':'')+(q.unresolved?' · '+q.unresolved+' investigating':''));
 add('Scheduled GPT task','Not directly verifiable here');
 const e=root.StudioFormulaAudit?.entries?.length||0,c=root.StudioCrossPageFormulas?.entries?.length||0;
 add('Formula coverage',e+' Portfolio categories + '+c+' other-page groups · partial');
 const k=root.StudioResearchKnowledge?.status?.()||{};
 add('Published research',k.status==='loaded'?k.count+' approved public findings · '+(k.updatedAt||'date unavailable'):k.status||'not loaded');
 const u=(()=>{try{const user=localStorage.getItem('4ds:active-user:v1')||'dori';const x=JSON.parse(localStorage.getItem('4ds:v1:'+user+':studio-evidence-chat:v1')||'{}');return Array.isArray(x.unanswered)?x.unanswered.filter(a=>typeof a==='string'||a.status!=='reviewed').length:0}catch(_){return null}})();
 add('Open AI questions',u===null?'Unavailable':String(u));
 return {cloud,queue:q,formula:findings?.length||0};
}
button.addEventListener('click',async()=>{
 button.disabled=true;button.textContent='Checking…';info.textContent='Checking the selected user’s cloud read access, public GPT reports and formula state. No risk changes.';
 try{
  const results=await Promise.all([root.StudioReviewCues?.probeCloud?.(),root.StudioReviewCues?.refreshPublished?.(),root.StudioResearchKnowledge?.refresh?.()]);
  const cloud=results[0],published=results[1];
  info.textContent='Cloud: '+(cloud?.status||'not checked')+'; request-ID links: '+(published?.linked??0)+'. '+(published?.error?'Published report check: '+published.error+'. ':'')+'A queued request is not a completed GPT task.';
 }catch(e){info.textContent='Some checks could not complete: '+String(e?.message||e).slice(0,130)}
 finally{button.disabled=false;button.textContent='Refresh checks (read-only)';snapshot()}
});
health.addEventListener('toggle',()=>{if(health.open)snapshot()});
root.addEventListener?.('studio:cues-updated',()=>{if(health.open)snapshot()});
root.addEventListener?.('studio:report-rendered',()=>{if(health.open)snapshot()});
root.StudioAiHealth={snapshot};
})(window);