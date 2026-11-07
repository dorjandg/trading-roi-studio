/* JJ Academy KPI reference — course examples, not an audited performance record.
   Every quoted figure has an underlying JJ course source. Analytically
   calculated rows are explicitly marked, and missing data remain unknown. */
(() => {
 'use strict';
 const slug='jj-kpi-reference';
 const sources={
  inventory:{name:'The Optimal Number of Accounts To Manage',time:'00:04–00:42, 01:36–03:10, 03:44–04:18',id:'11nOzXqPVWcTMHX6cpQivsM7StZVrtbZM'},
  scaling:{name:'30k/month → 100k/month Scaling',time:'00:00–00:58, 03:00–03:43',id:'1gKSrmr2naboKQWfZmHCF7OBrArdhf0s0'},
  roadmap:{name:'0–10k/month Roadmap',time:'02:02–03:31',id:'1ckmp-lBqjugMPTsGshIi-rAbQVnnjo0m'},
  funded:{name:'How To Trade Funded Accounts',time:'00:10–00:56, 02:14–02:59',id:'17fchw1QnO1uG_FxO5QDL-p6-2fB35R49'},
  funded50:{name:'How To Trade Fundeds For 50 Points',time:'00:00–04:31',id:'13vOa_M7FBB3KK9L0wSP206x3I9eDwaBR'},
  math:{name:'Prop Firm Math Stats',time:'00:25–01:16, 02:44–07:16',id:'1bzGIqxU1BCDPqKblORKaCUsjRFMsMBVs'},
  ruin:{name:'Risk Of Ruin Bankroll Management',time:'00:31–01:26, 03:25–04:50',id:'1VOJtRPDpy9LB4UakPYfZChROyAtPLQfv'},
  ev:{name:'How To Calculate YOUR EV',time:'JJ research summary: sample-size discussion',id:'1VOJtRPDpy9LB4UakPYfZChROyAtPLQfv'}
 };
 const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const src=key=>{
  const s=sources[key];if(!s)return 'Source not indexed';
  return '<a href="https://drive.google.com/file/d/'+encodeURIComponent(s.id)+'/view" target="_blank" rel="noopener noreferrer" title="'+escapeHTML(s.name+' · '+s.time)+'">'+escapeHTML(s.name)+'</a><div class="jj-stats-footnote">'+escapeHTML(s.time)+'</div>';
 };
 const perFunded='$2,000 per active funded / month (assumed average)';
 const targets=[
  ['$10K / month','~5 active funded','~15 evaluation attempts','15 × 33% = 4.95 expected passes; '+perFunded,'JJ illustration + derived attempts','inventory'],
  ['$20K / month','~10 active funded','~30 evaluation attempts','30 × 33% = 9.9 expected passes; '+perFunded,'JJ illustration + derived attempts','inventory'],
  ['$30K / month','~15 active funded','~45 evaluation attempts','45 × 33% = 14.85 expected passes; '+perFunded,'JJ illustration + derived attempts','inventory'],
  ['$100K advanced target','Not specified by same model','~200 hypothetical purchases, NOT a requirement','$50,000 example evaluation spend ÷ $250 example fee = 200 purchases. JJ narrates $150K gross payout goal; $100K difference before omitted costs. Timing/actual payout uncertain.','Different course projection; not an observed monthly result','scaling']
 ];
 const tradeExamples=[
  ['New 50K funded · 100-point NQ','2 NQ · 25-point stop','$1,000 nominal risk','$4,000 gross profit target','4R; win rate not measured here','funded'],
  ['New 50K funded · first 50-point setup','2 NQ · 25-point stop','$1,000 nominal risk','$2,000 gross profit target','2R; conditional second trade is a separate path','funded50'],
  ['New funded · second trade after first 50-point win','Conditional 50-point/50-point continuation','$2,000 risk of accumulated gain','$2,000 additional gross target','1R; ends about +$4K if won or $0 if lost, before costs','funded50'],
  ['Larger 150K funded · NQ illustration','3 NQ · 37.5-point stop','$2,250 nominal risk','$9,000 gross profit target','4R; example, not tested current firm compliance','scaling'],
  ['0→10K roadmap · initial funded trade','Up to 2 trades per account; stop after first win','$1,000 risk per attempted trade','+$4,000 on first win; +$3,000 account net if second wins after first loss','20% assumed trade win rate. Conditional stopping gives $0 expected gross P&L/account before fees in audit model, not proof of profitability.','roadmap']
 ];
 const probabilityExamples=[
  ['Trading win rate, 0→10K roadmap','20%','An assumed single-trade probability used for a 10-funded-account teaching model; NOT JJ’s audited win rate.','roadmap'],
  ['Evaluation pass rate','33%','Assumed illustration: 15 purchases × 33% = 4.95 expected passes; actual attempts can differ.','inventory'],
  ['Funded payout success given a pass','25%','An illustrative conditional probability from JJ math examples, not observed payout frequency.','ruin'],
  ['Payout pathway from a purchased eval','8.25%','Derived: 33% evaluation passes × 25% conditional funded success. This is not per-trade WR.','ruin'],
  ['Two-stage funded win path','40%','25% first-stage success + 75% first-stage failure × 20% conditional recovery = 40%, with the assumed outcome tree.','math'],
  ['Evaluation sample tracking','20+ attempts','JJ suggests measuring passes / attempts over at least roughly 20 attempts for an initial estimate; uncertainty remains substantial.','math']
 ];
 const observed=[
  ['JJ overall verified trading win rate','Not established','Indexed course research contains example win-rate percentages, not an independently audited trade log.'],
  ['JJ actual average dollar risk per trade','Not established','Risk depends on instrument, funded/evaluation stage and the illustrated setup. Example stops are not historical averages.'],
  ['JJ audited monthly payouts for $10K / $30K / $100K goals','Not established','Goal figures and spending narratives are not bank receipts or verified payout histories.'],
  ['JJ actual challenge purchases and pass rate','Not established','The 33% pass rate and 200-purchase figure are modeled scenarios, not audited records.']
 ];
 function table(headings,rows,sourceCol=true){
  return '<div class="jj-stats-scroll"><table class="jj-stats-table"><thead><tr>'+
   headings.map(h=>'<th scope="col">'+escapeHTML(h)+'</th>').join('')+'</tr></thead><tbody>'+
   rows.map(row=>'<tr>'+row.map((cell,i)=>
    '<td'+(i===0?' class="jj-stats-metric"':'')+'>'+
    (sourceCol&&i===row.length-1?src(cell):escapeHTML(cell))+'</td>'
   ).join('')+'</tr>').join('')+
   '</tbody></table></div>';
 }
 function section(title,body,open=false){
  return '<details class="jj-stats-group"'+(open?' open':'')+'><summary>'+escapeHTML(title)+'</summary><div class="jj-stats-panel">'+body+'</div></details>';
 }
 function markup(){
  return '<div class="jj-stats-reference">'+
   '<div class="jj-stats-summary"><strong>JJ Statistics & Targets — course reference</strong>'+
   '<p>One place to compare JJ’s <em>stated examples and target scenarios</em>. These are not independently verified account results. The course uses different assumptions in different chapters, so example percentages and projected payouts must not be described as JJ’s personally measured win rate or profits.</p>'+
   '<div class="jj-stats-legend"><span>JJ illustration = described in a lesson</span><span>Derived = formula under stated assumptions</span><span>Unverified = no audited result in indexed research</span></div></div>'+
   section('01 · Monthly profit goals and evaluation inventory',table(
     ['Goal','JJ active funded target','Example evaluations at 33% pass rate','Interpretation','Evidence type','JJ source'],
     targets),true)+
   '<p class="jj-stats-footnote"><strong>Important:</strong> 15 evaluation purchases at 33% passing mean 4.95 expected qualifications—not five guaranteed funded accounts. The target ladder uses a $2,000/month profit assumption per active funded account; payout approvals and costs are separate. The 0→10K roadmap also discusses ten newly funded accounts, a different teaching scenario, not a correction to the five-active-funded heuristic.</p>'+
   section('02 · Example risk, reward and trade win rates',table(
     ['Stage / example','Setup','Illustrative stop risk','Illustrative win target','Probability / qualification','JJ source'],
     tradeExamples))+
   section('03 · Example probabilities and performance KPIs',table(
     ['Metric','Course assumption','What it actually represents','JJ source'],
     probabilityExamples))+
   section('04 · What is NOT verified about JJ’s personal results',table(
     ['Personal KPI','Available value','Why'],
     observed,false)+
    '<p class="jj-stats-footnote">Until original trading logs, funded statements or independently audited payout histories are available, the Academy should not insert real personal performance percentages or actual monthly profits for JJ.</p>')+
   section('05 · How to compare these references responsibly',
    '<ol class="jj-stats-checks"><li>First choose the denominator: a trade, purchased evaluation, funded account or payout cycle.</li><li>Keep <strong>challenge pass rate</strong> distinct from <strong>funded payout rate</strong> and <strong>individual trade win rate</strong>.</li><li>Use original lesson year, provider, account stage, instrument and risk assumptions before copying a number.</li><li>For $10K and $30K targets, maintain separate account inventories, replacement evaluations, fees and actual received payouts.</li><li>For the advanced $100K scenario, do not extrapolate the five-fundeds-per-$10K rule: the lesson describes a different purchase-spend model, and the projected $150K gross payout is unverified.</li><li>The independent-attempt calculations fail when the same trades are copied across accounts.</li></ol>'+
    '<p class="jj-stats-footnote">These historical references are educational only. No trading strategies, risk settings or other calculator defaults are changed by this page.</p>')+
   '</div>';
 }
 if(!chapters.some(c=>c.slug===slug))chapters.push({
  slug,
  group:'Calculators & Simulations',
  title:'JJ Statistics & Target Reference',
  intro:'A source-linked reference table of JJ’s example trade risk, target figures, pass and payout probabilities, and the $10K/$30K/$100K scaling goals—with verified-versus-hypothetical distinctions.',
  status:'Reference assembled from course research · personal performance not audited',
  sections:[{
   title:'Interpreting JJ’s example KPIs and goals',
   points:[
    'The monthly target ladder is from The Optimal Number of Accounts To Manage, and advanced scaling uses a different illustrative cash-spend model. Neither is a verified income history.',
    'The risk and win-rate examples describe particular funded/evaluation strategies; they are not an audited record of JJ’s actual outcomes.',
    'To estimate necessary challenge purchases, choose a measured pass rate and account inventory; an expected passing count is not a guaranteed pass total.'
   ],
   src:[
    [sources.inventory.name,sources.inventory.time,sources.inventory.id],
    [sources.scaling.name,sources.scaling.time,sources.scaling.id],
    [sources.roadmap.name,sources.roadmap.time,sources.roadmap.id]
   ]
  }]
 });
 if(!curriculum.some(c=>c.slug===slug))curriculum.push({
  slug,title:'JJ Statistics & Target Reference',status:'review',
  reason:'Source-attributed examples with estimates and missing personal performance data marked separately.'
 });
 // Extend the existing rendering pipeline without modifying any calculator.
 const oldExtras=referenceExtras;
 referenceExtras=function(c){
  return c.slug===slug ? markup() : oldExtras(c);
 };
 if(new URLSearchParams(location.search).get('topic')===slug)active=slug;
 if(typeof jjRebuildMobileSelector==='function')jjRebuildMobileSelector();
 renderNav();render();
})();