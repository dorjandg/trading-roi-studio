/* Isolated editable R1-R4 view. Original calculator remains the source of truth. */
(function(){
'use strict';
const root='.jj-risk-workbench';
const sectionSelector='[data-section="wr-comparison"]';
const money=n=>'$'+n.toLocaleString('en-US',{maximumFractionDigits:2});
function setup(){
 const box=document.querySelector(root);
 const section=box?.querySelector(sectionSelector);
 if(!section)return;
 const body=section.querySelector('.jj-risk-section-body');
 if(!body||body.querySelector('[data-rr-editor]'))return;
 const details=document.createElement('details');
 details.dataset.rrEditor='';
 details.style.cssText='margin:10px 0;padding:9px;border:1px solid #8886;border-radius:8px';
 details.innerHTML='<summary style="cursor:pointer;font-size:12px;font-weight:700">R1–R4 · Edit risk and RR (P1/P2/P3)</summary><div data-rr-editor-table style="overflow-x:auto;margin-top:8px"></div><p style="font-size:11px;opacity:.7">Changes use the existing manual risk inputs and their normal saving logic. Auto mode does not apply manual risk amounts. R4 is available only when the simulation permits it.</p>';
 body.append(details);
 details.addEventListener('toggle',()=>{if(details.open)render(details)});
 details.addEventListener('change',e=>{
  const input=e.target.closest('[data-rr-edit]');
  if(!input)return;
  const [type,phase,step]=input.dataset.rrEdit.split(':');
  const source=box.querySelector('[data-manual-'+(type==='risk'?'risk':'rr')+'="'+phase+'-'+step+'"]');
  if(!source)return;
  source.value=input.value;
  if(type==='risk'){
   const mode=box.querySelector('[data-manual-mode="'+phase+'"]');
   if(mode&&mode.value!=='manual'){mode.value='manual';mode.dispatchEvent(new Event('change',{bubbles:true}))}
  }
  source.dispatchEvent(new Event('change',{bubbles:true}));
  render(details);
 });
 details.addEventListener('click',e=>{
  const btn=e.target.closest('[data-rr-set-mode]');
  if(!btn)return;
  const mode=box.querySelector('[data-manual-mode="'+btn.dataset.rrSetMode+'"]');
  if(!mode)return;
  mode.value=mode.value==='manual'?'auto':'manual';
  mode.dispatchEvent(new Event('change',{bubbles:true}));
  render(details);
 });
}
function render(details){
 const box=details.closest(root);
 if(!box||!details.open)return;
 const host=details.querySelector('[data-rr-editor-table]');
 const fallback=Number(box.querySelector('[data-k="rr"]')?.value)||3;
 let sections='';
 for(let p=1;p<=3;p++){
  let rows='';
  const mode=box.querySelector('[data-manual-mode="'+p+'"]')?.value||'auto';
  for(let s=1;s<=4;s++){
   const risk=box.querySelector('[data-manual-risk="'+p+'-'+s+'"]')?.value||'';
   const rr=box.querySelector('[data-manual-rr="'+p+'-'+s+'"]')?.value||'';
   const r=Number(risk),ratio=Number(rr)||fallback;
   const valid=mode==='manual'&&r>0&&ratio>0;
   rows+='<tr><td>R'+s+'</td><td><input aria-label="P'+p+' R'+s+' risk" data-rr-edit="risk:'+p+':'+s+'" type="number" min="0.01" step="any" value="'+risk+'" style="width:78px"></td><td><input aria-label="P'+p+' R'+s+' RR" data-rr-edit="rr:'+p+':'+s+'" type="number" min="0.1" step="any" placeholder="'+fallback+'" value="'+rr+'" style="width:65px"></td><td>'+(valid?money(r*ratio):'—')+'</td><td>'+(valid?money(-r):'—')+'</td><td><button type="button" data-rr-set-mode="'+p+'">'+mode+'</button></td></tr>';
  }
  const title=p===1?'P1 · Evaluation Day 1':p===2?'P2 · Evaluation Day 2':'P3 · Funded';
  sections+='<section style="margin:12px 0 18px;border:1px solid #8886;border-radius:8px;padding:10px"><h4 style="font-size:13px;margin:0 0 8px">'+title+'</h4><table style="width:100%;min-width:480px;font-size:11px"><thead><tr><th>Try</th><th>Risk $</th><th>RR</th><th>Win P/L</th><th>Loss P/L</th><th>Mode</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
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