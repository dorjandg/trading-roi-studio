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
 ['bought','TOT','Total challenges purchased cumulatively through this trading day'],
 ['purchasedAllocation','Buy $','Cumulative nominal value of purchased accounts'],
 ['evaluationAllocation','Eval $','Current Challenge plus Verification nominal allocation'],
 ['fundedAllocation','FD $','Current active Funded nominal allocation'],
 ['challenge','CH','Challenges still in Phase 1 at end of day'],
 ['passed1','P1P','Cumulative accounts that passed Phase 1 / Challenge'],
 ['verification','VR','Verification / Phase 2 at end of day'],
 ['passed2','P2P','Cumulative accounts that passed Phase 2 / Verification'],
 ['fundedActive','FD','Active funded accounts at end of day'],
 ['activated','FA','Cumulative accounts activated as Funded'],
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
 // Include days with actual trades, even when the account stays in the same
 // phase; otherwise an "Activity" view hides all trading from the user.
 return onlyChanges?all.filter((row,i)=>i===0||row.tradesToday>0||
  changes.some(key=>Math.abs(diff(row,all[i-1],key))>1e-9)):all;
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
function sampleMilestones(r,signalDay='1'){
 const acs=r?.sample?.accountDetails||[];
 if(!acs.length)return '<p class="sim-empty">No accounts were purchased in this sampled trial.</p>';
 const day=x=>x==null?'—':'D'+x;
 const stage=ac=>{
  if(ac.status==='paid')return 'Paid';
  if(ac.status==='failed')return 'Failed';
  if(ac.status==='exhausted')return 'Risk blocked';
  if(ac.status==='activation-wait')return 'Awaiting activation';
  return ac.status==='active'?(r.plan?.stageList?.[ac.stageIndex]==='p1'?'Challenge':
   r.plan?.stageList?.[ac.stageIndex]==='p2'?'Verification':'Funded'):'Pending';
 };
 const counts={challenge:0,verification:0,funded:0,closed:0};
 const rows=acs.map(ac=>{
  const name=stage(ac);
  if(name==='Challenge')counts.challenge++;
  if(name==='Verification')counts.verification++;
  if(name==='Funded')counts.funded++;
  if(name==='Failed'||name==='Risk blocked')counts.closed++;
  const p1=ac.passes?.find(x=>x.stage==='p1')?.day;
  const p2=ac.passes?.find(x=>x.stage==='p2')?.day;
  return '<tr><th scope="row">#'+ac.id+'</th><td>'+day(ac.purchaseDay)+'</td>'+
   '<td>'+ac.trades+'</td><td>'+ac.wins+'</td><td>'+ac.losses+'</td>'+
   '<td>'+esc(name)+'</td><td>'+day(p1)+'</td><td>'+day(p2)+'</td>'+
   '<td>'+day(ac.fundedActivatedDay)+'</td><td>'+day(ac.fundedTargetDay)+'</td>'+
   '<td>'+day(ac.paidDay)+'</td><td>'+day(ac.closedDay)+'</td></tr>';
 }).join('');
 const ledger='<details class="journey-milestone-panel"><summary>All '+acs.length+
  ' purchased accounts · trade totals, stage progress and exit dates</summary>'+
  '<div class="journey-account-totals">Now: CH '+counts.challenge+
  ' · VR '+counts.verification+' · FD '+counts.funded+
  ' · Burned '+counts.closed+'</div>'+
  '<div class="tablewrap journey-ledger-table"><table><thead><tr>'+
  ['Account','Bought','Tr','W','L','Status','P1 pass','P2 pass',
   'Funded','Target','Payout','Burned'].map(k=>'<th>'+k+'</th>').join('')+
  '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
  '<p class="hint">All purchased accounts are retained. “Status” is the final status of this illustrative trial, while the day columns show when milestones occurred.</p></details>';
 const assignments=r?.sample?.tradeAssignments||[];
 const dates=[...new Set(assignments.map(a=>a.day))].sort((x,y)=>x-y);
 const chosen=signalDay==='all'||dates.includes(Number(signalDay))?signalDay:String(dates[0]||1);
 const filtered=chosen==='all'?assignments:assignments.filter(a=>a.day===Number(chosen));
 const routeDays=[['all','All trading days'],...dates.map(x=>[String(x),'D'+x])];
 const routeOptions=routeDays.map(([value,label])=>'<option value="'+esc(value)+'"'+
  (value===chosen?' selected':'')+'>'+esc(label)+'</option>').join('');
 const routeRows=filtered.map(a=>'<tr><th>D'+a.day+'</th><td>Trade '+a.signal+'</td>'+
  '<td>'+(a.account==null?'—':'Account #'+a.account)+'</td>'+
  '<td>'+esc(a.stage?.toUpperCase()||'—')+'</td><td>'+esc(a.outcome)+'</td>'+
  '<td>'+esc(a.status||'')+'</td></tr>').join('');
 const route='<details class="journey-milestone-panel"'+(signalDay!=='1'?' open':'')+'>'+
  '<summary>Daily signal routing · Trade 1 → Account 1, Trade 2 → Account 2, etc.</summary>'+
  '<label class="journey-route-filter">Trading day <select data-journey-field="signalDay">'+routeOptions+'</select></label>'+
  '<div class="tablewrap journey-ledger-table"><table><thead><tr>'+
  '<th>Day</th><th>Signal</th><th>Assigned to</th><th>Stage</th><th>Outcome</th><th>Account status</th>'+
  '</tr></thead><tbody>'+routeRows+'</tbody></table></div>'+
  '<p class="hint">Each signal is assigned to a different eligible account. “Unused” means no eligible account could take that signal. Previously purchased accounts return to the selection pool on future days unless they have closed or are waiting for a stage/payout milestone.</p></details>';
 const firstDay=assignments.filter(x=>x.day===1);
 const preview=firstDay.length?'<p class="journey-routing-preview"><strong>Day 1 routing:</strong> '+
  firstDay.map(a=>'Trade '+a.signal+' → '+(a.account==null?'unused':'A'+a.account)).join(' · ')+
  '</p>':'';
 return preview+ledger+route;
}
function render({results=[],inputs={},selection='',mode='trial',onlyChanges=true,signalDay='1'}={}){
 if(!results.length)return '<p class="hint">Run a Portfolio Sim calculation to see account journeys.</p>';
 const split=inputs.budgetMode==='split';
 const choices=results.map((r,i)=>[String(i),r.plan.firm+' · '+r.plan.programName+' · '+usd(r.plan.size)]);
 if(split)choices.unshift(['all','Combined split portfolio']);
 const selected=choices.some(([key])=>key===selection)?selection:(split?'all':'0');
 const r=selected==='all'?combined(results,inputs):results[Number(selected)];
 const average=mode==='average',raw=average?r.cashCurve:r.sample?.dailyCash;
 const allRows=(raw||[]).map((d,i)=>({...d,
  purchasedAllocation:selected==='all'?results.reduce((t,a)=>t+n((average?a.cashCurve:a.sample?.dailyCash)?.[i]?.bought)*n(a.plan.size),0):n(d.bought)*n(r.plan.size),
  evaluationAllocation:selected==='all'?results.reduce((t,a)=>t+(n((average?a.cashCurve:a.sample?.dailyCash)?.[i]?.challenge)+n((average?a.cashCurve:a.sample?.dailyCash)?.[i]?.verification))*n(a.plan.size),0):(n(d.challenge)+n(d.verification))*n(r.plan.size),
  fundedAllocation:selected==='all'?results.reduce((t,a)=>t+n((average?a.cashCurve:a.sample?.dailyCash)?.[i]?.fundedActive)*n(a.plan.size),0):n(d.fundedActive)*n(r.plan.size)
 }));
 const rows=daily(allRows,average,onlyChanges);
 const cap=selected==='all'?{}:inputs.allocationLimits?.[r.plan.id+':'+r.plan.size]||{};
 const exceeds=d=>(n(cap.evaluation)>0&&d.evaluationAllocation>n(cap.evaluation))||(n(cap.funded)>0&&d.fundedAllocation>n(cap.funded));
 const span=r.plan?.stageList?.includes('p2')?'Verification / Phase 2':'Verification (N/A for 1-step)';
 const header='<div class="journey-toolbar">'+
  '<label>Account / portfolio<select data-journey-field="selection">'+options(choices,selected)+'</select></label>'+
  '<label>Show results<select data-journey-field="mode">'+options([['trial','Trial #1 · actual counts'],['average','Mean across '+n(inputs.trials)+' trials']],average?'average':'trial')+'</select></label>'+
  '<label>Days<select data-journey-field="onlyChanges">'+options([['true','Trades & stage changes'],['false','Every trading day']],onlyChanges?'true':'false')+'</select></label>'+ 
  (selected==='all'?'':'<label>Evaluation allocation limit ($)<input type="number" min="0" step="10000" placeholder="No limit set" data-journey-field="evaluationLimit" value="'+(n(cap.evaluation)||'')+'"></label>'+ 
  '<label>Funded allocation limit ($)<input type="number" min="0" step="10000" placeholder="No limit set" data-journey-field="fundedLimit" value="'+(n(cap.funded)||'')+'"></label>')+'</div>';
 const note='<p class="journey-explainer"><b>Opp</b> = available opportunities, <b>Tr</b> = trades actually placed, <b>Unused</b> = remaining opportunities. A first loss stops that account for the day, a reached goal can stop further trades, and each phase has a separate max-win setting. D = simulated trading day, not a calendar date. '+
  '<b>New</b> is purchases today; <b>TOT</b> is all purchased to date. '+
  '<b>CH</b>, <b>VR</b>, and <b>FD</b> show current active accounts at each stage. '+
  '<b>P1P</b>, <b>P2P</b>, and <b>FA</b> are cumulative accounts passed Phase 1, passed Phase 2, and activated as Funded. '+
  '<b>TG</b> and <b>PD</b> are cumulative targets hit and first payouts (TG may include paid accounts), '+
  '<b>BR</b> is cumulative burned. Cumulative milestones overlap, so never add TOT, P1P, P2P, FA, TG, PD and BR together. '+
  esc(span)+'. New and Fees are daily changes.</p>';
 const table='<div class="tablewrap journey-tablewrap"><table class="journey-table"><thead><tr><th>Day</th>'+
  columns.map(([key,label,help])=>'<th title="'+esc(help)+'">'+label+'</th>').join('')+
  '</tr></thead><tbody>'+rows.map(r=>'<tr'+(exceeds(r)?' style="background:rgba(255,132,148,.13)"':'')+'><th scope="row">D'+r.day+(exceeds(r)?' ⚠':'')+'</th>'+
    columns.map(([key])=>'<td class="num">'+(key==='dailySpend'||key==='dailyReceipts'||key.endsWith('Allocation')?usd(r[key]):fmt(r[key],average))+'</td>').join('')+
    '</tr>').join('')+'</tbody></table></div>';
 const svg=root.StudioPortfolioCharts?.svgLine;
 const detailRows=Object.fromEntries(allRows.map((d,i)=>[d.day,[
  ['Trades executed',fmt(d.tradesToday,average)+' / '+fmt(d.opportunities,average)],
  ['New accounts',fmt(i===0?d.bought:n(d.bought)-n(allRows[i-1].bought),average)],
  ['Purchased total',fmt(d.bought,average)],
  ['Purchased allocation',usd(d.purchasedAllocation)],
  ['Evaluation allocation',usd(d.evaluationAllocation)],
  ['Funded allocation',usd(d.fundedAllocation)],
  ['Phase 1 passed',fmt(d.passed1,average)],
  ['Phase 2 passed',fmt(d.passed2,average)],
  ['Funded activated',fmt(d.activated,average)],
  ['Funded target hit',fmt(d.targetHit,average)],
  ['First payouts',fmt(d.paid,average)],
  ['Failed / burned',fmt(d.burned,average)],
  ['Total spent',usd(d.spent)],
  ['Total receipts',usd(d.receipts)],
  ['Net cash',usd(d.net)]
 ]]));
 const chart1=svg?svg([
  {name:'CH',values:allRows.map(d=>({x:d.day,y:n(d.challenge)}))},
  {name:'VR',values:allRows.map(d=>({x:d.day,y:n(d.verification)}))},
  {name:'FD',values:allRows.map(d=>({x:d.day,y:n(d.fundedActive)}))}
 ],'Trading day','count',detailRows):'';
 const chart2=svg?svg([
  {name:'Target hit',values:allRows.map(d=>({x:d.day,y:n(d.targetHit)}))},
  {name:'Paid',values:allRows.map(d=>({x:d.day,y:n(d.paid)}))},
  {name:'Burned',values:allRows.map(d=>({x:d.day,y:n(d.burned)}))}
 ],'Trading day','count',detailRows):'';
 const utilization=svg?svg([
  {name:'Available',values:allRows.map(d=>({x:d.day,y:n(d.opportunities)}))},
  {name:'Executed',values:allRows.map(d=>({x:d.day,y:n(d.tradesToday)}))}
 ],'Trading day','count',detailRows):'';
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
  ' · Eval '+usd(last.evaluationAllocation)+' · Funded '+usd(last.fundedAllocation)+
  ' · Spent '+usd(last.spent)+' · Received '+usd(last.receipts)+'</p>';
 const capInfo=selected==='all'?'Combined nominal allocation across different firms; firm limits are separate.':'Planning limits: Evaluation '+(n(cap.evaluation)>0?usd(cap.evaluation):'not set')+' · Funded '+(n(cap.funded)>0?usd(cap.funded):'not set')+'. Breaches are highlighted, not blocked.';
 return header+total+'<p class="journey-explainer">'+capInfo+'</p>'+table+graphs+(!average&&selected!=='all'?sampleMilestones(r,signalDay):'')+note;
}
root.StudioPortfolioJourney={render,daily,combined,sampleMilestones};
})(typeof window!=='undefined'?window:globalThis);
