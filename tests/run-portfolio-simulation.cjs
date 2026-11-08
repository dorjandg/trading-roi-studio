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
 config:{count:5,days:45,tradesPerDay:5,winRate:1,seed:24717,
  purchaseMode:'upfront',capacityMode:'manual',maxActive:5,maxBuysPerDay:5,
  evaluationAllocationCap:0,fundedAllocationCap:0,trackDaily:true,
  signalMode:'independent',allocationMode:'single',maxCopies:1,
  allocationPriority:'balanced',pairedSignals:false,recycleFundedPayouts:false}};
}
function run(data){
 if(data?.schema!=='4ds-offline-simulation-v1')throw Error('Expected 4ds-offline-simulation-v1 input');
 const p=data.plan,c=data.config;
 if(!p||!c||!Array.isArray(p.stageList)||!p.riskProfiles?.funded)throw Error('Missing complete plan or funded risk');
 if(!['topstep','ftmo2','hola'].includes(p.id))throw Error('Unknown firm id');
 if(!(c.days>=1&&c.days<=120&&c.count>=1&&c.count<=100&&c.tradesPerDay>=1&&c.tradesPerDay<=20))throw Error('Simulation dimensions out of range');
 const trials=Math.min(300,Math.max(1,Math.floor(c.trials||1)));
 const sums={bought:0,funded:0,targetHit:0,payoutRequested:0,paid:0,receipts:0,spent:0,net:0,strategyStopped:0,exhausted:0};
 let sample=null;
 for(let i=0;i<trials;i++){
  const seed=(Math.floor(c.seed||24717)+i)>>>0;
  const rand=engine.rngFactory(seed);
  const result=engine.oneTrial(p,{...c,trialIndex:i},rand,i===0);
  if(i===0)sample=result;
  for(const k of Object.keys(sums))sums[k]+=Number(result[k]||0)/trials;
 }
 const report={schema:'4ds-offline-simulation-report-v1',source:data.label||'Authorized offline input',
  firm:p.id,trials,config:{days:c.days,tradesPerDay:c.tradesPerDay,seed:c.seed||24717},
  averages:sums,firstTrial:{funded:sample.funded,targetHit:sample.targetHit,
   payoutRequested:sample.payoutRequested,paid:sample.paid,
   fundedTrades:sample.tradeAssignments?.filter(t=>t.stage==='funded'&&['W','L'].includes(t.outcome)).length||0,
   payoutEvents:sample.accounts?.flatMap(a=>a.trace.filter(t=>['payout-request','paid','strategy-stop'].includes(t.type)).map(t=>({account:a.id,...t}))).slice(0,30)}};
 return report;
}
const ix=args.indexOf('--input');
if(!args.includes('--fixture')&&ix<0)throw Error('Use --fixture or --input path; nothing is read from private cloud automatically');
const data=ix>=0?JSON.parse(fs.readFileSync(args[ix+1],'utf8')):fixture();
const report=run(data);
const output=JSON.stringify(report,null,2);
if(args.includes('--output')){const p=args[args.indexOf('--output')+1];fs.writeFileSync(p,output+'\n');}
process.stdout.write(output+'\n');
if(args.includes('--assert-payout')&&!(report.averages.targetHit>0&&report.averages.payoutRequested>0&&report.averages.paid>0))process.exitCode=1;
