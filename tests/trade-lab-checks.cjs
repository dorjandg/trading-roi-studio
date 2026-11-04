// 4Ds Trade Lab invariant checks. Run: node tests/trade-lab-checks.cjs
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('trade-lab.html','utf8');
const match=html.match(/<script id="portfolio-mode-engine">([\s\S]*?)<\/script>/);
assert.ok(match,'Portfolio engine must exist');
new vm.Script(match[1],{filename:'trade-lab-engine.js'});
const baseline={
 account:'official:ftmo2:10000',pfTotal:'20',pfFunded:'0',pfCount:'6',
 pfDailyBudget:'300',pfBudget:'99',pfActivation:'0',pfPayout:'2000',
 pfSplit:'90',pfGoal:'20000',pfPayoutDays:'5',pfPayoutMin:'150',pfTrials:'100',
 pfRoute:'rotate',months:'1',wr:'35',be:'5',rr:'4',risk:'150',fee:'0',
 balance:'10000',target:'1000',dd:'1000',dailyLimit:'500',
 consistency:'0',minDays:'4',model:'static',seed:'24717',stage:'phase1'
};
function run(overrides={}){
 const data={...baseline,...overrides},els={};
 for(const [id,value] of Object.entries(data))
  els[id]={value,innerHTML:'',textContent:'',addEventListener(){}};
 for(const id of ['pfStatus','pfKpis','pfLog','pfRows','pfSummary','pfGraph','pfCompare','pfCompareNote','pfRun'])
  els[id]={value:'',innerHTML:'',textContent:'',addEventListener(){}};
 const document={getElementById(id){assert.ok(els[id],'DOM element '+id);return els[id]}};
 vm.runInNewContext(match[1],{document,console},{timeout:30000});
 return els;
}
let out=run();
assert.match(out.pfStatus.textContent,/100 portfolio simulations complete/);
assert.equal((out.pfRows.innerHTML.match(/<tr>/g)||[]).length,20);
assert.equal((out.pfCompare.innerHTML.match(/<tr>/g)||[]).length,5);
assert.match(out.pfKpis.innerHTML,/Median net payout cash/);
out=run({pfTotal:'50'});
assert.match(out.pfStatus.textContent,/FTMO maximum allocation/);
out=run({pfTotal:'20',pfDailyBudget:'100',risk:'150'});
assert.match(out.pfStatus.textContent,/exceeds the daily risk budget/);
out=run({account:'official:topstep:50000',balance:'50000',target:'3000',dd:'2000',
 dailyLimit:'0',consistency:'55',minDays:'2',model:'eod',pfBudget:'49',
 pfActivation:'149',pfPayout:'1800',pfTotal:'20',months:'3',pfCount:'10',
 risk:'250',pfDailyBudget:'500'});
assert.match(out.pfStatus.textContent,/portfolio simulations complete/);
assert.ok((out.pfRows.innerHTML.match(/>Funded</g)||[]).length<=5,'Topstep funded cap');
out=run({account:'official:topstep:50000',pfFunded:'6',pfTotal:'20'});
assert.match(out.pfStatus.textContent,/maximum of 5 active/);
console.log('All Trade Lab model checks passed');
