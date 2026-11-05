(function(){
"use strict";
function rows(id,items){const host=document.getElementById(id);if(!host)return;host.replaceChildren();for(const [label,value] of items){const item=document.createElement('div');item.className='item';const l=document.createElement('span');l.textContent=label;const v=document.createElement('strong');v.textContent=value===undefined||value===null||value===''?'Not verified in reference':String(value);item.append(l,v);host.append(item);}}
function money(v){return v===null||v===undefined||!Number.isFinite(Number(v))?'Not verified':'$'+Number(v).toLocaleString('en-US');}
window.fourDsRenderRiskDiagnostic=function(id,size,inputs){
 const box=document.getElementById('firmRiskDiagnostic');if(!box)return;
 box.replaceChildren();
 const rec=window.fourDsOfficialAudit?.programs?.[id];
 if(!rec?.riskStructure){box.textContent='Drawdown and consistency audit loading. No account risk limit is verified yet.';return;}
 const risk=rec.riskStructure,cons=risk.consistency||{},n=Number(size)||0;
 const label=document.createElement('div');label.className='risk-diagnostic-title';label.textContent='Loss floor & consistency · selected account';box.append(label);
 const items=[
  ['Drawdown type',risk.drawdownKind.replaceAll('-',' ').toUpperCase()],
  ['Loss-floor behavior',risk.updateRule],
  ['Daily consistency',cons.percent!=null?cons.percent+'% · '+String(cons.stage||'stage requires review'):'No universal numeric cap confirmed'],
 ];
 for(const [a,b]of items){const p=document.createElement('div');p.className='risk-diagnostic-line';const k=document.createElement('span');k.textContent=a;const v=document.createElement('strong');v.textContent=b;p.append(k,v);box.append(p)}
 const note=document.createElement('p');note.className='muted';note.textContent=cons.description||'Check specific program terms';box.append(note);
 const name=id==='topstep'?'Combine':cons.stage||'account';
 const targets=rec.evaluation?.targetsUSDBySize||rec.evaluation?.profitTargetsUSD||{};
 const percentage=rec.evaluation?.targetsPercent?.[0];
 const target=Number(targets[n])||(percentage!=null&&n>0?n*percentage/100:0);
 const isEvaluation=cons.stage==='evaluation'||cons.stage==='variant-dependent';
 const applicable=cons.percent!=null&&isEvaluation&&target>0&&n>0&&id!=='fundednext-futures';
 if(applicable){
  const permitted=target*cons.percent/100;
  const allowedRisk=Number(inputs?.rr)>0?permitted/inputs.rr:null;
  const p=document.createElement('p');p.className='risk-diagnostic-example';
  p.textContent='At a '+(n/1000)+'K account and '+Math.round(target).toLocaleString('en-US')+' profit target: best-day planning reference '+permitted.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2})+' ('+cons.percent+'% of total).'+(allowedRisk!==null?' At '+inputs.rr+'R, one full-size winner would use this amount at about '+allowedRisk.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2})+' risk.':'');
  box.append(p);
  if(Number(inputs?.base)>0&&Number(inputs?.rr)>0){
    const profit=inputs.base*inputs.rr;
    const signal=document.createElement('p');signal.className='risk-diagnostic-signal';
    signal.textContent=profit>permitted?'Check daily profit sizing: one '+inputs.rr+'R win at your planned '+inputs.base.toFixed(0)+' USD risk produces '+profit.toFixed(0)+' USD, above the '+permitted.toFixed(0)+' USD planning reference. Lower exposure, stop after target, or expect to grow total profits over additional days.':'Planned one-trade winner '+profit.toFixed(0)+' USD stays below the '+permitted.toFixed(0)+' USD best-day planning reference. Multiple wins on the same day still add together.';
    box.append(signal);
  }
 } else if(cons.percent!=null) {
  const info=document.createElement('p');info.className='risk-diagnostic-example';info.textContent='This '+cons.percent+'% rule applies to '+(cons.stage||'specific stages')+'. Do not convert it into a fixed evaluation daily-profit cap without the funded cycle target or exact product variant.';box.append(info);
 }
 const d=rec.loss||{};
 const max=Number(d.maximumUSDBySize?.[n])||(d.maximumPercent!=null&&n>0?n*Number(d.maximumPercent)/100:0);
 const daily=Number(d.dailyUSDBySize?.[n])||(d.dailyPercent!=null&&n>0?n*Number(d.dailyPercent)/100:0);
 if(Number(inputs?.base)>0&&(max>0||daily>0)){
  const ref=document.createElement('p');ref.className='risk-diagnostic-signal';
  let bits=[];
  if(daily>0)bits.push('one planned loss uses '+(100*inputs.base/daily).toFixed(1)+'% of initial daily allowance');
  if(max>0)bits.push((100*inputs.base/max).toFixed(1)+'% of initial overall loss allowance');
  ref.textContent='Risk check: '+bits.join(' and ')+'. Remaining headroom may be lower after trades or a moving floor; include commission, slippage and open P/L.';
  box.append(ref);
 }
 const warning=document.createElement('p');warning.className='muted';warning.textContent='Planning diagnosis only. Rule variants and funded-stage terms can change. Do not use this as an order-permission or hard broker-risk gate.';box.append(warning);
};
window.fourDsRenderAudit=function(id){
 const host=document.getElementById('officialAuditDetails');if(!host)return;
 const audit=window.fourDsOfficialAudit?.programs?.[id];
 host.replaceChildren();
 if(!audit){const p=document.createElement('p');p.className='muted';p.textContent='Official audit is still loading, or is unavailable. Do not rely on missing details.';host.append(p);return;}
 const status=document.getElementById('officialAuditStatus');
 if(status)status.textContent=audit.status==='requires-variant-selection'?'VARIANT REQUIRED · not fully verified':'SOURCE-REVIEWED · verification incomplete';
 const intro=document.createElement('p');intro.className='muted';intro.textContent='Research snapshot '+window.fourDsOfficialAudit.asOf+' · '+(audit.status==='requires-variant-selection'?'Select the exact product variant before using any terms.':'Some fields remain incomplete.')+' Account stage, platform, purchase date and current checkout may change requirements. Not a broker risk controller.';host.append(intro);
 const protect=document.createElement('details');protect.className='audit-subsection';const protectTitle=document.createElement('summary');protectTitle.textContent='Account-protection checklist';protect.append(protectTitle);for(const step of window.fourDsOfficialAudit.safetyChecklist||[]){const line=document.createElement('p');line.className='muted';line.style.margin='6px 0';line.textContent='• '+step;protect.append(line)}host.append(protect);
 const sections=[['Pricing & sizes',{sizesUSD:audit.sizesUSD,pricesUSD:audit.pricesUSD,pricesEUR:audit.pricesEUR,pricingCurrency:audit.pricingCurrency,pricingFrequency:audit.pricingFrequency,priceVariantsUSD:audit.priceVariantsUSD,offerVariantsUSD:audit.offerVariantsUSD,activationFeesUSD:audit.activationFeesUSD,resetFeesUSD:audit.resetFeesUSD,backToFundedReactivationUSD:audit.backToFundedReactivationUSD,pricingNote:audit.pricingNote}],['Evaluation',audit.evaluation],['Maximum losses & daily breaches',audit.loss],['Margin, leverage & position caps',audit.margin],['Funded payouts and restrictions',audit.funded],['Trading restrictions & exceptions',audit.restrictions],['Account limits & model variants',audit.limits],['Purchase / program variants',audit.variants?{variants:audit.variants}:null]];
 const friendly=k=>k.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/USD/g,' USD').replace(/Percent/g,' %').replace(/^./,x=>x.toUpperCase());
 const value=v=>Array.isArray(v)?v.join(' / '):typeof v==='object'?Object.entries(v).map(([k,x])=>k+': '+String(x)).join(' | '):v===null?'Not specified in this source':String(v);
 for(const [title,obj] of sections){
  if(!obj||!Object.keys(obj).length)continue;
  const d=document.createElement('details');d.className='audit-subsection';if(title==='Maximum losses & daily breaches')d.open=true;
  const s=document.createElement('summary');s.textContent=title;d.append(s);
  for(const [key,val] of Object.entries(obj)){
   if(val===undefined)continue;
   const line=document.createElement('div');line.className='item';
   const k=document.createElement('span');k.textContent=friendly(key);
   const v=document.createElement('strong');v.textContent=value(val);
   v.style.whiteSpace='normal';v.style.overflowWrap='anywhere';
   line.append(k,v);d.append(line);
  }
  host.append(d);
 }
 const heading=document.createElement('p');heading.textContent='Official source references';heading.style.fontWeight='700';host.append(heading);
 for(const url of audit.sources||[]){if(!url.startsWith('https://'))continue;const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=new URL(url).hostname+' · '+new URL(url).pathname.split('/').pop().replaceAll('-',' ');const p=document.createElement('p');p.append(a);host.append(p)}
 const warn=document.createElement('p');warn.className='notice';warn.textContent='Unverified fields, exact futures contracts, broker margin, live instrument specifications, purchase-date variations and funded terms may still be missing. Do not infer trading permission or safety from this reference.';host.append(warn);
};
window.fourDsRenderResearchAccount=function(item,asOf){
if(!item)return;const rules=item.rules||{},limits=item.limits||{};
const name=item.firm+' · '+item.program+' · '+item.market;
document.getElementById('officialAccountTitle').textContent=name;
document.getElementById('officialDetailStatus').textContent='Research-only · source catalog '+(asOf||'undated');
const cards=document.getElementById('officialAccountHighlights');cards.replaceChildren();
const confirmed=window.fourDsOfficialAudit?.programs?.[item.id];for(const [label,val] of [['Account sizes',confirmed?.sizesUSD?.length?confirmed.sizesUSD.map(x=>'$'+Number(x).toLocaleString('en-US')).join(' / '):'Not verified'],['Published fees',confirmed?.pricesUSD?Object.entries(confirmed.pricesUSD).map(([k,v])=>'$'+Number(k).toLocaleString('en-US')+': $'+Number(v).toLocaleString('en-US')).join(' / '):'Not verified'],['Status','Research only'],['Market',item.market]]){
 const card=document.createElement('div');card.className='stat';const a=document.createElement('span');a.textContent=label;const b=document.createElement('b');b.textContent=val;card.append(a,b);cards.append(card);
}
const pretty=k=>k.replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase());
const display=v=>v===null||v===undefined?'Not verified':typeof v==='object'?JSON.stringify(v):String(v);
rows('officialEvaluationDetail',[
 ['Program',item.program],['Market',item.market],['Supported account sizes','Not verified in source catalog'],
 ...Object.entries(rules).map(([key,value])=>[pretty(key),display(value)]),
 ['Other evaluation conditions','Not yet verified; refer to the official program']
]);
rows('officialLimitDetail',[
 ...Object.entries(limits).filter(([key])=>key!=='source').map(([key,value])=>[pretty(key),display(value)]),
 ['Trading restrictions','News, copy trading, holding and platform limitations require source review'],
 ['Maximum simultaneous accounts','Not yet verified unless listed above']
]);
rows('officialPayoutDetail',[
 ['Purchase price','Not verified'],['Subscription / activation fees','Not verified'],
 ['Funded payout eligibility','Not verified'],['Reward split','Not verified'],
 ['Refunds and withdrawals','Not verified'],['Simulation readiness','Not connected: incomplete source values']
]);
const notes=document.getElementById('officialExtraNotes');notes.replaceChildren();const li=document.createElement('li');li.textContent=item.notes||'Provider conditions require review';notes.append(li);
const links=document.getElementById('officialLinks');links.replaceChildren();for(const [label,url] of [['Official program / provider reference',item.url],['Source for account limits',limits.source]]){
 if(typeof url!=='string'||!url.startsWith('https://'))continue;
 const p=document.createElement('p'),a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;p.append(a);links.append(p);
}
};
window.fourDsRenderOfficialAccount=function(programs,id,size,asOf){
const p=programs&&programs[id],n=Number(size);if(!p||!Number.isFinite(n)||n<=0)return;
const research=window.fourDsOfficialCatalog?.entries?.find(x=>x.id===id),lim=research?.limits||{},top=p.firm==='Topstep';
const mll=top?({50000:2000,100000:3000,150000:4500})[n]:p.max==null?null:n*p.max/100;
const t1=top?({50000:3000,100000:6000,150000:9000})[n]:p.targets?.length?n*p.targets[0]/100:null;
const heading=document.getElementById('officialAccountTitle');heading.textContent=p.firm+' · '+p.name+' · '+n/1000+'K · '+(research?.market||(top?'Futures':'CFD'));
document.getElementById('officialDetailStatus').textContent='Published snapshot '+(asOf||'undated');
const cards=document.getElementById('officialAccountHighlights');cards.replaceChildren();for(const [label,val] of [['Price',money(p.pricesUSD?.[n])+(top?' / month':'')],['First profit target',t1==null?'None':money(t1)],['Maximum loss',money(mll)],['Trader profit split',p.split||'Not verified']]){const card=document.createElement('div');card.className='stat';const a=document.createElement('span');a.textContent=label;const b=document.createElement('b');b.textContent=val;card.append(a,b);cards.append(card);}
rows('officialEvaluationDetail',[['Product category',p.market],['Account size',money(n)],['Phase count',p.targets?.length??'Unknown'],['Evaluation targets',p.targets?.length?p.targets.join('% → ')+'%':'No evaluation'],['Phase 1 target',t1==null?'None':money(t1)],['Phase 2 target',p.targets?.[1]!=null?money(n*p.targets[1]/100):'Not applicable'],['Minimum trading days',p.days?.length?p.days.join(' / '):'Not documented'],['Daily loss',p.daily==null?'Not specified separately':p.daily+'% · '+money(n*p.daily/100)],['Overall loss',top?money(mll)+' EOD trailing':p.max==null?'Not documented':p.max+'% · '+money(mll)],['Loss calculation',p.loss]]);
rows('officialLimitDetail',[['Maximum account allocation',lim.maxAllocationUSD?money(lim.maxAllocationUSD):null],['Active funded account cap',lim.maxActiveFunded],['Evaluation account cap',lim.maxTradingCombines===null?'None documented':lim.maxTradingCombines],['Allocation scope',lim.scope],['Funded trading risk',p.fundedRisk?p.fundedRisk+'%':null],['Trading-news restrictions','Check official provider conditions'],['Copy trading / weekend holding','Check official provider conditions'],['Region and trading platform','Check at provider checkout']]);
rows('officialPayoutDetail',[['Listed USD price',money(p.pricesUSD?.[n])],['Billing',top?'Monthly subscription':'One-time evaluation purchase (verify)'],['Alternative billing path',p.noActivation?.[n]!=null?money(p.noActivation[n])+' / month':null],['Refund',p.refund],['Trader split',p.split],['Funded winning days',research?.rules?.fundedStandardWinningDays],['Qualifying day profit',research?.rules?.fundedStandardMinWinningDayUSD!=null?money(research.rules.fundedStandardMinWinningDayUSD):null],['Gross payout cap',research?.rules?.fundedStandardMaxPayoutUSD!=null?money(research.rules.fundedStandardMaxPayoutUSD):null],['Payout frequency','Check selected program and funded status'],['Price caveat',p.priceNote]]);
const ul=document.getElementById('officialExtraNotes');ul.replaceChildren();for(const note of [...(p.notes||[]),...(research?.notes?[research.notes]:[])]){const li=document.createElement('li');li.textContent=note;ul.append(li);}
const links=document.getElementById('officialLinks');links.replaceChildren();for(const [label,url] of [['Official program page',p.source],['Price source',p.priceSource],['Research reference',research?.url],['Official allocation rules',lim.source]]){if(typeof url!=='string'||!url.startsWith('https://'))continue;const para=document.createElement('p'),link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=label;para.append(link);links.append(para);}
};
})();