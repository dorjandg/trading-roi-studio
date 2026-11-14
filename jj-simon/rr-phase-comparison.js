/* Isolated editable R1-R4 view. Original calculator remains the source of truth. */
(function(){
'use strict';
const root='.jj-risk-workbench';
const sectionSelector='[data-section="wr-comparison"]';
const strategyKey='jj-risk-comparison-strategy-v2';
const readStrategy=()=>{try{const v=JSON.parse(localStorage.getItem(strategyKey)||'{}');return v&&typeof v==='object'?v:{}}catch(e){return {}}};
const writeStrategy=v=>{try{localStorage.setItem(strategyKey,JSON.stringify(v))}catch(e){}};
const readWR=()=>{const data=readStrategy();const result={};for(let p=1;p<=3;p++)for(let s=1;s<=4;s++)result[p+'-'+s]=data['wr'+p+'-'+s]??'';return result};
const money=n=>'$'+n.toLocaleString('en-US',{maximumFractionDigits:2});
function setup(){
 const box=document.querySelector(root);
 const section=box?.querySelector(sectionSelector);
 if(!section)return;
 // One-time migration: preserve existing comparison inputs before decoupling.
 if(!localStorage.getItem(strategyKey)){
  const migrated={};let oldWR={};try{oldWR=JSON.parse(localStorage.getItem('jj-risk-attempt-winrates-v1')||'{}')}catch(e){}
  for(let p=1;p<=3;p++){migrated['mode'+p]='comparison';for(let s=1;s<=4;s++){const k=p+'-'+s;for(const t of ['risk','rr'])migrated[t+k]=box.querySelector('[data-manual-'+t+'="'+k+'"]')?.value||'';if(oldWR[k]!==undefined)migrated['wr'+k]=oldWR[k]}}
  writeStrategy(migrated);
 }
 const body=section.querySelector('.jj-risk-section-body');
 if(!body||body.querySelector('[data-rr-editor]'))return;
 const details=document.createElement('details');
 details.dataset.rrEditor='';
 details.style.cssText='margin:10px 0;padding:9px;border:1px solid #8886;border-radius:8px';
 details.innerHTML='<summary style="cursor:pointer;font-size:12px;font-weight:700">R1–R4 · Edit risk and RR (P1/P2/P3)</summary><div data-rr-editor-table style="overflow-x:auto;margin-top:8px"></div><p style="font-size:11px;opacity:.7">Comparison R1–R4 is independent of Sections 01–02. Base uses the original settings; Comparison uses only the saved values below. Neither selection overwrites the other. R4 is available only when the simulation permits it.</p>';
 body.append(details);
 details.addEventListener('toggle',()=>{if(details.open)render(details)});
 details.addEventListener('change',e=>{
  const input=e.target.closest('[data-rr-edit]');
  if(!input)return;
  const [type,phase,step]=input.dataset.rrEdit.split(':');
  if(readStrategy()['mode'+phase]==='base')return;
  const saved=readStrategy();
  if(type==='wr'){const n=Number(input.value);if(input.value!==''&&(!Number.isFinite(n)||n<0||n>100)){input.setCustomValidity('Enter a win rate from 0 to 100');input.reportValidity();return}input.setCustomValidity('')}
  saved[type+phase+'-'+step]=input.value;writeStrategy(saved);
  box.dispatchEvent(new CustomEvent('jj-attempt-wr-changed',{bubbles:true}));
  render(details);
 });
 details.addEventListener('click',e=>{
  const btn=e.target.closest('[data-rr-set-mode]');
  if(!btn)return;
  const data=readStrategy();const key='mode'+btn.dataset.rrSetMode;data[key]=data[key]==='base'?'comparison':'base';writeStrategy(data);
  box.dispatchEvent(new CustomEvent('jj-attempt-wr-changed',{bubbles:true}));
  render(details);
 });
}
function render(details){
 const box=details.closest(root);
 if(!box||!details.open)return;
 const host=details.querySelector('[data-rr-editor-table]');
 const fallback=Number(box.querySelector('[data-k="rr"]')?.value)||3;
 const commonWR=Number(box.querySelector('[data-k="winRate"]')?.value)||0;
 const savedWR=readWR();
 const comparison=readStrategy();
 let sections='';
 for(let p=1;p<=3;p++){
  let rows='';
  const mode=comparison['mode'+p]==='base'?'base':'comparison';
  for(let s=1;s<=4;s++){
   const risk=comparison['risk'+p+'-'+s]??'';
   const rr=comparison['rr'+p+'-'+s]??'';
   const wr=savedWR[p+'-'+s]??'';
   const editing=mode==='comparison';
   const shownRisk=editing?risk:'';
   const shownRR=editing?rr:'';
   const shownWR=editing?wr:'';
   const locked=editing?'':' disabled title="Switch to Comparison to edit its independent values"';
   const r=Number(risk),ratio=Number(rr)||fallback;
   const valid=editing&&r>0&&ratio>0;
   rows+='<tr><td>R'+s+'</td><td><input aria-label="P'+p+' R'+s+' risk" data-rr-edit="risk:'+p+':'+s+'" type="number" min="0.01" step="any" value="'+shownRisk+'"'+locked+' style="width:78px"></td><td><input aria-label="P'+p+' R'+s+' RR" data-rr-edit="rr:'+p+':'+s+'" type="number" min="0.1" step="any" placeholder="'+fallback+'" value="'+shownRR+'"'+locked+' style="width:65px"></td><td><input aria-label="P'+p+' R'+s+' win rate" data-rr-edit="wr:'+p+':'+s+'" type="number" min="0" max="100" step="any" placeholder="'+commonWR+'" value="'+shownWR+'"'+locked+' style="width:65px"></td><td>'+(valid?money(r*ratio):'—')+'</td><td>'+(valid?money(-r):'—')+'</td><td><button type="button" data-rr-set-mode="'+p+'">'+mode+'</button></td></tr>';
  }
  const title=p===1?'P1 · Evaluation Day 1':p===2?'P2 · Evaluation Day 2':'P3 · Funded';
  sections+='<section style="margin:16px 0 20px;padding:12px 10px;border:1px solid #8886;border-top:3px solid #7e9bb9;border-radius:8px"><h4 style="margin:0 0 10px;font-size:13px;font-weight:700">'+title+'</h4><table style="width:100%;min-width:520px;font-size:11px"><thead><tr><th>Try</th><th>Risk $</th><th>RR</th><th>WR %</th><th>Win P/L</th><th>Loss P/L</th><th>Mode</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
 }
 host.innerHTML=sections;
}
document.addEventListener('change',e=>{
 if(!e.target.closest?.(root)||e.target.closest('[data-rr-editor]'))return;
 const d=document.querySelector(root+' [data-rr-editor]');
 if(d?.open)render(d);
},true);
const observer=new MutationObserver(()=>{if(!document.querySelector(root+' [data-rr-editor]'))setup()});
function init(){observer.observe(document.body,{childList:true,subtree:true});setup()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();