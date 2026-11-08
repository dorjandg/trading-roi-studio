(function(){
'use strict';
const $=id=>document.getElementById(id);
const host=$('weeklyEconomicsPanel');
if(!host||!window.StudioPortfolioEngine)return;
const details=document.createElement('details');
details.id='signalAllocationOptimizer';
details.style.cssText='margin:8px 0 12px;padding:10px;border:1px solid #435064;border-radius:8px';
const summary=document.createElement('summary');
summary.textContent='Signal allocation optimizer · optional comparison';
details.appendChild(summary);
const intro=document.createElement('p');
intro.className='hint';
intro.textContent='Explore alternative routing without changing the existing cash-flow table or saved trading strategies.';
details.appendChild(intro);
const label=document.createElement('label');label.textContent='Cross-stage copies ';
const copies=document.createElement('select');
for(const n of [2,3]){const option=document.createElement('option');option.value=String(n);option.textContent=String(n);if(n===3)option.selected=true;copies.appendChild(option);}
label.appendChild(copies);details.appendChild(label);
const button=document.createElement('button');button.type='button';button.textContent='Compare models';button.style.margin='0 8px';details.appendChild(button);
const result=document.createElement('div');result.className='hint';result.textContent='Run Simulation first.';details.appendChild(result);
const target=$('weeklyEconomicsContents')||host.querySelector('.numbered-content');
if(!target)return;
target.insertBefore(details,target.firstChild);
button.addEventListener('click',()=>{
const snapshot=window.__studioSignalAllocationSnapshot;
if(!snapshot||!snapshot.jobs||!snapshot.jobs.length){result.textContent='Run Simulation first.';return;}
button.disabled=true;result.textContent='Comparing allocation models…';
requestAnimationFrame(()=>{
try{
const E=window.StudioPortfolioEngine;
const {jobs,inputs}=snapshot;
const variants=[['Current · single','single',1],['Cross-stage','cross-stage',Number(copies.value)],['Limited · 2 copies','limited',2]];
const outputs=variants.map(([name,allocationMode,maxCopies])=>{
const reports=jobs.map(j=>E.simulatePortfolio(j.p,{
...inputs,budget:j.budget,seed:inputs.seed+j.index*120011,
maxAccounts:Math.max(1,Math.min(100,Math.floor(inputs.capitalMaxAccounts||100),inputs.capitalNominalCap?Math.floor(inputs.capitalNominalCap/j.p.size):100)),
tradeSchedule:j.tradeSchedule||inputs.tradeSchedule,trackCharts:false,
trials:Math.min(300,Math.max(50,inputs.trials)),
evaluationAllocationCap:j.allocation.evaluation||0,fundedAllocationCap:j.allocation.funded||0,
allocationMode,maxCopies,pairedSignals:true,signalMode:'shared'
}));
return {name,net:reports.reduce((v,r)=>v+r.avg.net,0),paid:reports.reduce((v,r)=>v+r.avg.paid,0),spent:reports.reduce((v,r)=>v+r.avg.spent,0),p10:reports.reduce((v,r)=>v+r.p10,0)};
});
const wrap=document.createElement('div');wrap.className='tablewrap';
const table=document.createElement('table');
for(const cells of [['Model','Net avg.','Paid avg.','Fees avg.','P10 net','Net change'],...outputs.map(r=>[r.name,'$'+Math.round(r.net).toLocaleString(),r.paid.toFixed(2),'$'+Math.round(r.spent).toLocaleString(),'$'+Math.round(r.p10).toLocaleString(),'$'+Math.round(r.net-outputs[0].net).toLocaleString()])]){
const tr=document.createElement('tr');
for(const value of cells){const td=document.createElement('td');td.textContent=value;tr.appendChild(td);}
table.appendChild(tr);
}
wrap.appendChild(table);result.replaceChildren(wrap);
const note=document.createElement('p');
note.textContent='Exploratory, up to 300 trials per account type. Same shared market signals across models. P10 net is not maximum drawdown. No model applied; cash-flow table unchanged.';
result.appendChild(note);
}catch(error){result.textContent='Comparison error: '+error.message;}
finally{button.disabled=false;}
});
});
})();