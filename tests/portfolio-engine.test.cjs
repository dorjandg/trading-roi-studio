/* Deterministic, read-only simulation regression tests. Run: node tests/portfolio-engine.test.cjs */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const sandbox={console,globalThis:null};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('portfolio-engine.js','utf8'),sandbox,{filename:'portfolio-engine.js'});
const engine=sandbox.StudioPortfolioEngine;
assert(engine,'Engine must export StudioPortfolioEngine');
function plan(id){
 return {id,size:id==='topstep'?50000:10000,fee:49,refund:0,split:.5,
  activationFee:0,tradeCost:0,riskReserve:50,dailyLoss:Infinity,overallLoss:2000,
  drawdownKind:'eod-trailing',fundedWaitDays:0,payoutProcessingTradingDays:10,
  fundedMaxActive:5,stageList:['p1','funded'],riskProfiles:{
   p1:{target:3000,minDays:2,maxWinsPerDay:2,maxDays:24,rr:3,r1:500,r2:667,r3:389,r4:0,policy:{mode:'flat'},consistency:.55},
   funded:{target:4000,minDays:0,maxWinsPerDay:2,maxDays:20,rr:4,r1:1000,r2:1000,r3:0,r4:0,policy:{mode:'flat'},consistency:0}
  }};
}
function account(){
 return {id:1,stageIndex:1,stageDay:0,stageTrades:0,activeDays:0,adminDays:0,totalAdminDays:0,
 stagePnl:0,history:'',dailyProfit:0,dayProfits:[],peakEod:0,bestDay:0,
 status:'active',trades:0,qualificationTrades:0,wins:0,losses:0,firstPaid:0,everTargetHit:false,
 everPayoutRequested:false,everPaid:false,payoutCycles:0,purchaseDay:0,fundedActivatedDay:0,
 fundedFirstTradeDay:null,fundedTargetDay:null,payoutRequestedDay:null,paidDay:null,closedDay:null,
 grossProfit:0,grossLoss:0,winPnl:0,lossPnl:0,riskTotal:0,plannedReward:0,tradePnl:0,
 passes:[],totalR:0,realizedDD:0,peakPnl:0,blocked:0,repairSlot:'r1',repairAnchor:0,
 smartNext:'r1',fundedDays:0,fundedPositiveDays:0,funded150Days:0,trace:[]};
}
const p=plan('topstep'),a=account(),config={tradesPerDay:1,winRate:.35,tradeSlots:[0]};
engine.runAccountDay(p,a,1,()=>0,config,true);
assert.equal(a.stagePnl,4000,'First funded win should reach $4000');
assert.equal(a.trades,1);
assert.equal(a.status,'payout-pending','Target must immediately freeze funded trading');
assert.equal(a.payoutRequestedDay,1);
assert.equal(a.firstPaid,2000,'Payout uses 50% of $4000');
for(let day=2;day<=10;day++)engine.runAccountDay(p,a,day,()=>0,config,true);
assert.equal(a.trades,1,'No trades while payout is pending');
assert.equal(a.status,'payout-pending');
const paid=engine.runAccountDay(p,a,11,()=>0,config,true);
assert.equal(a.status,'paid');
assert.equal(paid.paid,true);
assert.equal(a.paidDay,11);
assert.equal(a.trace.filter(x=>x.type==='strategy-stop').length,0,'Disabled R3 cannot stop a target-hit account');
console.log('PASS: Topstep target lock, disabled R3, frozen trading, 10-day payout and $2000 receipt');
