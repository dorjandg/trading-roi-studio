/* Public, sanitized GPT research reports. No model credentials or private cloud data. */
(function(){
'use strict';
const host=document.getElementById('gptResearchReports');
const summary=document.getElementById('gptResearchSummary');
const status=document.getElementById('gptResearchStatus');
if(!host||!summary||!status)return;
const reportName='gpt-research-reports.json';
const allowedStatuses=new Set(['investigated','recommended','updated','pending-review']);
const label=(txt)=>{const node=document.createElement('span');node.textContent=txt;return node;};
function paragraph(parent,text){const p=document.createElement('p');p.textContent=text;parent.appendChild(p);}
function draw(data){
 const items=Array.isArray(data?.reviews)?data.reviews:[];
 host.replaceChildren();
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
async function refresh(){
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