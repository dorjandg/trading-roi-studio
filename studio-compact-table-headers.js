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
// Common dynamic Account Journey, cash-flow and funnel headings.
for(const [full,abbr] of Object.entries({
'Funded allocation ($)':'Fund 
function abbreviate(s){
 const label=norm(s),exact=short.get(label);
 if(exact)return exact;
 // Keep unknown metric labels accurate. Abbreviate only well-defined words,
 // never replace the whole heading with an ambiguous or truncated code.
 if(label.length<=16)return label;
 const replacements=[[/\\ballocation\\b/gi,'Alloc.'],[/\\bqualification\\b/gi,'Qual.'],[/\\bverification\\b/gi,'Verif.'],[/\\bevaluation\\b/gi,'Eval'],[/\\bchallenges\\b/gi,'Chall.'],[/\\bexpected\\b/gi,'Exp.'],[/\\baverage\\b/gi,'Avg'],[/\\bcumulative\\b/gi,'Cum.'],[/\\bprobability\\b/gi,'Prob.'],[/\\bmaximum\\b/gi,'Max'],[/\\bminimum\\b/gi,'Min'],[/\\bpurchased\\b/gi,'Bought'],[/\\baccounts\\b/gi,'Acc.'],[/\\btrading\\b/gi,'Trade'],[/\\bprofits?\\b/gi,'P/L'],[/\\bpercentage\\b/gi,'%']];
 let compact=label;for(const [re,to] of replacements)compact=compact.replace(re,to);
 return compact;
}
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
,'Evaluation allocation ($)':'Eval 
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
,'Purchased allocation ($)':'Buy 
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
,
'New accounts':'New','Purchased allocation':'Buy 
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
,'Evaluation allocation':'Eval 
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
,'Funded allocation':'Fund 
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
,
'Phase 1 passed':'P1 pass','Phase 2 passed':'P2 pass','Phase 3 passed':'P3 pass',
'Challenge':'Chall.','Verification active':'Verif.','Funded activated':'Funded',
'Paid today':'Paid today','Payout pending':'Pending','Payout received':'Received',
'Paid accounts':'Paid','Paid account count':'Paid','Failed accounts':'Failed',
'Average accounts':'Avg acc.','Account count':'Accounts','Account status':'Status',
'Net cash flow':'Net cash','Cumulative cash flow':'Cum. cash','Cumulative profit':'Cum. P/L',
'Payout amount ($)':'Payout 
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
,'Account balance ($)':'Balance 
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
,
'Challenge cost ($)':'Cost 
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
,'Risk per trade ($)':'Risk 
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
,
'Profit target ($)':'Target 
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
,'Maximum daily loss ($)':'Daily DD 
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
,
'Average funded accounts':'Avg funded','Expected funded accounts':'Exp. funded',
'Average payout ($)':'Avg payout','Payout probability':'Payout %',
'Account purchase cost':'Buy cost','Accounts purchased':'Bought',
'Portfolio net profit':'Net','Net profit ($)':'Net 
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
,'Expected net profit':'Exp. net',
'Expected return on investment':'Exp. ROI','Trading opportunities':'Signals',
'Qualification trades':'Qual.','Total trades':'Trades','Total signals':'Signals',
'Funded account allocation ($)':'Fund 
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
,'Evaluation account allocation ($)':'Eval 
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
,
'Challenge accounts':'Challenge','Verification accounts':'Verif.',
'Expected accounts':'Exp. acc.','Average active days':'Avg days',
'Average successful trades':'Win trades','Probability of payout':'Payout %',
'Probability of reaching goal':'Goal %','Maximum loss':'Max loss',
'Withdrawal amount':'Withdraw 
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
,'Withdrawals':'Withdrawals',
'Average daily loss':'Avg loss','Daily loss limit':'Daily limit',
'Net return on investment':'Net ROI','Trading days':'Days',
'Risk blocked':'Blocked','Executed trades':'Executed',
'Account events':'Events','Qualification trades':'Qual.'
}))short.set(full,abbr);
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
