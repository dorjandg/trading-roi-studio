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
const slotLevels=['r1','r2','r3','r4'];
const FtmoBuffer=root.StudioFtmoFundedBuffer||null;
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
  const officialTarget=key==='p1'?dynamic(state,'p1Target',size*pos(program.targets?.[0])/100):
   key==='p2'?dynamic(state,'p2Target',size*pos(program.targets?.[1])/100):result.fundedTarget;
  // A phase planning target transfers to Monte Carlo ONLY for an Applied
  // smart-sequence policy, preserving legacy profile/firm rule targets.
  const appliedFtmoBuffer=programId==='ftmo2'&&key==='funded'&&snap.policyMode==='ftmo-funded-buffer';
  const appliedSmart=snap.policyMode==='smart-sequence';
  const requestedTarget=Number(snap.targetOverride);
  const target=(appliedSmart||appliedFtmoBuffer)&&Number.isFinite(requestedTarget)&&requestedTarget>=.01?
   requestedTarget:officialTarget;
  if(key==='funded'&&(appliedSmart||appliedFtmoBuffer))result.fundedTarget=pos(target);
  // FTMO transition timing model: if the target is reached on trading
  // day 1-3, the NEXT phase account is available on trading day 4.
  // The engine advances the stage at the end of day 3 and first trades
  // the next stage on day 4. A later target hit advances at that day's end.
  const configuredMinDays=key==='p1'?dynamic(state,'p1MinDays',pos(program.days?.[0])):
   key==='p2'?dynamic(state,'p2MinDays',pos(program.days?.[1])):0;
  const minDays=programId==='ftmo2'&&key==='p1'?
   clamp(dynamic(state,'ftmoP1TransitionDays',3),1,30):
   programId==='ftmo2'&&key==='p2'?
   clamp(dynamic(state,'ftmoP2TransitionDays',3),1,30):configuredMinDays;
  const base=defaultRisk(programId,size,key);
  const r1=dynamic(lev,'r1',dynamic(state,root+'Base',base));
  const r2=dynamic(lev,'r2',dynamic(state,root+'Recovery',Math.round(base*.72)));
  const r3=dynamic(lev,'r3',dynamic(state,root+'Recovery',Math.round(base*.52)));
  const r4=dynamic(lev,'r4',0);
  const rrBase=dynamic(state.rrByTier,root+'Base',dynamic(state,'rr',3));
  const rr=clamp(rrBase,.1,100);
  const policy=resolvePolicy(snap.optionSequences||{});
  if(['saved','streak','flat','after-win','protect-after-loss','target-now','repair-r2','buffered-target','eval-recovery-burn','funded-profit-ladder','funded-staged-recovery','smart-sequence','ftmo-funded-buffer'].includes(snap.policyMode))
   policy.mode=snap.policyMode;
  result.riskProfiles[key]={
   target:pos(target),
   minDays:clamp(minDays,0,60),
   maxWinsPerDay:clamp(dynamic(snap,'winCap',2),1,6),
   maxDays:clamp(dynamic(state,root==='funded'?'fundedDays':root+'Days',30),1,365),
   rr,r1:pos(r1),r2:pos(r2),r3:pos(r3),r4:pos(r4),
   officialTarget:pos(officialTarget),
   appliedSmart:appliedSmart,
   appliedSmartLabel:appliedSmart?String(snap.appliedSmartSetup?.label||'Smart R1-first strategy').slice(0,100):'',
   appliedFtmoBuffer:appliedFtmoBuffer,
   ftmoBuffer:appliedFtmoBuffer&&FtmoBuffer?FtmoBuffer.normalize(snap.ftmoBuffer):null,
   ftmoBufferLabel:appliedFtmoBuffer?String(snap.appliedFtmoBuffer?.label||'FTMO Funded Buffer Builder').slice(0,100):'',
   sweepRemainder:appliedSmart&&snap.sweepRemainder!==false,
   sweepThreshold:clamp(dynamic(snap,'sweepThreshold',100),0,1000),
   rrByTier:snap.rrByTier&&['r1','r2','r3'].every(t=>Number.isFinite(Number(snap.rrByTier[t]))&&Number(snap.rrByTier[t])>0)?
    Object.fromEntries(['r1','r2','r3'].map(t=>[t,Number(snap.rrByTier[t])])):undefined,
   dynamicMaxRisk:snap.dynamicMaxRisk!=null&&Number(snap.dynamicMaxRisk)>0?Number(snap.dynamicMaxRisk):undefined,
   fundedStarterRisk:key==='funded'&&snap.fundedStarterRisk!=null&&Number(snap.fundedStarterRisk)>0?Number(snap.fundedStarterRisk):undefined,
   fundedMaxTradeRisk:key==='funded'&&snap.fundedMaxTradeRisk!=null&&Number(snap.fundedMaxTradeRisk)>0?Number(snap.fundedMaxTradeRisk):undefined,
   fundedRecoveryLevels:key==='funded'&&Array.isArray(snap.fundedRecoveryLevels)&&snap.fundedRecoveryLevels.length===4&&
    snap.fundedRecoveryLevels.every(n=>Number.isFinite(Number(n))&&Number(n)>0)?
    snap.fundedRecoveryLevels.map(Number):undefined,
   policy:isTopstep&&key==='p1'&&!appliedSmart?{map:{},conflicts:[],mode:'flat'}:policy,
   consistency:isTopstep&&key==='p1'?.55:0,
   name:key==='p1'?(isTopstep?'Challenge · Trading Combine':'Phase 1'):key==='p2'?'Phase 2':(isTopstep?'Funded · XFA':'Funded')
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
 if(p.id==='topstep'){
  const f=p.riskProfiles.funded;
  if(f&&f.r3*(f.rrByTier?.r3??f.rr)-p.tradeCost<150)
   warnings.push('Funded R3 × RR is below $150 net for one winning day. Since the model routes at most one strategy signal to each account per day, R3 cannot add a qualifying $150 day unless increased.');
 }
 if(p.provisional)warnings.push('No saved account profile found: R1/R2/R3 are illustrative defaults. Configure this account in Firms.');
 if(p.riskProfiles.funded?.target<=0)errors.push('Set a positive first-payout planning target.');
 for(const [stage,c] of Object.entries(p.riskProfiles)){
  if(c.target<=0)errors.push(stage+': profit target missing.');
  if(c.policy.mode==='ftmo-funded-buffer'){
   if(p.id!=='ftmo2'||stage!=='funded')
    errors.push(stage+': FTMO Funded Buffer Builder is not allowed on this firm/stage.');
   if(!FtmoBuffer||!FtmoBuffer.valid(c.ftmoBuffer))
    errors.push(stage+': FTMO buffer sizing module/parameters missing.');
   if(c.rr<=0)errors.push(stage+': positive RR required for buffer policy.');
  }
  else if(c.policy.mode==='smart-sequence'){
   if(c.rr<=0||c.r1<=0||c.r2<=0||c.r3<=0||c.r4<0||
      ![c.r1,c.r2,c.r3,c.r4].every(Number.isFinite))
    errors.push(stage+': Smart Setup requires R1, R2, R3 > 0 and R4 >= 0.');
   if(c.sweepRemainder&&p.drawdownKind!=='static')
    warnings.push(stage+': terminal R3 overall-buffer sweep cannot be verified for a non-static/trailing floor and will not be used.');
  }else if(c.rr<=0||c.r1<=0||![c.rr,c.r1,c.r2,c.r3,c.r4].every(Number.isFinite)||
   [c.r2,c.r3,c.r4].some(n=>n<0))
   errors.push(stage+': positive RR and R1 required; optional R2–R4 can be 0 (disabled).');
   if(c.rrByTier&&['r1','r2','r3'].some(t=>!Number.isFinite(c.rrByTier[t])||c.rrByTier[t]<=0))
    errors.push(stage+': every tier reward/risk must be positive.');
  if(c.policy.conflicts.length)warnings.push(stage+': conflicting saved option risk choices at '+c.policy.conflicts.length+' history prefixes; default risk rules apply there.');
 }
 return {errors,warnings};
}
// Optional state-aware recovery policies. Original saved risk policies stay unchanged.
const adaptiveModes=new Set(['target-now','repair-r2','buffered-target','eval-recovery-burn','funded-profit-ladder','funded-staged-recovery']);
function chooseTradeRisk(p,ac,stage,c,dayProfit=0){
 const mode=c.policy?.mode||'saved';
 if(mode==='ftmo-funded-buffer'){
  if(p.id!=='ftmo2'||stage!=='funded'||!FtmoBuffer)
   return {slot:'invalid-buffer-policy',risk:0,rr:c.rr};
  const q=FtmoBuffer.quote(c.ftmoBuffer,{
   pnl:ac.stagePnl,stageTrades:ac.stageTrades||0,rr:c.rr,target:c.target,tradeCost:p.tradeCost
  });
  return {slot:'buffer-'+q.phase,risk:q.risk,rr:c.rr,bufferPhase:q.phase};
 }
 const smart=mode==='smart-sequence';
 const forceTopstepR3=!smart&&p.id==='topstep'&&stage==='funded'&&ac.fundedTargetDay!==null&&ac.funded150Days<5;
 const topstepCombine=!smart&&p.id==='topstep'&&stage==='p1';
 let slot=smart?(ac.smartNext||'r1'):topstepCombine?'r1':forceTopstepR3?'r3':plannedSlot(ac.history,c.policy);
 if(mode==='repair-r2'&&!topstepCombine&&!forceTopstepR3)slot=ac.repairSlot||'r1';
 if((mode==='target-now'||mode==='buffered-target')&&!topstepCombine&&!forceTopstepR3)slot='r1';
 const rr=Number(c.rrByTier?.[slot]??c.rr);
 if(smart){
  const risk=slot==='stop'?0:pos(c[slot]);
  const rawRoom=ac.stagePnl-floorFor(p,ac);
  const remaining=rawRoom-risk-pos(p.tradeCost);
  // ONLY waive the overall reserve on a terminal R3 with static floor.
  // The daily reserve remains enforced in preflight and execution.
  const allIn=slot==='r3'&&c.r4<.01&&c.sweepRemainder===true&&
   p.drawdownKind==='static'&&Number.isFinite(p.overallLoss)&&
   remaining>=-1e-7&&remaining<=c.sweepThreshold+1e-7;
  return {slot,risk,rr,allIn};
 }
 if(mode==='eval-recovery-burn'&&!topstepCombine&&isEvaluation(stage)){
  const cost=pos(p.tradeCost),allIn=ac.history.endsWith('LL');
  const reserve=allIn?0:Math.max(.01,pos(p.riskReserve));
  const room=Math.max(0,Math.min(ac.stagePnl-floorFor(p,ac),p.dailyLoss-dayProfit)-cost-reserve);
  const needed=allIn?room:Math.ceil((Math.max(0,c.target-ac.stagePnl)+cost)/rr*100)/100;
  const risk=Math.max(0,Math.floor(Math.min(room,needed)*100)/100);
  return {slot:allIn?'r3':ac.history.endsWith('L')?'r2':'r1',risk,rr,allIn};
 }
 if(mode==='funded-profit-ladder'&&stage==='funded'&&!forceTopstepR3){
  const cost=pos(p.tradeCost),reserve=Math.max(.01,pos(p.riskReserve));
  const room=Math.max(0,Math.min(ac.stagePnl-floorFor(p,ac),p.dailyLoss-dayProfit)-cost-reserve);
  const starter=pos(c.fundedStarterRisk??c.r1);
  const targetRisk=ac.stagePnl>0.05?Math.max(0,ac.stagePnl-cost):
   ac.stagePnl< -0.05?Math.ceil((-ac.stagePnl+cost)/rr*100)/100:starter;
  const cap=pos(c.fundedMaxTradeRisk??Infinity);
  const risk=Math.max(0,Math.floor(Math.min(room,targetRisk,cap)*100)/100);
  return {slot:ac.stagePnl>0?'r2':ac.stagePnl<0?'r3':'r1',risk,rr};
 }
 if(mode==='funded-staged-recovery'&&stage==='funded'&&!forceTopstepR3){
  const cost=pos(p.tradeCost),reserve=Math.max(.01,pos(p.riskReserve));
  const room=Math.max(0,Math.min(ac.stagePnl-floorFor(p,ac),p.dailyLoss-dayProfit)-cost-reserve);
  const match=ac.history.match(/L+$/),streak=match?match[0].length:0;
  const levels=c.fundedRecoveryLevels||[150,200,250,200];
  // On a positive winning path, compound the accumulated funded profit:
  // +450 -> risk 450 -> +1800 -> risk capped at $450 for optional third win.
  // A losing streak uses the explicitly requested 150/200/250/200 tiers.
  // A winning recovery that reaches zero restarts at the initial 150 tier.
  const positiveWin=ac.stagePnl>0.05&&ac.history.endsWith('W');
  // A profit-only loss that returns the account to breakeven restarts
  // the funded sequence at $150; it is not the first recovery loss.
  const flat=Math.abs(ac.stagePnl)<=.05;
  const desired=flat?levels[0]:
   positiveWin?Math.max(0,ac.stagePnl-cost):
   ac.stagePnl>0.05?Math.max(0,ac.stagePnl-cost):
   streak?levels[Math.min(streak,levels.length-1)]:levels[0];
  const cap=pos(c.fundedMaxTradeRisk??Infinity);
  const risk=Math.max(0,Math.floor(Math.min(room,Math.max(0,desired),cap)*100)/100);
  return {slot:streak===0?'r1':streak===1?'r2':'r3',risk,rr};
 }
 if(!adaptiveModes.has(mode)||topstepCombine||forceTopstepR3)return {slot,risk:pos(c[slot]),rr};
 const cost=pos(p.tradeCost),reserve=Math.max(.01,pos(p.riskReserve));
 const floor=floorFor(p,ac);
 const available=Math.max(0,Math.min(
  ac.stagePnl-floor-cost-reserve,
  p.dailyLoss-dayProfit-cost-reserve));
 let desired=Math.max(0,c.target-ac.stagePnl);
 if(mode==='repair-r2'&&slot==='r3')desired=Math.max(0,(ac.repairAnchor??ac.stagePnl)-ac.stagePnl);
 const needed=Math.ceil((desired+cost)/rr*100)/100;
 const fraction=mode==='buffered-target'?.7:1;
 const cap=pos(c.dynamicMaxRisk??c[slot]);
 const risk=Math.max(0,Math.floor(Math.min(needed,cap,available*fraction)*100)/100);
 return {slot,risk,rr};
}
function makeAccount(i){return {
 id:i,stageIndex:0,stageDay:0,stageTrades:0,activeDays:0,adminDays:0,totalAdminDays:0,
 stagePnl:0,history:'',dailyProfit:0,dayProfits:[],peakEod:0,bestDay:0,
 status:'active',trades:0,qualificationTrades:0,wins:0,losses:0,firstPaid:0,
 purchaseDay:0,fundedActivatedDay:null,fundedFirstTradeDay:null,fundedTargetDay:null,payoutRequestedDay:null,paidDay:null,closedDay:null,
 grossProfit:0,grossLoss:0,winPnl:0,lossPnl:0,riskTotal:0,plannedReward:0,tradePnl:0,
 passes:[],totalR:0,realizedDD:0,peakPnl:0,blocked:0,
 repairSlot:'r1',repairAnchor:0,smartNext:'r1',
 fundedDays:0,fundedPositiveDays:0,funded150Days:0,trace:[]
};}
function newStage(ac){ac.stageDay=0;ac.stageTrades=0;ac.activeDays=0;ac.adminDays=0;ac.stagePnl=0;ac.history='';
 ac.dayProfits=[];ac.peakEod=0;ac.bestDay=0;ac.peakPnl=0;ac.realizedDD=0;ac.repairSlot='r1';ac.repairAnchor=0;ac.smartNext='r1';}
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
  const {slot,risk,rr:tradeRR,allIn=false}=chooseTradeRisk(p,ac,stage,c,dayProfit);
  if(c.policy?.mode==='smart-sequence'&&slot==='stop'){
   ac.status='strategy-stopped';ac.closedDay=day;
   if(record)ac.trace.push({day,stage,type:'strategy-stop',label:'Smart R1–R4 sequence stopped after terminal LOSS (account not necessarily breached)'});
   break;
  }
  // User-selected risk is always exact; no hidden downsizing.
  const dailyHeadroom=p.dailyLoss-dayProfit;
  const overallHeadroom=ac.stagePnl-floorFor(p,ac);
  const reserve=stage!=='funded'&&c.policy?.mode==='eval-recovery-burn'&&
   ac.history.endsWith('LL')?0:Math.max(.01,p.riskReserve);
  // Terminal R3 can waive ONLY overall reserve, never the daily allowance.
  const dailyPotential=risk+p.tradeCost+Math.max(.01,p.riskReserve);
  const overallPotential=risk+p.tradeCost+(allIn?0:reserve);
  // Firms permits R2–R4 = 0 to disable that path, not breach a loss limit.
  if(risk<.01&&slotLevels.includes(slot)&&pos(c[slot])<.01){
   ac.status='strategy-stopped';ac.closedDay=day;
   if(record)ac.trace.push({day,stage,type:'strategy-stop',slot,
    label:'Risk tier '+String(slot).toUpperCase()+' is off (0); route stopped, not a drawdown breach'});
   break;
  }
  if(risk<.01||dailyPotential>dailyHeadroom+1e-8||overallPotential>overallHeadroom+1e-8){
   ac.blocked++;
   const overallBlocked=risk<.01||overallPotential>overallHeadroom+1e-8;
   const impossibleDaily=Number.isFinite(p.dailyLoss)&&dailyPotential>p.dailyLoss+1e-8;
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
  const delta=(win?risk*tradeRR:-risk)-p.tradeCost;
  if(stage==='funded'&&ac.fundedFirstTradeDay===null)ac.fundedFirstTradeDay=day;
  const prior=ac.stagePnl;
  ac.stagePnl=money(ac.stagePnl+delta);dayProfit=money(dayProfit+delta);
  if(stage==='funded'&&ac.stagePnl>=c.target-.005&&ac.fundedTargetDay===null)
   ac.fundedTargetDay=day;
  ac.trades++;ac.stageTrades=(ac.stageTrades||0)+1;hadTrade=true;ac.totalR+=delta/risk;
  ac.grossProfit+=Math.max(0,delta);ac.grossLoss+=Math.max(0,-delta);
  ac.tradePnl+=delta;ac.riskTotal+=risk;ac.plannedReward+=risk*tradeRR;
  if(win){ac.wins++;winsToday++;ac.winPnl+=delta;}
  else{ac.losses++;ac.lossPnl+=delta;}
  // Preserve only recent outcome prefix for deterministic risk policy.
  ac.history=(ac.history+(win?'W':'L')).slice(-8);
  if(c.policy?.mode==='smart-sequence'){
   ac.smartNext=win?'r2':slot==='r1'?'r2':slot==='r2'?'r3':
    slot==='r3'&&c.r4>=.01?'r4':'stop';
  }
  // R3 repairs the R2 loss, then returns to R2 (not an automatic R1 reset).
  if(c.policy?.mode==='repair-r2'&&!qualificationTopstep&&!(p.id==='topstep'&&stage==='p1')){
   if(slot==='r1')ac.repairSlot=win?'r1':'r2';
   else if(slot==='r2'){
    if(!win){ac.repairAnchor=prior;ac.repairSlot='r3'}
    else ac.repairSlot=ac.stagePnl>=c.target-.005?'r1':'r2';
   }else if(slot==='r3')ac.repairSlot=win&&ac.stagePnl>=ac.repairAnchor-.005?'r2':'r3';
  }
  ac.peakPnl=Math.max(ac.peakPnl,ac.stagePnl);
  ac.realizedDD=Math.max(ac.realizedDD,ac.peakPnl-ac.stagePnl);
  if(record)ac.trace.push({day,stage,type:win?'win':'loss',slot,risk,rr:tradeRR,delta,pnl:ac.stagePnl,trade:ac.trades,
   policy:c.policy?.mode||'saved'});
  if(ac.stagePnl<=floorFor(p,ac)+1e-9 ||
     dayProfit<=-p.dailyLoss+1e-9){
   ac.status='failed';ac.closedDay=day;if(record)ac.trace.push({day,stage,type:'failed',label:'Modeled loss floor breached'});
   break;
  }
  if(!win){
   if(c.policy?.mode==='smart-sequence'&&ac.smartNext==='stop'){
    ac.status='strategy-stopped';ac.closedDay=day;
    if(record)ac.trace.push({day,stage,type:'strategy-stop',
     label:'Terminal risk tier LOST — strategy abandoned account (firm loss limit not necessarily breached)'});
   }
   break; // A loss closes this trading day; wins can continue.
  }
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
// Preflight the *next configured trade* against the account's live MLL.
// A risk-blocked account is NOT a breached Topstep account. Checking before
// purchases/routing prevents blocked accounts from consuming signal slots.
function nextRiskStatus(p,ac){
 if(!canAcceptSignal(p,ac))return null;
 const stage=stageName(p,ac),c=p.riskProfiles[stage];
 const useR3=p.id==='topstep'&&stage==='funded'&&
  ac.fundedTargetDay!==null&&ac.funded150Days<5;
 const {slot,risk,allIn}=chooseTradeRisk(p,ac,stage,c,0);
 if(c.policy?.mode==='smart-sequence'&&slot==='stop')return {strategyStop:true,slot,risk:0};
 // A deliberately disabled tier is a strategy stop, not a risk-floor breach.
 if(slotLevels.includes(slot)&&pos(c[slot])<.01)return {strategyStop:true,disabledTier:true,slot,risk:0};
 const cost=pos(p.tradeCost),reserve=Math.max(.01,pos(p.riskReserve));
 const overallRequired=risk+cost+(allIn?0:reserve);
 const dailyRequired=risk+cost+reserve;
 const available=ac.stagePnl-floorFor(p,ac);
 if(risk<.01||overallRequired>available+1e-8||dailyRequired>p.dailyLoss+1e-8)
  return {slot,risk,required:overallRequired,available};
 return null;
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
   live:liveCount(),burned:0,failed:0,riskBlocked:0,strategyStopped:0,opportunities:0,tradesToday:0,qualificationToday:0,unusedToday:0,...journeyCounts()}]:null;
 for(let day=1;day<=config.days;day++){
  const dailyOpportunities=config.tradeSchedule?config.tradeSchedule[day-1]:config.tradesPerDay;
  const tradesBefore=accounts.reduce((sum,ac)=>sum+ac.trades,0);
  const qualificationsBefore=accounts.reduce((sum,ac)=>sum+ac.qualificationTrades,0);
  // Close only the ability to trade at the configured tier; DO NOT record
  // a real MLL breach when the account still has a positive safety margin.
  for(const ac of accounts){
   if(ac.status!=='active')continue;
   const blocked=nextRiskStatus(p,ac);
   if(!blocked)continue;
   if(blocked.strategyStop){
    ac.status='strategy-stopped';ac.closedDay=day;
    if(record)ac.trace.push({day,stage:stageName(p,ac),type:'strategy-stop',
     label:blocked.disabledTier?'Configured risk tier '+String(blocked.slot).toUpperCase()+' is disabled (0); strategy stopped without a drawdown breach':'Smart strategy stopped at its terminal LOSS branch'});
    continue;
   }
   ac.status='exhausted';ac.closedDay=day;ac.blocked++;
   if(record)ac.trace.push({day,stage:stageName(p,ac),type:'blocked',
    risk:blocked.risk,slot:blocked.slot,headroom:blocked.available,
    label:'Risk tier too large for remaining drawdown: account not breached'});
  }
  let purchaseConstraint='No eligible account';
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
   if(needed>0){
    if(room<=0)purchaseConstraint='Active account capacity reached';
    else if(config.maxLifetime-accounts.length<=0)purchaseConstraint='Total account purchase cap reached';
    else if(dailyLimit<needed)purchaseConstraint='Daily purchase limit or account cap';
   }
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
  if(dynamic&&accounts.filter(ac=>canAcceptSignal(p,ac)).length<dailyOpportunities){
   if(evaluationCount()>=evaluationCap)purchaseConstraint='Evaluation allocation cap reached';
   else if(config.budget+(config.reinvestPayouts?receipts:0)-spent-reserved()+1e-8<p.fee+p.activationFee)purchaseConstraint='Insufficient available purchase budget';
  }
  // Signal slots are unique market opportunities. In copy modes the same
  // slot can reach multiple accounts; never treat copies as independent signals.
  const allocations=new Map();
  const eligible=accounts.filter(ac=>canAcceptSignal(p,ac));
  if(config.allocationMode==='cross-stage'||config.allocationMode==='limited'){
   const order=config.allocationPriority==='funded'?['funded','p2','p1']:
    config.allocationPriority==='phase2'?['p2','funded','p1']:['p1','p2','funded'];
   const rotated=eligible.length?eligible.slice(cursor%eligible.length).concat(eligible.slice(0,cursor%eligible.length)):[];
   for(let ix=0;ix<dailyOpportunities;ix++){
    const chosen=new Set();
    for(const stage of order){
     if(chosen.size>=Math.min(config.maxCopies||3,config.allocationMode==='limited'?2:3))break;
     const ac=rotated.find(a=>!allocations.has(a)&&stageName(p,a)===stage);
     if(ac){allocations.set(ac,ix);chosen.add(stage);}
    }
   }
   if(eligible.length)cursor=(cursor+dailyOpportunities)%eligible.length;
  }else{
   for(let ix=0;ix<dailyOpportunities&&ix<eligible.length;ix++){
    const index=(cursor+ix)%eligible.length;
    allocations.set(eligible[index],ix);
   }
   if(eligible.length)cursor=(cursor+Math.min(dailyOpportunities,eligible.length))%eligible.length;
  }
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
     outcome:'Unused',status:purchaseConstraint});
  }
  if(dailyCash){
   const tradesToday=accounts.reduce((sum,ac)=>sum+ac.trades,0)-tradesBefore;
   const qualificationToday=accounts.reduce((sum,ac)=>sum+ac.qualificationTrades,0)-qualificationsBefore;
   // Signals are portfolio-wide in BOTH purchase modes: buying 50 accounts
   // does not create 50 times as many daily signal opportunities.
   const opportunities=dailyOpportunities;
   dailyCash.push({day,spent,receipts,net:receipts-spent,paid,
    bought,challengeSpent,activationSpent,live:liveCount(),
    opportunities,tradesToday,qualificationToday,unusedToday:Math.max(0,opportunities-new Set([...allocations.values()]).size),
    burned:accounts.filter(a=>a.status==='failed'||a.status==='exhausted'||a.status==='strategy-stopped').length,
    failed:accounts.filter(a=>a.status==='failed').length,
    riskBlocked:accounts.filter(a=>a.status==='exhausted').length,
    strategyStopped:accounts.filter(a=>a.status==='strategy-stopped').length,
    ...journeyCounts()});
  }
 }
 const passes=p.stageList.filter(x=>x!=='funded').map(stage=>accounts.filter(x=>x.passes.some(y=>y.stage===stage)).length);
 // Evaluation passes waiting for a funded slot are not counted as activated.
 const funded=activations;
 const exhausted=accounts.filter(x=>x.status==='exhausted').length;
 const failed=accounts.filter(x=>x.status==='failed').length;
 const strategyStopped=accounts.filter(x=>x.status==='strategy-stopped').length;
 const pending=accounts.filter(x=>['active','activation-wait','payout-pending'].includes(x.status)).length;
 // Elapsed TRADING days from purchase; observed only for completed milestones.
 const timing={p1:{count:0,days:0},p2:{count:0,days:0},funded:{count:0,days:0},paid:{count:0,days:0}};
 for(const ac of accounts){
  const start=Math.max(1,ac.purchaseDay||1);
  const add=(key,day)=>{if(day==null)return;timing[key].count++;timing[key].days+=Math.max(1,day-start+1)};
  for(const pass of ac.passes)if(pass.stage==='p1'||pass.stage==='p2')add(pass.stage,pass.day);
  add('funded',ac.fundedActivatedDay);
  add('paid',ac.paidDay);
 }
 const net=receipts-spent;
 return {bought,paid,passes,funded,failed,exhausted,strategyStopped,pending,spent,receipts,net,activations,
    targetHit:accounts.filter(a=>a.fundedTargetDay!==null).length,
    payoutRequested:accounts.filter(a=>a.payoutRequestedDay!==null).length,
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
   timing,
   tradeAssignments:tradeAssignments?.sort((a,b)=>a.day-b.day||a.signal-b.signal)||undefined,
   firstPayoutDay:accounts.filter(a=>a.paidDay!=null).reduce((m,a)=>Math.min(m,a.paidDay),Infinity),
   goalPayoutDay:dailyCash?.find(d=>d.paid>=(config.requiredPayouts||Infinity)&&d.net>=(config.netGoal||Infinity))?.day??Infinity,
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
  signalMode:config.signalMode==='shared'||config.allocationMode==='cross-stage'||config.allocationMode==='limited'?'shared':'independent',
  allocationMode:['cross-stage','limited'].includes(config.allocationMode)?config.allocationMode:'single',
  maxCopies:clamp(config.maxCopies||3,1,5)|0,
  allocationPriority:['balanced','funded','phase2'].includes(config.allocationPriority)?config.allocationPriority:'balanced',
  trackDaily:config.trackCharts===true,
  tradeSchedule:Array.isArray(config.tradeSchedule)&&config.tradeSchedule.length===
   (clamp(config.days,1,120)|0)?config.tradeSchedule.map(x=>clamp(x,0,20)|0):null,
  purchaseMode:config.purchaseMode==='recycle'?'recycle':'upfront',
  capacityMode:config.capacityMode==='manual'?'manual':'automatic',
  maxActive:clamp(Math.floor(config.maxActive||1),1,100)|0,
  maxBuysPerDay:clamp(Math.floor(config.maxBuysPerDay||1),1,20)|0,
  maxLifetime:clamp(Math.floor(config.maxAccounts||100),1,100)|0,
  budget,requiredPayouts:Math.max(0,Math.floor(config.requiredPayouts||0)),netGoal:pos(config.netGoal),
  reinvestPayouts:config.reinvestPayouts===true
 };
 const results=[],stageTotals=p.stageList.filter(x=>x!=='funded').map(()=>0);
 const total={bought:0,paid:0,funded:0,targetHit:0,payoutRequested:0,failed:0,exhausted:0,strategyStopped:0,pending:0,spent:0,receipts:0,net:0,activations:0,trades:0,qualifying:0,qualificationTrades:0,
  wins:0,losses:0,grossProfit:0,grossLoss:0,winPnl:0,lossPnl:0,riskTotal:0,plannedReward:0,totalR:0,tradePnl:0};
 const rand=rngFactory(settings.seed);
 const chartTrials=settings.trackDaily?[]:null;
 const chartSums=settings.trackDaily?Array.from({length:settings.days+1},
  (_,day)=>({day,spent:0,receipts:0,net:0,paid:0,bought:0,challengeSpent:0,activationSpent:0,live:0,burned:0,failed:0,riskBlocked:0,strategyStopped:0,
   challenge:0,verification:0,fundedActive:0,fundingWait:0,payoutPending:0,targetHit:0,activated:0,passed1:0,passed2:0,
   opportunities:0,tradesToday:0,qualificationToday:0,unusedToday:0})):null;
 let withPayout=0,positiveNet=0,goalMet=0, sample=null;
 let firstDayTotal=0,firstDayCount=0,goalDayTotal=0,goalDayCount=0;
 const timingTotals={p1:{count:0,days:0},p2:{count:0,days:0},funded:{count:0,days:0},paid:{count:0,days:0}};
 const goal=pos(config.netGoal);
 for(let k=0;k<trials;k++){
  const x=oneTrial(p,{...settings,trialIndex:k},rand,k===0);
  if(k===0)sample=x;
  for(const key of Object.keys(timingTotals))for(const part of ['count','days'])timingTotals[key][part]+=x.timing[key][part];
  if(Number.isFinite(x.firstPayoutDay)){firstDayTotal+=x.firstPayoutDay;firstDayCount++}
  if(Number.isFinite(x.goalPayoutDay)){goalDayTotal+=x.goalPayoutDay;goalDayCount++}
  if(chartTrials)chartTrials.push({
   net:x.net,spent:x.spent,receipts:x.receipts,roi:x.spent?x.net/x.spent:0,
   paid:x.paid,failed:x.failed,exhausted:x.exhausted,strategyStopped:x.strategyStopped,funded:x.funded,
   wins:x.wins,losses:x.losses,trades:x.trades,passes:x.passes.slice()
  });
  if(chartSums)for(const d of x.dailyCash||[]){
   const sum=chartSums[d.day];
   for(const key of ['spent','receipts','net','paid','bought','challengeSpent','activationSpent','live','burned','failed','riskBlocked','strategyStopped','challenge','verification','fundedActive',
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
  avgFirstPayoutDay:firstDayCount?firstDayTotal/firstDayCount:null,
  timeFromPurchase:Object.fromEntries(Object.entries(timingTotals).map(([key,t])=>[key,{
   completed:t.count/trials,meanTradingDays:t.count?t.days/t.count:null}])),
  avgGoalPayoutDay:goalDayCount?goalDayTotal/goalDayCount:null,
  chanceGoalPayoutDay:goalDayCount/trials,
  median:quantile(nets,.5),p10:quantile(nets,.1),p90:quantile(nets,.9),
  sample,nets,chartTrials,
  cashCurve:chartSums?.map(d=>({day:d.day,spent:d.spent/trials,
   receipts:d.receipts/trials,net:d.net/trials,paid:d.paid/trials,
   bought:d.bought/trials,challengeSpent:d.challengeSpent/trials,
   activationSpent:d.activationSpent/trials,live:d.live/trials,burned:d.burned/trials,failed:d.failed/trials,riskBlocked:d.riskBlocked/trials,
   strategyStopped:d.strategyStopped/trials,
   challenge:d.challenge/trials,verification:d.verification/trials,fundedActive:d.fundedActive/trials,
   fundingWait:d.fundingWait/trials,payoutPending:d.payoutPending/trials,targetHit:d.targetHit/trials,activated:d.activated/trials,
   passed1:d.passed1/trials,passed2:d.passed2/trials,
   opportunities:d.opportunities/trials,tradesToday:d.tradesToday/trials,qualificationToday:d.qualificationToday/trials,
   unusedToday:d.unusedToday/trials}))||null
 };
}
// Expected phase conversions are ratios of aggregate account counts across
// trials, NOT a probability that a particular late-purchased account can finish
// all stages within the chosen horizon.
function stageFunnel(result,useSample=false){
 const p=result?.plan;
 if(!p)return [];
 const source=useSample?result.sample:result.avg;
 if(!source)return [];
 const purchased=pos(source.bought);
 const passes=useSample?source.passes||[]:result.stages||[];
 const labels=p.id==='topstep'?['Trading Combine passed']:['ftmo2','holaPrime','holaPro'].includes(p.id)?
  ['Challenge passed','Verification passed']:['Challenge passed'];
 const stages=[{label:'Purchased challenges',count:purchased}];
 for(let i=0;i<passes.length;i++)
  stages.push({label:labels[i]||('Evaluation '+(i+1)+' passed'),count:pos(passes[i])});
 stages.push({label:p.id==='topstep'?'Express Funded activated':'Funded activated',count:pos(source.funded)});
 stages.push({label:'Funded profit target reached',count:pos(source.targetHit)});
 stages.push({label:'Payout requested',count:pos(source.payoutRequested)});
 stages.push({label:'First payout received',count:pos(source.paid)});
 return stages.map((stage,i)=>{
  const previous=i?stages[i-1].count:null;
  return {...stage,previousRate:i?(previous>0?stage.count/previous:null):null,
   totalRate:purchased>0?stage.count/purchased:null};
 });
}
// Preview consecutive losing trades using the SAME sizing function as
// live Monte Carlo. Each preview trade occurs on a separate trading day;
// figures are hypothetical risk amounts, not the sample's actual outcomes.
function previewLossPath(p,stage,steps=3){
 const cfg=p.riskProfiles?.[stage];if(!cfg)return [];
 const ac={stagePnl:0,stageTrades:0,history:'',repairSlot:'r1',repairAnchor:0,smartNext:'r1',
  peakEod:0,fundedTargetDay:null,funded150Days:0};
 const arr=[];
 for(let i=0;i<steps;i++){
  const prior=ac.stagePnl;
  const selected=chooseTradeRisk(p,ac,stage,cfg,0);
  const risk=selected.risk;
  const cost=pos(p.tradeCost),reserve=cfg.policy?.mode==='eval-recovery-burn'&&ac.history.endsWith('LL')?
   0:Math.max(.01,pos(p.riskReserve));
  const floor=floorFor(p,ac);
  const requiredOverall=risk+cost+(selected.allIn?0:reserve);
  const requiredDaily=risk+cost+Math.max(.01,pos(p.riskReserve));
  const allowed=selected.slot!=='stop'&&risk>=.01&&
   requiredOverall<=ac.stagePnl-floor+1e-8&&requiredDaily<=p.dailyLoss+1e-8;
  arr.push({step:i+1,slot:selected.slot,risk:allowed?risk:0,
   calculatedRisk:risk,allowed,before:prior,after:allowed?prior-risk-cost:prior});
  if(!allowed)break;
  ac.stagePnl=prior-risk-cost;ac.stageTrades++;
  ac.history=(ac.history+'L').slice(-8);
  if(cfg.policy?.mode==='smart-sequence')
   ac.smartNext=selected.slot==='r1'?'r2':selected.slot==='r2'?'r3':
    selected.slot==='r3'&&cfg.r4>0?'r4':'stop';
  if(cfg.policy?.mode==='repair-r2'){
   if(selected.slot==='r1')ac.repairSlot='r2';
   else if(selected.slot==='r2'){ac.repairAnchor=prior;ac.repairSlot='r3'}
   else ac.repairSlot='r3';
  }
 }
 return arr;
}
// Deterministic, single-funded-account WHAT-IF, using actual runAccountDay
// and the identical risk/loss/payout rules as Monte Carlo. A letter is a
// requested forced signal outcome, not a guaranteed executed trade.
function previewFundedPath(p,outcomes){
 const ac=makeAccount(1);
 ac.stageIndex=p.stageList.indexOf('funded');
 if(ac.stageIndex<0)throw Error('Funded stage is unavailable');
 ac.fundedActivatedDay=1;
 const rows=[];
 for(let i=0;i<outcomes.length;i++){
  const outcome=String(outcomes[i]).toUpperCase();
  if(outcome!=='W'&&outcome!=='L')continue;
  const before=ac.stagePnl,priorTradeCount=ac.trades,day=i+1;
  const phase=p.riskProfiles.funded;
  const planned=chooseTradeRisk(p,ac,'funded',phase,0);
  runAccountDay(p,ac,day,()=>outcome==='W'?0:1,
   {tradesPerDay:1,winRate:.5,tradeSlots:[0]},true);
  const event=ac.trace.filter(e=>(e.type==='win'||e.type==='loss')&&e.day===day).at(-1);
  const blocked=ac.trace.filter(e=>e.type==='blocked'&&e.day===day).at(-1);
  rows.push({
   day,outcome,executed:ac.trades>priorTradeCount,
   risk:event?event.risk:planned.risk,
   rr:event?event.rr:planned.rr,before,after:ac.stagePnl,
   status:ac.status,blocked:!!blocked,
   note:event?(event.type==='win'?'Win':'Loss'):
    blocked?blocked.label:
    ac.stagePnl>=phase.target-.005?'Funded target reached; trading held':
    ac.status==='payout-pending'||ac.status==='paid'?'Payout processing':'No trade',
   milestone:ac.stagePnl>=450-.005?(ac.stagePnl>=7200-.005?'$7200':ac.stagePnl>=1800-.005?'$1800':'$450'):''
  });
  if(ac.status==='failed'||ac.status==='exhausted'||ac.status==='invalid')break;
 }
 return rows;
}
root.StudioPortfolioEngine={buildPlan,validatePlan,resolvePolicy,plannedSlot,
  runAccountDay,simulatePortfolio,rngFactory,phasesFor,supported,oneTrial,stageFunnel,previewLossPath,previewFundedPath};
})(typeof window!=='undefined'?window:globalThis);