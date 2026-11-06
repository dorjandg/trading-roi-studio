/* 4Ds Portfolio Sim — model discovery / risk policy experiments.
   Search and holdout use paired trade outcomes; no historical edge is inferred. */
(function(root){
'use strict';
const E=root.StudioPortfolioEngine;
if(!E)throw Error('Portfolio engine must load before model discovery');
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,Number(x)||0));
const stages=['p1','p2','funded'];
const copy=p=>({...p,riskProfiles:Object.fromEntries(Object.entries(p.riskProfiles).map(([k,v])=>[k,{...v,policy:{...v.policy,map:{...(v.policy?.map||{})},conflicts:[...(v.policy?.conflicts||[])]}}]))});
const round=x=>Math.max(.01,Math.round(x*100)/100);
const floorCent=x=>Math.floor((x+1e-9)*100)/100;
function riskCeiling(base){
 const daily=Number.isFinite(base.dailyLoss)?Math.max(0,base.dailyLoss):Infinity;
 const overall=Number.isFinite(base.overallLoss)?Math.max(0,base.overallLoss):Infinity;
 const reserve=Math.max(.01,Math.max(0,Number(base.riskReserve)||0));
 const tradeCost=Math.max(0,Number(base.tradeCost)||0);
 const gross=Math.min(daily,overall);
 const maxRisk=Number.isFinite(gross)?Math.max(0,floorCent(gross-reserve-tradeCost)):null;
 return {daily,overall,reserve,tradeCost,gross,maxRisk,
  limiting:daily<=overall?'daily':'overall',hasVerifiedCeiling:Number.isFinite(gross)};
}
function propose(base){
 const list=[{key:'baseline',title:'Your current settings',reason:'No parameters changed',modify:()=>{}}];
 function add(key,title,reason,modify){list.push({key,title,reason,modify});}
 // For adaptive investment models, vary the actual per-trade cap and
 // policy. Merely changing stored R1/R2/R3 would not affect adaptive sizing.
 if(Object.values(base.riskProfiles).some(r=>['target-now','repair-r2','buffered-target'].includes(r.policy?.mode))){
  const max=riskCeiling(base).maxRisk;
  const setCap=(p,fn)=>{
   for(const [stage,r] of Object.entries(p.riskProfiles)){
    if(!['target-now','repair-r2','buffered-target'].includes(r.policy?.mode))continue;
    const cap=Math.max(.01,Math.min(Number.isFinite(max)?max:Infinity,round(fn(r,stage))));
    r.dynamicMaxRisk=cap;r.r1=cap;r.r2=cap;r.r3=cap;
   }
  };
  for(const factor of [.5,.65,.8,.9,1.1]){
   add('dynamicScale'+factor,'Adaptive cap · '+Math.round(factor*100)+'%',
    'Adjust maximum allowed risk without changing the adaptive daily sizing formula',
    p=>setCap(p,r=>Number(r.dynamicMaxRisk??r.r1)*factor));
  }
  for(const mode of ['target-now','repair-r2','buffered-target']){
   add('dynamicPolicy'+mode,'Policy · '+mode,
    'Compare a different state-aware approach with the same safe risk ceiling',
    p=>{for(const r of Object.values(p.riskProfiles)){
     if(['target-now','repair-r2','buffered-target'].includes(r.policy?.mode))
      r.policy={...r.policy,mode,map:{},conflicts:[]};
    }});
  }
  for(const stage of Object.keys(base.riskProfiles)){
   for(const fraction of [.7,1]){
    add('dynamicStage'+stage+fraction,'Cap '+stage+' · '+Math.round(fraction*100)+'%',
     'Change only the selected phase risk ceiling, leaving the other phases unchanged',
     p=>{const r=p.riskProfiles[stage];if(!r)return;
      setCap(p,(x,k)=>k===stage?Number(x.dynamicMaxRisk??x.r1)*fraction:Number(x.dynamicMaxRisk??x.r1));
     });
   }
  }
  for(const limit of [1,2,3]){
   add('dynamicWins'+limit,limit+' max wins per day',
    'Adjust same-day winning-trade continuation without increasing risk limits',
    p=>{for(const r of Object.values(p.riskProfiles))r.maxWinsPerDay=limit});
  }
  const seen=new Set(),out=[];
  for(const option of list){
   const plan=copy(base);option.modify(plan);
   const signature=JSON.stringify(Object.values(plan.riskProfiles).map(r=>[
    r.dynamicMaxRisk??r.r1,r.rr,r.maxWinsPerDay,r.policy?.mode||'saved',r.r1,r.r2,r.r3]));
   if(seen.has(signature))continue;seen.add(signature);
   if(Object.values(plan.riskProfiles).some(r=>
    ['r1','r2','r3'].some(t=>!Number.isFinite(r[t])||r[t]<=0||
     (Number.isFinite(max)&&r[t]>max+1e-8))))continue;
   out.push({...option,plan});
  }
  return out;
 }
 for(const factor of [.65,.8,.9,1.1,1.25]){
  add('scale'+factor,factor<1?'Smaller risks · '+Math.round(factor*100)+'%':'Higher risks · '+Math.round(factor*100)+'%',
   'Scale all three risk amounts in every phase, keeping your original tier sequence',
   p=>{for(const c of Object.values(p.riskProfiles))for(const level of ['r1','r2','r3'])c[level]=round(c[level]*factor)});
 }
 for(const [key,title,two,three] of [
  ['steady75','Lighter recovery',.75,.55],
  ['protect60','Protect after losses',.60,.35],
  ['soft90','Near-flat recovery',.90,.80],
  ['rec115','Higher recovery risk',1.15,1.3],
  ['rec100','No increase after losses',1,1]
 ]){
  add(key,title,'Set recovery risks relative to R1; use actual consecutive losses only',
   p=>{for(const c of Object.values(p.riskProfiles)){c.r2=round(c.r1*two);c.r3=round(c.r1*three);c.policy={map:{},conflicts:[],mode:'streak'}}});
 }
 add('flat','One fixed risk','Use R1 for every trade; do not vary size after wins or losses',
  p=>{for(const c of Object.values(p.riskProfiles)){c.r2=c.r1;c.r3=c.r1;c.policy={map:{},conflicts:[],mode:'flat'}}});
 add('flatLow','Flat lower risk','Risk 80% of your R1 consistently on every trade',
  p=>{for(const c of Object.values(p.riskProfiles)){c.r1=round(c.r1*.8);c.r2=c.r1;c.r3=c.r1;c.policy={map:{},conflicts:[],mode:'flat'}}});
 add('flatHigh','Flat higher risk','Risk 110% of your R1 consistently; may be blocked by limits',
  p=>{for(const c of Object.values(p.riskProfiles)){c.r1=round(c.r1*1.1);c.r2=c.r1;c.r3=c.r1;c.policy={map:{},conflicts:[],mode:'flat'}}});
 add('afterwin','Win ladder','Higher R2 after a win; low R3 after a loss, without future knowledge',
  p=>{for(const c of Object.values(p.riskProfiles)){
   const r=c.r1;c.r1=round(r*.85);c.r2=round(r*1.15);c.r3=round(r*.5);c.policy={map:{},conflicts:[],mode:'after-win'};
  }});
 add('afterwinlight','Conservative win ladder','Small increase after wins and lower risk after losses',
  p=>{for(const c of Object.values(p.riskProfiles)){
   const r=c.r1;c.r1=round(r*.8);c.r2=round(r*.95);c.r3=round(r*.45);c.policy={map:{},conflicts:[],mode:'after-win'};
  }});
 add('afterloss','Loss protection','After any loss, immediately use R3 = 40% of original R1',
  p=>{for(const c of Object.values(p.riskProfiles)){
   c.r3=round(c.r1*.4);c.policy={map:{},conflicts:[],mode:'protect-after-loss'};
  }});
 for(const [key,title,changes] of [
  ['evalConservative','Evaluation risk down',{p1:.7,p2:.7,funded:1}],
  ['evalAggressive','Evaluation risk up',{p1:1.2,p2:1.1,funded:1}],
  ['fundedConservative','Protect funded account',{p1:1,p2:1,funded:.65}],
  ['fundedAggressive','Increase funded risk',{p1:1,p2:1,funded:1.2}],
  ['phase2Cautious','Conservative verification',{p1:1,p2:.65,funded:1}],
  ['phase1Focused','Larger Phase 1 · smaller later',{p1:1.15,p2:.85,funded:.85}]
 ]){
  add(key,title,'Change risk intensity by stage while keeping the existing option policy',
   p=>{for(const [stage,c] of Object.entries(p.riskProfiles)){
    const factor=changes[stage]||1;
    for(const level of ['r1','r2','r3'])c[level]=round(c[level]*factor);
   }});
 }
 for(const cap of [1,2,3]){
  add('cap'+cap,'Max '+cap+' win'+(cap===1?'':'s')+' / day',
   'Change the same-day win continuation limit, not the number of losing trades',
   p=>{for(const c of Object.values(p.riskProfiles))c.maxWinsPerDay=cap});
 }
 add('twoWinConservative','2 wins/day + lighter recovery','Limit each stage to two daily wins, reduce R2/R3',
  p=>{for(const c of Object.values(p.riskProfiles)){
   c.r2=round(c.r1*.75);c.r3=round(c.r1*.5);c.maxWinsPerDay=2;
   c.policy={map:{},conflicts:[],mode:'streak'};
  }});
 add('oneWinAggressive','1 win/day + initial risk up','Stop after one win per day; higher first-trade risk',
  p=>{for(const c of Object.values(p.riskProfiles)){
   c.r1=round(c.r1*1.2);c.maxWinsPerDay=1;
  }});
 add('threeWinConservative','3 wins/day + smaller risks','Allow up to three wins in a day; lower risk on every trade',
  p=>{for(const c of Object.values(p.riskProfiles)){
   c.r1=round(c.r1*.8);c.r2=round(c.r2*.8);c.r3=round(c.r3*.8);c.maxWinsPerDay=3;
  }});
 const ceiling=riskCeiling(base);
 const max=ceiling.maxRisk;
 // Search risk from fractions of the usable DAILY or OVERALL allowance, not only
 // percentages of the original R1/R2/R3. Includes the full executable ceiling.
 if(Number.isFinite(max)&&max>=.01){
  const capRisk=(fraction)=>Math.max(.01,floorCent(max*fraction));
  const setAll=(p,fn)=>{for(const [stage,c] of Object.entries(p.riskProfiles))fn(c,stage);};
  for(const fraction of [.5,.65,.75,.85,.9,.95,1]){
   const pct=Math.round(fraction*100);
   add('limitInitial'+pct,
    pct===100?'MAX initial risk · 100%':'Initial risk · '+pct+'% of limit',
    'Initial risk at '+pct+'% of usable loss allowance; recovery tiers are smaller',
    p=>setAll(p,c=>{c.r1=capRisk(fraction);c.r2=round(c.r1*.65);c.r3=round(c.r1*.35);c.policy={map:{},conflicts:[],mode:'streak'}}));
  }
  for(const fraction of [.7,.85,1]){
   const pct=Math.round(fraction*100);
   add('limitFlat'+pct,
    pct===100?'MAX flat risk · 100%':'Flat risk · '+pct+'% of limit',
    'Use the same executable risk every trade, including after losses',
    p=>setAll(p,c=>{c.r1=capRisk(fraction);c.r2=c.r1;c.r3=c.r1;c.policy={map:{},conflicts:[],mode:'flat'}}));
   add('limitRecovery'+pct,
    pct===100?'MAX recovery risk · 100%':'Recovery risk · '+pct+'% of limit',
    'Start smaller and test more risk after one loss; a second loss reduces R3',
    p=>setAll(p,c=>{c.r1=capRisk(.55);c.r2=capRisk(fraction);c.r3=capRisk(.3);c.policy={map:{},conflicts:[],mode:'streak'}}));
  }
  for(const fraction of [.85,1]){
   const pct=Math.round(fraction*100);
   add('limitWin'+pct,pct===100?'MAX after WIN · 100%':'After-win risk · '+pct+'% of limit',
    'Only after an observed win use larger R2; after a loss reduce to R3',
    p=>setAll(p,c=>{c.r1=capRisk(.55);c.r2=capRisk(fraction);c.r3=capRisk(.3);c.policy={map:{},conflicts:[],mode:'after-win'}}));
  }
  add('limitPhase1','MAX Phase 1 only','Use the executable risk limit only during Phase 1; other stages unchanged',
   p=>{if(p.riskProfiles.p1)p.riskProfiles.p1.r1=max});
  add('limitPhase2','MAX Phase 2 only','Use the executable risk limit only during Phase 2; other stages unchanged',
   p=>{if(p.riskProfiles.p2)p.riskProfiles.p2.r1=max});
  add('limitFunded','MAX funded only','Use the executable risk limit only on the first trade in Funded',
   p=>{if(p.riskProfiles.funded)p.riskProfiles.funded.r1=max});
  add('limitAllFirst','MAX R1 across phases','Use the executable risk ceiling as R1 in all stages; keep R2 and R3',
   p=>setAll(p,c=>{c.r1=max}));
  add('oneWinTarget','Risk for one winning trade',
   'Choose initial risk just large enough to hit each phase target in one win, where executable',
   p=>setAll(p,c=>{c.r1=Math.min(max,Math.ceil(((c.target+ceiling.tradeCost)/c.rr)*100)/100)}));
 }
 const permitted=Number.isFinite(max)?max:Infinity;
 const seen=new Set(),out=[];
 for(const candidate of list){
  const plan=copy(base);candidate.modify(plan);
  const signature=JSON.stringify(Object.values(plan.riskProfiles).map(c=>[c.r1,c.r2,c.r3,c.rr,c.maxWinsPerDay,c.policy?.mode||'saved',c.policy?.map||{}]));
  if(seen.has(signature))continue;
  seen.add(signature);
  if(candidate.key!=='baseline'&&Object.values(plan.riskProfiles).some(c=>['r1','r2','r3'].some(slot=>
   !Number.isFinite(c[slot])||c[slot]<=0||c[slot]>permitted+1e-9)))continue;
  out.push({...candidate,plan});
 }
 return out;
}
function score(r,objective){
 const n=Math.max(1,r.count);
 switch(objective){
  case 'payout':return r.chancePayout+0.00001*r.avg.net/(r.budget||1);
  case 'downside':return r.p10+0.05*r.avg.net;
  case 'goal':return (r.chanceGoal||0)+0.00001*r.avg.net/(r.budget||1);
  case 'balanced':return .6*r.avg.net/Math.max(1,r.budget)+.65*r.chancePayout+
   .5*r.p10/Math.max(1,r.budget)-.25*r.avg.exhausted/n;
  default:return r.avg.net;
 }
}
function candidateDelta(current,baseline){
 return {
  net:current.avg.net-baseline.avg.net,
  payout:(current.chancePayout-baseline.chancePayout)*100,
  p10:current.p10-baseline.p10,
  exhausted:current.avg.exhausted-baseline.avg.exhausted
 };
}
function search(base,options={}){
 const candidates=propose(base);
 const trainN=clamp(Math.floor(options.trainTrials||80),50,300);
 const testN=clamp(Math.floor(options.testTrials||180),50,400);
 const shortlist=clamp(Math.floor(options.shortlist||6),2,10);
 const objective=['balanced','net','payout','downside','goal'].includes(options.objective)?options.objective:'balanced';
 const common={
  days:options.days,tradesPerDay:options.tradesPerDay,
  winRate:options.winRate,signalMode:options.signalMode,
  budget:options.budget,netGoal:options.netGoal,
  purchaseMode:options.purchaseMode==='recycle'?'recycle':'upfront',
  maxActive:options.maxActive,maxBuysPerDay:options.maxBuysPerDay,
  capacityMode:options.capacityMode==='manual'?'manual':'automatic',
  tradeSchedule:options.tradeSchedule||null,
  reinvestPayouts:options.reinvestPayouts===true,
  pairedSignals:true,maxAccounts:100,trackCharts:options.trackCharts===true
 };
 const seed=(Math.floor(Number(options.seed)||24717)>>>0)||24717;
 const trainInput={...common,trials:trainN,seed};
 const testInput={...common,trials:testN,seed:(seed+0x3A5F93)>>>0};
 const trained=candidates.map(c=>({...c,train:E.simulatePortfolio(c.plan,trainInput)}));
 const original=trained.find(c=>c.key==='baseline');
 if(!original)throw Error('No baseline in risk search');
 // Hide variants that produce identical simulated outcomes on the training
 // sample. For example, allowing 3 wins cannot change a 2-opportunity day.
 const fingerprints=new Set(),distinct=[original];
 const fingerprint=r=>JSON.stringify([r.nets,r.avg.paid,r.avg.exhausted,r.stages]);
 fingerprints.add(fingerprint(original.train));
 for(const c of trained){
  if(c.key==='baseline')continue;
  const key=fingerprint(c.train);
  if(fingerprints.has(key))continue;
  fingerprints.add(key);
  distinct.push(c);
 }
 distinct.sort((a,b)=>score(b.train,objective)-score(a.train,objective));
 const top=distinct.filter(c=>c.key!=='baseline').slice(0,shortlist);
 // Always present selected 100%-of-usable-limit examples even if their
 // discovery score is poor. These are stress tests, not recommendations.
 const boundaryKeys=['limitInitial100','limitFlat100','limitRecovery100','limitWin100','limitAllFirst','oneWinTarget'];
 // Boundary tests are always visible, even when the training result happens
 // to equal another model. Do not deduplicate away a requested maximum-risk test.
 const boundary=boundaryKeys.map(k=>trained.find(c=>c.key===k)).filter(Boolean);
 const others=top.filter(c=>!boundary.some(b=>b.key===c.key));
 const selected=[original,...boundary,...others];
 const validation=selected.map((c,i)=>{
  const holdout=E.simulatePortfolio(c.plan,testInput);
  return {...c,holdout};
 });
 const baseline=validation[0];
 const ideas=validation.slice(1).map(c=>({
  ...c,
  delta:candidateDelta(c.holdout,baseline.holdout),
  improvement:score(c.holdout,objective)-score(baseline.holdout,objective)
 }));
 const robust=ideas.filter(c=>c.improvement>0);
 return {baseline,ideas,robust,
  ceiling:riskCeiling(base),
  boundaryCount:boundary.length,
  evaluated:candidates.length,selected:validation.length,
  objective,trainTrials:trainN,testTrials:testN,
  trainSeed:trainInput.seed,testSeed:testInput.seed,
  warning:robust.length?'Holdout outperformance is conditional on fixed assumptions; it does not establish a trading edge.':
   'No tested plan outperformed baseline on the chosen holdout objective. Retain baseline unless other tradeoffs matter.'};
}
// Purpose-built fixed-budget comparison: does reducing R1/R2/R3 preserve more accounts?
// Same market opportunity sequence and assumptions in every scenario. Original is immutable.
function compareLowerRisk(base,options={}){
 const trials=clamp(Math.floor(options.testTrials||150),50,400);
 const seed=((Math.floor(Number(options.seed)||24717)>>>0)||24717);
 const common={
  days:options.days,tradesPerDay:options.tradesPerDay,winRate:options.winRate,
  signalMode:options.signalMode,purchaseMode:options.purchaseMode==='recycle'?'recycle':'upfront',
  capacityMode:options.capacityMode==='manual'?'manual':'automatic',
  maxActive:options.maxActive,maxBuysPerDay:options.maxBuysPerDay,
  tradeSchedule:options.tradeSchedule||null,reinvestPayouts:options.reinvestPayouts===true,
  budget:options.budget,netGoal:options.netGoal,
  pairedSignals:true,seed,trials,maxAccounts:100,trackCharts:true
 };
 const variants=[
  {key:'baseline',title:'Original risk · 100%',reason:'Unchanged baseline',all:1},
  {key:'all85',title:'All phases · 85% risk',reason:'Reduce R1/R2/R3 or adaptive cap in every phase',all:.85},
  {key:'all70',title:'All phases · 70% risk',reason:'Reduce every phase risk by 30%',all:.70},
  {key:'all55',title:'All phases · 55% risk',reason:'Reduce every phase risk by 45%',all:.55},
  {key:'all40',title:'All phases · 40% risk',reason:'Reduce every phase risk by 60%',all:.40},
  {key:'funded70',title:'Funded only · 70% risk',reason:'Leave evaluation untouched; reduce funded risk by 30%',stage:'funded',factor:.70},
  {key:'funded50',title:'Funded only · 50% risk',reason:'Leave evaluation untouched; halve funded risk',stage:'funded',factor:.50},
  {key:'evaluation70',title:'Evaluation only · 70% risk',reason:'Reduce Challenge and Verification risk by 30%; funded unchanged',stage:'evaluation',factor:.70}
 ];
 const results=variants.map(v=>{
  const plan=copy(base);
  for(const [stage,p] of Object.entries(plan.riskProfiles)){
   const factor=v.all??(v.stage==='evaluation'?stage!=='funded'?v.factor:1:stage===v.stage?v.factor:1);
   if(factor===1)continue;
   for(const slot of ['r1','r2','r3'])p[slot]=round(p[slot]*factor);
   if(Number.isFinite(Number(p.dynamicMaxRisk)))p.dynamicMaxRisk=round(p.dynamicMaxRisk*factor);
  }
  const holdout=E.simulatePortfolio(plan,common);
  return {...v,plan,holdout};
 });
 const baseline=results[0];
 const ideas=results.slice(1).map(v=>({
  ...v,delta:candidateDelta(v.holdout,baseline.holdout),
  improvement:score(v.holdout,'balanced')-score(baseline.holdout,'balanced')
 }));
 return {baseline,ideas,robust:ideas.filter(v=>v.improvement>0),
  ceiling:riskCeiling(base),evaluated:variants.length,selected:variants.length,
  objective:'balanced',trainTrials:0,testTrials:trials,trainSeed:seed,testSeed:seed,
  warning:'Paired-trial scenario sensitivity only. Lower risk can reduce blocks but also delay phase passes and payouts. This is not an independent holdout test or proof of future performance.'};
}
// Dedicated target-exact search. Each adaptive trade sizes against the REMAINING
// stage target after costs rather than a fixed wager that may overshoot it.
// Never mutate the saved base policy; paired trials preserve model assumptions.
function searchTargetExact(base,options={}){
 const max=riskCeiling(base).maxRisk;
 if(!Number.isFinite(max)||max<.01)throw Error('Verified daily and overall loss limits are required for target-exact search.');
 const trials=clamp(Math.floor(options.testTrials||150),50,400);
 const seed=((Math.floor(Number(options.seed)||24717)>>>0)||24717);
 const common={
  days:options.days,tradesPerDay:options.tradesPerDay,winRate:options.winRate,
  signalMode:options.signalMode,purchaseMode:options.purchaseMode==='recycle'?'recycle':'upfront',
  capacityMode:options.capacityMode==='manual'?'manual':'automatic',
  maxActive:options.maxActive,maxBuysPerDay:options.maxBuysPerDay,
  evaluationAllocationCap:options.evaluationAllocationCap||0,
  fundedAllocationCap:options.fundedAllocationCap||0,
  tradeSchedule:options.tradeSchedule||null,reinvestPayouts:options.reinvestPayouts===true,
  budget:options.budget,netGoal:options.netGoal,requiredPayouts:options.requiredPayouts||0,
  pairedSignals:true,seed,trials,maxAccounts:100,trackCharts:true
 };
 const variants=[{key:'baseline',title:'Selected investment option · unchanged',reason:'Reference: original saved risk policy'}];
 for(const factor of [1,.9,.75,.6,.45]){
  variants.push({key:'targetNow'+Math.round(factor*100),
   title:'Target exact · '+Math.round(factor*100)+'% risk cap',
   reason:'Size each trade to the remaining phase/payout target at its tier RR; hard cap '+Math.round(factor*100)+'% of the firm allowance',
   factor});
 }
 const results=variants.map(v=>{
  const plan=copy(base);
  if(v.factor){
   for(const [stage,c] of Object.entries(plan.riskProfiles)){
    const riskCap=Math.max(.01,floorCent(max*v.factor));
    c.dynamicMaxRisk=riskCap;
    c.r1=riskCap;c.r2=riskCap;c.r3=riskCap;
    // Keep the protected Topstep evaluation rule in place; other phases
    // use the live engine's state-aware target-now formula.
    if(!(plan.id==='topstep'&&stage==='p1'))
     c.policy={map:{},conflicts:[],mode:'target-now'};
   }
  }
  return {...v,plan,holdout:E.simulatePortfolio(plan,common)};
 });
 const baseline=results[0];
 const ideas=results.slice(1).map(v=>({
  ...v,delta:candidateDelta(v.holdout,baseline.holdout),
  improvement:score(v.holdout,'goal')-score(baseline.holdout,'goal')
 }));
 return {baseline,ideas,robust:ideas.filter(v=>v.improvement>0),
  ceiling:riskCeiling(base),evaluated:variants.length,selected:variants.length,
  objective:'goal',trainTrials:0,testTrials:trials,trainSeed:seed,testSeed:seed,
  warning:'Paired sensitivity comparison, not independently validated performance. Exact-to-target is conditional on a winning trade and modeled fill/costs; loss-limit safety may cap the trade below the one-win target. Topstep evaluation keeps its existing Combine rule.'};
}
root.StudioModelDiscovery={search,propose,score,compareLowerRisk,searchTargetExact,clonePlan:copy,riskCeiling};
})(typeof window!=='undefined'?window:globalThis);