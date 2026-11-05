/* 4Ds Portfolio Sim | lightweight local SVG chart rendering */
(function(root){
'use strict';
const N=x=>Number.isFinite(Number(x))?Number(x):0;
const e=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd=x=>(N(x)<0?'-':'')+'$'+Math.round(Math.abs(N(x))).toLocaleString('en-US');
const tick=x=>{const v=Math.abs(N(x));return(N(x)<0?'-':'')+'$'+(v>=1e6?(v/1e6).toFixed(1)+'m':v>=1000?(v/1000).toFixed(1)+'k':Math.round(v))};
function svgLine(lines,xTitle='Day',unit='usd'){
 const good=lines.map((s,i)=>({name:s.name,color:['var(--green)','var(--blue)','var(--amber)'][i%3],dash:!!s.dash,
  values:(s.values||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))})).filter(s=>s.values.length>0);
 if(!good.length)return '<p class="sim-empty">No simulation values to graph.</p>';
 const W=660,H=200,L=66,R=15,T=12,B=28,w=W-L-R,h=H-T-B;
 const allX=good.flatMap(s=>s.values.map(p=>p.x)),allY=good.flatMap(s=>s.values.map(p=>p.y));
 const minX=Math.min(...allX),maxX=Math.max(...allX),min0=Math.min(0,...allY),max0=Math.max(0,...allY);
 const span=Math.max(1,max0-min0),low=min0-span*.08,high=max0+span*.08;
 const X=x=>L+(x-minX)/Math.max(1,maxX-minX)*w,Y=y=>T+(high-y)/(high-low)*h;
 const f=x=>x.toFixed(2);
 const lab=v=>unit==='usd'?tick(v):N(v).toFixed(1);
 const grid=Array.from({length:5},(_,i)=>{
  const y=T+h*i/4,val=high-(high-low)*i/4;
  return '<line class="sim-grid-line" x1="'+L+'" y1="'+f(y)+'" x2="'+(W-R)+'" y2="'+f(y)+'"/>'+
   '<text class="sim-tick" x="'+(L-7)+'" y="'+f(y+3)+'" text-anchor="end">'+e(lab(val))+'</text>';
 }).join('');
 const zero=low<0&&high>0?'<line class="sim-zero" x1="'+L+'" x2="'+(W-R)+'" y1="'+f(Y(0))+'" y2="'+f(Y(0))+'"/>':'';
 const series=good.map(s=>{
  const path=s.values.map((p,i)=>(i?'L':'M')+f(X(p.x))+','+f(Y(p.y))).join(' ');
  const step=Math.max(1,Math.ceil(s.values.length/80));
  const markers=s.values.filter((_,i)=>i%step===0||i===s.values.length-1).map(p=>
   '<circle class="sim-pt" cx="'+f(X(p.x))+'" cy="'+f(Y(p.y))+'" r="3.0" fill="'+s.color+'"><title>'+
    e(s.name+' · '+xTitle+' '+p.x+' · '+(unit==='usd'?usd(p.y):N(p.y).toFixed(2)))+'</title></circle>').join('');
  return '<path fill="none" stroke="'+s.color+'" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"'+
    (s.dash?' stroke-dasharray="5 4"':'')+' d="'+path+'"/>'+markers;
 }).join('');
 const ticks=Array.from({length:5},(_,i)=>{
  const x=L+w*i/4,v=minX+(maxX-minX)*i/4;
  return '<text class="sim-tick" x="'+f(x)+'" y="'+(H-7)+'" text-anchor="middle">'+e(maxX-minX>=10?Math.round(v):v.toFixed(1))+'</text>';
 }).join('');
 const legend=good.map(s=>'<span><i style="background:'+s.color+'"></i>'+e(s.name)+'</span>').join('');
 return '<svg class="sim-svg" role="img" aria-label="'+e('Simulated '+xTitle+' chart')+'" viewBox="0 0 '+W+' '+H+'">'+
  grid+zero+series+ticks+'</svg><div class="sim-legend">'+legend+'</div>';
}
function svgBars(items){
 if(!items.length)return '<p class="sim-empty">No account progression available.</p>';
 const W=660,H=200,L=55,R=15,T=12,B=32,w=W-L-R,h=H-T-B;
 const max=Math.max(1,...items.map(x=>N(x.value))),slot=w/items.length,bw=Math.min(66,slot*.62);
 const grids=[0,.5,1].map(fr=>{
  const y=T+h*(1-fr);
  return '<line class="sim-grid-line" x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'"/>'+
   '<text class="sim-tick" x="'+(L-5)+'" y="'+(y+3)+'" text-anchor="end">'+(max*fr).toFixed(1)+'</text>';
 }).join('');
 const bars=items.map((v,i)=>{
  const amount=Math.max(0,N(v.value)),bh=amount/max*h,x=L+slot*i+(slot-bw)/2,y=T+h-bh;
  return '<rect rx="3" fill="var(--green)" x="'+x.toFixed(2)+'" y="'+y.toFixed(2)+'" width="'+bw.toFixed(2)+'" height="'+bh.toFixed(2)+'"><title>'+
   e(v.label+' · '+amount.toFixed(1))+'</title></rect>'+
   '<text class="sim-tick" x="'+(x+bw/2).toFixed(2)+'" y="'+(H-8)+'" text-anchor="middle">'+e(v.label)+'</text>';
 }).join('');
 return '<svg class="sim-svg" role="img" aria-label="Mean account progression to first payout" viewBox="0 0 '+W+' '+H+'">'+grids+bars+'</svg>';
}
function svgHistogram(values,unit='usd'){
 const nums=(values||[]).filter(Number.isFinite);
 if(!nums.length)return '<p class="sim-empty">No trial outcomes available.</p>';
 const lo=Math.min(...nums),hi=Math.max(...nums),span=Math.max(.01,hi-lo),bins=12,counts=Array(bins).fill(0);
 for(const v of nums)counts[Math.min(bins-1,Math.floor((v-lo)/span*bins))]++;
 const W=660,H=200,L=55,R=13,T=12,B=28,w=W-L-R,h=H-T-B,max=Math.max(1,...counts),step=w/bins;
 const bars=counts.map((v,i)=>{
  const x=L+i*step,bh=v/max*h,y=T+h-bh;
  return '<rect fill="var(--blue)" x="'+x.toFixed(2)+'" y="'+y.toFixed(2)+'" width="'+(step-2).toFixed(2)+'" height="'+bh.toFixed(2)+'"><title>'+
    e((unit==='pct'?((lo+span*i/bins).toFixed(1)+'% to '+(lo+span*(i+1)/bins).toFixed(1)+'%'):usd(lo+span*i/bins)+' to '+usd(lo+span*(i+1)/bins))+' · '+v+' trials')+'</title></rect>';
 }).join('');
 const labels=[{x:L,v:lo},{x:L+w/2,v:(lo+hi)/2},{x:L+w,v:hi}].map(t=>
  '<text class="sim-tick" x="'+t.x+'" y="'+(H-7)+'" text-anchor="middle">'+e(unit==='pct'?t.v.toFixed(1)+'%':tick(t.v))+'</text>').join('');
 const grid=[0,.5,1].map(fr=>{
  const y=T+h*(1-fr);
  return '<line class="sim-grid-line" x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'"/>'+
    '<text class="sim-tick" x="'+(L-5)+'" y="'+(y+3)+'" text-anchor="end">'+Math.round(max*fr)+'</text>';
 }).join('');
 return '<svg class="sim-svg" role="img" aria-label="Final net distribution for Monte Carlo trials" viewBox="0 0 '+W+' '+H+'">'+grid+bars+labels+'</svg>';
}
function tradeCurve(ac,stage='all'){
 let net=0,peak=0,maxDD=0,index=0;
 const equity=[{x:0,y:0}],drawdown=[{x:0,y:0}];
 for(const event of ac?.trace||[]){
  if((event.type!=='win'&&event.type!=='loss')||!Number.isFinite(event.delta)||(stage!=='all'&&event.stage!==stage))continue;
  index++;net+=event.delta;peak=Math.max(peak,net);maxDD=Math.max(maxDD,peak-net);
  equity.push({x:index,y:net});drawdown.push({x:index,y:peak-net});
 }
 return {equity,drawdown,trades:index,net,maxDD};
}
function combinedResult(list,inputs){
 const days=Math.max(0,Math.floor(N(inputs.days))),keys=['spent','receipts','net','paid','bought','challengeSpent','activationSpent','live','burned'];
 function cashAt(day,sample){
  const row={day,spent:0,receipts:0,net:0,paid:0};
  for(const r of list)for(const k of keys)row[k]+=N((sample?r.sample?.dailyCash:r.cashCurve)?.[day]?.[k]);
  return row;
 }
 const cashCurve=Array.from({length:days+1},(_,day)=>cashAt(day,false));
 const sample={dailyCash:Array.from({length:days+1},(_,day)=>cashAt(day,true)),accountDetails:[]};
 // Join independently generated trials by their original trial index,
 // never by sorted net ranks (which falsely correlates winning outcomes).
 const nets=Array.from({length:list[0]?.chartTrials?.length||0},(_,i)=>
  list.reduce((total,r)=>total+N(r.chartTrials?.[i]?.net),0)).sort((a,b)=>a-b);
 const avg={spent:0,receipts:0,net:0,funded:0,paid:0,failed:0,exhausted:0,bought:0,activations:0};
 for(const r of list)for(const k of Object.keys(avg))avg[k]+=N(r.avg[k]);
 const quantile=q=>nets.length?nets[Math.min(nets.length-1,Math.floor((nets.length-1)*q))]:0;
 const chartTrials=Array.from({length:list[0]?.chartTrials?.length||0},(_,i)=>{
  const totals={net:0,spent:0,receipts:0,paid:0,failed:0,exhausted:0,funded:0,wins:0,losses:0,trades:0};
  for(const r of list){
   const trial=r.chartTrials?.[i]||{};
   for(const key of Object.keys(totals))totals[key]+=N(trial[key]);
  }
  return {...totals,roi:totals.spent?totals.net/totals.spent:0};
 });
 return {plan:null,chartTrials,count:avg.bought,cashCurve,sample,nets,avg,roi:avg.spent?avg.net/avg.spent:0,
  p10:quantile(.1),median:quantile(.5),p90:quantile(.9),stages:[]};
}
function chartCard(title,info,svg,foot=''){
 return '<article class="sim-chart-card"><h4>'+e(title)+'</h4><p>'+e(info)+'</p>'+svg+
  (foot?'<div class="sim-chart-foot">'+e(foot)+'</div>':'')+'</article>';
}
function stageTrades(ac,stage='all'){
 return (ac?.trace||[]).filter(t=>(t.type==='win'||t.type==='loss')&&(stage==='all'||t.stage===stage));
}
function streaks(ac,stage='all'){
 const trades=stageTrades(ac,stage),counts={W:0,L:0},runs={W:0,L:0};
 let last='',length=0;
 const finish=()=>{if(last&&length>0){const n=Math.min(length,5);runs[last+n]=(runs[last+n]||0)+1}};
 for(const t of trades){
  const label=t.type==='win'?'W':'L';counts[label]++;
  if(label!==last){finish();last=label;length=1}else length++;
 }
 finish();
 return {counts,runs,trades:trades.length};
}
function usage(ac,stage='all'){
 const tiers={r1:0,r2:0,r3:0};
 for(const t of stageTrades(ac,stage))if(Object.prototype.hasOwnProperty.call(tiers,t.slot))tiers[t.slot]++;
 return Object.entries(tiers).map(([k,value])=>({label:k.toUpperCase(),value}));
}
function cashWindow(rows,duration='all'){
 if(duration==='all')return rows||[];
 const days=Math.max(1,parseInt(duration,10)||1);
 const end=rows?.length?rows[rows.length-1].day:0;
 return (rows||[]).filter(d=>d.day>=Math.max(0,end-days+1));
}
function chartOutcome(trials,mode='all'){
 const values=trials||[];
 if(mode==='positive')return values.filter(t=>t.net>0);
 if(mode==='negative')return values.filter(t=>t.net<0);
 if(mode==='payout')return values.filter(t=>t.paid>0);
 if(mode==='no-payout')return values.filter(t=>t.paid===0);
 return values;
}
function render({results=[],inputs={},selection='',account='auto',group='overview',
 daysRange='all',stage='all',cashView='both',outcome='all',filtersOpen=false}={}){
 if(!results.length)return '<p class="sim-empty">Run a simulation to see charts.</p>';
 const split=inputs.budgetMode==='split',allGroups=['overview','cash','trades','risk','all'];
 const activeGroup=allGroups.includes(group)?group:'overview';
 const options=results.map((r,i)=>({id:String(i),label:r.plan.firm+' · '+r.plan.programName+' '+usd(r.plan.size)}));
 if(split)options.unshift({id:'all',label:'Combined split portfolio'});
 const chosen=options.some(x=>x.id===selection)?selection:(split?'all':'0');
 const r=chosen==='all'?combinedResult(results,inputs):results[Number(chosen)];
 const acList=r.sample?.accountDetails||[],acId=acList.some(x=>String(x.id)===String(account))?String(account):'auto';
 const ac=acId==='auto'?(acList.find(a=>a.status==='paid')||acList[0]):acList.find(a=>String(a.id)===acId);
 const stageKey=['all','p1','p2','funded'].includes(stage)?stage:'all';
 const trade=tradeCurve(ac,stageKey),stats=streaks(ac,stageKey);
 const mean=cashWindow(r.cashCurve,daysRange).map(d=>({x:d.day,y:d.net}));
 const example=cashWindow(r.sample?.dailyCash,daysRange).map(d=>({x:d.day,y:d.net}));
 const cashStreams=cashWindow(r.cashCurve,daysRange);
 const streams=[{name:'Payout receipts',values:cashStreams.map(d=>({x:d.day,y:d.receipts}))},
  {name:'Incurred fees',values:cashStreams.map(d=>({x:d.day,y:d.spent}))}];
 const incremental=cashStreams.map((d,i)=>{
  const full=r.cashCurve||[],prev=d.day>0?full[d.day-1]:null;
  return {x:d.day,y:d.net-N(prev?.net)};
 });
 const spendingDays=cashStreams.map(d=>{
  const prev=d.day>0?r.cashCurve?.[d.day-1]:null;
  return {day:d.day,challenge:N(d.challengeSpent)-N(prev?.challengeSpent),
   activation:N(d.activationSpent)-N(prev?.activationSpent),
   purchased:N(d.bought)-N(prev?.bought),
   burned:N(d.burned)-N(prev?.burned),live:N(d.live)};
 });
 const cashLines=[];
 if(cashView!=='example')cashLines.push({name:'Trial average',values:mean});
 if(cashView!=='mean')cashLines.push({name:'Trial #1',values:example,dash:cashLines.length>0});
 const trials=chartOutcome(r.chartTrials,outcome);
 const nets=trials.map(t=>t.net),roi=trials.map(t=>t.roi*100);
 const noTrades='<p class="sim-empty">No sample trades match this stage.</p>';
 const individual=ac&&trade.trades>0;
 const payouts=cashStreams.map(d=>({x:d.day,y:d.paid}));
 const stages=r.plan?
  [{label:'Bought',value:r.avg.bought},...r.plan.stageList.filter(x=>x!=='funded').map((st,i)=>({label:st==='p1'?'P1':'P2',value:r.stages[i]})),
   {label:'Funded',value:r.avg.funded},{label:'Paid',value:r.avg.paid}]:
  [{label:'Bought',value:r.avg.bought},{label:'Funded',value:r.avg.funded},{label:'Paid',value:r.avg.paid}];
 const riskOutcomes=[{label:'Paid',value:r.avg.paid},{label:'Failed',value:r.avg.failed},
  {label:'Blocked',value:r.avg.exhausted}];
 const streakChart=[{label:'W1',value:stats.runs.W1||0},{label:'W2',value:stats.runs.W2||0},
  {label:'W3+',value:(stats.runs.W3||0)+(stats.runs.W4||0)+(stats.runs.W5||0)},
  {label:'L1',value:stats.runs.L1||0},{label:'L2',value:stats.runs.L2||0},
  {label:'L3+',value:(stats.runs.L3||0)+(stats.runs.L4||0)+(stats.runs.L5||0)}];
 const items=[
  {id:'cash-net',groups:['overview','cash'],html:chartCard('Portfolio net cash · by day',
   'Average and first sampled trial. Cash = first payouts minus incurred fees.',
   svgLine(cashLines),'Expected final net: '+usd(r.avg.net))},
  {id:'equity',groups:['overview','trades'],html:chartCard('Trading equity · sample account',
   'Cumulative modeled trade P/L'+(stageKey==='all'?' across phases':' in '+stageKey.toUpperCase()),
   individual?svgLine([{name:'Trade P/L',values:trade.equity}],'Trade'):noTrades,
   individual?'Sample trading P/L: '+usd(trade.net):'')},
  {id:'drawdown',groups:['overview','trades'],html:chartCard('Trading drawdown · sample',
   'Peak-to-trough decline of the chosen sample trades, not the firm loss floor.',
   individual?svgLine([{name:'Drawdown',values:trade.drawdown}],'Trade'):noTrades,
   individual?'Sample maximum drawdown: '+usd(trade.maxDD):'')},
  {id:'net-distribution',groups:['overview','risk'],html:chartCard('Final net distribution',
   'Histogram of '+trials.length+' matching trials'+(outcome!=='all'?' · filtered by outcome':''),
   svgHistogram(nets),'All-trial P10: '+usd(r.p10)+' · P90: '+usd(r.p90))},
  {id:'progression',groups:['overview','risk'],html:chartCard('Account progression',
   'Average number reaching each challenge stage and first payout.',
   svgBars(stages))},
  {id:'first-payouts',groups:['overview','cash'],html:chartCard('First payouts by day',
   'Mean cumulative count of accounts with a first modeled payout.',
   svgLine([{name:'First paid',values:payouts}],'Day','count'))},
  {id:'challenge-spend',groups:['cash'],html:chartCard('New account spending · by day',
   'Daily money spent buying new challenges versus paying funded activation fees.',
   svgLine([{name:'Challenge purchases',values:spendingDays.map(d=>({x:d.day,y:d.challenge}))},
    {name:'Activation fees',values:spendingDays.map(d=>({x:d.day,y:d.activation}))}]),
   'Total challenge purchases: '+usd(r.avg.spent-N(r.avg.activations)*N(r.plan?.activationFee)))},
  {id:'new-vs-burned',groups:['cash'],html:chartCard('New vs burned accounts · daily',
   'Average challenges bought per day and accounts failed or risk-exhausted that day.',
   svgLine([{name:'New accounts',values:spendingDays.map(d=>({x:d.day,y:d.purchased}))},
    {name:'Burned',values:spendingDays.map(d=>({x:d.day,y:d.burned}))}],'Day','count'))},
  {id:'active-accounts',groups:['cash'],html:chartCard('Open accounts · by day',
   'Average open/waiting accounts at day end; burned and paid accounts free slots.',
   svgLine([{name:'Open accounts',values:spendingDays.map(d=>({x:d.day,y:d.live}))}],'Day','count'))},
  {id:'cashflows',groups:['cash'],html:chartCard('Money in vs money spent',
   'Cumulative first-payout receipts and incurred fees across simulated trials.',
   svgLine(streams),'Expected payout receipts: '+usd(r.avg.receipts||0)+' · Fees: '+usd(r.avg.spent))},
  {id:'daily-net',groups:['cash'],html:chartCard('Daily net cash change',
   'Daily differences between first payouts received and new costs incurred.',
   svgLine([{name:'Net cash change',values:incremental}]),'Only completed simulated cash movements are included')},
  {id:'roi-hist',groups:['risk'],html:chartCard('ROI distribution · %',
   'Trial-by-trial ROI = net profit divided by that trial’s incurred costs · '+trials.length+' trials',
   svgHistogram(roi,'pct'),'Firm allocation ROI, not gains on nominal funded capital')},
  {id:'risk-outcomes',groups:['risk'],html:chartCard('Payouts vs failures vs risk blocks',
   'Average account counts over the full Monte Carlo trials; outcomes can exclude pending accounts.',
   svgBars(riskOutcomes))},
  {id:'risk-usage',groups:['trades'],html:chartCard('R1 / R2 / R3 usage',
   'Number of executed trades at each risk tier for the selected example account and stage.',
   individual?svgBars(usage(ac,stageKey)):noTrades)},
  {id:'streaks',groups:['trades'],html:chartCard('Win / loss streaks',
   'Completed runs of wins and losses in the selected example account; 3+ grouped.',
   individual?svgBars(streakChart):noTrades,
   individual?stats.counts.W+' wins · '+stats.counts.L+' losses':'')}
 ];
 const selectedItems=activeGroup==='all'?items:items.filter(item=>item.groups.includes(activeGroup));
 const control=(field,label,list,chosenValue,disabled=false)=>
  '<label>'+e(label)+'<select data-chart-field="'+e(field)+'"'+(disabled?' disabled':'')+'>'+
  list.map(o=>'<option value="'+e(o[0])+'"'+(String(o[0])===String(chosenValue)?' selected':'')+'>'+e(o[1])+'</option>').join('')+'</select></label>';
 const portfolios=control('selection','Account / portfolio',options.map(o=>[o.id,o.label]),chosen);
 const accounts=control('account','Example account',
  [['auto','Auto (paid if available)'],...acList.map(a=>[String(a.id),'Account #'+a.id])],acId,chosen==='all');
 const views=control('group','Chart category',
  [['overview','Overview (6)'],['cash','Cash + new accounts (7)'],['trades','Trade analysis'],['risk','ROI & risk'],['all','All charts (15)']],activeGroup);
 const extra=
  control('daysRange','Trading days',[['all','Full horizon'],['7','Last 7'],['14','Last 14'],['30','Last 30'],['60','Last 60']],daysRange)+
  control('stage','Trade stage',[['all','All phases'],['p1','Phase 1'],['p2','Phase 2'],['funded','Funded']],stageKey,chosen==='all')+
  control('cashView','Cash lines',[['both','Mean + trial #1'],['mean','Mean only'],['example','Trial #1 only']],cashView)+
  control('outcome','Final-trial filter',[['all','All trials'],['positive','Positive NET'],['negative','Negative NET'],['payout','At least 1 payout'],['no-payout','No payouts']],outcome);
 const metrics=[['NET',usd(r.avg.net)],['ROI',(N(r.roi)*100).toFixed(1)+'%'],['P10',usd(r.p10)],
  ['P90',usd(r.p90)],['Ex. trades',trade.trades],['Ex. max DD',usd(trade.maxDD)]];
 return '<div class="sim-chart-toolbar">'+portfolios+accounts+views+
  '<button type="button" class="sim-chart-reset" data-chart-reset="1" title="Reset chart filters to their defaults">Reset filters</button></div>'+
  '<details class="sim-chart-advanced" data-chart-advanced'+(filtersOpen?' open':'')+
  '><summary>Advanced filters · Days / Stage / Trial view / Outcome</summary>'+
  '<div class="sim-chart-toolbar sim-chart-extra">'+extra+'</div></details>'+
  '<div class="sim-chart-metrics">'+metrics.map(m=>'<span><b>'+e(m[0])+'</b><strong>'+e(m[1])+'</strong></span>').join('')+'</div>'+
  '<div class="sim-chart-grid">'+selectedItems.map(c=>c.html).join('')+'</div>'+
  '<p class="sim-chart-note">Charts show simulated results, not historical trades. Portfolio cash NET is received first payouts minus incurred costs, <b>not</b> prop-firm equity. Example account trading equity and drawdown are from trial #1; evaluation-stage profits are not withdrawable. Day-range filtering changes the displayed days, not the simulation. Daily purchases and activation fees are shown when actually incurred. Stage filtering applies only to sample trading charts. Outcome filtering applies only to the final NET and ROI histograms; all other graphs and KPI totals remain unfiltered. Headline ROI divides average net by average spending, whereas the ROI histogram calculates each trial separately.</p>';
}

root.StudioPortfolioCharts={render,tradeCurve,combinedResult,svgLine,svgBars,svgHistogram,streaks,usage,cashWindow,chartOutcome};
})(typeof window!=='undefined'?window:globalThis);
