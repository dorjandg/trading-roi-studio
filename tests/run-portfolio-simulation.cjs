#!/usr/bin/env node
/* Offline, read-only Portfolio Simulator runner.
   node tests/run-portfolio-simulation.cjs --fixture
   node tests/run-portfolio-simulation.cjs --input /path/to/authorized-export.json
   No network calls, cloud writes, browser storage, or strategy mutations.
*/
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const args=process.argv.slice(2);
const sandbox={console};sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../portfolio-engine.js'),'utf8'),sandbox);
const engine=sandbox.StudioPortfolioEngine;
if(!engine?.oneTrial)throw Error('Portfolio engine is unavailable');
function fixture(){
 return {schema:'4ds-offline-simulation-v1',label:'Synthetic Topstep regression fixture (NOT user history)',
 plan:{id:'topstep',size:50000,fee:49,refund:0,split:.5,activationFee:0,
  tradeCost:0,riskReserve:50,dailyLoss:Infinity,overallLoss:2000,
  drawdownKind:'eod-trailing',fundedMaxActive:5,stageList:['p1','funded'],
  fundedWaitDays:0,payoutProcessingTradingDays:10,
  riskProfiles:{
   p1:{target:3000,minDays:2,maxWinsPerDay:2,maxDays:24,rr:3,r1:500,r2:667,r3:389,r4:0,policy:{mode:'flat'},consistency:.55},
   funded:{target:4000,minDays:0,maxWinsPerDay:2,maxDays:20,rr:4,r1:1000,r2:1000,r3:0,r4:0,policy:{mode:'flat'},consistency:0}}},
 config:{count:5,budget:245,days:45,tradesPerDay:5,winRate:100,seed:24717,
  purchaseMode:'upfront',capacityMode:'manual',maxActive:5,maxBuysPerDay:5,
  evaluationAllocationCap:0,fundedAllocationCap:0,trackDaily:true,
  signalMode:'independent',allocationMode:'single',maxCopies:1,
  allocationPriority:'balanced',pairedSignals:false,recycleFundedPayouts:false}};
}
function run(data){
 if(data?.schema!=='4ds-offline-simulation-v1')throw Error('Expected 4ds-offline-simulation-v1 input');
 const p=JSON.parse(JSON.stringify(data.plan),(key,value)=>value==='__INFINITY__'?Infinity:value),c=data.config;
 if(!p||!c||!Array.isArray(p.stageList)||!p.riskProfiles?.funded)throw Error('Missing complete plan or funded risk');
 if(!['topstep','ftmo2','hola','holaPrime'].includes(p.id))throw Error('Unknown firm id');
 if(!(c.days>=1&&c.days<=120&&c.tradesPerDay>=1&&c.tradesPerDay<=20&&Number(c.budget)>0))throw Error('Simulation dimensions out of range');
 const trials=Math.min(3000,Math.max(50,Math.floor(c.trials||300)));
 // Run through the same normalization and Monte Carlo path as the website.
 const result=engine.simulatePortfolio(p,{...c,trials,trackCharts:true});
 const avg=result.avg||{};
 const keys=['bought','funded','targetHit','payoutRequested','paid','receipts','spent','net','strategyStopped','exhausted'];
 const averages=Object.fromEntries(keys.map(k=>[k,Number(avg[k]||0)]));
 const report={schema:'4ds-offline-simulation-report-v1',source:data.label||'Authorized offline input',
  firm:p.id,trials,config:{days:c.days,tradesPerDay:c.tradesPerDay,seed:c.seed||24717},
  averages,firstTrial:{funded:result.sample?.funded||0,targetHit:result.sample?.targetHit||0,
   payoutRequested:result.sample?.payoutRequested||0,paid:result.sample?.paid||0,
   payoutEvents:result.sample?.accounts?.flatMap(a=>(a.trace||[]).filter(t=>['payout-request','paid','strategy-stop'].includes(t.type)).map(t=>({account:a.id,...t}))).slice(0,30)||[]}};
 return report;
}
function fromSavedHistory(history){
 const record=Array.isArray(history)?history.slice().sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||'')))[0]:history;
 if(record?.schema!=='4ds-portfolio-simulation-v1'||!Array.isArray(record.firms))throw Error('Expected saved 4Ds simulation history record');
 return {schema:'4ds-offline-simulation-bundle-v1',cases:record.firms.map((f,index)=>{
  const caps=f.caps||{},inputs=record.inputs||{};
  const plan={id:f.programId,firm:f.firm,programName:f.programName,size:f.accountSize,
   fee:caps.fee||0,refund:0,split:caps.split??.5,activationFee:Number(caps.activationFee||0),
   tradeCost:caps.tradeCost||0,riskReserve:caps.reserve??50,
   dailyLoss:caps.dailyLoss??Infinity,overallLoss:caps.overallLoss,
   drawdownKind:caps.drawdownKind,fundedMaxActive:caps.fundedMaxActive??Infinity,
   stageList:['p1','p2','funded'].filter(stage=>f.risk?.[stage]),
   riskProfiles:f.risk,fundedWaitDays:caps.fundedWaitDays||0,
   payoutProcessingTradingDays:f.programId==='topstep'?10:(caps.payoutProcessingTradingDays??3)};
  if(f.programId==='topstep'){
   plan.refund=0;plan.split=.5;plan.fundedWaitDays=0;
   plan.payoutWaitCalendarDays=0;plan.payoutProcessingCalendarDays=14;
   plan.fundedTarget=Number(f.risk?.funded?.target||4000);
  }
  const row=record.accounts?.find(x=>x.id===f.programId&&Number(x.size)===Number(f.accountSize));
  const allocation=inputs.budgetMode==='split'?Number(row?.weight||0)/100:1;
  const config={...inputs,maxAccounts:100,
   budget:Number(f.budget??inputs.budget*allocation),
   seed:Number(inputs.seed||24717)+index*120011,
   trials:inputs.trials||300,days:inputs.days||90,
   winRate:Number(inputs.winRate||35),
   maxLifetime:100,tradeSlots:null,trackDaily:true,
   maxActive:inputs.maxActive||20,maxBuysPerDay:inputs.maxBuysPerDay||5};
  return {schema:'4ds-offline-simulation-v1',label:'Reconstructed historical approximation '+record.timestamp+' '+f.programId,plan,config};
 })};
}
const ix=args.indexOf('--input');
if(!args.includes('--fixture')&&ix<0)throw Error('Use --fixture or --input path; nothing is read from private cloud automatically');
let data=ix>=0?JSON.parse(fs.readFileSync(args[ix+1],'utf8')):fixture();
if(args.includes('--history')){
 console.error('WARNING: Historical summaries omit some original engine inputs; reconstructed runs are approximate, not exact reproductions.');
 data=fromSavedHistory(data);
}
const reports=data?.schema==='4ds-offline-simulation-bundle-v1'?
 data.cases.map(run):[run(data)];
const report=reports.length===1?reports[0]:{schema:'4ds-offline-simulation-bundle-report-v1',reports};
const output=JSON.stringify(report,null,2);
if(args.includes('--output')){const p=args[args.indexOf('--output')+1];fs.writeFileSync(p,output+'\n');}
process.stdout.write(output+'\n');
if(args.includes('--assert-payout')&&reports.some(r=>!(r.averages.targetHit>0&&r.averages.payoutRequested>0&&r.averages.paid>0)))process.exitCode=1;
