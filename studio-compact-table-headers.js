/* Trading Studio shared table labels. Visual only; preserve keys and drag handlers. */
(()=>{'use strict';
const names={
'Challenge active':'P1','Verification active':'P2','Funded active':'P3','Payout pending':'P4',
'Challenge':'P1','Verif.':'P2','Verification':'P2','Funded':'P3','Pending':'P4',
'Funded allocation ($)':'Fund Evaluation allocation ($)':'Eval $','Purchased allocation ($)':'Buy $','Funded allocation':'Fund $','Evaluation allocation':'Eval $','Purchased allocation':'Buy $',
'Qualification trades':'Qual.','Verification active':'P2','Challenges purchased':'Bought','Challenge active':'P1','Funded active':'P3','Funded activated':'Funded','Payout pending':'P4','Executed trades':'Executed','Paid accounts':'Paid','Failed accounts':'Failed','Risk blocked':'Blocked','Account events':'Events','New accounts':'New','Phase 1 passed':'P1 pass','Phase 2 passed':'P2 pass',
'Trading Signals':'Signals','Total Signals':'Signals','Signals available':'Signals','Trading opportunities':'Signals','Opportunities':'Opps','Unused signals':'Unused','Qualification':'Qual.','Verification':'Verif.','Evaluation':'Eval','Funded Accounts':'Funded','Accounts Purchased':'Bought','Total Purchased':'Bought','Total Spending':'Spent','Net Profit':'Net','Net P&L':'Net','Return on Investment':'ROI %','Win Rate':'WR %','Maximum Drawdown':'Max DD',
'Firm / account':'Firm / Acc.','Phase 1 passes':'P1 pass','Phase 2 passes':'P2 pass','Chance ≥1 payout':'Payout %','Expected payouts':'Exp. payout','Expected net':'Exp. net','Expected ROI':'Exp. ROI','Chance of goal':'Goal %','Payouts avg.':'Avg payout','Average accounts':'Avg acc.','Stage / milestone':'Milestone','Trading day':'Day','Outcome / event':'Event',
'Allocation method':'Method','Allocation policy':'Policy','Median net':'Med. net','Median payout cash':'Med. payout','P10 / P90 net':'P10/P90','Chance of ≥50% loss':'Loss ≥50%','Closing equity':'Equity','Max drawdown':'Max DD','Net trading P/L':'Net P/L','Daily usage':'Daily use','Traded days':'Days','Profit / loss':'P/L','Stage progress':'Progress','Loss headroom':'Headroom',
'Order / risk tier':'Risk tier','Stop loss (USD)':'SL $','Winning profit (USD)':'Win $','Accounts per shared signal':'Acc./signal','Average Trades':'Avg trades','Avg. trades all attempts':'Avg trades','Avg. trades successful':'Win trades','Avg. active days successful':'Win days','Risk exhausted':'Exhausted','JJ benchmark scenario':'JJ benchmark','FTMO planning scenario':'FTMO plan','Proper interpretation':'Meaning','Difference (B − A)':'Diff.'
};
Evaluation allocation ($)':'Eval $','Purchased allocation ($)':'Buy $','Funded allocation':'Fund $','Evaluation allocation':'Eval $','Purchased allocation':'Buy $',
'Qualification trades':'Qual.','Verification active':'P2','Challenges purchased':'Bought','Challenge active':'P1','Funded active':'P3','Funded activated':'Funded','Payout pending':'P4','Executed trades':'Executed','Paid accounts':'Paid','Failed accounts':'Failed','Risk blocked':'Blocked','Account events':'Events','New accounts':'New','Phase 1 passed':'P1 pass','Phase 2 passed':'P2 pass',
'Trading Signals':'Signals','Total Signals':'Signals','Signals available':'Signals','Trading opportunities':'Signals','Opportunities':'Opps','Unused signals':'Unused','Qualification':'Qual.','Verification':'Verif.','Evaluation':'Eval','Funded Accounts':'Funded','Accounts Purchased':'Bought','Total Purchased':'Bought','Total Spending':'Spent','Net Profit':'Net','Net P&L':'Net','Return on Investment':'ROI %','Win Rate':'WR %','Maximum Drawdown':'Max DD',
'Firm / account':'Firm / Acc.','Phase 1 passes':'P1 pass','Phase 2 passes':'P2 pass','Chance ≥1 payout':'Payout %','Expected payouts':'Exp. payout','Expected net':'Exp. net','Expected ROI':'Exp. ROI','Chance of goal':'Goal %','Payouts avg.':'Avg payout','Average accounts':'Avg acc.','Stage / milestone':'Milestone','Trading day':'Day','Outcome / event':'Event',
'Allocation method':'Method','Allocation policy':'Policy','Median net':'Med. net','Median payout cash':'Med. payout','P10 / P90 net':'P10/P90','Chance of ≥50% loss':'Loss ≥50%','Closing equity':'Equity','Max drawdown':'Max DD','Net trading P/L':'Net P/L','Daily usage':'Daily use','Traded days':'Days','Profit / loss':'P/L','Stage progress':'Progress','Loss headroom':'Headroom',
'Order / risk tier':'Risk tier','Stop loss (USD)':'SL $','Winning profit (USD)':'Win $','Accounts per shared signal':'Acc./signal','Average Trades':'Avg trades','Avg. trades all attempts':'Avg trades','Avg. trades successful':'Win trades','Avg. active days successful':'Win days','Risk exhausted':'Exhausted','JJ benchmark scenario':'JJ benchmark','FTMO planning scenario':'FTMO plan','Proper interpretation':'Meaning','Difference (B − A)':'Diff.'
};
const compact=value=>{
 const original=String(value||'').trim().replace(/\\s+/g,' ');
 if(names[original])return names[original];
 if(original.length<=12)return original;
 const abbreviated=original.replace(/\\bqualification\\b/gi,'Qual').replace(/\\bverification\\b/gi,'Verif').replace(/\\bevaluation\\b/gi,'Eval').replace(/\\ballocation\\b/gi,'Alloc').replace(/\\bexpected\\b/gi,'Exp').replace(/\\baverage\\b/gi,'Avg').replace(/\\bcumulative\\b/gi,'Cum').replace(/\\bmaximum\\b/gi,'Max').replace(/\\baccounts?\\b/gi,'Acc').replace(/\\btrading\\b/gi,'Trade').replace(/\\bnumber\\b/gi,'No');
 return abbreviated.length<=12?abbreviated:abbreviated.slice(0,11).replace(/[ .\\/-]+$/,'')+'…';
};
function fix(){
 for(const h of document.querySelectorAll('table thead th')){
  const nodes=[...h.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim());
  if(nodes.length!==1)continue;const n=nodes[0],old=n.textContent.trim(),short=compact(old);
  if(short!==old){if(!h.dataset.fullColumnTitle)h.dataset.fullColumnTitle=old;h.title=h.dataset.fullColumnTitle||old;n.textContent=n.textContent.replace(old,short);}
 }
 for(const p of document.querySelectorAll('#journeyContents button[aria-label="Filter columns"] + div')){
  for(const label of p.querySelectorAll('label'))for(const n of label.childNodes){
   if(n.nodeType!==3||!n.textContent.trim())continue;
   const old=n.textContent.trim(),short=compact(old);
   if(short!==old){if(!label.title)label.title=old;n.textContent=n.textContent.replace(old,short);}
  }
 }
}
function init(){
 fix();let pending=false;
 new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;fix();});}).observe(document.body,{subtree:true,childList:true});
 document.addEventListener('pointerdown',e=>{for(const b of document.querySelectorAll('#journeyContents button[aria-label="Filter columns"]')){const p=b.nextElementSibling;if(p&&!p.hidden&&!b.contains(e.target)&&!p.contains(e.target)){p.hidden=true;b.setAttribute('aria-expanded','false');}}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const b of document.querySelectorAll('#journeyContents button[aria-label="Filter columns"]')){const p=b.nextElementSibling;if(p){p.hidden=true;b.setAttribute('aria-expanded','false');}}});
 window.StudioTableHeaderAudit={inventory:()=>[...document.querySelectorAll('table')].map((t,i)=>({table:i+1,headers:[...t.querySelectorAll('thead th')].map(h=>({shown:h.textContent.trim(),full:h.dataset.fullColumnTitle||h.textContent.trim()}))}))};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
