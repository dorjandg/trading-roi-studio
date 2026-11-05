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
function svgHistogram(values){
 const nums=(values||[]).filter(Number.isFinite);
 if(!nums.length)return '<p class="sim-empty">No trial outcomes available.</p>';
 const lo=Math.min(...nums),hi=Math.max(...nums),span=Math.max(.01,hi-lo),bins=12,counts=Array(bins).fill(0);
 for(const v of nums)counts[Math.min(bins-1,Math.floor((v-lo)/span*bins))]++;
 const W=660,H=200,L=55,R=13,T=12,B=28,w=W-L-R,h=H-T-B,max=Math.max(1,...counts),step=w/bins;
 const bars=counts.map((v,i)=>{
  const x=L+i*step,bh=v/max*h,y=T+h-bh;
  return '<rect fill="var(--blue)" x="'+x.toFixed(2)+'" y="'+y.toFixed(2)+'" width="'+(step-2).toFixed(2)+'" height="'+bh.toFixed(2)+'"><title>'+
    e(usd(lo+span*i/bins)+' to '+usd(lo+span*(i+1)/bins)+' · '+v+' trials')+'</title></rect>';
 }).join('');
 const labels=[{x:L,v:lo},{x:L+w/2,v:(lo+hi)/2},{x:L+w,v:hi}].map(t=>
  '<text class="sim-tick" x="'+t.x+'" y="'+(H-7)+'" text-anchor="middle">'+e(tick(t.v))+'</text>').join('');
 const grid=[0,.5,1].map(fr=>{
  const y=T+h*(1-fr);
  return '<line class="sim-grid-line" x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'"/>'+
    '<text class="sim-tick" x="'+(L-5)+'" y="'+(y+3)+'" text-anchor="end">'+Math.round(max*fr)+'</text>';
 }).join('');
 return '<svg class="sim-svg" role="img" aria-label="Final net distribution for Monte Carlo trials" viewBox="0 0 '+W+' '+H+'">'+grid+bars+labels+'</svg>';
}
function tradeCurve(ac){
 let net=0,peak=0,maxDD=0,index=0;
 const equity=[{x:0,y:0}],drawdown=[{x:0,y:0}];
 for(const event of ac?.trace||[]){
  if((event.type!=='win'&&event.type!=='loss')||!Number.isFinite(event.delta))continue;
  index++;net+=event.delta;peak=Math.max(peak,net);maxDD=Math.max(maxDD,peak-net);
  equity.push({x:index,y:net});drawdown.push({x:index,y:peak-net});
 }
 return {equity,drawdown,trades:index,net,maxDD};
}
function combinedResult(list,inputs){
 const days=Math.max(0,Math.floor(N(inputs.days))),keys=['spent','receipts','net','paid'];
 function cashAt(day,sample){
  const row={day,spent:0,receipts:0,net:0,paid:0};
  for(const r of list)for(const k of keys)row[k]+=N((sample?r.sample?.dailyCash:r.cashCurve)?.[day]?.[k]);
  return row;
 }
 const cashCurve=Array.from({length:days+1},(_,day)=>cashAt(day,false));
 const sample={dailyCash:Array.from({length:days+1},(_,day)=>cashAt(day,true)),accountDetails:[]};
 const nets=Array.from({length:list[0]?.nets?.length||0},(_,i)=>list.reduce((total,r)=>total+N(r.nets?.[i]),0)).sort((a,b)=>a-b);
 const avg={spent:0,net:0,funded:0,paid:0};
 for(const r of list)for(const k of Object.keys(avg))avg[k]+=N(r.avg[k]);
 const quantile=q=>nets.length?nets[Math.min(nets.length-1,Math.floor((nets.length-1)*q))]:0;
 return {plan:null,count:list.reduce((sum,r)=>sum+r.count,0),cashCurve,sample,nets,avg,roi:avg.spent?avg.net/avg.spent:0,
  p10:quantile(.1),median:quantile(.5),p90:quantile(.9),stages:[]};
}
function chartCard(title,info,svg,foot=''){
 return '<article class="sim-chart-card"><h4>'+e(title)+'</h4><p>'+e(info)+'</p>'+svg+
  (foot?'<div class="sim-chart-foot">'+e(foot)+'</div>':'')+'</article>';
}
function render({results=[],inputs={},selection='',account='auto'}={}){
 if(!results.length)return '<p class="sim-empty">Run a simulation to see charts.</p>';
 const split=inputs.budgetMode==='split';
 const options=results.map((r,i)=>({id:String(i),label:r.plan.firm+' · '+r.plan.programName+' '+usd(r.plan.size)}));
 if(split)options.unshift({id:'all',label:'Combined split portfolio'});
 const chosen=options.some(x=>x.id===selection)?selection:(split?'all':'0');
 const r=chosen==='all'?combinedResult(results,inputs):results[Number(chosen)];
 const opts=options.map(x=>'<option value="'+e(x.id)+'"'+(chosen===x.id?' selected':'')+'>'+e(x.label)+'</option>').join('');
 const acList=r.sample?.accountDetails||[],acId=acList.some(x=>String(x.id)===String(account))?String(account):'auto';
 const acc=acId==='auto'?(acList.find(a=>a.status==='paid')||acList[0]):acList.find(a=>String(a.id)===acId);
 const acOpts='<option value="auto"'+(acId==='auto'?' selected':'')+'>Auto · first paid</option>'+
  acList.map(a=>'<option value="'+a.id+'"'+(String(a.id)===acId?' selected':'')+'>Account #'+a.id+'</option>').join('');
 const trade=tradeCurve(acc);
 const mean=(r.cashCurve||[]).map(d=>({x:d.day,y:d.net}));
 const example=(r.sample?.dailyCash||[]).map(d=>({x:d.day,y:d.net}));
 const paid=(r.cashCurve||[]).map(d=>({x:d.day,y:d.paid}));
 const stages=r.plan?
  [{label:'Bought',value:r.count},...r.plan.stageList.filter(s=>s!=='funded').map((st,i)=>({label:st==='p1'?'P1':'P2',value:r.stages[i]})),
   {label:'Funded',value:r.avg.funded},{label:'Paid',value:r.avg.paid}]:
  [{label:'Bought',value:r.count},{label:'Funded',value:r.avg.funded},{label:'Paid',value:r.avg.paid}];
 const kpis=[['NET',usd(r.avg.net)],['ROI',(N(r.roi)*100).toFixed(1)+'%'],['P10',usd(r.p10)],
  ['P90',usd(r.p90)],['Ex. trades',trade.trades],['Ex. max DD',usd(trade.maxDD)]];
 const metrics='<div class="sim-chart-metrics">'+kpis.map(x=>'<span><b>'+e(x[0])+'</b><strong>'+e(x[1])+'</strong></span>').join('')+'</div>';
 const charts=[
  chartCard('Portfolio cash net','Mean across '+N(inputs.trials)+' trials versus trial #1 · cash receipts minus fees',
   svgLine([{name:'Mean',values:mean},{name:'Trial #1',values:example,dash:true}]),
   'Expected end net: '+usd(r.avg.net)),
  chartCard('Trading equity · sample account','Cumulative trade P/L of one account in trial #1, across evaluation and funded stages',
   acc?svgLine([{name:'Trade P/L',values:trade.equity}],'Trade'):'<p class="sim-empty">Choose an individual firm.</p>',
   acc?'Sample trade P/L: '+usd(trade.net):''),
  chartCard('Trading drawdown · sample','Peak-to-trough decline in cumulative example trade P/L (not the firm loss floor)',
   acc?svgLine([{name:'Drawdown',values:trade.drawdown}],'Trade'):'<p class="sim-empty">Choose an individual firm.</p>',
   acc?'Sample maximum DD: '+usd(trade.maxDD):''),
  chartCard('Final net distribution','Distribution across all completed Monte Carlo trials',
   svgHistogram(r.nets),'P10 '+usd(r.p10)+' · Median '+usd(r.median)+' · P90 '+usd(r.p90)),
  chartCard('Account progression','Average challenges bought, stage passes and first payouts',
   svgBars(stages)),
  chartCard('First payouts by day','Average cumulative count of accounts receiving their first modeled payout',
   svgLine([{name:'First paid',values:paid}],'Day','count'))
 ].join('');
 return '<div class="sim-chart-toolbar"><label>Portfolio view<select data-chart-selection>'+opts+'</select></label>'+
  '<label>Example account<select data-chart-account'+(chosen==='all'?' disabled':'')+'>'+acOpts+'</select></label></div>'+
  metrics+'<div class="sim-chart-grid">'+charts+'</div>'+
  '<p class="sim-chart-note">Portfolio cash net = first payout receipts minus incurred challenge/activation fees; it is <b>not</b> a funded-account balance. Trading equity and drawdown come from one illustrative account in trial #1 and include evaluation-stage trade P/L, which is not withdrawable. These are simulated paths, not historical backtests or guarantees.</p>';
}
root.StudioPortfolioCharts={render,tradeCurve,combinedResult,svgLine,svgBars,svgHistogram};
})(typeof window!=='undefined'?window:globalThis);
