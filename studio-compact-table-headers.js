/* Shared table-header presentation for all Trading Studio pages. No model changes. */
(function(){'use strict';
const short=new Map(Object.entries({
'Trading Signals':'Signals','Total Signals':'Signals','Trading opportunities':'Signals','Trading Opportunities':'Signals','Opportunities':'Opps','Signals available':'Signals','Unused signals':'Unused',
'Qualification':'Qual.','Qualification trades':'Qual.','Qualified Accounts':'Qual.','Evaluation':'Eval','Evaluation Accounts':'Eval','Verification':'Verif.','Verification active':'Verif.','Verification Accounts':'Verif.','Challenge active':'Challenge','Challenges purchased':'Bought',
'Funded Accounts':'Funded','Funded active':'Funded','Funded activated':'Funded','Funding wait':'Wait','Payout pending':'Pending','Paid accounts':'Paid','Failed accounts':'Failed','Risk blocked':'Blocked','Executed trades':'Executed','Account events':'Events',
'Total Purchased':'Bought','Accounts Purchased':'Bought','Total Spending':'Spent','Total Spent':'Spent','Net Profit':'Net','Net P&L':'Net','Return on Investment':'ROI %','ROI (%)':'ROI %','Win Rate':'WR %','Win Rate (%)':'WR %','Maximum Drawdown':'Max DD','Average Trades':'Avg Trades','Average Trade Count':'Avg Trades',
'Firm / account':'Firm / Acc.','Challenges':'Bought','Phase 1 passes':'P1 pass','Phase 2 passes':'P2 pass','Chance ≥1 payout':'Payout %','Payouts avg.':'Avg payout','Expected payouts':'Exp. payout','Expected net':'Exp. net','Expected ROI':'Exp. ROI','Chance of goal':'Goal %','Chance of ≥50% loss':'Loss ≥50%','Chance cash positive':'Positive %',
'Trading day':'Day','Outcome / event':'Event','Stage / milestone':'Milestone','Average accounts':'Avg acc.','From previous':'Prev.','Date / time':'Date','Account types':'Acc. types','Simulation inputs':'Inputs','Stage outcome':'Outcome','Allocated budget':'Budget','Cumulative net':'Cum. net','Total expected net profit':'Exp. net',
'Stop loss (USD)':'SL $','Winning profit (USD)':'Win $','Order / risk tier':'Risk tier','Accounts per shared signal':'Acc./signal','Avg. trades all attempts':'Avg trades','Avg. trades successful':'Win trades','Avg. active days successful':'Win days','Risk exhausted':'Exhausted',
'Closing equity':'Equity','Max drawdown':'Max DD','Profit / loss':'P/L','Net trading P/L':'Net P/L','Traded days':'Days','Daily usage':'Daily use','Loss headroom':'Headroom','Stage progress':'Progress','Allocation policy':'Policy','Allocation method':'Method','Mean net cash':'Mean net','P10 net cash':'P10 net','Mean failed':'Failed','Mean funded':'Funded','Median net':'Med. net','Median payout cash':'Med. payout','Difference (B − A)':'Diff.','P10 / P90 net':'P10/P90',
'JJ benchmark scenario':'JJ benchmark','FTMO planning scenario':'FTMO plan','Proper interpretation':'Meaning','Metric / source':'Metric','Expected paid':'Exp. paid','Stage P/L':'Stage P/L','Daily trades by account':'Daily trades'
}));
const norm=s=>s.replace(/\s+/g,' ').trim();
function abbreviate(s){return short.get(norm(s))||norm(s);}
function headers(root){const out=[];if(root.nodeType===1&&root.matches?.('table thead th'))out.push(root);root.querySelectorAll?.('table thead th').forEach(x=>out.push(x));return out;}
function apply(root){
 for(const th of headers(root)){
  // Only edit a single plain text node. Never rewrite sort buttons, HTML or data keys.
  const nodes=[...th.childNodes].filter(n=>n.nodeType===3&&norm(n.textContent));
  if(nodes.length!==1)continue;
  const node=nodes[0],original=norm(node.textContent),display=abbreviate(original);
  if(display===original)continue;
  if(!th.dataset.studioFullHeading)th.dataset.studioFullHeading=original;
  if(!th.title)th.title=original;
  node.textContent=node.textContent.replace(original,display);
 }
 const panels=[];
 if(root.nodeType===1&&root.matches?.('#journeyContents button[aria-label="Filter columns"] + div'))panels.push(root);
 root.querySelectorAll?.('#journeyContents button[aria-label="Filter columns"] + div').forEach(x=>panels.push(x));
 for(const panel of panels)for(const label of panel.querySelectorAll('label')){
  for(const node of label.childNodes){
   if(node.nodeType!==3)continue;
   const full=norm(node.textContent),display=abbreviate(full);
   if(full!==display){if(!label.title)label.title=full;node.textContent=node.textContent.replace(full,display);}
  }
 }
}
function closePopovers(e){
 for(const trigger of document.querySelectorAll('#journeyContents button[aria-label="Filter columns"]')){
  const panel=trigger.nextElementSibling;
  if(!panel||panel.hidden||trigger.contains(e.target)||panel.contains(e.target))continue;
  panel.hidden=true;trigger.setAttribute('aria-expanded','false');
 }
}
function init(){
 apply(document);
 // Observe dynamically rendered tables without rewriting cells or changing saved column identities.
 const observer=new MutationObserver(records=>{
  const roots=new Set();
  for(const r of records){if(r.type==='childList')for(const n of r.addedNodes){if(n.nodeType===1)roots.add(n);}}
  for(const root of roots)apply(root);
  if(roots.size&&document.getElementById('journeyContents'))apply(document.getElementById('journeyContents'));
 });
 observer.observe(document.body,{childList:true,subtree:true});
 document.addEventListener('pointerdown',closePopovers,true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const trigger of document.querySelectorAll('#journeyContents button[aria-label="Filter columns"]')){const panel=trigger.nextElementSibling;if(panel&&!panel.hidden){panel.hidden=true;trigger.setAttribute('aria-expanded','false');}}});
 // Read-only audit helper: inventory every rendered table/header, including dynamic tables.
 window.StudioTableHeaderAudit={inventory:()=>[...document.querySelectorAll('table')].map((t,i)=>({table:i+1,headers:[...t.querySelectorAll('thead th')].map(h=>({shown:norm(h.textContent),full:h.dataset.studioFullHeading||norm(h.textContent)}))}))};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
