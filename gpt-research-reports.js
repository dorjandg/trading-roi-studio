/* Public, sanitized GPT research reports. No model credentials or private cloud data. */
(function(){
'use strict';
const host=document.getElementById('gptResearchReports');
const summary=document.getElementById('gptResearchSummary');
const status=document.getElementById('gptResearchStatus');
if(!host||!summary||!status)return;
const reportName='gpt-research-reports.json';
const allowedStatuses=new Set(['investigated','recommended','updated','pending-review']);
const reviewMeta=document.getElementById('gptReviewMeta');
let lastPublishedAt=null;
function localPendingCount(){
 try{
  const selected=localStorage.getItem('4ds:active-user:v1');
  const user=['doen','dori','dona','dion'].includes(selected)?selected:'dori';
  const log=JSON.parse(localStorage.getItem('4ds:v1:'+user+':results-advisor-review:v1')||'[]');
  return Array.isArray(log)?log.filter(x=>x?.status==='needs-review').length:null;
 }catch(_){return null;}
}
function updateReviewMeta(){
 if(!reviewMeta)return;
 const pending=localPendingCount();
 reviewMeta.textContent='Last published report: '+(lastPublishedAt?new Date(lastPublishedAt).toLocaleString():'not verified')+
  ' · Pending questions (this browser): '+(pending==null?'unavailable':pending)+
  ' · GPT task execution time: not available to the website';
}
updateReviewMeta();
const label=(txt)=>{const node=document.createElement('span');node.textContent=txt;return node;};
function paragraph(parent,text){const p=document.createElement('p');p.textContent=text;parent.appendChild(p);}
function draw(data){
 const items=Array.isArray(data?.reviews)?data.reviews:[];
 host.replaceChildren();
 lastPublishedAt=data?.updatedAt||null;
 updateReviewMeta();
 summary.textContent=' · '+items.length+' reports · latest '+(data?.updatedAt?new Date(data.updatedAt).toLocaleDateString():'—');
 if(!items.length){status.textContent='No published GPT findings yet';return;}
 for(const report of items.slice(0,30)){
  const card=document.createElement('details');card.className='gpt-research-item';
  const head=document.createElement('summary');
  const title=document.createElement('strong');title.textContent=String(report.title||'Research finding');
  const meta=label(' · '+(report.category||'Review')+' · '+(allowedStatuses.has(report.status)?report.status:'pending-review'));
  head.append(title,meta);card.appendChild(head);
  const body=document.createElement('div');body.className='gpt-research-content';
  if(report.finding)paragraph(body,'Finding: '+report.finding);
  if(report.suggestion)paragraph(body,'Suggested test: '+report.suggestion);
  if(Array.isArray(report.measurements)&&report.measurements.length){
   const h=document.createElement('strong');h.textContent='Measurements to check';body.append(h);
   const ul=document.createElement('ul');
   for(const m of report.measurements.slice(0,12)){const li=document.createElement('li');li.textContent=m;ul.append(li);}
   body.append(ul);
  }
  if(report.action)paragraph(body,'Website/report action: '+report.action);
  if(report.source)paragraph(body,'Evidence: '+report.source);
  if(report.verified)paragraph(body,'Verification: '+report.verified);
  if(report.codeCommit&&/^[a-f0-9]{40}$/.test(report.codeCommit)){
   const a=document.createElement('a');
   a.href='https://github.com/dorjandg/trading-roi-studio/commit/'+report.codeCommit;
   a.target='_blank';a.rel='noopener noreferrer';a.textContent='View supporting code change';
   body.append(a);
  }
  card.append(body);host.append(card);
 }
 status.textContent='Published GPT research reports · public, non-personal findings only';
}
function evidenceReadiness(){
 const el=document.getElementById('gptEvidenceReadiness');if(!el)return;
 let user='dori',runs=[];
 try{
  const selected=localStorage.getItem('4ds:active-user:v1');
  if(['doen','dori','dona','dion'].includes(selected))user=selected;
  const raw=JSON.parse(localStorage.getItem('4ds:v1:'+user+':portfolio-simulation-history:v1')||'[]');
  runs=Array.isArray(raw)?raw:[];
 }catch(e){el.textContent='Saved history unavailable in this browser: '+e.message;return;}
 runs.sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||'')));
 el.replaceChildren();
 if(!runs.length){paragraph(el,'No locally loaded simulation records. Run a simulation or load cloud history in Section 10.');return;}
 const latest=runs[0],kind=latest.kind==='calculate-investment'?'Calculate Investment':'Run Full Simulation';
 const detail=kind==='Calculate Investment'?
  !!latest.candidates?.length&&latest.candidates.every(c=>c.planSnapshot?.riskProfiles):
  !!latest.firms?.length&&latest.firms.every(f=>f.risk&&f.caps);
 const accountCount=kind==='Run Full Simulation'?
  latest.firms.reduce((n,f)=>n+(f.sample?.accounts?.length||0),0):0;
 const traceCount=kind==='Run Full Simulation'?
  latest.firms.reduce((n,f)=>n+(f.sample?.accounts||[]).reduce((v,a)=>v+(a.trace?.length||0),0),0):0;
 const recordDate=latest.timestamp?new Date(latest.timestamp).toLocaleString():'unknown date';
 paragraph(el,'Latest saved record: '+kind+' · '+recordDate+'.');
 paragraph(el,detail?'Risk-policy snapshots: available.':'Risk-policy snapshots: incomplete or legacy format.');
 if(kind==='Calculate Investment')
  paragraph(el,'Account event traces: not included in optimizer history. Run Full Simulation on the exact model to inspect account closures.');
 else paragraph(el,'Sampled account event traces: '+traceCount+' events across '+accountCount+' sampled accounts. These do not include all Monte Carlo trials.');
 paragraph(el,'Next step: '+(!detail||kind==='Calculate Investment'?
  'Run Full Simulation using the chosen model, then save and sync in Section 10.' :
  'Review account closure events and distinguish firm loss breaches from risk-tier blocks.'));
}
async function refresh(){
 evidenceReadiness();
 updateReviewMeta();
 status.textContent='Loading latest research reports…';
 try{
  const response=await fetch(reportName+'?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(data.schema!=='4ds-gpt-research-v1')throw Error('Unexpected report format');
  draw(data);
 }catch(e){status.textContent='Could not load the published review feed: '+e.message;}
}
document.getElementById('gptResearchRefresh')?.addEventListener('click',refresh);
refresh();
})();