/* 4Ds Portfolio Sim — actual simulated per-day stage journey.
   Whole-account counts are taken from trial #1; other figures are cross-trial averages. */
(function(root){
'use strict';
const n=x=>Number.isFinite(Number(x))?Number(x):0;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd=x=>(n(x)<0?'-':'')+'$'+Math.round(Math.abs(n(x))).toLocaleString('en-US');
const fmt=(v,average)=>average?n(v).toFixed(1):String(Math.round(n(v)));
const columns=[
 ['opportunities','Opp','Maximum trading opportunities available on this day'],
 ['tradesToday','Tr','Trades actually executed on this trading day'],
 ['unusedToday','Unused','Daily opportunities not executed because of account or strategy restrictions'],
 ['new','New','New challenges purchased on this trading day'],
 ['challenge','CH','Challenges still in Phase 1 at end of day'],
 ['verification','VR','Verification / Phase 2 at end of day'],
 ['fundedActive','FD','Active funded accounts at end of day'],
 ['fundingWait','FW','Passed but waiting for funded activation capacity'],
 ['targetHit','TG','Cumulative funded accounts that have reached the modeled profit goal'],
 ['paid','PD','Cumulative accounts with first modeled payout received'],
 ['burned','BR','Cumulative failed or risk-exhausted accounts'],
 ['dailySpend','Fees','Challenge and activation spending on this day'],
 ['dailyReceipts','Cash in','First-payout receipts on this day']
];
const diff=(row,prev,key)=>n(row?.[key])-n(prev?.[key]);
function daily(rows,averages=false,onlyChanges=true){
 const all=(rows||[]).map((r,i)=>{
  const prior=i?rows[i-1]:null;
  return {...r,new:diff(r,prior,'bought'),
   newBurned:diff(r,prior,'burned'),
   dailySpend:diff(r,prior,'spent'),dailyReceipts:diff(r,prior,'receipts'),
   paidToday:diff(r,prior,'paid'),hitToday:diff(r,prior,'targetHit')};
 });
 const changes=['bought','burned','challenge','verification','fundedActive','fundingWait',
  'targetHit','paid','spent','receipts','passed1','passed2','activated'];
 return onlyChanges?all.filter((row,i)=>i===0||changes.some(key=>Math.abs(diff(row,all[i-1],key))>1e-9)):all;
}
function combined(list,inputs){
 const days=Math.max(0,Math.floor(n(inputs.days)));
 const keys=['spent','receipts','net','paid','bought','challengeSpent','activationSpent','live','burned',
  'challenge','verification','fundedActive','fundingWait','targetHit','activated','passed1','passed2',
  'opportunities','tradesToday','unusedToday'];
 function sumRow(day,sample){
  const row={day};
  for(const k of keys)row[k]=list.reduce((total,r)=>total+n((sample?r.sample?.dailyCash:r.cashCurve)?.[day]?.[k]),0);
  return row;
 }
 return {
  plan:null,count:list.reduce((x,r)=>x+n(r.count),0),
  cashCurve:Array.from({length:days+1},(_,day)=>sumRow(day,false)),
  sample:{dailyCash:Array.from({length:days+1},(_,day)=>sumRow(day,true)),accountDetails:[]}
 };
}
function options(list,chosen){
 return list.map(([value,label])=>'<option value="'+esc(value)+'"'+(value===chosen?' selected':'')+'>'+esc(label)+'</option>').join('');
}
function sampleMilestones(r){
 const acs=r?.sample?.accountDetails||[];
 if(!acs.length)return '<p class="sim-empty">Choose an individual firm to see example account milestones.</p>';
 const milestones=acs.map(ac=>{
  const passed1=ac.passes?.find(x=>x.stage==='p1')?.day;
  const passed2=ac.passes?.find(x=>x.stage==='p2')?.day;
  const parts=[
   ['Purchased',ac.purchaseDay],
   ...(r.plan.stageList.includes('p1')?[['Challenge passed',passed1]]:[]),
   ...(r.plan.stageList.includes('p2')?[['Verification passed',passed2]]:[]),
   ['Funded activated',ac.fundedActivatedDay],
   ['Funded goal reached',ac.fundedTargetDay],
   ['First payout',ac.paidDay],
   ['Burned',ac.closedDay]
  ].filter(([,day])=>day!==undefined&&day!==null);
  return '<div class="journey-account"><strong>Account #'+ac.id+'</strong><span class="journey-status">'+
   esc(ac.status.toUpperCase())+'</span><div class="journey-milestones">'+
   parts.map(([label,day])=>'<span title="'+esc(label)+'"><b>D'+day+'</b> '+esc(label)+'</span>').join('')+
   '</div></div>';
 }).join('');
 return '<details class="journey-milestone-panel"><summary>Account-by-account milestones · first '+
  acs.length+' accounts in trial #1</summary><div class="journey-accounts">'+milestones+'</div>'+
  '<p class="hint">Milestones follow the simulation’s stage and payout assumptions. A passed evaluation may enter the next stage only on a later tradable day.</p></details>';
}
function render({results=[],inputs={},selection='',mode='trial',onlyChanges=true}={}){
 if(!results.length)return '<p class="hint">Run a Portfolio Sim calculation to see account journeys.</p>';
 const split=inputs.budgetMode==='split';
 const choices=results.map((r,i)=>[String(i),r.plan.firm+' · '+r.plan.programName+' · '+usd(r.plan.size)]);
 if(split)choices.unshift(['all','Combined split portfolio']);
 const selected=choices.some(([key])=>key===selection)?selection:(split?'all':'0');
 const r=selected==='all'?combined(results,inputs):results[Number(selected)];
 const average=mode==='average',raw=average?r.cashCurve:r.sample?.dailyCash;
 const rows=daily(raw,average,onlyChanges);
 const span=r.plan?.stageList?.includes('p2')?'Verification / Phase 2':'Verification (N/A for 1-step)';
 const header='<div class="journey-toolbar">'+
  '<label>Account / portfolio<select data-journey-field="selection">'+options(choices,selected)+'</select></label>'+
  '<label>Show results<select data-journey-field="mode">'+options([['trial','Trial #1 · actual counts'],['average','Mean across '+n(inputs.trials)+' trials']],average?'average':'trial')+'</select></label>'+
  '<label>Days<select data-journey-field="onlyChanges">'+options([['true','Changes only'],['false','Every trading day']],onlyChanges?'true':'false')+'</select></label></div>';
 const note='<p class="journey-explainer"><b>Opp</b> = available opportunities, <b>Tr</b> = trades actually placed, <b>Unused</b> = remaining opportunities. A first loss stops that account for the day, a reached goal can stop further trades, and each phase has a separate max-win setting. D = simulated trading day, not a calendar date. '+
  '<b>CH</b> is Phase 1, <b>VR</b> is verification, <b>FD</b> is active funded, '+
  '<b>TG</b> and <b>PD</b> are cumulative targets hit and first payouts (TG may include paid accounts), '+
  '<b>BR</b> is cumulative burned. End-of-day stage totals and cumulative milestones overlap; do not add them. '+
  esc(span)+'. New and Fees are daily changes.</p>';
 const table='<div class="tablewrap journey-tablewrap"><table class="journey-table"><thead><tr><th>Day</th>'+
  columns.map(([key,label,help])=>'<th title="'+esc(help)+'">'+label+'</th>').join('')+
  '</tr></thead><tbody>'+rows.map(r=>'<tr><th scope="row">D'+r.day+'</th>'+
    columns.map(([key])=>'<td class="num">'+(key==='dailySpend'||key==='dailyReceipts'?usd(r[key]):fmt(r[key],average))+'</td>').join('')+
    '</tr>').join('')+'</tbody></table></div>';
 const svg=root.StudioPortfolioCharts?.svgLine;
 const allRows=raw||[];
 const chart1=svg?svg([
  {name:'CH',values:allRows.map(d=>({x:d.day,y:n(d.challenge)}))},
  {name:'VR',values:allRows.map(d=>({x:d.day,y:n(d.verification)}))},
  {name:'FD',values:allRows.map(d=>({x:d.day,y:n(d.fundedActive)}))}
 ],'Trading day','count'):'';
 const chart2=svg?svg([
  {name:'Target hit',values:allRows.map(d=>({x:d.day,y:n(d.targetHit)}))},
  {name:'Paid',values:allRows.map(d=>({x:d.day,y:n(d.paid)}))},
  {name:'Burned',values:allRows.map(d=>({x:d.day,y:n(d.burned)}))}
 ],'Trading day','count'):'';
 const utilization=svg?svg([
  {name:'Available',values:allRows.map(d=>({x:d.day,y:n(d.opportunities)}))},
  {name:'Executed',values:allRows.map(d=>({x:d.day,y:n(d.tradesToday)}))}
 ],'Trading day','count'):'';
 const graphs='<div class="journey-chart-grid"><article><h4>Accounts by active stage</h4>'+
  chart1+'</article><article><h4>Cumulative milestones</h4>'+chart2+'</article>'+
  '<article><h4>Daily trade opportunities vs executed</h4>'+utilization+'</article></div>';
 const last=allRows[allRows.length-1]||{},paid=fmt(last.paid,average);
 const used=allRows.reduce((sum,x)=>sum+n(x.tradesToday),0);
 const possible=allRows.reduce((sum,x)=>sum+n(x.opportunities),0);
 const utilized=possible>0?100*used/possible:0;
 const total='<p class="journey-status-line">'+(average?'Average portfolio':'Trial #1')+' · '+
  'Trading opportunities '+fmt(possible,average)+' · Executed '+fmt(used,average)+
  ' · Utilization '+utilized.toFixed(1)+'% · '+
  'Bought '+fmt(last.bought,average)+' · Funded activated '+fmt(last.activated,average)+
  ' · Goal hit '+fmt(last.targetHit,average)+' · Paid '+paid+
  ' · Burned '+fmt(last.burned,average)+
  ' · Spent '+usd(last.spent)+' · Received '+usd(last.receipts)+'</p>';
 return header+total+table+graphs+(!average&&selected!=='all'?sampleMilestones(r):'')+note;
}
root.StudioPortfolioJourney={render,daily,combined,sampleMilestones};
})(typeof window!=='undefined'?window:globalThis);
