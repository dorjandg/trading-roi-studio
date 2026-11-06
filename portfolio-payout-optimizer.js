/* Payout-to-investment reverse planner. Estimates are Monte Carlo scenarios,
   never a guarantee or a verified prop-firm rule. */
(function(root){
'use strict';
const E=root.StudioPortfolioEngine;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const val=x=>Number.isFinite(+x)?+x:0;
const money=x=>'$'+Math.round(val(x)).toLocaleString('en-US');
const pct=x=>(100*val(x)).toFixed(1)+'%';
function needed(total,perPayout){
 if(!(total>0&&perPayout>0))throw Error('Enter positive targets.');
 return Math.ceil(total/perPayout);
}
function profitNeeded(plan,perPayout){
 if(plan.id==='topstep'){
  if(perPayout>5000)throw Error('Topstep first modeled payout is capped at $5,000; choose a smaller payout per account.');
  return perPayout/.5;
 }
 // The user's per-account withdrawal target means trading-profit payout,
 // not a refunded challenge fee. Fee refunds are tracked separately in the
 // existing simulator's cash receipts and must not reduce the trading goal.
 if(!plan.split||plan.split<=0)throw Error('This account has no positive payout split.');
 return Math.max(.01,perPayout/plan.split);
}
function planFor(base,scale,perPayout,rrVariant=null,riskMode='saved'){
 const p={...base,riskProfiles:{}};
 const maxRisk=Math.min(Number.isFinite(base.dailyLoss)?base.dailyLoss:Infinity,
  Number.isFinite(base.overallLoss)?base.overallLoss:Infinity)-val(base.riskReserve)-val(base.tradeCost)-1;
 if(maxRisk<=0)throw Error('Loss allowance is too small for a trade with the configured reserve.');
 for(const [stage,c] of Object.entries(base.riskProfiles)){
  const stageRisk={...c,policy:{...c.policy,map:{...(c.policy?.map||{})}}};
  for(const field of ['r1','r2','r3']){
   stageRisk[field]=Math.max(.01,Math.min(maxRisk,Math.round(val(c[field])*scale*100)/100));
  }
  if(rrVariant){
   stageRisk.rr=rrVariant.r1;
   stageRisk.rrByTier={r1:rrVariant.r1,r2:rrVariant.r2,r3:rrVariant.r3};
  }
  if(riskMode==='target'){
   // Size a clean first win near the stage target, without paying for
   // large overshoot. On a loss, the next tier aims to recover the loss
   // and still clear the original target, subject to real drawdown headroom.
   const rr1=stageRisk.rrByTier?.r1??stageRisk.rr;
   const rr2=stageRisk.rrByTier?.r2??stageRisk.rr;
   const rr3=stageRisk.rrByTier?.r3??stageRisk.rr;
   const cost=val(p.tradeCost),reserve=Math.max(.01,val(p.riskReserve));
   const tier1=Math.min(maxRisk,Math.ceil((stageRisk.target+cost)/rr1*100)/100);
   stageRisk.r1=Math.max(.01,tier1);
   const afterLossHeadroom=Math.min(
    Number.isFinite(p.overallLoss)?p.overallLoss-tier1-cost-reserve:Infinity,
    Number.isFinite(p.dailyLoss)?p.dailyLoss-cost-reserve:Infinity,
    maxRisk);
   const recovery=Math.ceil((stageRisk.target+tier1+2*cost)/rr2*100)/100;
   stageRisk.r2=Math.max(.01,Math.min(recovery,afterLossHeadroom));
   stageRisk.r3=Math.max(.01,Math.min(maxRisk,Math.ceil((stageRisk.target+tier1+stageRisk.r2+3*cost)/rr3*100)/100));
   // The intended R2 is selected after a loss; no automatic R2 on a win.
   if(stage!=='p1'||p.id!=='topstep')stageRisk.policy={map:{},conflicts:[],mode:'streak'};
   stageRisk.targetSizing={cleanWin:tier1*rr1-cost,
    recoveryWin:stageRisk.r2*rr2-cost,
    recoveryPossible:recovery<=afterLossHeadroom+1e-8};
  }
  p.riskProfiles[stage]=stageRisk;
 }
 const target=profitNeeded(p,perPayout);
 p.fundedTarget=target;p.riskProfiles.funded.target=target;
 return p;
}
function assess(r,count,total){
 const trials=r.chartTrials||[];
 const successes=trials.filter(t=>val(t.paid)>=count&&val(t.receipts)+1e-8>=total).length;
 return {hit:trials.length?successes/trials.length:0,
  avgPaid:val(r.avg.paid),avgReceipts:val(r.avg.receipts),
  avgNet:val(r.avg.net),avgSpent:val(r.avg.spent),p10:val(r.p10),
  avgPurchased:val(r.avg.bought),avgFunded:val(r.avg.funded),
  avgBreached:val(r.avg.failed),avgRiskBlocked:val(r.avg.exhausted),roi:val(r.roi),
  budgetRoi:r.budget>0?val(r.avg.net)/r.budget:0,
  avgPayout:r.avg.paid?val(r.avg.receipts)/r.avg.paid:0,
  firstPayoutDay:Number.isFinite(r.avgFirstPayoutDay)?r.avgFirstPayoutDay:null,
  goalPayoutDay:Number.isFinite(r.avgGoalPayoutDay)?r.avgGoalPayoutDay:null,
  chanceGoalPayoutDay:val(r.chanceGoalPayoutDay)};
}
async function optimize({plan,total,perPayout,maxInvestment,minRoi=2,minNetRoi=0,minNetPnl=0,minRR=1.5,maxRR=3,inputs,onProgress}){
 const count=needed(total,perPayout);
 if(!E)throw Error('Simulator engine is unavailable.');
 if(!plan)throw Error('Select a prop-firm account.');
 if(!Number.isFinite(minRoi)||minRoi<0||minRoi>100)
  throw Error('Enter an ROI on incurred fees between 0% and 10,000%.');
 if(!Number.isFinite(minNetRoi)||minNetRoi<0||minNetRoi>100)
  throw Error('Enter a net ROI on starting investment between 0% and 10,000%.');
 if(!Number.isFinite(minNetPnl)||minNetPnl<0)
  throw Error('Enter a valid nonnegative net P&L target in USD.');
 if(!Number.isFinite(minRR)||!Number.isFinite(maxRR)||minRR<0.1||maxRR>20||minRR>maxRR)
  throw Error('Choose RR bounds with minimum >= 0.1R, maximum <= 20R and minimum <= maximum.');
 const unit=plan.fee+(plan.id==='topstep'?plan.activationFee:0);
 if(unit<=0)throw Error('Purchase and activation fees are unavailable.');
 const maxUnits=Math.min(100,Math.floor(maxInvestment/unit));
 if(maxUnits<1)throw Error('Investment ceiling cannot cover one account purchase and activation reserve.');
 // Each distinct account produces at most one modeled first payout.
 // Respect user's allowed RR range. Tier R2 can target more than R1,
 // e.g. first trade 1.5R, second after loss 3R.
 const rounded=n=>Math.round(n*100)/100;
 const mid=rounded((minRR+maxRR)/2);
 const rrVariants=[
  {name:'Conservative',r1:minRR,r2:minRR,r3:minRR},
  {name:'Balanced',r1:mid,r2:mid,r3:mid},
  {name:'Recovery RR',r1:minRR,r2:maxRR,r3:mid},
  {name:'Higher R2',r1:mid,r2:maxRR,r3:minRR}
 ].filter((v,i,a)=>a.findIndex(z=>z.r1===v.r1&&z.r2===v.r2&&z.r3===v.r3)===i);
 const scaleValues=[.55,.8,1,1.25];
 const riskModes=['target','saved'];
 const candidates=[];
 let checked=0;
 const simulate=(p,units,trials,seed)=>E.simulatePortfolio(p,{
  days:inputs.days,tradesPerDay:inputs.tradesPerDay,winRate:inputs.winRate,
  signalMode:inputs.signalMode,seed,trials,netGoal:total,
  budget:Math.round(units*unit*100)/100,
  purchaseMode:inputs.purchaseMode,capacityMode:inputs.capacityMode,
  maxActive:inputs.maxActive,maxBuysPerDay:inputs.maxBuysPerDay,
  reinvestPayouts:inputs.reinvestPayouts,maxAccounts:100,trackCharts:true,
  requiredPayouts:count,
  evaluationAllocationCap:inputs.evaluationAllocationCap||0,
  fundedAllocationCap:inputs.fundedAllocationCap||0});
 const pause=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 // Unlike payout probability, ROI is not monotone in investment. A binary
 // budget search would skip valid ROI peaks. Sample a spread of budgets.
 const countGrid=new Set([1,maxUnits,Math.min(maxUnits,count),Math.min(maxUnits,count*2)]);
 for(let i=1;i<=14;i++)countGrid.add(Math.max(1,Math.round(i*maxUnits/14)));
 const unitCounts=[...countGrid].filter(x=>x>0&&x<=maxUnits).sort((a,b)=>a-b);
 const coarse=[];
 const coarseTrials=50,validationTrials=200;
 for(const riskMode of riskModes)for(const rrVariant of rrVariants)for(const scale of scaleValues){
  const p=planFor(plan,scale,perPayout,rrVariant,riskMode);
  const v=E.validatePlan(p);
  if(v.errors.length)continue;
  for(const units of unitCounts){
   const r=simulate(p,units,coarseTrials,inputs.seed+7771);
   const score=assess(r,count,total);
   checked++;
   coarse.push({scale,units,riskMode,rrVariant:rrVariant.name,plan:p,score});
   onProgress?.('Testing '+riskMode+' sizing · '+rrVariant.name+' · '+checked+' scenarios checked');
   if(checked%4===0)await pause();
  }
 }
 if(!coarse.length)throw Error('No valid risk candidates could be simulated.');
 const reachesPayouts=x=>x.score.avgPaid+1e-8>=count&&x.score.avgReceipts+1e-8>=total;
 const meetsAll=x=>reachesPayouts(x)&&x.score.roi+1e-8>=minRoi&&
  x.score.budgetRoi+1e-8>=minNetRoi&&x.score.avgNet+1e-8>=minNetPnl;
 // Shortlist feasible options and closest misses. Independently validate
 // the shortlist with fresh random outcomes to avoid ranking on training noise.
 coarse.sort((a,b)=>{
  const ap=meetsAll(a),bp=meetsAll(b);
  if(ap!==bp)return ap?-1:1;
  const ac=reachesPayouts(a),bc=reachesPayouts(b);
  if(ac!==bc)return ac?-1:1;
  if(ap&&bp)return (a.score.goalPayoutDay??Infinity)-(b.score.goalPayoutDay??Infinity)||
   (a.score.firstPayoutDay??Infinity)-(b.score.firstPayoutDay??Infinity)||a.units-b.units||b.score.hit-a.score.hit;
  if(ac&&bc)return Number(b.score.avgNet>=minNetPnl)-Number(a.score.avgNet>=minNetPnl)||
  (a.score.goalPayoutDay??Infinity)-(b.score.goalPayoutDay??Infinity)||
  (a.score.firstPayoutDay??Infinity)-(b.score.firstPayoutDay??Infinity)||b.score.roi-a.score.roi||a.units-b.units;
  return Math.min(count,b.score.avgPaid)-Math.min(count,a.score.avgPaid)||
   Math.min(total,b.score.avgReceipts)-Math.min(total,a.score.avgReceipts)||
   b.score.hit-a.score.hit;
 });
 for(const candidate of coarse.slice(0,12)){
  const confirmed=simulate(candidate.plan,candidate.units,validationTrials,inputs.seed+37013);
  checked++;
  candidates.push({...candidate,score:assess(confirmed,count,total),
   result:confirmed,initialBudget:candidate.units*unit});
  if(checked%3===0)await pause();
 }
 candidates.sort((a,b)=>{
  const ap=meetsAll(a),bp=meetsAll(b);
  if(ap!==bp)return ap?-1:1;
  const ac=reachesPayouts(a),bc=reachesPayouts(b);
  if(ac!==bc)return ac?-1:1;
  if(ap&&bp)return (a.score.goalPayoutDay??Infinity)-(b.score.goalPayoutDay??Infinity)||
   a.initialBudget-b.initialBudget||b.score.hit-a.score.hit;
  if(ac&&bc)return Number(b.score.avgNet>=minNetPnl)-Number(a.score.avgNet>=minNetPnl)||
  (a.score.goalPayoutDay??Infinity)-(b.score.goalPayoutDay??Infinity)||
  (a.score.firstPayoutDay??Infinity)-(b.score.firstPayoutDay??Infinity)||b.score.roi-a.score.roi||a.initialBudget-b.initialBudget;
  return b.score.avgPaid-a.score.avgPaid||
   b.score.avgReceipts-a.score.avgReceipts||b.score.roi-a.score.roi;
 });
 return {requiredPayouts:count,profitPerAccount:profitNeeded(plan,perPayout),
  targetCash:total,perPayout,maxInvestment,minRoi,minNetRoi,minNetPnl,minRR,maxRR,checked,
  feasible:candidates.some(meetsAll),payoutCountFeasible:candidates.some(reachesPayouts),
  fastest:candidates.filter(c=>c.score.firstPayoutDay!=null).slice().sort((a,b)=>
   (a.score.goalPayoutDay??Infinity)-(b.score.goalPayoutDay??Infinity)||
   a.score.firstPayoutDay-b.score.firstPayoutDay)[0]||null,
  candidates:candidates.slice(0,5),firm:plan.firm,size:plan.size};
}
function gaps(out,score){
 const issues=[];
 if(score.avgPaid+1e-8<out.requiredPayouts)
  issues.push('First payouts short by '+(out.requiredPayouts-score.avgPaid).toFixed(2)+' on average');
 if(score.avgReceipts+1e-8<out.targetCash)
  issues.push('Cash receipts short by '+money(out.targetCash-score.avgReceipts));
 if(score.avgNet+1e-8<out.minNetPnl)
  issues.push('Net P&L short by '+money(out.minNetPnl-score.avgNet));
 if(score.roi+1e-8<out.minRoi)
  issues.push('Fee-based ROI short by '+pct(out.minRoi-score.roi)+' points');
 if(score.budgetRoi+1e-8<out.minNetRoi)
  issues.push('Investment ROI short by '+pct(out.minNetRoi-score.budgetRoi)+' points');
 return issues;
}
const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function sampleAccounts(candidate){
 return candidate?.result?.sample?.accountDetails||[];
}
function chooseExampleAccount(accounts){
 const hasInitialLossAndNextTrade=ac=>{
  const trades=(ac.trace||[]).filter(e=>e.type==='win'||e.type==='loss');
  return trades.length>1&&trades[0].type==='loss'&&trades[1].day>trades[0].day;
 };
 return accounts.find(hasInitialLossAndNextTrade)||
  accounts.find(a=>a.status==='paid')||
  accounts.find(a=>(a.trace||[]).some(t=>t.type==='stage-pass'))||
  accounts[0]||null;
}
function renderAccountPath(candidate,accountId){
 const accounts=sampleAccounts(candidate);
 const ac=accounts.find(x=>String(x.id)===String(accountId));
 if(!ac)return '<p class="hint">No account path recorded for this trial.</p>';
 const p=candidate.plan;
 const phase=e=>p.riskProfiles[e.stage]?.name||e.stage||'—';
 const rr=e=>e.rr==null?'—':Number(e.rr).toFixed(2)+'R';
 const dollars=x=>x==null?'—':(x<0?'−':'+' )+money(Math.abs(x));
 const trace=(ac.trace||[]).filter(e=>['win','loss','blocked','failed','stage-pass','stage-start',
  'admin','waiting','consistency','payout-request','paid','eod-mll','purchase','activation'].includes(e.type));
 let trades=0;
 const rows=trace.map(e=>{
  const trade=e.type==='win'||e.type==='loss';
  if(trade)trades++;
  const isEvent=!trade,description=trade?(e.type==='win'?'WIN':'LOSS'):
   e.type==='stage-pass'?'PHASE PASSED':
   e.type==='stage-start'?'NEXT PHASE':
   e.type==='payout-request'?'PAYOUT REQUEST':
   e.type==='paid'?'PAYOUT PAID':
   e.type==='blocked'?'RISK BLOCKED':
   e.type==='failed'?'FAILED':
   e.type==='admin'?'MIN-DAY PLACEHOLDER':
   e.type==='waiting'?'WAITING':e.type==='activation'?'FUNDED ACTIVATION':
   e.type==='purchase'?'CHALLENGE BOUGHT':
   e.type==='eod-mll'?'EOD LOSS FLOOR':'CONSISTENCY';
  const hint=e.label&&isEvent?' title="'+escapeHtml(e.label)+'"':'';
  return '<tr'+(isEvent?' class="reverse-event-row"':'')+'>'+
   '<td>'+escapeHtml(e.day??'—')+'</td>'+
   '<td>'+escapeHtml(phase(e))+'</td>'+
   '<td>'+(trade?'#'+trades:'·')+'</td>'+
   '<td'+hint+'>'+escapeHtml(description)+'</td>'+
   '<td>'+escapeHtml(e.slot?e.slot.toUpperCase():'—')+'</td>'+
   '<td>'+(e.risk==null?'—':money(e.risk))+'</td>'+
   '<td>'+rr(e)+'</td>'+
   '<td>'+(trade?dollars(e.delta):e.type==='paid'?money(e.cash):'—')+'</td>'+
   '<td>'+(trade?dollars(e.pnl):'—')+'</td></tr>';
 }).join('');
 const passInfo=(ac.passes||[]).map(x=>(p.riskProfiles[x.stage]?.name||x.stage)+' passed day '+x.day).join(' · ');
 return '<p class="hint">Trial #1, account #'+escapeHtml(ac.id)+' · '+escapeHtml(ac.status)+
  ' · '+trades+' trades'+(passInfo?' · '+escapeHtml(passInfo):'')+
  '. These are actual modeled outcomes from one trial, not the average/guaranteed sequence.</p>'+
  '<div class="reverse-path-table tablewrap"><table><thead><tr><th>Day</th><th>Phase</th><th>Trade</th><th>Result / event</th>'+
  '<th>Tier</th><th>Risk</th><th>RR</th><th>Trade P&L</th><th>Phase P&L</th></tr></thead>'+
  '<tbody>'+rows+'</tbody></table></div>'+
  '<p class="hint">Next trade risk depends on the active phase risk-sequence policy and remaining drawdown. A win adds risk × selected tier RR minus modeled trade cost; a loss subtracts risk plus cost. Passing also requires the phase profit target and any minimum trading days.</p>';
}
function render(out){
 const cards=out.candidates.map((candidate,index)=>{
  const s=candidate.score,p=candidate.plan;
  const risks=p.stageList.map(stage=>{
   const c=p.riskProfiles[stage];
   return '<tr><td>'+c.name+'</td><td>'+money(c.r1)+'</td><td>'+money(c.r2)+'</td><td>'+money(c.r3)+'</td><td>'+['r1','r2','r3'].map(t=>Number(c.rrByTier?.[t]??c.rr).toFixed(2)+'R').join(' / ')+'</td></tr>';
  }).join('');
  return '<div class="reverse-candidate">'+
   '<h4>'+(index===0?'Best tested scenario':'Alternative '+(index+1))+' · '+candidate.scale.toFixed(2)+'× risk · '+escapeHtml(candidate.rrVariant||'')+
   ' · '+(candidate.riskMode==='target'?'Target-sized':'Saved-sized')+'</h4>'+
   '<p class="hint" style="margin:4px 0 6px"><strong>Target checks:</strong> '+
   (gaps(out,s).length?gaps(out,s).join(' · '):'All expected targets met')+'</p>'+
   '<div class="reverse-kpis"><div><small>First payout day (paid trials)</small><strong>'+ (s.firstPayoutDay==null?'Not reached':'Day '+s.firstPayoutDay.toFixed(1))+'</strong></div>'+
   '<div><small>Full payout goal day</small><strong>'+(s.goalPayoutDay==null?'Not reached':'Day '+s.goalPayoutDay.toFixed(1))+'</strong></div>'+
   '<div><small>Tested starting budget</small><strong>'+money(candidate.initialBudget)+'</strong></div>'+
   '<div><small>ROI on incurred fees</small><strong>'+pct(s.roi)+'</strong></div>'+ 
   '<div><small>Net ROI on investment</small><strong>'+pct(s.budgetRoi)+'</strong></div>'+ 
   '<div><small>Chance of payout goal</small><strong>'+pct(s.hit)+'</strong></div>'+
   '<div><small>Avg. first payouts</small><strong>'+s.avgPaid.toFixed(2)+'</strong></div>'+
   '<div><small>Avg. cash received</small><strong>'+money(s.avgReceipts)+'</strong></div>'+
   '<div><small>Avg. incurred fees</small><strong>'+money(s.avgSpent)+'</strong></div>'+
   '<div><small>Avg. net after fees</small><strong>'+money(s.avgNet)+'</strong></div>'+ 
   '<div><small>Avg. challenges bought</small><strong>'+s.avgPurchased.toFixed(2)+'</strong></div>'+ 
   '<div><small>Avg. funded reached</small><strong>'+s.avgFunded.toFixed(2)+'</strong></div>'+ 
   '<div><small>Risk-blocked / breached</small><strong>'+s.avgRiskBlocked.toFixed(1)+' / '+s.avgBreached.toFixed(1)+'</strong></div></div>'+
   '<div class="tablewrap"><table class="journey-table"><thead><tr><th>Phase</th><th>R1</th><th>R2</th><th>R3</th><th>RR (R1 / R2 / R3)</th></tr></thead><tbody>'+risks+'</tbody></table></div>'+
   (sampleAccounts(candidate).length?(()=>{
    const accounts=sampleAccounts(candidate),example=chooseExampleAccount(accounts);
    const options=accounts.map(ac=>'<option value="'+escapeHtml(ac.id)+'"'+(ac.id===example.id?' selected':'')+'>'+
     'Account #'+escapeHtml(ac.id)+' · '+escapeHtml(ac.status)+
     ' · '+(ac.trades||0)+' trades'+(ac.paidDay!=null?' · Paid day '+ac.paidDay:'')+'</option>').join('');
    return '<details class="reverse-trade-details"><summary>Trade-by-trade example · show / hide <small>(trial #1 · '+accounts.length+' accounts)</small></summary>'+
     '<div class="reverse-path-controls"><label>Account <select data-reverse-path="'+index+'">'+options+'</select></label>'+
     '<span class="hint">Select any account to inspect exact trade and phase progression.</span></div>'+
     '<div data-reverse-path-body="'+index+'">'+renderAccountPath(candidate,example.id)+'</div></details>';
   })():'<p class="hint">Trade-by-trade account details unavailable for this scenario.</p>')+
   '</div>';
 }).join('');
 return '<p class="hint">Goal: '+money(out.targetCash)+' received across at least '+out.requiredPayouts+
  ' separate first payouts of '+money(out.perPayout)+' each. Allowed trade RR: '+out.minRR.toFixed(2)+'–'+out.maxRR.toFixed(2)+'R. Minimum fee-based ROI: '+pct(out.minRoi)+'. Minimum net ROI on starting investment: '+pct(out.minNetRoi)+'. Minimum net P&L: '+money(out.minNetPnl)+'. The account must first reach approximately '+
  money(out.profitPerAccount)+' funded trading profit (based on the modeled profit payout split, excluding any refunded challenge fee). Probability is the share of trials meeting BOTH payout count and cash received before the chosen trading-day horizon.</p>'+
  (out.feasible?'<p class="good"><strong>At least one validated scenario met the expected payout-count, payout-cash, ROI and USD net P&L targets.</strong></p>':
   '<p class="bad"><strong>No validated scenario met all payout-count, cash, ROI and net P&L targets within your investment ceiling and time horizon.</strong> Closest tested alternatives are shown. Payout-goal probability remains reported separately; an expected target is not a reliable guarantee.</p>')+
  (out.candidates[0]?'<p class="hint"><strong>Most important gap:</strong> '+
   (gaps(out,out.candidates[0].score)[0]||'No expected-value target gap; check payout probability and downside risk')+'</p>':'')+
  (out.fastest?'<p class="hint"><strong>Fastest first payout among shortlisted scenarios:</strong> '+
   'Day '+out.fastest.score.firstPayoutDay?.toFixed(1)+' on average in trials that received a payout; ' +
   'risk mode '+escapeHtml(out.fastest.riskMode)+'. This is not a guaranteed payout date.</p>':'')+
  cards+'<p class="hint">Estimates use 200 independent validation trials for 12 shortlisted scenarios after 50-trial searches across risk levels and investment amounts. ROI on incurred fees = expected net cash / expected fees actually incurred. Net ROI on investment = expected net cash / tested starting budget. Both may be negative. Starting budget is cash made available for challenge and activation costs, NOT the total fees actually incurred; any refunded challenge fees are tracked in modeled cash receipts. Payout counts and earnings can differ between trials. Searches are approximate, account purchases are capped at 100 per type, and risk safety depends on modeled firm rules. Scenarios do not change your saved Firms risk settings.</p>';
}
root.StudioPayoutOptimizer={needed,profitNeeded,planFor,assess,optimize,render,renderAccountPath,sampleAccounts};
})(typeof window!=='undefined'?window:globalThis);
