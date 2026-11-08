/* Shared short table headings; no model or data mutations. */
(function(){'use strict';
const aliases=new Map(Object.entries({
'Trading Signals':'Signals','Total Signals':'Signals','Opportunities':'Opps','Trading Opportunities':'Opps',
'Qualification':'Qual.','Qualified Accounts':'Qual.','Evaluation':'Eval','Evaluation Accounts':'Eval',
'Verification':'Verif.','Verification Accounts':'Verif.','Funded Accounts':'Funded',
'Total Purchased':'Bought','Accounts Purchased':'Bought','Total Spending':'Spent','Total Spent':'Spent',
'Net Profit':'Net','Net P&L':'Net','Return on Investment':'ROI %','ROI (%)':'ROI %',
'Win Rate':'WR %','Win Rate (%)':'WR %','Maximum Drawdown':'Max DD',
'Average Trades':'Avg Trades','Average Trade Count':'Avg Trades'
}));
function shorten(root){const headers=[];if(root.nodeType===1&&root.matches?.('thead th'))headers.push(root);root.querySelectorAll?.('thead th').forEach(x=>headers.push(x));for(const th of headers){if(th.dataset.studioCompactDone==='1')continue;const nodes=[...th.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim());if(nodes.length!==1)continue;const node=nodes[0],old=node.textContent.trim(),short=aliases.get(old);if(!short)continue;if(!th.hasAttribute('title'))th.title=old;node.textContent=node.textContent.replace(old,short);th.dataset.studioCompactDone='1';}}
function init(){shorten(document);const observer=new MutationObserver(records=>{for(const r of records){for(const n of r.addedNodes){if(n.nodeType===1)shorten(n);}}});observer.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
