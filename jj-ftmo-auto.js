/* Read-only bridge for the JJ × FTMO KPI page.
   Uses the SAME local saved Firms profile + phase snapshots + full Portfolio Engine as Portfolio Simulator.
   Does not write settings, account data, order instructions, or new cloud history. */
(function(root){
'use strict';
const has=(v,k)=>Object.prototype.hasOwnProperty.call(v||{},k);
const num=v=>Number.isFinite(Number(v))?Number(v):NaN;
const ratio=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b>0?a/b:NaN;
function readJSON(storage,key,fallback=null){
 try{const x=JSON.parse(storage.getItem(key)||'null');return x??fallback}catch(_){return fallback}
}
function savedPlan(storage,user,program,audit,engine){
 if(!/^[a-zA-Z0-9_-]+$/.test(String(user||'')))throw Error('Invalid 4Ds user selection.');
 if(!engine?.buildPlan||!engine?.validatePlan)throw Error('Portfolio Simulator engine unavailable.');
 if(!program)throw Error('FTMO 10K rules were not loaded.');
 const prefix='4ds:v1:'+user+':', account='ftmo2:10000';
 let profile=readJSON(storage,prefix+'studio-account-profile-v1:'+account);
 if(!(profile?.v===1&&profile.state)){
   const active=storage.getItem(prefix+'studio-active-profile-v1');
   if(active===account){
     const state=readJSON(storage,prefix+'ftmo-roi-studio-v1');
     if(state)profile={v:1,state};
   }
 }
 if(!(profile?.state))throw Error('No saved FTMO 10K Firms profile found in this browser. Open Firms, save your FTMO settings and try again.');
 const snaps={};
 for(const stage of ['p1','p2','funded']){
  const local=readJSON(storage,'4ds:recovery-planner:v2:'+user+':ftmo2:10000:'+stage,null);
  const mirrored=readJSON(storage,prefix+'studio-stage-risk-v1:ftmo2:10000:'+stage,null);
  const hasPlan=s=>s&&typeof s==='object'&&!Array.isArray(s)&&
   (s.policyMode||s.ftmoBuffer||s.appliedSmartSetup||s.levels&&Object.keys(s.levels).length||
    s.optionSequences&&Object.keys(s.optionSequences).length);
  snaps[stage]=hasPlan(local)?local:mirrored?.v===1&&hasPlan(mirrored.risk)?mirrored.risk:local||{};
 }
 const plan=engine.buildPlan('ftmo2',10000,program,profile,snaps,audit);
 if(plan.provisional)throw Error('FTMO saved profile could not be verified.');
 const check=engine.validatePlan(plan);
 if(check.errors?.length)throw Error('Saved FTMO policy invalid: '+check.errors.join(' · '));
 return {plan,warnings:check.warnings||[]};
}
function toKpis(result){
 if(result?.plan?.id!=='ftmo2'||Number(result.plan.size)!==10000)throw Error('Only FTMO 10K results can be used here.');
 const a=result.avg||{},b=num(a.bought),f=num(a.funded),paid=num(a.paid),t=num(a.targetHit),spent=num(a.spent),cash=num(a.receipts),net=num(a.net);
 if(!(b>0)&&!(spent>=0))throw Error('The Monte Carlo result does not contain a funded evaluation cohort.');
 const p1=num(result.stages?.[0]),p2=num(result.stages?.[1]);
 const days=num(result.config?.days);
 return {
  source:'auto',fee:result.plan.fee,pass:ratio(f,b),phase1:ratio(p1,b),phase2:ratio(p2,p1),
  hit:ratio(t,f),realize:ratio(paid,t),fundedPaid:ratio(paid,f),payout:ratio(paid,b),
  fundedCount:f,paidCount:paid,cohortBought:b,cost:spent,
  costFunded:ratio(spent,f),costPaid:ratio(spent,paid),
  cash:cash,net:net,roi:ratio(net,spent),multiple:ratio(cash,spent),
  payoutPerFunded:ratio(cash,f),netPerEval:ratio(net,b),
  netPerWeek:days>0?net/(days/5):NaN,
  tradeWinRate:num(result.config?.winRate),tradeEV:result.tradeKpis?.ar,
  timeFromPurchase:result.timeFromPurchase||{},
  chanceAnyPayout:result.chancePayout,
  tradeCount:result.avg?.trades??null,
  days:days,trialCount:num(result.config?.trials),
  stageRiskProfiles:result.plan.riskProfiles,
  countCap:result.clipped,actualBought:b,
  accountFees:result.plan.fee,
  warnings:[]
 };
}
function simulate(engine,weekly,{plan,count,days,winRate,trials,signalsMode='weekly20',signalsPerDay=4,seed=24717}){
 const n=Math.floor(num(count)),d=Math.floor(num(days)),w=num(winRate),t=Math.floor(num(trials));
 if(!(n>=1&&n<=100))throw Error('Use 1–100 evaluations in Section 5 for Auto FTMO.');
 if(!(d>=5&&d<=120))throw Error('Choose 5–120 trading days.');
 if(!(w>=0&&w<=100))throw Error('Win rate must be between 0% and 100%.');
 if(!(t>=50&&t<=1000))throw Error('Choose 50–1000 simulation trials.');
 if(!(plan?.fee>0))throw Error('FTMO challenge fee must be positive.');
 const cfg={
  budget:n*plan.fee,maxAccounts:n,days:d,trials:t,
  tradesPerDay:Math.max(1,Math.min(20,Math.floor(signalsPerDay))),
  tradeSchedule:weekly?.schedule?weekly.schedule(d,signalsMode==='weekly20'?'weekly20':'daily',signalsPerDay):undefined,
  purchaseMode:'upfront',signalMode:'shared',winRate:w,
  capacityMode:'automatic',maxActive:n,maxBuysPerDay:Math.max(1,Math.min(20,Math.floor(signalsPerDay))),
  seed,trackCharts:false,reinvestPayouts:false
 };
 const result=engine.simulatePortfolio(plan,cfg);
 return {result,model:toKpis(result)};
}
root.StudioJjFtmoAuto={readJSON,savedPlan,toKpis,simulate};
})(typeof window!=='undefined'?window:globalThis);
