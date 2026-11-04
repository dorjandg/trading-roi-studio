(function(){
"use strict";
function rows(id,items){const host=document.getElementById(id);if(!host)return;host.replaceChildren();for(const [label,value] of items){const item=document.createElement('div');item.className='item';const l=document.createElement('span');l.textContent=label;const v=document.createElement('strong');v.textContent=value===undefined||value===null||value===''?'Not verified in reference':String(value);item.append(l,v);host.append(item);}}
function money(v){return v===null||v===undefined||!Number.isFinite(Number(v))?'Not verified':'$'+Number(v).toLocaleString('en-US');}
window.fourDsRenderAudit=function(id){
 const host=document.getElementById('officialAuditDetails');if(!host)return;
 const audit=window.fourDsOfficialAudit?.programs?.[id];
 host.replaceChildren();
 if(!audit){const p=document.createElement('p');p.className='muted';p.textContent='Official audit is still loading, or is unavailable. Do not rely on missing details.';host.append(p);return;}
 const status=document.getElementById('officialAuditStatus');
 if(status)status.textContent=audit.status==='requires-variant-selection'?'VARIANT REQUIRED · not fully verified':'SOURCE-REVIEWED · verification incomplete';
 const intro=document.createElement('p');intro.className='muted';intro.textContent='Reference checked '+window.fourDsOfficialAudit.asOf+'. Review the exact account size, purchase date, market, platform and phase. This is not a broker risk controller.';host.append(intro);
 const sections=[['Pricing & sizes',{sizesUSD:audit.sizesUSD,pricesUSD:audit.pricesUSD,pricingNote:audit.pricingNote}],['Evaluation',audit.evaluation],['Maximum losses & daily breaches',audit.loss],['Margin, leverage & position caps',audit.margin],['Funded payouts and restrictions',audit.funded],['Trading restrictions & exceptions',audit.restrictions]];
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
for(const [label,val] of [['Account sizes','Not verified'],['Challenge price','Not verified'],['Status','Rules research only'],['Market',item.market]]){
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