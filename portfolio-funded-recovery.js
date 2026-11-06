/* Funded milestone $450, test a 3R loss ladder with exact requested risk tiers.
   Never changes persisted user settings. */
(function(root){
'use strict';
const E=root.StudioPortfolioEngine,D=root.StudioModelDiscovery;
if(!E||!D)return;
function compare(base,options={}){
 if(!base.stageList.includes('p2')||base.id==='topstep')
  throw Error('The funded $450 recovery scenario is for two-phase CFD programs.');
 const trials=Math.max(50,Math.min(400,Number(options.testTrials)||150));
 const input={...options,trials,pairedSignals:true,trackCharts:true,maxAccounts:100};
 const variants=[
  {key:'funded-profit-450',title:'Funded $450 · Profit Ladder',reason:'Same $450 target and evaluation recovery; funded starter $150 then risk accumulated profits',mode:'funded-profit-ladder'},
  {key:'funded-recovery-450',title:'Funded $450 · 150 / 200 / 250 / 200',reason:'Risk $150, then $200, then $250, then $200 after consecutive losses; after a win size the remaining gap to +$450',mode:'funded-staged-recovery'}
 ];
 const results=variants.map(v=>{
  const plan=D.clonePlan(base);
  for(const stage of ['p1','p2']){
   const c=plan.riskProfiles[stage];
   c.policy={mode:'eval-recovery-burn',map:{},conflicts:[]};
   c.rr=3;c.rrByTier={r1:3,r2:3,r3:3};
  }
  const c=plan.riskProfiles.funded;
  c.target=450;
  c.policy={mode:v.mode,map:{},conflicts:[]};
  c.rr=3;c.rrByTier={r1:3,r2:3,r3:3};
  c.r1=150;c.r2=200;c.r3=250;
  c.fundedStarterRisk=150;
  c.fundedRecoveryLevels=[150,200,250,200];
  return {...v,plan,holdout:E.simulatePortfolio(plan,input)};
 });
 const baseline=results[0],v=results[1];
 const ideas=[{...v,
  delta:{net:v.holdout.avg.net-baseline.holdout.avg.net,
   payout:(v.holdout.chancePayout-baseline.holdout.chancePayout)*100,
   exhausted:v.holdout.avg.exhausted-baseline.holdout.avg.exhausted},
  improvement:v.holdout.avg.net-baseline.holdout.avg.net}];
 return {baseline,ideas,robust:ideas.filter(x=>x.improvement>0),
  objective:'goal',evaluated:2,selected:2,trainTrials:0,testTrials:trials,
  warning:'Both variants use the same modeled +$450 funded profit milestone and existing payout split/wait; this is not proof of actual withdrawal eligibility. After LLW, 150+200+250*3 leaves +$400, not +$450. After LLL, the $200 next trade wins back to $0. A loss may breach limits; no live strategy defaults are changed.'};
}
D.compareFundedRecovery450=compare;
})(typeof window!=='undefined'?window:globalThis);
