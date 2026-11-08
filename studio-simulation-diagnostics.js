(function(root){'use strict';
function build(results,inputs,jobs){
 const now=new Date().toISOString();
 const accounts=(results||[]).map((r,i)=>{
  const p=r.plan||{},a=r.avg||{},s=r.sample||{},traces=(s.accountDetails||[]).slice(0,3).map(x=>({id:x.id,status:x.status,stage:x.stageIndex,trace:(x.trace||[]).slice(-40)}));
  const reasons=[];
  if(a.funded>0&&!(a.paidAccounts||a.paid))reasons.push({severity:'warning',code:'FUNDED_NO_PAYOUT',message:'Funded accounts exist but no first payouts were recorded. Inspect funded target, qualifying days, risk blocks and payout processing.',evidence:{funded:a.funded,targetHit:a.targetHit,payoutRequested:a.payoutRequested,paid:a.paidAccounts||a.paid,exhausted:a.exhausted,strategyStopped:a.strategyStopped}});
  if(a.targetHit>0&&!(a.payoutRequested>0))reasons.push({severity:'warning',code:'TARGET_NO_REQUEST',message:'Funded targets were reached without payout requests. Check qualifying-day requirements and payout eligibility.'});
  if(a.exhausted>0)reasons.push({severity:'warning',code:'RISK_BLOCKED',message:'Some accounts could not take their configured next trade without exceeding the modeled loss floor.',count:a.exhausted});
  if(a.strategyStopped>0)reasons.push({severity:'info',code:'POLICY_STOP',message:'Some accounts stopped because of their selected risk sequence, not necessarily firm drawdown.',count:a.strategyStopped});
  if(r.clipped)reasons.push({severity:'info',code:'CAPACITY_LIMIT',message:'Account purchases were limited by budget or allocation caps.'});
  if(p.id==='topstep'&&Number(p.riskProfiles?.funded?.r3||0)<=0&&Number(a.targetHit||0)>0)reasons.push({severity:'warning',code:'TOPSTEP_QUALIFICATION_R3_DISABLED',message:'Funded R3 is zero. The engine switches to R3 after the funded target while seeking five $150 qualifying days; the next trade may be disabled. Review the funded R3 route or policy in Firms. No settings changed.',evidence:{fundedR3:p.riskProfiles.funded.r3,qualifyingDaysRequired:5,targetHit:a.targetHit,payoutRequested:a.payoutRequested}});
  if(p.id==='topstep')reasons.push({severity:'info',code:'TOPSTEP_MODEL',message:'Topstep funded payout model requires five $150 winning days; confirm current official eligibility separately. The simulator is not a firm-rule certification.'});
  return {firm:p.firm,program:p.id,size:p.size,budget:r.budget,configuration:{stageList:p.stageList,fee:p.fee,activationFee:p.activationFee,overallLoss:p.overallLoss,dailyLoss:Number.isFinite(p.dailyLoss)?p.dailyLoss:null,split:p.split,processingTradingDays:p.payoutProcessingTradingDays,allocation:jobs?.[i]?.allocation||{},risks:Object.fromEntries(Object.entries(p.riskProfiles||{}).map(([k,v])=>[k,{target:v.target,minDays:v.minDays,r1:v.r1,r2:v.r2,r3:v.r3,rr:v.rr,policy:v.policy?.mode}]))},counts:{bought:a.bought,passes:r.stages,funded:a.funded,targetHit:a.targetHit,payoutRequested:a.payoutRequested,paid:a.paidAccounts||a.paid,failed:a.failed,exhausted:a.exhausted,strategyStopped:a.strategyStopped,pending:a.pending,trades:a.trades},reasons,sample:{assignments:(s.tradeAssignments||[]).slice(0,40),traces}};
 });
 return {schema:'4ds-simulation-diagnostics-v1',createdAt:now,runKind:'run-simulation',inputs:{days:inputs.days,trials:inputs.trials,tradesPerDay:inputs.tradesPerDay,winRate:inputs.winRate,budgetMode:inputs.budgetMode,signalMode:inputs.signalMode,purchaseMode:inputs.purchaseMode},comparisonNote:inputs.budgetMode==='split'?'Split budget with per-firm schedules':'Independent alternatives; each firm uses its own budget and signals',accounts};
}
function render(report){
 let panel=document.getElementById('studioSimulationDiagnostics');
 if(!panel){panel=document.createElement('details');panel.id='studioSimulationDiagnostics';panel.className='panel';panel.style.cssText='margin:12px 0;padding:12px';const anchor=document.getElementById('results')||document.getElementById('section2Panel');anchor?.parentNode?.insertBefore(panel,anchor);}
 if(!panel)return;
 panel.replaceChildren();
 const summary=document.createElement('summary');summary.textContent='Simulation diagnostics · '+report.accounts.reduce((n,a)=>n+a.reasons.filter(r=>r.severity==='warning').length,0)+' warnings';summary.style.cursor='pointer';panel.append(summary);
 const note=document.createElement('p');note.className='hint';note.textContent=report.comparisonNote+' · Representative traces are samples, not all Monte Carlo paths.';panel.append(note);
 for(const a of report.accounts){const box=document.createElement('details');box.style.margin='9px 0';const h=document.createElement('summary');h.textContent=a.firm+' '+a.size.toLocaleString()+' · funded '+Number(a.counts.funded||0).toFixed(2)+' · paid '+Number(a.counts.paid||0).toFixed(2);box.append(h);const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;font-size:11px';pre.textContent=a.reasons.map(x=>x.code+': '+x.message+(x.count!=null?' ('+Number(x.count).toFixed(2)+')':'')).join('\n')||'No diagnostic warning triggered.';box.append(pre);panel.append(box);}
 const btn=document.createElement('button');btn.type='button';btn.textContent='Copy diagnostic JSON';btn.addEventListener('click',()=>{const str=JSON.stringify(report,null,2);if(navigator.clipboard?.writeText)navigator.clipboard.writeText(str).then(()=>btn.textContent='Copied diagnostic JSON').catch(()=>{btn.textContent='Clipboard blocked';});else btn.textContent='Clipboard unavailable';});panel.append(btn);
}
root.StudioSimulationDiagnostics={build,render};
})(window);
