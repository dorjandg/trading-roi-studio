/* JJ Academy: source-backed reference plans. Teaching examples, NOT
   an audited record of JJ's results, a provider recommendation or a forecast.
   These standalone chapters keep the $10K/$20K/$30K funded-inventory
   heuristic separate from the advanced $100K cash-out projection. */
(() => {
 'use strict';
 const sources={
  inventory:['The Optimal Number of Accounts To Manage','00:04–00:42; 01:36–03:10; 03:44–04:18','11nOzXqPVWcTMHX6cpQivsM7StZVrtbZM'],
  roadmap:['0–10K/month Roadmap','02:02–03:31','1ckmp-lBqjugMPTsGshIi-rAbQVnnjo0m'],
  math:['Prop Firm Math Stats','00:25–01:16; 02:44–07:16','1bzGIqxU1BCDPqKblORKaCUsjRFMsMBVs'],
  risk:['Risk Of Ruin Bankroll Management','00:31–01:26; 03:25–04:50','1VOJtRPDpy9LB4UakPYfZChROyAtPLQfv'],
  trade:['How To Trade Funded Accounts','00:10–00:56; 02:14–02:59','17fchw1QnO1uG_FxO5QDL-p6-2fB35R49'],
  second:['How To Trade Fundeds For 50 Points','00:00–04:31','13vOa_M7FBB3KK9L0wSP206x3I9eDwaBR'],
  scaling30:['10K/month → 30K/month Scaling','00:29–02:23; 03:43–04:50','1qZ6MdjEXqSX7dSCLFlXONa1MEl6XavlD'],
  tradecount:['How Many Trades Per Day?','00:00–04:18','1cdESUiP_6dF8s8VZjVKBmVa2a8ey4kve'],
  scaling100:['30K/month → 100K/month Scaling','00:00–00:58; 03:06–06:00','1gKSrmr2naboKQWfZmHCF7OBrArdhf0s0'],
  accounts:['When To Start Scaling Your Futures Accounts','01:11–04:24; 06:06–08:07','17EZLclVchKlDr9T6V5-rLLM1lopwb_TL']
 };
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const link=key=>{
  const s=sources[key];return s?'<a title="'+esc(s[0]+' · '+s[1])+'" target="_blank" rel="noopener noreferrer" href="https://drive.google.com/file/d/'+encodeURIComponent(s[2])+'/view">'+esc(s[0])+' · '+esc(s[1])+'</a>':'';
 };
 const money=x=>'$'+Number(x).toLocaleString('en-US',{maximumFractionDigits:0});
 const pct=x=>(100*x).toFixed(1)+'%';
 const plans=[
  {slug:'jj-plan-10k',label:'$10K',target:10000,accounts:5,purchases:15,intro:'The initial active-funded-account income example. JJ also teaches a separate 0→10K roadmap using ten NEWLY funded accounts; both appear here with their differences explained.',status:'Income-target illustration, not audited JJ monthly income',course:['inventory','roadmap','trade','second','math','risk','tradecount']},
  {slug:'jj-plan-20k',label:'$20K',target:20000,accounts:10,purchases:30,intro:'JJ’s ten-active-funded-account illustration, with the same $2K-per-active-funded monthly assumption. Detailed trade performance and payout rates are not established.',status:'Account-count illustration, not personal JJ results',course:['inventory','math','trade','second','tradecount']},
  {slug:'jj-plan-30k',label:'$30K',target:30000,accounts:15,purchases:45,intro:'The larger 15-active-funded target. JJ also describes a staged 10K→30K scaling process and an actual $30K profit month as a checkpoint before larger funded programs.',status:'Scaling illustration with stage-specific assumptions; not verified payouts',course:['inventory','scaling30','accounts','trade','second','tradecount']},
  {slug:'jj-plan-100k',label:'$100K',target:100000,intro:'A different, advanced cash-flow projection: approximately $50K of evaluation spending toward $150K gross payouts. Not a validated $100K monthly-income plan.',status:'Separate advanced cash projection, NOT an audited month',course:['scaling100','accounts','math','risk']}
 ];
 // Exact probability of K or more independent evaluation passes out of N.
 // This is not the probability of maintaining K active funded accounts or
 // receiving the required monthly payout amount.
 function atLeast(n,k,p){
  if(k<1)return 1;
  let probabilities=Array(n+1).fill(0);probabilities[0]=1;
  for(let i=0;i<n;i++){
   const next=Array(n+1).fill(0);
   for(let j=0;j<=i;j++){
    next[j]+=probabilities[j]*(1-p);
    next[j+1]+=probabilities[j]*p;
   }
   probabilities=next;
  }
  return probabilities.slice(k).reduce((a,b)=>a+b,0);
 }
 function cells(headers,rows){
  return '<div class="jj-stats-scroll"><table class="jj-stats-table"><thead><tr>'+
   headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
   rows.map(row=>'<tr>'+row.map((c,i)=>'<td'+(i===0?' class="jj-stats-metric"':'')+'>'+esc(c)+'</td>').join('')+'</tr>').join('')+
   '</tbody></table></div>';
 }
 function details(title,content,open=false){
  return '<details class="jj-stats-group"'+(open?' open':'')+'><summary>'+esc(title)+'</summary><div class="jj-stats-panel">'+content+'</div></details>';
 }
 function sourceList(keys){
  return '<div>'+keys.map(k=>'<div class="jj-plan-source">'+link(k)+'</div>').join('')+'</div>';
 }
 function kpis(cards){
  return '<div class="jj-plan-kpis">'+cards.map(([label,value])=>
   '<div class="jj-plan-kpi"><strong>'+esc(value)+'</strong><small>'+esc(label)+'</small></div>'
  ).join('')+'</div>';
 }
 function nav(){
  return '<div class="jj-plan-shortcuts">'+plans.map(p=>
   '<a href="?topic='+p.slug+'" data-jj-plan="'+p.slug+'"><strong>'+p.label+' plan</strong><small>'+
   (p.accounts? p.accounts+' active fundeds · '+p.purchases+' illustrative evals':'Advanced cash spending → payouts')+
   '</small></a>'
  ).join('')+'</div>';
 }
 function commonTradeTable(){
  return cells(['Stage / setup','Risk, stop & instrument','Gross target','JJ rationale and limitations'],[
   ['Evaluation','No universal dollar-risk setting documented for all firms','Passing the chosen evaluation','Rules, goals and trade sizing depend on provider and account stage.'],
   ['New funded · 100-point path','2 NQ × 25-point stop = $1,000 nominal risk','2 NQ × 100 points = +$4,000 (4R)','NY reversion example when enough room exists toward fair price; not every BOS.'],
   ['New funded · first 50-point path','2 NQ × 25-point stop = $1,000 risk','2 NQ × 50 points = +$2,000 (2R)','Alternative when 100-point opportunities are unavailable.'],
   ['After initial 50-point WIN','Conditional second trade risks about $2,000','Additional +$2,000 (1R)','+4K cumulative after win, ~0 after loss; commissions excluded.'],
   ['After initial 50-point LOSS','Recovery trade risks about $1,000','Around +$1,000 to return toward breakeven','After two losses account can be -$2,000; high-risk account path.'],
   ['Winning days / payout','Firm-specific, smaller risk examples in other lessons','Eligibility / withdrawable cash unknown','A profitable trading day is not automatically a paid withdrawal.']
  ]);
 }
 function funnel(p){
  const n=p.purchases,count=p.accounts,pass=.33;
  return cells(['Stage','Plan reference','How to read this'],[
   ['Income goal',money(p.target)+' / month','JJ’s illustrative PROFIT / income target, not guaranteed net cash paid by a prop firm.'],
   ['Active funded inventory',String(count)+' accounts','JJ’s account-management heuristic; active funded ≠ purchased evaluations ≠ successful payouts.'],
   ['Purchased challenges',n+' illustrative evaluations','Approximate starting purchases at 33% example pass rate; not an order to buy all at once.'],
   ['Expected evaluation passes', (n*pass).toFixed(2),'Formula: '+n+' × 0.33. Expected passes, not a promise of '+count+' live funded accounts.'],
   ['At least '+count+' evaluation passes',pct(atLeast(n,count,pass))+' probability','Binomial illustration only if each purchase independently passes with stable 33% probability. NOT the monthly-goal success rate.'],
   ['Newly funded trading','As many successful passes as remain eligible','Funding, stop losses, activation, trailing limits, buffer and qualification can eliminate accounts.'],
   ['Paid cash received','Unknown in the indexed evidence','Provider payout rules, splits, minimum trading days, account survival and actual performance are required.'],
   ['Replacement inventory','Not fixed','JJ discusses buying additional evaluations when fundeds fail or need rebuilding; include costs and availability.']
  ]);
 }
 function commonBudget(p){
  const evalFee=100,spent=p.purchases*evalFee, expected=p.purchases*.33;
  return '<p class="jj-plan-inline">A <strong>worked purchasing example</strong>, not JJ’s recorded fee or a current prop-firm price: if each evaluation costs $100, the modeled purchase spending is <strong>'+money(spent)+'</strong> ('+p.purchases+' × $100). At the example 33% pass rate, the expected funded qualifications are '+expected.toFixed(2)+'. Activation fees, resets, renewals, failed-funded replacement, platform fees, taxes and time are extra.</p>'+
   cells(['Cash item','Illustration','Qualification'],[
    ['Initial evaluation fees',money(spent),'Excludes all resets, renewals and additional purchases.'],
    ['Expected activation charges','Not specified','Expected activation cash ≈ '+expected.toFixed(2)+' successful passes × actual activation fee, if payable.'],
    ['Monthly account profit',money(p.target)+' goal','This is not necessarily withdrawable or already received; provider splits and payout gates apply.'],
    ['Net cash profit','Not established','Actual received payouts − purchase/activation/renewal/other cash outlays. No audited amounts available.']
   ]);
 }
 function standardPlan(p){
  const is10=p.accounts===5,is30=p.accounts===15;
  const root='<div class="jj-plan-view">'+
   '<div class="jj-plan-hero"><h3>'+p.label+' monthly target · full JJ reference plan</h3><p>'+esc(p.intro)+'</p>'+
   '<p><strong>Evidence label:</strong> JJ lesson description + clearly marked Academy calculations. No independently verified JJ income, complete historical win rate or prop-firm payout record.</p>'+
   '<div class="jj-plan-links"><a href="?topic=jj-kpi-reference" data-jj-plan="jj-kpi-reference">All plans & statistics</a><a href="?topic=calc-acquisition" data-jj-plan="calc-acquisition">Evaluation calculator</a></div></div>'+
   kpis([['Illustrative monthly profit',money(p.target)],['Target active funded',String(p.accounts)],['Example evaluation purchases',String(p.purchases)],['Assumed evaluation pass rate','33%']])+
   details('01 · Goal, assumptions and what JJ actually said',
    '<p class="jj-plan-inline">JJ describes approximately <strong>'+p.accounts+' active funded accounts</strong> at this level and an average of <strong>$2,000 monthly profit per active funded account</strong>. This is a planning rule-of-thumb, not his verified current payout rate. The evaluation purchase counts shown here are <strong>Academy calculations</strong> under a separate illustrative 33% evaluation pass probability.</p>'+
    '<p class="jj-plan-inline">Account stages are distinct: bought evaluation → qualified evaluation → newly funded → payout-eligible funded → actual cash received. Losing accounts and replacement challenges reduce the number remaining active.</p>'+
    sourceList(['inventory','math']),true)+
   details('02 · Complete account funnel, challenge count and chance of qualifying',
    funnel(p)+'<p class="jj-plan-inline">The binomial percentage only measures obtaining at least '+p.accounts+' successful EVALUATION passes by '+p.purchases+' purchases. It does not include activation, funded losses, payout eligibility, the time needed or correlated copy-trading outcomes.</p>')+
   details('03 · Challenge spending, fees and real ROI',commonBudget(p))+
   details('04 · JJ’s trading examples at each account stage',
    commonTradeTable()+'<p class="jj-plan-inline">These are sample trades described for NQ and historical 50K-style funded accounts, not universal risk settings. Source data needs original chart and current firm-rule checks. Different stages have different allowable risk.</p>'+sourceList(['trade','second']))+
   details('05 · Trade scheduling, setups and active-account management',
    '<p class="jj-plan-inline">JJ favors suitable New York morning mean-reversion opportunities for the larger 100-point funded attempt. He describes a separate paired 50-point pathway and occasional overnight opportunities. The opportunities are conditional on price room, structure, news and time; they cannot be assumed to occur on every trading day. Evaluation and funded entries may require different quality thresholds.</p>'+
    '<p class="jj-plan-inline">One account used for a signal is not the same as one account funded forever. Rotate real opportunities through available stage-eligible accounts, avoid putting every funded account in the same copied high-risk position, and replenish accounts that no longer qualify.</p>'+
    sourceList(['tradecount','trade','second']))+
   (is10?details('06 · Important: JJ’s OTHER 0→$10K roadmap is different',
    '<p class="jj-plan-inline">In a separate roadmap, JJ models <strong>ten NEW funded accounts</strong> with up to two $1,000-risk trades each, a hypothetical <strong>20% win rate</strong> and $4,000 first-win target. This is NOT the five-active-funded/monthly-profit inventory rule.</p>'+
    '<p class="jj-plan-inline">Under a stop-after-first-win policy: P(success by trade 2) = 1 − 0.8² = <strong>36%</strong> per account. Ten such accounts produce <strong>3.6 successful accounts in expectation</strong>, and about 18 actual trades rather than an unconditional 20. A research audit shows the simplified gross account EV is <strong>$0 per fresh account before fees</strong> at those assumptions, so the video’s illustrative 4-wins/20-trades arithmetic must not be treated as audited net profits.</p>'+sourceList(['roadmap'])):'')+
   (is30?details('06 · How JJ describes scaling from $10K to $30K',
    '<p class="jj-plan-inline">JJ’s scaling lesson discusses having enough separate funded accounts to allocate different opportunity families: a NY morning 100-point path, an overnight opportunity aligned with bias, and an alternative two-stage 50-point path. This is a portfolio illustration, <strong>not three guaranteed trades every day</strong>.</p>'+
    '<p class="jj-plan-inline">He discusses copying evaluations only when inventory becomes large enough to make individual execution difficult (around fifteen evaluations in one example). Copied outcomes are correlated. For new funded accounts, JJ warns against simultaneously copying large-risk trades. A historical $30K PROFIT month is also described as a possible readiness checkpoint for moving toward larger-account programs, not proof of a $30K withdrawal.</p>'+sourceList(['scaling30','accounts'])):'')+
   (p.accounts===10?details('06 · What changes between the $10K and $20K examples',
    '<p class="jj-plan-inline">The ten-active-funded target is JJ’s linear illustration of the same per-account $2,000 monthly profit assumption. The number of available qualifying trade opportunities, evaluation costs, funded-account survival and payout restrictions do NOT necessarily double proportionally with the account count. No separate audited $20K strategy win rate is established by the existing transcript research.</p>'+sourceList(['inventory'])):'')+
   details('07 · Critical unknowns before treating this as a real plan',
    '<ul class="jj-stats-checks"><li>JJ’s actual overall win rate by setup and account stage: <strong>not verified</strong>.</li><li>His real evaluation pass-rate history and funded-to-payout conversion: <strong>not verified</strong>.</li><li>Current evaluation prices, account limits, activation / reset fees, trailing equity rules: <strong>provider-dependent and not confirmed here</strong>.</li><li>Timing to pass, replenish, meet winning days and receive payout cash: <strong>not determined</strong>.</li><li>Whether all account outcomes are truly independent: <strong>not established</strong>.</li><li>Historical actual JJ bank payouts, months needed and drawdowns: <strong>not independently audited</strong>.</li></ul>'+
    '<p class="jj-plan-inline">Use the live acquisition calculator for YOUR measured pass rate, fees and payout size. Do not substitute a course example win rate for personal trading statistics.</p>'+
    sourceList(p.course))+
   '</div>';
  return root;
 }
 function advancedPlan(p){
  const root='<div class="jj-plan-view">'+
   '<div class="jj-plan-hero"><h3>Advanced $100K target · full JJ reference plan</h3><p>'+esc(p.intro)+'</p>'+
   '<p><strong>Important:</strong> this is <strong>$100K modeled net difference</strong> after $50K evaluation spending, before other costs—not evidence of $100K received in one month or JJ’s personal trading record. It must not be confused with $100K of gross payouts.</p>'+
   '<div class="jj-plan-links"><a href="?topic=jj-kpi-reference" data-jj-plan="jj-kpi-reference">All plans & statistics</a><a href="?topic=jj-plan-30k" data-jj-plan="jj-plan-30k">$30K scaling context</a></div></div>'+
   kpis([['Example purchase spending','$50,000'],['JJ payout goal','$150,000 gross'],['Difference, before other fees','$100,000'],['Gross payout / spend','3.0×']])+
   details('01 · What the advanced lesson claims and does NOT claim',
    '<p class="jj-plan-inline">JJ describes a historical capital-allocation exercise: approximately <strong>$50K</strong> spent on evaluations aiming for <strong>$150K</strong> of gross payout receipts. The implied net difference is $100K before activation, renewals, resets, trading costs, splits/taxes not already included, time and any additional expenses. <strong>Net ROI on evaluation spending is 200%, not 300%</strong>, if both numbers are actually achieved. These are NOT independently audited outcomes.</p>'+sourceList(['scaling100']),true)+
   details('02 · Full evaluation-to-payout funnel',
    cells(['Stage','Course / derived figure','Qualification'],[
     ['Spending commitment','$50,000 illustrative evaluation budget','Cash exposure in the course’s illustrative expansion, not an approved personal budget.'],
     ['Individual eval purchase price','$250 per evaluation EXAMPLE','Used for arithmetic only; no current provider price verified.'],
     ['Purchases that $50K could fund','200 eval purchases (= 50,000 ÷ 250)','A theoretical purchase count, not the number that JJ actually bought or passed.'],
     ['Evaluation passes','Unknown / not established','Cannot derive from the 200 purchases without an appropriate measured pass rate.'],
     ['Funded accounts surviving','Unknown / not established','Requires stages, loss limits, buffer building, and failures after passing.'],
     ['Eligible withdrawals','$150,000 GROSS modeled goal','Source-dependent projection; payout caps, splits and payment schedule are unverified.'],
     ['Cash difference before extra costs','$100,000 (= 150,000 − 50,000)','The difference is not guaranteed net cash and not shown as monthly verified income.'],
     ['Return on fee spending','200% net ROI before omitted costs','Gross payout multiple = 3.0×; net ROI = (150K−50K)/50K.']
    ]))+
   details('03 · Larger funded account trading example',
    cells(['Instrument','Stop / contracts','Nominal risk','Gross target','Reward / risk'],[
     ['NQ on larger funded account','3 NQ × 37.5 index points','$2,250','3 NQ × 150 points = $9,000','4R before execution costs']
    ])+
    '<p class="jj-plan-inline">JJ describes this historical larger-account illustration as needing sufficient fair-price room; a setup with ~87 points may not be suitable for a full 150-point target. Do not treat this as permission to risk an account’s full allowed drawdown. Original fills and current provider rules were not verified.</p>'+sourceList(['scaling100']))+
   details('04 · Implementation stages and cash-control checkpoints',
    cells(['Stage','Reference approach','What must be confirmed'],[
     ['Establish cash reserve','Track fee spending, resets and renewals','Provider prices, account cap, activation, limits, correlation and affordability.'],
     ['Acquire evaluations','Buy only the amount the budget and opportunity flow permit','Actual pass rate, correlated outcomes and time.'],
     ['Pass / activate fundeds','Maintain separate counts by account stage','Funding fees, drawdown and live-versus-simulated accounts.'],
     ['Execute funded opportunities','Use setup-appropriate strategy, risk and confirmation','No universal course-wide risk or win probability is proven.'],
     ['Meet payout conditions','Separate eligible profit from cash received','Winning-day, cap, payout split, waiting period, consistency and provider rules.'],
     ['Measure net cash','Received funds less all real cash spending','A $150K gross payout projection can produce less than $100K net after omitted expenses.']
    ])+
    sourceList(['scaling100','accounts']))+
   details('05 · What is missing / why the 5-fundeds-per-$10K ladder is not used',
    '<p class="jj-plan-inline">This advanced model is a <strong>cash investment versus future payout projection</strong>, while the $10K/$20K/$30K ladder is a <strong>monthly-profit versus active-funded-account illustration</strong>. It would be invalid to assert the advanced plan requires 50 active fundeds, exactly 200 successes, or a guaranteed one-month completion date.</p>'+
    '<p class="jj-plan-inline">No audited personal JJ win rate, observed 200-purchase pass rate, full cash budget ledger, sequence of trading days, funded success frequency or received payout statements are established by the indexed source material.</p>'+sourceList(p.course))+
   '</div>';
  return root;
 }
 // Install chapters before their navigation is built.
 for(const p of plans){
  if(!chapters.some(x=>x.slug===p.slug))chapters.push({
   slug:p.slug,group:'Calculators & Simulations',
   title:p.label+' · JJ Full Reference Plan',
   intro:p.intro,
   status:p.status,
   sections:[{
    title:'Course sources, status and planning definitions',
    points:[
     'This is a source-attributed course reference; JJ’s actual realized results are not independently audited.',
     'Projected funded-account inventory and account/evaluation purchases are not actual paid withdrawals or guaranteed passes.',
     'Track each distinct stage and use current provider rules before making a trading decision.'
    ],
    src:p.course.map(k=>sources[k])
   }]
  });
  if(!curriculum.some(x=>x.slug===p.slug))curriculum.push({
   slug:p.slug,title:p.label+' · JJ Full Reference Plan',status:'review',
   reason:'Stage-by-stage source-linked model and limitations; not measured JJ outcomes.'
  });
 }
 const previous=referenceExtras;
 referenceExtras=function(chapter){
  const p=plans.find(x=>x.slug===chapter.slug);
  return p?(p.accounts?standardPlan(p):advancedPlan(p)):previous(chapter);
 };
 // Intra-site navigations use existing chapter state, so the page does not
 // lose locally saved study checkboxes or the user's selected appearance.
 document.addEventListener('click',event=>{
  const anchor=event.target.closest('a[data-jj-plan]');
  if(!anchor)return;
  if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
  const next=anchor.dataset.jjPlan;
  if(!next||!chapters.some(c=>c.slug===next)||typeof pick!=='function')return;
  event.preventDefault();
  pick(next);
  try{history.replaceState(null,'','?topic='+encodeURIComponent(next))}catch(_){}
 });
 const deep=new URLSearchParams(location.search).get('topic');
 if(plans.some(p=>p.slug===deep))active=deep;
 if(typeof jjRebuildMobileSelector==='function')jjRebuildMobileSelector();
 renderNav();render();
})();
