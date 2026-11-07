/* 4Ds Portfolio Simulator · contextual field and KPI help.
   Presentation only: no model state, profile writes or order actions. */
(function(root){
'use strict';
const HELP_ID={
 budget:'Maximum initial cash allocated to challenge fees and activation costs.',
 netGoal:'Target net profit after modeled fees. Used to measure goal success.',
 winRate:'Assumed trade win rate for every firm and phase; not historical performance.',
 days:'Number of trading days simulated. Unfinished accounts remain unpaid.',
 signalPace:'Use 3/4/5/4/4 signals weekly or a fixed daily schedule.',
 tradesPerDay:'Trade opportunities per portfolio each trading day.',
 trials:'Number of Monte Carlo trials. More trials reduce sampling noise.',
 signalMode:'Independent account outcomes or shared signals across a firm.',
 seed:'Repeatable random seed for comparable simulation results.',
 purchaseMode:'Buy all evaluations on day zero or add/recycle them as needed.',
 capacityMode:'Automatic rotation or manual maximum active-account limits.',
 maxActive:'Maximum simultaneously active accounts when using manual limits.',
 maxBuysPerDay:'Maximum new challenge purchases allowed per trading day.',
 reinvestPayouts:'Allow first-payout cash to fund new evaluations.',
 ideaAccount:'Account whose saved risk stages are tested for better options.',
 ideaObjective:'Select the metric used to rank new strategy candidates.',
 ideaEffort:'Search depth: discovery trials and separate validation trials.',
 ideaReserve:'Extra cash protection held back from risk calculations.',
 gptReviewNote:'Optional question for the next GPT research review; not a trade.',
 studioUserSelect:'Selects whose locally saved trading profiles are displayed.'
};
const HELP_FIELD={
 id:'Firm and program whose saved stage settings this row uses.',
 size:'Notional account size; not cash you have deposited.',
 weight:'Share of budget allocated to this firm in split-budget mode.',
 evaluationCap:'Cap on total evaluation notional allocation. Blank means no cap.',
 fundedCap:'Cap on funded account notional allocation. Blank means no cap.',
 fundedTarget:'Planning profit target for first funded payout. Not a firm rule.',
 payoutWait:'Calendar-day waiting period measured from first funded trade.',
 payoutProcessing:'Assumed calendar days needed to process a payout request.'
};
const HELP_DATA={
 'data-chart-field':{
  selection:'Select the firm/account whose charts are displayed.',
  chartType:'Choose the chart metric without changing the simulation.',
  showBand:'Show or hide the selected chart range.',
  normalization:'Changes chart display units only.'
 },
 'data-journey-field':{
  selection:'Select an account or portfolio to inspect its day-by-day journey.',
  onlyChanges:'Show all trading days or only trades and stage changes.',
  pageSize:'Number of journey rows shown per page.',
  evaluationLimit:'What-if cap on total evaluation notional for this journey.',
  fundedLimit:'What-if cap on funded notional for this journey.',
  signalDay:'Trading day used to inspect assigned account signals.'
 },
 'data-ledger-field':{
  selection:'Choose the account or portfolio shown in the spending ledger.',
  pageSize:'Number of ledger rows shown per page.'
 },
 'data-history-field':{
  filter:'Filter this simulation trade/event history.',
  pageSize:'Number of trade-history rows displayed.',
  page:'Select a page of saved trade details.'
 },
 'data-discovery-sort':{
  key:'Sort suggested risk models by the selected result metric.'
 },
 'data-test-config':{
  policy:'Choose the risk tier sequence for this simulator-only test.',
  winCap:'Maximum wins allowed on one trading day in this test.'
 }
};
const HELP_LABEL={
 'prop firm & account':'Firm and challenge program used for this account row.',
 'account amount':'Nominal account size, not evaluation fee or available cash.',
 'evaluation allocation cap ($)':'Limits total evaluation notional held. Blank means no limit.',
 'funded allocation cap ($)':'Limits total funded notional held. Blank means no limit.',
 'funded payout profit target ($)':'Modeled profit threshold for a first payout. Separate from firm rules.',
 'payout wait from first funded trade (calendar days)':'Eligibility delay starting from the first funded trade.',
 'modeled payout processing (calendar days)':'Additional assumed payout-processing delay.',
 'safety reserve for this account (usd)':'Amount reserved from drawdown headroom in simulator-only tests.',
 'funded payout profit target (usd)':'Test-only funded goal; does not overwrite Firms.',
 'risk sequence approach':'Choose which risk tier follows wins and losses for this test.',
 'max wins per day':'Limit winning trades in one simulated trading day.',
 'current stage p/l ($)':'Starting realized profit/loss for the tested stage.',
 'trading days completed':'Previously completed trading days in this stage.',
 'max trades on a winning day':'Planner limit on trades on days with wins.',
 'max trades per option':'Maximum trade sequence length examined in this scenario.',
 'history':'Select which trade history entries are displayed.',
 'rows per page':'How many rows appear in this table at once.',
 'page':'Select the page of results to view.',
 'sort':'Changes result order, not risk or simulation outcomes.',
 'sort models by':'Orders discovered models by the selected KPI.',
 'days':'Select the number of trading days shown in the journey.',
 'account / portfolio':'Choose an account or the combined portfolio view.',
 'signal':'Select the signal to inspect.',
 'risk':'Cash amount lost when a trade stops at -1R.',
 'rr · reward / risk':'Profit multiple of risk for one winning trade.',
 'r1 · usd risk':'Cash risk for the first tier of this stage.',
 'r2 · usd risk':'Cash risk for the recovery tier.',
 'r3 · usd risk':'Cash risk for the third tier.',
 'r4 · usd risk':'Optional fourth risk tier; zero disables it.',
 'net':'Expected cash receipts minus fees.',
 'roi':'Expected net cash divided by fees spent.',
 'paid':'Number of accounts receiving their first modeled payout.',
 'funded':'Number of accounts activated into the funded stage.',
 'spent avg.':'Mean evaluation and activation fees spent across trials.',
 'phase 1 passes':'Expected accounts completing Phase 1 by the horizon.',
 'phase 2 passes':'Expected accounts completing Phase 2 by the horizon.',
 'chance ≥1 payout':'Fraction of simulations with one or more first payouts.',
 'payouts avg.':'Mean first-payout cash received across simulated trials.',
 'net avg.':'Mean first-cycle cash received minus fees spent.',
 'budget':'Cash reserved for this modeled account or portfolio.',
 'challenges':'Number of evaluations purchased in the simulation.',
 'firms':'Select the firm to compare.'
};
const HELP_KPI={
 'roi':'Net cash / incurred fees; a scenario estimate, not a guarantee.',
 'ev':'Expected net profit or loss per executed trade or evaluation as labeled.',
 'wr':'Winning executed trades / all executed trades.',
 'rr':'Risk-weighted planned reward-to-risk ratio.',
 'ar':'Average realized profit/loss per trade in R.',
 'pf':'Gross trade gains / gross trade losses.',
 'aw':'Average net amount earned on a winning trade.',
 'al':'Average absolute net amount lost on a losing trade.',
 'tc':'Average number of executed trades in one portfolio trial.',
 'net per week · horizon avg.':'Total net cash / simulated weeks. Not recurring income.',
 'fees / first payout':'All fees spent / completed first payout events.',
 'first payouts / challenges':'First paid accounts / purchased evaluations by the horizon.',
 'first payout day · conditional':'Mean first-payout day when at least one payout occurs.'
};
const trim=s=>String(s||'').replace(/\s+/g,' ').trim().replace(/\s*[ⓘℹ]$/,'');
const key=s=>trim(s).toLowerCase().replace(/\s*\([^)]*\)/g,m=>m.toLowerCase());
function labelText(label){
 if(!label)return '';
 // Labels wrapping selects should not swallow hundreds of option names.
 const parts=[];
 for(const node of label.childNodes||[]){
  if(node.nodeType===3)parts.push(node.textContent);
  else if(node.nodeType===1&&['STRONG','SMALL','SPAN'].includes(node.tagName)&&!node.classList?.contains('sim-help-i'))parts.push(node.textContent);
 }
 return trim(parts.join(' '))||trim(label.getAttribute('aria-label')||label.textContent).slice(0,95);
}
function controlInfo(el){
 if(!el||!el.getAttribute)return null;
 let field=el.closest('.field'),label=field?.querySelector('label')||el.closest('label');
 const name=labelText(label)||trim(el.getAttribute('aria-label')||el.getAttribute('placeholder')||'Parameter');
 let help=HELP_ID[el.id]||HELP_FIELD[el.dataset?.field];
 if(!help)for(const [attr,values] of Object.entries(HELP_DATA)){
  const choice=el.getAttribute(attr);if(choice&&values[choice]){help=values[choice];break;}
 }
 if(!help&&el.hasAttribute('data-test-reserve'))help='Simulator-only safety buffer; Firms settings are not changed.';
 if(!help&&el.hasAttribute('data-test-funded-target'))help='Simulator-only funded profit target.';
 if(!help&&el.hasAttribute('data-risk-level'))help='Risk tier used in this stage scenario; $0 disables the tier.';
 if(!help&&el.hasAttribute('data-test-risk'))help='Test-only trade risk amount. Does not overwrite Firms.';
 if(!help&&el.getAttribute('data-setting')==='rr')help='Reward multiple of risk used for wins in this stage.';
 if(!help)help=HELP_LABEL[key(name)];
 if(!help&&el.hasAttribute('data-discovery-sort'))help='Reorders suggested models only; does not change results.';
 if(!help&&el.hasAttribute('data-history-field'))help='Filters displayed history only; keeps saved simulations unchanged.';
 if(!help&&el.closest('#chartsContents,#journeyContents,#spendingLedgerContents'))help='Display filter only; does not change simulated outcomes.';
 if(!help&&el.closest('#details'))help='Simulation-only scenario input; does not change saved Firms risk settings.';
 if(!help&&el.closest('#accounts'))help='Controls how this account is modeled in Portfolio Simulator.';
 if(!help)help='Adjust this scenario control; rerun to recalculate if needed.';
 return {label:name,help,box:field||label||el};
}
function metricInfo(box){
 const label=trim(box.querySelector('small,b')?.textContent||box.getAttribute('aria-label')||'Result');
 const text=trim(box.getAttribute('title')||'');
 let help=HELP_KPI[key(label)]||HELP_LABEL[key(label)];
 if(!help&&text.includes(' · '))help=text.split(' · ').slice(1).join(' · ');
 if(!help&&text.includes(': '))help=text.slice(text.indexOf(': ')+2);
 if(!help)help='Modeled statistic from the selected scenario; not a historical guarantee.';
 return {label,help,box};
}
function headerInfo(th){
 const label=trim(th.querySelector('button')?.textContent||th.textContent).replace(/[▲▼⇅]/g,'').trim();
 const hint=trim(th.getAttribute('data-tooltip')||th.getAttribute('title')||'');
 const help=HELP_LABEL[key(label)]||HELP_KPI[key(label)]||hint||'Column value for the selected simulated scenario.';
 return {label,help,box:th};
}
function fromTarget(target){
 if(!(target instanceof Element))return null;
 if(target.closest('#simHelpPopup'))return null;
 const icon=target.closest('.sim-help-i');
 if(icon){
  const p=icon.closest('.sim-info-field,.sim-info-kpi');
  const c=p?.querySelector('input:not([type="hidden"]),select,textarea');
  return p?(c?controlInfo(c):metricInfo(p)):null;
 }
 const ctl=target.closest('input,select,textarea');
 if(ctl&&!ctl.matches('[type="radio"],[type="checkbox"],[type="hidden"]'))return controlInfo(ctl);
 const field=target.closest('.field');
 if(field){
  const c=field.querySelector('input:not([type="hidden"]),select,textarea');
  if(c&&!c.matches('[type="radio"],[type="checkbox"]'))return controlInfo(c);
 }
 const metric=target.closest('.kpi,.discovery-kpi,.result-grid>div,.weekly-kpis>div');
 if(metric)return metricInfo(metric);
 const th=target.closest('th');if(th)return headerInfo(th);
 const label=target.closest('label');
 if(label&&label.closest('#section1Panel,#discovery,#results,#section9Panel,#section8Panel,#gptResearchPanel')){
  const c=label.querySelector('input,select,textarea');
  if(c)return controlInfo(c);
 }
 return null;
}
function addHelp(node){
 if(!node||!node.querySelectorAll)return;
 let fields=[];
 if(node.matches?.('.field,.kpi'))fields.push(node);
 node.querySelectorAll('.field,.kpi').forEach(x=>fields.push(x));
 for(const box of fields){
  const field=box.matches('.field'),c=field?box.querySelector('input:not([type="hidden"]),select,textarea'):null;
  if(field&&(!c||c.matches('[type="radio"],[type="checkbox"]')))continue;
  if(box.querySelector(':scope > .sim-help-i'))continue;
  const btn=document.createElement('button');
  btn.type='button';btn.className='sim-help-i';btn.textContent='i';
  btn.setAttribute('aria-label','Explain '+(field?controlInfo(c).label:metricInfo(box).label));
  btn.setAttribute('aria-controls','simHelpPopup');
  btn.setAttribute('aria-expanded','false');
  btn.setAttribute('title','Explain this value');
  box.classList.add(field?'sim-info-field':'sim-info-kpi');
  box.appendChild(btn);
 }
}
function init(){
 if(!document.body||document.getElementById('simHelpPopup'))return;
 const pop=document.createElement('div');pop.id='simHelpPopup';pop.className='sim-help-popup';
 pop.setAttribute('role','tooltip');pop.hidden=true;
 const title=document.createElement('strong'),body=document.createElement('p');
 pop.append(title,body);document.body.appendChild(pop);
 let active=null,pinned=null;
 function hide(){
  active=null;pinned=null;pop.hidden=true;
  document.querySelectorAll('.sim-help-i[aria-expanded="true"]').forEach(b=>b.setAttribute('aria-expanded','false'));
 }
 function position(info){
  if(!info?.box?.isConnected){hide();return;}
  const r=info.box.getBoundingClientRect(),w=pop.getBoundingClientRect();
  const vw=root.innerWidth||document.documentElement.clientWidth||820;
  const vh=root.innerHeight||document.documentElement.clientHeight||720;
  let x=Math.max(7,Math.min(vw-w.width-7,r.left));
  let y=r.bottom+7;
  if(y+w.height>vh-7&&r.top>=w.height+7)y=r.top-w.height-7;
  pop.style.left=Math.max(7,x)+'px';
  pop.style.top=Math.max(7,Math.min(vh-w.height-7,y))+'px';
 }
 function show(info,lock){
  if(!info||!info.box)return;
  if(pinned&&pinned.box!==info.box&&!lock)return;
  if(lock&&pinned&&pinned.box!==info.box)hide();
  active=info;if(lock)pinned=info;
  title.textContent=info.label;body.textContent=info.help;
  pop.hidden=false;position(info);
  const btn=info.box.querySelector(':scope > .sim-help-i');
  if(btn)btn.setAttribute('aria-expanded',String(!!pinned));
 }
 function within(info,other){
  return !!(info?.box&&other instanceof Node&&info.box.contains(other));
 }
 document.addEventListener('mouseover',e=>{
  if(pinned)return;
  const info=fromTarget(e.target);
  if(info&&active?.box!==info.box)show(info,false);
 });
 document.addEventListener('mouseout',e=>{
  if(!pinned&&active&&!within(active,e.relatedTarget)&&within(active,e.target))hide();
 });
 document.addEventListener('focusin',e=>{
  if(pinned)return;
  const info=fromTarget(e.target);if(info)show(info,false);
 });
 document.addEventListener('focusout',e=>{
  if(!pinned&&active&&within(active,e.target)&&!within(active,e.relatedTarget))hide();
 });
 document.addEventListener('click',e=>{
  const btn=e.target.closest?.('.sim-help-i');
  if(btn){
   e.preventDefault();e.stopPropagation();
   const info=fromTarget(btn);
   if(!info)return;
   if(pinned?.box===info.box)hide();else show(info,true);
   return;
  }
  const info=fromTarget(e.target);
  // Plain result cards and headers can be tapped. Do not interrupt table sort buttons.
  if(info&&(info.box.matches('.kpi,.discovery-kpi,th,.result-grid>div'))&&!e.target.closest('button,a,select,input')){
   if(pinned?.box===info.box)hide();else show(info,true);
  }
 });
 document.addEventListener('pointerdown',e=>{
  if(pinned&&!within(pinned,e.target))hide();
 });
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape')hide();
  if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('.kpi,th[tabindex="0"]')){
   const info=fromTarget(e.target);
   if(info){e.preventDefault();if(pinned?.box===info.box)hide();else show(info,true);}
  }
 });
 root.addEventListener('scroll',()=>{if(active&&!pop.hidden)position(active);},true);
 root.addEventListener('resize',()=>{if(active&&!pop.hidden)position(active);});
 addHelp(document);
 if(typeof MutationObserver==='function'){
  const observer=new MutationObserver(records=>{
   for(const record of records)for(const n of record.addedNodes){
    if(n.nodeType===1&&n!==pop&&!n.classList.contains('sim-help-i'))addHelp(n);
   }
   if(active&&!active.box.isConnected)hide();
  });
  observer.observe(document.querySelector('.shell')||document.body,{childList:true,subtree:true});
 }
 root.StudioPortfolioHelp={version:'1',getHelp:fromTarget};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})(typeof window!=='undefined'?window:globalThis);