/* Optional FTMO auto mode for JJ × FTMO KPIs.
   Reads current browser's saved Firms settings; runs the existing Portfolio Simulator engine.
   Pure display override: does not mutate Firms settings, account risk, or persistent storage. */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
const A=root.StudioJjFtmoAuto;
const E=root.StudioPortfolioEngine;
const W=root.StudioWeeklyEconomics;
let active=false,savedSourceSnapshot='';
const cash=x=>Number.isFinite(x)?x.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}):'—';
const pct=x=>Number.isFinite(x)?(x*100).toFixed(1)+'%':'—';
const amount=x=>Number.isFinite(x)?x.toFixed(1):'—';
const mult=x=>Number.isFinite(x)?x.toFixed(2)+'×':'—';
const ev=(w,r)=>Number.isFinite(w)&&Number.isFinite(r)&&r>0?(w*r-(1-w)):NaN;
const formatR=x=>Number.isFinite(x)?(x>=0?'+':'')+x.toFixed(2)+'R':'—';
function sourceSnapshot(){
 const u=localStorage.getItem('4ds:active-user:v1')||'dori';
 const p='4ds:v1:'+u+':',a='ftmo2:10000';
 return JSON.stringify([u,localStorage.getItem(p+'studio-account-profile-v1:'+a),
 localStorage.getItem(p+'ftmo-roi-studio-v1'),localStorage.getItem(p+'studio-active-profile-v1'),
 ...['p1','p2','funded'].map(stage=>localStorage.getItem('4ds:recovery-planner:v2:'+u+':'+a+':'+stage))]);
}
function displayMode(mode,message){
 $('autoModeLabel').textContent=mode;
 $('autoManual').hidden=!active;
 if(message)$('autoStatus').textContent=message;
}
function manual(message){
 const wasActive=active;
 active=false;savedSourceSnapshot='';
 $('autoTimings').hidden=true;
 // The original input listener re-renders ALL manual KPI cards, source and detail rows.
 if(wasActive&&$('ftP1'))$('ftP1').dispatchEvent(new Event('input',{bubbles:false}));
 displayMode('Manual assumptions',message||'Manual scenario restored. Firms settings unchanged.');
}
function setText(id,value){const el=$(id);if(el)el.textContent=value;}
function showAuto(r,m,wr,pace,planWarnings){
 active=true;
 const k={
 ftPass:pct(m.pass),ftHit:pct(m.hit),ftFundedPaid:pct(m.fundedPaid),ftPaid:pct(m.payout),
 ftmoCost:cash(m.costFunded),ftCostPaid:cash(m.costPaid),ftCashFunded:cash(m.payoutPerFunded),
 ftEV:cash(m.netPerEval),ftFundedCount:amount(m.fundedCount),ftPaidCount:amount(m.paidCount),
 ftCash:cash(m.cash),ftFees:cash(m.cost),ftNet:cash(m.net),ftmoROI:pct(m.roi),
 ftGrossMultiple:mult(m.multiple),ftNetWeek:cash(m.netPerWeek),
 ftEvalWRCard:pct(m.tradeWinRate),ftFundedWRCard:pct(m.tradeWinRate),
 ftEvalTradeEV:formatR(ev(m.tradeWinRate,m.stageRiskProfiles?.p1?.rr)),
 ftFundedTradeEV:formatR(ev(m.tradeWinRate,m.stageRiskProfiles?.funded?.rr))
 };
 for(const [id,val] of Object.entries(k))setText(id,val);
 // Update the FTMO column of the existing detailed table, avoiding duplicated calculations.
 const rows=$('comparisonRows')?.querySelectorAll('tr')||[];
 const p=r.plan,phase=p.riskProfiles||{};
 const values={
 'Purchases in cohort':amount(m.cohortBought),
 'Evaluation → funded':pct(m.pass),
 'Cost per funded account':cash(m.costFunded),
 'Funded → milestone':pct(m.hit),
 'Milestone → eligible cash':pct(m.realize),
 'Purchase → first cash payout':pct(m.payout),
 'Funded accounts · expected':amount(m.fundedCount),
 'Accounts with first payout · expected':amount(m.paidCount),
 'Cost per first payout event':cash(m.costPaid),
 'Cash receipts / funded account':cash(m.payoutPerFunded),
 'All cash expenses':cash(m.cost),
 'Cash received incl. first fee refund':cash(m.cash),
 'Net cash profit':cash(m.net),
 'Net EV per evaluation purchased':cash(m.netPerEval),
 'Gross cash / expense multiple':mult(m.multiple),
 'Net ROI on cash expenses':pct(m.roi),
 'Net cash per calendar week (if entered)':cash(m.netPerWeek),
 'Evaluation break-even trade WR':pct(1/(1+(phase.p1?.rr||3))),
 'Evaluation trade EV':formatR(ev(m.tradeWinRate,phase.p1?.rr)),
 'Funded break-even trade WR':pct(1/(1+(phase.funded?.rr||4))),
 'Funded trade EV':formatR(ev(m.tradeWinRate,phase.funded?.rr))
 };
 rows.forEach(row=>{
  const cells=row.querySelectorAll('td');
  if(cells.length!==3)return;
  const key=cells[0].textContent.trim();
  if(Object.prototype.hasOwnProperty.call(values,key))cells[2].textContent=values[key];
 });
 const timings=m.timeFromPurchase||{};
 const days=k=>{
  const d=timings[k]?.meanTradingDays;
  return Number.isFinite(d)?d.toFixed(1)+'d':'—';
 };
 $('autoTimings').textContent='P1 pass '+pct(m.phase1)+' · P2 conditional '+pct(m.phase2)+
  ' · Mean trading days after purchase (completed milestones only): P1 '+days('p1')+
  ', P2 '+days('p2')+', funded '+days('funded')+', paid '+days('paid')+'.';
 $('autoTimings').hidden=false;
 $('cohortDescription').textContent='JJ uses manual research estimates. FTMO uses the same Monte Carlo and saved Firms strategy as Portfolio Simulator: '+
  amount(m.cohortBought)+' purchased, '+amount(m.fundedCount)+' funded, '+amount(m.paidCount)+
  ' first paid on average within '+r.config.days+' trading days. Unfinished accounts are included in costs.';
 displayMode('AUTO · saved FTMO',r.config.trials+' trials · '+r.config.days+' trading days · '+wr+'% shared WR · '+
  (pace==='weekly20'?'20 signals/week':'4 signals/day')+'. Finite-horizon estimates—not verified historical pass rates.'+
  (planWarnings.length?' Plan notes: '+planWarnings.slice(0,2).join(' · '):''));
}
async function run(){
 const button=$('autoRun');
 if(!A||!E||!W){displayMode('Manual assumptions','Auto engine unavailable. Refresh the page.');return;}
 button.disabled=true;
 $('autoStatus').textContent='Calculating saved FTMO risk stages and account paths…';
 await new Promise(resolve=>setTimeout(resolve,20));
 try{
  const user=localStorage.getItem('4ds:active-user:v1')||'dori';
  const response=await fetch('prop-firm-rules.json',{cache:'no-store'});
  if(!response.ok)throw Error('FTMO rules catalog could not load.');
  const catalog=await response.json();
  let audit=null;
  try{
   const a=await fetch('prop-firm-official-audit.json',{cache:'no-store'});
   if(a.ok)audit=await a.json();
  }catch(_){}
  const {plan,warnings}=A.savedPlan(localStorage,user,catalog.programs?.ftmo2,audit?.programs?.ftmo2,E);
  const pace=$('autoPace').value,wr=Number($('autoWR').value);
  const {result,model}=A.simulate(E,W,{plan,count:Number($('count').value),days:Number($('autoDays').value),
   trials:Number($('autoTrials').value),winRate:wr,
   signalsMode:pace==='weekly20'?'weekly20':'daily',signalsPerDay:4,seed:24717});
  savedSourceSnapshot=sourceSnapshot();
  showAuto(result,model,wr,pace,warnings);
 }catch(err){
  manual('Auto FTMO unavailable: '+(err?.message||String(err))+'. Manual results remain displayed.');
 }finally{button.disabled=false;}
}
$('autoRun')?.addEventListener('click',run);
$('autoManual')?.addEventListener('click',()=>manual());
for(const id of ['autoWR','autoDays','autoPace','autoTrials','count']){
 $(id)?.addEventListener('input',()=>{
  if(active)manual('Auto result became stale after input changes. Run Auto FTMO again.');
 });
 $(id)?.addEventListener('change',()=>{
  if(active)manual('Auto result became stale after input changes. Run Auto FTMO again.');
 });
}
for(const id of ['ftFee','ftP1','ftP2','ftFunded','ftRealize','ftPayout','ftSplit','ftRefund','ftActivation','ftEvalWR','ftFundedWR','ftFundedRR']){
 $(id)?.addEventListener('input',()=>{
  if(active)manual('Switched to manual FTMO assumptions after editing its parameters.');
 });
}
// Inputs from either strategy can trigger the legacy manual renderer. Never retain an
// AUTO badge over values that have been returned to manual by any on-page edit.
document.querySelectorAll('input').forEach(function(el){
 el.addEventListener('input',function(){
  if(active)manual('Manual input changed. Re-run Auto FTMO for a new linked result.');
 });
});
for(const id of ['jjPlanning','jjReported','ftReset']){
 $(id)?.addEventListener('click',function(){if(active)manual('Preset changed; Auto FTMO must be run again.');});
}
function checkSourceFresh(){
 if(active&&savedSourceSnapshot&&sourceSnapshot()!==savedSourceSnapshot)
  manual('Saved FTMO profile changed. Auto FTMO must be run again.');
}
root.addEventListener?.('focus',checkSourceFresh);
root.addEventListener?.('pageshow',checkSourceFresh);
root.addEventListener?.('storage',checkSourceFresh);
root.StudioJjFtmoAutoController={run,manual};
})(typeof window!=='undefined'?window:globalThis);
