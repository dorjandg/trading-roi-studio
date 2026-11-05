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
 if(has(choices,history))return choices[history];
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
 const topstepLimits={50000:2000,100000:3000,150000:4500};
 const maxLoss=programId==='topstep'?topstepLimits[size]:
  dynamic(state,'overallLoss',dynamic(audit?.loss?.maximumUSDBySize,String(size),size*pos(program?.max)/100));
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
  // Approximate calendar-day payout eligibility on a trading-day timeline.
  // The clock starts with the first trade in the funded stage, not activation.
  payoutWaitCalendarDays:pos(dynamic(state,'daysBeforeRequest',isTopstep?0:14)),
  fundedWaitDays:clamp(Math.ceil(pos(dynamic(state,'daysBeforeRequest',isTopstep?0:14))*5/7),0,100),
  payoutProcessingCalendarDays:pos(state.reviewDays)+pos(state.payoutProcessingDays),
  payoutProcessingTradingDays:clamp(Math.ceil((pos(state.reviewDays)+pos(state.payoutProcessingDays))*5/7),0,60),
  qualificationSize:isTopstep?'1 micro contract':'0.01 lot',
  winRate:clamp(dynamic(state,'winRate',40),0,100)/100,
  riskProfiles:{},sourceSaved:!!profile?.state,provisional:!profile?.state,
  stageList:stages,drawdownKind:isTopstep?'eod-trailing':audit?.riskStructure?.drawdownKind||'unverified',
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
  if(['saved','streak','flat','after-win','protect-after-loss'].includes(snap.policyMode))
   policy.mode=snap.policyMode;
  result.riskProfiles[key]={
   target:pos(target),
   minDays:clamp(minDays,0,60),
   maxWinsPerDay:clamp(dynamic(snap,'winCap',2),1,6),
   maxDays:clamp(dynamic(state,root==='funded'?'fundedDays':root+'Days',30),1,365),
   rr,r1:pos(r1),r2:pos(r2),r3:pos(r3),policy:isTopstep&&key==='p1'?{map:{},conflicts:[],mode:'flat'}:policy,
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
  if(c.rr<=0||c.r1<=0||((p.id!=='topstep'||stage!=='p1')&&(c.r2<=0||c.r3<=0)))errors.push(stage+': set positive RR and required risk amounts.');
  if(c.policy.conflicts.length)warnings.push(stage+': conflicting saved option risk choices at '+c.policy.conflicts.length+' history prefixes; default risk rules apply there.');
 }
 return {errors,warnings};
}
function makeAccount(i){return {
 id:i,stageIndex:0,stageDay:0,activeDays:0,adminDays:0,totalAdminDays:0,
 stagePnl:0,history:'',dailyProfit:0,dayProfits:[],peakEod:0,bestDay:0,
 status:'active',trades:0,qualificationTrades:0,wins:0,losses:0,firstPaid:0,
 purchaseDay:0,fundedActivatedDay:null,fundedFirstTradeDay:null,fundedTargetDay:null,payoutRequestedDay:null,paidDay:null,closedDay:null,
 grossProfit:0,grossLoss:0,winPnl:0,lossPnl:0,riskTotal:0,plannedReward:0,tradePnl:0,
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
 if(p.id==='topstep')return Math.min(0,ac.peakEod-cap); // EOD watermark; MLL locks at zero
 if(p.drawdownKind==='static')return -cap;
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
 if(ac.status==='payout-pending'){
  if(day>=ac.payoutRequestedDay+p.payoutProcessingTradingDays){
   ac.status='paid';ac.paidDay=day;
   if(record)ac.trace.push({day,stage:'funded',type:'paid',label:'Modeled payout received',cash:ac.firstPaid});
   return {stagePass:false,paid:true,activation:false};
  }
  return {stagePass:false,paid:false,activation:false};
 }
 if(ac.status!=='active')return {stagePass:false,paid:false,activation:false};
 const stage=stageName(p,ac),c=p.riskProfiles[stage];
 if(!c){ac.status='invalid';return {stagePass:false,paid:false,activation:false}}
 ac.stageDay++;
 const out={stagePass:false,paid:false,activation:false};
 if(stage==='funded')ac.fundedDays++;
 const eligiblePayout=()=>ac.fundedFirstTradeDay!==null &&
  (p.id==='topstep'?ac.funded150Days>=5:day-ac.fundedFirstTradeDay+1>=p.fundedWaitDays);
 const requestPayout=()=>{
  ac.firstPaid=firstPayout(p,ac);
  ac.payoutRequestedDay=day;
  if(record)ac.trace.push({day,stage:'funded',type:'payout-request',label:'Payout requested; funded trading frozen',cash:ac.firstPaid});
  if(p.payoutProcessingTradingDays<=0){
   ac.status='paid';ac.paidDay=day;
   if(record)ac.trace.push({day,stage:'funded',type:'paid',label:'Modeled payout received',cash:ac.firstPaid});
   out.paid=true;
  }else ac.status='payout-pending';
 };
 const alreadyTarget=ac.stagePnl>=c.target-.005;
 if(stage==='funded'&&alreadyTarget&&ac.fundedTargetDay===null)ac.fundedTargetDay=day;
 const consistentNow=!c.consistency||ac.bestDay<=Math.max(0,ac.stagePnl)*c.consistency+1e-7;
 if(isEvaluation(stage)&&alreadyTarget&&consistentNow && ac.activeDays<c.minDays){
  ac.adminDays++;ac.totalAdminDays++;ac.qualificationTrades++;
  // One synthetic smallest-size qualification trade for the day. Not one of
  // the strategy signals. Its actual P/L/margin cannot be computed without
  // symbol contract specifications, so do not invent a zero-risk live order.
  ac.activeDays++;
  if(record)ac.trace.push({day,stage,type:'admin',lot:p.qualificationSize,
   label:'Illustrative minimum-size qualification order ('+p.qualificationSize+'); market P/L not modeled'});
 }
 if(isEvaluation(stage)&&alreadyTarget&&consistentNow&&ac.activeDays>=c.minDays){
  nextStage(p,ac,day,record);out.stagePass=true;out.activation=stage==='p1'&&!p.stageList.includes('p2');
  if(stage==='p2')out.activation=true;
  return out;
 }
 if(stage==='funded'&&alreadyTarget){
  if(eligiblePayout()){requestPayout();return out;}
  // FTMO/Hola: profit is locked at the COMPLETED winning trade even when
  // it overshoots the target. Topstep may need additional winning days for
  // its separate payout eligibility rule.
  if(p.id!=='topstep'||ac.funded150Days>=5){
   if(record)ac.trace.push({day,stage,type:'waiting',
    label:'Funded target locked; no more trades until payout eligibility'});
   return out;
  }
 }
 let dayProfit=0,hadTrade=false,winsToday=0;
 const signals=clamp(config.tradesPerDay,0,20);
 for(let ix=0;ix<signals;ix++){
  if(winsToday>=c.maxWinsPerDay)break;
  // Topstep needs enough winning days and may need additional profits to meet
  // the 55% evaluation best-day test. Do not stop only at the dollar goal.
  const bestDayOk=!c.consistency||ac.bestDay<=Math.max(0,ac.stagePnl)*c.consistency+1e-7;
  const payoutDaysOk=stage!=='funded'||p.id==='topstep'&&ac.funded150Days<5;
  if(ac.stagePnl>=c.target-.005&&bestDayOk&&!payoutDaysOk)break;
  const qualificationTopstep=stage==='funded'&&p.id==='topstep'&&
   ac.fundedTargetDay!==null&&ac.funded150Days<5;
  // Combine uses the one Challenge R1. XFA uses R3 once the target is
  // reached, while further eligible $150 winning days are required.
  const slot=p.id==='topstep'&&stage==='p1'?'r1':
   qualificationTopstep?'r3':plannedSlot(ac.history,c.policy);
  const risk=pos(c[slot]);
  // User-selected risk is always exact; no hidden downsizing.
  const dailyHeadroom=p.dailyLoss-dayProfit;
  const overallHeadroom=ac.stagePnl-floorFor(p,ac);
  const reserve=Math.max(.01,p.riskReserve);
  // The firm loss buffer includes the whole possible losing trade, including
  // modelled trade cost. A trade that would breach daily/overall room is blocked.
  const potentialLoss=risk+p.tradeCost+reserve;
  if(risk<.01||potentialLoss>dailyHeadroom+1e-8||potentialLoss>overallHeadroom+1e-8){
   ac.blocked++;
   const overallBlocked=risk<.01||potentialLoss>overallHeadroom+1e-8;
   const impossibleDaily=Number.isFinite(p.dailyLoss)&&potentialLoss>p.dailyLoss+1e-8;
   // A tier that cannot fit even on a fresh trading day, or cannot fit the
   // overall headroom, is untradeable without changing the configured policy.
   if(overallBlocked||impossibleDaily){ac.status='exhausted';ac.closedDay=day;}
   if(record)ac.trace.push({day,stage,type:'blocked',risk,slot,
    label:overallBlocked?'Risk exhausted: selected tier exceeds remaining overall headroom':
      impossibleDaily?'Risk exhausted: selected tier exceeds full fresh-day allowance':
       'Daily risk blocked; retry on next trading day'});
   break;
  }
  const slotIndex=config.tradeSlots?.[ix]??ix;
  const win=rand(day,slotIndex,ac.id)<config.winRate;
  const delta=(win?risk*c.rr:-risk)-p.tradeCost;
  if(stage==='funded'&&ac.fundedFirstTradeDay===null)ac.fundedFirstTradeDay=day;
  const prior=ac.stagePnl;
  ac.stagePnl=money(ac.stagePnl+delta);dayProfit=money(dayProfit+delta);
  if(stage==='funded'&&ac.stagePnl>=c.target-.005&&ac.fundedTargetDay===null)
   ac.fundedTargetDay=day;
  ac.trades++;hadTrade=true;ac.totalR+=delta/risk;
  ac.grossProfit+=Math.max(0,delta);ac.grossLoss+=Math.max(0,-delta);
  ac.tradePnl+=delta;ac.riskTotal+=risk;ac.plannedReward+=risk*c.rr;
  if(win){ac.wins++;winsToday++;ac.winPnl+=delta;}
  else{ac.losses++;ac.lossPnl+=delta;}
  // Preserve only recent outcome prefix for deterministic risk policy.
  ac.history=(ac.history+(win?'W':'L')).slice(-8);
  ac.peakPnl=Math.max(ac.peakPnl,ac.stagePnl);
  ac.realizedDD=Math.max(ac.realizedDD,ac.peakPnl-ac.stagePnl);
  if(record)ac.trace.push({day,stage,type:win?'win':'loss',slot,risk,rr:c.rr,delta,pnl:ac.stagePnl,trade:ac.trades});
  if(ac.stagePnl<=floorFor(p,ac)+1e-9 ||
     dayProfit<=-p.dailyLoss+1e-9){
   ac.status='failed';ac.closedDay=day;if(record)ac.trace.push({day,stage,type:'failed',label:'Modeled loss floor breached'});
   break;
  }
  if(!win)break; // A loss closes this trading day; wins can continue.
 }
 if(hadTrade){
  ac.activeDays++;
  ac.dayProfits.push(dayProfit);
  ac.bestDay=Math.max(ac.bestDay,dayProfit);
  if(stage==='funded'){
   if(ac.stagePnl>=c.target-.005&&ac.fundedTargetDay===null)ac.fundedTargetDay=day;
   if(dayProfit>0)ac.fundedPositiveDays++;
   if(dayProfit>=150)ac.funded150Days++;
  }
 }
 if(p.id==='topstep'){
  const oldFloor=floorFor(p,ac);
  // The MLL changes after a trading day's closing balance, not intraday.
  ac.peakEod=Math.max(ac.peakEod,ac.stagePnl);
  const newFloor=floorFor(p,ac);
  if(record&&newFloor>oldFloor+1e-9)ac.trace.push({day,stage,type:'eod-mll',
   floor:newFloor,pnl:ac.stagePnl,label:'Topstep EOD trailing MLL updated'});
 }
 const consistent=!c.consistency||ac.bestDay<=Math.max(0,ac.stagePnl)*c.consistency+1e-7;
 if(isEvaluation(stage)&&ac.status==='active'&&ac.stagePnl>=c.target-.005){
  if(!consistent&&record)ac.trace.push({day,stage,type:'consistency',label:'Best-day consistency not yet satisfied'});
  else if(ac.activeDays>=c.minDays){
   nextStage(p,ac,day,record);out.stagePass=true;
   out.activation=stage==='p2'||(stage==='p1'&&!p.stageList.includes('p2'));
  }
 }
 if(stage==='funded'&&ac.status==='active'&&ac.stagePnl>=c.target-.005&&eligiblePayout())
  requestPayout();
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
function canAcceptSignal(p,ac){
 if(ac.status!=='active')return false;
 const stage=stageName(p,ac),c=p.riskProfiles[stage];
 if(!c)return false;
 if(ac.stagePnl>=c.target-.005){
  const consistent=!c.consistency||ac.bestDay<=Math.max(0,ac.stagePnl)*c.consistency+1e-7;
  if(isEvaluation(stage)&&consistent)return false;
  if(stage==='funded'&&(p.id!=='topstep'||ac.funded150Days>=5))return false;
 }
 return true;
}
function oneTrial(p,config,rng,record=false){
 const n=Math.max(0,Math.floor(config.count)),dynamic=config.purchaseMode==='recycle';
 const evaluationCap=config.evaluationAllocationCap>0?Math.floor(config.evaluationAllocationCap/p.size):Infinity;
 const fundedCap=Math.min(p.fundedMaxActive,config.fundedAllocationCap>0?Math.floor(config.fundedAllocationCap/p.size):Infinity);
 // Upfront accounts all begin evaluation; cap is applied before purchase.
 const upfront=Math.min(n,evaluationCap);
 const accounts=dynamic?[]:Array.from({length:upfront},(_,i)=>makeAccount(i+1));
 // Round-robin cursor persists between days. With 50 purchased accounts and
 // 5 signals, day 1 uses #1–#5, day 2 uses #6–#10, etc.
 let cursor=0;
 const tradeAssignments=record?[]:null;
 const commonSignals=new Map();
 const rand=(day,ix,id)=>{
  if(config.pairedSignals)return pairedSignal(config.seed,config.trialIndex||0,day,ix,config.signalMode==='shared'?0:id);
  if(config.signalMode!=='shared')return rng();
  const key=day+':'+ix;
  if(!commonSignals.has(key))commonSignals.set(key,rng());
  return commonSignals.get(key);
 };
 let bought=dynamic?0:upfront,spent=p.fee*bought,paid=0,receipts=0,activations=0;
 let challengeSpent=spent,activationSpent=0;
 const liveCount=()=>accounts.filter(a=>['active','activation-wait','payout-pending'].includes(a.status)).length;
 const evaluationCount=()=>accounts.filter(a=>a.status==='active'&&isEvaluation(stageName(p,a))).length;
 const fundedCount=()=>accounts.filter(a=>['active','payout-pending'].includes(a.status)&&stageName(p,a)==='funded').length;
 // An activation-fee commitment is held for each not-yet-activated account.
 // Released when an evaluation ends unsuccessfully; never counted as spent.
 const reserved=()=>p.activationFee>0?accounts.filter(a=>
  (a.status==='active'||a.status==='activation-wait') &&
  a.stageIndex<p.stageList.length-1).length*p.activationFee:0;
 const journeyCounts=()=>({
  challenge:accounts.filter(a=>a.status==='active'&&stageName(p,a)==='p1').length,
  verification:accounts.filter(a=>a.status==='active'&&stageName(p,a)==='p2').length,
  fundedActive:accounts.filter(a=>['active','payout-pending'].includes(a.status)&&stageName(p,a)==='funded').length,
  payoutPending:accounts.filter(a=>a.status==='payout-pending').length,
  fundingWait:accounts.filter(a=>a.status==='activation-wait').length,
  targetHit:accounts.filter(a=>a.fundedTargetDay!==null).length,
  activated:accounts.filter(a=>a.fundedActivatedDay!==null).length,
  passed1:accounts.filter(a=>a.passes.some(x=>x.stage==='p1')).length,
  passed2:accounts.filter(a=>a.passes.some(x=>x.stage==='p2')).length
 });
 const dailyCash=config.trackDaily===true?
  [{day:0,spent,receipts,net:receipts-spent,paid,bought,challengeSpent,activationSpent,
   live:liveCount(),burned:0,opportunities:0,tradesToday:0,qualificationToday:0,unusedToday:0,...journeyCounts()}]:null;
 for(let day=1;day<=config.days;day++){
  const dailyOpportunities=dynamic?(config.tradeSchedule?config.tradeSchedule[day-1]:config.tradesPerDay):config.tradesPerDay;
  const tradesBefore=accounts.reduce((sum,ac)=>sum+ac.trades,0);
  const qualificationsBefore=accounts.reduce((sum,ac)=>sum+ac.qualificationTrades,0);
  if(dynamic){
   // Existing eligible purchased accounts get priority; only buy the gap.
   const eligible=accounts.filter(ac=>canAcceptSignal(p,ac)).length;
   const target=config.capacityMode==='manual'?
    Math.min(config.maxActive,dailyOpportunities):dailyOpportunities;
   const needed=Math.max(0,target-eligible);
   const room=config.capacityMode==='manual'?
    Math.max(0,config.maxActive-liveCount()):needed;
   const dailyLimit=Math.min(needed,room,
    config.capacityMode==='manual'?config.maxBuysPerDay:dailyOpportunities,
    config.maxLifetime-accounts.length);
   for(let i=0;i<dailyLimit;i++){
    // Active Phase 1 and Phase 2 accounts share the evaluation cap.
    if(evaluationCount()>=evaluationCap)break;
    const available=config.budget+(config.reinvestPayouts?receipts:0)-spent-reserved();
    if(available+1e-8<p.fee+p.activationFee||p.fee+p.activationFee<=0)break;
    const ac=makeAccount(accounts.length+1);
    ac.purchaseDay=day;
    accounts.push(ac);bought++;spent+=p.fee;challengeSpent+=p.fee;
    if(record&&ac.id<=3)ac.trace.push({day,stage:p.stageList[0],type:'purchase',
     label:'New challenge purchased on trading day '+day,cash:p.fee});
   }
  }
  // Each signal goes to one DISTINCT eligible purchased account.
  // The cursor advances between days so existing accounts keep rotating.
  const allocations=new Map();
  const eligible=accounts.filter(ac=>canAcceptSignal(p,ac));
  for(let ix=0;ix<dailyOpportunities&&ix<eligible.length;ix++){
   const index=(cursor+ix)%eligible.length;
   allocations.set(eligible[index],ix);
  }
  if(eligible.length)cursor=(cursor+Math.min(dailyOpportunities,eligible.length))%eligible.length;
  // Funded positions that are paid/free at the end of a day release their
  // active-slot capacity for accounts that previously passed evaluation.
  if(Number.isFinite(fundedCap)){
   let live=fundedCount();
   for(const a of accounts){
    if(live>=fundedCap)break;
    if(a.status!=='activation-wait')continue;
    a.status='active';a.fundedActivatedDay=day;
    activations++;spent+=p.activationFee;activationSpent+=p.activationFee;live++;
    if(record&&a.id<=3)a.trace.push({day,stage:'funded',type:'activation',label:'Funded slot available; activation starts this day'});
   }
  }
  for(const ac of accounts){
   if(ac.status!=='active'&&ac.status!=='payout-pending')continue;
   // Global active-funded cap for Topstep is applied at activation, not at purchase.
   const signalSlot=allocations.get(ac),selected=signalSlot!==undefined;
   const beforeTrades=ac.trades,beforeWins=ac.wins;
   const assignedStage=stageName(p,ac);
   const dayConfig={...config,tradesPerDay:selected?1:0,
    tradeSlots:selected?[signalSlot]:[]};
   const res=runAccountDay(p,ac,day,rand,dayConfig,record);
   if(record&&selected){
    const outcome=ac.trades>beforeTrades?(ac.wins>beforeWins?'W':'L'):'Skipped';
    tradeAssignments.push({day,signal:signalSlot+1,account:ac.id,
     stage:assignedStage,outcome,status:ac.status});
   }
   if(res.activation){
    const fundedNow=fundedCount();
    if(fundedNow>fundedCap){
     ac.status='activation-wait';
     if(record&&ac.id<=3)ac.trace.push({day,stage:'funded',type:'wait',label:'Funded allocation or activation cap reached'});
    }else{
     ac.fundedActivatedDay=day;
     spent+=p.activationFee;activationSpent+=p.activationFee;activations++;
    }
   }
   if(res.paid){paid++;receipts+=ac.firstPaid;}
  }
  if(record){
   const allocatedSlots=new Set(allocations.values());
   for(let ix=0;ix<dailyOpportunities;ix++)if(!allocatedSlots.has(ix))
    tradeAssignments.push({day,signal:ix+1,account:null,stage:null,
     outcome:'Unused',status:'No eligible account or remaining purchase budget'});
  }
  if(dailyCash){
   const tradesToday=accounts.reduce((sum,ac)=>sum+ac.trades,0)-tradesBefore;
   const qualificationToday=accounts.reduce((sum,ac)=>sum+ac.qualificationTrades,0)-qualificationsBefore;
   // Signals are portfolio-wide in BOTH purchase modes: buying 50 accounts
   // does not create 50 times as many daily signal opportunities.
   const opportunities=dailyOpportunities;
   dailyCash.push({day,spent,receipts,net:receipts-spent,paid,
    bought,challengeSpent,activationSpent,live:liveCount(),
    opportunities,tradesToday,qualificationToday,unusedToday:Math.max(0,opportunities-tradesToday),
    burned:accounts.filter(a=>a.status==='failed'||a.status==='exhausted').length,
    ...journeyCounts()});
  }
 }
 const passes=p.stageList.filter(x=>x!=='funded').map(stage=>accounts.filter(x=>x.passes.some(y=>y.stage===stage)).length);
 // Evaluation passes waiting for a funded slot are not counted as activated.
 const funded=activations;
 const exhausted=accounts.filter(x=>x.status==='exhausted').length;
 const failed=accounts.filter(x=>x.status==='failed').length;
 const pending=accounts.filter(x=>['active','activation-wait','payout-pending'].includes(x.status)).length;
 const net=receipts-spent;
 return {bought,paid,passes,funded,failed,exhausted,pending,spent,receipts,net,activations,
   trades:accounts.reduce((sum,a)=>sum+a.trades,0),
   qualificationTrades:accounts.reduce((sum,a)=>sum+a.qualificationTrades,0),
   wins:accounts.reduce((sum,a)=>sum+a.wins,0),
   losses:accounts.reduce((sum,a)=>sum+a.losses,0),
   grossProfit:accounts.reduce((sum,a)=>sum+a.grossProfit,0),
   grossLoss:accounts.reduce((sum,a)=>sum+a.grossLoss,0),
   winPnl:accounts.reduce((sum,a)=>sum+a.winPnl,0),
   lossPnl:accounts.reduce((sum,a)=>sum+a.lossPnl,0),
   riskTotal:accounts.reduce((sum,a)=>sum+a.riskTotal,0),
   plannedReward:accounts.reduce((sum,a)=>sum+a.plannedReward,0),
   totalR:accounts.reduce((sum,a)=>sum+a.totalR,0),
   tradePnl:accounts.reduce((sum,a)=>sum+a.tradePnl,0),
   qualifying:accounts.reduce((sum,a)=>sum+a.totalAdminDays,0),
   accountDetails:record?accounts:[],
   tradeAssignments:tradeAssignments?.sort((a,b)=>a.day-b.day||a.signal-b.signal)||undefined,
   dailyCash:dailyCash||undefined,
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
 const evaluationAllocationCap=pos(config.evaluationAllocationCap);
 const fundedAllocationCap=pos(config.fundedAllocationCap);
 const evaluationCountCap=evaluationAllocationCap>0?Math.floor(evaluationAllocationCap/p.size):Infinity;
 const count=Math.min(clamp(desired,0,Math.max(1,Math.floor(config.maxAccounts||100))),evaluationCountCap);
 const clipped=desired>count;
 const trials=clamp(config.trials,50,3000)|0;
 const settings={
  days:clamp(config.days,1,120)|0,
  trials,count,evaluationAllocationCap,fundedAllocationCap,
  tradesPerDay:clamp(config.tradesPerDay,1,20)|0,
  winRate:clamp(config.winRate==null?p.winRate*100:config.winRate,0,100)/100,
  seed:config.seed||24717,
  pairedSignals:config.pairedSignals===true,
  signalMode:config.signalMode==='shared'?'shared':'independent',
  trackDaily:config.trackCharts===true,
  tradeSchedule:Array.isArray(config.tradeSchedule)&&config.tradeSchedule.length===
   (clamp(config.days,1,120)|0)?config.tradeSchedule.map(x=>clamp(x,0,20)|0):null,
  purchaseMode:config.purchaseMode==='recycle'?'recycle':'upfront',
  capacityMode:config.capacityMode==='manual'?'manual':'automatic',
  maxActive:clamp(Math.floor(config.maxActive||1),1,100)|0,
  maxBuysPerDay:clamp(Math.floor(config.maxBuysPerDay||1),1,20)|0,
  maxLifetime:clamp(Math.floor(config.maxAccounts||100),1,100)|0,
  budget,reinvestPayouts:config.reinvestPayouts===true
 };
 const results=[],stageTotals=p.stageList.filter(x=>x!=='funded').map(()=>0);
 const total={bought:0,paid:0,funded:0,failed:0,exhausted:0,pending:0,spent:0,receipts:0,net:0,activations:0,trades:0,qualifying:0,qualificationTrades:0,
  wins:0,losses:0,grossProfit:0,grossLoss:0,winPnl:0,lossPnl:0,riskTotal:0,plannedReward:0,totalR:0,tradePnl:0};
 const rand=rngFactory(settings.seed);
 const chartTrials=settings.trackDaily?[]:null;
 const chartSums=settings.trackDaily?Array.from({length:settings.days+1},
  (_,day)=>({day,spent:0,receipts:0,net:0,paid:0,bought:0,challengeSpent:0,activationSpent:0,live:0,burned:0,
   challenge:0,verification:0,fundedActive:0,fundingWait:0,payoutPending:0,targetHit:0,activated:0,passed1:0,passed2:0,
   opportunities:0,tradesToday:0,qualificationToday:0,unusedToday:0})):null;
 let withPayout=0,positiveNet=0,goalMet=0, sample=null;
 const goal=pos(config.netGoal);
 for(let k=0;k<trials;k++){
  const x=oneTrial(p,{...settings,trialIndex:k},rand,k===0);
  if(k===0)sample=x;
  if(chartTrials)chartTrials.push({
   net:x.net,spent:x.spent,receipts:x.receipts,roi:x.spent?x.net/x.spent:0,
   paid:x.paid,failed:x.failed,exhausted:x.exhausted,funded:x.funded,
   wins:x.wins,losses:x.losses,trades:x.trades,passes:x.passes.slice()
  });
  if(chartSums)for(const d of x.dailyCash||[]){
   const sum=chartSums[d.day];
   for(const key of ['spent','receipts','net','paid','bought','challengeSpent','activationSpent','live','burned','challenge','verification','fundedActive',
    'fundingWait','payoutPending','targetHit','activated','passed1','passed2','opportunities','tradesToday','qualificationToday','unusedToday'])sum[key]+=d[key];
  }
  for(const key of Object.keys(total))total[key]+=x[key]||0;
  x.passes.forEach((count,i)=>stageTotals[i]+=count);
  results.push(x.net);
  if(x.paid>0)withPayout++;
  if(x.net>0)positiveNet++;
  if(x.net>=goal&&goal>0)goalMet++;
 }
 const avg=Object.fromEntries(Object.entries(total).map(([k,v])=>[k,v/trials]));
 // Aggregate trade-weighted statistics across every account/trial, not the
 // simple average of per-account ratios. Fees are included in each trade P/L.
 const tradeKpis={
  trades:total.trades,
  wr:total.trades?total.wins/total.trades:null,
  rr:total.riskTotal?total.plannedReward/total.riskTotal:null,
  ar:total.trades?total.totalR/total.trades:null,
  pf:total.grossLoss>1e-9?total.grossProfit/total.grossLoss:(total.grossProfit>1e-9?Infinity:null),
  aw:total.wins?total.winPnl/total.wins:null,
  al:total.losses?-total.lossPnl/total.losses:null,
  ev:total.trades?total.tradePnl/total.trades:null,
  gp:total.grossProfit,gl:total.grossLoss
 };
 const nets=results.slice().sort((a,b)=>a-b);
 return {
  plan:p,config:settings,budget,desired,
  count:settings.purchaseMode==='recycle'?avg.bought:count,
  clipped:settings.purchaseMode==='recycle'?avg.bought>=settings.maxLifetime:clipped||desired>count,
  perUnit,feeReserve:reservedPer*count,
  avg,tradeKpis,stages:stageTotals.map(x=>x/trials),
  chancePayout:withPayout/trials,chanceProfit:positiveNet/trials,
  chanceGoal:goal?goalMet/trials:null,goal,
  roi:avg.spent>0?avg.net/avg.spent:0,
  median:quantile(nets,.5),p10:quantile(nets,.1),p90:quantile(nets,.9),
  sample,nets,chartTrials,
  cashCurve:chartSums?.map(d=>({day:d.day,spent:d.spent/trials,
   receipts:d.receipts/trials,net:d.net/trials,paid:d.paid/trials,
   bought:d.bought/trials,challengeSpent:d.challengeSpent/trials,
   activationSpent:d.activationSpent/trials,live:d.live/trials,burned:d.burned/trials,
   challenge:d.challenge/trials,verification:d.verification/trials,fundedActive:d.fundedActive/trials,
   fundingWait:d.fundingWait/trials,payoutPending:d.payoutPending/trials,targetHit:d.targetHit/trials,activated:d.activated/trials,
   passed1:d.passed1/trials,passed2:d.passed2/trials,
   opportunities:d.opportunities/trials,tradesToday:d.tradesToday/trials,qualificationToday:d.qualificationToday/trials,
   unusedToday:d.unusedToday/trials}))||null
 };
}
root.StudioPortfolioEngine={buildPlan,validatePlan,resolvePolicy,plannedSlot,
  runAccountDay,simulatePortfolio,rngFactory,phasesFor,supported,oneTrial};
})(typeof window!=='undefined'?window:globalThis);