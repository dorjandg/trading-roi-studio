/* Named scenario: evaluation recover-or-burn, funded profit-only ladder.
   An optional what-if; never writes stored firms risk settings. */
(function(root){
'use strict';
const D=root.StudioModelDiscovery,E=root.StudioPortfolioEngine;
if(!D||!E)return;
function search(base,options={}){
 if(!base.stageList.includes('p2')||base.id==='topstep')
  throw Error('This scenario needs two CFD evaluation phases (not Topstep Combine).');
 const trials=Math.min(400,Math.max(50,Number(options.testTrials)||150));
 const common={...options,trials,pairedSignals:true,trackCharts:true,maxAccounts:100};
 const reference=Number(options.fundedStarterRisk)||150;
 const amounts=[0,.5,.75,1,1.25,1.5].map(n=>n?Math.round(reference*n*100)/100:0);
 const results=[];
 for(const amount of amounts){
  const plan=D.clonePlan(base);
  if(amount){
   for(const stage of ['p1','p2']){
    const c=plan.riskProfiles[stage];
    c.policy={mode:'eval-recovery-burn',map:{},conflicts:[]};
    c.rr=3;c.rrByTier={r1:3,r2:3,r3:3};
   }
   const funded=plan.riskProfiles.funded;
   funded.policy={mode:'funded-profit-ladder',map:{},conflicts:[]};
   funded.fundedStarterRisk=amount;
   funded.r1=amount;funded.r2=amount;funded.r3=amount;
   funded.rr=3;funded.rrByTier={r1:3,r2:3,r3:3};
  }
  const holdout=E.simulatePortfolio(plan,common);
  results.push({key:amount?'ladder-'+amount:'baseline',
   title:amount?'Eval Recovery + Funded Ladder · $'+amount:'Original option · unchanged',
   reason:amount?'Challenge and Verification: target recovery then remaining headroom; funded: starter $'+amount+', profit-only risk and loss recovery.':'No parameters changed.',
   plan,holdout});
 }
 const baseline=results[0];
 const ideas=results.slice(1).map(v=>({...v,
  delta:{net:v.holdout.avg.net-baseline.holdout.avg.net,
   payout:(v.holdout.chancePayout-baseline.holdout.chancePayout)*100,
   exhausted:v.holdout.avg.exhausted-baseline.holdout.avg.exhausted},
  improvement:v.holdout.avg.net-baseline.holdout.avg.net}));
 return {baseline,ideas,robust:ideas.filter(x=>x.improvement>0),
  objective:'goal',evaluated:results.length,selected:results.length,
  trainTrials:0,testTrials:trials,
  warning:'Evaluation trade 3 may breach the loss limit. Funded profits can be given back to breakeven. Projections use modeled execution, not actual market fills.'};
}
D.compareRecoveryLadder=search;
})(typeof window!=='undefined'?window:globalThis);
