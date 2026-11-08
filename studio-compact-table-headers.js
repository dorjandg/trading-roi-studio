/* Shared compact table headers: presentation only. Never change data keys or saved order. */
(()=>{'use strict';
const MAX=12;
const aliases={
 'Challenge active':'P1','Verification active':'P2','Funded active':'P3','Payout pending':'P4',
 'Phase 1 passed':'P1 pass','Phase 2 passed':'P2 pass','Target reached':'P3 ready',
 'Funded target hit':'P3 ready','Paid accounts':'P4 paid','Payouts paid':'P4 paid',
 'Failed accounts':'Failed','Challenges purchased':'Bought','Executed trades':'Executed',
 'Qualification trades':'Qual.','Signals available':'Signals','Unused signals':'Unused',
 'Risk blocked':'Blocked','Account events':'Events','New accounts':'New',
 'Funded allocation ($)':'Fund $','Evaluation allocation ($)':'Eval $',
 'Purchased allocation ($)':'Buy $','Total Spending':'Spent',
 'Return on Investment':'ROI %','Maximum Drawdown':'Max DD',
 'Accounts per shared signal':'Acc/signal','Average Trades':'Avg trades',
 'Allocation method':'Method','Allocation policy':'Policy'
};
function compact(value){
 const full=String(value||'').trim().replace(/\s+/g,' ');
 if(aliases[full])return aliases[full];
 if(full.length<=MAX)return full;
 const short=full.replace(/qualification/gi,'Qual').replace(/verification/gi,'Verif')
 .replace(/evaluation/gi,'Eval').replace(/allocation/gi,'Alloc')
 .replace(/expected/gi,'Exp').replace(/average/gi,'Avg')
 .replace(/cumulative/gi,'Cum').replace(/maximum/gi,'Max')
 .replace(/accounts?/gi,'Acc').replace(/trading/gi,'Trade')
 .replace(/purchased/gi,'Bought');
 return short.length<=MAX?short:short.slice(0,MAX-1).trimEnd()+'…';
}
function fix(){
 for(const th of document.querySelectorAll('table thead th')){
  const nodes=Array.from(th.childNodes).filter(n=>n.nodeType===3&&n.textContent.trim());
  if(nodes.length!==1)continue;
  const node=nodes[0],original=node.textContent.trim();
  const full=th.dataset.fullColumnTitle||th.getAttribute('title')||original;
  const short=compact(original);
  if(short!==original){
   if(!th.dataset.fullColumnTitle)th.dataset.fullColumnTitle=full;
   th.title=full;node.textContent=node.textContent.replace(original,short);
  }
 }
 for(const label of document.querySelectorAll('#journeyContents button[aria-label="Filter columns"] + div label')){
  for(const node of label.childNodes){
   if(node.nodeType!==3||!node.textContent.trim())continue;
   const original=node.textContent.trim(),short=compact(original);
   if(short!==original){if(!label.title)label.title=original;node.textContent=node.textContent.replace(original,short);}
  }
 }
}
function init(){
 fix();
 let queued=false;
 new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;fix();});})
 .observe(document.body,{subtree:true,childList:true});
 const closeOutside=e=>{
  for(const button of document.querySelectorAll('button[aria-label="Filter columns"]')){
   const panel=button.nextElementSibling;
   if(!panel||panel.hidden)continue;
   const path=typeof e.composedPath==='function'?e.composedPath():[];
   if(button.contains(e.target)||panel.contains(e.target)||path.includes(button)||path.includes(panel))continue;
   panel.hidden=true;panel.style.display='none';button.setAttribute('aria-expanded','false');
  }
 };
 document.addEventListener('pointerdown',closeOutside,true);
 document.addEventListener('touchstart',closeOutside,{capture:true,passive:true});
 document.addEventListener('click',closeOutside,true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const b of document.querySelectorAll('button[aria-label="Filter columns"]')){const p=b.nextElementSibling;if(p){p.hidden=true;p.style.display='none';b.setAttribute('aria-expanded','false');}}});
 window.StudioTableHeaderAudit={inventory:()=>Array.from(document.querySelectorAll('table')).map((t,i)=>({table:i+1,headers:Array.from(t.querySelectorAll('thead th')).map(h=>({shown:h.textContent.trim(),full:h.dataset.fullColumnTitle||h.title||h.textContent.trim()}))}))};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
