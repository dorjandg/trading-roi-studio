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
function planFor(base,scale,perPayout){
 const p={...base,riskProfiles:{}};
 const maxRisk=Math.min(Number.isFinite(base.dailyLoss)?base.dailyLoss:Infinity,
  Number.isFinite(base.overallLoss)?base.overallLoss:Infinity)-val(base.riskReserve)-val(base.tradeCost)-1;
 if(maxRisk<=0)throw Error('Loss allowance is too small for a trade with the configured reserve.');
 for(const [stage,c] of Object.entries(base.riskProfiles)){
  const stageRisk={...c,policy:{...c.policy,map:{...(c.policy?.map||{})}}};
  for(const field of ['r1','r2','r3']){
   stageRisk[field]=Math.max(.01,Math.min(maxRisk,Math.round(val(c[field])*scale*100)/100));
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
  avgPayout:r.avg.paid?val(r.avg.receipts)/r.avg.paid:0};
}
async function optimize({plan,total,perPayout,maxInvestment,minRoi=2,minNetRoi=0,minNetPnl=0,inputs,onProgress}){
 const count=needed(total,perPayout);
 if(!E)throw Error('Simulator engine is unavailable.');
 if(!plan)throw Error('Select a prop-firm account.');
 if(!Number.isFinite(minRoi)||minRoi<0||minRoi>100)
  throw Error('Enter an ROI on incurred fees between 0% and 10,000%.');
 if(!Number.isFinite(minNetRoi)||minNetRoi<0||minNetRoi>100)
  throw Error('Enter a net ROI on starting investment between 0% and 10,000%.');
 if(!Number.isFinite(minNetPnl)||minNetPnl<0)
  throw Error('Enter a valid nonnegative net P&L target in USD.');
 const unit=plan.fee+(plan.id==='topstep'?plan.activationFee:0);
 if(unit<=0)throw Error('Purchase and activation fees are unavailable.');
 const maxUnits=Math.min(100,Math.floor(maxInvestment/unit));
 if(maxUnits<1)throw Error('Investment ceiling cannot cover one account purchase and activation reserve.');
 // Each distinct account produces at most one modeled first payout.
 const scaleValues=[.55,.8,1,1.2];
 const candidates=[];
 let checked=0;
 const simulate=(p,units,trials,seed)=>E.simulatePortfolio(p,{
  days:inputs.days,tradesPerDay:inputs.tradesPerDay,winRate:inputs.winRate,
  signalMode:inputs.signalMode,seed,trials,netGoal:total,
  budget:Math.round(units*unit*100)/100,
  purchaseMode:inputs.purchaseMode,capacityMode:inputs.capacityMode,
  maxActive:inputs.maxActive,maxBuysPerDay:inputs.maxBuysPerDay,
  reinvestPayouts:inputs.reinvestPayouts,maxAccounts:100,trackCharts:true,
  evaluationAllocationCap:inputs.evaluationAllocationCap||0,
  fundedAllocationCap:inputs.fundedAllocationCap||0});
 const pause=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 // Unlike payout probability, ROI is not monotone in investment. A binary
 // budget search would skip valid ROI peaks. Sample a spread of budgets.
 const countGrid=new Set([1,maxUnits,Math.min(maxUnits,count),Math.min(maxUnits,count*2)]);
 for(let i=1;i<=10;i++)countGrid.add(Math.max(1,Math.round(i*maxUnits/10)));
 const unitCounts=[...countGrid].filter(x=>x>0&&x<=maxUnits).sort((a,b)=>a-b);
 const coarse=[];
 for(const scale of scaleValues){
  const p=planFor(plan,scale,perPayout);
  const v=E.validatePlan(p);
  if(v.errors.length)continue;
  for(const units of unitCounts){
   const r=simulate(p,units,50,inputs.seed+7771);
   const score=assess(r,count,total);
   checked++;
   coarse.push({scale,units,plan:p,score});
   onProgress?.('Testing '+scale.toFixed(2)+'× risk · '+checked+' scenarios checked');
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
  if(ap&&bp)return a.units-b.units||b.score.hit-a.score.hit;
  if(ac&&bc)return Number(b.score.avgNet>=minNetPnl)-Number(a.score.avgNet>=minNetPnl)||b.score.roi-a.score.roi||a.units-b.units;
  return Math.min(count,b.score.avgPaid)-Math.min(count,a.score.avgPaid)||
   Math.min(total,b.score.avgReceipts)-Math.min(total,a.score.avgReceipts)||
   b.score.hit-a.score.hit;
 });
 for(const candidate of coarse.slice(0,8)){
  const confirmed=simulate(candidate.plan,candidate.units,150,inputs.seed+37013);
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
  if(ap&&bp)return a.initialBudget-b.initialBudget||b.score.hit-a.score.hit;
  if(ac&&bc)return Number(b.score.avgNet>=minNetPnl)-Number(a.score.avgNet>=minNetPnl)||b.score.roi-a.score.roi||a.initialBudget-b.initialBudget;
  return b.score.avgPaid-a.score.avgPaid||
   b.score.avgReceipts-a.score.avgReceipts||b.score.roi-a.score.roi;
 });
 return {requiredPayouts:count,profitPerAccount:profitNeeded(plan,perPayout),
  targetCash:total,perPayout,maxInvestment,minRoi,minNetRoi,minNetPnl,checked,
  feasible:candidates.some(meetsAll),payoutCountFeasible:candidates.some(reachesPayouts),
  candidates:candidates.slice(0,5),firm:plan.firm,size:plan.size};
}
function render(out){
 const cards=out.candidates.map((candidate,index)=>{
  const s=candidate.score,p=candidate.plan;
  const risks=p.stageList.map(stage=>{
   const c=p.riskProfiles[stage];
   return '<tr><td>'+c.name+'</td><td>'+money(c.r1)+'</td><td>'+money(c.r2)+'</td><td>'+money(c.r3)+'</td><td>'+c.rr.toFixed(2)+'R</td></tr>';
  }).join('');
  return '<div class="reverse-candidate">'+
   '<h4>'+(index===0?'Best tested scenario':'Alternative '+(index+1))+' · '+candidate.scale.toFixed(2)+'× saved risk</h4>'+
   '<div class="reverse-kpis"><div><small>Tested starting budget</small><strong>'+money(candidate.initialBudget)+'</strong></div>'+
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
   '<div class="tablewrap"><table class="journey-table"><thead><tr><th>Phase</th><th>R1</th><th>R2</th><th>R3</th><th>RR</th></tr></thead><tbody>'+risks+'</tbody></table></div></div>';
 }).join('');
 return '<p class="hint">Goal: '+money(out.targetCash)+' received across at least '+out.requiredPayouts+
  ' separate first payouts of '+money(out.perPayout)+' each. Minimum fee-based ROI: '+pct(out.minRoi)+'. Minimum net ROI on starting investment: '+pct(out.minNetRoi)+'. Minimum net P&L: '+money(out.minNetPnl)+'. The account must first reach approximately '+
  money(out.profitPerAccount)+' funded trading profit (based on the modeled profit payout split, excluding any refunded challenge fee). Probability is the share of trials meeting BOTH payout count and cash received before the chosen trading-day horizon.</p>'+
  (out.feasible?'<p class="good"><strong>At least one validated scenario met the expected payout-count, payout-cash, ROI and USD net P&L targets.</strong></p>':
   '<p class="bad"><strong>No validated scenario met all payout-count, cash, ROI and net P&L targets within your investment ceiling and time horizon.</strong> Closest tested alternatives are shown. Payout-goal probability remains reported separately; an expected target is not a reliable guarantee.</p>')+
  cards+'<p class="hint">Estimates use 150 independent validation trials for shortlisted scenarios after 50-trial searches across risk levels and investment amounts. ROI on incurred fees = expected net cash / expected fees actually incurred. Net ROI on investment = expected net cash / tested starting budget. Both may be negative. Starting budget is cash made available for challenge and activation costs, NOT the total fees actually incurred; any refunded challenge fees are tracked in modeled cash receipts. Payout counts and earnings can differ between trials. Searches are approximate, account purchases are capped at 100 per type, and risk safety depends on modeled firm rules. Scenarios do not change your saved Firms risk settings.</p>';
}
root.StudioPayoutOptimizer={needed,profitNeeded,planFor,assess,optimize,render};
})(typeof window!=='undefined'?window:globalThis);
