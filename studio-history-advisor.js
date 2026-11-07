/* 4Ds Trading Studio History Advisor — read-only, local, no AI API charges.
   Analyzes per-user saved run summaries and suggests tests, not trades. */
(function(root){'use strict';
const $=id=>document.getElementById(id);
const num=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const usd=x=>x===null?'—':(x<0?'−':'')+'$'+Math.abs(Math.round(x)).toLocaleString('en-US');
const fixed=x=>x===null?'—':x.toFixed(1);
const percent=(a,b)=>a!==null&&b>0?fixed(a/b*100)+'%':'—';
const average=(items,key)=>items.length?items.reduce((s,x)=>s+(num(x[key])||0),0)/items.length:null;
const fmtDate=s=>{let d=new Date(s);return Number.isFinite(d.getTime())?d.toLocaleString():'unknown'};
function reports(){
 const api=root.StudioAdvisorReadOnly;
 let runs=api?.getRuns?.()||[];
 if(!api?.getRuns){
  try{
   const selected=localStorage.getItem('4ds:active-user:v1');
   const user=['doen','dori','dona','dion'].includes(selected)?selected:'dori';
   const raw=JSON.parse(localStorage.getItem('4ds:v1:'+user+':portfolio-simulation-history:v1')||'[]');
   runs=Array.isArray(raw)?raw.slice(0,15):[];
  }catch(_){runs=[]}
 }
 const saved=runs.filter(r=>r?.schema==='4ds-portfolio-simulation-v1'&&Array.isArray(r.firms));
 const optimizer=runs.filter(r=>r?.kind==='calculate-investment'||r?.schema==='4ds-payout-optimizer-v1');
 const records=saved.flatMap(r=>r.firms.filter(f=>f&&f.avg).map(f=>({
   run:r.id,date:r.timestamp,kind:'Run Simulation',firm:f.firm,program:f.programId,size:f.accountSize,
   input:r.inputs||{},avg:f.avg,stages:f.stages||[],risk:f.risk||{},budget:f.budget,
   roi:num(f.roi),chance:num(f.chancePayout),sample:f.sample||{},raw:f
 })));
 return {runs,saved,optimizer,records};
}
function signature(x){
 const i=x.input||{};
 return [x.program,x.size,x.budget,i.days,i.tradesPerDay,i.signalPace,i.signalMode,i.purchaseMode,i.capacityMode,i.maxActive,i.winRate,
         JSON.stringify(x.risk)].join('|');
}
function issue(type,title,evidence,trial,priority,firm,source){
 return {type,title,evidence,trial,priority,firm,source};
}
function analyze(){
 const {runs,saved,optimizer,records}=reports();
 const current=root.StudioAdvisorReadOnly?.getCurrent?.()||{};
 let groups=new Map(),issues=[];
 for(const r of records){
  const key=r.program+':'+r.size;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(r);
 }
 for(const [key,list] of groups){
  list.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const r=list[0],c=r.avg,firm=r.firm+' '+r.size;
  const purchased=num(c.bought),funded=num(c.funded),paid=num(c.paid),spent=num(c.spent),received=num(c.receipts),blocked=num(c.exhausted);
  const stopped=num(c.strategyStopped),net=num(c.net);
  const label='Saved Run Simulation · '+fmtDate(r.date);
  if(spent!==null&&received!==null&&spent>received)
   issues.push(issue('cash','Receipts below modeled spending',firm+': '+usd(received)+' receipts vs '+usd(spent)+' spent; expected net '+usd(net)+'.','Test a longer horizon and review delayed first payouts before considering higher trade risk. Compare payout counts and worst-case net, not only ROI.',100,firm,label));
  if(purchased>0&&funded!==null&&funded/purchased<0.25)
   issues.push(issue('funnel','Low evaluation-to-funded conversion',firm+': '+fixed(funded)+' funded from '+fixed(purchased)+' purchased on average ('+percent(funded,purchased)+').','Inspect the Phase 1 / Phase 2 pass funnel. Compare saved stage risk strategies in a controlled rerun; monitor fees and drawdown.',95,firm,label));
  if(funded>0&&paid!==null&&paid/funded<0.4)
   issues.push(issue('payout','Funded accounts not converting to first payouts',firm+': '+fixed(paid)+' first-paid from '+fixed(funded)+' funded on average ('+percent(paid,funded)+').','Test longer trading horizons and review funded target, payout wait and funded risk constraints. Check the daily cashflow ledger.',90,firm,label));
  if(blocked!==null&&blocked>0)
   issues.push(issue('risk','Accounts blocked by modeled risk rules',firm+': '+fixed(blocked)+' average risk-exhausted accounts in latest run.','Test lower stage risk in a separate scenario. Compare expected first payouts, ROI and drawdown; do not edit the saved strategy automatically.',85,firm,label));
  if(stopped!==null&&stopped>0)
   issues.push(issue('stopped','Strategy-stopped accounts',firm+': '+fixed(stopped)+' accounts stopped by strategy rules on average; this is not necessarily an official failed account.','Inspect the stopped-account status and stage-specific policy before changing limits or risk.',70,firm,label));
  const sampleAccounts=Array.isArray(r.sample?.accounts)?r.sample.accounts:[];
  if(sampleAccounts.length){
   const failedSample=sampleAccounts.filter(a=>/failed|breach|exhausted/i.test(String(a.status||''))).length;
   const blockedAttempts=sampleAccounts.reduce((sum,a)=>sum+(num(a.riskBlockedAttempts)||0),0);
   const events=sampleAccounts.reduce((sum,a)=>sum+(Array.isArray(a.trace)?a.trace.length:0),0);
   if(failedSample||blockedAttempts)
    issues.push(issue('sample','Illustrative account trace has failures or blocked attempts',firm+': the one saved sample path contains '+sampleAccounts.length+' accounts, '+failedSample+' failed/exhausted statuses, '+blockedAttempts+' blocked attempts and '+events+' retained trace events. This sample is NOT the Monte Carlo mean.','Open Section 8 for the individual trace and compare the summary risk-blocked average before deciding whether to test a lower-risk policy.',65,firm,label+' · sample trace only'));
  }
  const days=num(r.input.days),dCash=r.sample?.dailyCash||[];
  if(days&&paid===0&&funded>0)
   issues.push(issue('time','Funded activity without a first payout in modeled horizon',firm+': '+days+' modeled trading days and '+fixed(funded)+' average funded, but no first-paid accounts.','Test an extended horizon with the same seed, budget and risk policies to separate timing from failure.',80,firm,label));
  const eligible=list.filter(x=>signature(x)===signature(r));
  if(eligible.length>1){
   const a=eligible[0],b=eligible[1];
   issues.push(issue('repeat','Repeated comparable settings in history',firm+': '+eligible.length+' recent saved runs have matching key settings/risk profiles. Latest expected net '+usd(num(a.avg.net))+' versus previous '+usd(num(b.avg.net))+'.','Compare seed and trial count before attributing fluctuations to a strategy improvement. Identical assumptions with different random samples do not establish a causal change.',40,firm,'Saved comparable runs'));
  }
 }
 if(!saved.length)issues.push(issue('missing','No saved full simulation available','No Run Simulation records are loaded for this user. Calculate Investment records are different and cannot supply full account-trace diagnostics.','Run Full Simulation, then select Analyze saved runs. If cloud history is still loading, refresh Section 10 first.',100,'','Data readiness'));
 if(optimizer.length)issues.push(issue('optimizer','Investment estimates kept separate',optimizer.length+' saved Calculate Investment record(s) found, analyzed separately from '+saved.length+' Run Simulation record(s).','Use Run Full Simulation for modeled account paths. Do not treat optimizer candidate summaries as equivalent account histories.',10,'','History classification'));
 issues.sort((a,b)=>b.priority-a.priority);
 return {saved:saved.length,optimizer:optimizer.length,records:records.length,groups:groups.size,latest:saved[0]?.timestamp||null,issues,unverified:!current.visible,
  current:current.visible?current:null,
  comparisons:groups.size?Array.from(groups.values()).map(g=>({firm:g[0].firm,size:g[0].size,count:g.length,latestNet:num(g[0].avg.net),latestFunded:num(g[0].avg.funded),latestPaid:num(g[0].avg.paid)})):[]};
}
function answer(question){
 const q=String(question||'').toLowerCase();
 if(!/(history|logs|saved run|past run|analy[sz]|optim|recommend|suggest|improve|failure|bottleneck|what should i change|test parameter|risk blocked)/.test(q))return null;
 const a=analyze();
 let body='Saved history: '+a.saved+' completed Run Simulation record(s), '+a.optimizer+' Calculate Investment record(s), '+a.groups+' account type(s).';
 if(a.latest)body+=' Latest saved full run: '+fmtDate(a.latest)+'.';
 const filtered=a.issues.filter(x=>x.type!=='optimizer').slice(0,4);
 body+='\n'+filtered.map((x,i)=>(i+1)+'. '+x.title+': '+x.evidence+'\nSuggested test: '+x.trial).join('\n');
 body+='\nThese are descriptive diagnostics, not proof that a parameter causes a result. No scenarios were rerun by this analysis and no settings were changed.';
 return [body,'Saved model history · High for values, Medium for proposed tests',false];
}

function sensitivity(){
 const engine=root.StudioPortfolioEngine,api=root.StudioAdvisorReadOnly;
 const current=api?.getCurrent?.();
 if(!current?.visible||!current?.inputs||!engine?.simulatePortfolio)
  return {error:'Run or restore a full simulation first. Tests require an active report and its exact current plan.'};
 if(current.stale)return {error:'The displayed result is stale: rerun Full Simulation with current parameters before testing alternatives.'};
 const cases=api.getTestCases?.()||[];
 if(!cases.length)return {error:'No active account plan available.'};
 const output=[];
 for(const item of cases){
  const p=item.plan,c=item.config;
  if(!p||!engine.validatePlan?.(p)||engine.validatePlan(p).errors?.length){continue}
  const days=Number(c.days),active=Number(c.maxActive),budget=Number(c.budget);
  if(!Number.isFinite(days)||!Number.isFinite(active)||!(budget>0))continue;
  const base={...c,trials:50,seed:24717,trackCharts:false,maxAccounts:100};
  const baseline=engine.simulatePortfolio(p,base);
  const variants=[];
  if(days<120){
   const nextDays=Math.min(120,days+Math.max(5,Math.round(days/2)));
   const schedule=Array.isArray(c.tradeSchedule)&&c.tradeSchedule.length?Array.from({length:nextDays},(_,i)=>c.tradeSchedule[i%c.tradeSchedule.length]):null;
   variants.push({name:'Longer horizon',parameter:'days',before:days,after:nextDays,config:{...base,days:nextDays,tradeSchedule:schedule}});
  }
  if(active<100)
   variants.push({name:'More concurrent accounts',parameter:'maxActive',before:active,after:Math.min(100,active+1),config:{...base,maxActive:active+1}});
  for(const v of variants){
   const test=engine.simulatePortfolio(p,v.config);
   output.push({firm:p.firm+' '+p.size,test:v.name,parameter:v.parameter,from:v.before,to:v.after,
    baseNet:num(baseline.avg.net),net:num(test.avg.net),basePaid:num(baseline.avg.paid),paid:num(test.avg.paid),
    baseSpent:num(baseline.avg.spent),spent:num(test.avg.spent),baseBlocked:num(baseline.avg.exhausted),blocked:num(test.avg.exhausted),
    trials:50,baseRoi:num(baseline.roi),roi:num(test.roi),
    deltaNet:(num(test.avg.net)||0)-(num(baseline.avg.net)||0),
    deltaPaid:(num(test.avg.paid)||0)-(num(baseline.avg.paid)||0),
    deltaBlocked:(num(test.avg.exhausted)||0)-(num(baseline.avg.exhausted)||0)});
  }
 }
 output.sort((a,b)=>((b.deltaNet>0?1:0)+(b.deltaPaid>0?1:0)+(b.deltaBlocked<0?1:0))-((a.deltaNet>0?1:0)+(a.deltaPaid>0?1:0)+(a.deltaBlocked<0?1:0))||b.deltaNet-a.deltaNet);
 return {output};
}
function mount(){
 const parent=document.querySelector('#gptResearchPanel .numbered-content');
 if(!parent||$('studioHistoryAdvisor'))return;
 const section=document.createElement('details');section.id='studioHistoryAdvisor';
 section.className='gpt-research-item';section.innerHTML='<summary><strong>Simulation History Advisor</strong><span class="sim-charts-summary"> · Read saved runs · Suggest tests · Show / hide</span></summary><div class="gpt-research-content"><p class="hint">Free, read-only checks of the selected user’s saved full simulations. Does not change any stage policy or automatically run new Monte Carlo scenarios.</p><button type="button" data-advisor-run>Analyze saved simulations</button><p data-advisor-status class="hint">Click Analyze to inspect loaded history.</p><div data-advisor-output></div></div>';
 const testing=document.createElement('div');testing.innerHTML='<button type="button" data-advisor-test>Run 50-trial sensitivity tests</button><div data-advisor-tests class="hint"></div>';section.querySelector('.gpt-research-content').append(testing);parent.insertBefore(section,parent.firstChild);
 const out=section.querySelector('[data-advisor-output]'),status=section.querySelector('[data-advisor-status]');
 section.addEventListener('click',e=>{
  if(e.target.closest('[data-advisor-test]')){
   const x=sensitivity();const t=section.querySelector('[data-advisor-tests]');t.replaceChildren();
   if(x.error){t.textContent=x.error;return;}
   if(!x.output.length){t.textContent='No eligible test cases found in the current report.';return;}
   const heading=document.createElement('p');heading.className='hint';heading.textContent='Ranked exploratory tests: 50 trials per scenario, fixed seed, unchanged risk policy and budget. Ranking favors net gain, paid-account improvement and fewer blocked accounts, but is NOT statistically reliable; confirm with larger independent trials.';t.append(heading);
   x.output.forEach((v,i)=>{const p=document.createElement('p');p.textContent='#'+(i+1)+' '+v.firm+' · '+v.test+' ('+v.from+' → '+v.to+'): net '+usd(v.baseNet)+' → '+usd(v.net)+' ('+(v.deltaNet>=0?'+':'')+usd(v.deltaNet)+'); first-paid '+fixed(v.basePaid)+' → '+fixed(v.paid)+'; spend '+usd(v.baseSpent)+' → '+usd(v.spent)+'; risk-blocked '+fixed(v.baseBlocked)+' → '+fixed(v.blocked)+'.'+(v.deltaNet>0&&v.deltaPaid>=0&&v.deltaBlocked<=0?' Candidate for larger-trial confirmation.':' Mixed or worse result — not recommended without further checks.');t.append(p)});
   return;
  }
  if(!e.target.closest('[data-advisor-run]'))return;
  const a=analyze();status.textContent=a.saved+' simulation run(s), '+a.optimizer+' investment calculation(s) · '+a.groups+' account type(s) · latest '+(a.latest?fmtDate(a.latest):'none')+'.';
  out.replaceChildren();
  for(const finding of a.issues.slice(0,12)){
   const item=document.createElement('details');item.className='gpt-research-item';
   const title=document.createElement('summary');title.textContent=finding.title+(finding.firm?' · '+finding.firm:'');
   const evidence=document.createElement('p');evidence.textContent=finding.evidence;
   const trial=document.createElement('p');trial.textContent='Suggested parameter test: '+finding.trial;
   const src=document.createElement('small');src.className='hint';src.textContent=finding.source+' · Read-only hypothesis; no test run';
   item.append(title,evidence,trial,src);out.append(item);
  }
  if(a.saved) {const foot=document.createElement('p');foot.className='hint';foot.textContent='Findings use latest saved average figures per program. Each suggested parameter change must be tested independently with comparable assumptions and enough Monte Carlo trials. No firm rule has been changed.';out.append(foot)}
 });
}
root.StudioHistoryAdvisor={analyze,answer,sensitivity,mount};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);