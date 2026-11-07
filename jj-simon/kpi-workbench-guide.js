/* JJ Academy — KPI Calculators guide and scenario interpretation.
   Educational model notes and separately source-attributed JJ course points.
   Does not change inputs, arithmetic, trading parameters or results. */
(function(){
'use strict';
const fieldHelp=[
 ['wb-win','Trade win rate %','Estimated percentage of comparable trades that win. Not the probability an entire evaluation passes.'],
 ['wb-gain','Winning USD','Average money won per winning trade (use net trade P&L after relevant execution costs).'],
 ['wb-loss','Losing USD','Average absolute money lost per losing trade, as a positive number.'],
 ['wb-pass','Eval pass %','Chance that one purchased evaluation passes all its modeled evaluation phases. Estimate from your own evaluation history.'],
 ['wb-funded','Funded payout %','Chance of receiving the modeled payout AFTER passing an evaluation and reaching a funded account.'],
 ['wb-fee','Eval fee USD','Purchase price for one evaluation attempt. Recurring resets, renewals and other fees are not separately modeled.'],
 ['wb-activation','Activation USD','Additional one-time cost on each successful evaluation pass; enter zero when none applies.'],
 ['wb-tries','Evaluations','Number of evaluation attempts purchased in the scenario, treated as statistically independent.'],
 ['wb-payout','Payout USD','Net money actually withdrawable and received on a successful funded path; not merely a funded profit target.'],
 ['wb-buffer','Loss buffer USD','The remaining usable loss cushion before violating the relevant loss boundary. Real rules can use live equity and trailing limits.'],
 ['wb-risk','Trade risk USD','Money exposed if one trade loses at its planned stop; spreads, slippage and open equity can change actual drawdown.'],
 ['wb-n','Stress-test trades','Number of future hypothetical trade outcomes for the losing-streak calculation. This is NOT your historical backtest sample size.']
];
const resultHelp=[
 ['Trade EV','Trade expectancy = (win rate × average winning trade) − (loss rate × average losing trade). Before any trade costs omitted from your inputs.'],
 ['Acquisition cost','Average evaluation purchase spending per funded account = eval fee ÷ eval pass probability + activation fee. Resets/renewals are excluded.'],
 ['Payout path','Probability a purchased evaluation both passes and eventually reaches the modeled funded payout = pass rate × conditional funded payout rate.'],
 ['At least 1 payout','Probability of at least one modeled payout path among purchased evaluations = 1 − (1 − payout path probability) ^ evaluation count, assuming independence.'],
 ['Net EV','Expected total modeled cash profit across all purchased evaluations: evaluation count × (payout-path probability × net payout − fee − pass probability × activation). Other costs are not included.'],
 ['Net ROI','Modeled net EV divided by modeled evaluation/activation spending. An expectation, not a forecast or actual realized return.'],
 ['Losses to breach','Approximate consecutive full stop losses required to consume the input buffer = ceiling(buffer ÷ per-trade risk). Real intratrade equity breaches may happen sooner.'],
 ['Losing streak probability','Probability of seeing that many consecutive losses at least once during the stated future-trade horizon, under independent identical trade outcomes. NOT the full probability of account failure.']
];
const lessons=[
 {
  title:'Estimate your own probabilities instead of adopting fixed percentages.',
  body:'JJ discusses pass rate as evaluations passed ÷ evaluations attempted, and suggests roughly 20 attempts as an initial sample. Twenty attempts are not enough to establish a precise or stable probability.',
  source:'Managing Resets, Billing Cycles Across Multiple Futures Funded Accounts · evaluation statistics',
  url:'https://drive.google.com/file/d/1pdmFifqByLbI75-XtX0C53vMiCGR4-i-/view'
 },
 {
  title:'Separate the cost of buying an evaluation from the cost of securing a funded account.',
  body:'JJ illustrates cost per funded account using the evaluation fee and measured pass probability, adding activation fees where applicable. The acquisition-cost result is not a prediction of payouts.',
  source:'Prop Firm Math Stats · 00:44–01:10',
  url:'https://drive.google.com/file/d/1bzGIqxU1BCDPqKblORKaCUsjRFMsMBVs/view'
 },
 {
  title:'Calculate the probability of getting no payout before increasing purchases.',
  body:'His course frames a limited bankroll as multiple possible attempts with failure risk. Two lessons discuss different personal low-risk thresholds (approximately 5% ruin risk versus 0.5% no-payout probability); these metrics are different and should not be combined into one universal JJ rule.',
  source:'Risk Of Ruin Bankroll Management · 11:20–11:45; Prop Firm Math Stats · 06:22–07:35',
  url:'https://drive.google.com/file/d/1VOJtRPDpy9LB4UakPYfZChROyAtPLQfv/view',
  alternate:{text:'Compare second source',url:'https://drive.google.com/file/d/1bzGIqxU1BCDPqKblORKaCUsjRFMsMBVs/view'}
 },
 {
  title:'Track real spending, payouts, replacements and upcoming renewal dates.',
  body:'JJ describes recording purchase price, evaluation outcome, firm-level withdrawals and billing/reset dates. This workbench excludes ongoing renewal bills, many resets and actual calendar timing, so use a separate cash-flow ledger.',
  source:'Managing Resets, Billing Cycles Across Multiple Futures Funded Accounts · 00:12–04:19',
  url:'https://drive.google.com/file/d/1pdmFifqByLbI75-XtX0C53vMiCGR4-i-/view'
 },
 {
  title:'Account-copying can invalidate the independent-attempt formula.',
  body:'JJ describes copied evaluations passing or failing together. Do not interpret the “at least one payout” percentage as diversification across independent accounts when the same trade is copied into all of them.',
  source:'Managing Resets, Billing Cycles Across Multiple Futures Funded Accounts · 00:29–00:43',
  url:'https://drive.google.com/file/d/1pdmFifqByLbI75-XtX0C53vMiCGR4-i-/view'
 }
];
const percent=x=>(100*x).toFixed(1)+'%';
const money=x=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(x);
function text(tag,value,cls){
 const node=document.createElement(tag);
 if(value!==undefined)node.textContent=value;
 if(cls)node.className=cls;
 return node;
}
function section(title,opened){
 const container=document.createElement('details');container.className='jj-kpi-guide-section';
 container.open=!!opened;
 const s=text('summary',title);
 const body=document.createElement('div');body.className='jj-kpi-guide-section-content';
 container.append(s,body);
 return {container,body};
}
function glossary(body,items){
 const dl=text('dl',undefined,'jj-kpi-glossary');
 for(const row of items){
   dl.append(text('dt',row[1]),text('dd',row[2]));
 }
 body.append(dl);
}
function buildGuide(wb){
 const intro=text('div','How to use: enter your trade statistics, then evaluation/payout assumptions, and compare expectancy with failure risk. Tap the guide below for JJ course references.','jj-kpi-start');
 const fields=wb.querySelector('.calc-fields');
 if(fields)wb.insertBefore(intro,fields);
 const guide=document.createElement('details');guide.className='jj-kpi-guides';
 const summary=document.createElement('summary');
 summary.append(text('span','How to use this calculator · JJ suggestions'),text('span','Steps · definitions · current scenario · course sources','jj-kpi-summary-note'));
 guide.append(summary);
 const body=text('div',undefined,'jj-kpi-guide-body');
 body.append(text('p','All panels below are optional. Your inputs and calculator outputs remain visible while these explanations are closed.'));
 const start=section('1 · Start here — 3 steps',true);
 start.body.innerHTML='<ol><li><strong>Trade quality:</strong> Enter an estimated win rate plus average winning and losing USD values. Read <strong>Trade EV</strong>. These are per-trade figures, not account payouts.</li><li><strong>Account economics:</strong> Enter how often an evaluation passes, how often a funded account actually pays out, your fees, total attempts and the <strong>withdrawable payout</strong>. Compare <strong>Acquisition cost, Payout path, Net EV and Net ROI</strong>.</li><li><strong>Survival stress:</strong> Enter the remaining loss cushion, risk for one trade and a future horizon. Read <strong>Losses to breach</strong> and the <strong>losing-streak probability</strong>, remembering that it is not full risk of ruin.</li></ol><p class="jj-kpi-alert">The three calculations answer different questions; a positive trade EV does not by itself imply profitable prop-account economics.</p>';
 body.append(start.container);
 const inputs=section('2 · What every input means');
 glossary(inputs.body,fieldHelp);
 body.append(inputs.container);
 const outputs=section('3 · How to interpret every result');
 glossary(outputs.body,resultHelp);
 outputs.body.insertAdjacentHTML('beforeend','<div class="jj-kpi-formula"><strong>Example from JJ\'s probability framework:</strong> $100 evaluation fee × 1 purchase, 25% pass rate, 50% conditional funded payout chance, $1,000 withdrawable payout, and $0 activation. Payout-path chance = 12.5%; expected net per purchase = 0.125 × $1,000 − $100 = <strong>+$25</strong>, before omitted fees. This is a hypothetical probability model, not a guarantee.</div>');
 body.append(outputs.container);
 const jj=section('4 · JJ course suggestions (source-linked)');
 const ul=document.createElement('ul');
 lessons.forEach(item=>{
   const li=document.createElement('li');
   li.append(text('strong',item.title),text('p',item.body));
   const a=text('a',item.source);a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';
   li.append(a);
   if(item.alternate){li.append(text('span',' · '));const second=text('a',item.alternate.text);second.href=item.alternate.url;second.target='_blank';second.rel='noopener noreferrer';li.append(second)}
   ul.append(li);
 });
 jj.body.append(ul,text('p','Source notes paraphrase historical JJ course explanations. They are not verified up-to-date prop firm rules or universally recommended risk settings.','jj-kpi-alert'));
 body.append(jj.container);
 const scenario=section('5 · What your current numbers suggest');
 const notes=text('div',undefined,'jj-kpi-scenario');
 notes.id='jj-kpi-scenario';
 scenario.body.append(text('p','Calculated from your own inputs. These are model diagnostics, not statements by JJ.'),notes);
 body.append(scenario.container);
 guide.append(body);
 if(fields)wb.insertBefore(guide,fields);else wb.append(guide);
 for(const [id,name,description] of fieldHelp){
   const input=wb.querySelector('#'+id);
   if(input){input.title=name+': '+description;input.setAttribute('aria-description',description);}
 }
 wb.addEventListener('input',event=>{
   if(event.target.matches('input[id^="wb-"]'))setTimeout(()=>{decorateResults(wb);updateScenario(wb)},0);
 });
 decorateResults(wb);updateScenario(wb);
}
function decorateResults(wb){
 const tiles=wb.querySelectorAll('#wb-outputs > div');
 resultHelp.forEach((a,i)=>{
   if(!tiles[i])return;
   tiles[i].title=a[1];
   tiles[i].setAttribute('aria-description',a[1]);
 });
}
function updateScenario(wb){
 const out=wb.querySelector('#jj-kpi-scenario');
 if(!out)return;
 const val=id=>Number(wb.querySelector('#'+id)?.value);
 const p=val('wb-win')/100,gain=val('wb-gain'),loss=val('wb-loss'),pass=val('wb-pass')/100,
       payout=val('wb-funded')/100,fee=val('wb-fee'),act=val('wb-activation'),
       tries=val('wb-tries'),amount=val('wb-payout'),buffer=val('wb-buffer'),risk=val('wb-risk'),n=val('wb-n');
 out.replaceChildren();
 if(![p,gain,loss,pass,payout,fee,act,tries,amount,buffer,risk,n].every(Number.isFinite)||
    p<=0||p>=1||pass<=0||pass>=1||payout<=0||payout>=1||
    gain<0||loss<=0||fee<0||act<0||tries<1||amount<0||buffer<=0||risk<=0||n<1){
   out.append(text('p','Enter valid input values to see scenario-specific findings.'));return;
 }
 const e=p*gain-(1-p)*loss;
 const breakEven=loss/(gain+loss);
 const path=pass*payout;
 const noPayout=(1-path)**tries;
 const perPurchase=path*amount-fee-pass*act;
 const k=Math.ceil(buffer/risk);
 const bullets=[
   'Trade EV: '+money(e)+' per trade under your stated win/loss values. Break-even win rate for those amounts is about '+percent(breakEven)+'. '+(e>0?'Positive model expectancy is not a guarantee of future wins.':e===0?'The modeled trade expectancy is break-even before omitted costs.':'The model has negative trade expectancy; review the measured win/loss assumptions before interpreting any account results.'),
   'Payout pathway: '+percent(path)+' per purchased evaluation. With '+Math.floor(tries)+' independent purchases, the modeled chance of NO payout is '+percent(noPayout)+'. Copy trading or regime shifts can make independence unrealistic.',
   'Modeled cash result: '+money(perPurchase)+' expected net per evaluation before omitted fees, resets, splits, taxes and time. '+(perPurchase<0?'The modeled payout amount and success rate do not currently cover your stated acquisition costs.':'Check that your payout is actual withdrawable cash rather than a profit target.'),
   'Risk stress: one full loss uses '+percent(risk/buffer)+' of the entered loss buffer, with approximately '+k+' consecutive full losses consuming it. Commissions, intratrade equity rules and trailing drawdown can shorten the real path.'
 ];
 const list=document.createElement('ul');
 for(const item of bullets)list.append(text('li',item));
 out.append(list);
 out.append(text('p','These diagnostics are based on the entered assumptions. JJ\'s documented process suggestions are in section 4; specific numerical cutoffs above are mathematical comparisons, not JJ-prescribed settings.','jj-kpi-alert'));
}
function mount(){
 const wb=document.querySelector('.jj-workbench');
 if(!wb||wb.querySelector('.jj-kpi-guides'))return;
 buildGuide(wb);
}
if(typeof render==='function'){
 const previousRender=render;
 render=function(){previousRender();mount();};
}
mount();
})();