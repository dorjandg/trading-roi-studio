// Run: node jj-simon/tests/calculator-probability.test.cjs
// Tests the production functions directly, without a copied calculation engine.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','calculator-hub.js'),'utf8');
const begin=source.indexOf('function calcTopstep(');
const end=source.indexOf('function calc(path,v)',begin);
assert(begin>=0&&end>begin,'Topstep functions must exist');
const {calcTopstep,calcTopstepFunded}=new Function(source.slice(begin,end)+';return {calcTopstep,calcTopstepFunded};')();
const sum=xs=>xs.reduce((n,x)=>n+x.prob,0);
const rate=(xs,fn)=>sum(xs.filter(fn));
const evalConfig={
 target:3000,limit:2000,depth:12,floor:100,winRate:30,consistencyRate:50,
 topstepOptionalDailyCap:false,dailyLimit:1000,rr:3,
 manualRisks:{1:[500,700,800,0],2:[500,700,800,0]},
 manualRRs:{1:[3,2.9,3.4,null],2:[3,2.9,3.4,null]}
};
const fundedConfig={
 target:4000,limit:2000,depth:12,floor:100,winRate:30,tradesPerDay:5,
 topstepOptionalDailyCap:false,dailyLimit:1000,rr:5,
 manualRisks:{3:[700,840,460,0]},manualRRs:{3:[5,5,5,5]}
};
function enumerateEvaluation(cfg){
 const leaves=[];
 function walk(p){
  const x=calcTopstep(p,cfg);
  const finished=x.status!=='active'||x.checkpointAttempts>=x.checkpointLimit||
   x.steps.length>=2*x.checkpointLimit||(p.length>0&&x.steps.length<p.length);
  if(finished){leaves.push(x);return;}
  assert(p.length<20,'Evaluation recursion runaway');
  walk(p+'W');walk(p+'L');
 }
 walk('');return leaves;
}
function enumerateFunded(cfg){
 const leaves=[];
 function walk(p){
  const x=calcTopstepFunded(p,cfg);
  if(x.status!=='active'||x.steps.length>=cfg.depth){leaves.push(x);return;}
  assert(p.length<20,'Funded recursion runaway');
  walk(p+'W');walk(p+'L');
 }
 walk('');return leaves;
}
function near(actual,expected,label,tol=1e-9){
 assert(Math.abs(actual-expected)<tol,`${label}: expected ${expected}, got ${actual}`);
}
const e=enumerateEvaluation(evalConfig);
const f=enumerateFunded(fundedConfig);
near(sum(e),1,'Evaluation mass');
near(sum(f),1,'Funded mass');
const checkpoint=rate(e,x=>x.topstepCheckpoint);
const carried=rate(e,x=>x.status==='target');
const fundedPass=rate(f,x=>x.status==='target');
near(checkpoint,0.606579,'Evaluation checkpoint probability');
near(checkpoint**2,0.367938083241,'Equal-checkpoint modeled pass');
near(carried,0.367938083241,'Carried-state evaluation pass');
near(fundedPass,0.39696590673,'Funded pass');
near(rate(f,x=>x.status==='closed'),0.602567144389,'Funded closed');
near(rate(f,x=>x.status==='active'),0.000466948881,'Funded unresolved');
const payoutGoal=5,split=.75,evalFee=50,activation=150;
const fundedNeeded=payoutGoal/fundedPass;
const buys=fundedNeeded/(checkpoint**2);
const fees=buys*evalFee+fundedNeeded*activation;
const payout=payoutGoal*fundedConfig.target*split;
near((payout-fees)/fees*100,316.55447914232724,'Modeled ROI',1e-7);
for(const [label,config,enumerate] of [
 ['Evaluation optional daily cap', {...evalConfig,topstepOptionalDailyCap:true},enumerateEvaluation],
 ['Funded optional daily cap', {...fundedConfig,topstepOptionalDailyCap:true},enumerateFunded],
 ['Funded no R4', fundedConfig,enumerateFunded]
])near(sum(enumerate(config)),1,label);
// Whole-contract execution with a five-dollar MGC stop must preserve mass.
const contractEval={...evalConfig,contractSpecs:{
 1:Array(4).fill({symbol:'MGC',stop:5}),
 2:Array(4).fill({symbol:'MGC',stop:5})
},roundTurnFee:0};
const contractFunded={...fundedConfig,contractSpecs:{
 3:Array(4).fill({symbol:'MGC',stop:5})
},roundTurnFee:0};
const ce=enumerateEvaluation(contractEval);
const cf=enumerateFunded(contractFunded);
near(sum(ce),1,'Whole-contract evaluation mass');
near(sum(cf),1,'Whole-contract funded mass');
near(rate(ce,x=>x.topstepCheckpoint),0.606579,'Whole-contract first checkpoint');
near(rate(ce,x=>x.status==='target'),0.1341,'Carried-state consistency-qualified pass');
near(rate(cf,x=>x.status==='target'),0.41209220673,'Whole-contract funded pass');
assert(calcTopstepFunded('L',contractFunded).steps[0].contracts===14,'MGC first risk contracts');
assert(calcTopstepFunded('LL',contractFunded).steps[1].contracts===16,'MGC second risk contracts');
console.log(JSON.stringify({evaluationMass:sum(e),checkpoint,modeledEvaluationPass:checkpoint**2,
 carriedEvaluationPass:carried,fundedMass:sum(f),fundedPass,fees,payout,roi:(payout-fees)/fees*100},null,2));
