// Run: node jj-simon/tests/calculator-probability.test.cjs
// Tests the production functions directly, without a copied calculation engine.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','calculator-hub.js'),'utf8');
const begin=source.indexOf('function goldExecution(');
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
near(carried,0.1341,'Carried-state evaluation pass');
near(fundedPass,0.39696590673,'Funded pass');
near(rate(f,x=>x.status==='closed'),0.602567144389,'Funded closed');
near(rate(f,x=>x.status==='active'),0.000466948881,'Funded unresolved');
const payoutGoal=5,split=.75,evalFee=50,activation=150;
const fundedNeeded=payoutGoal/fundedPass;
const buys=fundedNeeded/carried;
const fees=buys*evalFee+fundedNeeded*activation;
const payout=payoutGoal*fundedConfig.target*split;
near((payout-fees)/fees*100,127.76778760248024,'Modeled ROI',1e-4);
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
// Verify the website's forecast is wired to carried-state, not squared planning.
assert(/const probability=firmForPhases==='topstep'\?planningProbability:actualEvaluationProbability;/.test(source),
 'Topstep funnel and purchase forecast must use the same independent-checkpoint planning probability');
assert(/const evalPass=probability;/.test(source),
 'Replacement purchases must consume the financial pass rate');
assert(/const modelRoi=modelFees>0\?100\*modelNet\/modelFees:null;/.test(source),
 'ROI must use modeled net profit divided by actual modeled fees');
function forecast(evalPass,fundedPass){
 const fundedNeeded=payoutGoal/fundedPass;
 const purchases=fundedNeeded/evalPass;
 const spending=purchases*evalFee+fundedNeeded*activation;
 const cash=payoutGoal*fundedConfig.target*split;
 return {fundedNeeded,purchases,spending,cash,net:cash-spending,roi:100*(cash-spending)/spending};
}
const executableForecast=forecast(rate(ce,x=>x.status==='target'),rate(cf,x=>x.status==='target'));
const planningForecast=forecast(rate(ce,x=>x.topstepCheckpoint)**2,rate(cf,x=>x.status==='target'));
assert(executableForecast.purchases>planningForecast.purchases,
 'Carried-state consistency must increase required evaluation purchases');
assert(executableForecast.roi<planningForecast.roi,
 'Carried-state forecast must not reuse optimistic planning ROI');
near(executableForecast.cash,15000,'Executable modeled payout cash');
// Blocked and depth-limited paths are unresolved, not breached purchases.
assert(/const modelFailed=modelBuys===null\?null:modelBuys\*failProbability;/.test(source),
 'Failed evaluations must be computed from breached account probability');
assert(/const modelUnresolved=modelBuys===null\?null:modelBuys\*unresolvedProbability;/.test(source),
 'Unresolved evaluations must be reported separately');
const blocked=rate(ce,x=>x.status==='daily-blocked'||x.status==='active');
const breached=rate(ce,x=>x.status==='closed');
near(rate(ce,x=>x.status==='target')+blocked+breached,1,'Exclusive evaluation outcome partition');
near(breached,0,'No breached evaluation in current limited-attempt preset');
assert(blocked>0.8,'Most paths remain unresolved after the configured attempts');
// Funnel conditional rate and counts must use the SAME probability model.
assert(/const p2Conditional=firmType==='topstep'\?threeAttemptPass:actualP2Conditional;/.test(source),
 'Topstep P2 and P3 must have identical checkpoint rates');
assert(/const funnelP3=funnelP1===null\?null:funnelP1\*p2Conditional;/.test(source),
 'P3 count must equal P2 count multiplied by displayed conditional rate');
assert(/const funnelP4=funnelP3===null\?null:funnelP3\*pFund;/.test(source),
 'P4 count must equal P3 count multiplied by funded pass rate');
const carriedP1=rate(ce,x=>x.topstepCheckpoint);
const carriedP3=rate(ce,x=>x.status==='target');
const carriedConditional=carriedP3/carriedP1;
near(carriedP1*carriedConditional,carriedP3,'Carried funnel conservation');
near(carriedP1,checkpoint,'Identical first-stage settings');
near(checkpoint*checkpoint,0.367938083241,'Separate equal-checkpoint planning result');
assert(Math.abs(carriedConditional-checkpoint)>.1,
 'Actual conditional probability must not be misrepresented as standalone planning');
// Verify reverse purchase plan reconciles through all four stages.
const purchaseForFive=5/(rate(cf,x=>x.status==='target')*checkpoint*checkpoint);
near(purchaseForFive*checkpoint*checkpoint*rate(cf,x=>x.status==='target'),5,'Five-payout reverse plan');
near(purchaseForFive*checkpoint*checkpoint,5/rate(cf,x=>x.status==='target'),'Funded account allocation');
// User-defined rule: W, LW, LLW pass; LLL loses the checkpoint.
const pThree=1-(1-.30)**3;
near(pThree,.657,'Three-attempt checkpoint at 30% WR');
near(pThree*pThree,.431649,'Both identical checkpoints');
near(1-(1-.25)**3,.578125,'Three-attempt checkpoint at 25% WR');
assert(/const threeAttemptPass=1-Math.pow\(1-Math.max\(0,Math.min\(1,v.winRate\/100\)\),3\);/.test(source),
 'Website must use three-losses-in-a-row pass formula');
assert(/const planningProbability=firmForPhases==='topstep'\?threeAttemptPass\*threeAttemptPass:actualEvaluationProbability;/.test(source),
 'Evaluation pass must multiply two identical three-attempt stages');
const neededForFive=5/(pThree*pThree*rate(cf,x=>x.status==='target'));
near(neededForFive*pThree*pThree*rate(cf,x=>x.status==='target'),5,'Payout target from three-attempt funnel');
const fundedRenewal=(.3+.7*.3)/(1-.7*.7*.3);near(fundedRenewal,.5978898007033998,'P3 reset renewal probability',1e-9);assert(source.includes('const fundedThreeAttemptPass=fundedCycleTarget/(1-fundedCycleReset);'),'Funded P3 must use reset renewal formula');
console.log(JSON.stringify({evaluationMass:sum(e),checkpoint,modeledEvaluationPass:checkpoint**2,
 carriedEvaluationPass:carried,fundedMass:sum(f),fundedPass,fees,payout,roi:(payout-fees)/fees*100},null,2));
