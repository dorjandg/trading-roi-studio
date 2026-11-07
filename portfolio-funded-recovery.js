/* Opt-in CFD funded compounding after a +$450 milestone:
   +450 then risk 450 at 3R to reach +1800;
   optional third win risks $450 at 3R to reach +3150,
   always capped by actual modeled daily and overall loss limits. */
(function(root){
'use strict';
const E=root.StudioPortfolioEngine,D=root.StudioModelDiscovery;
if(!E||!D)return;
function compare(base,options={}){
 if(!base.stageList.includes('p2')||base.id==='topstep')
  throw Error('The funded compounding scenario is for two-phase CFD programs.');
 const trials=Math.max(50,Math.min(400,Number(options.testTrials)||150));
 const input={...options,trials,pairedSignals:true,trackCharts:true,maxAccounts:100};
 const variants=[
  {key:'original',title:'Original investment strategy · unchanged',reason:'Reference plan with its original funded target'},
  {key:'profit-1800',title:'Funded profit ladder · target +$1,800',reason:'Start $150 at 3R; if win risk accumulated +$450 for a second 3R win',mode:'funded-profit-ladder',target:1800},
  {key:'recovery-1800',title:'Funded recovery then compound · target +$1,800',reason:'Risk $150/$200/$250/$200 after losses; if winning with positive P&L, risk accumulated profit',mode:'funded-staged-recovery',target:1800},
  {key:'profit-3150',title:'Funded profit ladder · target +$3,150',reason:'Three wins: $150 × 3 + $450 × 3 + $450 × 3 = +$3,150, with max $450 risk per trade',mode:'funded-profit-ladder',target:3150},
  {key:'recovery-3150',title:'Funded recovery then compound · target +$3,150',reason:'Staged recovery, then 3R wins risking at most $450 per funded trade',mode:'funded-staged-recovery',target:3150}
 ];
 const results=variants.map(v=>{
  const plan=D.clonePlan(base);
  if(v.mode){
   for(const stage of ['p1','p2']){
    const c=plan.riskProfiles[stage];
    c.policy={mode:'eval-recovery-burn',map:{},conflicts:[]};
    c.rr=3;c.rrByTier={r1:3,r2:3,r3:3};
   }
   const c=plan.riskProfiles.funded;
   c.target=v.target;
   c.policy={mode:v.mode,map:{},conflicts:[]};
   c.rr=3;c.rrByTier={r1:3,r2:3,r3:3};
   c.r1=150;c.r2=200;c.r3=250;
   c.fundedStarterRisk=150;c.fundedRecoveryLevels=[150,200,250,200];c.fundedMaxTradeRisk=450;
  }
  return {...v,plan,holdout:E.simulatePortfolio(plan,input)};
 });
 const baseline=results[0],ideas=results.slice(1).map(v=>({
  ...v,delta:{
   net:v.holdout.avg.net-baseline.holdout.avg.net,
   payout:(v.holdout.chancePayout-baseline.holdout.chancePayout)*100,
   exhausted:v.holdout.avg.exhausted-baseline.holdout.avg.exhausted
  },
  improvement:v.holdout.avg.net-baseline.holdout.avg.net
 }));
 return {baseline,ideas,robust:ideas.filter(x=>x.improvement>0),
  objective:'goal',evaluated:results.length,selected:results.length,
  trainTrials:0,testTrials:trials,
  warning:'+$450 is the first milestone, not a payout. At 3R, $150 risk wins +$450; $450 risk wins +$1,350, reaching +$1,800; optional third $450-risk win adds +$1,350, reaching +$3,150. Maximum funded risk is $450 per trade for both policies, also subject to firm limits and costs. Model targets differ and original settings remain unchanged.'};
}
D.compareFundedRecovery450=compare;
})(typeof window!=='undefined'?window:globalThis);
