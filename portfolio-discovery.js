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
function propose(base){
 const list=[{key:'baseline',title:'Your current settings',reason:'No parameters changed',modify:()=>{}}];
 function add(key,title,reason,modify){list.push({key,title,reason,modify});}
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
 const cap=Math.min(base.dailyLoss,base.overallLoss);
 const permitted=Number.isFinite(cap)?Math.max(0,cap*.95-Math.max(0,base.riskReserve)):Infinity;
 const seen=new Set(),out=[];
 for(const candidate of list){
  const plan=copy(base);candidate.modify(plan);
  const signature=JSON.stringify(Object.values(plan.riskProfiles).map(c=>[c.r1,c.r2,c.r3,c.rr,c.maxWinsPerDay,c.policy?.mode||'saved',c.policy?.map||{}]));
  if(seen.has(signature))continue;
  seen.add(signature);
  if(candidate.key!=='baseline'&&Object.values(plan.riskProfiles).some(c=>['r1','r2','r3'].some(slot=>
   !Number.isFinite(c[slot])||c[slot]<=0||c[slot]>permitted)))continue;
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
  pairedSignals:true,maxAccounts:100
 };
 const seed=(Math.floor(Number(options.seed)||24717)>>>0)||24717;
 const trainInput={...common,trials:trainN,seed};
 const testInput={...common,trials:testN,seed:(seed+0x3A5F93)>>>0};
 const trained=candidates.map(c=>({...c,train:E.simulatePortfolio(c.plan,trainInput)}));
 const original=trained.find(c=>c.key==='baseline');
 if(!original)throw Error('No baseline in risk search');
 trained.sort((a,b)=>score(b.train,objective)-score(a.train,objective));
 const top=trained.filter(c=>c.key!=='baseline').slice(0,shortlist);
 const selected=[original,...top];
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
  evaluated:candidates.length,selected:validation.length,
  objective,trainTrials:trainN,testTrials:testN,
  trainSeed:trainInput.seed,testSeed:testInput.seed,
  warning:robust.length?'Holdout outperformance is conditional on fixed assumptions; it does not establish a trading edge.':
   'No tested plan outperformed baseline on the chosen holdout objective. Retain baseline unless other tradeoffs matter.'};
}
root.StudioModelDiscovery={search,propose,score,clonePlan:copy};
})(typeof window!=='undefined'?window:globalThis);