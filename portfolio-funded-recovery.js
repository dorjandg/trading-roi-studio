/* Opt-in CFD funded compounding after a +$450 milestone:
   +450 then risk 450 at 3R to reach +1800;
   optional +1800 then risk 1800 at 3R to reach +7200,
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
  {key:'profit-7200',title:'Funded profit ladder · target +$7,200',reason:'Optional third profit-compounding win; $1,800 risk needs permission under firm daily/overall limits',mode:'funded-profit-ladder',target:7200},
  {key:'recovery-7200',title:'Funded recovery then compound · target +$7,200',reason:'Same staged loss recovery then optional third compounding win, capped by firm risk limits',mode:'funded-staged-recovery',target:7200}
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
   c.fundedStarterRisk=150;c.fundedRecoveryLevels=[150,200,250,200];
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
  warning:'+$450 is a milestone, not an automatic payout. +$1,800 requires two wins ($150 and $450 risk). +$7,200 nominally needs a third $1,800-risk win, often exceeding daily loss limits; the engine caps risk, so it may take more trades or be unreachable. Model targets differ across variants. Payout splits, waits and simulated cost rules still apply; no saved strategy was changed.'};
}
D.compareFundedRecovery450=compare;
})(typeof window!=='undefined'?window:globalThis);
