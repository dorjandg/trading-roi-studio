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
function planFor(base,scale,perPayout,rrVariant=null,riskMode='saved',r3Route='legacy'){
 const p={...base,riskProfiles:{}};
 const payoutTarget=profitNeeded(base,perPayout);
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
  if(stage==='funded')stageRisk.target=payoutTarget;
  if(riskMode==='adaptive'){
   stageRisk.dynamicMaxRisk=Math.max(.01,Math.floor(maxRisk*scale*100)/100);
   for(const tier of ['r1','r2','r3'])stageRisk[tier]=stageRisk.dynamicMaxRisk;
   if(!(p.id==='topstep'&&stage==='p1'))
    stageRisk.policy={map:{},conflicts:[],mode:r3Route};
  }
  if(riskMode==='target'){
   // Size a clean first win near the stage target, without paying for
   // large overshoot. On a loss, the next tier aims to recover the loss
   // and still clear the original target, subject to real drawdown headroom.
   const rr1=stageRisk.rrByTier?.r1??stageRisk.rr;
   const rr2=stageRisk.rrByTier?.r2??stageRisk.rr;
   const rr3=stageRisk.rrByTier?.r3??stageRisk.rr;
   const cost=val(p.tradeCost),reserve=Math.max(.01,val(p.riskReserve));
   const tier1=Math.min(maxRisk,Math.ceil((stageRisk.target+cost)/rr1*Math.min(1,scale)*100)/100);
   stageRisk.r1=Math.max(.01,tier1);
   if(r3Route==='ladder'&&!(p.id==='topstep'&&stage==='p1')){
    // Deliberately design three executable loss tiers rather than sizing
    // R1 for a single-win target and hoping R3 will still fit.
    // Reserve the largest permitted R3, then distribute the remaining
    // losses across R1/R2 so LLW may reach the phase target.
    const lossRoom=Number.isFinite(p.overallLoss)?
     p.overallLoss-maxRisk-reserve-3*cost-1:Infinity;
    const targetRoom=maxRisk*rr3-stageRisk.target-3*cost;
    const totalEarlyRisk=Math.max(.02,Math.min(lossRoom,targetRoom,2*maxRisk)*Math.min(1,scale));
    stageRisk.r1=Math.max(.01,Math.floor(totalEarlyRisk*.5*100)/100);
    stageRisk.r2=Math.max(.01,Math.floor((totalEarlyRisk-stageRisk.r1)*100)/100);
   }
   const afterLossHeadroom=Math.min(
    Number.isFinite(p.overallLoss)?p.overallLoss-stageRisk.r1-cost-reserve:Infinity,
    Number.isFinite(p.dailyLoss)?p.dailyLoss-cost-reserve:Infinity,
    maxRisk);
   const recovery=Math.ceil((stageRisk.target+stageRisk.r1+2*cost)/rr2*100)/100;
   if(r3Route!=='ladder')stageRisk.r2=Math.max(.01,Math.min(recovery,Math.max(.01,afterLossHeadroom)));
   if(afterLossHeadroom<.01)stageRisk.recoveryInfeasible=true;
   const desiredR3=Math.ceil((stageRisk.target+stageRisk.r1+stageRisk.r2+3*cost)/rr3*100)/100;
   // Alternate R3 routes reserve actual room after TWO consecutive losses.
   // All configured tier sizes remain static; the engine independently blocks
   // every trade if another path leaves less room than this idealized LL path.
   if(r3Route==='balanced'){
    // Trade some single-loss recovery potential for more R3 headroom.
    stageRisk.r2=Math.max(.01,Math.min(stageRisk.r2,Math.floor(stageRisk.r2*.65*100)/100));
   }
   const roomAfterTwo=Math.min(maxRisk,
    Number.isFinite(p.overallLoss)?p.overallLoss-stageRisk.r1-stageRisk.r2-3*cost-reserve-1:Infinity,
    Number.isFinite(p.dailyLoss)?p.dailyLoss-cost-reserve-1:Infinity);
   const feasibleR3=Math.max(.01,Math.floor(roomAfterTwo*100)/100);
   stageRisk.r3=r3Route==='legacy'?Math.max(.01,Math.min(maxRisk,desiredR3)):
    r3Route==='defensive'?Math.max(.01,Math.min(desiredR3,Math.floor(feasibleR3*.5*100)/100)):
    Math.max(.01,Math.min(desiredR3,feasibleR3));
   stageRisk.r3Route=r3Route;
   stageRisk.r3Analysis={
    afterTwoLosses:-Math.round((stageRisk.r1+stageRisk.r2+2*cost)*100)/100,
    availableR3:Math.max(0,roomAfterTwo),
    intendedR3:desiredR3,
    modeledR3:stageRisk.r3,
    feasibleAfterTwoLosses:roomAfterTwo>=stageRisk.r3-.00001&&roomAfterTwo>=.01,
    afterR3Win:Math.round((-stageRisk.r1-stageRisk.r2-2*cost+stageRisk.r3*rr3-cost)*100)/100
   };
   // The intended R2 is selected after a loss; no automatic R2 on a win.
   if(stage!=='p1'||p.id!=='topstep')stageRisk.policy={map:{},conflicts:[],mode:'streak'};
   stageRisk.targetSizing={cleanWin:stageRisk.r1*rr1-cost,
    recoveryWin:stageRisk.r2*rr2-cost,
    recoveryPossible:afterLossHeadroom>=.01&&recovery<=afterLossHeadroom+1e-8};
  }
  p.riskProfiles[stage]=stageRisk;
 }
 p.fundedTarget=payoutTarget;p.riskProfiles.funded.target=payoutTarget;
 return p;
}
function earliestPayoutTimeline(p){
 const phases=(p.stageList||[]).filter(stage=>stage!=='funded').map(stage=>({
  stage,days:Math.max(1,Math.ceil(Number(p.riskProfiles?.[stage]?.minDays)||1))
 }));
 const fundedStart=1+phases.reduce((sum,x)=>sum+x.days,0);
 const waiting=p.id==='topstep'?Math.max(4,Math.ceil(p.fundedWaitDays||0)-1):
  Math.max(0,Math.ceil(p.fundedWaitDays||0)-1);
 const processing=Math.ceil(p.payoutProcessingTradingDays||0);
 return {phases,fundedStart,waiting,processing,
  earliestDay:fundedStart+waiting+processing};
}
function assess(r,count,netTarget,perPayout){
 const trials=r.chartTrials||[];
 const successes=trials.filter(t=>val(t.paid)>=count&&val(t.net)+1e-8>=netTarget).length;
 return {hit:trials.length?successes/trials.length:0,
  avgPaid:val(r.avg.paid),avgReceipts:val(r.avg.receipts),
  avgNet:val(r.avg.net),avgSpent:val(r.avg.spent),p10:val(r.p10),
  avgPurchased:val(r.avg.bought),avgFunded:val(r.avg.funded),
  avgBreached:val(r.avg.failed),avgRiskBlocked:val(r.avg.exhausted),
  avgFundedTargets:val(r.avg.targetHit),avgRequests:val(r.avg.payoutRequested),roi:val(r.roi),
  budgetRoi:r.budget>0?val(r.avg.net)/r.budget:0,
  avgPayout:r.avg.paid?val(r.avg.receipts)/r.avg.paid:0,
  indicativePayouts:Math.ceil((netTarget+val(r.avg.spent))/perPayout),
  chanceAnyPayout:val(r.chancePayout),
  firstPayoutDay:Number.isFinite(r.avgFirstPayoutDay)?r.avgFirstPayoutDay:null,
  goalPayoutDay:Number.isFinite(r.avgGoalPayoutDay)?r.avgGoalPayoutDay:null,
  chanceGoalPayoutDay:val(r.chanceGoalPayoutDay)};
}
async function optimize({plan,perPayout,maxInvestment,minRoi=2,minNetRoi=0,minNetPnl=0,minRR=1.5,maxRR=3,inputs,onProgress}){
 const count=needed(minNetPnl,perPayout);
 if(!E)throw Error('Simulator engine is unavailable.');
 if(!plan)throw Error('Select a prop-firm account.');
 if(!Number.isFinite(minRoi)||minRoi<0||minRoi>100)
  throw Error('Enter an ROI on incurred fees between 0% and 10,000%.');
 if(!Number.isFinite(minNetRoi)||minNetRoi<0||minNetRoi>100)
  throw Error('Enter a net ROI on starting investment between 0% and 10,000%.');
 if(!Number.isFinite(minNetPnl)||minNetPnl<=0)
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
 const riskModes=['target','adaptive','saved'];
 const r3Routes=['legacy','headroom','balanced','defensive','ladder'];
 const candidates=[];
 let checked=0;
 const simulate=(p,units,trials,seed)=>E.simulatePortfolio(p,{
  days:inputs.days,tradesPerDay:inputs.tradesPerDay,winRate:inputs.winRate,
  signalMode:inputs.signalMode,seed,trials,netGoal:minNetPnl,
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
 for(const riskMode of riskModes)for(const rrVariant of rrVariants)
 for(const scale of (riskMode==='target'?[.55,.8,1]:riskMode==='adaptive'?[.65,1]:scaleValues))
 for(const r3Route of (riskMode==='target'?r3Routes:riskMode==='adaptive'?['target-now','repair-r2','buffered-target']:['saved'])){
  const p=planFor(plan,scale,perPayout,rrVariant,riskMode,r3Route);
  const v=E.validatePlan(p);
  if(v.errors.length)continue;
  for(const units of unitCounts){
   const r=simulate(p,units,coarseTrials,inputs.seed+7771);
   const score=assess(r,count,minNetPnl,perPayout);
   checked++;
   coarse.push({scale,units,riskMode,r3Route,rrVariant:rrVariant.name,plan:p,score});
   onProgress?.('Testing '+riskMode+' sizing · '+rrVariant.name+' · '+checked+' scenarios checked');
   if(checked%4===0)await pause();
  }
 }
 if(!coarse.length)throw Error('No valid risk candidates could be simulated.');
 const r3Executable=x=>{
  const p=x.plan;
  return p.stageList.every(stage=>{
   if(p.id==='topstep'&&stage==='p1')return true; // only R1 is used
   const r=p.riskProfiles[stage],cost=val(p.tradeCost),reserve=Math.max(.01,val(p.riskReserve));
   if(!r||![r.r1,r.r2,r.r3].every(n=>Number.isFinite(n)&&n>=.01))return false;
   if(x.riskMode==='adaptive'){
    const rr=t=>Number(r.rrByTier?.[t]??r.rr),cap=r.dynamicMaxRisk||r.r1;
    const daily=Number.isFinite(p.dailyLoss)?p.dailyLoss:Infinity;
    const overall=Number.isFinite(p.overallLoss)?p.overallLoss:Infinity;
    const pick=(remaining,needed)=>Math.floor(Math.max(0,Math.min(cap,needed,remaining-cost-reserve,daily-cost-reserve))*100)/100;
    const first=pick(overall,(r.target+cost)/rr('r1'));
    if(first<.01)return false;
    if(r.policy.mode!=='repair-r2')return true;
    const second=pick(overall-first-cost,(r.target+first+2*cost)/rr('r2'));
    if(second<.01)return false;
    const third=pick(overall-first-second-2*cost,(second+cost)/rr('r3'));
    return third>=.01;
   }
   const losses=r.r1+r.r2+r.r3+3*cost+reserve;
   const dailyCap=Number.isFinite(p.dailyLoss)?p.dailyLoss:Infinity;
   return losses<=p.overallLoss+1e-8&&
     Math.max(r.r1,r.r2,r.r3)+cost+reserve<=dailyCap+1e-8;
  });
 };
  const reachesPayouts=x=>x.score.avgPaid+1e-8>=count&&x.score.avgNet+1e-8>=minNetPnl;
 const meetsAll=x=>reachesPayouts(x)&&x.score.roi+1e-8>=minRoi&&
  x.score.budgetRoi+1e-8>=minNetRoi&&x.score.avgNet+1e-8>=minNetPnl;
 // Shortlist feasible options and closest misses. Independently validate
 // the shortlist with fresh random outcomes to avoid ranking on training noise.
 coarse.sort((a,b)=>{
  const safeA=r3Executable(a),safeB=r3Executable(b);
  if(safeA!==safeB)return safeA?-1:1;
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
   Math.min(minNetPnl,b.score.avgNet)-Math.min(minNetPnl,a.score.avgNet)||
   b.score.hit-a.score.hit;
 });
 // Keep both the strongest payout strategies and fast first-withdrawal
 // candidates; maximizing payout count alone can discard quicker setups.
 const shortlist=[],keys=new Set();
 const add=x=>{const key=x.riskMode+':'+x.r3Route+':'+x.rrVariant+':'+x.scale+':'+x.units;
  if(!keys.has(key)){keys.add(key);shortlist.push(x)}};
 coarse.slice(0,8).forEach(add);
 // Include a strong tested instance of each R3 route so the user can inspect
 // alternatives even when the original optimizer ranking prefers one route.
 for(const route of [...r3Routes,'repair-r2','target-now','buffered-target']){
  const routeCandidate=coarse.find(x=>x.r3Route===route);
  if(routeCandidate)add(routeCandidate);
 }
 coarse.filter(x=>x.score.firstPayoutDay!=null).sort((a,b)=>
  (a.score.firstPayoutDay??Infinity)-(b.score.firstPayoutDay??Infinity)||
  b.score.hit-a.score.hit).slice(0,4).forEach(add);
 for(const candidate of shortlist){
  const confirmed=simulate(candidate.plan,candidate.units,validationTrials,inputs.seed+37013);
  checked++;
  candidates.push({...candidate,r3Feasible:r3Executable(candidate),score:assess(confirmed,count,minNetPnl,perPayout),
   result:confirmed,initialBudget:candidate.units*unit});
  if(checked%3===0)await pause();
 }
 candidates.sort((a,b)=>{
  const safeA=r3Executable(a),safeB=r3Executable(b);
  if(safeA!==safeB)return safeA?-1:1;
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
   b.score.avgNet-a.score.avgNet||b.score.roi-a.score.roi;
 });
 return {requiredPayouts:count,profitPerAccount:profitNeeded(plan,perPayout),
  targetCash:null,perPayout,maxInvestment,minRoi,minNetRoi,minNetPnl,minRR,maxRR,checked,
  feasible:candidates.some(x=>r3Executable(x)&&meetsAll(x)),payoutCountFeasible:candidates.some(x=>r3Executable(x)&&reachesPayouts(x)),
  fastestFirst:candidates.filter(c=>r3Executable(c)&&c.score.firstPayoutDay!=null&&c.score.chanceAnyPayout>=.5).slice().sort((a,b)=>
   a.score.firstPayoutDay-b.score.firstPayoutDay||
   b.score.hit-a.score.hit)[0]||null,
  fastestGoal:candidates.filter(c=>r3Executable(c)&&c.score.goalPayoutDay!=null).slice().sort((a,b)=>
   a.score.goalPayoutDay-b.score.goalPayoutDay||
   b.score.hit-a.score.hit)[0]||null,
  candidates:(()=>{
   const shown=[],seen=new Set();
   const signature=x=>x.plan.stageList.map(stage=>{
    const r=x.plan.riskProfiles[stage];
    return [r.r1,r.r2,r.r3,r.rrByTier?.r1??r.rr,r.rrByTier?.r2??r.rr,r.rrByTier?.r3??r.rr,r.policy?.mode,r.maxWinsPerDay].join(':');
   }).join('|');
   const add=x=>{
    if(!x||!r3Executable(x))return;
    const key=signature(x);
    if(!seen.has(key)){seen.add(key);shown.push(x)}
   };
   // Select only executable, unique configurations for normal scenario cards.
   // Place the top ranked valid candidate first and retain diverse R3 routes.
   candidates.slice(0,1).forEach(add);
   for(const route of ['repair-r2','target-now','buffered-target','ladder','headroom','balanced','defensive','saved']){
    if(shown.length>=5)break;
    add(candidates.find(x=>x.r3Route===route&&r3Executable(x)));
   }
   for(const x of candidates){if(shown.length>=5)break;add(x)}
   return shown.sort((a,b)=>candidates.indexOf(a)-candidates.indexOf(b));
  })(),
  blockedReference:candidates.find(x=>!r3Executable(x))||null,firm:plan.firm,size:plan.size,
  inputs:{days:inputs.days,tradesPerDay:inputs.tradesPerDay,winRate:inputs.winRate,
   purchaseMode:inputs.purchaseMode,capacityMode:inputs.capacityMode}};
}
function gaps(out,score){
 const issues=[];
 if(score.avgPaid+1e-8<out.requiredPayouts)
  issues.push('First payouts short by '+(out.requiredPayouts-score.avgPaid).toFixed(2)+' on average');
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
function diagnoseScenario(candidate,out){
 const s=candidate.score,p=candidate.plan,settings=out.inputs||{};
 const n=out.requiredPayouts,details=[],horizon=Number(settings.days)||0;
 const add=(name,evidence,test)=>details.push({name,evidence,test});
 const timeline=earliestPayoutTimeline(p);
 if(horizon&&timeline.earliestDay>horizon){
  add('Trading period cannot contain a first payout',
   'Earliest theoretical payout day '+timeline.earliestDay+'; selected horizon '+horizon+' trading days, including modeled phase minimums and payout waits.',
   'Test a longer trading horizon. Firm minimum days and eligibility waits are constraints, not values to shorten just to improve a result.');
 }else if(s.avgPaid<.01&&s.avgFundedTargets>=.1){
  add('Funded targets are reached but payments are not arriving',
   s.avgFundedTargets.toFixed(2)+' average funded targets; '+s.avgRequests.toFixed(2)+' payout requests; '+s.avgPaid.toFixed(2)+' paid withdrawals.',
   'Compare a longer horizon and inspect funded waiting/processing rules. Do not change actual firm eligibility requirements.');
 }else if(s.avgPaid<.01&&s.avgFunded>=.1){
  add('Accounts reach funded but do not complete a payout',
   s.avgFunded.toFixed(2)+' average funded accounts; '+s.avgFundedTargets.toFixed(2)+' funded targets reached.',
   'Inspect the funded payout profit target, available signals and time remaining. Test more trading days using the same realistic win rate.');
 }else if(s.avgPaid<.01){
  add('No first payouts completed in the validation trials',
   s.avgPurchased.toFixed(2)+' accounts bought; '+s.avgFunded.toFixed(2)+' reached funded.',
   'Check whether the horizon allows enough phase progress and payment time before optimizing ROI.');
 }
 if(s.avgRiskBlocked>=.5&&s.avgPurchased>0&&s.avgRiskBlocked/s.avgPurchased>=.15){
  add('Risk tiers block a material share of purchased accounts',
   s.avgRiskBlocked.toFixed(2)+' risk-blocked of '+s.avgPurchased.toFixed(2)+' purchased on average; '+s.avgBreached.toFixed(2)+' actually breached.',
   'Compare lower R1/R2/R3 sizing or a different risk-tier sequence. Do not treat risk-blocked accounts as rule breaches.');
 }
 if(s.avgPaid+.01<n&&s.avgFunded>=n&&s.avgFundedTargets<s.avgFunded*.75){
  add('Funded conversion is slower than funding new accounts',
   s.avgFunded.toFixed(2)+' funded, '+s.avgFundedTargets.toFixed(2)+' hit their funded target, '+s.avgPaid.toFixed(2)+' were paid, averaged across trials.',
   'Test enough funded-stage opportunities and review realistic payout profit targets; buying extra accounts alone will not solve the conversion delay.');
 }
 if(s.avgPaid+.01<n&&Number(settings.tradesPerDay)<=2&&horizon>0){
  add('Limited portfolio trade signals',
   settings.tradesPerDay+' signal(s) per day shared by the entire portfolio; at least '+n+' distinct first payouts are needed before fees.',
   'Compare 3 or 5 signals/day only if your real strategy actually produces that many valid entries.');
 }
 if(s.avgPaid>0&&s.avgNet+1e-8<out.minNetPnl){
  add('Net profit remains below the requested target',
   'Expected net '+money(s.avgNet)+' versus '+money(out.minNetPnl)+
   '; expected payout receipts '+money(s.avgReceipts)+' minus costs '+money(s.avgSpent)+'.',
   'Compare budget and risk candidates by net profit and payout success, not by ROI percentage alone. Keep costs and payout waiting realistic.');
 }
 if(s.avgPaid+.01<n&&s.avgNet>=out.minNetPnl){
  add('Net profit passes but the minimum payout count does not',
   'Average '+s.avgPaid.toFixed(2)+' first payouts versus minimum '+n+'.',
   'Inspect the per-account payout target and the number of distinct successful accounts; the simulator models only one first payout per account.');
 }
 if(s.avgPaid+.01<n&&s.avgPurchased<n){
  add('Too few accounts purchased for the payout count',
   s.avgPurchased.toFixed(2)+' purchased on average, fewer than the minimum '+n+' distinct first payouts.',
   'Review the available budget, purchase mode, account capacity, and daily signals. More purchases help only if those accounts can reach payouts.');
 }
 if(s.roi+1e-8<out.minRoi||s.budgetRoi+1e-8<out.minNetRoi){
  add('Optional ROI filter is not met',
   'Fee ROI '+pct(s.roi)+' (minimum '+pct(out.minRoi)+'); budget ROI '+pct(s.budgetRoi)+' (minimum '+pct(out.minNetRoi)+').',
   'Compare actual net dollars and payout probability first. Adjust an ROI constraint only if it is truly optional for your plan.');
 }
 if(s.hit===0&&s.avgPaid>0){
  add('No validation trial achieved the complete goal',
   '0 of 200 validation trials met both the payout-count and net-profit goals. Average first payouts: '+s.avgPaid.toFixed(2)+'.',
   'Try a more realistic time horizon or review the required profit relative to available capital. Do not interpret 0% as mathematical impossibility.');
 }
 if(!details.length){
  add('Review variability before choosing this result',
   'Modeled payout-goal chance '+pct(s.hit)+', mean net '+money(s.avgNet)+', and average '+s.avgPaid.toFixed(2)+' first payouts.',
   'Compare different seeds and the other validated scenarios. Validate assumed win rate and RR using your own trading history.');
 }
 return {headline:details[0].name,items:details.slice(0,4)};
}
const payoutSortModes={
 model:'Optimizer ranking',
 net:'Highest net P&L',
 budgetRoi:'Highest investment ROI',
 feeRoi:'Highest fee ROI',
 chance:'Highest goal probability',
 payouts:'Most first payouts',
 investment:'Lowest starting investment',
 firstDay:'Earliest first payout'
};
function sortedPayoutCandidates(out,sortMode='model'){
 const items=(out.candidates||[]).map((candidate,originalIndex)=>({candidate,originalIndex}));
 const key=Object.prototype.hasOwnProperty.call(payoutSortModes,sortMode)?sortMode:'model';
 if(key==='model')return items;
 return items.sort((a,b)=>{
  const x=a.candidate,y=b.candidate;
  const num=(candidate,field)=>Number(candidate.score?.[field]??0);
  let delta=0;
  switch(key){
   case 'net':delta=num(y,'avgNet')-num(x,'avgNet');break;
   case 'budgetRoi':delta=num(y,'budgetRoi')-num(x,'budgetRoi');break;
   case 'feeRoi':delta=num(y,'roi')-num(x,'roi');break;
   case 'chance':delta=num(y,'hit')-num(x,'hit');break;
   case 'payouts':delta=num(y,'avgPaid')-num(x,'avgPaid');break;
   case 'investment':delta=Number(x.initialBudget)-Number(y.initialBudget);break;
   case 'firstDay':delta=(x.score.firstPayoutDay??Infinity)-(y.score.firstPayoutDay??Infinity);break;
  }
  return delta||a.originalIndex-b.originalIndex;
 });
}
function portfolioModelComparison(out,order){
 const ranked=sortedPayoutCandidates(out,order);
 const number=n=>n==null||!Number.isFinite(Number(n))?'—':Number(n).toFixed(2);
 const rows=ranked.map(({candidate},i)=>{
  const k=candidate.result?.tradeKpis||{},s=candidate.score,p=candidate.plan;
  const details=p.stageList.map(stage=>{
   const r=p.riskProfiles[stage],dynamic=candidate.riskMode==='adaptive';
   const v=dynamic&&E.previewLossPath?
    E.previewLossPath(p,stage,3).map(x=>x.allowed?number(x.risk):'Blocked'):
    ['r1','r2','r3'].map(t=>number(r[t]));
   return '<div class="reverse-model-phase"><b>'+escapeHtml(r.name||stage)+'</b> · '+
    escapeHtml(r.policy?.mode||'saved')+' · '+v.join(' / ')+' USD · '+
    ['r1','r2','r3'].map(t=>number(r.rrByTier?.[t]??r.rr)).join(' / ')+'R</div>';
  }).join('');
  return '<tr><th scope="row">Option '+(i+1)+' · '+escapeHtml(candidate.r3Route||'saved')+
   '<details><summary>R1 / R2 / R3 by phase</summary>'+details+'</details></th>'+
   '<td>'+money(s.avgNet)+'</td><td>'+pct(s.budgetRoi)+'</td><td>'+pct(s.hit)+'</td>'+
   '<td>'+number(k.pf)+'</td><td>'+(k.wr==null?'—':pct(k.wr))+'</td><td>'+number(k.rr)+'</td>'+
   '<td>'+number(k.ar)+'</td><td>'+(k.aw==null?'—':money(k.aw))+'</td><td>'+(k.al==null?'—':money(k.al))+'</td><td>'+(k.ev==null?'—':money(k.ev))+'</td>'+
   '<td>'+number(candidate.result?.avg?.trades)+'</td></tr>';
 }).join('');
 return '<details class="reverse-model-comparison"><summary><strong>Compare trading models &amp; R1/R2/R3</strong> · same KPI format as Section 3</summary>'+
  '<p class="hint">These are the validated investment scenarios, not another model search. Adaptive values represent the calculated consecutive-loss path, not fixed trade risks.</p>'+
  '<div class="tablewrap"><table class="reverse-model-table"><thead><tr><th>Model</th><th>Net</th><th>ROI</th><th>Goal</th><th>PF</th><th>WR</th><th>RR</th><th>AR</th><th>AW</th><th>AL</th><th>EV</th><th>Trades</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
  '<p class="hint">PF = profit factor · WR = win rate · RR = planned reward/risk · AR = realized R · AW / AL = average winning / losing trade · EV = average trade P&L. Open a phase to inspect its risk sequence.</p></details>';
}
function render(out,sortMode='model',currentPlan=null){
 const selectedSort=Object.prototype.hasOwnProperty.call(payoutSortModes,sortMode)?sortMode:'model';
 const cards=sortedPayoutCandidates(out,selectedSort).map(({candidate,originalIndex},index)=>{
 const pathIndex=originalIndex;
  const s=candidate.score,p=candidate.plan,advice=diagnoseScenario(candidate,out);
  const policyLabels={saved:'Saved options',streak:'After-loss tiers',flat:'Flat R1', 'after-win':'Increase after win','protect-after-loss':'Protect after loss','target-now':'Adaptive target','repair-r2':'Repair R2','buffered-target':'Buffered target'};
  const dynamicOption=candidate.riskMode==='adaptive';
  const dollars2=n=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const limitInfo=p.stageList.map(stage=>{
   const x=p.riskProfiles[stage]||{},baseline=currentPlan?.riskProfiles?.[stage]||{};
   const mode=x.policy?.mode||'saved';
   const rr=t=>Number(x.rrByTier?.[t]??x.rr);
   const oldRr=t=>Number(baseline.rrByTier?.[t]??baseline.rr);
   const changed=['r1','r2','r3'].filter(t=>Math.abs(Number(x[t])-Number(baseline[t]))>.005||Math.abs(rr(t)-oldRr(t))>.00001);
   const changedOther=Number(x.maxWinsPerDay)!==Number(baseline.maxWinsPerDay)||mode!==(baseline.policy?.mode||'saved');
   const difference=!currentPlan?'No saved profile':(changed.length||changedOther?'Changed':'Same');
   const riskDisplay=dynamicOption?(()=>{
    const path=E.previewLossPath(p,stage,3);
    return [0,1,2].map(i=>{
     const v=path[i];
     if(!v)return '<td>—</td>';
     return '<td>'+(v.allowed?'<b>'+dollars2(v.risk)+'</b>':'<span class="bad">Blocked</span>')+
      '<small class="reverse-risk-tier">'+escapeHtml(v.slot.toUpperCase())+'</small></td>';
    }).join('');
   })():'<td>'+['r1','r2','r3'].map(t=>dollars2(x[t])).join(' / ')+'</td>';
   return '<tr><td>'+escapeHtml(x.name||stage)+'</td>'+
    '<td>'+escapeHtml(policyLabels[mode]||mode)+'</td>'+
    '<td>'+dollars2(x.target)+'</td>'+
    '<td>'+Number(x.maxWinsPerDay||1)+'</td>'+
    '<td>'+Number(x.minDays||0)+'</td>'+
    riskDisplay+
    '<td>'+['r1','r2','r3'].map(t=>rr(t).toFixed(2)+'R').join(' / ')+'</td>'+
    '<td>'+difference+'</td></tr>';
  }).join('');
  const sim=out.inputs||{};
  const checks=currentPlan?'<p class="hint">Compared with the current saved Firms account profile. “Changed” refers to phase risks, tier RR, policy or winning-day cap, not firm-required limits.</p>':
   '<p class="hint">No saved Firms profile was found for this account. Open the account in Firms and save a profile before transferring.</p>';
  const compareMarkup=currentPlan?'<details class="reverse-review-panel"><summary><strong>3 · Compare risk with current Firms defaults</strong> · before / proposed</summary>'+
   '<div class="tablewrap"><table class="journey-table"><thead><tr><th>Phase</th><th>Parameter</th><th>Current Firms</th><th>Scenario</th></tr></thead><tbody>'+
   p.stageList.flatMap(stage=>{
    const a=currentPlan.riskProfiles?.[stage]||{},b=p.riskProfiles?.[stage]||{};
    const rr=t=>Number(b.rrByTier?.[t]??b.rr),ar=t=>Number(a.rrByTier?.[t]??a.rr);
    const rows=[...(candidate.riskMode==='adaptive'?[['Maximum risk per trade',money(a.dynamicMaxRisk??Math.max(Number(a.r1)||0,Number(a.r2)||0,Number(a.r3)||0)),money(b.dynamicMaxRisk??b.r1)]]:['r1','r2','r3'].map(t=>[t.toUpperCase()+' USD risk',money(a[t]),money(b[t])])),
     ...['r1','r2','r3'].map(t=>[t.toUpperCase()+' RR',ar(t).toFixed(2)+'R',rr(t).toFixed(2)+'R']),
     ['Risk sequence',a.policy?.mode||'saved',b.policy?.mode||'saved'],
     ['Max winning trades/day',a.maxWinsPerDay??'—',b.maxWinsPerDay??'—'],
     ['Safety reserve',money(currentPlan.riskReserve),money(p.riskReserve)]];
    return rows.filter(([name,oldValue,newValue])=>String(oldValue)!==String(newValue)).map(([name,oldValue,newValue])=>
     '<tr><td>'+escapeHtml(a.name||stage)+'</td><td>'+escapeHtml(name)+'</td><td>'+escapeHtml(oldValue)+'</td><td><b>'+escapeHtml(newValue)+'</b></td></tr>');
   }).join('')+'</tbody></table></div><p class="hint">Only differences are shown. Adaptive scenarios calculate trade risk dynamically; their risk caps are not three fixed R1/R2/R3 order sizes. Account targets, fees and firm limits remain unchanged by transfer.</p></details>':'';
  const r3Paths=p.stageList.map(stage=>{
   const r=p.riskProfiles[stage],x=r.r3Analysis;
   if(!x)return '';
   const status=x.feasibleAfterTwoLosses?'Sized to fit idealized loss path':'Blocked after two losses';
   return '<tr><th>'+escapeHtml(r.name||stage)+'</th><td>'+money(r.r1)+' / '+money(r.r2)+' / '+money(r.r3)+'</td>'+
    '<td>'+money(x.availableR3)+'</td><td>'+escapeHtml(status)+'</td><td>'+
    (x.afterR3Win>=0?'+':'−')+money(Math.abs(x.afterR3Win))+'</td></tr>';
  }).join('');
  const r3Descriptions={legacy:'Original recovery amount (may be blocked by drawdown)',headroom:'Use the maximum R3 risk that still fits after two modeled losses',balanced:'Reduce R2 to preserve additional room for R3',defensive:'Use half of the remaining safe R3 headroom',ladder:'Size all three risks together so an R3 win after two losses can reach the phase target when mathematically feasible'};
  const r3Markup=r3Paths?'<details class="reverse-review-panel"><summary><strong>1A · R3 alternative route</strong> · '+escapeHtml(candidate.r3Route||'legacy')+' sizing and feasibility</summary>'+
   '<p class="hint">'+escapeHtml(r3Descriptions[candidate.r3Route]||r3Descriptions.legacy)+'</p>'+
   '<div class="tablewrap"><table class="journey-table"><thead><tr><th>Phase</th><th>R1 / R2 / R3</th><th>R3 headroom after LL</th><th>Can R3 trade?</th><th>Stage P&L after LLW</th></tr></thead><tbody>'+r3Paths+'</tbody></table></div>'+
   '<p class="hint">LL = R1 loss then R2 loss on later trading days; LLW adds an R3 win. Headroom assumes no earlier gains or losses in that phase, and includes modeled costs/reserve and a $1 buffer. A legal R3 win may still leave the phase below its profit target. The engine checks every actual trade separately. These are alternative hypotheses, not guaranteed recovery.</p></details>':'';
  const setupMarkup='<details class="reverse-review-panel"><summary><strong>1 · Trading rules &amp; risks</strong> · phase-by-phase setup</summary>'+
   '<div class="tablewrap"><table class="journey-table"><thead><tr><th>Phase</th><th>Risk sequence</th><th>Target</th><th>Max wins/day</th><th>Min trading days</th>'+(dynamicOption?'<th>First trade</th><th>After 1 loss</th><th>After 2 losses</th>':'<th>R1 / R2 / R3</th>')+'<th>RR per tier</th><th>vs Firms</th></tr></thead><tbody>'+limitInfo+'</tbody></table></div>'+checks+
   '<p class="hint">'+(dynamicOption?
   'These are calculated risks for a hypothetical loss → loss → loss path on separate trading days, using the same sizing logic as the simulator. The small R1/R2/R3 tags identify the tier selected. Adaptive Target normally selects R1 every day; it does not have three distinct fixed tiers. Actual risk depends on the account history and available drawdown. Open an example account trade path for realized modeled trades.':
   'The configured risk amounts are USD per trade and RR is the simulated reward/risk ratio. Actual lot-size margin and trade execution are not verified.')+'</p></details>'+
   '<details class="reverse-review-panel"><summary><strong>2 · Account &amp; simulation assumptions</strong> · budget, frequency and payout rules</summary>'+
   '<div class="reverse-review-grid">'+
   [['Starting budget',money(candidate.initialBudget)],['Challenge fee',money(p.fee)],['Safety reserve',money(p.riskReserve)],['Daily / overall loss',money(p.dailyLoss)+' / '+money(p.overallLoss)],['Trading days',sim.days??'—'],['Signals per day',sim.tradesPerDay??'—'],['Assumed win rate',sim.winRate==null?'—':Number(sim.winRate).toFixed(1)+'%'],['Signal outcomes',sim.signalMode||'—'],['Buying mode',sim.purchaseMode||'—'],['Allocation',sim.capacityMode||'—'],['Payout per account',money(out.perPayout)],['Funded wait / processing',Number(p.payoutWaitCalendarDays||0)+' / '+Number(p.payoutProcessingCalendarDays||0)+' calendar days']].map(([name,value])=>'<div><small>'+escapeHtml(name)+'</small><strong>'+escapeHtml(value)+'</strong></div>').join('')+
   '</div><p class="hint">Search assumptions and investment budget are not Firms account defaults. Firm fees, drawdown limits and mandatory qualification requirements stay protected.</p></details>'+
   compareMarkup+
   '<div class="reverse-review-actions">'+(candidate.riskMode==='adaptive'?
   '<span class="hint">Dynamic policies are available in this simulator only. Firms does not yet support state-based automatic sizing, so transfer is disabled.</span>':
   '<button type="button" data-reverse-send-firms="'+pathIndex+'">Send this risk setup to Firms</button>')+
   '<span class="hint">Optional · confirmation required · previous Firms settings backed up. The saved account is not changed by simply opening this option.</span></div>'+ 
   '<p class="reverse-review-status" role="status" aria-live="polite"></p>';
  const goalMet=candidate.r3Feasible!==false&&s.avgNet+1e-8>=out.minNetPnl&&s.avgPaid+1e-8>=out.requiredPayouts&&
   s.roi+1e-8>=out.minRoi&&s.budgetRoi+1e-8>=out.minNetRoi;
  const summaryMetric=(label,value,extra='')=>'<span class="reverse-compact-metric '+extra+'"><small>'+
   label+'</small><strong>'+value+'</strong></span>';
  return '<details class="reverse-candidate" data-scenario-route="'+escapeHtml(candidate.r3Route||'saved')+'">'+
   '<summary class="reverse-candidate-summary">'+
   '<span class="reverse-candidate-name">'+(index===0?(selectedSort==='model'?'Top by optimizer':'Top by '+payoutSortModes[selectedSort]):'Option '+(index+1))+
   ' · '+(candidate.riskMode==='target'?'Target':candidate.riskMode==='adaptive'?'Adaptive':'Saved')+' risk'+(candidate.riskMode==='target'?' · R3 '+escapeHtml(candidate.r3Route||'legacy'):candidate.riskMode==='adaptive'?' · '+escapeHtml(candidate.r3Route||'dynamic'):'')+(candidate.riskMode==='target'&&p.stageList.some(stage=>!(p.id==='topstep'&&stage==='p1')&&p.riskProfiles[stage]?.r3Analysis?.feasibleAfterTwoLosses===false)?' · R3 blocked on LL':'')+
   '<span class="reverse-candidate-status '+(goalMet?'reverse-status-met':'')+'">'+
   (candidate.r3Feasible===false?'R3 blocked after LL':goalMet?'Targets met':'Below target')+'</span></span>'+
   '<span class="reverse-summary-kpis">'+
   summaryMetric('Net P&L',money(s.avgNet))+
   summaryMetric('Net ROI',pct(s.budgetRoi))+
   summaryMetric('Investment',money(candidate.initialBudget))+
   summaryMetric('Goal chance',pct(s.hit))+'</span>'+
   '<span class="reverse-summary-toggle">Details</span>'+
   '</summary>'+
   '<div class="reverse-candidate-body">'+
   '<div class="reverse-option-actions"><button type="button" class="primary" data-reverse-analyze="'+pathIndex+'">Run Full Simulation · Sections 4–7</button>'+
   '<button type="button" data-reverse-more-models="'+pathIndex+'">Find More Risk Models</button>'+
   '<small>Recalculate with Section 2 Monte Carlo trial count and this option’s exact R1/R2/R3 setup, then view results, charts, account journey and trade history below.</small></div>'+
   '<div class="reverse-detail-label">SCENARIO DETAILS</div>'+setupMarkup+r3Markup+
   '<details class="reverse-diagnostic"><summary><strong>4 · Diagnostics &amp; suggestions</strong><small> · Why this scenario struggles</small></summary><div class="reverse-advice"><strong>Why this scenario struggles · what to test</strong>'+
   advice.items.map(d=>'<div class="reverse-advice-item"><strong>'+escapeHtml(d.name)+'</strong>'+
    '<span>'+escapeHtml(d.evidence)+'</span><em>'+escapeHtml(d.test)+'</em></div>').join('')+
   '<small>Suggestions are diagnostic hypotheses based on this simulated result, not proof that changing a setting will improve real trading. Recalculate after each change.</small></div></details>'+ 
   '<p class="hint" style="margin:4px 0 6px"><strong>Target checks:</strong> '+
   (gaps(out,s).length?gaps(out,s).join(' · '):'All expected targets met')+'</p>'+
   '<div class="reverse-detail-label">5 · DETAILED PERFORMANCE</div><div class="reverse-kpis"><div><small>First payout day (paid trials)</small><strong>'+ (s.firstPayoutDay==null?'Not reached':'Day '+s.firstPayoutDay.toFixed(1))+'</strong></div>'+
   '<div><small>Full payout goal day</small><strong>'+(s.goalPayoutDay==null?'Not reached':'Day '+s.goalPayoutDay.toFixed(1))+'</strong></div>'+
   '<div><small>Tested starting budget</small><strong>'+money(candidate.initialBudget)+'</strong></div>'+
   '<div><small>ROI on incurred fees</small><strong>'+pct(s.roi)+'</strong></div>'+ 
   '<div><small>Net ROI on investment</small><strong>'+pct(s.budgetRoi)+'</strong></div>'+ 
   '<div><small>Chance of payout goal</small><strong>'+pct(s.hit)+'</strong></div>'+
   '<div><small>Avg. first payouts</small><strong>'+s.avgPaid.toFixed(2)+'</strong></div>'+
   '<div><small>Est. payouts incl. fees</small><strong>'+s.indicativePayouts+'</strong></div>'+
   '<div><small>Avg. cash received</small><strong>'+money(s.avgReceipts)+'</strong></div>'+
   '<div><small>Avg. incurred fees</small><strong>'+money(s.avgSpent)+'</strong></div>'+
   '<div><small>Avg. net after fees</small><strong>'+money(s.avgNet)+'</strong></div>'+ 
   '<div><small>Avg. challenges bought</small><strong>'+s.avgPurchased.toFixed(2)+'</strong></div>'+ 
   '<div><small>Avg. funded reached</small><strong>'+s.avgFunded.toFixed(2)+'</strong></div>'+ 
   '<div><small>Risk-blocked / breached</small><strong>'+s.avgRiskBlocked.toFixed(1)+' / '+s.avgBreached.toFixed(1)+'</strong></div></div>'+
   (candidate.riskMode==='target'?'<details class="reverse-sizing-info"><summary>How the risks are calculated</summary><p class="hint">'+
   'R1 aims at the stage profit target with a single win at its R1 RR. Following one loss, the streak policy selects R2; recovery sizing includes the previous loss and trade costs, but is capped by remaining drawdown headroom. Stage minimum trading days and payout waiting still apply. If recovery cannot fit within the loss limit, no risk value can guarantee an immediate recovery.</p></details>':'')+

   (sampleAccounts(candidate).length?(()=>{
    const accounts=sampleAccounts(candidate),example=chooseExampleAccount(accounts);
    const options=accounts.map(ac=>'<option value="'+escapeHtml(ac.id)+'"'+(ac.id===example.id?' selected':'')+'>'+
     'Account #'+escapeHtml(ac.id)+' · '+escapeHtml(ac.status)+
     ' · '+(ac.trades||0)+' trades'+(ac.paidDay!=null?' · Paid day '+ac.paidDay:'')+'</option>').join('');
    return '<details class="reverse-trade-details"><summary>Trade-by-trade example · show / hide <small>(trial #1 · '+accounts.length+' accounts)</small></summary>'+
     '<div class="reverse-path-controls"><label>Account <select data-reverse-path="'+pathIndex+'">'+options+'</select></label>'+
     '<span class="hint">Select any account to inspect exact trade and phase progression.</span></div>'+
     '<div data-reverse-path-body="'+pathIndex+'">'+renderAccountPath(candidate,example.id)+'</div></details>';
   })():'<p class="hint">Trade-by-trade account details unavailable for this scenario.</p>')+
   '</div></details>';
 }).join('');
 return '<div class="reverse-simple-heading">Simulation result</div>'+
  '<details class="reverse-info-section"><summary><strong>Target &amp; calculation rules</strong> <span>· '+out.requiredPayouts+' minimum payouts · '+money(out.minNetPnl)+' net goal</span></summary><p class="hint">Net P&L target: '+money(out.minNetPnl)+' after incurred fees. Minimum '+out.requiredPayouts+
  ' first payouts at '+money(out.perPayout)+' each before fees; more may be needed to cover purchase costs. Allowed trade RR: '+out.minRR.toFixed(2)+'–'+out.maxRR.toFixed(2)+'R. Minimum fee-based ROI: '+pct(out.minRoi)+'. Minimum net ROI on starting investment: '+pct(out.minNetRoi)+'. Minimum net P&L: '+money(out.minNetPnl)+'. The account must first reach approximately '+
  money(out.profitPerAccount)+' funded trading profit (based on the modeled profit payout split, excluding any refunded challenge fee). Probability is the share of trials reaching the minimum first-payout count AND net P&L target within the trading-day horizon.</p></details>'+
  '<div class="reverse-result-overview"><strong>Result summary</strong> · '+(out.feasible?'<span class="good">Target met in a validated scenario</span>':'<span class="bad">No scenario met all targets</span>')+'</div>'+ 
  (out.candidates[0]?'<p class="reverse-critical-gap"><strong>Most important gap:</strong> '+
   (gaps(out,out.candidates[0].score)[0]||'No expected-value target gap; check payout probability and downside risk')+'</p>':'')+
  '<details class="reverse-info-section"><summary><strong>Fastest payout timing</strong> <span>· '+(out.fastestFirst?'first payout day '+out.fastestFirst.score.firstPayoutDay.toFixed(1):'no qualifying first payout')+'</span></summary><div class="reverse-speed-summary"><strong>Fastest payout KPIs (validated scenarios)</strong> · '+
  (out.fastestFirst?'First paid withdrawal: day '+out.fastestFirst.score.firstPayoutDay.toFixed(1)+
   ' ('+escapeHtml(out.fastestFirst.riskMode)+'-sized risk, '+money(out.fastestFirst.initialBudget)+
   ' starting budget, '+pct(out.fastestFirst.score.chanceAnyPayout)+' chance of any payout)':'No scenario had both a first payout and ≥50% payout likelihood')+' · '+
  (out.fastestGoal?'Full '+out.requiredPayouts+'-payout goal: day '+out.fastestGoal.score.goalPayoutDay.toFixed(1)+
   ' in successful trials':'Net profit / payout-count goal not reached in validated trials')+
  '<small> · Conditional averages, not guaranteed dates; minimum-day and processing waits included.</small></div></details>'+
  '<div class="reverse-simple-heading">Scenarios <small>('+out.candidates.length+')</small></div>'+
  portfolioModelComparison(out,selectedSort)+ 
'<div class="reverse-sort-bar"><label for="payoutResultsSort"><strong>Sort scenarios by</strong></label><select id="payoutResultsSort" aria-label="Sort validated scenarios">'+
  Object.entries(payoutSortModes).map(([value,label])=>'<option value="'+value+'"'+(selectedSort===value?' selected':'')+'>'+escapeHtml(label)+'</option>').join('')+
  '</select><small>'+out.checked+' tested · changing sort does not rerun.</small></div>'+
  cards+
  '<details class="reverse-meta-details"><summary>References &amp; methodology</summary>'+(out.blockedReference?'<details class="reverse-info-section"><summary><strong>Excluded reference · blocked R3</strong> <span>· previous risk sizing, not recommended as an executable sequence</span></summary><p class="hint">The original R3 amount does not fit after two consecutive losses in at least one stage. It remains in the search results for comparison, but is excluded from the selectable and transferable scenario cards. For comparison, its Phase 1 R1/R2/R3 amounts were '+
  (out.blockedReference.plan.riskProfiles.p1?['r1','r2','r3'].map(t=>money(out.blockedReference.plan.riskProfiles.p1[t])).join(' / '):'not applicable')+
  '. These results are model assumptions, not permission to exceed a firm loss limit.</p></details>':'')+
  '<details class="reverse-info-section"><summary><strong>How to interpret these estimates</strong> <span>· Monte Carlo methodology and ROI definitions</span></summary><p class="hint">Estimates use 200 independent validation trials per shortlisted scenario after 50-trial searches across risk levels and investment amounts. ROI on incurred fees = expected net cash / expected fees actually incurred. Net ROI on investment = expected net cash / tested starting budget. Both may be negative. Starting budget is cash made available for challenge and activation costs, NOT the total fees actually incurred; any refunded challenge fees are tracked in modeled cash receipts. Payout counts and earnings can differ between trials. Searches are approximate, account purchases are capped at 100 per type, and risk safety depends on modeled firm rules. Scenarios do not change your saved Firms risk settings.</p></details></details>';
}
function renderMoreInvestmentModels(search,origin='Selected scenario'){
 const fmt=n=>n==null||!Number.isFinite(Number(n))?'—':Number(n).toFixed(2);
 const rate=n=>n==null?'—':(Number(n)*100).toFixed(1)+'%';
 const usd=n=>n==null||!Number.isFinite(Number(n))?'—':money(Number(n));
 const baseline=search.baseline.holdout;
 const models=[{title:'Selected investment · baseline',plan:search.baseline.plan,holdout:baseline},...search.ideas];
 const rows=models.map((m,i)=>{
  const r=m.holdout,k=r.tradeKpis||{};
  const riskDetails=m.plan.stageList.map(stage=>{
   const p=m.plan.riskProfiles[stage],adaptive=['target-now','repair-r2','buffered-target'].includes(p.policy?.mode);
   const values=adaptive&&E.previewLossPath?E.previewLossPath(m.plan,stage,3).map(x=>x.allowed?fmt(x.risk):'Blocked'):
    ['r1','r2','r3'].map(t=>fmt(p[t]));
   return '<div class="payout-more-phase"><strong>'+escapeHtml(p.name||stage)+'</strong> · '+
    escapeHtml(p.policy?.mode||'saved')+' · '+values.join(' / ')+' USD · '+
    ['r1','r2','r3'].map(t=>fmt(p.rrByTier?.[t]??p.rr)).join(' / ')+'R</div>';
  }).join('');
  const delta=r.avg.net-baseline.avg.net;
  const compare=i===0?'Baseline':(delta>=0?'+':'')+usd(delta);
  return '<tr><th scope="row">'+escapeHtml(m.title)+
   '<details><summary>Phase risk rules</summary>'+riskDetails+'</details></th>'+
   '<td>'+usd(r.avg.net)+'</td><td>'+rate(r.roi)+'</td><td>'+rate(r.chanceGoal)+'</td>'+
   '<td>'+compare+'</td><td>'+fmt(k.pf)+'</td><td>'+rate(k.wr)+'</td><td>'+fmt(k.rr)+'</td>'+
   '<td>'+fmt(k.ar)+'</td><td>'+usd(k.aw)+'</td><td>'+usd(k.al)+'</td>'+
   '<td>'+usd(k.ev)+'</td><td>'+fmt(r.avg.trades)+'</td>'+
   '<td><button type="button" data-more-analyze="'+i+'">Analyze</button></td></tr>';
 }).join('');
 return '<div class="payout-more-title"><strong>More trading models · '+models.length+' compared</strong>'+
  '<small>Based on '+escapeHtml(origin)+' · '+search.evaluated+' risk configurations tested</small>'+
  '<button type="button" data-more-close="1">Close</button></div>'+
  '<p class="hint">Separate '+search.trainTrials+'-trial discovery and '+search.testTrials+
  '-trial validation at this option’s fixed investment budget and trading assumptions. Baseline is the original investment setup; additional models are risk variations, not newly optimized budgets. Select Phase risk rules to inspect R1/R2/R3; Analyze opens Sections 4–7. No Firms settings are changed.</p>'+
  '<div class="tablewrap"><table class="payout-more-table"><thead><tr>'+
  '<th>Model</th><th>Net</th><th>ROI</th><th>Goal</th><th>Δ Net</th><th>PF</th><th>WR</th><th>RR</th><th>AR</th><th>AW</th><th>AL</th><th>EV</th><th>Trades</th><th>View</th>'+
  '</tr></thead><tbody>'+rows+'</tbody></table></div>';
}

root.StudioPayoutOptimizer={needed,profitNeeded,planFor,assess,optimize,render,renderAccountPath,sampleAccounts,diagnoseScenario,renderMoreInvestmentModels};
})(typeof window!=='undefined'?window:globalThis);
