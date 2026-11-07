/* Weekly first-payout cash-flow summary. Does not alter trading risk or outcome rules. */
(function(root){
'use strict';
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const between=(n,min,max)=>Math.max(min,Math.min(max,Math.floor(num(n))));
const WEEKLY20=[3,4,5,4,4];
function schedule(days,pace,daily){
 const count=between(days,1,120),fixed=between(daily,1,20);
 return Array.from({length:count},(_,i)=>pace==='weekly20'?WEEKLY20[i%5]:fixed);
}
function summarize(result){
 if(!result||!result.config||!result.avg)return null;
 const c=result.avg,days=between(result.config.days,1,120);
 const curve=result.cashCurve||[];
 const weeks=[];
 for(let start=0;start<days;start+=5){
  const end=Math.min(days,start+5),before=curve[start],after=curve[end];
  if(!before||!after)continue;
  weeks.push({
   week:Math.floor(start/5)+1,fromDay:start+1,toDay:end,
   opportunities:curve.slice(start+1,end+1).reduce((s,x)=>s+num(x.opportunities),0),
   trades:curve.slice(start+1,end+1).reduce((s,x)=>s+num(x.tradesToday),0),
   bought:num(after.bought)-num(before.bought),
   challengePasses:num(after.passed1)-num(before.passed1),
   verificationPasses:num(after.passed2)-num(before.passed2),
   funded:num(after.activated)-num(before.activated),
   paid:num(after.paid)-num(before.paid),
   spent:num(after.spent)-num(before.spent),
   receipts:num(after.receipts)-num(before.receipts),
   net:num(after.net)-num(before.net),
   cumulativeNet:num(after.net)
  });
 }
 const bought=num(c.bought),paid=num(c.paid),spent=num(c.spent),p1=num(result.stages?.[0]),p2=num(result.stages?.[1]);
 return {
  weeks,dayCount:days,
  // A finite-horizon cohort conversion, NOT lifetime payout probability.
  conversion:bought>0?paid/bought:null,
  phase1Conversion:bought>0?p1/bought:null,
  phase2Conversion:p1>0?p2/p1:null,
  paidPerFunded:num(c.funded)>0?paid/num(c.funded):null,
  costPerPaid:paid>0?spent/paid:null,
  feePerPurchased:bought>0?spent/bought:null,
  netPerPurchased:bought>0?num(c.net)/bought:null,
  netPerWeek:num(c.net)/(days/5),
  firstPayoutDay:result.avgFirstPayoutDay==null?null:num(result.avgFirstPayoutDay),
  chanceAnyPayout:result.chancePayout==null?null:num(result.chancePayout),
  totalSignals:weeks.reduce((s,w)=>s+w.opportunities,0)
 };
}
root.StudioWeeklyEconomics={schedule,summarize,WEEKLY20:WEEKLY20.slice()};
})(typeof window!=='undefined'?window:globalThis);
