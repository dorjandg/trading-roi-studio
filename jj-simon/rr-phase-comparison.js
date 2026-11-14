/* Isolated 07A R1-R4 comparison. Does not modify the simulator. */
(function(){
'use strict';
const rootSelector='.jj-risk-workbench [data-section="wr-comparison"]';
function render(){
 const section=document.querySelector(rootSelector);
 if(!section)return;
 let panel=section.querySelector('[data-rr-phase-comparison]');
 if(!panel){
  panel=document.createElement('details');
  panel.dataset.rrPhaseComparison='';
  panel.style.cssText='margin:12px 0;padding:10px;border:1px solid #8886;border-radius:8px';
  panel.innerHTML='<summary style="cursor:pointer;font-weight:700;font-size:12px">R1–R4 · P1/P2/P3 risk & reward comparison</summary><div data-rr-phase-table style="overflow-x:auto;margin-top:8px"></div>';
  section.querySelector('.jj-risk-section-body')?.append(panel);
 }
 if(!panel||!panel.open)return;
 const box=document.querySelector('.jj-risk-workbench');
 if(!box)return;
 const val=(selector)=>box.querySelector(selector)?.value;
 const defaultRR=Number(val('[data-k="rr"]'))||3;
 const fmt=(n)=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 let rows='';
 for(let phase=1;phase<=3;phase++){
  const manual=val('[data-manual-mode="'+phase+'"]')==='manual';
  for(let attempt=1;attempt<=4;attempt++){
   const raw=val('[data-manual-risk="'+phase+'-'+attempt+'"]');
   const risk=manual&&raw!==undefined&&raw!==''?Number(raw):NaN;
   const rrRaw=val('[data-manual-rr="'+phase+'-'+attempt+'"]');
   const rr=rrRaw!==undefined&&rrRaw!==''&&Number(rrRaw)>0?Number(rrRaw):defaultRR;
   const known=Number.isFinite(risk)&&risk>0;
   rows+='<tr><td>P'+phase+'</td><td>R'+attempt+'</td><td>'+(known?fmt(risk):'Auto')+'</td><td>'+rr.toFixed(2)+'</td><td>'+(known?fmt(risk*rr):'—')+'</td><td>'+(known?fmt(-risk):'—')+'</td></tr>';
  }
 }
 panel.querySelector('[data-rr-phase-table]').innerHTML='<table style="font-size:11px;min-width:460px;width:100%;border-collapse:collapse"><thead><tr><th>Phase</th><th>Try</th><th>Risk</th><th>RR</th><th>Win P/L</th><th>Loss P/L</th></tr></thead><tbody>'+rows+'</tbody></table><p style="font-size:11px;opacity:.75">Read-only configured values. Auto risk is not estimated. R4 is shown for inspection only; the simulator determines whether it is allowed.</p>';
}
document.addEventListener('toggle',e=>{if(e.target?.matches?.('[data-rr-phase-comparison]'))render()},true);
document.addEventListener('change',e=>{if(e.target?.closest?.('.jj-risk-workbench'))render()},true);
const observer=new MutationObserver(()=>{if(!document.querySelector('[data-rr-phase-comparison]'))render()});
function init(){observer.observe(document.body,{childList:true,subtree:true});render()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();