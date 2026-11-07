/* Exact funded paths for the named compounding scenario.
   Uses StudioPortfolioEngine.previewFundedPath: not hardcoded outcome arithmetic. */
(function(root){
'use strict';
const E=root.StudioPortfolioEngine,D=root.StudioModelDiscovery;
if(!E||!D)return;
function show(container,comparison){
 const ideas=comparison?.result?.ideas||[];
 if(!ideas.some(v=>v.key==='recovery-1800'))return;
 const wrap=document.createElement('section');
 wrap.className='payout-funded-path-breakdown';
 const h=document.createElement('h4');
 h.textContent='Funded strategy — exact trade paths (before portfolio averages)';
 wrap.append(h);
 const description=document.createElement('p');description.className='hint';
 description.textContent='Executed by the simulator, one forced W/L signal per trading day. Actual risk caps and payout stop rules apply. These are example paths, not average results or guaranteed outcomes.';
 wrap.append(description);
 const cases=[
  ['W','First +$450 win'],['WW','Two wins · aim +$1,800'],
  ['WWW','Three wins · max $450 per trade'],['LW','Loss then win'],
  ['LLW','Two losses then win'],['LLLWW','Three losses then two wins'],
  ['WLW','Win, giveback loss, restart']
 ];
 const number=n=>(Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 for(const variant of ideas.filter(v=>v.key==='recovery-1800'||v.key==='recovery-3150')){
  const details=document.createElement('details');
  details.open=variant.key==='recovery-1800';
  const sum=document.createElement('summary');sum.textContent=variant.title;details.append(sum);
  const info=document.createElement('p');info.className='hint';
  const plan=variant.plan,stage=plan.riskProfiles.funded;
  info.textContent='Stop at +$'+number(stage.target)+' funded profit · daily loss $'+number(plan.dailyLoss)+' · maximum funded risk per trade $'+number(stage.fundedMaxTradeRisk||450)+' · RR 3';
  details.append(info);
  const table=document.createElement('table');table.className='journey-table';
  const header=document.createElement('tr');
  for(const name of ['Win/loss sequence','Trade risk actually used','Funded P&L after sequence','Final event']){
   const th=document.createElement('th');th.textContent=name;header.append(th);
  }
  const thead=document.createElement('thead');thead.append(header);table.append(thead);
  const body=document.createElement('tbody');
  for(const [sequence,label] of cases){
   const rows=E.previewFundedPath(plan,sequence);
   const last=rows[rows.length-1];
   const riskTrail=rows.map(x=>x.executed?'$'+number(x.risk):'no trade').join(' → ');
   const values=[label+' ('+sequence+')',riskTrail,
    last?(last.after>=0?'+':'−')+'$'+number(Math.abs(last.after)):'—',
    last?(last.status==='failed'?'Breach':last.blocked?'Risk blocked':last.note):'—'];
   const tr=document.createElement('tr');
   for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td);}
   body.append(tr);
  }
  table.append(body);const tablewrap=document.createElement('div');tablewrap.className='tablewrap';
  tablewrap.append(table);details.append(tablewrap);wrap.append(details);
 }
 const foot=document.createElement('p');foot.className='hint';
 foot.textContent='Maximum funded trade risk is $450. The $1,800 model stops after two wins, so WWW has no third trade there. Expand the $3,150 model for the full $150, $450, $450 winning sequence. Firm limits apply. Click Analyze in the comparison table to test the portfolio.';
 wrap.append(foot);container.prepend(wrap);
}
D.renderFundedPaths=show;
})(typeof window!=='undefined'?window:globalThis);
