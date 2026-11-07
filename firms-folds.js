/* 4Ds Trading Studio — compact Firms section visibility (presentation only).
   Keeps the account selector always visible; never changes trading state. */
(function(){
 'use strict';
 const defaults={health:false,stages:true,p1:false,p2:false,funded:false,payout:false,probability:false,results:false};
 const folds=new Map();
 const getOwner=()=>{
  try{return ['doen','dori','dona','dion'].includes(localStorage.getItem('4ds:active-user:v1'))?
   localStorage.getItem('4ds:active-user:v1'):'dori'}catch(_){return 'dori'}
 };
 const storeKey=()=> '4ds:v1:'+getOwner()+':firms-fold-state:v1';
 function load(){
  try{const x=JSON.parse(localStorage.getItem(storeKey())||'{}');
   return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}
  catch(_){return {}}
 }
 function persist(){
  const data={};
  for(const [key,fold] of folds)data[key]=!fold.node.classList.contains('is-collapsed');
  try{localStorage.setItem(storeKey(),JSON.stringify(data))}catch(_){}
 }
 function setFold(key,open,save=true){
  const fold=folds.get(key);if(!fold)return;
  fold.node.classList.toggle('is-collapsed',!open);
  fold.button.textContent=open?'Hide':'Show';
  fold.button.setAttribute('aria-expanded',String(open));
  fold.button.setAttribute('aria-label',(open?'Hide ':'Show ')+fold.title);
  if(save)persist();
 }
 function readValue(id){
  const input=document.getElementById(id);
  return input?.value||'';
 }
 function riskSummary(stage){
  const fold=folds.get(stage);if(!fold)return '';
  const node=fold.node;
  const pane=node.querySelector('.recovery-planner .recovery-details>summary')?.textContent?.trim();
  if(!pane)return node.querySelector('[data-phase-meta]')?.textContent?.trim()||'Risk targets & routes';
  const risks=[...node.querySelectorAll('[data-risk-level]')]
   .filter(x=>Number(x.value)>=.01)
   .map(x=>x.dataset.riskLevel.toUpperCase()+' $'+Number(x.value).toLocaleString('en-US',{maximumFractionDigits:0}));
  const core=pane.replace(/^Phase [12] · |^Funded · /,'').replace(/ · \d+ active tiers$/,'');
  return (core+(risks.length?' · '+risks.join(' · '):' · All risks off'));
 }
 function textOf(id,fallback){
  return document.getElementById(id)?.textContent?.replace(/\s+/g,' ').trim()||fallback;
 }
 function valueSummary(key){
  if(key==='health')return textOf('firmHealthSummary','Rule review not loaded');
  if(key==='stages'){
   const symbol=readValue('symbolSelect')||'XAUUSD';
   return symbol+' · Phase targets, R1–R4 & risk routes';
  }
  if(key==='p1'||key==='p2'||key==='funded')return riskSummary(key);
  if(key==='payout'){
   const panel=document.getElementById('payoutFields');
   const filled=[...panel?.querySelectorAll('input,select')||[]].filter(x=>String(x.value||'').trim()).length;
   return 'Split · Fees · Timing'+(filled?' · '+filled+' saved inputs':'');
  }
  if(key==='probability'){
   const panel=document.getElementById('probFields');
   const filled=[...panel?.querySelectorAll('input,select')||[]].filter(x=>String(x.value||'').trim()).length;
   return 'Estimated phase rates'+(filled?' · '+filled+' inputs':'');
  }
  if(key==='results')return textOf('simResults','No simulation run yet');
  return '';
 }
 function refresh(){
  for(const [key,fold] of folds){
   const next=valueSummary(key),short=next.length>165?next.slice(0,162)+'…':next;
   if(fold.summary.textContent!==short)fold.summary.textContent=short;
   if(fold.summary.title!==next)fold.summary.title=next;
  }
 }
 function addFold(key,node,header,open){
  if(!node||!header)return;
  node.classList.add('firms-fold');
  node.dataset.firmsFold=key;
  header.classList.add('firms-fold-head');
  const first=header.firstElementChild;
  if(!first)return;
  first.classList.add('firms-fold-main');
  const summary=document.createElement('p');
  summary.className='firms-fold-summary';
  first.appendChild(summary);
  const button=document.createElement('button');
  button.type='button';button.className='firms-fold-toggle';
  button.dataset.firmsFoldToggle=key;
  header.appendChild(button);
  const title=node.querySelector('.firms-fold-head h2,.firms-fold-head h3')?.textContent?.trim()||key;
  folds.set(key,{node,header,button,summary,title});
  setFold(key,open,false);
 }
 function init(){
  const page=document.getElementById('page-firms');if(!page||folds.size)return;
  const groups=[...page.querySelectorAll('.risk-phase-group')];
  const specs=[
   ['health',document.getElementById('firmHealthPanel')],
   ['stages',document.getElementById('symbolPanel')],
   ['p1',groups[0]],['p2',groups[1]],['funded',groups[2]],
   ['payout',document.getElementById('payoutFields')?.closest('.panel')],
   ['probability',document.getElementById('probFields')?.closest('.panel')],
   ['results',document.getElementById('simResults')?.closest('.panel')]
  ];
  const saved=load();
  for(const [key,node] of specs){
   if(!node)continue;
   const header=node.firstElementChild;
   if(!header||(key!=='p1'&&key!=='p2'&&key!=='funded'&&!header.classList.contains('panel-header')))continue;
   addFold(key,node,header,typeof saved[key]==='boolean'?saved[key]:defaults[key]);
  }
  refresh();
  document.getElementById('firmsShowAll')?.addEventListener('click',()=>{
   for(const key of folds.keys())setFold(key,true,false);
   persist();
  });
  document.getElementById('firmsHideAll')?.addEventListener('click',()=>{
   for(const key of folds.keys())setFold(key,false,false);
   persist();
  });
  page.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-firms-fold-toggle]');
   if(!button)return;
   const key=button.dataset.firmsFoldToggle;
   if(folds.has(key))setFold(key,folds.get(key).node.classList.contains('is-collapsed'));
  });
  // Dynamic profile and calculator rerenders update the collapsed KPI text,
  // without changing state, listening to every mutation or observing other pages.
  let scheduled=false;
  const observer=new MutationObserver(records=>{
   if(records.every(record=>record.target?.closest?.('.firms-fold-summary')))return;
   if(scheduled)return;
   scheduled=true;
   requestAnimationFrame(()=>{scheduled=false;refresh()});
  });
  observer.observe(page,{subtree:true,childList:true,characterData:true});
  page.addEventListener('change',()=>requestAnimationFrame(refresh));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
