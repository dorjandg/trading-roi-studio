/* 4Ds Trading Studio — options-driven first-payout portfolio model.
   Pure calculation library. No broker access. No order placement. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,Number.isFinite(Number(x))?Number(x):a));
const pos=x=>Math.max(0,Number(x)||0);
const finite=(x,d)=>Number.isFinite(Number(x))?Number(x):d;
const money=x=>Math.round((Number(x)||0)*100)/100;
const has=(obj,key)=>obj&&Object.prototype.hasOwnProperty.call(obj,key);
const dynamic=(record,key,def)=>has(record,key)&&Number.isFinite(Number(record[key]))?Number(record[key]):def;
const slotLevels=['r1','r2','r3'];
const phasesFor=id=>id==='instant'?['funded']:['ftmo2','holaPrime','holaPro'].includes(id)?['p1','p2','funded']:['p1','funded'];
const supported=new Set(['ftmo2','holaPrime','holaPro','topstep']);
function rngFactory(seed){
 let x=(Math.floor(finite(seed,24717))>>>0)||24717;
 return function(){x=(x+0x6D2B79F5)|0;let t=Math.imul(x^(x>>>15),1|x);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296};
}
function defaultRisk(id,size,key){
 const ratio=key==='p1'?.035:key==='p2'?.02:.02;
 const multiplier=id==='topstep'?.02:ratio;
 return Math.max(1,Math.round(size*multiplier));
}
function resolvePolicy(sequences){
 const buckets={};
 for(const [path,seq] of Object.entries(sequences||{})){
  if(!/^[WL]{1,8}$/.test(path)||!Array.isArray(seq))continue;
  for(let i=0;i<Math.min(path.length,seq.length);i++){
   const slot=seq[i];
   if(!slotLevels.includes(slot))continue;
   const prefix=path.slice(0,i);
   (buckets[prefix]||=new Set()).add(slot);
  }
 }
 const map={},conflicts=[];
 for(const [prefix,values] of Object.entries(buckets)){
  if(values.size===1)map[prefix]=[...values][0];
  else conflicts.push(prefix||'(initial trade)');
 }
 return {map,conflicts};
}
function plannedSlot(history,policy){
 const mode=policy?.mode||'saved';
 const choices=policy&&policy.map||{};
 if(mode==='saved'&&has(choices,history))return choices[history];
 if(mode==='flat')return 'r1';
 if(mode==='after-win')return history.endsWith('W')?'r2':history.endsWith('L')?'r3':'r1';
 if(mode==='protect-after-loss')return history.endsWith('L')?'r3':'r1';
 let streak=0;
 for(let i=history.length-1;i>=0&&history[i]==='L';i--)streak++;
 return streak===0?'r1':streak===1?'r2':'r3';
}
function buildPlan(programId,size,program,profile={},snapshots={},audit=null){
 size=pos(size);
 const state=profile&&profile.state||profile||{};
 const stages=phasesFor(programId);
 const maxLoss=dynamic(state,'overallLoss',
  dynamic(audit?.loss?.maximumUSDBySize,String(size),
   size*pos(program?.max)/100));
 const dailyFromRule=program?.daily==null?0:size*pos(program.daily)/100;
 const isTopstep=programId==='topstep';
 // Topstep's Daily Loss Limit is optional; the generic saved dailyLoss
 // field can contain a leftover CFD default and must not be silently used.
 const topstepDllBySize={50000:1000,100000:2000,150000:3000};
 const dailyLoss=isTopstep?(state.topstepDLL===true?topstepDllBySize[size]||0:0):
  dynamic(state,'dailyLoss',dailyFromRule);
 const noActivationPath=isTopstep&&state.topstepPath==='noactivation';
 const catalogFee=noActivationPath?pos(program?.noActivation?.[size]):pos(program?.pricesUSD?.[size]);
 const fee=dynamic(state,'price',catalogFee);
 const extraCost=pos(state.extraCost);
 const riskReserve=dynamic(state,'buffer',0);
 const totalFee=fee+extraCost;
 const split=clamp(dynamic(state,'split',isTopstep?50:pos(program?.split)||80),0,100)/100;
 const result={
  id:programId,size,firm:program.firm,programName:program.name,
  supported:supported.has(programId),fee:totalFee,monthlyFee:isTopstep,
  activationFee:isTopstep&&!noActivationPath?pos(dynamic(state,'topstepActivationFee',149)):0,
  fundedMaxActive:isTopstep?5:Infinity,
  dailyLoss:dailyLoss>0?dailyLoss:Infinity,
  overallLoss:maxLoss>0?maxLoss:Infinity,
  riskReserve,split,refund:clamp(dynamic(state,'refund',pos(program?.refund)||0),0,100)/100,
  tradeCost:pos(state.tradeCost),minRisk:pos(state.minRisk),
  fundedTarget:pos(dynamic(state,'profitTarget',isTopstep?dynamic(state,'topstepFirstPayoutBalance',4000):size*.08)),
  fundedWaitDays:clamp(Math.ceil(pos(dynamic(state,'daysBeforeRequest',isTopstep?5:14))*5/7),0,100),
  winRate:clamp(dynamic(state,'winRate',40),0,100)/100,
  riskProfiles:{},sourceSaved:!!profile?.state,provisional:!profile?.state,
  stageList:stages,drawdownKind:audit?.riskStructure?.drawdownKind||'unverified',
  auditStatus:audit?.status||'unverified',
  maxFundedPerCycle:isTopstep?5:Infinity
 };
 if(isTopstep){result.refund=0;result.split=.5;result.fundedWaitDays=0;
  result.fundedTarget=pos(dynamic(state,'topstepFirstPayoutBalance',4000));}
 // A stored profile's funded goal is a planning target, not an official firm payout guarantee.
 for(const key of stages){
  const snap=snapshots[key]||{},lev=snap.levels||{};
  const root=key==='funded'?'funded':key;
  const target=key==='p1'?dynamic(state,'p1Target',size*pos(program.targets?.[0])/100):
   key==='p2'?dynamic(state,'p2Target',size*pos(program.targets?.[1])/100):result.fundedTarget;
  const minDays=key==='p1'?dynamic(state,'p1MinDays',pos(program.days?.[0])):
   key==='p2'?dynamic(state,'p2MinDays',pos(program.days?.[1])):0;
  const base=defaultRisk(programId,size,key);
  const r1=dynamic(lev,'r1',dynamic(state,root+'Base',base));
  const r2=dynamic(lev,'r2',dynamic(state,root+'Recovery',Math.round(base*.72)));
  const r3=dynamic(lev,'r3',dynamic(state,root+'Recovery',Math.round(base*.52)));
  const rrBase=dynamic(state.rrByTier,root+'Base',dynamic(state,'rr',3));
  const rr=clamp(rrBase,.1,100);
  const policy=resolvePolicy(snap.optionSequences||{});
  result.riskProfiles[key]={
   target:pos(target),
   minDays:clamp(minDays,0,60),
   maxWinsPerDay:clamp(dynamic(snap,'winCap',2),1,6),
   maxDays:clamp(dynamic(state,root==='funded'?'fundedDays':root+'Days',30),1,365),
   rr,r1:pos(r1),r2:pos(r2),r3:pos(r3),policy,
   consistency:isTopstep&&key==='p1'?.55:0,
   name:key==='p1'?(isTopstep?'Evaluation':'Phase 1'):key==='p2'?'Phase 2':'Funded'
  };
 }
 return result;
}
function validatePlan(p){
 const errors=[],warnings=[];
 if(!p.supported)errors.push('This program is not yet supported by the options-driven engine.');
 if(!p.size||!p.fee)errors.push('Account size or USD checkout fee is missing.');
 if(!Number.isFinite(p.overallLoss))warnings.push('Overall drawdown limit is missing; no hard overall breach can be verified.');
 if(p.drawdownKind!=='static'&&p.id!=='topstep')warnings.push('Non-static or unknown trailing drawdown rules are not fully enforced.');
 if(p.id==='topstep')warnings.push('Topstep evaluation subscription renewals, contract caps and full payout eligibility are not verified; selected purchase-path fees are approximate.');
 if(p.provisional)warnings.push('No saved account profile found: R1/R2/R3 are illustrative defaults. Configure this account in Firms.');
 if(p.riskProfiles.funded?.target<=0)errors.push('Set a positive first-payout planning target.');
 for(const [stage,c] of Object.entries(p.riskProfiles)){
  if(c.target<=0)errors.push(stage+': profit target missing.');
  if(c.rr<=0||c.r1<=0||c.r2<=0||c.r3<=0)errors.push(stage+': set positive RR and all three risk amounts.');
  if(c.policy.conflicts.length)warnings.push(stage+': conflicting saved option risk choices at '+c.policy.conflicts.length+' history prefixes; default risk rules apply there.');
 }
 return {errors,warnings};
}
function makeAccount(i){return {
 id:i,stageIndex:0,stageDay:0,activeDays:0,adminDays:0,totalAdminDays:0,
 stagePnl:0,history:'',dailyProfit:0,dayProfits:[],peakEod:0,bestDay:0,
 status:'active',trades:0,wins:0,losses:0,firstPaid:0,
 passes:[],totalR:0,realizedDD:0,peakPnl:0,blocked:0,
 fundedDays:0,fundedPositiveDays:0,funded150Days:0,trace:[]
};}
function newStage(ac){ac.stageDay=0;ac.activeDays=0;ac.adminDays=0;ac.stagePnl=0;ac.history='';
 ac.dayProfits=[];ac.peakEod=0;ac.bestDay=0;ac.peakPnl=0;ac.realizedDD=0;}
function stageName(p,ac){return p.stageList[ac.stageIndex]||'paid'}
function isEvaluation(stage){return stage==='p1'||stage==='p2'}
function floorFor(p,ac){
 const cap=p.overallLoss;
 if(!Number.isFinite(cap))return -Infinity;
 if(p.drawdownKind==='static')return -cap;
 if(p.id==='topstep')return Math.min(0,ac.peakEod-cap);
 // Unknown trailing model: static proxy, but flagged in plan warnings.
 return -cap;
}
function nextStage(p,ac,day,record){
 const old=stageName(p,ac);
 ac.passes.push({stage:old,day,trades:ac.trades});
 if(record)ac.trace.push({day,stage:old,type:'stage-pass',label:old+' completed'});
 if(old==='p1'||old==='p2'){
  ac.stageIndex++;newStage(ac);
  if(record)ac.trace.push({day,stage:stageName(p,ac),type:'stage-start',label:stageName(p,ac)+' starts next trading day'});
 }
}
function firstPayout(p,ac){
 const profit=Math.max(0,ac.stagePnl);
 const payout=p.id==='topstep'?Math.min(profit*.5,5000):profit*p.split;
 return money(payout + (p.id==='topstep'?0:p.fee*p.refund));
}
function runAccountDay(p,ac,day,rand,config,record){
 if(ac.status!=='active')return {stagePass:false,paid:false,activation:false};
 const stage=stageName(p,ac),c=p.riskProfiles[stage];
 if(!c){ac.status='invalid';return {stagePass:false,paid:false,activation:false}}
 ac.stageDay++;
 const out={stagePass:false,paid:false,activation:false};
 if(stage==='funded')ac.fundedDays++;
 const alreadyTarget=ac.stagePnl>=c.target-.005;
 const consistentNow=!c.consistency||ac.bestDay<=Math.max(0,ac.stagePnl)*c.consistency+1e-7;
 if(isEvaluation(stage)&&alreadyTarget&&consistentNow && ac.activeDays<c.minDays){
  ac.adminDays++;ac.totalAdminDays++;
  // Administration-only day is NOT included in any W/L trade series.
  // Firm-specific tiny qualifying orders are outside this estimate.
  ac.activeDays++;
  if(record)ac.trace.push({day,stage,type:'admin',label:'Minimum-day qualification assumption — no W/L trade modeled'});
 }
 if(isEvaluation(stage)&&alreadyTarget&&consistentNow&&ac.activeDays>=c.minDays){
  nextStage(p,ac,day,record);out.stagePass=true;out.activation=stage==='p1'&&!p.stageList.includes('p2');
  if(stage==='p2')out.activation=true;
  return out;
 }
 const fundedReady=stage==='funded'&&ac.stagePnl>=c.target-.005 &&
  (p.id==='topstep'?ac.funded150Days>=5:ac.fundedDays>=p.fundedWaitDays);
 if(fundedReady){
  ac.firstPaid=firstPayout(p,ac);ac.status='paid';
  if(record)ac.trace.push({day,stage,type:'paid',label:'First modeled payout',cash:ac.firstPaid});
  out.paid=true;return out;
 }
 if(stage==='funded'&&ac.stagePnl>=c.target-.005&&p.id!=='topstep'){
  if(record)ac.trace.push({day,stage,type:'waiting',label:'Funded profit goal reached; payout waiting period remains'});
  return out;
 }
 let dayProfit=0,hadTrade=false,winsToday=0;
 const signals=clamp(config.tradesPerDay,1,6);
 for(let ix=0;ix<signals;ix++){
  if(ix>=c.maxWinsPerDay)break;
  // Topstep needs enough winning days and may need additional profits to meet
  // the 55% evaluation best-day test. Do not stop only at the dollar goal.
  const bestDayOk=!c.consistency||ac.bestDay<=Math.max(0,ac.stagePnl)*c.consistency+1e-7;
  const payoutDaysOk=stage!=='funded'||p.id!=='topstep'||ac.funded150Days>=5;
  if(ac.stagePnl>=c.target-.005&&bestDayOk&&payoutDaysOk)break;
  const slot=plannedSlot(ac.history,c.policy);
  const risk=pos(c[slot]);
  // User-selected risk is always exact; no hidden downsizing.
  const dailyHeadroom=p.dailyLoss-dayProfit;
  const overallHeadroom=ac.stagePnl-floorFor(p,ac);
  const reserve=Math.max(.01,p.riskReserve);
  if(risk<.01||risk+reserve>dailyHeadroom+1e-8||risk+reserve>overallHeadroom+1e-8){
   ac.blocked++;
   const overallBlocked=risk<.01||risk+reserve>overallHeadroom+1e-8;
   const impossibleDaily=Number.isFinite(p.dailyLoss)&&risk+reserve>p.dailyLoss+1e-8;
   // A tier that cannot fit even on a fresh trading day, or cannot fit the
   // overall headroom, is untradeable without changing the configured policy.
   if(overallBlocked||impossibleDaily)ac.status='exhausted';
   if(record)ac.trace.push({day,stage,type:'blocked',risk,slot,
    label:overallBlocked?'Risk exhausted: selected tier exceeds remaining overall headroom':
      impossibleDaily?'Risk exhausted: selected tier exceeds full fresh-day allowance':
       'Daily risk blocked; retry on next trading day'});
   break;
  }
  const win=rand(day,ix,ac.id)<config.winRate;
  const delta=(win?risk*c.rr:-risk)-p.tradeCost;
  const prior=ac.stagePnl;
  ac.stagePnl=money(ac.stagePnl+delta);dayProfit=money(dayProfit+delta);
  ac.trades++;hadTrade=true;ac.totalR+=delta/risk;
  if(win){ac.wins++;winsToday++;}else ac.losses++;
  // Preserve only recent outcome prefix for deterministic risk policy.
  ac.history=(ac.history+(win?'W':'L')).slice(-8);
  ac.peakPnl=Math.max(ac.peakPnl,ac.stagePnl);
  ac.realizedDD=Math.max(ac.realizedDD,ac.peakPnl-ac.stagePnl);
  if(record)ac.trace.push({day,stage,type:win?'win':'loss',slot,risk,rr:c.rr,delta,pnl:ac.stagePnl,trade:ac.trades});
  if(ac.stagePnl<=floorFor(p,ac)+1e-9 ||
     dayProfit<=-p.dailyLoss+1e-9){
   ac.status='failed';if(record)ac.trace.push({day,stage,type:'failed',label:'Modeled loss floor breached'});
   break;
  }
  if(!win)break; // A loss closes this trading day; wins can continue.
 }
 if(hadTrade){
  ac.activeDays++;
  ac.dayProfits.push(dayProfit);
  ac.bestDay=Math.max(ac.bestDay,dayProfit);
  if(stage==='funded'){
   if(dayProfit>0)ac.fundedPositiveDays++;
   if(dayProfit>=150)ac.funded150Days++;
  }
 }
 if(p.id==='topstep')ac.peakEod=Math.max(ac.peakEod,ac.stagePnl);
 const consistent=!c.consistency||ac.bestDay<=Math.max(0,ac.stagePnl)*c.consistency+1e-7;
 if(isEvaluation(stage)&&ac.status==='active'&&ac.stagePnl>=c.target-.005){
  if(!consistent&&record)ac.trace.push({day,stage,type:'consistency',label:'Best-day consistency not yet satisfied'});
  else if(ac.activeDays>=c.minDays){
   nextStage(p,ac,day,record);out.stagePass=true;
   out.activation=stage==='p2'||(stage==='p1'&&!p.stageList.includes('p2'));
  }
 }
 if(stage==='funded'&&ac.status==='active'&&ac.stagePnl>=c.target-.005){
  const eligible=p.id==='topstep'?ac.funded150Days>=5:ac.fundedDays>=p.fundedWaitDays;
  if(eligible){
   ac.firstPaid=firstPayout(p,ac);ac.status='paid';
   if(record)ac.trace.push({day,stage,type:'paid',label:'First modeled payout',cash:ac.firstPaid});
   out.paid=true;
  }
 }
 return out;
}
function pairedSignal(seed,trial,day,ix,id){
 let x=(Math.floor(Number(seed)||0)>>>0) ^ Math.imul((trial+1)>>>0,0x9E3779B1);
 x^=Math.imul(day>>>0,0x85EBCA6B);x^=Math.imul((ix+1)>>>0,0xC2B2AE35);
 x^=Math.imul((id+1)>>>0,0x27D4EB2F);
 x^=x>>>16;x=Math.imul(x,0x7FEB352D);x^=x>>>15;
 x=Math.imul(x,0x846CA68B);x^=x>>>16;
 return (x>>>0)/4294967296;
}
function oneTrial(p,config,rng,record=false){
 const n=Math.max(0,Math.floor(config.count));
 const accounts=Array.from({length:n},(_,i)=>makeAccount(i+1));
 const commonSignals=new Map();
 const rand=(day,ix,id)=>{
  if(config.pairedSignals)return pairedSignal(config.seed,config.trialIndex||0,day,ix,config.signalMode==='shared'?0:id);
  if(config.signalMode!=='shared')return rng();
  const key=day+':'+ix;
  if(!commonSignals.has(key))commonSignals.set(key,rng());
  return commonSignals.get(key);
 };
 let spent=p.fee*n,paid=0,receipts=0,activations=0;
 for(let day=1;day<=config.days;day++){
  // Funded positions that are paid/free at the end of a day release their
  // active-slot capacity for accounts that previously passed evaluation.
  if(p.id==='topstep'){
   let live=accounts.filter(a=>a.stageIndex===p.stageList.length-1&&a.status==='active').length;
   for(const a of accounts){
    if(live>=p.fundedMaxActive)break;
    if(a.status!=='activation-wait')continue;
    a.status='active';activations++;spent+=p.activationFee;live++;
    if(record&&a.id<=3)a.trace.push({day,stage:'funded',type:'activation',label:'Funded slot available; activation starts this day'});
   }
  }
  for(const ac of accounts){
   if(ac.status!=='active')continue;
   // Global active-funded cap for Topstep is applied at activation, not at purchase.
   const res=runAccountDay(p,ac,day,rand,config,record&&ac.id<=3);
   if(res.activation){
    const fundedNow=accounts.filter(x=>x.stageIndex===p.stageList.length-1&&x.status==='active').length;
    if(p.id==='topstep'&&fundedNow>p.fundedMaxActive){
     ac.status='activation-wait';
     if(record&&ac.id<=3)ac.trace.push({day,stage:'funded',type:'wait',label:'Active funded cap reached'});
    }else{
     spent+=p.activationFee;activations++;
    }
   }
   if(res.paid){paid++;receipts+=ac.firstPaid;}
  }
 }
 const passes=p.stageList.filter(x=>x!=='funded').map(stage=>accounts.filter(x=>x.passes.some(y=>y.stage===stage)).length);
 // Evaluation passes waiting for a funded slot are not counted as activated.
 const funded=activations;
 const exhausted=accounts.filter(x=>x.status==='exhausted').length;
 const failed=accounts.filter(x=>x.status==='failed').length;
 const pending=accounts.filter(x=>x.status==='active'||x.status==='activation-wait').length;
 const net=receipts-spent;
 return {bought:n,paid,passes,funded,failed,exhausted,pending,spent,receipts,net,activations,
   trades:accounts.reduce((sum,a)=>sum+a.trades,0),
   qualifying:accounts.reduce((sum,a)=>sum+a.totalAdminDays,0),
   accountDetails:record?accounts.slice(0,3):[],
   accounts:record?accounts:undefined};
}
function quantile(sorted,q){
 if(!sorted.length)return 0;
 const p=clamp(q,0,1)*(sorted.length-1),lo=Math.floor(p),frac=p-lo;
 return sorted[lo]+(sorted[Math.min(lo+1,sorted.length-1)]-sorted[lo])*frac;
}
function simulatePortfolio(p,config={}){
 const budget=pos(config.budget);
 const reservedPer=p.id==='topstep'?p.activationFee:0;
 const perUnit=p.fee+reservedPer;
 const desired=perUnit>0?Math.floor(budget/perUnit):0;
 const count=clamp(desired,0,Math.max(1,Math.floor(config.maxAccounts||100)));
 const clipped=desired>count;
 const trials=clamp(config.trials,50,3000)|0;
 const settings={
  days:clamp(config.days,1,120)|0,
  trials,count,
  tradesPerDay:clamp(config.tradesPerDay,1,6)|0,
  winRate:clamp(config.winRate==null?p.winRate*100:config.winRate,0,100)/100,
  seed:config.seed||24717,
  pairedSignals:config.pairedSignals===true,
  signalMode:config.signalMode==='shared'?'shared':'independent'
 };
 const results=[],stageTotals=p.stageList.filter(x=>x!=='funded').map(()=>0);
 const total={bought:0,paid:0,funded:0,failed:0,exhausted:0,pending:0,spent:0,receipts:0,net:0,activations:0,trades:0,qualifying:0};
 const rand=rngFactory(settings.seed);
 let withPayout=0,positiveNet=0,goalMet=0, sample=null;
 const goal=pos(config.netGoal);
 for(let k=0;k<trials;k++){
  const x=oneTrial(p,{...settings,trialIndex:k},rand,k===0);
  if(k===0)sample=x;
  for(const key of Object.keys(total))total[key]+=x[key]||0;
  x.passes.forEach((count,i)=>stageTotals[i]+=count);
  results.push(x.net);
  if(x.paid>0)withPayout++;
  if(x.net>0)positiveNet++;
  if(x.net>=goal&&goal>0)goalMet++;
 }
 const avg=Object.fromEntries(Object.entries(total).map(([k,v])=>[k,v/trials]));
 const nets=results.slice().sort((a,b)=>a-b);
 return {
  plan:p,config:settings,budget,desired,count,clipped,perUnit,feeReserve:reservedPer*count,
  avg,stages:stageTotals.map(x=>x/trials),
  chancePayout:withPayout/trials,chanceProfit:positiveNet/trials,
  chanceGoal:goal?goalMet/trials:null,goal,
  roi:avg.spent>0?avg.net/avg.spent:0,
  median:quantile(nets,.5),p10:quantile(nets,.1),p90:quantile(nets,.9),
  sample,nets
 };
}
root.StudioPortfolioEngine={buildPlan,validatePlan,resolvePolicy,plannedSlot,
  runAccountDay,simulatePortfolio,rngFactory,phasesFor,supported,oneTrial};
})(typeof window!=='undefined'?window:globalThis);