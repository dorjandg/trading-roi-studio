/* JJ Academy — calculators-only navigation home.
   One interactive tool per chapter. Reuse original calculator functions,
   avoid duplicate IDs, and preserve studied checkbox IDs for all lessons. */
(function(){
'use strict';
const slug='calc-acquisition';
if(!chapters.some(x=>x.slug===slug)){
 chapters.push({
   slug,
   group:'Calculators & Simulations',
   title:'Topstep & FTMO Evaluation Acquisition Calculator',
   intro:'Estimate the average cost of reaching a funded account and the chance of at least one funded payout pathway across multiple evaluation purchases. The editable calculator is directly below.',
   status:'Illustrative course-based probability model — assumptions editable',
   sections:[
    {
     title:'How to use the evaluation acquisition calculator',
     points:[
      'Enter the price of a purchased evaluation, then your measured probability of passing an evaluation. Use a complete multi-phase pass rate when the evaluation has more than one phase.',
      'Enter funded success as the conditional probability that a newly funded account reaches the outcome you are studying. It is not the trading win rate and not a guaranteed payout.',
      'Enter an activation fee only when it is charged after passing the evaluation. Set the number of purchased evaluations to the number of independent attempts you want to compare.',
      'Read the four outputs: average acquisition cost per funded account, single-attempt funded-success pathway, chance of at least one successful pathway, and total initial evaluation spending.',
      'Run sensitivity checks by lowering the pass rate and funded success rate and increasing the fees. The output is a probability illustration; it does not simulate account timelines, resets, correlated copying, drawdowns or firm-specific payout restrictions.'
     ],
     src:[
      ['Prop Firm Math Stats','00:30–01:10, 05:00–07:16','1bzGIqxU1BCDPqKblORKaCUsjRFMsMBVs'],
      ['Risk Of Ruin Bankroll Management','03:25–04:50, 12:18–13:14','1VOJtRPDpy9LB4UakPYfZChROyAtPLQfv']
     ]
    },
    {
     title:'JJ course context and where the model can mislead',
     points:[
      'JJ discusses tracking evaluation passes divided by attempts and measuring actual purchases, resets and costs rather than assuming the same pass rate applies to everybody.',
      'His mathematical acquisition examples combine evaluation pass probability and funded success probability. Their product describes one particular two-stage success pathway, not guaranteed cash or a prediction of how long payout takes.',
      'JJ also describes correlated copying across accounts, which weakens a simple independent-attempt probability model. Treat copied attempts as linked outcomes unless they are genuinely independent.',
      'Track activation fees, resets, monthly renewals, account replacement, actual received payouts and withdrawal restrictions separately. The current calculator excludes most of those cash-flow details.',
      'Some examples in the course use different models, assumptions and providers. Keep those versions separate; do not automatically apply the current calculator to every firm.'
     ],
     src:[
      ['Managing Resets Billing Cycles Across Multiple Futures Funded Accounts','00:12–04:19','1pdmFifqByLbI75-XtX0C53vMiCGR4-i-'],
      ['Prop Firm Math Stats','02:55–07:16','1bzGIqxU1BCDPqKblORKaCUsjRFMsMBVs']
     ]
    }
   ]
 });
}
if(!curriculum.some(x=>x.slug===slug)){
 curriculum.push({
  slug,
  title:'Topstep & FTMO Evaluation Acquisition Calculator',
  status:'review',
  reason:'Interactive JJ-derived evaluation acquisition probability model; user assumptions and firm costs require verification.'
 });
}
/* Independent collapsed instructions above the editable acquisition inputs. */
function mountAcquisitionHelp(){
 const wb=document.querySelector('#calc-acquisition .jj-acquisition-workbench');
 if(!wb||wb.querySelector('.jj-acq-howto'))return;
 const inputs=wb.querySelector('.calc-fields');
 if(!inputs)return;
 // Net payout is deliberately optional: no payout/ROI is invented when empty.
 const payoutLabel=document.createElement('label');
 payoutLabel.textContent='Net payout received ($) · optional';
 payoutLabel.title='Actual net cash received for ONE successful payout path, after any payout split. Leave blank if unknown.';
 const payoutInput=document.createElement('input');
 payoutInput.id='jj-payout';payoutInput.type='number';payoutInput.min='0';payoutInput.step='any';
 payoutInput.placeholder='Enter payout for EV / ROI';
 payoutInput.setAttribute('aria-label','Net cash payout received per successful funded account (optional)');
 payoutLabel.append(payoutInput);inputs.append(payoutLabel);
 for(const key of ['jj-pass','jj-win']){const el=wb.querySelector('#'+key);if(el)el.min='0';}
 const guide=document.createElement('div');
 guide.className='jj-acq-howto';
 guide.innerHTML=`
 <details class="jj-kpi-guides">
  <summary><span>How to use · 4 steps</span><span class="jj-kpi-summary-note">Hidden until opened</span></summary>
  <div class="jj-kpi-guide-body jj-kpi-guide-section-content">
   <ol>
    <li><strong>Eval fee:</strong> enter the cash cost of one evaluation attempt, not the stated account balance.</li>
    <li><strong>Pass rate:</strong> enter the percentage of purchased evaluations that actually reach the funded stage. Include both phases when the firm requires two.</li>
    <li><strong>Funded success:</strong> enter the probability of the modeled success <em>after</em> funding. When studying cash payouts, success must mean receiving an eligible payout, not merely touching a trading profit target.</li>
    <li><strong>Activation fee and attempts:</strong> add fees charged on passing and the number of planned purchases. Read acquisition cost, single-attempt payout pathway, chance of at least one success, and purchase spending.</li>
   </ol>
   <p class="jj-kpi-alert">Enter your actual net withdrawable payout in the optional final field to activate expected profit and ROI. Activation fees are included in expected spending. The model still assumes stable independent outcomes and excludes commissions, most resets, renewals, calendar timing, payout restrictions, repeat payouts and correlated copy trading.</p>
  </div>
 </details>
 <details class="jj-kpi-guides">
  <summary><span>Worked example · JJ probability method</span><span class="jj-kpi-summary-note">Inputs · formula · outcomes</span></summary>
  <div class="jj-kpi-guide-body jj-kpi-guide-section-content">
   <p>Try this illustrative case: <strong>$100 evaluation fee, 33% pass rate, 25% conditional funded success, $0 activation fee, 10 independent attempts</strong>.</p>
   <div class="jj-kpi-formula">
    Acquisition cost = $100 ÷ 0.33 + $0 = <strong>$303.03 per funded account</strong><br>
    Payout pathway = 0.33 × 0.25 = <strong>8.25% per purchase</strong><br>
    At least one successful pathway across 10 = 1 − (1 − 0.0825)<sup>10</sup> ≈ <strong>57.73%</strong><br>
    Evaluation purchase spending = 10 × $100 = <strong>$1,000</strong>
   </div>
   <p>There is still about a <strong>42.27% probability of no successful payout pathway</strong> across these 10 independent attempts. Even a successful pathway does not tell you the net ROI without the actual withdrawable payout and all costs.</p>
   <button type="button" class="jj-calc-load-example">Load this example into calculator</button>
   <p class="jj-kpi-alert">These are illustrative input assumptions inspired by JJ's two-stage probability methodology—not verified current provider terms or his personal pass-rate statistics.</p>
   <p>JJ sources: <a href="https://drive.google.com/file/d/1bzGIqxU1BCDPqKblORKaCUsjRFMsMBVs/view" target="_blank" rel="noopener noreferrer">Prop Firm Math Stats (00:30–01:10; 05:00–07:16)</a> and <a href="https://drive.google.com/file/d/1VOJtRPDpy9LB4UakPYfZChROyAtPLQfv/view" target="_blank" rel="noopener noreferrer">Risk Of Ruin Bankroll Management (03:25–04:50)</a>.</p>
  </div>
 </details>`;
 wb.insertBefore(guide,inputs);
 const audit=document.createElement('details');
 audit.className='jj-kpi-guides jj-acq-audit';
 audit.innerHTML='<summary><span>Check formulas, spending & probability</span><span class="jj-kpi-summary-note">Live calculation · hidden until opened</span></summary><div class="jj-kpi-guide-body"><p class="jj-kpi-start" id="jj-calc-interpretation"></p><div id="jj-calc-breakdown" class="jj-audit-formulas"></div><p class="jj-kpi-alert">Cost per funded and break-even payout are long-run expectations, not the price of any single account. Payout success is conditional on passing. Probability of at least one payout assumes independent trials. No trade sequence, funded drawdown path, reset cost, payout time or copying correlation is simulated.</p></div>';
 const outputs=wb.querySelector('#jj-results');
 if(outputs)outputs.after(audit);
 const oldValuesKey='jj-acquisition-calculator-values-v1';
 let stored=null;
 try{stored=JSON.parse(localStorage.getItem(oldValuesKey)||'null')}catch(_){}
 if(stored&&typeof stored==='object'){
  for(const id of ['jj-cost','jj-pass','jj-win','jj-activation','jj-n','jj-payout']){
   const f=wb.querySelector('#'+id);
   if(f&&Object.prototype.hasOwnProperty.call(stored,id)&&typeof stored[id]==='string')
    f.value=stored[id].slice(0,40);
  }
 }
 const saveValues=()=>{
  const values={};
  for(const id of ['jj-cost','jj-pass','jj-win','jj-activation','jj-n','jj-payout']){
   const f=wb.querySelector('#'+id);if(f)values[id]=f.value;
  }
  try{localStorage.setItem(oldValuesKey,JSON.stringify(values))}catch(_){}
 };
 wb.addEventListener('input',event=>{
  if(!event.target.matches('input[id^="jj-"]'))return;
  saveValues();
  if(event.target.id==='jj-payout'&&typeof jjCalculate==='function')jjCalculate();
 });
 if(typeof jjCalculate==='function')jjCalculate();
 const button=guide.querySelector('.jj-calc-load-example');
 if(button)button.addEventListener('click',()=>{
  const example={'jj-cost':100,'jj-pass':33,'jj-win':25,'jj-activation':0,'jj-n':10,'jj-payout':''};
  for(const [id,value] of Object.entries(example)){
   const field=wb.querySelector('#'+id);
   if(field){field.value=String(value);field.dispatchEvent(new Event('input',{bubbles:true}));}
  }
  if(typeof jjCalculate==='function')jjCalculate();
  button.textContent='Example loaded';
 });
}
const jjCalcOriginalRender=render;
render=function(){
 jjCalcOriginalRender();
 if(active===slug)mountAcquisitionHelp();
};

// A direct URL to the calculator should work even on the initial page load.
const deep=new URLSearchParams(location.search).get('topic');
if(deep===slug||(!deep&&(()=>{try{return localStorage.getItem('jj-academy-last-page-v1')===slug}catch(e){return false}})())){active=slug;try{localStorage.setItem('jj-academy-last-page-v1',slug)}catch(e){}}
if(typeof jjRebuildMobileSelector==='function')jjRebuildMobileSelector();
renderNav();
render();
})();


/* Dynamic risk scenario explorer: independent, editable trading mathematics model. */
(function(){
'use strict';
const slug='calc-risk-scenarios';
const ACTIVE_KEY='jj-risk-calculator09-active-strategy-v1';
const STRATEGIES={current:{eval:{},fund:{}},fixedlow:{eval:{riskModel:'fixed',baseRisk:250},fund:{riskModel:'fixed',baseRisk:150}},half:{eval:{riskModel:'half'},fund:{riskModel:'fixed',baseRisk:150}},recovery:{eval:{riskModel:'recovery'},fund:{riskModel:'buffer'}},fixedhigh:{eval:{riskModel:'fixed',baseRisk:350},fund:{riskModel:'fixed',baseRisk:450}}};
const OPEN_ROWS_KEY='jj-risk-calculator09-open-strategies-v1';
const openStrategyRows=new Set();try{const saved=JSON.parse(localStorage.getItem(OPEN_ROWS_KEY)||'[]');if(Array.isArray(saved))saved.filter(id=>Object.prototype.hasOwnProperty.call(STRATEGIES,id)).forEach(id=>openStrategyRows.add(id))}catch(e){}
let activeStrategy='current';try{const saved=localStorage.getItem(ACTIVE_KEY);if(Object.prototype.hasOwnProperty.call(STRATEGIES,saved))activeStrategy=saved}catch(e){}

if(!chapters.some(c=>c.slug===slug))chapters.push({slug,group:'Calculators & Simulations',title:'Topstep & FTMO Risk Scenario Calculator',intro:'Explore all win/loss sequences until the profit target is hit or remaining loss allowance falls below the stop threshold. This is an independent mathematical model, not a JJ course rule.',status:'Interactive calculator · illustrative',sections:[{title:'Risk and stopping rules',points:['Each stage calculates risk from its own target and stage P&L. After T1 passes, T2 starts with a fresh loss allowance while total profit remains accumulated.','A win adds risk multiplied by reward multiple; a loss subtracts risk. Stop immediately at the target or if remaining loss allowance falls below the closing threshold.','Active paths at the selected trade depth are unfinished, not failures. Select one and extend it by Win or Loss.','Probability estimates assume independent trades at the editable win rate. They do not account for fees, slippage, drawdown equity rules or actual market execution.'],src:[]}]});
if(!curriculum.some(c=>c.slug===slug))curriculum.push({slug,title:'Topstep & FTMO Risk Scenario Calculator',status:'review',reason:'User-defined risk scenario model; not attributed to JJ.'});
/* Place immediately after chapter 08 in the existing numbered sidebar/dashboard/mobile navigation. */
if(typeof jjCategoryOverrides!=='undefined')jjCategoryOverrides[slug]='Calculators & Simulations';
if(typeof jjPreferredChapterOrder!=='undefined'){const order=jjPreferredChapterOrder['Calculators & Simulations'];if(Array.isArray(order)&&!order.includes(slug)){const idx=order.indexOf('calc-prop-vs-live');order.splice(idx<0?order.length:idx+1,0,slug)}}
const style=document.createElement('style');style.textContent='.jj-risk-workbench{margin:12px 0;padding:12px;border:1px solid var(--border,#64748b55);border-radius:12px}.jj-risk-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.jj-risk-fields label{font-size:12px;display:grid;gap:4px}.jj-risk-fields input{width:100%;min-width:0;box-sizing:border-box;padding:8px;border:1px solid #8886;border-radius:7px;background:var(--card,var(--bg,#fff));color:inherit}.jj-risk-kpis,.jj-risk-results-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin:5px 0}.jj-risk-kpis>div,.jj-risk-results-grid>div{min-width:0;padding:5px 6px;background:var(--bg,#8881);border-radius:5px;font-size:10px;line-height:1.25;overflow-wrap:anywhere}.jj-risk-kpis strong,.jj-risk-results-grid strong{display:block;font-size:13px;line-height:1.3;margin-top:2px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}@media(min-width:640px){.jj-risk-kpis,.jj-risk-results-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}.jj-risk-kpis>div,.jj-risk-results-grid>div{padding:6px 7px}}.jj-kpi-help{position:relative;cursor:help;outline-offset:2px}.jj-kpi-tooltip{display:none;position:absolute;z-index:90;left:0;top:calc(100% + 5px);width:max-content;max-width:min(270px,75vw);white-space:normal;overflow-wrap:break-word;background:var(--card,#202631);color:var(--text,#fff);border:1px solid #8888;box-shadow:0 5px 16px #0003;border-radius:7px;padding:9px;font-size:12px;line-height:1.4;font-weight:400}.jj-kpi-help:hover .jj-kpi-tooltip,.jj-kpi-help:focus .jj-kpi-tooltip,.jj-kpi-help:focus-within .jj-kpi-tooltip{display:block}.jj-kpi-help:nth-child(3n) .jj-kpi-tooltip{left:auto;right:0}@media(min-width:640px){.jj-kpi-help:nth-child(3n) .jj-kpi-tooltip{left:0;right:auto}.jj-kpi-help:nth-child(5n) .jj-kpi-tooltip{left:auto;right:0}}.jj-risk-workbench button{cursor:pointer;padding:7px 10px;border-radius:7px;border:1px solid #8887;background:transparent;color:inherit}.jj-risk-workbench button:disabled{opacity:.4}.jj-risk-actions{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}.jj-risk-workbench table{width:100%;border-collapse:collapse;font-size:12px}.jj-risk-workbench th,.jj-risk-workbench td{padding:7px 4px;border-bottom:1px solid #8883;text-align:right}.jj-risk-workbench th:first-child,.jj-risk-workbench td:first-child{text-align:left}.jj-risk-workbench [data-table] table{font-variant-numeric:tabular-nums;white-space:nowrap}.jj-risk-workbench [data-table] th,.jj-risk-workbench [data-table] td{padding:5px 3px}.jj-risk-win{color:#00df83!important;font-weight:800}.jj-risk-loss{color:#f05b65!important;font-weight:750}.jj-risk-muted{opacity:.7;font-size:12px}.jj-risk-workbench select{max-width:100%;padding:6px;border-radius:6px;background:transparent;color:inherit}.jj-risk-workbench .jj-risk-path{font-weight:700;text-decoration:underline;text-underline-offset:3px}.jj-risk-workbench .jj-risk-page{display:flex;justify-content:space-between;align-items:center;margin-top:8px}@media(max-width:520px){.jj-risk-workbench{padding:9px}.jj-risk-kpis strong{font-size:16px}.jj-risk-workbench th,.jj-risk-workbench td{font-size:11px;padding:6px 2px}}';style.textContent+=' .jj-risk-section{border:1px solid var(--border,#64748b55);border-radius:8px;margin:6px 0;overflow:visible}.jj-risk-section>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;padding:9px 10px;font-size:12px;font-weight:700}.jj-risk-section>summary::-webkit-details-marker{display:none}.jj-risk-section>summary:before{content:"▸";font-size:13px;display:inline-block;transition:transform .12s}.jj-risk-section[open]>summary:before{transform:rotate(90deg)}.jj-risk-section-body{padding:0 9px 9px}.jj-risk-section:not([open]) .jj-risk-section-body{display:none}';style.textContent+=' .jj-risk-chevron{display:inline-block!important;flex:0 0 14px;font-size:15px!important;line-height:1!important;color:currentColor!important;opacity:1!important;transform:rotate(0deg);transition:transform .15s}.jj-risk-section[open]>summary .jj-risk-chevron{transform:rotate(90deg)}.jj-risk-section>summary:before{content:none!important}';style.textContent+=' .jj-funnel-wrap{display:grid;gap:8px}.jj-funnel-row{padding:6px 7px;border-radius:7px;background:var(--card,#64748b12)}.jj-funnel-top,.jj-funnel-summary{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12px}.jj-funnel-top span{font-variant-numeric:tabular-nums}.jj-funnel-track{height:5px;background:#64748b35;border-radius:8px;overflow:hidden;margin:6px 0}.jj-funnel-track>span{display:block;height:100%;background:var(--accent,#4ca98f);border-radius:8px}.jj-funnel-money{font-size:11px;opacity:.8}.jj-funnel-summary{padding:9px 7px;border-top:1px solid #64748b55}.jj-funnel-note{font-size:10px;opacity:.75;line-height:1.5}';style.textContent+=' .jj-funnel-portfolio{padding:9px 7px;border:1px solid #64748b55;border-radius:8px;display:grid;gap:8px;font-size:12px}.jj-funnel-portfolio-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.jj-funnel-portfolio-grid>div{display:flex;flex-direction:column;gap:2px}.jj-funnel-portfolio-grid small{font-size:10px;opacity:.75}.jj-funnel-portfolio-grid strong{font-size:15px;font-variant-numeric:tabular-nums}';style.textContent+="@media(max-width:600px){.jj-risk-workbench{padding:6px!important;margin:5px 0!important;border-radius:7px!important}.jj-risk-workbench .jj-funnel-wrap{gap:4px!important}.jj-risk-workbench .jj-funnel-note{font-size:10px!important;line-height:1.3!important}.jj-risk-workbench .jj-funnel-summary{margin:3px 0!important;padding:4px 0!important;gap:3px 9px!important;font-size:10px!important;justify-content:flex-start!important}.jj-risk-workbench .jj-funnel-summary span{white-space:nowrap}.jj-risk-workbench [data-funnel-table]{font-size:10px!important;white-space:nowrap}.jj-risk-workbench [data-funnel-table] th,.jj-risk-workbench [data-funnel-table] td{font-size:10px!important;padding:5px 4px!important}.jj-risk-workbench .jj-funnel-portfolio{padding:7px!important;gap:5px!important;font-size:11px!important}.jj-risk-workbench .jj-funnel-portfolio-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important}.jj-risk-workbench .jj-funnel-portfolio-grid>div{min-width:0}.jj-risk-workbench .jj-funnel-portfolio-grid small{font-size:9px!important;line-height:1.15!important}.jj-risk-workbench .jj-funnel-portfolio-grid strong{font-size:12px!important}.jj-risk-workbench .jj-funnel-parallel{gap:5px!important;flex-wrap:wrap!important}.jj-risk-workbench .jj-funnel-parallel label{font-size:10px!important;display:inline-flex!important;align-items:center!important;gap:4px!important}.jj-risk-workbench .jj-funnel-parallel input{width:64px!important;max-width:64px!important;padding:4px 5px!important;font-size:12px!important}.jj-risk-workbench [data-funnel-column-menu] summary{padding:4px 7px!important;font-size:11px!important}.jj-risk-workbench .jj-risk-fields{gap:5px!important}.jj-risk-workbench .jj-risk-fields label{font-size:10px!important;gap:2px!important}.jj-risk-workbench .jj-risk-fields input{padding:5px!important;font-size:12px!important}.jj-risk-workbench .jj-risk-section>summary{padding:6px 7px!important}.jj-risk-workbench .jj-risk-section-body{padding:0 6px 6px!important}}";document.head.append(style);
const money=x=>(x<0?'−':x>0?'+':'')+'$'+Math.abs(x).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const tableNumber=x=>(x<0?'-':'')+Math.abs(x).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function mount(){
const root=document.querySelector('#'+slug);if(!root||root.querySelector('.jj-risk-workbench'))return;
const firmBar=document.createElement('div');firmBar.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;margin:8px 0';firmBar.innerHTML='<strong>Account type</strong><select data-firm-type style="padding:5px;border:1px solid #8886;border-radius:6px;background:var(--card,var(--bg,#fff));color:inherit"><option value="ftmo">FTMO</option><option value="topstep">Topstep</option></select><span data-firm-rule style="font-size:11px;opacity:.8"></span>';
const box=document.createElement('div');box.className='jj-risk-workbench';box.innerHTML='<h3>Dynamic Risk · Scenario Explorer</h3><div class="jj-risk-mode" style="display:flex;gap:5px;margin:8px 0"><button type="button" data-phase="evaluation" style="flex:1">Evaluation</button><button type="button" data-phase="funded" style="flex:1">Funded</button><button type="button" data-phase="combined" style="flex:1">Combined</button></div><div class="jj-risk-mode" role="group" aria-label="Target mode" style="display:flex;gap:6px;margin:8px 0 12px"><button type="button" data-mode-button="1" aria-pressed="true" style="flex:1">1 Target</button><button type="button" data-mode-button="2" aria-pressed="false" style="flex:1">2 Targets</button></div><input type="hidden" data-target-mode value="1"><div class="jj-risk-fields" data-risk-fields><label data-target1-field>Target 1 ($)<input data-k="target" type="number" min=".01" step="any" value="1000"></label><label>Win rate (%)<input data-k="winRate" type="number" min="0" max="100" value="50"></label><label>Loss allowance per stage ($)<input data-k="limit" type="number" min=".01" step="any" value="1000"></label><label>Maximum daily loss ($)<input data-k="dailyLimit" type="number" min=".01" step="any" value="500"></label><label>Losses per day<input data-k="tradesPerDay" type="number" min="1" max="100" step="1" value="3"></label><label>Risk reward (1:R)<input data-k="rr" type="number" min=".01" step="any" value="3"></label><label>Close if allowance below ($)<input data-k="floor" type="number" min="0" step="any" value="100"></label><label>Scenario depth (1–12)<input data-k="depth" type="number" min="1" max="12" value="6"></label><label data-target2-field>Target 2 ($)<input data-k="target2" type="number" min=".01" step="any" value="500"></label></div><div class="jj-risk-mode" style="display:flex;gap:6px;margin:8px 0"><button type="button" data-account-mode="single" aria-pressed="true" style="flex:1">1 Account</button><button type="button" data-account-mode="multi" aria-pressed="false" style="flex:1">Multiple Accounts</button></div><div data-multi-controls style="display:none;margin:6px 0"><label style="display:block;font-size:12px">Number of accounts <input data-account-count type="number" min="2" max="100" step="1" value="10" style="width:76px;padding:5px;margin-left:7px"></label><div style="font-size:11px;opacity:.75;margin-top:4px">Assumes independent challenge outcomes, not copied trades. Passing a target does not automatically mean funded status.</div></div><div style="margin:7px 0"><label style="display:flex;align-items:center;gap:8px;font-size:12px">Evaluation purchase fee ($) <input data-k="accountCost" type="number" min="0" step="0.01" value="100" style="width:100px;max-width:42%;padding:5px;border:1px solid #8886;border-radius:6px;background:var(--card,var(--bg,#fff));color:inherit"></label></div><div data-funded-fields style="display:none"><div class="jj-risk-fields"><label>Funded target ($)<input data-funded="target" type="number" value="4000"></label><label>Funded win rate (%)<input data-funded="winRate" type="number" value="50"></label><label>Funded RR<input data-funded="rr" type="number" value="3"></label><label>Funded loss allowance ($)<input data-funded="limit" type="number" value="2000"></label><label>Funded daily loss ($)<input data-funded="dailyLimit" type="number" value="1000"></label><label>Funded losses per day<input data-funded="tradesPerDay" type="number" value="3"></label><label>Funded minimum allowance ($)<input data-funded="floor" type="number" value="100"></label><label>Funded depth<input data-funded="depth" type="number" value="6"></label><label>Payout split (%)<input data-funded="split" type="number" value="80"></label><label>Activation fee ($)<input data-funded="activation" type="number" value="0"></label></div></div><div data-funded-results></div><div class="jj-risk-kpis" data-kpis></div><div data-multi-results style="display:none"></div><div data-prob-results style="margin:8px 0"></div><div class="jj-risk-muted" data-prob></div><h4>All scenario paths</h4><select data-filter><option value="all">All paths</option><option value="target">Pass</option><option value="closed">Fail</option><option value="active">Active</option><option value="daily-blocked">Day Block</option></select><div data-table></div><div class="jj-risk-page"><button data-prev>Previous</button><span data-count></span><button data-next>Next</button></div><p class="jj-risk-muted">Illustrative only. Full remaining allowance can breach prop-firm equity limits once spreads, commissions or slippage are included. No order placement.</p>';
const section=root.querySelector('.chapter-content')||root.querySelector('.sections')||root;section.prepend(box);box.querySelector('h3').after(firmBar);

const group=(id,label,nodes,open=false)=>{const d=document.createElement('details');d.className='jj-risk-section';d.dataset.section=id;d.open=open;const summary=document.createElement('summary');summary.textContent=label;const arrow=document.createElement('span');arrow.className='jj-risk-chevron';arrow.setAttribute('aria-hidden','true');arrow.textContent='▸';summary.prepend(arrow);d.append(summary);const body=document.createElement('div');body.className='jj-risk-section-body';d.append(body);nodes[0].before(d);nodes.forEach(n=>body.append(n));return d};
const targetModeBar=box.querySelector('[aria-label="Target mode"]');
const phaseGuide=document.createElement('div');phaseGuide.style.cssText='display:grid;gap:6px;margin:7px 0 10px;font-size:12px';const phaseOne=document.createElement('div');phaseOne.style.cssText='padding:8px;border:1px solid #8884;border-radius:7px';const phaseTwo=document.createElement('div');phaseTwo.style.cssText='padding:8px;border:1px solid #8884;border-radius:7px';phaseGuide.append(phaseOne,phaseTwo);targetModeBar.style.display='none';
const accountBar=box.querySelector('[data-account-mode="single"]').parentElement;
const feeBar=box.querySelector('[data-k="accountCost"]').closest('div');
group('challenge-settings','01 · Challenge · Parameters',[targetModeBar,box.querySelector('[data-target-mode]'),box.querySelector('[data-risk-fields]'),accountBar,box.querySelector('[data-multi-controls]'),feeBar]);
group('funded-settings','02 · Funded · Parameters',[box.querySelector('[data-funded-fields]')]);
const manualRiskKey='jj-risk-manual-phase-risks-v1';
/* Compact separate R cards preserve the original phase/tier selectors used by the engine. */
const contractKey='jj-risk-contract-sizing-v1';
const stepCard=(phase,tier)=>'<div class="jj-contract-step" style="border:1px solid #8883;border-radius:7px;padding:6px;min-width:0">'+
 '<div style="font-size:11px;font-weight:700;margin-bottom:5px">R'+tier+' <span style="font-size:10px;font-weight:400;opacity:.7">'+(tier===1?'First trade':'After '+(tier-1)+' loss'+(tier===2?'':'es'))+'</span></div>'+
 '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px">'+
 '<label style="min-width:0;font-size:10px">Risk $<input data-manual-risk="'+phase+'-'+tier+'" type="number" min="0.01" step="0.01" value="100" style="box-sizing:border-box;width:100%;min-width:0;padding:3px 4px;font-size:11px"></label>'+
 '<label style="min-width:0;font-size:10px">RR<input data-manual-rr="'+phase+'-'+tier+'" type="number" min="0.1" max="100" step="0.1" placeholder="Auto" style="box-sizing:border-box;width:100%;min-width:0;padding:3px 4px;font-size:11px"></label>'+
 '<label style="min-width:0;font-size:10px">Stop $ move<input data-contract-stop="'+phase+'-'+tier+'" type="number" min="0.1" step="0.1" value="5" style="box-sizing:border-box;width:100%;min-width:0;padding:3px 4px;font-size:11px" title="Gold price movement from entry to stop, in $ per ounce"></label>'+
 '<div style="min-width:0"><span data-sizing-label style="font-size:10px">Contracts</span><div data-contract-result="'+phase+'-'+tier+'" style="font-size:14px;font-weight:700;line-height:23px">—</div></div>'+
 '</div><div data-contract-detail="'+phase+'-'+tier+'" style="font-size:10px;opacity:.7;margin-top:3px;line-height:1.35"></div></div>';
const phaseCards=phase=>'<div style="margin-top:7px"><div style="display:flex;gap:6px;align-items:center;justify-content:space-between;flex-wrap:wrap">'+
 '<strong style="font-size:12px">P'+phase+' · '+(phase===1?'First checkpoint':phase===2?'Second checkpoint':'Funded')+'</strong>'+
 '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><label style="font-size:10px">Mode <select data-manual-mode="'+phase+'" style="padding:3px;font-size:11px"><option value="auto">Auto</option><option value="manual">Manual</option></select></label>'+
 '<label style="font-size:10px">Symbol <select data-contract-symbol="'+phase+'" style="padding:3px;font-size:11px"><option value="MGC">MGC</option><option value="GC">GC</option></select></label></div></div>'+
 '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:6px">'+[1,2,3,4].map(t=>stepCard(phase,t)).join('')+'</div></div>';
const manualPanel=document.createElement('div');
manualPanel.style.cssText='margin:8px 0;font-size:11px;min-width:0';
manualPanel.innerHTML='<details><summary style="cursor:pointer;font-weight:600">P1 / P2 · Manual Risk & Contracts</summary>'+
 '<p style="font-size:10px;opacity:.75;margin:5px 0">Each R step has its own risk, RR and stop movement. A win resets the R sequence. MGC: $10 per $1 price move per contract; GC: $100. Contracts are whole numbers rounded DOWN so gross risk does not exceed the entered budget.</p>'+
 phaseCards(1)+phaseCards(2)+'</details>';
box.querySelector('[data-section="challenge-settings"] .jj-risk-section-body').append(manualPanel);
const fundedManualPanel=document.createElement('div');
fundedManualPanel.style.cssText='margin:8px 0;font-size:11px;min-width:0;max-width:100%';
fundedManualPanel.innerHTML='<details><summary style="cursor:pointer;font-weight:600">P3 · Manual Risk & Contracts</summary>'+phaseCards(3)+'</details>';
box.querySelector('[data-section="funded-settings"] .jj-risk-section-body').append(fundedManualPanel);
const contractSizing=()=>{const isFtmo=firmBar.querySelector('[data-firm-type]')?.value==='ftmo';box.querySelectorAll('[data-sizing-label]').forEach(el=>el.textContent=isFtmo?'Lots':'Contracts');for(const phase of [1,2,3]){
 const sym=box.querySelector('[data-contract-symbol="'+phase+'"]')?.value||'MGC';
 const dollarsPerPoint=sym==='GC'?100:10;
 for(const tier of [1,2,3,4]){
  const key=phase+'-'+tier;
  const budget=Number(box.querySelector('[data-manual-risk="'+key+'"]')?.value);
  const move=Number(box.querySelector('[data-contract-stop="'+key+'"]')?.value);
  const out=box.querySelector('[data-contract-result="'+key+'"]');
  const detail=box.querySelector('[data-contract-detail="'+key+'"]');
  if(!out||!detail)continue;
  if(!(budget>0)||!(move>0)){out.textContent='—';detail.textContent='Enter risk and stop movement';continue}
  if(isFtmo){const lots=budget/(move*100);out.textContent=lots.toFixed(3).replace(/0+$/,'').replace(/\.$/,'')+' lots';detail.textContent='$'+budget.toFixed(2)+' exact planned risk · XAUUSD 100 oz/lot assumption · excludes spread/slippage';continue;}
  // Gold futures trade in 0.10-point increments. Round stop distance UP
  // to the next valid tick so contract sizing never understates stop risk.
  const tickSize=.1;
  const tickMove=Math.ceil((move-1e-9)/tickSize)*tickSize;
  const riskPerContract=tickMove*dollarsPerPoint;
  const contracts=Math.max(0,Math.floor((budget+1e-8)/riskPerContract));
  const actual=contracts*riskPerContract;
  out.textContent=String(contracts)+' '+sym;
  detail.textContent=contracts===0?'Minimum 1 contract risks $'+riskPerContract.toFixed(2):
   '$'+actual.toFixed(2)+' gross stop risk · $'+riskPerContract.toFixed(2)+'/contract · '+tickMove.toFixed(2)+'-point tick-aligned stop · excludes fees/slippage';
 }
}};
try{const stored=JSON.parse(localStorage.getItem(contractKey)||'{}');
 for(const el of box.querySelectorAll('[data-contract-symbol],[data-contract-stop]')){
  const id=el.dataset.contractSymbol!==undefined?'s'+el.dataset.contractSymbol:'d'+el.dataset.contractStop;
  if(Object.prototype.hasOwnProperty.call(stored,id)&&
   (el.tagName==='SELECT'||Number(stored[id])>0))el.value=String(stored[id]);
 }
}catch(e){}
const persistContracts=()=>{
 const stored={};
 box.querySelectorAll('[data-contract-symbol]').forEach(el=>stored['s'+el.dataset.contractSymbol]=el.value);
 box.querySelectorAll('[data-contract-stop]').forEach(el=>stored['d'+el.dataset.contractStop]=el.value);
 try{localStorage.setItem(contractKey,JSON.stringify(stored))}catch(e){}
 contractSizing();
};
manualPanel.addEventListener('input',persistContracts);
fundedManualPanel.addEventListener('input',persistContracts);
manualPanel.addEventListener('change',persistContracts);
fundedManualPanel.addEventListener('change',persistContracts);

try{const stored=JSON.parse(localStorage.getItem(manualRiskKey)||'{}');box.querySelectorAll('[data-manual-mode]').forEach(el=>{if(stored['m'+el.dataset.manualMode])el.value=stored['m'+el.dataset.manualMode]});box.querySelectorAll('[data-manual-risk]').forEach(el=>{const val=stored['r'+el.dataset.manualRisk];if(Number(val)>0)el.value=val});box.querySelectorAll('[data-manual-rr]').forEach(el=>{const val=stored['rr'+el.dataset.manualRr];if(Number(val)>0)el.value=val})}catch(e){}
const comparePanel=document.createElement('div');comparePanel.innerHTML='<div data-compare style="min-width:0"></div>';
const manualConfig=()=>{const result={};for(let n=1;n<=3;n++){const mode=box.querySelector('[data-manual-mode="'+n+'"]').value;if(mode==='manual')result[n]=[1,2,3,4].map(k=>Math.max(0,Number(box.querySelector('[data-manual-risk="'+n+'-'+k+'"]').value)||0))}return result};const manualRRConfig=()=>{const result={};for(let n=1;n<=3;n++)result[n]=[1,2,3,4].map(k=>{const el=box.querySelector('[data-manual-rr="'+n+'-'+k+'"]');return el.value!==''&&Number(el.value)>0?Number(el.value):null});return result};
const persistManualRisks=()=>{contractSizing();const stored={};box.querySelectorAll('[data-manual-mode]').forEach(el=>stored['m'+el.dataset.manualMode]=el.value);box.querySelectorAll('[data-manual-risk]').forEach(el=>stored['r'+el.dataset.manualRisk]=el.value);box.querySelectorAll('[data-manual-rr]').forEach(el=>stored['rr'+el.dataset.manualRr]=el.value);try{localStorage.setItem(manualRiskKey,JSON.stringify(stored))}catch(e){}renderRisk()};manualPanel.addEventListener('change',persistManualRisks);fundedManualPanel.addEventListener('change',persistManualRisks);

group('funded-results','04 · Funded · Results',[box.querySelector('[data-funded-results]')]);
group('challenge-results','03 · Challenge · Results',[box.querySelector('[data-kpis]'),box.querySelector('[data-multi-results]'),box.querySelector('[data-prob-results]'),box.querySelector('[data-prob]')]);
// Results order: Challenge, Funded, Combined (preserve existing nodes and saved disclosure states).
box.querySelector('[data-section="funded-results"]').before(box.querySelector('[data-section="challenge-results"]'));
const combined=document.createElement('div');combined.dataset.combinedResults='';
box.querySelector('[data-section="funded-results"]').after(combined);
group('combined-results','05 · Combined · Final Results',[combined]);
// Keep all three result sections together under one collapsible heading.
const resultsSections=['challenge-results','funded-results','combined-results'].map(id=>box.querySelector('[data-section="'+id+'"]'));
const resultsGroup=document.createElement('details');resultsGroup.className='jj-risk-section';resultsGroup.dataset.section='results-group';
const resultsSummary=document.createElement('summary');const resultsArrow=document.createElement('span');resultsArrow.className='jj-risk-chevron';resultsArrow.setAttribute('aria-hidden','true');resultsArrow.textContent='▸';resultsSummary.append(resultsArrow,document.createTextNode('03–05 · Results · Challenge / Funded / Combined'));
const resultsBody=document.createElement('div');resultsBody.className='jj-risk-section-body';resultsGroup.append(resultsSummary,resultsBody);resultsSections[0].before(resultsGroup);resultsSections.forEach(section=>resultsBody.append(section));

resultsGroup.after(comparePanel);const compareSection=group('manual-auto','05A · Manual vs Auto · Comparison',[comparePanel]);compareSection.addEventListener('toggle',()=>{if(compareSection.open)renderRisk()});
const strategyPanel=document.createElement('div');strategyPanel.dataset.strategyPanel='';compareSection.after(strategyPanel);const strategySection=group('strategy-comparison','06 · Risk Strategy Comparison',[strategyPanel],false);strategySection.addEventListener('toggle',()=>{if(strategySection.open)renderRisk()});
const funnel=document.createElement('div');funnel.dataset.funnel='';box.querySelector('[data-section="strategy-comparison"]').after(funnel);group('funnel','07 · P1 → P2 → P3 → P4 · Account Funnel',[funnel]);
const wrCompare=document.createElement('div');wrCompare.dataset.wrCompare='';wrCompare.innerHTML='<label style="display:block;font-size:12px;margin-bottom:7px">Compare trade win rates (%) <input data-wr-options value="15, 20, 25, 30, 35, 40" style="width:min(100%,330px);padding:5px" aria-label="Win rates to compare"></label><div data-wr-results style="overflow-x:auto"></div><p style="font-size:11px;opacity:.7">Comparison uses the loaded parameters unless the selected mode changes them. Expected values, not guaranteed results. Unresolved paths at the depth limit are excluded from passes.</p>';
box.querySelector('[data-section="funnel"]').after(wrCompare);
group('wr-comparison','07A · Win Rate Comparison',[wrCompare],false);
wrCompare.querySelector('[data-wr-options]').addEventListener('change',()=>renderRisk());
const wrModeBar=document.createElement('div');wrModeBar.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;font-size:12px';wrModeBar.innerHTML='<label>Compare by <select data-compare-mode style="padding:5px;border-radius:5px"><option value="wr">Win Rate</option><option value="strategy">Auto vs Manual (07A)</option><option value="accounts">Account Quantity</option><option value="risk">Risk multiplier</option><option value="rr">Risk / Reward</option><option value="purchase">Purchase strategy</option><option value="capacity">Trades per day</option><option value="target">Total cash payout goal</option><option value="pnl">Net P&amp;L goal</option><option value="p3target">P3 target (Section 02 · Funded)</option><option value="matrix">Win Rate × RR</option><option value="firm">Prop firm</option><option value="custom">Saved scenarios</option></select></label><label data-compare-values-label>Values (%) <input data-compare-values value="15, 20, 25, 30, 35, 40" style="width:min(100%,230px);padding:5px"></label>';
wrCompare.querySelector('[data-wr-options]').closest('label').style.display='none';
wrCompare.prepend(wrModeBar);
const wrCompareMode=wrModeBar.querySelector('[data-compare-mode]'),wrCompareValues=wrModeBar.querySelector('[data-compare-values]');
try{const mode=localStorage.getItem('jj-calculator09-compare-mode');if([...wrCompareMode.options].some(o=>o.value===mode))wrCompareMode.value=mode;else if(mode==='p2target')wrCompareMode.value='p3target';const saved=localStorage.getItem('jj-calculator09-compare-values-'+wrCompareMode.value);if(saved)wrCompareValues.value=saved}catch(e){}
const wrDefaults={strategy:'auto, manual',wr:'15, 20, 25, 30, 35, 40',accounts:'5, 10, 20, 30, 50',risk:'0.5, 0.75, 1, 1.25, 1.5',rr:'2.5, 3, 3.5, 4, 5',purchase:'fixed, target, payout',capacity:'3, 5, 7, 10',target:'5000, 10000',pnl:'5000, 10000',p3target:'2000, 3500, 4000, 5000',matrix:'20x3, 25x3, 30x3, 20x4, 25x4, 30x4',firm:'topstep, ftmo',custom:''};
const wrLabels={strategy:'Strategies',wr:'Win rates (%)',accounts:'Evaluation counts',risk:'Risk multipliers',rr:'Reward ratios',purchase:'Purchase modes',capacity:'Trades/day',target:'Total cash goals ($)',pnl:'Net profit goals ($)',p3target:'Funded P3 targets ($)',matrix:'WR × RR pairs',firm:'Firms',custom:'Saved scenario names'};
const updateWrCompareMode=()=>{const mode=wrCompareMode.value;wrModeBar.querySelector('[data-compare-values-label]').firstChild.textContent=wrLabels[mode]+' ';let saved=null;try{saved=localStorage.getItem('jj-calculator09-compare-values-'+mode)}catch(e){}wrCompareValues.value=saved||wrDefaults[mode]};
wrCompareMode.addEventListener('change',()=>{updateWrCompareMode();try{localStorage.setItem('jj-calculator09-compare-mode',wrCompareMode.value)}catch(e){}renderRisk()});
wrCompareValues.addEventListener('change',()=>{try{localStorage.setItem('jj-calculator09-compare-values-'+wrCompareMode.value,wrCompareValues.value)}catch(e){}renderRisk()});
updateWrCompareMode();

const wrPresetBar=document.createElement('div');wrPresetBar.style.cssText='display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 7px;font-size:11px';wrPresetBar.innerHTML='<label>Column preset <select data-wr-preset style="padding:5px;border-radius:5px"><option value="original">Original · 16 columns</option><option value="funnel">Funnel & pass rates</option><option value="trades">Trades & efficiency</option><option value="finance">Costs, payout & ROI</option><option value="efficiency">Efficiency & unit costs</option><option value="risk">Risk & survival</option><option value="outcomes">Payout probability & timing</option><option value="all">All columns</option><option value="custom">Custom</option></select></label><button type="button" data-wr-save style="padding:5px 8px;border:1px solid #8886;border-radius:5px;cursor:pointer">Save custom</button>';wrCompare.querySelector('[data-wr-results]').before(wrPresetBar);
const wrOriginalColumns=['WR','Phase','Accounts','Pass %','Total %','Avg T','Avg W','Avg L','Tot T','Trades / Pass','Pass Paths','Stage $','Cost / result','Expected cash','Net P/L','ROI'];
const wrExtraColumns=['Eval buys','Funded attempts','Payouts','Eval fees','Activation fees','Total spent','Payout / success','Cost / payout','Overall pass %','Eval fail %','Funded fail %','Funded unresolved %','Cost / funded','Cost / P1 pass','Cost / P2 pass','Expected trades','Trades / payout','Net / eval buy','Payout / spent','≥1 payout chance','Days / payout est.','95% spend to first payout est.','Payouts / 100 evals','Net / trade'];
const wrAllColumns=[...wrOriginalColumns,...wrExtraColumns];
const wrPresetColumns={
 original:wrOriginalColumns,
 funnel:['WR','Phase','Accounts','Pass %','Total %','Eval buys','Funded attempts','Payouts','Overall pass %'],
 trades:['WR','Phase','Accounts','Pass %','Avg T','Avg W','Avg L','Tot T','Trades / Pass','Pass Paths'],
 finance:['WR','Phase','Accounts','Stage $','Cost / result','Eval fees','Activation fees','Total spent','Payout / success','Cost / payout','Expected cash','Net P/L','ROI'],
 efficiency:['WR','Phase','Accounts','Pass %','Tot T','Trades / Pass','Expected trades','Trades / payout','Cost / funded','Cost / P1 pass','Cost / P2 pass','Net / eval buy'],
 risk:['WR','Phase','Accounts','Pass %','Total %','Overall pass %','Eval fail %','Funded fail %','Funded unresolved %','Cost / payout','Net P/L','ROI'],
 outcomes:['WR','Phase','Accounts','Overall pass %','≥1 payout chance','Days / payout est.','95% spend to first payout est.','Payouts / 100 evals','Cost / payout','Expected cash','Net P/L','ROI'],
 all:wrAllColumns
};
let wrPreset='original';try{wrPreset=localStorage.getItem('jj-calculator09-wr-column-preset')||'original'}catch(e){}
const wrPresetSelect=wrPresetBar.querySelector('[data-wr-preset]');
if(!['original','funnel','trades','finance','efficiency','risk','outcomes','all','custom'].includes(wrPreset)&&!wrPreset.startsWith('named:'))wrPreset='original';
wrPresetSelect.value=wrPreset;
wrPresetSelect.addEventListener('change',()=>{wrPreset=wrPresetSelect.value;if(wrPreset!=='custom'&&wrPresetColumns[wrPreset])wrHiddenColumns=wrAllColumns.filter(x=>!wrPresetColumns[wrPreset].includes(x));else{try{const saved=JSON.parse(localStorage.getItem('jj-calculator09-wr-custom-columns')||'[]');wrHiddenColumns=Array.isArray(saved)?saved:[]}catch(e){wrHiddenColumns=[]}}try{localStorage.setItem('jj-calculator09-wr-column-preset',wrPreset);localStorage.setItem('jj-calculator09-wr-hidden-columns',JSON.stringify(wrHiddenColumns))}catch(e){}applyWrColumnFilter();if(wrColumnFilter.open){wrColumnFilter.open=false;wrColumnFilter.open=true}});
let wrHiddenColumns=[];try{const stored=JSON.parse(localStorage.getItem('jj-calculator09-wr-hidden-columns')||'[]');if(Array.isArray(stored))wrHiddenColumns=stored.filter(x=>typeof x==='string')}catch(e){}
const wrNamedKey='jj-calculator09-wr-named-presets';
let wrNamedPresets={};try{const saved=JSON.parse(localStorage.getItem(wrNamedKey)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))wrNamedPresets=saved}catch(e){}
const refreshWrNamedOptions=()=>{[...wrPresetSelect.options].filter(o=>o.value.startsWith('named:')).forEach(o=>o.remove());Object.keys(wrNamedPresets).sort().forEach(name=>{const option=document.createElement('option');option.value='named:'+name;option.textContent=name;wrPresetSelect.append(option)})};
refreshWrNamedOptions();if(wrPreset.startsWith('named:')){if(wrNamedPresets[wrPreset.slice(6)]){wrPresetSelect.value=wrPreset;wrHiddenColumns=wrAllColumns.filter(x=>!wrNamedPresets[wrPreset.slice(6)].includes(x))}else{wrPreset='original';wrPresetSelect.value='original'}}
wrPresetBar.querySelector('[data-wr-save]').textContent='Save as preset';
wrPresetBar.querySelector('[data-wr-save]').addEventListener('click',()=>{const name=window.prompt('Name this column preset:','My comparison');if(!name||!name.trim())return;const clean=name.trim().slice(0,60);if(wrNamedPresets[clean]&&!window.confirm('Replace preset "'+clean+'"?'))return;wrNamedPresets[clean]=wrAllColumns.filter(x=>!wrHiddenColumns.includes(x));try{localStorage.setItem(wrNamedKey,JSON.stringify(wrNamedPresets))}catch(e){}refreshWrNamedOptions();wrPreset='named:'+clean;wrPresetSelect.value=wrPreset;try{localStorage.setItem('jj-calculator09-wr-column-preset',wrPreset)}catch(e){}});
const wrDelete=document.createElement('button');wrDelete.type='button';wrDelete.textContent='Delete preset';wrDelete.style.cssText='padding:5px 8px;border:1px solid #8886;border-radius:5px;cursor:pointer';wrPresetBar.append(wrDelete);
wrDelete.addEventListener('click',()=>{if(!wrPreset.startsWith('named:'))return;const name=wrPreset.slice(6);if(!window.confirm('Delete preset "'+name+'"?'))return;delete wrNamedPresets[name];try{localStorage.setItem(wrNamedKey,JSON.stringify(wrNamedPresets))}catch(e){}refreshWrNamedOptions();wrPreset='original';wrPresetSelect.value=wrPreset;wrHiddenColumns=wrAllColumns.filter(x=>!wrOriginalColumns.includes(x));try{localStorage.setItem('jj-calculator09-wr-column-preset',wrPreset);localStorage.setItem('jj-calculator09-wr-hidden-columns',JSON.stringify(wrHiddenColumns))}catch(e){}applyWrColumnFilter()});

const wrColumnFilter=document.createElement('details');wrColumnFilter.style.cssText='position:relative;display:inline-block;margin:0 0 8px;font-size:11px';wrColumnFilter.innerHTML='<summary style="cursor:pointer;border:1px solid #8886;border-radius:6px;padding:5px 9px;list-style:revert">Columns</summary><div data-wr-column-options style="position:absolute;z-index:30;top:100%;left:0;max-height:260px;overflow-y:auto;min-width:180px;background:var(--jj-card-bg,#222);color:inherit;border:1px solid #8888;border-radius:6px;padding:8px;box-shadow:0 5px 20px #0005"></div>';
wrCompare.querySelector('[data-wr-results]').before(wrColumnFilter);

if(wrPreset!=='custom'&&wrPresetColumns[wrPreset])wrHiddenColumns=wrAllColumns.filter(x=>!wrPresetColumns[wrPreset].includes(x));
const applyWrColumnFilter=()=>{const table=wrCompare.querySelector('[data-wr-results] table');if(!table)return;const headers=[...table.querySelectorAll('thead th')];headers.forEach((h,i)=>{const hidden=wrHiddenColumns.includes(h.textContent.trim());for(const tr of table.rows){if(tr.cells[i])tr.cells[i].style.display=hidden?'none':''}})};
wrColumnFilter.addEventListener('toggle',()=>{if(!wrColumnFilter.open)return;const headers=[...wrCompare.querySelectorAll('[data-wr-results] thead th')].map(x=>x.textContent.trim());const host=wrColumnFilter.querySelector('[data-wr-column-options]');host.replaceChildren();headers.forEach(name=>{const label=document.createElement('label');label.style.cssText='display:flex;gap:6px;align-items:center;padding:4px 2px;cursor:pointer';const check=document.createElement('input');check.type='checkbox';check.checked=!wrHiddenColumns.includes(name);check.addEventListener('change',()=>{wrHiddenColumns=check.checked?wrHiddenColumns.filter(x=>x!==name):[...new Set([...wrHiddenColumns,name])];wrPreset='custom';wrPresetSelect.value='custom';try{localStorage.setItem('jj-calculator09-wr-column-preset','custom')}catch(e){}try{localStorage.setItem('jj-calculator09-wr-hidden-columns',JSON.stringify(wrHiddenColumns))}catch(e){}applyWrColumnFilter()});label.append(check,document.createTextNode(name));host.append(label)})});
document.addEventListener('pointerdown',e=>{if(wrColumnFilter.open&&!wrColumnFilter.contains(e.target))wrColumnFilter.open=false});
const title=Array.from(box.querySelectorAll('h4')).find(x=>x.textContent.includes('All scenario paths'));
if(title){const nodes=[];let n=title;while(n&&n.tagName!=='P'){nodes.push(n);n=n.nextElementSibling}group('paths','10 · Challenge · Scenario Paths',nodes);const body=box.querySelector('[data-section="paths"] .jj-risk-section-body');const extra=document.createElement('details');extra.className='jj-risk-section';const summary=document.createElement('summary');summary.textContent='All scenario paths';extra.appendChild(summary);nodes.forEach(node=>{if(node===title)node.remove();else extra.appendChild(node)});body.appendChild(extra)}
const challengeStageView=document.createElement('div');challengeStageView.className='jj-challenge-stage-view';challengeStageView.innerHTML='<p style="font-size:11px;opacity:.8">P1 and P2 scenario paths use the current challenge risk, win-rate and checkpoint settings. P2 chances are conditional on reaching P2.</p><div data-challenge-stage-tables></div>';
box.querySelector('[data-section="paths"] .jj-risk-section-body').prepend(challengeStageView);
const fundedScenario=document.createElement('div');fundedScenario.innerHTML='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><label style="font-size:12px">Filter <select data-funded-path-filter><option value="all">All paths</option><option value="target">Target hit</option><option value="closed">Failed</option><option value="active">Unresolved</option></select></label><span data-funded-path-count style="font-size:11px;opacity:.7"></span></div><div data-funded-path-table></div><div style="display:flex;align-items:center;gap:8px;margin-top:8px"><button data-funded-prev type="button">Previous</button><span data-funded-page style="font-size:11px"></span><button data-funded-next type="button">Next</button></div><p style="font-size:11px;opacity:.7">Illustrative funded paths from the existing funded engine; no payout waiting period or firm-specific day rules are enforced here.</p>';box.querySelector('[data-section="paths"]').after(fundedScenario);group('funded-paths','11 · P3 Funded · Scenario Paths',[fundedScenario]);let fundedPage=0;const expandedFunded=new Set();
const tradeStatsPanel=document.createElement('div');
tradeStatsPanel.dataset.tradeStatsPanel='';
tradeStatsPanel.innerHTML='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px"><label style="font-size:11px">Trade system <select data-trade-stats-scope style="font-size:11px"><option value="evaluation">Evaluation</option><option value="funded">Funded</option></select></label><small style="opacity:.7">Probability-weighted trade paths</small></div><div data-trade-stats-content></div>';
box.querySelector('[data-section="funded-paths"]').after(tradeStatsPanel);
group('trade-statistics','12 · Trade Statistics · Winning & Losing Streaks',[tradeStatsPanel]);
const kpiFourteen=document.createElement('div');kpiFourteen.dataset.kpiFourteen='';
/* group() inserts before its first node: attach this node first, otherwise section 14 is detached and invisible. */
box.querySelector('[data-section="trade-statistics"]').after(kpiFourteen);
mountKpiFourteen(kpiFourteen);
group('financial-formulas','14 · P1–P4 Financial Formulas & KPIs',[kpiFourteen]);
const tradeStatsScope=tradeStatsPanel.querySelector('[data-trade-stats-scope]');
tradeStatsScope.addEventListener('change',()=>renderRisk());
const purchaseStrategy=document.createElement('div');purchaseStrategy.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;margin:0 0 10px';purchaseStrategy.innerHTML='<strong>Purchase strategy</strong><select data-purchase-strategy aria-label="Account purchase strategy"><option value="fixed">Fixed purchases</option><option value="target">Reach Funded Limit</option><option value="payout">Maximum Funded Limit Payout</option><option value="reach-payout">Reach Payout Target</option></select><span data-purchase-strategy-help style="opacity:.75"></span>';box.querySelector('[data-section="funnel"] .jj-risk-section-body').prepend(purchaseStrategy);const strategySelect=purchaseStrategy.querySelector('[data-purchase-strategy]');let purchaseStrategyMode='target';
const purchaseCountControls=document.createElement('div');purchaseCountControls.style.cssText='display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:7px 0';purchaseCountControls.innerHTML='<label data-fixed-count-wrap style="font-size:12px">Evaluations to buy </label><label data-funded-count-wrap style="font-size:12px">Funded account target <input data-funded-count type="number" min="1" step="1" value="20" style="width:68px;padding:5px;margin-left:5px"></label>';purchaseStrategy.after(purchaseCountControls);const fundedCountInput=purchaseCountControls.querySelector('[data-funded-count]');
const payoutCountWrap=document.createElement('label');payoutCountWrap.dataset.payoutCountWrap='';payoutCountWrap.style.fontSize='12px';
payoutCountWrap.innerHTML='Payout target <input data-payout-count type="number" min="1" max="5" step="1" value="5" style="width:62px;padding:5px;margin-left:5px">';
purchaseCountControls.append(payoutCountWrap);
const payoutCountInput=payoutCountWrap.querySelector('[data-payout-count]');
const payoutTargets={ftmo:5,topstep:5};
try{const stored=JSON.parse(localStorage.getItem('jj-risk-calculator09-payout-targets-v1')||'{}');for(const firm of ['ftmo','topstep'])if(Number.isFinite(+stored[firm]))payoutTargets[firm]=Math.max(1,Math.floor(+stored[firm]));}catch(e){}
payoutCountInput.addEventListener('change',()=>{
 payoutTargets[currentFirm]=Math.max(1,Math.min(currentFirm==='topstep'?5:100,Math.floor(Number(payoutCountInput.value)||5)));
 payoutCountInput.value=String(payoutTargets[currentFirm]);
 try{localStorage.setItem('jj-risk-calculator09-payout-targets-v1',JSON.stringify(payoutTargets))}catch(e){}
 saveSettings();renderRisk();
});purchaseCountControls.querySelector('[data-fixed-count-wrap]').append(box.querySelector('[data-account-count]'));const oldMulti=box.querySelector('[data-multi-controls]');oldMulti.style.display='none';oldMulti.querySelector('div').style.display='none';accountBar.style.display='none';let fundedTargets={ftmo:20,topstep:5};try{const savedTargets=JSON.parse(localStorage.getItem('jj-risk-calculator09-funded-targets-v1')||'{}');for(const k of ['ftmo','topstep'])if(Number.isFinite(+savedTargets[k]))fundedTargets[k]=Math.max(1,Math.min(k==='topstep'?5:100,Math.floor(+savedTargets[k])))}catch(e){}fundedCountInput.title='Target simultaneously funded accounts. Topstep allows at most five active funded accounts; cumulative funded attempts can exceed five in payout-target mode.';fundedCountInput.addEventListener('change',()=>{fundedTargets[currentFirm]=Math.max(1,Math.min(currentFirm==='topstep'?5:100,Math.floor(Number(fundedCountInput.value)||fundedTargets[currentFirm]||1)));fundedCountInput.value=String(fundedTargets[currentFirm]);try{localStorage.setItem('jj-risk-calculator09-funded-targets-v1',JSON.stringify(fundedTargets))}catch(e){}renderRisk()});
const allocationPreview=document.createElement('div');allocationPreview.dataset.allocationPreview='';box.querySelector('[data-section="funnel"]').after(allocationPreview);group('allocation-preview','08 · Replacement Until Funded Target · Preview',[allocationPreview]);
const stagesPreview=document.createElement('div');stagesPreview.dataset.stagesPreview='';box.querySelector('[data-section="allocation-preview"]').after(stagesPreview);group('stages-preview','09 · Firm Stages · Rules Preview',[stagesPreview]);
const consistencyPanel=document.createElement('div');consistencyPanel.dataset.consistencyPanel='';const consistencyToggle=document.createElement('label');consistencyToggle.style.cssText='display:flex;align-items:center;gap:7px;font-size:12px;margin:10px 0 5px';consistencyToggle.innerHTML='<input type="checkbox" data-consistency-enabled style="width:15px;height:15px"> Enable consistency rule';const challengeBody=box.querySelector('[data-section="challenge-settings"] .jj-risk-section-body');const challengeFields=challengeBody.querySelector('[data-risk-fields]');challengeFields.before(phaseGuide);challengeFields.after(consistencyToggle,consistencyPanel);
const topstepDailyToggle=document.createElement('label');
topstepDailyToggle.style.cssText='display:flex;align-items:center;gap:6px;margin:5px 0;font-size:11px';
topstepDailyToggle.innerHTML='<input data-topstep-daily-cap type="checkbox" style="width:15px;height:15px"> Apply optional daily loss cap to Topstep evaluation';
consistencyPanel.after(topstepDailyToggle);
topstepDailyToggle.querySelector('input').addEventListener('change',()=>{saveSettings();renderRisk()});

try{const saved=JSON.parse(localStorage.getItem('jj-risk-calculator09-sections-v1')||'{}');box.querySelectorAll('.jj-risk-section').forEach(d=>{if(typeof saved[d.dataset.section]==='boolean')d.open=saved[d.dataset.section]})}catch(e){}
box.addEventListener('toggle',e=>{if(!e.target.matches||!e.target.matches('.jj-risk-section'))return;try{const state={};box.querySelectorAll('.jj-risk-section').forEach(d=>state[d.dataset.section]=d.open);localStorage.setItem('jj-risk-calculator09-sections-v1',JSON.stringify(state))}catch(err){}},true);
const $=q=>box.querySelector(q);let page=0;const expandedPaths=new Set();
const parallelInput=document.createElement('input');parallelInput.type='number';parallelInput.min='1';parallelInput.max='100';parallelInput.step='1';parallelInput.value='1';parallelInput.dataset.parallelAccounts='';parallelInput.style.cssText='width:64px;padding:4px;border:1px solid #8886;border-radius:5px;background:transparent;color:inherit';
const signalsInput=document.createElement('input');signalsInput.type='number';signalsInput.min='1';signalsInput.max='100';signalsInput.step='1';signalsInput.value='5';signalsInput.dataset.signalsPerDay='';signalsInput.style.cssText='width:64px;padding:4px;border:1px solid #8886;border-radius:5px;background:transparent;color:inherit';
const settingsKey='jj-risk-calculator09-settings-v1';
const firmSettingsKey='jj-risk-calculator09-firm-profiles-v1';
const consistencyKey='jj-risk-calculator09-topstep-consistency-v1';
/* Topstep defaults to its 55% consistency rule. The P1 trade-planning
   checkpoint remains half the evaluation target (50%); these are different.
   Update the prior automatic 50% default once, leaving other custom rates
   untouched. The consistency input remains editable and stored locally. */
try{
 const migration='jj-topstep-consistency-official-55-v1';
 if(localStorage.getItem(migration)!=='1'){
  const previous=JSON.parse(localStorage.getItem(consistencyKey)||'{}')||{};
  if(previous.limit===undefined||Number(previous.limit)===50){
   previous.limit=55;
   localStorage.setItem(consistencyKey,JSON.stringify(previous));
  }
  localStorage.setItem(migration,'1');
 }
}catch(e){}


let accountMode='single',phaseMode='evaluation',currentFirm='ftmo';
const firmSelect=firmBar.querySelector('[data-firm-type]');
const auditedPresetButton=document.createElement('button');auditedPresetButton.type='button';auditedPresetButton.textContent='GPT';auditedPresetButton.title='Load GPT audited 12-trade preset';auditedPresetButton.style.display='none';
const presetKey='jj-risk-calculator09-named-presets-v1';
const loadedPresetKey='jj-risk-calculator09-loaded-preset-v1';
const rememberLoadedPreset=key=>{try{const all=JSON.parse(localStorage.getItem(loadedPresetKey)||'{}');all[currentFirm]=key;localStorage.setItem(loadedPresetKey,JSON.stringify(all))}catch(e){}};
const getLoadedPreset=()=>{try{return JSON.parse(localStorage.getItem(loadedPresetKey)||'{}')[currentFirm]||''}catch(e){return ''}};
const presetBar=document.createElement('div');presetBar.style.cssText='display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:10px;margin:3px 0;min-width:0';
presetBar.innerHTML='<select data-named-presets aria-label="Presets" style="width:150px;max-width:45vw;min-width:0;padding:3px 5px;font-size:11px;border:1px solid #8886;border-radius:5px;background:var(--card,var(--bg,#fff));color:inherit"><option value="">Presets…</option></select><button type="button" data-preset-load title="Load selected preset">Load</button><button type="button" data-preset-save title="Save current settings as a new preset">Save</button><button type="button" data-preset-delete title="Delete selected custom preset" aria-label="Delete preset">×</button><span data-preset-note style="opacity:.7;font-size:10px"></span>';
presetBar.querySelectorAll('button').forEach(el=>el.style.cssText='font-size:10px;line-height:1.1;padding:4px 6px;border:1px solid #8886;border-radius:5px;background:transparent;color:inherit;cursor:pointer;min-height:25px');
firmBar.appendChild(presetBar);
const presetSelect=presetBar.querySelector('[data-named-presets]'),presetNote=presetBar.querySelector('[data-preset-note]');
const presetVersion=document.createElement('small');presetVersion.textContent='Presets v44';presetVersion.style.cssText='opacity:.5;font-size:9px';presetBar.append(presetVersion);
const readNamedPresets=()=>{try{const x=JSON.parse(localStorage.getItem(presetKey)||'{}');return x&&typeof x==='object'?x:{}}catch(e){return {}}};
/* Cloudflare KV is the shared source of truth for the single-user Academy.
   No Google login, sync button, clipboard, or device-specific account required. */
let cloudPresetReady=false,cloudWriteQueue=Promise.resolve();
const cloudPresetUrl=new URL('api/presets',window.location.href.replace(/[^/]*$/, '')).pathname;
const cloudRequest=async(method,payload)=>{
 const response=await fetch(cloudPresetUrl,{method,cache:'no-store',headers:payload?{'Content-Type':'application/json'}:{},...(payload?{body:JSON.stringify(payload)}:{})});
 const data=await response.json().catch(()=>({error:'Preset API returned non-JSON content'}));
 if(!response.ok)throw Error(data.error||'Cloud storage unavailable');
 return data;
};
const syncKey=()=>cloudPresetReady;
const pullSyncedPresets=async()=>{
 const response=await cloudRequest('GET');
 if(!response||!response.ready)throw Error('Cloud storage unavailable');
 if(response.data&&response.data.presets){
  const remote={ftmo:{},topstep:{}};
  for(const firm of ['ftmo','topstep'])remote[firm]=response.data.presets[firm]||{};
  localStorage.setItem(presetKey,JSON.stringify(remote));
 }else{
  /* One-time migration of existing browser presets when the shared store is empty. */
  const local=readNamedPresets();
  if(Object.values(local).some(group=>group&&Object.keys(group).length)){
   await cloudRequest('PUT',{version:1,presets:local});
  }
 }
 cloudPresetReady=true;
 refreshNamedPresets();
 presetNote.textContent='Presets available on all devices';
};
const pushSyncedPresets=()=> {
 /* Serialize writes to preserve the save/delete order on this device. */
 cloudWriteQueue=cloudWriteQueue.catch(()=>{}).then(async()=>{
  const data=await cloudRequest('PUT',{version:1,presets:readNamedPresets()});
  cloudPresetReady=true;
  presetNote.textContent='Saved everywhere';
  return data;
 });
 return cloudWriteQueue;
};
pullSyncedPresets().catch(e=>{cloudPresetReady=false;presetNote.textContent='Cloud offline: '+e.message;console.warn('JJ preset cloud:',e.message)});
window.addEventListener('pageshow',()=>{if(!cloudPresetReady)pullSyncedPresets().catch(()=>{});else if(document.visibilityState==='visible')pullSyncedPresets().catch(()=>{})});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pullSyncedPresets().catch(()=>{})});
const exportPresetButton=document.createElement('button');exportPresetButton.type='button';exportPresetButton.textContent='Copy';exportPresetButton.title='Copy selected saved preset or current parameters as JSON for simulation';exportPresetButton.style.cssText='font-size:10px;line-height:1.1;padding:4px 6px;border:1px solid #8886;border-radius:5px;background:transparent;color:inherit;cursor:pointer;min-height:25px';presetBar.insertBefore(exportPresetButton,presetNote);
exportPresetButton.addEventListener('click',async()=>{
 const selected=presetSelect.value,all=readNamedPresets()[currentFirm]||{},name=selected.startsWith('user:')?selected.slice(5):'Current settings';
 const profile=selected.startsWith('user:')?all[name]:captureProfile();
 if(!profile){presetNote.textContent='Select a saved preset';return}
 const payload=JSON.stringify({source:'Chapter 09',firm:currentFirm,preset:name,settings:profile},null,2);
 try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(payload);presetNote.textContent='Copied · paste in ChatGPT'}catch(e){window.prompt('Copy these preset settings and paste in ChatGPT:',payload);presetNote.textContent='Copy JSON from popup'}
});

/* Compact per-preset manager: every custom preset has its own delete X. */
const presetManager=document.createElement('details');
presetManager.style.cssText='position:relative;display:inline-block;font-size:11px';
presetManager.innerHTML='<summary style="cursor:pointer;list-style:none;padding:4px 7px;border:1px solid #8886;border-radius:5px;min-height:25px;box-sizing:border-box">All presets ▾</summary><div data-preset-manager-list style="position:absolute;right:0;top:calc(100% + 4px);z-index:45;min-width:220px;max-width:min(320px,85vw);max-height:290px;overflow:auto;padding:5px;border:1px solid #8887;border-radius:8px;background:var(--card,#1e2530);box-shadow:0 5px 18px #0003"></div>';
presetBar.insertBefore(presetManager,presetNote);
const drawPresetManager=()=>{
 const list=presetManager.querySelector('[data-preset-manager-list]');
 list.replaceChildren();
 const builtIn=document.createElement('div');builtIn.style.cssText='padding:6px 7px;font-weight:600;opacity:.7';builtIn.textContent='Built-in · GPT (protected)';list.append(builtIn);
 const names=Object.keys(readNamedPresets()[currentFirm]||{}).sort();
 for(const name of names){
  const row=document.createElement('div');row.style.cssText='display:flex;gap:5px;align-items:center;padding:3px 2px;border-top:1px solid #8883';
  const select=document.createElement('button');select.type='button';select.textContent=name;select.title='Load '+name;select.style.cssText='flex:1;min-width:0;text-align:left;overflow-wrap:anywhere;font-size:11px;border:0;background:transparent;color:inherit;cursor:pointer;padding:5px';
  select.addEventListener('click',()=>{presetSelect.value='user:'+name;presetBar.querySelector('[data-preset-load]').click();presetManager.open=false});
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Delete '+name;remove.setAttribute('aria-label','Delete preset '+name);
  remove.style.cssText='flex:none;border:1px solid #8886;border-radius:5px;font-size:15px;line-height:1;padding:4px 8px;background:transparent;color:inherit;cursor:pointer';
  remove.addEventListener('click',()=>{presetSelect.value='user:'+name;presetBar.querySelector('[data-preset-delete]').click();drawPresetManager()});
  row.append(select,remove);list.append(row);
 }
 if(!names.length){const empty=document.createElement('div');empty.textContent='No custom presets';empty.style.cssText='padding:6px;opacity:.7';list.append(empty)}
};
presetManager.addEventListener('toggle',()=>{if(presetManager.open)drawPresetManager()});
document.addEventListener('click',event=>{if(presetManager.open&&!presetManager.contains(event.target))presetManager.open=false});
const refreshNamedPresets=()=>{const selected=presetSelect.value;const data=readNamedPresets()[currentFirm]||{};presetSelect.innerHTML='<option value="">Presets…</option><option value="gpt">GPT · Audited 12-trade test</option>';Object.keys(data).sort().forEach(name=>{const opt=document.createElement('option');opt.value='user:'+name;opt.textContent=name;presetSelect.appendChild(opt)});if([...presetSelect.options].some(o=>o.value===selected))presetSelect.value=selected;if(presetManager.open)drawPresetManager()};
const captureProfile=()=>{const data={mode:$('[data-target-mode]').value,fields:{},accountMode,accountCount:$('[data-account-count]').value,parallelAccounts:parallelInput.value,signalsPerDay:signalsInput.value,phaseMode,purchaseStrategy:purchaseStrategyMode,funded:{}};box.querySelectorAll('[data-funded]').forEach(el=>data.funded[el.dataset.funded]=el.value);box.querySelectorAll('[data-k]').forEach(el=>data.fields[el.dataset.k]=el.value);return data};
const firmDefaults=firm=>firm==='ftmo'?{mode:'2',accountMode:'multi',accountCount:20,parallelAccounts:20,signalsPerDay:7,fields:{target:1000,target2:500,limit:1000,dailyLimit:500},funded:{target:1800,limit:1000,dailyLimit:500,split:80}}:{mode:'1',accountMode:'multi',accountCount:5,parallelAccounts:5,signalsPerDay:7,fields:{target:3000,limit:2000},funded:{target:4000,limit:2000,split:75}};
const readProfiles=()=>{try{const p=JSON.parse(localStorage.getItem(firmSettingsKey)||'{}');return p&&typeof p==='object'?p:{}}catch(e){return {}}};
const writeProfile=(firm,data)=>{try{const p=readProfiles();p[firm]=data;localStorage.setItem(firmSettingsKey,JSON.stringify(p))}catch(e){}};
const applyProfile=data=>{if(!data||typeof data!=='object')return;
accountMode=data.accountMode==='multi'?'multi':'single';purchaseStrategyMode=['fixed','target','payout','reach-payout'].includes(data.purchaseStrategy)?data.purchaseStrategy:'target';strategySelect.value=purchaseStrategyMode;
if(['evaluation','funded','combined'].includes(data.phaseMode))phaseMode=data.phaseMode;
const applyNum=(el,value,min,max)=>{if(el&&value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value)))el.value=String(Math.max(min,Math.min(max,Math.floor(Number(value)))))};
applyNum(signalsInput,data.signalsPerDay,1,100);applyNum(parallelInput,data.parallelAccounts,1,100);
applyNum($('[data-account-count]'),data.accountCount,2,100);
if(data.mode==='1'||data.mode==='2')$('[data-target-mode]').value=data.mode;
if(data.funded)box.querySelectorAll('[data-funded]').forEach(el=>{const value=data.funded[el.dataset.funded];if(value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value)))el.value=String(value)});
if(data.fields)box.querySelectorAll('[data-k]').forEach(el=>{const value=data.fields[el.dataset.k];if(value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value)))el.value=String(value)});
};
function saveSettings(){try{const data=captureProfile();writeProfile(currentFirm,data);localStorage.setItem(settingsKey,JSON.stringify({...data,firmType:currentFirm}))}catch(e){}}
function restoreSettings(){try{const legacy=JSON.parse(localStorage.getItem(settingsKey)||'null');const profiles=readProfiles();const firm=['ftmo','topstep'].includes(legacy?.firmType)?legacy.firmType:'ftmo';currentFirm=firm;firmSelect.value=firm;
if(legacy&&!profiles[firm])writeProfile(firm,legacy);
applyProfile({...firmDefaults(firm),...(readProfiles()[firm]||legacy||{}),fields:{...firmDefaults(firm).fields,...((readProfiles()[firm]||legacy||{}).fields||{})},funded:{...firmDefaults(firm).funded,...((readProfiles()[firm]||legacy||{}).funded||{})}});
}catch(e){}}
restoreSettings();try{if(!localStorage.getItem('jj-risk-calculator09-ftmo-target1800-v1')){const profile=readProfiles().ftmo;if(profile){profile.funded={...(profile.funded||{}),target:1800};writeProfile('ftmo',profile)}if(currentFirm==='ftmo'){const el=box.querySelector('[data-funded="target"]');if(el)el.value='1800';saveSettings()}localStorage.setItem('jj-risk-calculator09-ftmo-target1800-v1','1')}}catch(e){}auditedPresetButton.addEventListener('click',()=>{const firm=currentFirm,ft=firm==='ftmo';const put=(selector,value)=>{const el=box.querySelector(selector);if(el)el.value=String(value)};phaseMode='combined';purchaseStrategyMode='target';strategySelect.value='target';accountMode='multi';put('[data-target-mode]',ft?2:1);const ev={target:ft?1000:3000,target2:500,limit:ft?1000:2000,dailyLimit:ft?500:1000,rr:ft?3:1.5,winRate:35,depth:12,accountCost:100,tradesPerDay:3,floor:100};const funded={target:ft?1800:4000,limit:ft?1000:2000,dailyLimit:ft?500:1000,rr:ft?3:4,winRate:35,depth:12,split:ft?80:75,activation:0,tradesPerDay:3,floor:100};Object.entries(ev).forEach(([k,val])=>put('[data-k="'+k+'"]',val));Object.entries(funded).forEach(([k,val])=>put('[data-funded="'+k+'"]',val));put('[data-account-count]',ft?20:5);put('[data-funded-count]',ft?20:5);fundedTargets[firm]=ft?20:5;try{localStorage.setItem('jj-risk-calculator09-funded-targets-v1',JSON.stringify(fundedTargets))}catch(e){}if(!ft){try{const settings=JSON.parse(localStorage.getItem(consistencyKey)||'{}');settings.limit=55;settings.enabled=true;localStorage.setItem(consistencyKey,JSON.stringify(settings))}catch(e){}}saveSettings();page=0;expandedPaths.clear();renderRisk()});
const captureManualPreset=()=>{
 const settings={};
 box.querySelectorAll('[data-contract-symbol]').forEach(el=>settings['s'+el.dataset.contractSymbol]=el.value);
 box.querySelectorAll('[data-contract-stop]').forEach(el=>settings['d'+el.dataset.contractStop]=el.value);
 box.querySelectorAll('[data-manual-mode]').forEach(el=>settings['m'+el.dataset.manualMode]=el.value);
 box.querySelectorAll('[data-manual-risk]').forEach(el=>settings['r'+el.dataset.manualRisk]=el.value);
 box.querySelectorAll('[data-manual-rr]').forEach(el=>settings['rr'+el.dataset.manualRr]=el.value);
 return settings;
};
const restoreManualPreset=settings=>{
 if(!settings||typeof settings!=='object'||Array.isArray(settings))return false;
 /* Restore all 3 phase modes + 4 risk and RR tiers, including blank RR overrides. */
 for(const phase of [1,2,3]){
  const mode=box.querySelector('[data-manual-mode="'+phase+'"]');
  const m=settings['m'+phase];if(mode&&(m==='manual'||m==='auto'))mode.value=m;
  for(const tier of [1,2,3,4]){
   const suffix=phase+'-'+tier;
   const risk=box.querySelector('[data-manual-risk="'+suffix+'"]');
   const rr=box.querySelector('[data-manual-rr="'+suffix+'"]');
   const riskValue=settings['r'+suffix],rrValue=settings['rr'+suffix];
   if(risk&&riskValue!==undefined&&riskValue!==null&&riskValue!==''&&Number.isFinite(Number(riskValue))&&Number(riskValue)>0)risk.value=String(riskValue);
   if(rr&&Object.prototype.hasOwnProperty.call(settings,'rr'+suffix)){
    rr.value=rrValue===null||rrValue===''?'':Number.isFinite(Number(rrValue))&&Number(rrValue)>0?String(rrValue):'';
   }
  }
 }
 for(const el of box.querySelectorAll('[data-contract-symbol],[data-contract-stop]')){
  const id=el.dataset.contractSymbol!==undefined?'s'+el.dataset.contractSymbol:'d'+el.dataset.contractStop;
  const value=settings[id];
  if(value!==undefined&&value!==null&&(el.tagName==='SELECT'||Number(value)>0))el.value=String(value);
 }
 persistContracts();
 try{localStorage.setItem(manualRiskKey,JSON.stringify(captureManualPreset()))}catch(e){}
 return true;
};
const manualPresetComplete=settings=>!!settings&&[1,2,3].every(phase=>
 ['m'+phase,...[1,2,3,4].flatMap(t=>['r'+phase+'-'+t,'rr'+phase+'-'+t])]
 .every(key=>Object.prototype.hasOwnProperty.call(settings,key)));
const verifyManualPreset=settings=>{
 const actual=captureManualPreset();
 if(!manualPresetComplete(settings))return false;
 return Object.keys(actual).every(k=>String(actual[k])===String(settings[k]));
};
/* A preset captures the complete editable scenario and its visible page choices.
   Results/history are recalculated, not copied as stale outputs. */
const capturePageSettings=()=>{
 const controls={};
 const selectors=['[data-k]','[data-funded]','[data-manual-mode]','[data-manual-risk]','[data-manual-rr]','[data-contract-symbol]','[data-contract-stop]',
  '[data-consistency-enabled]','[data-consistency-limit]','[data-topstep-daily-cap]','[data-account-count]','[data-funded-count]','[data-payout-count]',
  '[data-parallel-accounts]','[data-signals-per-day]','[data-purchase-strategy]','[data-target-mode]'];
 for(const selector of selectors){
  box.querySelectorAll(selector).forEach(el=>{
   const key=Object.keys(el.dataset).sort().map(k=>k+':'+el.dataset[k]).join('|');
   if(key)controls[key]=el.type==='checkbox'?el.checked:el.value;
  });
 }
 const sections={};box.querySelectorAll('.jj-risk-section[data-section]').forEach(el=>sections[el.dataset.section]=el.open);
 return {version:2,controls,sections,activeStrategy,phaseMode,accountMode,purchaseStrategyMode};
};
const restorePageSettings=pageSettings=>{
 if(!pageSettings||pageSettings.version!==2||!pageSettings.controls)return;
 const controls=pageSettings.controls;
 box.querySelectorAll('input[data-k],input[data-funded],input[data-manual-risk],input[data-manual-rr],input[data-contract-stop],select[data-contract-symbol],select[data-manual-mode],input[data-consistency-enabled],input[data-consistency-limit],input[data-topstep-daily-cap],input[data-account-count],input[data-funded-count],input[data-payout-count],input[data-parallel-accounts],input[data-signals-per-day],select[data-purchase-strategy],input[data-target-mode]').forEach(el=>{
  const key=Object.keys(el.dataset).sort().map(k=>k+':'+el.dataset[k]).join('|');
  if(!Object.prototype.hasOwnProperty.call(controls,key))return;
  const value=controls[key];
  if(el.type==='checkbox')el.checked=!!value;
  else if(el.tagName==='SELECT'){if([...el.options].some(o=>o.value===value))el.value=value}
  else if(value!==null&&value!==undefined)el.value=String(value);
 });
 if(Object.prototype.hasOwnProperty.call(STRATEGIES,pageSettings.activeStrategy)){
  activeStrategy=pageSettings.activeStrategy;
  try{localStorage.setItem(ACTIVE_KEY,activeStrategy)}catch(e){}
 }
 if(['evaluation','funded','combined'].includes(pageSettings.phaseMode))phaseMode=pageSettings.phaseMode;
 if(['single','multi'].includes(pageSettings.accountMode))accountMode=pageSettings.accountMode;
 if(['fixed','target','payout','reach-payout'].includes(pageSettings.purchaseStrategyMode)){
  purchaseStrategyMode=pageSettings.purchaseStrategyMode;strategySelect.value=purchaseStrategyMode;
 }
 const count=Number(fundedCountInput.value);
 if(Number.isFinite(count)&&count>=1)fundedTargets[currentFirm]=Math.min(currentFirm==='topstep'?5:100,Math.floor(count));
 try{localStorage.setItem('jj-risk-calculator09-funded-targets-v1',JSON.stringify(fundedTargets))}catch(e){}
 const consistency={};
 try{Object.assign(consistency,JSON.parse(localStorage.getItem(consistencyKey)||'{}'))}catch(e){}
 const toggle=box.querySelector('[data-consistency-enabled]');
 const limit=box.querySelector('[data-consistency-limit]');
 if(toggle)consistency.enabled=toggle.checked;
 if(limit&&Number.isFinite(Number(limit.value)))consistency.limit=Number(limit.value);
 try{localStorage.setItem(consistencyKey,JSON.stringify(consistency))}catch(e){}
 try{localStorage.setItem(manualRiskKey,JSON.stringify(captureManualPreset()))}catch(e){}
 if(pageSettings.sections){
  box.querySelectorAll('.jj-risk-section[data-section]').forEach(el=>{
   if(typeof pageSettings.sections[el.dataset.section]==='boolean')el.open=pageSettings.sections[el.dataset.section];
  });
 }
};
const presetSnapshot=()=>({...captureProfile(),fundedTarget:fundedTargets[currentFirm],payoutTarget:payoutTargets[currentFirm],manualPhases:captureManualPreset(),pageSettings:capturePageSettings()});
const applyNamedPreset=data=>{if(!data)return false;applyProfile(data);if(Number.isFinite(Number(data.payoutTarget))){payoutTargets[currentFirm]=Math.max(1,Math.min(currentFirm==='topstep'?5:100,Math.floor(Number(data.payoutTarget))));try{localStorage.setItem('jj-risk-calculator09-payout-targets-v1',JSON.stringify(payoutTargets))}catch(e){}}if(Number.isFinite(Number(data.fundedTarget))){fundedTargets[currentFirm]=Math.max(1,Math.min(currentFirm==='topstep'?5:100,Math.floor(Number(data.fundedTarget))));try{localStorage.setItem('jj-risk-calculator09-funded-targets-v1',JSON.stringify(fundedTargets))}catch(e){}}restorePageSettings(data.pageSettings);restoreManualPreset(data.manualPhases);saveSettings();page=0;expandedPaths.clear();renderRisk();return verifyManualPreset(data.manualPhases)};
/* LOAD deliberately reads cloud first, never silently preferring old browser storage. */
presetBar.querySelector('[data-preset-load]').addEventListener('click',async()=>{
 const key=presetSelect.value;if(!key)return;
 if(key==='gpt'){auditedPresetButton.click();rememberLoadedPreset('gpt');presetNote.textContent='GPT preset loaded';return}
 const name=key.slice(5),firm=currentFirm;
 const button=presetBar.querySelector('[data-preset-load]');button.disabled=true;
 presetNote.textContent='Loading saved preset from cloud…';
 try{
  const remote=await cloudRequest('GET');
  if(!remote.ready||!remote.data||!remote.data.presets)throw Error('Preset cloud data unavailable');
  const data=remote.data.presets[firm]?.[name];
  if(!data){presetNote.textContent='Preset not found in cloud · save it again';return}
  const all=readNamedPresets();
  all[firm]={...(all[firm]||{}),[name]:data};
  try{localStorage.setItem(presetKey,JSON.stringify(all))}catch(e){}
  if(firm!==currentFirm)return;
  const verified=applyNamedPreset(data);
  rememberLoadedPreset(key);
  if(verified){presetNote.textContent='Cloud loaded · all R1–R4 values match';}
  else if(!manualPresetComplete(data.manualPhases)){
   const keys=data.manualPhases?Object.keys(data.manualPhases):[];
   presetNote.textContent='Cloud preset incomplete ('+keys.length+'/27 phase entries). Re-save this preset.';
  }else{
   const actual=captureManualPreset();
   const differences=Object.keys(data.manualPhases).filter(k=>String(data.manualPhases[k])!==String(actual[k]));
   const key=differences[0];
   presetNote.textContent='Manual mismatch: '+key+' cloud='+String(data.manualPhases[key])+' page='+String(actual[key]);
  }
 }catch(e){presetNote.textContent='Cloud Load failed: '+e.message}
 finally{button.disabled=false}
});
presetBar.querySelector('[data-preset-save]').addEventListener('click',()=>{const name=(window.prompt('Name this preset (saved for '+currentFirm.toUpperCase()+'):', '')||'').trim().slice(0,60);if(!name)return;if(name.toLowerCase().startsWith('gpt')){presetNote.textContent='GPT names are reserved';return}const all=readNamedPresets();all[currentFirm]=all[currentFirm]||{};if(all[currentFirm][name]&&!window.confirm('Replace preset "'+name+'"?'))return;all[currentFirm][name]=presetSnapshot();if(!manualPresetComplete(all[currentFirm][name].manualPhases)){presetNote.textContent='Could not capture manual R1–R4 settings';return}try{localStorage.setItem(presetKey,JSON.stringify(all));refreshNamedPresets();presetSelect.value='user:'+name;rememberLoadedPreset('user:'+name);presetNote.textContent='Saved '+name;pushSyncedPresets().catch(e=>{presetNote.textContent='Not synced: '+e.message})}catch(e){presetNote.textContent='Browser storage unavailable'}});
presetBar.querySelector('[data-preset-delete]').addEventListener('click',()=>{const key=presetSelect.value;if(!key||key==='gpt'){presetNote.textContent='GPT preset cannot be deleted';return}const name=key.slice(5);if(!window.confirm('Delete preset "'+name+'"?'))return;const all=readNamedPresets();if(all[currentFirm])delete all[currentFirm][name];try{localStorage.setItem(presetKey,JSON.stringify(all));refreshNamedPresets();presetSelect.value='';if(getLoadedPreset()===key)rememberLoadedPreset('');presetNote.textContent='Deleted '+name;pushSyncedPresets().catch(e=>{presetNote.textContent='Delete not synced: '+e.message})}catch(e){presetNote.textContent='Unable to delete'}});
refreshNamedPresets();const restoredPreset=getLoadedPreset();if(restoredPreset&&[...presetSelect.options].some(o=>o.value===restoredPreset)){presetSelect.value=restoredPreset;presetNote.textContent='Loaded '+(restoredPreset==='gpt'?'GPT preset':restoredPreset.slice(5))}
strategySelect.value=purchaseStrategyMode;strategySelect.addEventListener('change',()=>{purchaseStrategyMode=strategySelect.value;saveSettings();renderRisk()});
firmSelect.addEventListener('change',()=>{const next=firmSelect.value;if(next===currentFirm)return;writeProfile(currentFirm,captureProfile());currentFirm=next;const profile=readProfiles()[next];if(profile)applyProfile(profile);else{applyProfile(firmDefaults(next))}saveSettings();refreshNamedPresets();const remembered=getLoadedPreset();if(remembered&&[...presetSelect.options].some(o=>o.value===remembered))presetSelect.value=remembered;presetNote.textContent=remembered?'Loaded '+(remembered==='gpt'?'GPT preset':remembered.slice(5)):'';page=0;expandedPaths.clear();renderRisk()});
signalsInput.addEventListener('change',()=>{saveSettings();renderRisk()});parallelInput.addEventListener('change',()=>{saveSettings();renderRisk()});

const vals=()=>{const num=(k,f)=>{const x=Number(box.querySelector('[data-k="'+k+'"]').value);return Number.isFinite(x)?x:f};return {targetMode:box.querySelector('[data-target-mode]').value==='1'?1:2,target:Math.max(.01,num('target',1000)),target2:Math.max(.01,num('target2',500)),limit:Math.max(.01,num('limit',1000)),dailyLimit:Math.max(.01,num('dailyLimit',500)),tradesPerDay:Math.max(1,Math.min(100,Math.floor(num('tradesPerDay',3)))),rr:Math.max(.01,num('rr',3)),floor:Math.max(0,num('floor',100)),winRate:Math.min(100,Math.max(0,num('winRate',50))),accountCost:Math.max(0,num('accountCost',100)),depth:Math.max(1,Math.min(12,Math.floor(num('depth',6))))}};
/* Topstep: two separate trading-day checkpoints with independent R1-R4
   attempt counters, one shared account balance, and inherited EOD trailing floor.
   Finite model: one modeled day per checkpoint, no extra recovery days. */
/* Convert planned gross risk to tradable gold futures contracts when stop
   information is present. Fees are round-turn USD per contract, default zero
   until explicitly configured. */
function goldExecution(v,stage,tier,planned,room,dailyRoom,remainingGoal,rr){
 const spec=v.contractSpecs?.[stage]?.[tier];
 const fee=Math.max(0,Number(v.roundTurnFee)||0);
 if(!spec||!(spec.stop>0))return {risk:Math.max(0,Math.min(planned,room,dailyRoom)),fee:0,contracts:null};
 // Overshooting the remaining profit target is allowed; cap by loss limits,
 // not remainingGoal/rr. Capping creates false zero-contract dead ends.
 const pointValue=spec.symbol==='GC'?100:10;
 const tickStop=Math.ceil((spec.stop-1e-9)/.1)*.1;
 const unitRisk=tickStop*pointValue;
 const maxContracts=Math.floor(Math.max(0,Math.min(planned/unitRisk,room/(unitRisk+fee),dailyRoom/(unitRisk+fee))));
 const contracts=Math.max(0,maxContracts);
 return {risk:contracts*unitRisk,fee:contracts*fee,contracts};
}
function calcTopstep(path,v){
 const checkpointTarget=v.target/2;
 // FIX-009: T1 has two distinct trading-day $1,500 targets; no consistency filter.
 const attemptsPerStage=Math.max(1,Math.min(8,Math.floor(v.depth)));
 let stage=1,stagePnl=0,total=0,prob=1,status='active';
 let stageTrades=0,steps=[],trailingFloor=-v.limit,peakEOD=0;
 const dailyTotals={1:0,2:0};
 for(const c of path){
  if(status!=='active'||stageTrades>=attemptsPerStage)break;
  const day=stage,checkpointStage=stage;
  const required=checkpointTarget-stagePnl; // FIX-006: identical $1,500 strategy target on both days
  const room=total-trailingFloor,dailyRoom=v.topstepOptionalDailyCap?v.dailyLimit+stagePnl:Infinity;
  if(room<=v.floor+1e-7){status='closed';break}
  if(dailyRoom<=1e-7||required<=1e-7){status='daily-blocked';break;}
  let streak=0;
  for(let i=steps.length-1;i>=0;i--){
   if(steps[i].checkpointStage!==checkpointStage||steps[i].c==='W')break;
   streak++;
  }
  const manual=v.manualRisks?.[checkpointStage];
  const rrOverride=v.manualRRs?.[checkpointStage]?.[Math.min(3,streak)];
  const rr=manual&&Number(rrOverride)>0?Number(rrOverride):v.rr;
  const planned=manual?manual[Math.min(3,streak)]:
   v.riskModel==='fixed'?v.baseRisk:
   v.riskModel==='half'?Math.max(0,required/rr/2):
   v.fixedRisk||v.baseRisk||Math.max(0,required/rr);
  const execution=goldExecution(v,checkpointStage,Math.min(3,streak),planned,Math.max(0,room-v.floor),dailyRoom,required,rr);
  const risk=execution.risk;
  if(risk<=1e-7){status='daily-blocked';break;}
  const delta=(c==='W'?risk*rr:-risk)-execution.fee;
  total+=delta;stagePnl+=delta;stageTrades++;
  dailyTotals[day]=stagePnl;
  prob*=c==='W'?v.winRate/100:1-v.winRate/100;
  if(total<=trailingFloor+1e-7)status='closed';
  let passed=false;
  if(status==='active'&&c==='W'){
   if(stage===1&&stagePnl>=checkpointTarget-1e-7)passed=true;
   else if(stage===2&&stagePnl>=checkpointTarget-1e-7){
    passed=true;
    status='target'; // Day 2 reached $1,500; two distinct days complete the T1 evaluation model. // strategy day complete; broker consistency/total still unmet
   }
  }
  // FIX-005 pending: two-day consistency overshoots may need a third trading day.
  // Never treat these unresolved evaluation states as confirmed account failures.
  steps.push({c,risk,fee:execution.fee,contracts:execution.contracts,rr,pnl:total,stage:checkpointStage,checkpointStage,
   stagePnl,passed,day,dayPnl:stagePnl,lossesToday:0,
   dailyLeft:Math.max(0,v.dailyLimit+stagePnl)});
  if(status==='active'&&passed&&stage===1){
   peakEOD=Math.max(peakEOD,total);
   trailingFloor=Math.min(0,Math.max(trailingFloor,peakEOD-v.limit));
   stage=2;stagePnl=0;stageTrades=0;
  }
 }
 // A zero-sized next manual risk is terminal, not two identical W/L children.
 if(status==='active'&&stageTrades<attemptsPerStage&&v.manualRisks?.[stage]){
  let nextStreak=0;
  for(let i=steps.length-1;i>=0;i--){
   if(steps[i].checkpointStage!==stage||steps[i].c==='W')break;
   nextStreak++;
  }
  if(!(v.manualRisks[stage][Math.min(3,nextStreak)]>1e-7))status='daily-blocked';
 }
 // Contract rounding can make the next trade impossible even when the
 // dollar-risk budget remains positive. End that branch before recursion.
 if(status==='active'&&stageTrades<attemptsPerStage&&v.contractSpecs?.[stage]){
  let streak=0;
  for(let i=steps.length-1;i>=0;i--){
   if(steps[i].checkpointStage!==stage||steps[i].c==='W')break;
   streak++;
  }
  const tier=Math.min(3,streak);
  const manual=v.manualRisks?.[stage];
  const rrOverride=v.manualRRs?.[stage]?.[tier];
  const rr=manual&&Number(rrOverride)>0?Number(rrOverride):v.rr;
  const required=checkpointTarget-stagePnl; // FIX-006: identical $1,500 strategy target on both days
  const planned=manual?manual[tier]:v.fixedRisk||v.baseRisk||required/rr;
  const dailyRoom=v.topstepOptionalDailyCap?v.dailyLimit+stagePnl:Infinity;
  if(!(goldExecution(v,stage,tier,planned,total-trailingFloor-v.floor,dailyRoom,required,rr).risk>1e-7))
   status='daily-blocked';
 }
 // Close branches immediately when the next trade cannot execute. Otherwise
 // two child branches inherit the same probability and break the model.
 if(status==='active'&&stageTrades<attemptsPerStage&&
    ((v.topstepOptionalDailyCap&&v.dailyLimit+stagePnl<=1e-7)||
     total-trailingFloor<=v.floor+1e-7||
     (stage===2&&checkpointTarget-stagePnl<=1e-7)))
   status='daily-blocked';
 const checkpoint=steps.some(t=>t.checkpointStage===1&&t.passed);
 return {path:steps.map(t=>t.c).join(''),pnl:total,stage,stagePnl,
  left:total-trailingFloor,status,topstepCheckpoint:checkpoint,
  topstepBestDay:Math.max(0,dailyTotals[1],dailyTotals[2]),
  topstepRequiredTarget:v.target,
  risk:Math.max(0,total-trailingFloor),steps,prob,day:stage,
  dailyLeft:Math.max(0,v.dailyLimit+stagePnl),dayPnl:stagePnl,lossesToday:0,
  checkpointAttempts:stageTrades,checkpointLimit:attemptsPerStage,trailingFloor};
}
/* Topstep funded accounts: drawdown trails only at end of day and locks at
   zero once the high-water mark reaches the starting balance plus allowance.
   This differs from the static CFD drawdown in calc(). */
function calcTopstepFunded(path,v){
 let total=0,prob=1,day=1,dayPnl=0,lossesToday=0,status='active';
 let peakEOD=0,trailingFloor=-v.limit,steps=[];
 const manual=v.manualRisks?.[3];
 for(const c of path){
  if(status!=='active')break;
  /* Each win resets the risk sequence; three consecutive losses close it. */
  if(dayPnl<-1e-7||lossesToday>=v.tradesPerDay||(v.topstepOptionalDailyCap&&v.dailyLimit+dayPnl<=1e-7)){
   peakEOD=Math.max(peakEOD,total);
   trailingFloor=Math.min(0,Math.max(trailingFloor,peakEOD-v.limit));
   if(total<=trailingFloor+1e-7){status='closed';break;}
   day++;dayPnl=0;lossesToday=0;
  }
  const room=total-trailingFloor;
  const dailyRoom=v.topstepOptionalDailyCap?v.dailyLimit+dayPnl:Infinity;
  if(room<=v.floor+1e-7||dailyRoom<=1e-7){status='closed';break;}
  let streak=0;
  for(let i=steps.length-1;i>=0;i--){if(steps[i].c==='W')break;streak++;}
  if(streak>=3){status='closed';break;}
  const rrOverride=v.manualRRs?.[3]?.[Math.min(2,streak)];
  const rr=manual&&Number(rrOverride)>0?Number(rrOverride):v.rr;
  const planned=manual?manual[Math.min(2,streak)]:
   v.riskModel==='fixed'?v.baseRisk:
   v.riskModel==='half'?(v.target-total)/rr/2:
   v.riskModel==='buffer'?(steps.some(t=>t.c==='W')?450:150):
   v.fixedRisk||v.baseRisk||(v.target-total)/rr;
  const execution=goldExecution(v,3,Math.min(2,streak),planned,room-v.floor,dailyRoom,v.target-total,rr);
  const risk=execution.risk;
  if(!(risk>1e-7)){status='closed';break;}
  const delta=(c==='W'?risk*rr:-risk)-execution.fee;
  total+=delta;dayPnl+=delta;
  if(c==='L')lossesToday++;
  prob*=c==='W'?v.winRate/100:1-v.winRate/100;
  if(total<=trailingFloor+1e-7)status='closed';
  if(status==='active'&&total>=v.target-1e-7)status='target';
  steps.push({c,risk,fee:execution.fee,contracts:execution.contracts,rr,pnl:total,stage:1,checkpointStage:3,stagePnl:total,
   passed:status==='target',day,dayPnl,lossesToday,trailingFloor,ddAvailable:Math.max(0,total-trailingFloor),
   dailyLeft:Math.max(0,v.dailyLimit+dayPnl)});
 }
 /* A branch that cannot execute its NEXT trade must terminate now.
    Otherwise W/L children both inherit the same probability and mass > 1. */
 if(status==='active'){
  const nextDay=dayPnl<-1e-7||lossesToday>=v.tradesPerDay||(v.topstepOptionalDailyCap&&v.dailyLimit+dayPnl<=1e-7);
  const nextFloor=nextDay?Math.min(0,Math.max(trailingFloor,Math.max(peakEOD,total)-v.limit)):trailingFloor;
  const nextRoom=total-nextFloor;
  const nextDailyRoom=v.topstepOptionalDailyCap?(nextDay?v.dailyLimit:v.dailyLimit+dayPnl):Infinity;
  let nextStreak=0;
  for(let i=steps.length-1;i>=0;i--){if(steps[i].c==='W')break;nextStreak++;}
  const nextPlanned=manual?manual[Math.min(2,nextStreak)]:null;
  const nextRR=manual&&Number(v.manualRRs?.[3]?.[Math.min(2,nextStreak)])>0?
   Number(v.manualRRs[3][Math.min(2,nextStreak)]):v.rr;
  const nextRisk=manual?nextPlanned:v.fixedRisk||v.baseRisk||(v.target-total)/nextRR;
  const executable=goldExecution(v,3,Math.min(2,nextStreak),nextRisk,nextRoom-v.floor,nextDailyRoom,v.target-total,nextRR);
  if(nextStreak>=3||nextRoom<=v.floor+1e-7||nextDailyRoom<=1e-7||
     (manual&&!(nextPlanned>1e-7))||!(executable.risk>1e-7))status='closed';
 }
 return {path:steps.map(t=>t.c).join(''),pnl:total,stage:1,stagePnl:total,
  left:total-trailingFloor,status,steps,prob,day,dayPnl,lossesToday,
  dailyLeft:Math.max(0,v.dailyLimit+dayPnl),trailingFloor};
}
function calc(path,v){
if(v.topstepConsistency)return calcTopstep(path,v);
let stage=1,stagePnl=0,total=0,prob=1,steps=[],status='active',day=1,dayPnl=0,lossesToday=0;const dailyTotals={};let bestDay=0;
for(const c of path){
 // Terminal guard: never execute a trade after the final target or account closure.
 if(status==='target'||status==='closed')break;
 // A negative day, exhausted daily drawdown, or the loss-count cap closes that day.
 // The next simulated trade belongs to the following day, not the stopped day.
 if(dayPnl<-1e-7||lossesToday>=v.tradesPerDay||v.dailyLimit+dayPnl<=1e-7||(v.topstepConsistency&&dayPnl>=v.target/2-1e-7)){day++;dayPnl=0;lossesToday=0}
 const left=v.limit+stagePnl,goal=stage===1?(v.topstepConsistency?Math.max(v.target,bestDay/(v.consistencyRate/100)):v.target):v.target2;
 const dailyLeft=Math.max(0,Math.min(v.dailyLimit,v.dailyLimit+dayPnl));
 if(left<v.floor-1e-7||left<=1e-7){status='closed';break}
 const checkpointDay=v.topstepConsistency?Object.entries(dailyTotals).filter(([d,p])=>Number(d)<day&&p>=v.target/2-1e-7).map(([d])=>Number(d)).sort((a,b)=>a-b)[0]:undefined;const stageTier=v.manualStage||(v.topstepConsistency&&checkpointDay!==undefined?2:stage);const stageManual=v.manualRisks?.[stageTier];let streak=0;for(let i=steps.length-1;i>=0;i--){if(steps[i].stage!==stage||steps[i].c==='W'||v.topstepConsistency&&checkpointDay!==undefined&&steps[i].day<=checkpointDay)break;streak++}const selectedRR=v.manualRRs?.[stageTier]?.[Math.min(3,streak)];const tradeRR=stageManual&&Number(selectedRR)>0?Number(selectedRR):v.rr;const plannedRisk=stageManual?stageManual[Math.min(3,streak)]:v.riskModel==='adaptive'?Math.max(0,Math.min(v.baseRisk,((goal-stagePnl)/v.rr)*v.targetFactor,Math.max(0,left-v.reserve))):v.riskModel==='fixed'?v.baseRisk:v.riskModel==='half'?Math.max(0,(goal-stagePnl)/v.rr/2):v.riskModel==='recovery'?Math.min(450,250*(1+.5*steps.filter(t=>t.stage===stage&&t.c==='L').length)):v.riskModel==='buffer'?(steps.some(t=>t.c==='W')?450:150):v.fixedRisk?v.fixedRisk:v.ftmoFundedBuilder?(steps.some(x=>x.c==='W')?450:150):Math.max(0,(goal-stagePnl)/v.rr);const remainingGoalRisk=Math.max(0,(goal-stagePnl)/tradeRR);const risk=Math.min(plannedRisk,Math.max(0,left-v.floor),dailyLeft);
 if(risk<=1e-7){status='closed';break}
 const delta=c==='W'?risk*tradeRR:-risk,tradeDay=day,tradeStage=stage;
 stagePnl+=delta;total+=delta;dayPnl+=delta;dailyTotals[day]=(dailyTotals[day]||0)+delta;bestDay=Math.max(0,...Object.values(dailyTotals));
 if(c==='L')lossesToday++;
 prob*=c==='W'?v.winRate/100:1-v.winRate/100;
 let passed=false;
 if(stagePnl>=goal-1e-7&&(!v.topstepConsistency||(Object.values(dailyTotals).filter(n=>n>1e-7).length>=2&&bestDay<=stagePnl*(v.consistencyRate/100)+1e-7))){passed=true;if(stage===1&&v.targetMode===2){stage=2;stagePnl=0;day++;dayPnl=0;lossesToday=0}else {status='target';/* Final target is terminal: no further trades on this path. */}}
 else if(v.limit+stagePnl<v.floor-1e-7||v.limit+stagePnl<=1e-7)status='closed';
 steps.push({c,risk,rr:tradeRR,pnl:total,stage:tradeStage,checkpointStage:stageTier,stagePnl:passed?goal:stagePnl,passed,day:tradeDay,dayPnl,lossesToday,dailyLeft:Math.max(0,Math.min(v.dailyLimit,v.dailyLimit+dayPnl))});
}
const topstepCheckpoint=!!v.topstepConsistency&&Object.entries(dailyTotals).some(([dayValue,profit])=>profit>=v.target/2-1e-7&&(Number(dayValue)<day||Number(dayValue)===day&&(dayPnl>=v.target/2-1e-7||status==='target')));
const left=v.limit+stagePnl,goal=stage===1?v.target:v.target2;
if(status==='active'&&(left<v.floor-1e-7||left<=1e-7))status='closed';
const nextDay=dayPnl<-1e-7||lossesToday>=v.tradesPerDay||v.dailyLimit+dayPnl<=1e-7||(v.topstepConsistency&&dayPnl>=v.target/2-1e-7);
const nextDailyLeft=nextDay?v.dailyLimit:Math.max(0,Math.min(v.dailyLimit,v.dailyLimit+dayPnl));
return {path:steps.map(x=>x.c).join(''),pnl:total,stage,stagePnl,left,status,topstepCheckpoint,topstepBestDay:bestDay,topstepRequiredTarget:v.topstepConsistency?Math.max(v.target,bestDay/(v.consistencyRate/100)):v.target,
risk:status==='active'?Math.max(0,Math.min((goal-stagePnl)/v.rr,left,nextDailyLeft)):0,
steps,prob,day:day+(nextDay?1:0),dailyLeft:nextDailyLeft,dayPnl:nextDay?0:dayPnl,lossesToday:nextDay?0:lossesToday};
}
/* One stopping rule for every simulation consumer. Topstep resets its
   attempt counter at P2, so comparing steps.length with global depth alone can
   recurse indefinitely when the first day exhausts its own allowance. */
const scenarioFinished=(x,cfg,requestedPath='')=>x.status!=='active'||
 (cfg.topstepConsistency?
  x.checkpointAttempts>=x.checkpointLimit||
  x.steps.length>=2*x.checkpointLimit||
  (requestedPath.length>0&&x.steps.length<requestedPath.length):
  x.steps.length>=cfg.depth);
const readContractSpecs=()=>{
 const specs={};
 for(let stage=1;stage<=3;stage++){
  specs[stage]=[];
  const symbol=box.querySelector('[data-contract-symbol="'+stage+'"]')?.value||'MGC';
  for(let tier=1;tier<=4;tier++){
   const stop=Number(box.querySelector('[data-contract-stop="'+stage+'-'+tier+'"]')?.value);
   specs[stage].push(stop>0?{symbol,stop}:null);
  }
 }
 return specs;
};
const fundedBalance=n=>(n>0?'+':n<0?'−':'')+tableNumber(Math.abs(n));
function renderRisk(){
contractSizing();
const firmForPhases=firmBar.querySelector('[data-firm-type]').value;const expectedPhases=firmForPhases==='ftmo'?'2':'1';if($('[data-target-mode]').value!==expectedPhases)$('[data-target-mode]').value=expectedPhases;
const v=vals(),leaves=[],allPaths=[];Object.assign(v,STRATEGIES[activeStrategy].eval);v.manualRisks=manualConfig();v.manualRRs=manualRRConfig();v.contractSpecs=readContractSpecs();v.roundTurnFee=0;if(firmForPhases==='topstep'){v.topstepOptionalDailyCap=box.querySelector('[data-topstep-daily-cap]').checked;v.topstepConsistency=true;if(activeStrategy==='current')v.fixedRisk=1000;v.consistencyRate=Math.max(1,Math.min(100,Number(box.querySelector('[data-consistency-limit]')?.value)||55));}
function walk(path){const x=calc(path,v);if(path&&allPaths.length<4000)allPaths.push(x);if(scenarioFinished(x,v,path)){leaves.push(x);return}walk(path+'W');walk(path+'L')}
walk('');
const counts={target:0,closed:0,active:0,'daily-blocked':0};leaves.forEach(x=>counts[x.status]++);
/* P1/P2: derive paths from the same evaluation engine, not a separate assumed 3-attempt model. */
(function renderChallengeStages(){
 const host=box.querySelector('[data-challenge-stage-tables]');if(!host)return;
 const makeStage=(stage)=>{
  const paths=new Map();
  allPaths.concat(leaves).forEach(x=>{
   const steps=x.steps||[],selected=steps.filter(t=>(t.checkpointStage||t.stage)===stage);
   if(!selected.length)return;
   const key=selected.map(t=>t.c).join('');
   const moved=steps.some(t=>(t.checkpointStage||t.stage)>stage);
   const passed=selected.some(t=>t.passed)||moved||(stage===2&&x.status==='target');
   const final=x.status!=='active'||moved||passed;
   if(!final&&!selected.length)return;
   const conditional=selected.reduce((a,t)=>a*(t.c==='W'?v.winRate/100:1-v.winRate/100),1);
   const pnl=selected[selected.length-1].stagePnl;
   const prior=paths.get(key);
   if(!prior||(!prior.final&&final))paths.set(key,{key,conditional,pnl,passed,final,steps:selected});
  });
  const rows=[...paths.values()].sort((a,b)=>a.key.length-b.key.length||a.key.localeCompare(b.key)).slice(0,250);
  const title=stage===1?'P1 · Challenge scenarios':'P2 · Verification / second checkpoint scenarios';
  const fmt=n=>(n>0?'+':n<0?'−':'')+tableNumber(Math.abs(n));
  const pnlClass=n=>n>0?'jj-risk-win':n<0?'jj-risk-loss':'';
  const cellColor=n=>n>0?'color:#00df83;font-weight:800':n<0?'color:#f05b65;font-weight:750':'';
  const byPath=new Map(rows.map(x=>[x.key,x]));
  const body=rows.map(x=>{
   const w=byPath.get(x.key+'W'),l=byPath.get(x.key+'L');
   const next=w?.steps[x.steps.length]||l?.steps[x.steps.length];
   const risk=!x.final&&next?next.risk:null;
   const last=x.steps[x.steps.length-1];
   return '<tr><td>'+x.key+'</td><td>'+(x.conditional*100).toFixed(2)+'%</td><td style="color:#f05b65;font-weight:750">'+(risk===null?'—':'−'+tableNumber(risk))+'</td><td style="'+(w?cellColor(w.pnl):'')+'">'+(x.final?'—':w?fmt(w.pnl):'—')+'</td><td style="'+(l?cellColor(l.pnl):'')+'">'+(x.final?'—':l?fmt(l.pnl):'—')+'</td><td style="'+cellColor(x.pnl)+'">'+fmt(x.pnl)+'</td><td>'+tableNumber(Math.max(0,last.left??(v.limit+x.pnl)))+'</td><td>'+tableNumber(Math.max(0,(stage===1?v.target:v.target2)-x.pnl))+'</td><td style="'+(x.passed?'color:#00df83;font-weight:800':x.final?'color:#f05b65;font-weight:750':'')+'">'+(x.passed?'PASS':x.final?'STOP':'…')+'</td></tr>';
  }).join('');
  return '<details class="jj-risk-section"><summary>'+title+'</summary><div class="jj-risk-section-body"><div style="overflow-x:auto"><table><thead><tr><th>Path</th><th>%</th><th>Risk</th><th>Win</th><th>Loss</th><th>P&L</th><th>DD</th><th>Left</th><th>Result</th></tr></thead><tbody>'+body+'</tbody></table></div><small style="opacity:.7">Win/Loss show resulting stage P&L; terminal paths do not continue. DD uses evaluation allowance. P2 state can depend on P1 history.</small></div></details>';
 };
 host.innerHTML=makeStage(1)+makeStage(2);
})();
const actualEvaluationProbability=leaves.filter(x=>x.status==='target').reduce((sum,x)=>sum+x.prob,0);
/* Topstep planning benchmark uses two equivalent standalone checkpoints.
   This is a strategy model, NOT the carried-drawdown/consistency account forecast.
   Keep the latter available for diagnostics; never silently equate the two. */
const checkpointProbability=leaves.reduce((sum,path)=>sum+
 (path.steps.some(step=>step.checkpointStage===1&&step.passed)?path.prob:0),0);
// Three attempts per checkpoint: any win passes; only LLL fails.
const threeAttemptPass=1-Math.pow(1-Math.max(0,Math.min(1,v.winRate/100)),3);
const planningProbability=firmForPhases==='topstep'?threeAttemptPass*threeAttemptPass:actualEvaluationProbability;
// Financial results and account funnel must use actual carried-state outcomes.
// The simplified squared-checkpoint model is a planning benchmark only.
// Unresolved paths at finite depth are not counted as completed passes.
const probability=actualEvaluationProbability;
// Audit rule: unresolved evaluation leaves are not failures and must be reported separately.
const t1Probability=leaves.filter(x=>x.stage===2||x.status==='target').reduce((sum,x)=>sum+x.prob,0);
const failProbability=leaves.filter(x=>x.status==='closed').reduce((sum,x)=>sum+x.prob,0);
const unresolvedProbability=leaves.filter(x=>x.status==='active'||x.status==='daily-blocked').reduce((sum,x)=>sum+x.prob,0);
const expectedPnl=leaves.reduce((sum,x)=>sum+x.prob*x.pnl,0);
/* Outcome categories below describe the ACTUAL enumerated paths, not the
   hypothetical squared-checkpoint funnel. Mixing their denominators produces
   impossible pass/ruin totals. */
const resolvedProbability=actualEvaluationProbability+failProbability;
const terminalMass=leaves.reduce((sum,path)=>sum+path.prob,0);
if(Math.abs(terminalMass-1)>1e-6)console.warn('Evaluation probability mass invalid',terminalMass);
const resolvedPassRate=resolvedProbability>0?actualEvaluationProbability/resolvedProbability:0;
const kpiHelp={
'Pass chance':'Probability that one account reaches its selected target before hitting the loss limit, within the simulated trade depth. Sum of the probabilities of passing terminal paths.',
'Risk of ruin':'Probability that one account hits the modeled account loss allowance before reaching the target, within the simulated trade depth. This is not lifetime risk.',
'Unresolved':'Probability that one account has neither passed nor failed by the selected maximum number of simulated trades.',
'Most likely path':'The single complete simulated win/loss sequence with the highest individual probability. It is not necessarily the most likely overall outcome.',
'Pass / resolved':'Pass probability divided by pass plus ruin probability. Excludes unfinished paths, so it differs from the overall pass chance.',
'At least 1 challenge passes':'Chance at least one of the selected accounts passes: 1 − (1 − single-account pass chance) raised to the number of accounts. Assumes independent account outcomes.',
'No challenges pass':'Chance none of the accounts pass: (1 − single-account pass chance) raised to the number of accounts. Includes unresolved accounts.',
'Expected passed challenges':'Expected number of evaluations reaching the selected target: number purchased × single-challenge pass probability. This is not necessarily the number of funded accounts if more phases are required.',
'All challenges pass':'Chance every selected account passes: single-account pass chance raised to the number of accounts, assuming independence.',
'Expected ruined':'Average number of accounts that hit the modeled loss allowance: number of accounts × single-account ruin probability.',
'Expected unresolved':'Average number of accounts still neither passed nor failed at the simulation depth: number of accounts × unresolved probability.',
'Total evaluation fees':'Total purchase fees for the selected prop-firm evaluations: number of challenges × evaluation purchase fee. Excludes resets, activation and trading fees.',
'Cost per passed challenge':'Total evaluation purchase fees divided by expected passed challenges, or fee per challenge divided by modeled pass probability. This is an estimate within the selected trade depth, not a guaranteed funded-account acquisition cost. Further phases and activation fees are excluded.',
'target':'Count of completed simulated paths reaching the required target. This is a count of paths, not a probability.',
'closed':'Count of simulated paths stopped by the modeled account loss allowance.',
'active':'Count of paths still unfinished at the selected simulation depth.',
'daily-blocked':'Count of paths stopped by the daily limit within the simulated horizon.'
};
const kpiTooltip=(label,value,help)=>'<div class="jj-kpi-help" tabindex="0" aria-label="'+label+': '+help.replace(/"/g,'&quot;')+'"><span class="jj-kpi-label">'+label+'</span><strong>'+value+'</strong><span class="jj-kpi-tooltip" role="tooltip">'+help+'</span></div>';
const mostLikely=leaves.reduce((best,x)=>!best||x.prob>best.prob?x:best,null);
const fn=(k,d)=>{const x=Number(box.querySelector('[data-funded="'+k+'"]').value);return Number.isFinite(x)?x:d};
const fv={targetMode:1,target:Math.max(.01,fn('target',4000)),target2:1,limit:Math.max(.01,fn('limit',2000)),dailyLimit:Math.max(.01,fn('dailyLimit',1000)),tradesPerDay:Math.max(1,Math.min(100,Math.floor(fn('tradesPerDay',3)))),rr:Math.max(.01,fn('rr',3)),floor:Math.max(0,fn('floor',100)),winRate:Math.max(0,Math.min(100,fn('winRate',50))),depth:Math.max(1,Math.min(12,Math.floor(fn('depth',6))))};
if(firmForPhases==='topstep'&&activeStrategy==='current')fv.fixedRisk=1000;else if(activeStrategy==='current')fv.ftmoFundedBuilder=true;Object.assign(fv,STRATEGIES[activeStrategy].fund);fv.manualRisks=manualConfig();fv.manualRRs=manualRRConfig();fv.contractSpecs=readContractSpecs();fv.roundTurnFee=0;fv.manualStage=3;fv.topstepOptionalDailyCap=firmForPhases==='topstep'&&box.querySelector('[data-topstep-daily-cap]').checked;let fp=0,fr=0;const fundedLeaves=[];
if(phaseMode!=='evaluation'){function fw(path){const x=firmForPhases==='topstep'?calcTopstepFunded(path,fv):calc(path,fv);if(x.status!=='active'||x.steps.length>=fv.depth){fundedLeaves.push(x);if(x.status==='target')fp+=x.prob;if(x.status==='closed')fr+=x.prob;return}fw(path+'W');fw(path+'L')}fw('')}

// FIX-013: Reweight the already enumerated paths at each candidate win rate.
// Trade decisions and stop rules do not depend on win rate; only path probabilities do.
(function renderWrComparison(){
 const host=wrCompare.querySelector('[data-wr-results]');
 const compareMode=wrCompareMode.value,accountMode=compareMode==='accounts';
 const raw=wrCompareValues.value;
 const rates=[...new Set(raw.split(/[ ,;]+/).map(x=>x.trim()).filter(Boolean))].slice(0,20).filter(x=>['purchase','matrix','firm','custom','strategy'].includes(compareMode)||Number.isFinite(Number(x))&&Number(x)>=(compareMode==='wr'?0:0.01));
 if(!rates.length){host.textContent='Enter valid comparison values.';return}
 const enumerate=(params,isFunded,firm)=>{const results=[];const depth=Math.min(12,Math.max(1,params.depth));const calculate=isFunded?(firm==='topstep'?calcTopstepFunded:calc):(firm==='topstep'?calcTopstep:calc);const visit=path=>{const x=calculate(path,params);if(x.status!=='active'||x.steps.length>=depth||(!isFunded&&scenarioFinished(x,params,path))){results.push(x);return}if(path.length>=depth)return;visit(path+'W');visit(path+'L')};visit('');return results};
 const pathWeight=(x,p,wr,offset=0)=>{let prob=1;const counts={};for(const t of x.steps||[]){const stage=Number(t.checkpointStage||t.stage)||1;counts[stage]=(counts[stage]||0)+1;const key=(stage+offset)+'-'+Math.min(4,counts[stage]);const raw=wr?.[key];const n=raw!==undefined&&raw!==''?Number(raw):NaN;const chance=Number.isFinite(n)&&n>=0&&n<=100?n/100:p;prob*=t.c==='W'?chance:1-chance}return prob};
 const fmt=n=>Number.isFinite(n)?n.toFixed(2):'—';
 const money=n=>Number.isFinite(n)?'$'+n.toLocaleString('en-US',{maximumFractionDigits:2,minimumFractionDigits:2}):'—';
 const numAccounts=Math.max(1,Math.floor(Number(box.querySelector('[data-account-count]').value)||20));
 const fee=Math.max(0,v.accountCost),activation=Math.max(0,fn('activation',0));
 const split=Math.max(0,Math.min(1,fn('split',80)/100));
 const targetFunded=Math.max(1,Math.floor(Number(fundedCountInput.value)||20));
 const targetPayout=Math.max(1,Math.floor(Number(payoutCountInput.value)||5));
 const mode=purchaseStrategyMode;
 const legacyWeight=(x,p)=>{let wins=0,losses=0;for(const t of x.steps||[]){if(t.c==='W')wins++;else losses++}return Math.pow(p,wins)*Math.pow(1-p,losses)};
 const weighted=(paths,p,select,wr,offset=0)=>paths.reduce((sum,x)=>sum+(compareMode==='strategy'?pathWeight(x,p,wr,offset):legacyWeight(x,p))*select(x),0);
 const stageStats=(paths,p,stage,wr,offset=0)=>{let entries=0,trades=0,wins=0,losses=0,passed=0,passLosses=0;
  for(const x of paths){const w=compareMode==='strategy'?pathWeight(x,p,wr,offset):legacyWeight(x,p),steps=(x.steps||[]).filter(t=>t.stage===stage||t.checkpointStage===stage);
   if(!steps.length)continue;
   entries+=w;trades+=w*steps.length;wins+=w*steps.filter(t=>t.c==='W').length;losses+=w*steps.filter(t=>t.c==='L').length;
   if(steps.some(t=>t.passed)){passed+=w;passLosses+=w*steps.filter(t=>t.c==='L').length}
  }
  return {trades:entries?trades/entries:NaN,wins:entries?wins/entries:NaN,losses:passed?passLosses/passed:NaN,total:trades};
 };
 const headings=compareMode==='wr'?wrAllColumns:['Scenario',...wrAllColumns.slice(1)];
 const comparisonNote=compareMode==='strategy'?'Auto uses Sections 1–2 without overrides. Manual uses Risk, RR and WR overrides only for phases switched to Manual; Auto phases keep baseline settings.':compareMode==='firm'?'Firm comparison uses each firm’s saved evaluation and funded settings where available, with defaults for missing values. Results are modeled estimates, not verified firm rules.':compareMode==='p3target'?'P3 target comparison changes the Funded target ($) from Section 02 only. Evaluation day targets stay unchanged; funded paths and payout cash are recalculated for each value.':compareMode==='pnl'?'Reverse net-profit planning: P&L = gross payout cash minus expected evaluation and activation fees. The calculator increases expected payouts to reach the net-profit goal; if expected net per payout is nonpositive, the goal is infeasible under these assumptions.':compareMode==='target'?'Reverse cash-goal planning: each scenario is a TOTAL cash payout goal. Funded trading target and split remain unchanged. P4 is the expected number of payouts needed (rounded up); P1–P3 are expected required accounts, not guaranteed results.':compareMode==='purchase'?'Purchase strategy may back-solve evaluation purchases to meet the payout goal; P4 is an expected count.':'Expected counts from modeled probabilities; they are not guaranteed outcomes.';
 const rows=rates.map(rate=>{
  const val=Number(rate),params={...v,manualRisks:Array.isArray(v.manualRisks)?[...v.manualRisks]:v.manualRisks,manualRRs:Array.isArray(v.manualRRs)?[...v.manualRRs]:v.manualRRs};
  const fundParams={...fv,manualRisks:Array.isArray(fv.manualRisks)?[...fv.manualRisks]:fv.manualRisks,manualRRs:Array.isArray(fv.manualRRs)?[...fv.manualRRs]:fv.manualRRs};
  let p=compareMode==='wr'?val/100:v.winRate/100,comparisonAccounts=accountMode?val:numAccounts,scenarioMode=mode,scenarioTarget=fv.target,capacityOverride=null;
  let scenarioFirm=firmForPhases,valid=true;
  let attemptWR=null;
  if(compareMode==='strategy'){
   if(!['auto','manual'].includes(rate))valid=false;
   // Auto is the unmodified Sections 1-2 baseline. Manual honors each phase's Mode.
   if(rate==='auto'){
    params.manualRisks={};params.manualRRs={};fundParams.manualRisks={};fundParams.manualRRs={};
   }else{
    let storedWR={};
    try{storedWR=JSON.parse(localStorage.getItem('jj-risk-attempt-winrates-v1')||'{}')}catch(e){}
    attemptWR={};
    for(let phase=1;phase<=3;phase++){
     const manual=box.querySelector('[data-manual-mode="'+phase+'"]')?.value==='manual';
     if(!manual){
      if(phase<=2){
       if(params.manualRisks)delete params.manualRisks[phase];
       if(params.manualRRs)delete params.manualRRs[phase];
      }else{
       if(fundParams.manualRisks)delete fundParams.manualRisks[phase];
       if(fundParams.manualRRs)delete fundParams.manualRRs[phase];
      }
      continue;
     }
     for(let step=1;step<=4;step++){
      const key=phase+'-'+step;
      if(Object.prototype.hasOwnProperty.call(storedWR,key))attemptWR[key]=storedWR[key];
     }
    }
   }
  }
  if(compareMode==='risk'){if(!(val>0&&val<=5))valid=false;else{if(params.manualRisks)params.manualRisks=params.manualRisks.map(x=>Number(x)*val);if(fundParams.manualRisks)fundParams.manualRisks=fundParams.manualRisks.map(x=>Number(x)*val);if(Number.isFinite(params.fixedRisk))params.fixedRisk*=val;if(Number.isFinite(fundParams.fixedRisk))fundParams.fixedRisk*=val}}
  if(compareMode==='rr'||compareMode==='matrix'){const pair=compareMode==='matrix'?String(rate).toLowerCase().split('x').map(Number):[p*100,val];if(pair.length!==2||!(pair[0]>=0&&pair[0]<=100&&pair[1]>0&&pair[1]<=20))valid=false;else{p=pair[0]/100;params.rr=pair[1];fundParams.rr=pair[1];if(Array.isArray(params.manualRRs))params.manualRRs=params.manualRRs.map(()=>pair[1]);if(Array.isArray(fundParams.manualRRs))fundParams.manualRRs=fundParams.manualRRs.map(()=>pair[1])}}
  if(compareMode==='purchase'){if(!['fixed','target','payout','reach-payout'].includes(rate))valid=false;else scenarioMode=rate}
  if(compareMode==='capacity'){if(!Number.isInteger(val)||val<1||val>100)valid=false;else capacityOverride=val}
  if(compareMode==='target'||compareMode==='pnl'){if(!(val>0&&val<=1000000))valid=false;else scenarioMode=compareMode==='pnl'?'net-goal':'cash-goal'}
  if(compareMode==='p3target'){
   if(!(val>0&&val<=100000))valid=false;
   else {scenarioTarget=val;fundParams.target=val}
  }
  if(compareMode==='firm'){
   if(!['topstep','ftmo'].includes(rate))valid=false;
   else {
    scenarioFirm=rate;
    const profile=readProfiles()[rate]||firmDefaults(rate);
    const defaults=firmDefaults(rate);
    const fields={...defaults.fields,...(profile.fields||{})};
    const funding={...defaults.funded,...(profile.funded||{})};
    const setNumber=(obj,key,value)=>{if(value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value)))obj[key]=Number(value)};
    for(const key of ['target','target2','limit','dailyLimit','tradesPerDay','rr','floor','winRate','accountCost','depth'])setNumber(params,key,fields[key]);
    params.targetMode=rate==='topstep'?1:2;
    params.topstepConsistency=rate==='topstep';
    if(rate==='topstep')params.topstepOptionalDailyCap=false;
    else {delete params.topstepConsistency;delete params.fixedRisk}
    for(const key of ['target','limit','dailyLimit','tradesPerDay','rr','floor','winRate','depth'])setNumber(fundParams,key,funding[key]);
    if(rate==='topstep')delete fundParams.ftmoFundedBuilder;
    else delete fundParams.fixedRisk;
    p=Math.max(0,Math.min(1,params.winRate/100));
    scenarioTarget=fundParams.target;
    comparisonAccounts=Math.max(1,Number(profile.accountCount)||Number(defaults.accountCount)||numAccounts);
    scenarioMode=['fixed','target','payout'].includes(profile.purchaseStrategy)?profile.purchaseStrategy:'fixed';
   }
  }
  if(compareMode==='custom')valid=false;
  if(!valid)return '';
  const evalPaths=['risk','rr','matrix','firm','strategy'].includes(compareMode)?enumerate(params,false,scenarioFirm):leaves;
  const fundPaths=['risk','rr','matrix','target','p3target','firm','strategy'].includes(compareMode)?((phaseMode==='evaluation'&&compareMode!=='firm')?[]:enumerate(fundParams,true,scenarioFirm)):fundedLeaves;
  const evalPass=weighted(evalPaths,p,x=>x.status==='target'?1:0,attemptWR);
  const p1=weighted(evalPaths,p,x=>x.steps.some(t=>t.checkpointStage===1&&t.passed||t.stage===1&&t.passed)?1:0,attemptWR);
  const p2=p1>0?evalPass/p1:0;
  const fundPass=phaseMode==='evaluation'&&compareMode!=='firm'?0:weighted(fundPaths,p,x=>x.status==='target'?1:0,attemptWR,2);
  const scenarioFee=compareMode==='firm'?Math.max(0,params.accountCost):fee;
  const scenarioActivation=compareMode==='firm'?Math.max(0,Number((readProfiles()[scenarioFirm]||{}).funded?.activation??(scenarioFirm==='topstep'?150:0))):activation;
  const scenarioSplit=compareMode==='firm'?Math.max(0,Math.min(1,Number((readProfiles()[scenarioFirm]||firmDefaults(scenarioFirm)).funded?.split??(scenarioFirm==='topstep'?75:80))/100)):split;
  const grossPerPayout=scenarioTarget*scenarioSplit;
  const expectedCostPerPayout=evalPass>0&&fundPass>0?scenarioFee/(evalPass*fundPass)+scenarioActivation/fundPass:NaN;
  const netPerPayout=grossPerPayout-expectedCostPerPayout;
  const requiredPayouts=scenarioMode==='cash-goal'?(grossPerPayout>0?Math.ceil(val/grossPerPayout):NaN):scenarioMode==='net-goal'?(netPerPayout>0?Math.ceil(val/netPerPayout):NaN):targetPayout;
  const funded=scenarioMode==='fixed'?comparisonAccounts*evalPass:scenarioMode==='target'?targetFunded:fundPass>0?requiredPayouts/fundPass:NaN;
  const buys=scenarioMode==='fixed'?comparisonAccounts:evalPass>0?funded/evalPass:NaN;
  const firstPass=buys*p1,payouts=funded*fundPass;
  const evalFailure=weighted(evalPaths,p,x=>x.status==='closed'?1:0,attemptWR),fundFailure=weighted(fundPaths,p,x=>x.status==='closed'?1:0,attemptWR,2);
  const spent=buys*scenarioFee+funded*scenarioActivation,gross=payouts*grossPerPayout,net=gross-spent,roi=spent>0?100*net/spent:NaN;
  const st1=stageStats(evalPaths,p,1,attemptWR),st2=stageStats(evalPaths,p,2,attemptWR),st3=stageStats(fundPaths,p,1,attemptWR,2);
  const fundedAvg=stageStats(fundPaths,p,3,attemptWR,2);
  const fstats=fundedAvg.total>0?fundedAvg:st3;
  const totalExpectedTrades=buys*(st1.total+st2.total)+funded*fstats.total;
  const costFunded=funded>0?spent/funded:NaN;
  const perEvalPayout=Math.max(0,Math.min(1,evalPass*fundPass));
  const onePayoutChance=Number.isFinite(buys)?1-Math.pow(1-perEvalPayout,Math.max(0,Math.floor(buys))):NaN;
  const tradingCapacity=Math.max(1,capacityOverride||Number(box.querySelector('[data-signals-per-day]')?.value)||Number(box.querySelector('[data-trades-per-day]')?.value)||fv.tradesPerDay||1);
  const daysPerPayout=payouts>0?totalExpectedTrades/payouts/tradingCapacity:NaN;
  const evals95=perEvalPayout>0?Math.ceil(Math.log(.05)/Math.log1p(-perEvalPayout)):NaN;
  const spend95=perEvalPayout>=1?scenarioFee+scenarioActivation:Number.isFinite(evals95)?evals95*scenarioFee+(evals95*evalPass*scenarioActivation):NaN;
  const stageRows=[
   {name:'P1 · Evaluations purchased',count:buys,pass:NaN,total:1,avg:null,trades:0,paths:'—',cost:buys*scenarioFee,costResult:scenarioFee},
   {name:firmForPhases==='ftmo'?'P2 · Challenge passed':'P2 · First day passed',count:firstPass,pass:p1,total:p1,avg:st1,trades:buys*st1.total,paths:firmForPhases==='topstep'?'W · LW · LLW':'—',cost:0,costResult:firstPass>0?buys*scenarioFee/firstPass:NaN},
   {name:firmForPhases==='ftmo'?'P3 · Verification passed / funded':'P3 · Second day passed / funded',count:funded,pass:p2,total:evalPass,avg:st2,trades:buys*st2.total,paths:firmForPhases==='topstep'?'W · LW · LLW':'—',cost:funded*scenarioActivation,costResult:funded>0?spent/funded:NaN},
   {name:'P4 · Funded payout target reached',count:payouts,pass:fundPass,total:evalPass*fundPass,avg:fstats,trades:funded*fstats.total,paths:firmForPhases==='topstep'?'W · LW · LLW':'—',cost:0,costResult:payouts>0?spent/payouts:NaN}
  ];
  return stageRows.map((x,i)=>{const cells=[i===0?(compareMode==='wr'?fmt(val)+'%':String(rate)):'',x.name,fmt(x.count),Number.isFinite(x.pass)?fmt(100*x.pass)+'%':'—',fmt(100*x.total)+'%',x.avg?fmt(x.avg.trades):'—',x.avg?fmt(x.avg.wins):'—',x.avg?fmt(x.avg.losses):'—',fmt(x.trades),i>0&&x.count>0?fmt(x.trades/x.count):'—',x.paths,money(x.cost),money(x.costResult),i===3?money(gross):'—',i===3?money(net):'—',i===3?fmt(roi)+'%':'—',i===3?fmt(buys):'—',i===3?fmt(funded):'—',i===3?fmt(payouts):'—',i===3?money(buys*scenarioFee):'—',i===3?money(funded*scenarioActivation):'—',i===3?money(spent):'—',i===3?money(grossPerPayout):'—',i===3&&payouts>0?money(spent/payouts):'—',i===3?fmt(evalPass*fundPass*100)+'%':'—',i===3?fmt(evalFailure*100)+'%':'—',i===3?fmt(fundFailure*100)+'%':'—',i===3?fmt(Math.max(0,100*(1-fundPass-fundFailure)))+'%':'—',i===3?money(costFunded):'—',i===3&&firstPass>0?money(buys*fee/firstPass):'—',i===3&&funded>0?money(buys*scenarioFee/funded):'—',i===3?fmt(totalExpectedTrades):'—',i===3&&payouts>0?fmt(totalExpectedTrades/payouts):'—',i===3&&buys>0?money(net/buys):'—',i===3&&spent>0?fmt(gross/spent)+'×':'—',i===3?fmt(onePayoutChance*100)+'%':'—',i===3?fmt(daysPerPayout):'—',i===3?money(spend95):'—',i===3?fmt(100*perEvalPayout):'—',i===3&&totalExpectedTrades>0?money(net/totalExpectedTrades):'—'];
   return '<tr'+(i===0?' style="border-top:2px solid #8887"':'')+'>'+cells.map((cell,j)=>'<td style="padding:6px 5px;text-align:'+(j===1||j===10?'left':'right')+';white-space:nowrap;'+'">'+cell+'</td>').join('')+'</tr>';
  }).join('');
 }).join('');
 if(compareMode==='custom'){host.textContent='Saved scenario comparison requires complete scenario settings and is not available yet.';return}
 // Invariant: every comparison row must have exactly one cell per KPI heading.
 const expectedColumns=headings.length;
 if(expectedColumns!==wrAllColumns.length){host.textContent='Comparison column configuration error.';return}
 host.innerHTML='<table style="width:100%;border-collapse:collapse;white-space:nowrap;font-size:11px"><thead><tr>'+headings.map(h=>'<th style="padding:7px 5px;border-bottom:1px solid #8885;text-align:right">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table>';
 applyWrColumnFilter();
 const note=document.createElement('div');note.style.cssText='font-size:11px;opacity:.8;margin-top:6px';note.textContent=comparisonNote;host.append(note);

})();
const fundedSimulationPass=fp;const tradeWin=Math.max(0,Math.min(1,v.winRate/100));const tradeLoss=1-tradeWin;const fundedCycleTarget=tradeWin+tradeLoss*tradeWin;const fundedCycleReset=tradeLoss*tradeLoss*tradeWin;const fundedThreeAttemptPass=fundedCycleTarget/(1-fundedCycleReset);/* Use the enumerated funded engine success probability; do not overwrite it with a different LLW reset formula. The latter is a separate theoretical unlimited-horizon benchmark. */
const p1Shared=firmForPhases==='topstep'?Math.max(0,Math.min(1,checkpointProbability)):Math.max(0,Math.min(1,t1Probability));
const p2Shared=p1Shared>0?Math.max(0,Math.min(1,actualEvaluationProbability/p1Shared)):0;
window.__jj14StageData={firm:firmForPhases,p1:p1Shared,p2:p2Shared,p3:Math.max(0,Math.min(1,fp)),evalWin:v.winRate,fundedWin:fv.winRate,accountFee:v.accountCost,activationFee:fn('activation',0),walletCash:fv.target*Math.max(0,Math.min(1,fn('split',80)/100)),accountCount:Number(box.querySelector('[data-account-count]')?.value)||10,depth:fv.depth};
if(typeof window.__jj14Update==='function')window.__jj14Update();
const cash=x=>'$'+x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
/* Statistics are calculated from terminal/censored path probabilities, not
   actual trade history. Do not confuse an observed maximum in enumerated paths
   with a guaranteed future maximum. */
const streakSummary=items=>{
 const hist={W:{},L:{}};
 let meanTrades=0,meanWins=0,meanLosses=0,meanMaxW=0,meanMaxL=0,meanCompleted=0,meanPnl=0;
 let maxObservedW=0,maxObservedL=0;
 let totalMass=0;
 for(const x of items){
  const prob=x.prob||0;
  totalMass+=prob;
  let wins=0,losses=0,last='',run=0,maxW=0,maxL=0;
  for(const step of x.steps){
   const c=step.c;
   if(c==='W')wins++;else losses++;
   run=c===last?run+1:1;
   last=c;
   if(c==='W')maxW=Math.max(maxW,run);else maxL=Math.max(maxL,run);
  }
  maxObservedW=Math.max(maxObservedW,maxW);maxObservedL=Math.max(maxObservedL,maxL);
  hist.W[maxW]=(hist.W[maxW]||0)+prob;
  hist.L[maxL]=(hist.L[maxL]||0)+prob;
  meanTrades+=prob*x.steps.length;
  meanWins+=prob*wins;
  meanLosses+=prob*losses;
  meanMaxW+=prob*maxW;
  meanMaxL+=prob*maxL;
  meanPnl+=prob*x.pnl;
  if(x.status==='target')meanCompleted+=prob;
 }
 const atLeast=(type,k)=>Object.entries(hist[type]).reduce((sum,[len,p])=>sum+(Number(len)>=k?p:0),0);
 return {totalMass,meanTrades,meanWins,meanLosses,meanMaxW,meanMaxL,maxObservedW,maxObservedL,meanPnl,atLeast};
};
const selectedStatsFund=tradeStatsScope.value==='funded';
const statsPaths=selectedStatsFund?fundedLeaves:leaves;
const stats=streakSummary(statsPaths);
const statPct=x=>(100*x).toFixed(1)+'%';
const statCard=(name,value,help)=>kpiTooltip(name,value,help);
const streakMax=Math.min(8,selectedStatsFund?fv.depth:v.depth);
const streakRows=Array.from({length:streakMax},(_,i)=>{
 const n=i+1;
 return '<tr><td style="text-align:left">'+n+'+ consecutive</td>'+
 '<td style="text-align:right;font-variant-numeric:tabular-nums">'+statPct(stats.atLeast('L',n))+'</td>'+
 '<td style="text-align:right;font-variant-numeric:tabular-nums">'+statPct(stats.atLeast('W',n))+'</td></tr>';
}).join('');
tradeStatsPanel.querySelector('[data-trade-stats-content]').innerHTML=
 statsPaths.length?'<div class="jj-risk-results-grid">'+
 statCard('Avg trades / account',stats.meanTrades.toFixed(2),'Probability-weighted number of trades executed before target, closure or simulation-depth cutoff.')+
 statCard('Avg wins / account',stats.meanWins.toFixed(2),'Expected winning trades executed per evaluation or funded attempt.')+
 statCard('Avg losses / account',stats.meanLosses.toFixed(2),'Expected losing trades executed per attempt.')+
 statCard('Avg max loss streak',stats.meanMaxL.toFixed(2),'Probability-weighted longest consecutive losing streak in a single attempt.')+
 statCard('Avg max win streak',stats.meanMaxW.toFixed(2),'Probability-weighted longest consecutive winning streak in a single attempt.')+
 statCard('Longest modeled losses',String(stats.maxObservedL),'Largest losing streak among enumerated paths at this maximum trade depth, NOT a live or guaranteed maximum.')+
 statCard('Longest modeled wins',String(stats.maxObservedW),'Largest winning streak among enumerated paths at this maximum trade depth, NOT a live or guaranteed maximum.')+
 statCard('Expected P&L / attempt',cash(stats.meanPnl),'Probability-weighted trading P&L per attempt before fees and profit split; unresolved scenarios are included.')+
 '</div><div style="overflow-x:auto;margin-top:8px"><table style="width:100%;font-size:11px"><thead><tr>'+
 '<th style="text-align:left" title="Probability at least this many trades occur consecutively within an account attempt">Streak</th>'+
 '<th style="text-align:right" title="Probability that an account experiences at least N consecutive losing trades before termination or depth cutoff">Loss ≥ N</th>'+
 '<th style="text-align:right" title="Probability that an account experiences at least N consecutive winning trades before termination or depth cutoff">Win ≥ N</th>'+
 '</tr></thead><tbody>'+streakRows+'</tbody></table></div>'+
 '<p style="font-size:11px;opacity:.75;margin-top:7px">Based on '+statsPaths.length+' enumerated terminal or unfinished paths, weighted by their probabilities (total '+statPct(stats.totalMass)+'). Stops at account target, breach, or trade-depth limit. This is a theoretical model, not historical executed trades. Longer real streaks remain possible, and shared signals may correlate accounts.</p>':
 '<p style="font-size:11px;opacity:.75">No funded paths are currently calculated. Select Combined or Funded mode to see funded streak statistics.</p>';
if(compareSection.open){const sim=cfg=>{let hit=0,fail=0,ev=0;function go(p){const x=calc(p,cfg);if(scenarioFinished(x,cfg,p)){if(x.status==='target')hit+=x.prob;if(x.status==='closed')fail+=x.prob;ev+=x.prob*x.pnl;return}go(p+'W');go(p+'L')}go('');return [hit*100,fail*100,ev]};const phases=firmForPhases==='ftmo'?[[1,v.target],[2,v.target2],[3,fv.target]]:[[1,v.target],[3,fv.target]];let rows='';for(const item of phases){const phase=item[0],target=item[1],base=phase===3?fv:v;const common=Object.assign({},base,{targetMode:1,target:target,manualStage:phase,topstepConsistency:phase===1&&firmForPhases==='topstep'});const auto=sim(Object.assign({},common,{manualRisks:{},manualRRs:{}}));const manual=sim(Object.assign({},common,{manualRisks:manualConfig(),manualRRs:manualRRConfig()}));let phaseRows='';for(let i=0;i<3;i++){const diff=manual[i]-auto[i];phaseRows+='<tr><td>'+['Target %','Failure %','EV'][i]+'</td><td>'+manual[i].toFixed(2)+'</td><td>'+auto[i].toFixed(2)+'</td><td class="'+((i===1?diff<0:diff>0)?'jj-risk-win':(i===1?diff>0:diff<0)?'jj-risk-loss':'')+'">'+diff.toFixed(2)+'</td></tr>';;}rows+='<details style="margin:6px 0;padding:8px;border:1px solid #8884;border-radius:7px"><summary style="cursor:pointer;font-weight:700">P'+phase+' · Target '+manual[0].toFixed(1)+'% / '+auto[0].toFixed(1)+'%</summary><div style="overflow-x:auto"><table style="font-size:11px;white-space:nowrap"><thead><tr><th>Metric</th><th>Manual</th><th>Auto</th><th>Δ</th></tr></thead><tbody>'+phaseRows+'</tbody></table></div></details>'; }comparePanel.querySelector('[data-compare]').innerHTML='<div style="font-size:11px;opacity:.7">Green = better · Red = worse · Δ = Manual − Auto</div>'+rows;}
const nn=Math.max(1,Math.min(100,Math.floor(Number($('[data-account-count]').value)||10)));
const totalFees=nn*v.accountCost,expectedFunded=nn*probability,activationFee=Math.max(0,fn('activation',0)),splitPct=Math.max(0,Math.min(1,fn('split',80)/100));
const grossPayout=expectedFunded*fp*fv.target*splitPct,activationFees=expectedFunded*activationFee,netCash=grossPayout-totalFees-activationFees;

let mathPanel=box.querySelector('[data-ch09-math]');
if(!mathPanel){
 mathPanel=document.createElement('div');
 mathPanel.dataset.ch09Math='';
 mathPanel.innerHTML='<div data-math-cards class="jj-risk-results-grid"></div><small style="opacity:.75">Calculated from Chapter 09 settings. Probabilities use finite simulation depth; historical confidence intervals require observed trade/account records.</small>';
 (box.querySelector('[data-section="trade-statistics"]')||box.querySelector('[data-section="funded-paths"]')||box.lastElementChild).after(mathPanel);
 group('math-bankroll','13 · Math & Bankroll KPIs',[mathPanel]);
 const fourteen=box.querySelector('[data-section="financial-formulas"]');const thirteen=box.querySelector('[data-section="math-bankroll"]');if(fourteen&&thirteen)thirteen.after(fourteen);
}
const fmtMathPct=x=>Number.isFinite(x)?(100*x).toFixed(2)+'%':'—';
const evalP=Math.max(0,Math.min(1,v.winRate/100)),fundP=Math.max(0,Math.min(1,fv.winRate/100));
const evalEV=evalP*v.rr-(1-evalP),fundEV=fundP*fv.rr-(1-fundP);
const evalVariance=evalP*(v.rr-evalEV)**2+(1-evalP)*(-1-evalEV)**2;
const successChance=probability*fp;
const mathRows=[
['Evaluation EV',evalEV.toFixed(3)+'R','Expected evaluation trade return in risk units.'],
['Funded EV',fundEV.toFixed(3)+'R','Expected funded trade return in risk units.'],
['Variance',evalVariance.toFixed(3)+' R²','Dispersion of evaluation trade returns.'],
['Std deviation',Math.sqrt(evalVariance).toFixed(3)+'R','Square root of evaluation variance.'],
['Breakeven WR',fmtMathPct(1/(1+v.rr)),'Win rate needed for zero expectancy.'],
['Evaluation pass',fmtMathPct(probability),'Probability of passing evaluation within trade depth.'],
['Evaluation ruin',fmtMathPct(failProbability),'Probability of hitting evaluation loss limit within trade depth.'],
['Funded pass',fmtMathPct(fp),'Probability of reaching funded target within trade depth.'],
['Funded ruin',fmtMathPct(fr),'Probability of hitting funded loss limit within trade depth.'],
['Cost / passed eval',probability?cash(v.accountCost/probability):'—','Expected evaluation fees per passed evaluation; excludes verification.'],
['Cost / funded success',successChance?cash((v.accountCost+probability*activationFee)/successChance):'—','Expected fees per modeled funded success; assumes independent phases.'],
['No payout',fmtMathPct(Math.pow(1-successChance,nn)),'Chance of zero modeled successes across purchases, assuming independence.'],
['Buys for 90%',successChance>=1?'1':successChance>0?String(Math.ceil(Math.log(.1)/Math.log(1-successChance))):'—','Purchases for 90% probability of one modeled success.'],
['Expected fees',cash(totalFees+activationFees),'Purchase fees plus expected activation fees.'],
['Expected payout',cash(grossPayout),'Probability-weighted funded target payout proxy.'],
['Expected net',cash(netCash),'Expected payout less fees.'],
['Expected net ROI',totalFees+activationFees>0?fmtMathPct(netCash/(totalFees+activationFees)):'—','Net divided by modeled spending, not reserved budget.']
];
mathPanel.querySelector('[data-math-cards]').innerHTML=mathRows.map(row=>kpiTooltip(row[0],row[1],row[2])).join('');

box.querySelectorAll('[data-phase]').forEach(btn=>{const on=btn.dataset.phase===phaseMode;btn.setAttribute('aria-pressed',String(on));btn.style.fontWeight=on?'700':'400';btn.style.background=on?'var(--accent-soft,rgba(85,137,201,.15))':''});
$('[data-funded-fields]').style.display=phaseMode==='evaluation'?'none':'';
$('[data-funded-results]').style.display=phaseMode==='evaluation'?'none':'';

box.querySelector('[data-section="combined-results"]').style.display=phaseMode==='combined'?'':'none';box.querySelector('[data-section="funded-settings"]').style.display=phaseMode==='evaluation'?'none':'';box.querySelector('[data-section="funded-results"]').style.display=phaseMode==='evaluation'?'none':'';box.querySelector('[data-section="challenge-results"]').style.display=phaseMode==='funded'?'none':'';box.querySelector('[data-section="paths"]').style.display=phaseMode==='funded'?'none':'';box.querySelector('[data-section="funded-paths"]').style.display=phaseMode==='evaluation'?'none':'';

const firmType=firmBar.querySelector('[data-firm-type]').value;firmBar.querySelector('[data-firm-rule]').textContent=firmType==='ftmo'?'Shared active cap: challenges + funded':'Funded cap only; replace evaluations until funded target';firmBar.querySelector('[data-firm-rule]').title='Firm defaults are applied to new profiles only. Your saved values are preserved.';
const phaseModeInput=$('[data-target-mode]');const expectedPhaseMode=firmType==='ftmo'?'2':'1';if(phaseModeInput.value!==expectedPhaseMode)phaseModeInput.value=expectedPhaseMode;phaseOne.innerHTML=firmType==='ftmo'?'<strong>P1 · Challenge</strong><div style="opacity:.75;margin-top:3px">Profit target, risk and loss limits are editable below.</div>':'<strong>P1 · First profit-day checkpoint</strong><div style="opacity:.75;margin-top:3px">Modeled first completed profitable day of at least half the evaluation target. This is a strategy checkpoint, not an additional Topstep rule.</div>';phaseTwo.style.display='';phaseTwo.innerHTML=firmType==='ftmo'?'<strong>P2 · Verification</strong><div style="opacity:.75;margin-top:3px">Separate verification stage; drawdown allowance resets in the model.</div>':'<strong>P2 · Consistency '+(Number(box.querySelector('[data-consistency-limit]')?.value)||55)+'% (analytical checkpoint)</strong><div style="opacity:.75;margin-top:3px">After a completed profitable day of at least half the target, continue in the SAME Trading Combine. No new fee, no drawdown reset. Excess best-day profit raises the required total target.</div>';const target1Label=box.querySelector('[data-target1-field]');if(target1Label)target1Label.firstChild.textContent=firmType==='ftmo'?'P1 · Challenge target ($)':'P1 · Evaluation target ($)';const target2Label=box.querySelector('[data-target2-field]');if(target2Label){target2Label.firstChild.textContent='P2 · Verification target ($)';target2Label.style.display=firmType==='ftmo'?'':'none'};const fundedSummary=box.querySelector('[data-section="funded-settings"] summary');if(fundedSummary&&fundedSummary.lastChild.nodeType===3)fundedSummary.lastChild.textContent='02 · P3 Funded · Parameters';
const allocationPanel=box.querySelector('[data-allocation-preview]');if(allocationPanel)allocationPanel.style.display=phaseMode==='combined'?'':'none';const stagesPanel=box.querySelector('[data-section="stages-preview"]');if(stagesPanel)stagesPanel.style.display='';
const funnelSection=box.querySelector('[data-section="funnel"]');
funnelSection.style.display=phaseMode==='combined'?'':'none';
const stageRow=(label,count,pct,amount,fill)=>'<div class="jj-funnel-row"><div class="jj-funnel-top"><strong>'+label+'</strong><span>'+count+' · '+pct+'</span></div><div class="jj-funnel-track"><span style="width:'+Math.max(0,Math.min(100,fill)).toFixed(2)+'%"></span></div><div class="jj-funnel-money">'+amount+'</div></div>';
const pEval=probability,pFund=fp,pBoth=pEval*pFund;
const successCount=nn*pBoth;
const avgOnPass=(items,p)=>{if(p<=0)return null;const passed=items.filter(x=>x.status==='target');return {trades:passed.reduce((a,x)=>a+x.prob*x.steps.length,0)/p,days:passed.reduce((a,x)=>a+x.prob*(x.steps.length?x.steps[x.steps.length-1].day:0),0)/p}};
const challengeTiming=avgOnPass(leaves,pEval),fundedTiming=avgOnPass(fundedLeaves,pFund);
const timeText=x=>x?x.trades.toFixed(1)+' avg trades · '+x.days.toFixed(1)+' trading days':'—';
const combinedTiming=challengeTiming&&fundedTiming?{trades:challengeTiming.trades+fundedTiming.trades,days:challengeTiming.days+fundedTiming.days}:null;
const avgAll=items=>({trades:items.reduce((a,x)=>a+x.prob*x.steps.length,0),days:items.reduce((a,x)=>a+x.prob*(x.steps.length?x.steps[x.steps.length-1].day:0),0)});
const allChallenge=avgAll(leaves),allFunded=avgAll(fundedLeaves);
const portfolioChallengeTrades=nn*allChallenge.trades,portfolioChallengeDays=nn*allChallenge.days;
const portfolioFundedTrades=expectedFunded*allFunded.trades,portfolioFundedDays=expectedFunded*allFunded.days;
const portfolioTrades=portfolioChallengeTrades+portfolioFundedTrades,portfolioDays=portfolioChallengeDays+portfolioFundedDays;
const parallelCount=Math.max(1,Math.min(nn,Math.floor(Number(parallelInput.value)||1)));parallelInput.value=String(parallelCount);
const signalsPerDay=Math.max(1,Math.min(100,Math.floor(Number(signalsInput.value)||1)));signalsInput.value=String(signalsPerDay);
const capacityDays=Math.max(Math.ceil(portfolioDays/parallelCount),Math.ceil(portfolioTrades/signalsPerDay));
const fundedGoal=Math.max(1,Math.min(firmType==='topstep'?5:100,Math.floor(fundedTargets[firmType]||1)));
const payoutMode=purchaseStrategyMode==='payout'||purchaseStrategyMode==='reach-payout';
const payoutGoal=Math.max(1,Math.min(firmType==='topstep'?5:100,Math.floor(payoutTargets[firmType]||5)));
payoutCountInput.max=firmType==='topstep'?'5':'100';
fundedCountInput.max=firmType==='topstep'?'5':'100';
if(document.activeElement!==fundedCountInput)fundedCountInput.value=String(fundedGoal);
if(document.activeElement!==payoutCountInput)payoutCountInput.value=String(payoutGoal);
purchaseCountControls.querySelector('[data-funded-count-wrap]').style.display=purchaseStrategyMode==='target'?'':'none';
purchaseCountControls.querySelector('[data-fixed-count-wrap]').style.display=purchaseStrategyMode==='fixed'?'':'none';
payoutCountWrap.style.display=payoutMode?'':'none';
const replacementMode=purchaseStrategyMode!=='fixed';
const allocationTarget=payoutMode?(fp>0?payoutGoal/fp:0):fundedGoal;
strategySelect.value=purchaseStrategyMode;
purchaseStrategy.querySelector('[data-purchase-strategy-help]').textContent=purchaseStrategyMode==='reach-payout'?
 'Stop projected purchases when '+payoutGoal+' expected payout successes are reached, regardless of the funded-account target. Replace failed evaluations and funded accounts; active account caps still apply. Expected funded attempts: '+(fp>0?(payoutGoal/fp).toFixed(2):'unreachable')+'.':payoutMode?
 'Target '+payoutGoal+' projected payout successes; replace failed evaluations AND failed funded accounts. Expected funded attempts: '+(fp>0?(payoutGoal/fp).toFixed(2):'unreachable')+'. Max five Topstep funded accounts active simultaneously; timing is not modeled.':
 replacementMode?'Obtain '+fundedGoal+' funded account'+(fundedGoal===1?'':'s')+' (up to five active Topstep accounts). Payouts are NOT guaranteed in this mode. Select Maximum Funded Limit Payout to replace funded failures.':
 'Purchase '+nn+' evaluations only; no replacements';
const allocationCap=firmType==='ftmo'?nn:Infinity;
const evalPass=probability;
const replacementPurchases=evalPass>0&&(!payoutMode||fp>0)?allocationTarget/evalPass:null;
// Finite-horizon forecast assumes every unresolved evaluation is eventually
// resolved or replaced. It is not a count of confirmed account failures.
const replacementFailures=replacementPurchases===null?null:replacementPurchases-allocationTarget;
const replacementEvalFees=replacementPurchases===null?null:replacementPurchases*v.accountCost;
const replacementActivationFees=allocationTarget*activationFee;
const replacementExpectedPayout=allocationTarget*fp*fv.target*splitPct;
const replacementTotalFees=replacementEvalFees===null?null:replacementEvalFees+replacementActivationFees;
const replacementNet=replacementTotalFees===null?null:replacementExpectedPayout-replacementTotalFees;
const modelBuys=replacementMode?replacementPurchases:nn;const modelPassed=replacementMode?(replacementPurchases===null?0:allocationTarget):expectedFunded;const modelFailed=modelBuys===null?null:modelBuys*failProbability;
const modelUnresolved=modelBuys===null?null:modelBuys*unresolvedProbability;const modelFees=modelBuys===null?null:modelBuys*v.accountCost+modelPassed*activationFee;const modelPayout=modelPassed*fp*fv.target*splitPct;const modelNet=modelFees===null?null:modelPayout-modelFees;const modelRoi=modelFees>0?100*modelNet/modelFees:null;const modelSuccess=modelBuys===null?0:modelPassed*fp;const modelPct=modelBuys>0?100*modelPassed/modelBuys:0;const modelCash=x=>x===null?'—':cash(x);const modelPossible=modelBuys!==null;const resultGroup=(heading,cards)=>'<div style="min-width:0;margin:5px 0 9px"><div style="font-size:11px;font-weight:700;opacity:.8;margin:0 0 5px">'+heading+'</div><div class="jj-risk-results-grid">'+cards+'</div></div>';

// Section 04 must consume the same purchase-strategy cohort as Sections 05/07.
// Never use the raw fixed-purchase input as the number of funded attempts.
const metricFund=(label,value,help)=>kpiTooltip(label,value,help);
const fundedAttempts=modelBuys===null?null:modelPassed;
const fundedSuccesses=modelBuys===null?null:modelSuccess;
const fundedFailures=modelBuys===null?null:Math.max(0,fundedAttempts-fundedSuccesses);
const fundedCards=
 metricFund('Funded pass',(fp*100).toFixed(2)+'%','Probability one funded account reaches its profit target within the selected trading depth.')+
 metricFund('Funded ruin',(fr*100).toFixed(2)+'%','Probability one funded account breaches the modeled loss allowance within the trade depth.')+
 metricFund('Funded unresolved',(Math.max(0,1-fp-fr)*100).toFixed(2)+'%','Probability one funded account remains unresolved within the trade depth.')+
 metricFund('Funded attempts',fundedAttempts===null?'—':fundedAttempts.toFixed(2),'Expected cumulative funded accounts entering P3 under the selected Section 07 purchase strategy; not the number active simultaneously.')+
 metricFund('Expected funded successes',fundedSuccesses===null?'—':fundedSuccesses.toFixed(2),'Expected accounts reaching the funded profit target, consistent with Section 07 P4.')+
 metricFund('Expected funded failures',fundedFailures===null?'—':fundedFailures.toFixed(2),'Expected funded attempts that do not reach the profit target within the modeled trade depth; includes both ruin and unresolved paths.')+
 metricFund('Expected payout / funded',cash(fp*fv.target*splitPct),'Probability-weighted payout projection per funded attempt, before purchase and activation fees.')+
 metricFund('Payout per success',cash(fv.target*splitPct),'Projected cash payout from one funded account that reaches its profit target, after profit split, before fees.');
$('[data-funded-results]').innerHTML='<div class="jj-risk-results-grid">'+fundedCards+'</div>'+
 '<div style="font-size:11px;opacity:.75;margin:5px 0">Using <strong>'+(
  payoutMode?'Maximum Funded Limit Payout':replacementMode?'Reach Funded Limit':'Fixed Purchases'
 )+'</strong>: '+(fundedAttempts===null?'—':fundedAttempts.toFixed(2))+' expected funded attempts × '+(fp*100).toFixed(2)+
 '% funded pass = '+(fundedSuccesses===null?'—':fundedSuccesses.toFixed(2))+
 ' expected successes. Replacement-purchase estimates assume unresolved evaluations eventually resolve or are replaced; they are NOT confirmed failures. Payout eligibility and real cash withdrawal are not separately modeled. Probabilities assume independent trades; paths unresolved at the depth limit are not passes.</div>';

const combinedCards=
resultGroup('01 · Results',
 metricFund('Evaluation pass',(probability*100).toFixed(2)+'%','Probability of passing the evaluation within its modeled trade depth.')+
 metricFund('Funded pass',(fp*100).toFixed(2)+'%','Conditional probability of reaching the funded target within its modeled trade depth.')+
 metricFund('Overall payout chance',(probability*fp*100).toFixed(2)+'%','Single evaluation-to-payout probability; not the whole replacement program.')+
 metricFund('Expected funded',modelPossible?modelPassed.toFixed(2):'—','Expected funded accounts under the selected purchase strategy.')+
 metricFund('Successful payouts',modelPossible?modelSuccess.toFixed(2):'—','Expected first payout successes.'))+
resultGroup('02 · Payouts',
 metricFund('Payout / success',cash(fv.target*splitPct),'First payout after a successful funded target, after the configured split.')+
 metricFund('Expected payout cash',modelPossible?cash(modelPayout):'—','Probability-weighted total first payout cash after the configured split.'))+
resultGroup('03 · Spending',
 metricFund('Evaluation buys',modelPossible?modelBuys.toFixed(2):'—','Expected evaluation purchases, including replacements when enabled.')+
 metricFund('Evaluation fees',modelPossible?cash(modelBuys*v.accountCost):'—','Expected evaluation purchase spending.')+
 metricFund('Total fees',modelCash(modelFees),'Expected evaluation and activation spending; excludes unspent reserved budget.'))+
resultGroup('04 · Profit & ROI',
 metricFund('Expected net profit',modelCash(modelNet),'Expected payout cash minus expected total fees.')+
 metricFund('Net ROI',modelRoi===null?'—':modelRoi.toFixed(1)+'%','Expected net profit divided by expected total fees.'));

const optimizeRiskStrategies=()=>{
 const test=cfg=>{let pass=0,unresolved=0;const walk=p=>{const x=calc(p,cfg);if(scenarioFinished(x,cfg,p)){if(x.status==='target')pass+=x.prob;else if(x.status==='active')unresolved+=x.prob;return}walk(p+'W');walk(p+'L')};walk('');return {pass,unresolved}};
 const consistency=firmType==='topstep'?Math.max(1,Math.min(100,Number(box.querySelector('[data-consistency-limit]')?.value)||55)):undefined;
 const evalBase={...v,topstepConsistency:firmType==='topstep',consistencyRate:consistency,fixedRisk:undefined};
 const fundBase={...fv,topstepConsistency:false,fixedRisk:undefined,ftmoFundedBuilder:undefined};
 const makeCandidates=base=>{
  const max=Math.max(50,base.limit-base.floor),out=[];
  const caps=[.35,.5,.65,.8,1].map(x=>Math.max(50,Math.round(max*x/50)*50));
  for(const cap of [...new Set(caps)]){
   out.push({name:'Fixed $'+cap,rule:{riskModel:'fixed',baseRisk:cap}});
   for(const factor of [.75,1,1.25])for(const reservePart of [0,.15,.3]){
    const reserve=Math.round(base.limit*reservePart/50)*50;
    out.push({name:'Dynamic $'+cap+' cap · '+factor+'× target risk · $'+reserve+' reserve',rule:{riskModel:'adaptive',baseRisk:cap,targetFactor:factor,reserve}});
   }
  }
  return out.map(o=>({...o,...test({...base,...o.rule})})).filter(o=>o.pass>0);
 };
 const evals=makeCandidates(evalBase),funds=makeCandidates(fundBase);
 const results=[];
 for(const e of evals)for(const u of funds){
  const buys=replacementMode?allocationTarget/e.pass:nn;
  const funded=replacementMode?allocationTarget:nn*e.pass;
  const fees=buys*v.accountCost+funded*activationFee;
  const payout=funded*u.pass*fv.target*splitPct;
  const net=payout-fees,roi=fees>0?net/fees*100:null;
  if(Number.isFinite(roi))results.push({e,u,fees,payout,net,roi});
 }
 const eligible=results.filter(x=>x.roi>=200&&x.net>0&&x.e.unresolved<.1&&x.u.unresolved<.1).sort((a,b)=>b.roi-a.roi);
 const money=n=>'$'+n.toLocaleString('en-US',{maximumFractionDigits:0});
 const explain=(base,candidate)=>{
 const cfg={...base,...candidate.rule},paths=['','W','L','LW','LL','WL','LLW','LWL','LLL','WW','LWW'];
 const decisions=paths.map(path=>calc(path,cfg)).filter(x=>x.status==='active'&&x.steps.length<cfg.depth);
 const rows=decisions.map(x=>{
  const win=calc(x.path+'W',cfg),loss=calc(x.path+'L',cfg);
  const risk=win.steps[x.steps.length]?.risk??loss.steps[x.steps.length]?.risk??0;
  const history=x.steps.map((t,i)=>'<tr><td class="'+(t.c==='W'?'jj-risk-win':'jj-risk-loss')+'">'+(i+1)+' '+(t.c==='W'?'WIN':'LOSS')+'</td><td>'+t.day+'</td><td>'+money(t.risk)+'</td><td>'+money(t.stagePnl)+'</td><td>'+(t.passed?'TARGET HIT':'')+'</td></tr>').join('');
  return '<tr><td>'+(x.path||'Start')+'</td><td>'+(x.prob*100).toFixed(2)+'%</td><td>'+money(risk)+'</td><td>'+money(win.pnl)+'</td><td>'+money(loss.pnl)+'</td><td><details><summary style="cursor:pointer">View</summary><div style="overflow-x:auto"><table style="font-size:10px"><thead><tr><th>Trade</th><th>Day</th><th>Risk</th><th>P&L</th><th>Result</th></tr></thead><tbody>'+(history||'<tr><td colspan="5">First trade: '+money(risk)+'</td></tr>')+'</tbody></table></div><small>Next WIN: '+win.status+' · Next LOSS: '+loss.status+'</small></details></td></tr>';
 }).join('');
 return '<p style="font-size:10px;opacity:.8">Rule: '+candidate.name+'. Decision points use the same calculation as the optimizer. Representative prefixes shown; not all possible paths. Simplified drawdown model.</p><div style="overflow-x:auto"><table style="font-size:10px"><thead><tr><th>Path</th><th>Chance</th><th>Risk</th><th>WIN P&L</th><th>LOSS P&L</th><th>Details</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
 };
 const rows=eligible.slice(0,10).map((x,i)=>'<tr><td colspan="7"><details style="margin:2px 0"><summary style="cursor:pointer;display:flex;gap:7px;flex-wrap:wrap;align-items:center"><b>#'+(i+1)+'</b><span>'+x.e.name+' / '+x.u.name+'</span><b>ROI '+x.roi.toFixed(1)+'%</b><span>Net '+money(x.net)+'</span></summary><div style="padding:6px 3px"><p style="font-size:11px">Eval pass '+(x.e.pass*100).toFixed(1)+'% · Fund pass '+(x.u.pass*100).toFixed(1)+'% · Expected fees '+money(x.fees)+'</p><details><summary style="cursor:pointer;font-weight:600">Challenge · Trade-by-trade</summary>'+explain(evalBase,x.e)+'</details><details><summary style="cursor:pointer;font-weight:600">Funded · Trade-by-trade</summary>'+explain(fundBase,x.u)+'</details></div></details></td></tr>').join('');
 return '<div style="font-size:11px;margin:7px 0"><b>Advanced scenarios · '+eligible.length+' qualifying / '+results.length+' tested pairs</b><p style="margin:4px 0;opacity:.8">Current edited parameters. Dynamic models recalculate target-based risk after each win/loss, subject to a cap and remaining drawdown reserve. Fixed models included for comparison. Saved presets unchanged.</p><div style="overflow-x:auto"><table style="font-size:11px"><thead><tr><th>#</th><th>Challenge</th><th>Funded</th><th>Eval pass</th><th>Fund pass</th><th>Net</th><th>ROI</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7">No qualifying strategies. Review RR, trade depth and limits.</td></tr>')+'</tbody></table></div><small style="opacity:.75">Exploratory model, max 12 trades/stage. No payout calendar, correlated trades, concurrency or complete trailing drawdown simulation. Unresolved paths are not counted as passes.</small></div>';
};
const strategyComparison=()=>{
 const candidates=[['current','Dynamic + buffer','Target ÷ RR','150 until first win, then 450',{},{}],['fixedlow','Fixed low','250 every trade','150 every trade',{riskModel:'fixed',baseRisk:250},{riskModel:'fixed',baseRisk:150}],['half','Half-target','Half remaining target ÷ RR','150 every trade',{riskModel:'half'},{riskModel:'fixed',baseRisk:150}],['recovery','Recovery + buffer','250 + 50% per phase loss; cap 450','150 until first win, then 450',{riskModel:'recovery'},{riskModel:'buffer'}],['fixedhigh','Fixed high','350 every trade','450 every trade',{riskModel:'fixed',baseRisk:350},{riskModel:'fixed',baseRisk:450}]];
 const run=cfg=>{let pass=0,fail=0,unresolved=0,success=[];const walk=p=>{const x=calc(p,cfg);if(scenarioFinished(x,cfg,p)){if(x.status==='target'){pass+=x.prob;success.push(x)}else if(x.status==='closed')fail+=x.prob;else unresolved+=x.prob;return}walk(p+'W');walk(p+'L')};walk('');success.sort((a,b)=>b.prob-a.prob);return {pass,fail,unresolved,success}};
 const rows=candidates.map(([id,name,evalRule,fundRule,ev,fu])=>{const e=run({...v,riskModel:undefined,baseRisk:undefined,fixedRisk:undefined,...ev}),u=run({...fv,riskModel:undefined,baseRisk:undefined,fixedRisk:undefined,ftmoFundedBuilder:undefined,...fu}),buys=replacementMode?(e.pass?allocationTarget/e.pass:null):nn,funded=buys===null?null:replacementMode?allocationTarget:buys*e.pass,fees=buys===null?null:buys*v.accountCost+funded*activationFee,payout=fees===null?null:funded*u.pass*fv.target*splitPct,net=fees===null?null:payout-fees;return {id,name,evalRule,fundRule,e,u,fees,payout,net,roi:fees>0?100*net/fees:null}});
 const visibleRows=firmType==='topstep'?rows.filter(x=>x.id==='current'||(Number.isFinite(x.net)&&x.net>0&&Number.isFinite(x.roi)&&x.roi>0&&x.e.pass>0&&x.u.pass>0)):rows;
 if(firmType==='topstep'&&!visibleRows.some(x=>x.id===activeStrategy)){activeStrategy='current';try{localStorage.setItem(ACTIVE_KEY,activeStrategy)}catch(e){}}
 const best=key=>visibleRows.filter(x=>Number.isFinite(x[key])).sort((a,b)=>b[key]-a[key])[0]?.id,topNet=best('net'),topRoi=best('roi'),topPass=visibleRows.slice().sort((a,b)=>b.e.pass-a.e.pass)[0]?.id;
 const pct=x=>(x*100).toFixed(2)+'%',money=x=>x===null?'—':cash(x);
 const pathTable=(res,rr)=>'<div style="overflow-x:auto"><table style="font-size:11px"><thead><tr><th>Path</th><th>Chance</th><th>Risk sequence ($)</th><th>Trade details</th></tr></thead><tbody>'+res.success.slice(0,5).map(x=>'<tr><td>'+x.path+'</td><td>'+pct(x.prob)+'</td><td>'+x.steps.map(t=>t.risk.toFixed(2)).join(' → ')+'</td><td><details><summary>View</summary><table><thead><tr><th>#</th><th>Phase</th><th>Day</th><th>W/L</th><th>Risk</th><th>Trade P&L</th><th>Phase P&L</th></tr></thead><tbody>'+x.steps.map((t,i)=>'<tr><td>'+(i+1)+'</td><td>P'+t.stage+'</td><td>'+t.day+'</td><td>'+t.c+'</td><td>'+money(t.risk)+'</td><td>'+money(t.c==='W'?t.risk*rr:-t.risk)+'</td><td>'+money(t.stagePnl)+'</td></tr>').join('')+'</tbody></table></details></td></tr>').join('')+'</tbody></table></div>';
 const stagePaths=(x,stage)=>{const grouped=new Map();x.e.success.forEach(p=>{const steps=p.steps.filter(t=>t.stage===stage);if(!steps.length)return;const key=steps.map(t=>t.c).join('');const item=grouped.get(key);if(item)item.prob+=p.prob;else grouped.set(key,{path:key,prob:p.prob,steps})});return [...grouped.values()].sort((a,b)=>b.prob-a.prob)};
 const stagePanel=(x,stage)=>{
  const isFund=stage===3,hasP2=v.targetMode===2;
  if(stage===2&&!hasP2)return '';
  const target=isFund?fv.target:stage===1?v.target:v.target2;
  const riskRule=isFund?x.fundRule:x.evalRule;
  const paths=isFund?x.u.success:stagePaths(x,stage);
  const stageLabel=stage===1?'P1 · Challenge':stage===2?'P2 · Verification':'P3 · Funded';
  const stagePass=isFund?pct(x.u.pass):stage===1?(hasP2?'Included in combined evaluation':'See evaluation pass'):pct(x.e.pass);
  const note=!isFund&&hasP2?'These P1/P2 sequences are extracted from complete successful evaluations; their displayed probabilities are contributions to overall evaluation success, not independent conditional stage pass rates.':'Each path probability is based on the configured win rate.';
  const pathRows=paths.slice(0,5).map(z=>'<tr><td>'+z.path+'</td><td>'+pct(z.prob)+'</td><td>'+z.steps.map(t=>money(t.risk)).join(' → ')+'</td><td><details><summary>View</summary><table><thead><tr><th>Trade</th><th>Day</th><th>W/L</th><th>Risk</th><th>P&L</th><th>Stage P&L</th></tr></thead><tbody>'+z.steps.map((t,i)=>'<tr><td>'+(i+1)+'</td><td>'+t.day+'</td><td>'+t.c+'</td><td>'+money(t.risk)+'</td><td>'+money(t.c==='W'?t.risk*(isFund?fv.rr:v.rr):-t.risk)+'</td><td>'+money(t.stagePnl)+'</td></tr>').join('')+'</tbody></table></details></td></tr>').join('');
  return '<details style="border:1px solid #8884;border-radius:6px;margin-top:6px"><summary style="cursor:pointer;font-weight:700;padding:8px">'+stageLabel+' · Target '+money(target)+'</summary><div style="padding:6px 8px 9px"><div><b>Risk sizing:</b> '+riskRule+'</div><div><b>Target:</b> '+money(target)+' · <b>RR:</b> '+(isFund?fv.rr:v.rr)+'</div>'+(isFund?'<div><b>Funded target chance:</b> '+stagePass+'</div>':'')+'<div style="opacity:.75;margin:5px 0">'+note+'</div><div style="overflow-x:auto"><table style="font-size:11px"><thead><tr><th>Path</th><th>Chance</th><th>Risk per trade</th><th>Details</th></tr></thead><tbody>'+(pathRows||'<tr><td colspan="4">No successful paths at this depth</td></tr>')+'</tbody></table></div></div></details>';
 };
 const detail=x=>'<div style="padding:9px 8px 11px;border-top:1px solid #8884;font-size:11px"><div style="display:flex;gap:12px;flex-wrap:wrap"><b>Eval pass '+pct(x.e.pass)+'</b><b>Funded pass '+pct(x.u.pass)+'</b><b>Net '+money(x.net)+'</b><b>ROI '+(x.roi===null?'—':x.roi.toFixed(1)+'%')+'</b></div><p style="font-size:11px;opacity:.8;margin:6px 0">Each stage has its own target and risk sequence. Tap P1, P2 or P3 for exact trade amounts. Evaluation results remain based on the original combined P1→P2 calculation.</p>'+stagePanel(x,1)+stagePanel(x,2)+stagePanel(x,3)+'</div>';
 const rowHtml=x=>'<div style="position:relative;border-bottom:1px solid #8884"><details data-risk-row="'+x.id+'" style="border:0" '+(openStrategyRows.has(x.id)?'open':'')+'><summary style="cursor:pointer;list-style:none;padding:9px 60px 9px 6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px"><span style="flex:1 1 130px;font-weight:700;min-width:125px">▸ '+x.name+'</span><span style="min-width:66px">Eval '+pct(x.e.pass)+'</span><span style="min-width:66px">Fund '+pct(x.u.pass)+'</span><span style="min-width:80px">Net '+money(x.net)+'</span><span style="min-width:58px">ROI '+(x.roi===null?'—':x.roi.toFixed(1)+'%')+'</span>'+(x.id===topNet?' <small title="Best expected net">★Net</small>':'')+(x.id===topRoi?' <small title="Best ROI">★ROI</small>':'')+(x.id===topPass?' <small title="Best evaluation pass">★Pass</small>':'')+'</summary>'+detail(x)+'</details><button type="button" data-risk-activate="'+x.id+'" aria-pressed="'+(x.id===activeStrategy)+'" aria-label="Select '+x.name+'" style="position:absolute;right:7px;top:7px;min-width:44px;min-height:30px;border-radius:7px;padding:5px 9px;font-size:11px;font-weight:800;cursor:pointer;border:1px solid '+(x.id===activeStrategy?'#36a785':'#667487')+';background:'+(x.id===activeStrategy?'#176c55':'transparent')+';color:inherit">'+(x.id===activeStrategy?'ON':'OFF')+'</button></div>';
 return '<div style="margin-top:6px"><p style="font-size:11px;opacity:.8;margin:4px 0 8px">Tap ON / OFF at the right of a strategy to select it. Only one can be ON. Tap the row to see risk rules and trade sequences. Open multiple rows to compare. ★ marks best modeled net, ROI or evaluation pass. '+(firmType==='topstep'?'Topstep: models with non-positive expected net/ROI or zero stage success are hidden; all five are still calculated.':'')+'</p><div style="border:1px solid #8884;border-radius:7px;overflow:hidden">'+visibleRows.map(rowHtml).join('')+'</div><p style="font-size:10px;opacity:.7;margin-top:8px">Modeled expected values, not realized returns. Unresolved paths are not passes. Calendar timing, correlated signals, account concurrency and payout eligibility are not fully modeled.</p></div>';
};


if(!box.dataset.riskActivationBound){box.dataset.riskActivationBound='1';box.addEventListener('toggle',event=>{const row=event.target;if(!row.matches?.('[data-risk-row]'))return;const id=row.dataset.riskRow;if(!Object.prototype.hasOwnProperty.call(STRATEGIES,id))return;if(row.open)openStrategyRows.add(id);else openStrategyRows.delete(id);try{localStorage.setItem(OPEN_ROWS_KEY,JSON.stringify([...openStrategyRows]))}catch(e){}},true);box.addEventListener('click',event=>{const button=event.target.closest('[data-risk-activate]');if(!button||!box.contains(button))return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();const id=button.dataset.riskActivate;if(!Object.prototype.hasOwnProperty.call(STRATEGIES,id))return;activeStrategy=id;try{localStorage.setItem(ACTIVE_KEY,id)}catch(e){}box.querySelectorAll('[data-risk-activate]').forEach(el=>{const on=el.dataset.riskActivate===id;el.textContent=on?'ON':'OFF';el.setAttribute('aria-pressed',String(on));el.style.background=on?'#176c55':'transparent';el.style.borderColor=on?'#36a785':'#667487'});renderRisk();},true);}
$('[data-strategy-panel]').innerHTML=phaseMode==='combined'?'<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:5px 0"><button type="button" data-optimize-risk style="font-size:11px;padding:6px 10px;border-radius:6px;cursor:pointer">Find Better Strategies</button><small style="opacity:.7">Uses current edited parameters</small></div><div data-optimizer-results></div>'+(strategySection.open?strategyComparison():'<small style="opacity:.7">Expand Section 06 to calculate comparisons.</small>'):'<p style="font-size:11px">Select Combined to compare risk strategies.</p>';
box.addEventListener('click',event=>{
 const btn=event.target.closest('[data-opt-path]');if(!btn||!box.contains(btn))return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 const tree=btn.closest('[data-opt-tree]'),parent=btn.closest('[data-opt-node]')||btn.parentElement.parentElement;
 const child=parent.querySelector('[data-opt-children]');if(!tree||!child)return;
 const cfg=JSON.parse(decodeURIComponent(tree.dataset.optCfg)),path=btn.dataset.optPath;
 const x=calc(path,cfg),last=x.steps[x.steps.length-1],next=calc(path+'W',cfg).steps[path.length];
 const risk=next?.risk||0,done=scenarioFinished(x,cfg,path)||risk<=0;
 const fmt=n=>'$'+Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2});
 child.innerHTML='<div data-opt-node style="margin:5px 0 5px 8px;padding:6px;border-left:2px solid #8885"><b>Trade '+x.steps.length+' · '+(last?.c==='W'?'WIN':'LOSS')+'</b> · Risk '+fmt(last?.risk)+' · P&L '+fmt(last?.stagePnl)+' · DD left '+fmt(cfg.limit+x.stagePnl)+' · Day '+(last?.day||1)+'<div>'+(x.status==='target'?'TARGET REACHED':x.status==='closed'?'ACCOUNT CLOSED':x.steps.length>=cfg.depth?'TRADE LIMIT': 'CONTINUE')+'</div>'+(done?'':'<div>Next risk '+fmt(risk)+' · Win +'+fmt(risk*cfg.rr)+' / Loss −'+fmt(risk)+'</div><div style="display:flex;gap:5px;margin-top:4px"><button type="button" data-opt-path="'+path+'W">If WIN</button><button type="button" data-opt-path="'+path+'L">If LOSS</button></div><div data-opt-children></div>')+'</div>';
},true);
const optimizerButton=box.querySelector('[data-optimize-risk]');if(optimizerButton)optimizerButton.addEventListener('click',()=>{box.querySelector('[data-optimizer-results]').innerHTML=optimizeRiskStrategies()});

const riskPathDetails=(x,kind)=>'<div style="overflow-x:auto"><table style="width:100%;font-size:11px"><thead><tr><th>#</th><th>Phase</th><th>Day</th><th>Trade</th><th>Risk $</th><th>Trade P&L $</th><th>Phase P&L $</th><th>Target</th></tr></thead><tbody>'+x.steps.map((t,i)=>'<tr><td>'+(i+1)+'</td><td>P'+t.stage+'</td><td>'+t.day+'</td><td>'+(t.c==='W'?'Win':'Loss')+'</td><td>'+tableNumber(t.risk)+'</td><td>'+tableNumber(t.c==='W'?t.risk*(kind==='funded'?fv.rr:v.rr):-t.risk)+'</td><td>'+fundedBalance(t.stagePnl)+'</td><td>'+(t.passed?'Hit':'—')+'</td></tr>').join('')+'</tbody></table></div>';
const topSuccess=(paths,title,kind)=>{const winning=paths.filter(x=>x.status==='target').sort((a,b)=>b.prob-a.prob||a.steps.length-b.steps.length).slice(0,8);return '<div style="margin:8px 0"><div style="font-size:11px;font-weight:700;margin:4px 0">'+title+'</div>'+(winning.length?'<div style="overflow-x:auto"><table style="font-size:11px;width:100%"><thead><tr><th>W/L path</th><th>Probability</th><th>Trades</th><th>Risk by trade ($)</th><th>Details</th></tr></thead><tbody>'+winning.map((x,i)=>'<tr><td>'+x.path+'</td><td>'+(100*x.prob).toFixed(3)+'%</td><td>'+x.steps.length+'</td><td>'+x.steps.map(t=>Math.round(t.risk*100)/100).join(' → ')+'</td><td><details><summary style="cursor:pointer">View</summary>'+riskPathDetails(x,kind)+'</details></td></tr>').join('')+'</tbody></table></div>':'No target-hit paths at this trade depth')+'</div>'};
$('[data-combined-results]').innerHTML=phaseMode==='combined'?combinedCards+'<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;font-weight:700">Successful paths · exact risk per trade</summary><div style="font-size:11px;opacity:.75;margin:5px 0">These are the eight highest-probability successful paths per stage, not optimized risk recommendations. Each path has its own probability; the overall success rate sums all passing paths.</div>'+topSuccess(leaves,'Evaluation target-hit paths','eval')+topSuccess(fundedLeaves,'Funded target-hit paths','funded')+'</details>':'';
const allocationText='<div class="jj-funnel-portfolio"><strong>'+firmType.toUpperCase()+' · '+(payoutMode?'Payout target replacement':replacementMode?'Funded limit replacement':'Fixed purchase')+' economics</strong><div class="jj-funnel-portfolio-grid"><div><small>Funded target</small><strong>'+(replacementMode?allocationTarget:'Not enforced')+'</strong></div><div><small>Expected evaluation buys</small><strong>'+(modelBuys===null?'—':modelBuys.toFixed(1))+'</strong></div><div><small>Expected breached evaluations</small><strong>'+(modelFailed===null?'—':modelFailed.toFixed(1))+'</strong></div><div><small>Unresolved evaluations</small><strong>'+(modelUnresolved===null?'—':modelUnresolved.toFixed(1))+'</strong></div><div><small>Expected fees</small><strong>'+modelCash(modelFees)+'</strong></div><div><small>Expected first payout cash</small><strong>'+cash(modelPayout)+'</strong></div><div><small>Expected net</small><strong>'+modelCash(modelNet)+'</strong></div><div><small>Net ROI on expected fees</small><strong>'+(modelRoi===null?'—':modelRoi.toFixed(1)+'%')+'</strong></div></div><div class="jj-funnel-note">Uses the same '+(replacementMode?'replacement':'fixed-purchase')+' assumptions as section 06. '+(replacementMode?'Expected evaluations = funded target / evaluation pass probability.':'No replacement purchases.')+' FTMO has a shared maximum of 20 simultaneously active P1, P2 and funded accounts, not 20 simultaneous evaluations plus 20 funded. This preview does not enforce the active cap over time, daily signals, minimum days or payout waits. Finite-depth unresolved paths make this an estimate, not a guaranteed outcome.</div></div>';
const portfolioSummary='<div class="jj-funnel-portfolio"><strong>Fixed cohort · '+nn+' purchased accounts (no replacements)</strong><div class="jj-funnel-parallel"></div><div class="jj-funnel-portfolio-grid"><div><small>Total expected trades</small><strong>'+portfolioTrades.toFixed(1)+'</strong></div><div><small>Total account-trading-days</small><strong>'+portfolioDays.toFixed(1)+'</strong></div><div><small>Avg trades / purchase</small><strong>'+(portfolioTrades/nn).toFixed(1)+'</strong></div><div><small>Avg account-days / purchase</small><strong>'+(portfolioDays/nn).toFixed(1)+'</strong></div><div><small>Capacity lower bound (days)</small><strong>'+capacityDays+'</strong></div></div><div class="jj-funnel-note">Challenge: '+portfolioChallengeTrades.toFixed(1)+' trades / '+portfolioChallengeDays.toFixed(1)+' account-days · Funded: '+portfolioFundedTrades.toFixed(1)+' trades / '+portfolioFundedDays.toFixed(1)+' account-days. Includes passed, failed and unresolved paths. Account-days are summed across accounts, not elapsed days. Lower bound = max(ceil(account-trading-days / parallel slots), ceil(expected trades / signals per day)). It is NOT a simulated elapsed schedule: stage sequencing, stop-after-loss, shared signals, minimum days and payout waits can make actual time longer.</div></div>';


/* Stage progression is taken from the same finite-depth challenge paths as the
   evaluation pass rate. P1 pass includes accounts that reached P2 even if they
   later failed or remained unresolved in P2. Topstep has no P2 verification. */
const hasVerification=firmType==='ftmo';
const p1Pass=hasVerification?
 leaves.reduce((sum,path)=>sum+(path.steps.some(step=>step.stage===1&&step.passed)?path.prob:0),0):
 checkpointProbability;
const funnelCount=count=>modelBuys===null?'—':count.toFixed(2);
const percent=value=>Number.isFinite(value)?(100*Math.max(0,Math.min(1,value))).toFixed(1)+'%':'—';
const actualP2Conditional=p1Pass>0?Math.min(1,pEval/p1Pass):null;
// FIX-005: the two-checkpoint model cannot represent additional consistency-repair days.
const p2Audit=firmType==='topstep'?(()=>{
 const reached=leaves.filter(x=>x.steps.some(t=>t.checkpointStage===1&&t.passed));
 const mass=xs=>xs.reduce((sum,x)=>sum+x.prob,0);
 const blockedConsistency=reached.filter(x=>x.status!=='target'&&x.steps.some(t=>t.checkpointStage===2&&t.pnl>=v.target-1e-7&&Math.max(...x.steps.filter(y=>y.checkpointStage===1).map(y=>y.dayPnl),...x.steps.filter(y=>y.checkpointStage===2).map(y=>y.dayPnl))>t.pnl*(v.consistencyRate||50)/100+1e-7));
 const failure=reached.filter(x=>x.status==='closed');
 const incomplete=reached.filter(x=>x.status!=='closed'&&x.status!=='target');
 return {entered:mass(reached),passed:pEval,closed:mass(failure),incomplete:mass(incomplete),consistencyTouched:mass(blockedConsistency)};
})():null;

// User-selected equal-checkpoint planning view: identical settings imply identical
// standalone stage rates. Actual carried-state account outcomes remain separate.
// FIX-007: checkpoint strategy completion and broker qualification are different events.
const p2DailyTargetMass=firmType==='topstep'?leaves.reduce((sum,x)=>sum+(x.steps.some(t=>t.checkpointStage===2&&t.passed)?x.prob:0),0):pEval;
const p2DailyConditional=p1Pass>0?p2DailyTargetMass/p1Pass:0;
const p2ConsistencyGap=Math.max(0,p2DailyTargetMass-pEval); // always zero in FIX-009 two-day target model
const p2Conditional=actualP2Conditional;
const planningP1Rate=firmType==='topstep'?threeAttemptPass:p1Pass;
const planningP2Rate=firmType==='topstep'?threeAttemptPass:actualP2Conditional; // independent benchmark, not actual day-two rate
const planningEvaluationRate=firmType==='topstep'?planningP1Rate*planningP2Rate:pEval;
/* Account funnel rates and counts MUST describe the same carried-state model.
   Independent checkpoint planning rates are reported in a separate comparison. */
const funnelP1=modelBuys===null?null:modelBuys*p1Pass;
const funnelP3=funnelP1===null?null:funnelP1*p2Conditional;

const funnelP4=funnelP3===null?null:funnelP3*pFund;
// FIX-003: one cohort must reconcile P3 funded accounts and P4 target successes.
if(modelBuys!==null&&(Math.abs(funnelP3-modelPassed)>1e-6||Math.abs(funnelP4-modelSuccess)>1e-6))console.warn('FIX-003: funnel cohort mismatch');
// Explicit accounting invariant: carried-state stage counts must reconcile.
if(modelBuys!==null&&Number.isFinite(p2Conditional)&&Math.abs(funnelP3-modelBuys*pEval)>1e-6)
 console.warn('Section 07 funnel accounting mismatch: P3 differs from evaluations × actual pass rate');
/* Conditional stage pass rates and cumulative per-start probabilities are
   conceptually distinct. P3 admission is modeled as automatic after verification
   (or evaluation for Topstep). P4 is funded target success, not cash settlement. */
/* Stage cost = incremental expected fees, not account profit or reserved budget.
   Unit cost = cumulative real fees required to obtain one expected survivor at
   that checkpoint. No artificial P2 purchase or P4 withdrawal fee is added. */
const evalSpend=modelBuys===null?null:modelBuys*v.accountCost;
const activationSpend=modelBuys===null?null:modelPassed*activationFee;
const allSpend=modelBuys===null?null:evalSpend+activationSpend;
const costPer=(spend,number)=>spend===null||number===null||number<=0?'—':cash(spend/number);
/* Stage averages are conditional on paths completing the given checkpoint,
   and count INCREMENTAL trades executed at that stage (not cumulative trades).
   P1 purchases no trades. Funded P4 includes only paths hitting funded target. */
const tradesBeforeCheckpoint=path=>{
 if(hasVerification){
  const at=path.steps.findIndex(t=>t.stage===1&&t.passed);
  return at>=0?at+1:null;
 }
 const at=path.steps.findIndex(t=>t.checkpointStage===1&&t.passed);
 return at>=0?at+1:null;
};
const stageAverage=(paths,extract)=>{
 let probabilityWeight=0,trades=0,wins=0,losses=0;
 for(const path of paths){
  const stageSteps=extract(path);
  if(!stageSteps)continue;
  const weight=path.prob;
  probabilityWeight+=weight;
  trades+=weight*stageSteps.length;
  wins+=weight*stageSteps.filter(t=>t.c==='W').length;
  losses+=weight*stageSteps.filter(t=>t.c==='L').length;
 }
 if(probabilityWeight<=0)return null;
 return {trades:trades/probabilityWeight,wins:wins/probabilityWeight,losses:losses/probabilityWeight};
};
const checkpointSteps=path=>{
 const count=tradesBeforeCheckpoint(path);
 return count===null?null:path.steps.slice(0,count);
};
const secondStageSteps=path=>{
 if(path.status!=='target')return null;
 const count=tradesBeforeCheckpoint(path);
 return count===null?null:path.steps.slice(count);
};
const successfulFundedSteps=path=>path.status==='target'?path.steps:null;
const averageP2=stageAverage(leaves,checkpointSteps);
/* The Topstep funnel treats both checkpoints as independent copies of the
   same strategy. Their successful-path averages must therefore also match.
   Do not mix a carried-state stage-2 average with modeled checkpoint rates. */
const topstepTradeLoss=1-Math.max(0,Math.min(1,v.winRate/100));
const topstepCycleTrades=1+topstepTradeLoss+topstepTradeLoss*topstepTradeLoss;
const topstepCyclePass=1-topstepTradeLoss**3;
const topstepFundedReset=topstepTradeLoss**2*(1-topstepTradeLoss);
const topstepFundedExpectedTrades=topstepCycleTrades/(1-topstepFundedReset);
const topstepEvalAverage={trades:topstepCycleTrades,wins:topstepCyclePass,losses:topstepCycleTrades-topstepCyclePass};
const topstepFundedAverage={trades:topstepFundedExpectedTrades,wins:(1-topstepTradeLoss)*(1+topstepTradeLoss+topstepTradeLoss**2)/(1-topstepFundedReset),losses:topstepFundedExpectedTrades-(1-topstepTradeLoss)*(1+topstepTradeLoss+topstepTradeLoss**2)/(1-topstepFundedReset)};
const averageP3=firmType==='topstep'?topstepEvalAverage:stageAverage(leaves,secondStageSteps);
const averageP4=firmType==='topstep'?topstepFundedAverage:stageAverage(fundedLeaves,successfulFundedSteps);
const totalTrades=(paths,n,portion)=>n===null||!Number.isFinite(n)||!paths.length?null:n*paths.reduce((sum,path)=>sum+path.prob*portion(path).length,0);
const cut=path=>{const n=tradesBeforeCheckpoint(path);return n===null?path.steps.length:n;};
const totP2=totalTrades(leaves,modelBuys,path=>path.steps.slice(0,cut(path)));
/* The carried-state second-stage trade total is not a valid independent-stage
   forecast. Hide it rather than present misleading precision. */
const totP3=firmType==='topstep'?null:totalTrades(leaves,modelBuys,path=>path.steps.slice(cut(path)));
const totP4=totalTrades(fundedLeaves,modelPassed,path=>path.steps);

/* Exactly four sequential checkpoints. Funded activation is not an
   independent 100% pass; P3 = evaluations completing all qualification,
   P4 = funded accounts reaching their modeled payout profit target. */
const funnelData=[
 {phase:'P1 · Evaluations purchased',count:modelBuys,rate:null,total:1,newCost:evalSpend,unitCost:costPer(evalSpend,modelBuys),avg:null,totTrades:0},
 {phase:hasVerification?'P2 · Challenge passed':'P2 · First trading day passed',count:funnelP1,rate:p1Pass,total:p1Pass,newCost:0,unitCost:costPer(evalSpend,funnelP1),avg:firmType==='topstep'?topstepEvalAverage:averageP2,totTrades:firmType==='topstep'?(modelBuys===null?null:modelBuys*topstepCycleTrades):totP2},
 {phase:hasVerification?'P3 · Verification passed / funded':'P3 · Second trading day passed / funded',count:funnelP3,rate:p2Conditional,total:pEval,newCost:activationSpend,unitCost:costPer(allSpend,funnelP3),avg:averageP3,totTrades:firmType==='topstep'?(funnelP1===null?null:funnelP1*topstepCycleTrades):totP3},
 {phase:'P4 · Funded payout target reached',count:funnelP4,rate:pFund,total:pEval*pFund,newCost:0,unitCost:costPer(allSpend,funnelP4),avg:averageP4,totTrades:firmType==='topstep'?(funnelP3===null?null:funnelP3*topstepFundedExpectedTrades):totP4}
];
const reversePayoutPlan=payoutMode?'<div style="margin:8px 0;padding:8px 10px;border:1px solid #8884;border-radius:7px;font-size:11px">'+
 '<strong>Reverse plan · '+payoutGoal+' projected full payout targets</strong>'+
 '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:7px">'+
 '<div><small>P4 · Target reached</small><div style="font-weight:700">'+(modelBuys===null?'—':modelSuccess.toFixed(2))+'</div></div>'+
 '<div><small>P3 · Funded qualified</small><div style="font-weight:700">'+(modelBuys===null?'—':modelPassed.toFixed(2))+'</div></div>'+
 '<div><small>P2 · First checkpoint</small><div style="font-weight:700">'+funnelCount(funnelP1)+'</div></div>'+
 '<div><small>P1 · Evaluations bought</small><div style="font-weight:700">'+funnelCount(modelBuys)+'</div></div>'+
 '</div>'+
 '<div style="margin-top:6px;opacity:.8">P2 pass '+percent(p1Pass)+' · P3 pass '+percent(p2Conditional)+' · P4 funded pass '+percent(pFund)+
 ' · Funded failures '+(modelBuys===null?'—':Math.max(0,modelPassed-modelSuccess).toFixed(2))+
 ' · Not passed within modeled attempts (includes unresolved) '+(modelBuys===null?'—':Math.max(0,modelBuys-modelPassed).toFixed(2))+'</div>'+
 '<div style="opacity:.75;margin-top:4px">Reverse expected counts: P4 target ÷ funded pass = P3 funded; P3 ÷ second-checkpoint pass = P2; P2 ÷ first-checkpoint pass = P1 purchases. One evaluation fee per P1 account; Topstep P2/P3 are checkpoints in the same evaluation. Does not schedule the five simultaneous funded slots.</div></div>':'';
const totalFunnelTrades=funnelData.reduce((sum,x)=>sum+(x.totTrades||0),0);
const hasAllFunnelTrades=funnelData.every(x=>x.totTrades!==null);
const stageEntrants=[0,modelBuys,funnelP1,funnelP3];
const totalFunnelWins=firmType==='topstep'&&modelBuys!==null?
 modelBuys*topstepEvalAverage.wins+funnelP1*topstepEvalAverage.wins+funnelP3*topstepFundedAverage.wins:null;
const totalFunnelLosses=totalFunnelWins===null?null:totalFunnelTrades-totalFunnelWins;
const tradeSummary=hasAllFunnelTrades?
 '<div class="jj-funnel-summary" style="margin:8px 0"><span>Total expected trades <strong>'+totalFunnelTrades.toFixed(1)+'</strong></span>'+
 (totalFunnelWins===null?'':'<span>Wins <strong>'+totalFunnelWins.toFixed(1)+'</strong></span><span>Losses <strong>'+totalFunnelLosses.toFixed(1)+'</strong></span>')+
 '<span>Avg trades / P4 target <strong>'+(modelSuccess>0?(totalFunnelTrades/modelSuccess).toFixed(1):'—')+'</strong></span></div>':'';
const tradeTotalsRow=hasAllFunnelTrades?'<tr style="font-weight:700;border-top:2px solid #8887"><td>Total trades</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td style="text-align:right">'+totalFunnelTrades.toFixed(2)+'</td><td>—</td><td>—</td><td>'+modelCash(modelFees)+'</td><td>—</td></tr>':'';
const rows=funnelData.map(x=>'<tr><td style="text-align:left;white-space:nowrap" title="'+(x.phase.startsWith('P4')?'Projected payout after funded success, not confirmed cash withdrawal':'')+'">'+x.phase+'</td>'+
 '<td style="text-align:right;font-variant-numeric:tabular-nums">'+(x.count===null?'—':funnelCount(x.count))+'</td>'+
 '<td style="text-align:right;font-variant-numeric:tabular-nums">'+(x.rate===null?'—':percent(x.rate))+'</td>'+
 '<td style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums">'+(x.total===null?'—':percent(x.total))+'</td>'+
 ['trades','wins','losses'].map(field=>'<td style="text-align:right;font-variant-numeric:tabular-nums">'+(x.avg?x.avg[field].toFixed(2):'—')+'</td>').join('')+
 '<td style="text-align:right;font-weight:700;font-variant-numeric:tabular-nums">'+(x.totTrades===null?'—':x.totTrades.toFixed(2))+'</td>'+
 '<td style="text-align:right;font-weight:700;font-variant-numeric:tabular-nums" title="Trades including failed attempts per successful stage pass">'+(x.totTrades===null||!(x.count>0)||x.rate===null?'—':(x.totTrades/x.count).toFixed(2))+'</td>'+
 '<td style="text-align:left;white-space:nowrap;font-variant-numeric:tabular-nums" title="W = win, L = loss. LLW on funded accounts resets to opening balance and starts another cycle; LLL loses the account">'+(firmType==='topstep'?(x.phase.startsWith('P1')?'—':x.phase.startsWith('P4')?'W · LW · (LLW → restart)':'W · LW · LLW'):'—')+'</td>'+
 '<td style="text-align:right;font-variant-numeric:tabular-nums" title="New fees incurred at this stage for the modeled cohort">'+modelCash(x.newCost)+'</td>'+
 '<td style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums" title="Cumulative fees spent divided by expected accounts achieving this stage">'+x.unitCost+'</td></tr>').join('');
$('[data-funnel]').innerHTML='<div class="jj-funnel-wrap">'+
 '<div class="jj-funnel-note"><strong>'+(payoutMode?'Target '+payoutGoal+' projected payouts':replacementMode?'Target funded accounts':'Fixed cohort')+
 '</strong> · Start: '+funnelCount(modelBuys)+' evaluations · Fee: '+modelCash(modelBuys===null?null:modelBuys*v.accountCost)+'</div>'+reversePayoutPlan+
 '<div style="display:flex;justify-content:flex-end;margin:5px 0;position:relative"><details data-funnel-column-menu style="position:relative"><summary style="cursor:pointer;font-size:11px;padding:4px 8px;border:1px solid #8885;border-radius:6px">Columns</summary><div data-funnel-column-options style="position:absolute;right:0;z-index:20;background:var(--background,#232632);border:1px solid #8885;border-radius:7px;padding:8px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;min-width:220px;max-width:min(90vw,360px);max-height:min(60vh,360px);overflow-y:auto;box-shadow:0 8px 24px #0005"></div></details></div>'+
 tradeSummary+
 '<div style="width:100%;overflow-x:auto"><table data-funnel-table style="width:100%;font-size:11px;table-layout:auto"><thead><tr><th style="text-align:left;cursor:help" title="P1 evaluations purchased; P2 first trading checkpoint; P3 full evaluation passed and funded qualified; P4 funded profit target reached" aria-label="Phase: P1 evaluations purchased; P2 first trading checkpoint; P3 full evaluation passed and funded qualified; P4 funded profit target reached">Phase</th><th style="text-align:right;cursor:help" title="Expected accounts at this stage; P1 is purchases, P2 and P3 are checkpoint passes, P4 is funded target successes" aria-label="Accounts: Expected accounts at this stage; P1 is purchases, P2 and P3 are checkpoint passes, P4 is funded target successes">Accounts</th><th style="text-align:right;cursor:help" title="Chance to pass this stage conditional on entering it. P1 is purchases, so no pass rate applies" aria-label="Pass %: Chance to pass this stage conditional on entering it. P1 is purchases, so no pass rate applies">Pass %</th><th style="text-align:right;cursor:help" title="Cumulative chance for one purchased evaluation to reach this stage; P1 baseline is 100%" aria-label="Total %: Cumulative chance for one purchased evaluation to reach this stage; P1 baseline is 100%">Total %</th><th style="text-align:right;cursor:help" title="Average trades taken IN this stage, per account entering this stage, including failures and resets">Avg T</th><th style="text-align:right;cursor:help" title="Average winning trades IN this stage, per account entering this stage">Avg W</th><th style="text-align:right;cursor:help" title="Average losing trades IN this stage, among accounts successfully passing it">Avg L</th><th style="text-align:right;cursor:help" title="Expected total trades in this stage across ALL attempts (failed and unresolved included)">Tot T</th><th style="text-align:right;cursor:help" title="Average trades needed to pass one account at this stage. Includes all trades from failed accounts as well as successful accounts. Formula: total stage trades ÷ successful stage passes.">Trades / Pass</th><th style="text-align:left;cursor:help" title="Possible trade sequences: W win, L loss. Evaluation passes with W, LW or LLW; funded LLW resets to opening balance and repeats. LLL fails.">Pass Paths</th><th style="text-align:right;cursor:help" title="Incremental expected cohort fees: evaluation purchases at P1, funding activation at P3. No invented second Topstep evaluation fee" aria-label="Stage $: Incremental expected cohort fees: evaluation purchases at P1, funding activation at P3. No invented second Topstep evaluation fee">Stage $</th><th style="text-align:right;cursor:help" title="Total expected fees incurred through this stage divided by expected accounts reaching it, including failed attempts" aria-label="Cost / result: Total expected fees incurred through this stage divided by expected accounts reaching it, including failed attempts">Cost / result</th></tr></thead><tbody>'+rows+tradeTotalsRow+'</tbody></table></div>'+
 (replacementMode?'':portfolioSummary)+
 '<div class="jj-funnel-summary"><span>Projected payout cash <strong>'+modelCash(modelPayout)+'</strong> · P4 target successes '+(modelBuys===null?'—':modelSuccess.toFixed(2))+'</span><span>Net <strong>'+modelCash(modelNet)+'</strong></span><span>ROI <strong>'+(modelRoi===null?'—':modelRoi.toFixed(1)+'%')+'</strong></span></div>'+
 '<div class="jj-funnel-note">'+
 (payoutMode?'Reverse target: P4 funded profit successes ÷ funded pass rate = P3 qualified funded accounts; P3 ÷ evaluation pass = P1 purchases. ':'')+
 'Avg T / W / L are the average trades, wins and losses within EACH stage among successful paths. They exclude failed accounts and are not cumulative. P1 has no trades; P2 is the first checkpoint, P3 the remaining evaluation trades, and P4 funded target trades. '+
 (firmType==='topstep'?'Topstep account funnel uses enumerated carried-state checkpoint paths, including trailing drawdown and consistency. The separate equal-checkpoint benchmark is informational only. Each checkpoint has its own R1–R4 counter and up to '+Math.min(8,v.depth)+' modeled trades. ':'')+
 (firmType==='topstep'?'<details open style="margin:7px 0"><summary style="cursor:pointer;font-weight:700">Evaluation probability comparison · open</summary><div style="padding:6px 0">Equal-checkpoint PLANNING: P1→P2 '+percent(planningP1Rate)+'; P2→P3 '+percent(planningP2Rate)+'; combined '+percent(planningEvaluationRate)+'. ACCOUNT funnel: P1→P2 '+percent(p1Pass)+'; P2→P3 '+percent(p2Conditional)+'; combined '+percent(pEval)+'. Actual carried-state evaluation engine: '+percent(actualEvaluationProbability)+'. Difference: '+((planningProbability-actualEvaluationProbability)*100).toFixed(2)+' percentage points. <strong>Financial projections and account funnel use the carried-state path probability; the equal-checkpoint benchmark is diagnostic only. Execution costs and payout eligibility remain unverified.</strong> The carried-state calculation includes inherited end-of-day trailing drawdown and consistency but does not model all real execution costs.</div></details>':'')+
 (firmType==='topstep'?'<div style="padding:7px 0"><strong>FIX-007: Separate daily strategy and evaluation qualification</strong> · P1 daily target '+percent(p1Pass)+' · P2 daily $1,500 target given P1 '+percent(p2DailyConditional)+' · P2 fully qualified given P1 '+percent(p2Conditional)+' · P2 daily target reached but not qualified (per evaluation) '+percent(p2ConsistencyGap)+'. The table P3 and ROI use qualified evaluations, not merely a second winning day. P2 target can differ from P1 because trailing drawdown is carried. This is a finite-path model; unfinished accounts are not confirmed failures.</div>':'')+
 (p2Audit?'<div style="padding:7px 0"><strong>FIX-005 limitation:</strong> Two modeled trading days cannot resolve every 50% consistency overshoot. Some paths require a third trading day; do not interpret the current P2 pass rate or ROI as final. <strong>FIX-004 P2 path audit (probability per purchased evaluation)</strong>: P1 reached '+percent(p2Audit.entered)+' · P2 completed '+percent(p2Audit.passed)+' · P2 closed '+percent(p2Audit.closed)+' · P2 unfinished/blocked '+percent(p2Audit.incomplete)+' · paths encountering consistency threshold '+percent(p2Audit.consistencyTouched)+'. Consistency category overlaps closed/unfinished; not an additional failure count. Checkpoint rates need not be identical when balances and consistency carry forward.</div>':'')+
 'P1 purchases: '+funnelCount(modelBuys)+'; P2 first checkpoint passed: '+funnelCount(funnelP1)+
 '; P3 evaluation passed and funded: '+funnelCount(funnelP3)+
 '; P4 funded payout profit target: '+funnelCount(funnelP4)+'. '+
 'P4 funded failures before target: '+(modelBuys===null?'—':Math.max(0,modelPassed-modelSuccess).toFixed(2))+
 '. P4 models funded profit-target success, not verified withdrawal eligibility or received cash. Expected quantities may be fractional. Funded capacity, payout wait, scheduling and correlated trades are not simulated.</div></div>';


const funnelColumnLabels=Array.from($('[data-funnel-table]').querySelectorAll('thead th'),th=>th.textContent.trim());
const funnelColumnStore='jj-funnel-columns-v1';
let visibleColumns=funnelColumnLabels.map((_,i)=>i);
try{const stored=JSON.parse(localStorage.getItem(funnelColumnStore)||'null');if(Array.isArray(stored))visibleColumns=[0,...stored.filter(n=>Number.isInteger(n)&&n>0&&n<funnelColumnLabels.length)];}catch(e){}
const funnelTable=$('[data-funnel-table]');
const showFunnelColumns=()=>funnelTable.querySelectorAll('tr').forEach(tr=>Array.from(tr.children).forEach((cell,i)=>{cell.style.display=visibleColumns.includes(i)?'':'none'}));
const options=$('[data-funnel-column-options]');
options.innerHTML=funnelColumnLabels.slice(1).map((name,i)=>'<label style="font-size:11px;white-space:nowrap;display:flex;align-items:center;gap:5px"><input data-funnel-col="'+(i+1)+'" type="checkbox" '+(visibleColumns.includes(i+1)?'checked':'')+'>'+name+'</label>').join('');
options.addEventListener('change',e=>{
 const input=e.target.closest('[data-funnel-col]');if(!input)return;
 const i=Number(input.dataset.funnelCol);
 visibleColumns=input.checked?[...new Set([...visibleColumns,i])]:visibleColumns.filter(n=>n!==i);
 try{localStorage.setItem(funnelColumnStore,JSON.stringify(visibleColumns))}catch(e){}
 showFunnelColumns();
});
showFunnelColumns();
// One delegated outside-tap listener survives table redraws without stacking handlers.
if(!document.documentElement.dataset.jjFunnelOutsideClose){
 document.documentElement.dataset.jjFunnelOutsideClose='1';
 document.addEventListener('pointerdown',event=>{
  const menu=document.querySelector('[data-funnel-column-menu]');
  if(menu&&menu.open&&!menu.contains(event.target))menu.open=false;
 });
}

if(!replacementMode)$('[data-funnel]').querySelector('.jj-funnel-parallel').append(Object.assign(document.createElement('label'),{textContent:'Parallel active accounts  '}),parallelInput);
const funnelControls=$('[data-funnel]').querySelector('.jj-funnel-parallel');if(funnelControls)funnelControls.style.cssText='display:flex;gap:10px;flex-wrap:wrap;align-items:center';const signalLabel=document.createElement('label');signalLabel.textContent='Signals / day  ';signalLabel.append(signalsInput);if(funnelControls)funnelControls.append(signalLabel);
const consistencyHost=$('[data-consistency-panel]');if(consistencyHost){const topstep=firmType==='topstep';const toggle=$('[data-consistency-enabled]');consistencyToggle.style.display=topstep?'flex':'none';topstepDailyToggle.style.display=topstep?'flex':'none';let consistencySettings={};try{consistencySettings=JSON.parse(localStorage.getItem(consistencyKey)||'{}')||{}}catch(e){}toggle.checked=consistencySettings.enabled!==false;consistencyHost.style.display=topstep&&toggle.checked?'':'none';if(topstep&&toggle.checked){const safeText=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let state={limit:55,days:'1500,1500'};try{state={...state,...JSON.parse(localStorage.getItem(consistencyKey)||'{}')}}catch(e){}const rate=Math.max(1,Math.min(100,Number(state.limit)||55));const days=String(state.days||'').split(/[;,\\s]+/).map(Number).filter(Number.isFinite);const total=days.reduce((a,b)=>a+b,0);const best=Math.max(0,...days);const actual=total>0?100*best/total:0;const adjusted=Math.max(v.target,best/(rate/100));const extra=Math.max(0,adjusted-total);const pass=total>=v.target-1e-7&&total>0&&actual<=rate+1e-7;const status=pass?'Passed':total<=0?'No positive profit yet':'Needs more profit';consistencyHost.innerHTML='<div class="jj-funnel-portfolio"><strong>Topstep · Daily profit consistency</strong><div class="jj-risk-fields"><label>Consistency max (%)<input data-consistency-limit type="number" min="1" max="100" step="0.1" value="'+rate+'"></label><label>Daily net P&L ($, comma separated)<input data-consistency-days type="text" value="'+safeText(state.days)+'" placeholder="1500, 1500"></label></div><div class="jj-funnel-portfolio-grid"><div><small>Evaluation target</small><strong>'+cash(v.target)+'</strong></div><div><small>Total net profit</small><strong>'+cash(total)+'</strong></div><div><small>Best profitable day</small><strong>'+cash(best)+'</strong></div><div><small>Current consistency</small><strong>'+actual.toFixed(1)+'%</strong></div><div><small>Adjusted profit target</small><strong>'+cash(adjusted)+'</strong></div><div><small>Additional profit needed</small><strong>'+cash(extra)+'</strong></div><div><small>Result</small><strong>'+status+'</strong></div></div><div class="jj-funnel-note">Daily net P&L may include losses. Pass requires total profit at least the base target and best profitable day / total profit no more than the consistency limit. This independent calculator does not yet change the existing scenario-path pass probability or model drawdown.</div></div>'}}
const stagePreview=$('[data-stages-preview]');if(stagePreview){const ruleRow=(name,detail)=>'<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #8883;font-size:12px"><strong>'+name+'</strong><span style="text-align:right">'+detail+'</span></div>';stagePreview.innerHTML='<div class="jj-funnel-portfolio"><strong>'+firmType.toUpperCase()+' · Evaluation stages</strong>'+(firmType==='ftmo'?ruleRow('P1 · Challenge','Target '+cash(v.target))+ruleRow('P2 · Verification','Target '+cash(v.target2))+ruleRow('Consistency','Not modeled')+ruleRow('Funded','Target '+cash(fv.target)):ruleRow('P1 · Evaluation','Target '+cash(v.target))+ruleRow('Daily consistency','Max 55% of total profits from any single day')+ruleRow('Example','Two +$1,500 days for a $3,000 target')+ruleRow('Funded','Target '+cash(fv.target)))+'<div class="jj-funnel-note">Reference rules only. This preview does not alter the existing scenario engine or enforce consistency or minimum trading days. For FTMO choose 2 Targets in Challenge Parameters; for Topstep choose 1 Target. Topstep consistency needs a separate daily-profit-aware engine before its pass probability can be calculated.</div></div>'}
const allocationMount=$('[data-allocation-preview]');if(allocationMount)allocationMount.innerHTML=allocationText;
box.querySelectorAll('[data-account-mode]').forEach(btn=>{const active=btn.dataset.accountMode===accountMode;btn.setAttribute('aria-pressed',String(active));btn.style.fontWeight=active?'700':'400';btn.style.background=active?'var(--accent-soft,rgba(85,137,201,.15))':''});
$('[data-multi-controls]').style.display='none';
$('[data-multi-results]').style.display=accountMode==='multi'?'':'none';
if(accountMode==='multi'){
 const n=Math.max(2,Math.min(100,Math.floor(Number($('[data-account-count]').value)||10))),p=Math.max(0,Math.min(1,probability));
 const none=Math.pow(1-p,n),all=Math.pow(p,n);
 const costPerPass=p>0?v.accountCost/p:null;
 const card=(label,value)=>kpiTooltip(label,value,kpiHelp[label]);
 $('[data-multi-results]').innerHTML='<div style="font-size:12px;font-weight:700;margin:8px 0 5px">'+n+' Accounts · Probability</div><div class="jj-risk-results-grid">'+card('At least 1 challenge passes',((1-none)*100).toFixed(2)+'%')+card('Expected passed challenges',(n*p).toFixed(2))+card('Expected ruined',(n*failProbability).toFixed(2))+card('Cost per passed challenge',costPerPass===null?'—':tableNumber(costPerPass))+'</div><div style="font-size:11px;opacity:.75;margin:5px 0">Binomial model using single-account pass probability. Shared trades or correlated outcomes can substantially change these chances.</div>';
}
const metric=(label,value)=>kpiTooltip(label,value,kpiHelp[label]);
const singleCostPerPass=probability>0?v.accountCost/probability:null;
$('[data-prob-results]').innerHTML='<div style="font-size:12px;font-weight:700;margin-bottom:5px">Probability & Results</div><div class="jj-risk-results-grid">'+metric('Pass chance',(probability*100).toFixed(1)+'%')+metric('Risk of ruin',(failProbability*100).toFixed(1)+'%')+metric('Unresolved',(unresolvedProbability*100).toFixed(1)+'%')+metric('Cost per passed challenge',singleCostPerPass===null?'—':tableNumber(singleCostPerPass))+'</div><div style="font-size:11px;opacity:.75;margin-top:5px">Within '+v.depth+' trades. Risk of ruin = probability of hitting the modeled account loss limit before passing. Pass + ruin + unresolved = 100%. Assumes independent trades at '+v.winRate+'% win rate; estimates only.</div>';
$('[data-target2-field]').style.display=v.targetMode===1?'none':'';
$('[data-target1-field]').firstChild.textContent=firmType==='ftmo'?'P1 · Challenge target ($)':'P1 · Evaluation target ($)';
box.querySelectorAll('[data-mode-button]').forEach(btn=>{const active=btn.dataset.modeButton===String(v.targetMode);btn.setAttribute('aria-pressed',String(active));btn.style.fontWeight=active?'700':'400';btn.style.borderColor=active?'var(--accent,#5589c9)':'';btn.style.background=active?'var(--accent-soft,rgba(85,137,201,.15))':''});
$('[data-kpis]').innerHTML=['target','closed','active','daily-blocked'] .map(k=>kpiTooltip(k==='target'?(v.targetMode===1?'PASS T1':'PASS BOTH'):k==='closed'?'FAIL':k==='daily-blocked'?'DAY BLOCK':'ACTIVE',counts[k],kpiHelp[k])).join('');
$('[data-prob]').textContent=(v.targetMode===1?'T1 reached within '+v.depth+' trades: '+(probability*100).toFixed(2)+'%.': 'T1 reached: '+(t1Probability*100).toFixed(2)+'% · Both targets reached within '+v.depth+' trades: '+(probability*100).toFixed(2)+'%. T2 starts at stage P&L 0 with a fresh '+tableNumber(v.limit)+' stage allowance; T1 profit remains banked.')+' Independent trades, '+v.winRate+'% win rate. Daily loss cap '+tableNumber(v.dailyLimit)+' with '+v.tradesPerDay+' losses/day maximum. A negative daily P&L or exhausted daily allowance stops that day; the next simulated trade begins a new day.';
const fundedFilter=$('[data-funded-path-filter]').value;
const fundedDD=x=>tableNumber(Math.max(0,firmForPhases==='topstep'?(x.pnl-x.trailingFloor):fv.limit+x.pnl));
const fundedPathMap=new Map();
fundedLeaves.forEach(leaf=>{
 for(let i=1;i<=leaf.path.length;i++){
  const prefix=leaf.path.slice(0,i);
  if(fundedPathMap.has(prefix))continue;
  const x=firmForPhases==='topstep'?calcTopstepFunded(prefix,fv):calc(prefix,fv);
  if(x.path===prefix)fundedPathMap.set(prefix,x);
 }
});
const fundedShown=[...fundedPathMap.values()].filter(x=>fundedFilter==='all'||x.status===fundedFilter).sort((a,b)=>a.steps.length-b.steps.length||a.path.localeCompare(b.path));
fundedPage=Math.min(fundedPage,Math.max(0,Math.ceil(fundedShown.length/10)-1));
$('[data-funded-path-count]').textContent=fundedShown.length+' outcome paths (including active prefixes; percentages overlap)';
$('[data-funded-path-table]').innerHTML='<div style="overflow-x:auto"><table><thead><tr><th>Path</th><th>%</th><th>Trades</th><th>Risk</th><th>P&L</th><th>DD</th><th>Left</th><th>Result</th><th>View</th></tr></thead><tbody>'+fundedShown.slice(fundedPage*10,fundedPage*10+10).map(x=>{
 const open=expandedFunded.has(x.path);
 const last=x.steps[x.steps.length-1];
 const detail='<div style="padding:6px"><strong>Path '+(x.path||'Start')+'</strong> · P3 Funded · Target '+tableNumber(fv.target)+' · '+(x.status==='target'?'TARGET HIT':x.status==='closed'?'ACCOUNT CLOSED':'CONTINUES')+'</div><div style="overflow-x:auto"><table><thead><tr><th>Trade</th><th>Day</th><th>Risk</th><th>P&L</th><th>DD</th><th>Left</th><th>Day left</th><th>Result</th></tr></thead><tbody>'+x.steps.map((t,i)=>'<tr><td class="'+(t.c==='W'?'jj-risk-win':'jj-risk-loss')+'">'+(i+1)+' '+(t.c==='W'?'WIN':'LOSS')+'</td><td>'+t.day+'</td><td style="color:#f05b65">−'+tableNumber(t.risk)+'</td><td class="'+(t.stagePnl>0?'jj-risk-win':t.stagePnl<0?'jj-risk-loss':'')+'">'+fundedBalance(t.stagePnl)+'</td><td>'+tableNumber(Math.max(0,firmForPhases==='topstep'?(t.ddAvailable??fv.limit+t.stagePnl):fv.limit+t.stagePnl))+'</td><td>'+tableNumber(Math.max(0,fv.target-t.stagePnl))+'</td><td>'+tableNumber(t.dailyLeft)+'</td><td class="'+(t.passed?'jj-risk-win':'')+'">'+(t.passed?'TARGET HIT':'')+'</td></tr>').join('')+'</tbody></table></div>';
 return '<tr><td>'+x.path+'</td><td>'+(x.prob*100).toFixed(2)+'%</td><td>'+x.steps.length+'</td><td style="color:#f05b65">'+(last?'−'+tableNumber(last.risk):'—')+'</td><td class="'+(x.pnl>0?'jj-risk-win':x.pnl<0?'jj-risk-loss':'')+'">'+fundedBalance(x.pnl)+'</td><td>'+fundedDD(x)+'</td><td>'+tableNumber(Math.max(0,fv.target-x.pnl))+'</td><td class="'+(x.status==='target'?'jj-risk-win':x.status==='closed'?'jj-risk-loss':'')+'">'+(x.status==='target'?'PASS':x.status==='closed'?'STOP':'CONTINUE')+'</td><td><button type="button" data-funded-expand="'+x.path+'">'+(open?'▾':'▸')+' View</button></td></tr>'+(open?'<tr><td colspan="9">'+detail+'</td></tr>':'');
}).join('')+'</tbody></table></div>';
$('[data-funded-page]').textContent=fundedShown.length?(fundedPage*10+1)+'–'+Math.min(fundedShown.length,(fundedPage+1)*10)+' / '+fundedShown.length:'0';
$('[data-funded-prev]').disabled=fundedPage===0;$('[data-funded-next]').disabled=(fundedPage+1)*10>=fundedShown.length;
const filter=$('[data-filter]').value;
const decisions=[calc('',v)].concat(allPaths).filter(x=>x.status==='active'&&x.steps.length<v.depth).map(x=>{const win=calc(x.path+'W',v),loss=calc(x.path+'L',v);return {...x,win,loss,nextRisk:win.steps[x.steps.length]?.risk??loss.steps[x.steps.length]?.risk??0}}).filter(x=>x.nextRisk>0);
const shown=decisions.filter(x=>filter==='all'||filter==='active'||x.win.status===filter||x.loss.status===filter).sort((a,b)=>a.steps.length-b.steps.length||a.path.localeCompare(b.path));
page=Math.min(page,Math.max(0,Math.ceil(shown.length/10)-1));
$('[data-table]').innerHTML='<div style="overflow-x:auto"><table><thead><tr><th>Path</th><th>Chance %</th><th>Stage</th><th>Risk</th><th>Win</th><th>Loss</th><th>P&L</th><th>Details</th></tr></thead><tbody>'+shown.slice(page*10,page*10+10).map(x=>{
 const isOpen=expandedPaths.has(x.path),terminal=x.status!=='active';
const stageRows=[1,2].filter(n=>n===1||v.targetMode===2).map(n=>{
 const stageSteps=x.steps.filter(step=>step.stage===n);
 if(!stageSteps.length&&n!==x.stage)return '';
 const history=stageSteps.map((step,i)=>'<tr><td class="'+(step.c==='W'?'jj-risk-win':'jj-risk-loss')+'">'+(i+1)+' '+(step.c==='W'?'Win':'Loss')+'</td><td>'+step.day+'</td><td>'+tableNumber(step.risk)+'</td><td>'+tableNumber(step.stagePnl)+'</td><td>'+tableNumber(step.dailyLeft)+'</td><td>'+(step.passed?'TARGET HIT':'')+'</td></tr>').join('');
 const passed=stageSteps.some(step=>step.passed);
 return '<div style="margin-top:10px"><strong>T'+n+' · '+(passed?'TARGET HIT':n===x.stage?(terminal?'STOPPED':'IN PROGRESS'):'NOT STARTED')+'</strong></div><table><thead><tr><th>Trade</th><th>Day</th><th>Risk</th><th>Stage P&L</th><th>Daily left</th><th>Result</th></tr></thead><tbody>'+(history||'<tr><td colspan="6">No trades in this stage</td></tr>')+'</tbody></table>';
}).join('');
const detail='<div style="padding:6px 0"><strong>Path '+(x.path||'Start')+'</strong> · Total P&L '+fundedBalance(x.pnl)+' · Stage T'+x.stage+' · '+(terminal?'Stopped: '+(x.status==='target'?'target reached':x.status):'Next risk '+tableNumber(x.nextRisk))+' · Day '+x.day+' · Daily loss remaining '+tableNumber(x.dailyLeft)+'</div>'+stageRows+(terminal?'<div style="padding-top:6px"><strong>No further trades in this path.</strong></div>':'<div style="padding-top:6px">Next Win: '+tableNumber(x.win.pnl)+' · Next Loss: '+tableNumber(x.loss.pnl)+'</div>');
return '<tr><td><button class="jj-risk-path" data-path="'+x.path+'">'+(x.path||'Start')+'</button></td><td>'+((x.prob||0)*100).toFixed(2)+'%</td><td>T'+x.stage+'</td><td>'+(terminal?'Stopped':tableNumber(x.nextRisk))+'</td><td class="'+(!terminal&&x.win.status==='target'?'jj-risk-win':'')+'">'+(terminal?'—':tableNumber(x.win.pnl))+'</td><td class="'+(!terminal&&x.loss.status==='closed'?'jj-risk-loss':'')+'">'+(terminal?'—':tableNumber(x.loss.pnl))+'</td><td>'+fundedBalance(x.pnl)+(terminal?' · '+(x.status==='target'?'PASS':x.status==='closed'?'FAIL':'DAY BLOCK'):'')+'</td><td><button data-expand-path="'+x.path+'" aria-expanded="'+isOpen+'">'+(isOpen?'Hide':'Show')+'</button></td></tr>'+(isOpen?'<tr><td colspan="8" class="jj-risk-muted" style="text-align:left;white-space:normal;padding:8px">'+detail+'</td></tr>':'');
}).join('')+'</tbody></table></div>';
$('[data-count]').textContent=shown.length?(page*10+1)+'–'+Math.min((page+1)*10,shown.length)+' / '+shown.length:'0 paths';
$('[data-prev]').disabled=page===0;$('[data-next]').disabled=(page+1)*10>=shown.length;
}
box.addEventListener('change',e=>{if(e.target.matches('[data-consistency-enabled]')){let old={};try{old=JSON.parse(localStorage.getItem(consistencyKey)||'{}')||{}}catch(x){}old.enabled=e.target.checked;try{localStorage.setItem(consistencyKey,JSON.stringify(old))}catch(x){}renderRisk()}});
box.addEventListener('change',e=>{if(e.target.matches('[data-consistency-limit],[data-consistency-days]')){const old=(()=>{try{return JSON.parse(localStorage.getItem(consistencyKey)||'{}')}catch(x){return {}}})();if(e.target.matches('[data-consistency-limit]'))old.limit=e.target.value;else old.days=e.target.value;try{localStorage.setItem(consistencyKey,JSON.stringify(old))}catch(x){}renderRisk()}});
/* Recompute every scenario when an allowance or funded parameter changes. Preserve the active numeric field while the user types. */
const refreshRiskParameter=e=>{
 if(!e.target.matches('[data-k],[data-account-count],[data-funded]'))return;
 const el=e.target,selector=el.hasAttribute('data-funded')?'[data-funded="'+el.getAttribute('data-funded')+'"]':el.hasAttribute('data-k')?'[data-k="'+el.getAttribute('data-k')+'"]':'[data-account-count]';
 const start=el.selectionStart,end=el.selectionEnd;
 page=0;fundedPage=0;expandedFunded.clear();saveSettings();renderRisk();
 const current=box.querySelector(selector);
 if(current&&current!==document.activeElement&&document.activeElement===el){current.focus({preventScroll:true});try{if(start!==null)current.setSelectionRange(start,end)}catch(_){}}
};
box.addEventListener('input',refreshRiskParameter);
box.addEventListener('change',refreshRiskParameter);
box.addEventListener('change',e=>{if(e.target.matches('[data-funded-path-filter]')){fundedPage=0;expandedFunded.clear();renderRisk()}});
box.addEventListener('change',e=>{if(e.target.matches('[data-filter]')){page=0;expandedPaths.clear();renderRisk()}});
box.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;if(btn.hasAttribute('data-optimize-risk'))return;if(btn.hasAttribute('data-funded-expand')){const key=btn.dataset.fundedExpand;if(expandedFunded.has(key))expandedFunded.delete(key);else expandedFunded.add(key);renderRisk();return}if(btn.hasAttribute('data-funded-prev')){fundedPage=Math.max(0,fundedPage-1);renderRisk();return}if(btn.hasAttribute('data-funded-next')){fundedPage++;renderRisk();return}if(btn.hasAttribute('data-phase')){phaseMode=btn.dataset.phase;saveSettings()}else if(btn.hasAttribute('data-account-mode')){accountMode=btn.dataset.accountMode;saveSettings()}else if(btn.hasAttribute('data-mode-button')){box.querySelector('[data-target-mode]').value=btn.dataset.modeButton;page=0;expandedPaths.clear();saveSettings()}else if(btn.hasAttribute('data-expand-path')||btn.hasAttribute('data-path')){const key=btn.hasAttribute('data-expand-path')?btn.dataset.expandPath:btn.dataset.path;if(expandedPaths.has(key))expandedPaths.delete(key);else expandedPaths.add(key)}else if(btn.hasAttribute('data-prev'))page--;else if(btn.hasAttribute('data-next'))page++;renderRisk()});
renderRisk();
}
function mountKpiFourteen(target){
 if(target.querySelector('.jj9-kpi-reference'))return;
 const root=document.createElement('div');root.className='jj9-kpi-reference';
 root.innerHTML='<p>Change the inputs to recalculate every KPI instantly. Use the goal planner to estimate purchases needed for funded accounts or payouts.</p>';
 const syncInfo=document.createElement('p');root.append(syncInfo);
 const fields=document.createElement('div');fields.className='jj14-inputs';root.append(fields);
 const defaults={n:10,w:25,attempts:3,fee:50,activation:150,cash:2000,goal:1,confidence:80};
 const shared=window.__jj14StageData;if(shared){defaults.n=shared.accountCount;defaults.w=shared.evalWin;defaults.fee=shared.accountFee;defaults.activation=shared.activationFee;defaults.cash=shared.walletCash;}
 const values={...defaults};
 const inputs={};
 const specs=[['n','P1 purchases',1,100000,1],['w','Trade win rate %',0,100,.5],['attempts','P1 / P2 attempts',1,20,1],['fee','P1 fee $',0,100000,1],['activation','P3 activation $',0,100000,1],['cash','Wallet payout $',0,10000000,100],['goal','Goal accounts / payouts',1,100000,1],['confidence','Goal probability %',1,99.9,.5]];
 specs.forEach(([key,label,min,max,step])=>{
  const wrap=document.createElement('label');wrap.textContent=label;
  const inp=document.createElement('input');inp.type='number';inp.min=min;inp.max=max;inp.step=step;inp.value=values[key];inp.setAttribute('aria-label',label);
  inp.addEventListener('input',()=>{const v=Number(inp.value);if(inp.value!==''&&Number.isFinite(v)&&v>=min&&v<=max){values[key]=v;update()}});
  wrap.append(inp);fields.append(wrap);inputs[key]=inp;
 });
 const modeLabel=document.createElement('label');modeLabel.textContent='Plan for';
 const mode=document.createElement('select');[['payouts','Expected payouts'],['funded','Expected funded accounts'],['chance','Chance of ≥ goal payouts']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;mode.append(o)});modeLabel.append(mode);fields.append(modeLabel);
 const reset=document.createElement('button');reset.type='button';reset.textContent='Reset';reset.addEventListener('click',()=>{Object.assign(values,defaults);specs.forEach(([k])=>inputs[k].value=values[k]);mode.value='payouts';update()});fields.append(reset);
 const planner=document.createElement('p');planner.className='jj14-planner';root.append(planner);
 const scroll=document.createElement('div');scroll.style.overflowX='auto';const table=document.createElement('table');
 const head=document.createElement('tr');['Metric','Value','Definition / formula'].forEach(t=>{const th=document.createElement('th');th.textContent=t;head.append(th)});const thead=document.createElement('thead');thead.append(head);table.append(thead);
 const tbody=document.createElement('tbody');table.append(tbody);scroll.append(table);root.append(scroll);
 const note=document.createElement('p');note.textContent='Expected counts are averages, not guaranteed whole accounts. Goal probability uses independent purchased accounts. P3 LLW resets the funded sequence; actual payout eligibility, profit splits, trading restrictions, and fees may change results. ROI is expected net profit divided by expected actual spending (purchases plus expected activations), not reserved budget.';root.append(note);
 const pct=x=>(100*x).toFixed(2)+'%',usd=x=>'$'+x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),num=x=>x.toLocaleString('en-US',{maximumFractionDigits:3});
 const binTail=(n,k,p)=>{if(k<=0)return 1;if(n<k||p<=0)return 0;if(p>=1)return 1;let term=Math.exp(n*Math.log1p(-p)),sum=term;for(let j=1;j<k;j++){term*=((n-j+1)/j)*(p/(1-p));sum+=term}return Math.max(0,Math.min(1,1-sum))};
 const exact=(n,k,p)=>{if(k>n)return 0;if(p===0)return k===0?1:0;if(p===1)return k===n?1:0;let log=0;for(let j=1;j<=k;j++)log+=Math.log((n-j+1)/j);return Math.exp(log+k*Math.log(p)+(n-k)*Math.log1p(-p))};
 function update(){
  const {n,w,attempts,fee,activation,cash,goal,confidence}=values,q=1-w/100,p=1-Math.pow(q,attempts);
  const source=window.__jj14StageData,p1=source?source.p1:p,p2=source?source.p2:p,stage3=source?source.p3:((1-q*q*(w/100))>0?((w/100)*(1+q))/(1-q*q*(w/100)):0);
  const success=(1-q*q*(w/100))>0?((w/100)*(1+q))/(1-q*q*(w/100)):0;
  const funded=n*p1*p2,per=p1*p2*stage3,payouts=n*per,spending=n*fee+funded*activation,wallet=payouts*cash;
  syncInfo.textContent=source?'Synced '+source.firm.toUpperCase()+' scenario probabilities: P1 '+pct(p1)+' / P2 '+pct(p2)+' / P3 '+pct(stage3)+' (depth '+source.depth+').':'Standalone illustrative probability model; open Chapter 09 to sync.';
  const trades=p>0?p/(1-q):attempts;
  const goalRate=mode.value==='funded'?p1*p2:per;
  let required=goalRate>0?Math.ceil(goal/goalRate):Infinity;
  if(mode.value==='chance'){
   required=Infinity;
   if(per>0){let lo=0,hi=1;while(hi<1000000&&binTail(hi,goal,per)<confidence/100)hi*=2;if(binTail(hi,goal,per)>=confidence/100){while(lo+1<hi){const mid=Math.floor((lo+hi)/2);if(binTail(mid,goal,per)>=confidence/100)hi=mid;else lo=mid}required=hi}}
  }
  planner.textContent=mode.value==='chance'?'To have '+num(confidence)+'% probability of at least '+num(goal)+' payouts: '+(Number.isFinite(required)?num(required)+' P1 purchases':'Not reachable within 1,000,000 purchases')+'. Current probability: '+pct(binTail(n,goal,per))+'.':'To average '+num(goal)+' '+(mode.value==='funded'?'funded accounts':'payouts')+': '+(Number.isFinite(required)?num(required)+' P1 purchases':'Not possible at this win rate')+'. Current expected: '+num(n*goalRate)+'.';
  const rows=[
   ['P1 purchases',num(n),'Editable initial evaluation purchases'],
   ['P1 max trade slots',num(n*attempts),'Purchases × allowed P1 attempts'],
   ['P1 expected trades',num(n*trades),'Purchases × expected attempts until win or failure'],
   ['P1 pass probability',pct(p1),'1 − (1 − trade win rate)^attempts'],
   ['P2 entering accounts',num(n*p1),'P1 purchases × P1 pass probability'],
   ['P2 max trade slots',num(n*p1*attempts),'Expected P2 entrants × allowed attempts'],
   ['P2 expected trades',num(n*p1*trades),'Expected P2 entrants × expected attempts'],
   ['P2 pass probability',pct(p2),'Same win-rate and attempt rule as P1'],
   ['P3 funded accounts',num(funded),'Purchases × P1 pass × P2 pass'],
   ['P3 payout-target success',pct(stage3),'(w + qw)/(1 − q²w); funded W/LW pays, LLW restarts, LLL fails'],
   ['P4 expected payouts',num(payouts),'Funded accounts × funded success probability'],
   ['Chance of 1+ payouts',pct(binTail(n,1,per)),'Probability at least one payout from purchased accounts'],
   ['Chance of zero payouts',pct(exact(n,0,per)),'Probability all purchased accounts miss payout'],
   ['Exactly 1 payout',pct(exact(n,1,per)),'Binomial probability of exactly one payout'],
   ['Exactly 2 payouts',pct(exact(n,2,per)),'Binomial probability of exactly two payouts'],
   ['3+ payouts',pct(binTail(n,3,per)),'Probability of at least three payouts'],
   ['Minimum positive wallet cash',usd(cash),'One payout; absolute minimum remains $0'],
   ['P1 purchase cost',usd(n*fee),'Purchases × evaluation fee'],
   ['Expected P3 activation cost',usd(funded*activation),'Expected funded entrants × activation fee'],
   ['Expected total spending',usd(spending),'P1 purchase fees + expected funded activation fees'],
   ['Expected wallet cash',usd(wallet),'Expected payout count × wallet cash per payout'],
   ['Expected net profit',usd(wallet-spending),'Expected wallet cash − expected spending'],
   ['Expected net ROI',spending>0?pct((wallet-spending)/spending):'N/A','Expected net profit ÷ expected spending; not average realized ROI'],
   ['Per-purchase payout chance',pct(per),'P1 pass × P2 pass × P3 funded success'],
   ['Chance of ≥ goal payouts',pct(binTail(n,goal,per)),'Binomial tail probability using goal input'],
   ['Expected funded shortfall',num(Math.max(0,goal-funded)),'Goal minus expected funded count, floored at zero']
  ];
  tbody.replaceChildren();rows.forEach(row=>{const tr=document.createElement('tr');row.forEach((value,i)=>{const cell=document.createElement(i===0?'th':'td');cell.textContent=value;cell.title=row[2];if(i===0)cell.scope='row';tr.append(cell)});tbody.append(tr)});
 }
 mode.addEventListener('change',update);
 let style=document.getElementById('jj9-kpi-reference-style');if(!style){style=document.createElement('style');style.id='jj9-kpi-reference-style';document.head.append(style)}
 style.textContent='.jj9-kpi-reference{margin:8px 0;padding:8px;font-size:11px}.jj9-kpi-reference p{font-size:11px;line-height:1.45}.jj14-inputs{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:7px;margin:10px 0}.jj14-inputs label{font-size:11px;display:grid;gap:3px}.jj14-inputs input,.jj14-inputs select,.jj14-inputs button{box-sizing:border-box;width:100%;min-width:0;padding:6px;border:1px solid #8886;border-radius:6px;background:var(--card,var(--bg,#fff));color:inherit}.jj14-planner{font-weight:700;padding:8px;border:1px solid #8885;border-radius:6px}.jj9-kpi-reference table{border-collapse:collapse;width:100%;font-size:11px}.jj9-kpi-reference th,.jj9-kpi-reference td{text-align:left;vertical-align:top;border-bottom:1px solid #8883;padding:6px}.jj9-kpi-reference td:nth-child(2){font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}@media(max-width:600px){.jj9-kpi-reference{padding:4px}.jj14-inputs{grid-template-columns:repeat(2,minmax(0,1fr))}.jj9-kpi-reference th,.jj9-kpi-reference td{padding:5px 4px;font-size:10px}.jj9-kpi-reference td:last-child{min-width:180px}}';
 target.append(root);window.__jj14Update=update;update();
}
const original=render;render=function(){original();if(active===slug)mount();};if(new URLSearchParams(location.search).get('topic')===slug||(!new URLSearchParams(location.search).get('topic')&&(()=>{try{return localStorage.getItem('jj-academy-last-page-v1')===slug}catch(e){return false}})())){active=slug;try{localStorage.setItem('jj-academy-last-page-v1',slug)}catch(e){}}if(typeof jjRebuildMobileSelector==='function')jjRebuildMobileSelector();renderNav();render();
})();
/* Persistent, reviewable change history. Every future fix must add an entry here
   and in jj-simon/CHANGELOG.md, with problem, decision, impact and rollback SHA. */
(function(){
'use strict';
const slug='calc-fix-history';
if(!chapters.some(x=>x.slug===slug))chapters.push({slug,group:'Calculators & Simulations',title:'Calculator Fix History',intro:'Permanent numbered record of calculator changes, the reason for each decision, and how to return to a previous version.',status:'GitHub commit history is the rollback source of truth.',sections:[
{title:'FIX-009 · 2026-11-12 · Two separate $1,500 trading days',points:['User directive: Remove consistency from the T1 simulation. The only profit targets are $1,500 on trading day one and $1,500 on trading day two.','Change: Evaluation passes immediately after the second distinct day reaches $1,500. No additional 50% consistency test or third-day requirement is applied in this strategy model.','Trailing drawdown, risk sequence, contract rounding, and existing T1 preset values remain unchanged.','This is the user-defined strategy model, not an independent verification of the firm’s current evaluation terms.']},
{title:'FIX-008 · 2026-11-12 · Correct daily checkpoint success flag',points:['Problem: P2 reaching the $1,500 strategy target was flagged as not passed when broker consistency was unmet, mixing trading-day success with evaluation qualification.','Change: P2 step now records passed=true for daily strategy target; the evaluation status remains target only if full broker total and consistency pass, otherwise daily-blocked unresolved.','Financial payouts continue to count only broker-qualified evaluations. No T1 preset changes.','Remaining limitation: additional trading days and independent numerical tests are still needed.']},
{title:'FIX-007 · 2026-11-12 · Distinguish second winning day from evaluation pass',points:['Problem: P1 57.8% and P2 20.3% were compared as if both were daily strategy success rates, but P2 was actually full evaluation qualification after consistency.','Change: Added separate P2 daily $1,500 target probability and fully qualified P2 probability, plus the gap attributable to reaching the daily target without qualifying.','Do not count an unqualified $1,500 second day as funded or as a received payout. T1 preset and original path-based ROI are unchanged.','Full independent numerical verification and third-day consistency continuation remain outstanding.']},
{title:'FIX-006 · 2026-11-12 · Equal $1,500 daily strategy targets',points:['User clarification: Each evaluation trading day has the same $1,500 strategy target, not a variable second-day catch-up target.','Change: Both checkpoint days stop their strategy after earning at least $1,500.','Broker protection: An account is marked evaluation passed only if the full $3,000 total and 50% consistency are actually satisfied. Otherwise the branch is blocked/unresolved, not a funded success.','No preset risks, reward ratios, fees, or win rates changed. Full path and deployment verification remain pending.']},
{title:'FIX-005 · 2026-11-12 · Consistency needs extra days',points:['Finding: 50% consistency over exactly two days requires equal daily profits. T1 winners can overshoot $1,500, creating a third-day requirement.','Problem: The current carried-state evaluation engine models only two checkpoint days and cannot continue into extra consistency-repair days.','Decision: Add an explicit warning rather than force P1 and P2 pass rates equal or misrepresent incomplete outcomes as verified failures.','Remaining work: Implement additional trading days with correct EOD drawdown and consistency accounting, then independently test path probabilities and ROI.']},
{title:'FIX-004 · 2026-11-12 · P2 discrepancy audit',points:['Discussion: User challenged P1 60.7% versus conditional P2 22.1%, expecting similar rates.','Finding: Equal risks do not guarantee equal pass rates when the second checkpoint inherits P1 profits and 50% consistency.','Change: Added visible probability breakdown for P1 reached, P2 passed, P2 closed, P2 unfinished or blocked, and paths encountering the consistency threshold.','This fix adds diagnostics, not a forced equalization. T1 preset and financial probabilities remain unchanged. Browser deployment and numeric validation pending.']},
{title:'FIX-003 · 2026-11-12 · Unified path-based funnel',points:['Problem: Section 07 still used simplified three-attempt checkpoint rates, producing conflicting funded and payout counts.','Decision: Derive P1 from enumerated first-checkpoint paths and P2 conditionally from complete evaluation paths.','Target: P3 funded accounts and P4 payout-target successes reconcile with the financial cohort and ROI.','No preset or trading parameter changed. Syntax verified; live deployment and full simulation audit remain pending.']},
{title:'FIX-002 · 2026-11-12 · Path-based stage probabilities',points:[
'Problem: The shared P1/P2 stage metrics still used a simplified three-attempt probability even after financial ROI switched to simulated evaluation paths.',
'Decision: Derive P1 from the enumerated checkpoint pass probability and P2 from completed evaluation probability divided by P1 probability.',
'Why: P1 × P2 must equal the actual path-based evaluation pass rate used by ROI. Keep unresolved paths distinct from failed accounts.',
'Protected: T1 risks, reward ratios, stops, targets, fees, funded risk reset and saved presets were not modified.',
'Validation: JavaScript syntax checked. Browser deployment and full path-mass audit remain pending.',
'Rollback: Use GitHub commit history; prior financial-formula fix was 18fbf16a.' ]},
{title:'FIX-001 · 2026-11-12 · ROI uses evaluation paths',points:[
'Problem: Financial ROI used (1 − (1 − WR)^3)^2 instead of the actual carried-state evaluation pass rate.',
'Decision: Replace financial probability with the enumerated evaluation target probability.',
'Why: Account purchases, activation spending and payouts must follow the same model as the actual trading rules.',
'Limitation: Finite 12-trade paths may remain unresolved; no claim of a fully validated production ROI.',
'Commit: 18fbf16a7f5949d4ed1999db733c54e9fa7e98d1.' ]},
{title:'Baseline · T1 WR20 · 2026-11-12',points:[
'Preserved T1 preset: P1/P2 risks $500 / $700 / $800, reward ratios 3 / 2.9 / 3.4; P3 risks $700 / $800 / $500, reward ratios 5 / 5.25 / 6.',
'P1/P2 evaluation target $3,000, trailing drawdown $2,000, 50% consistency; P3 target $3,500, drawdown $2,000.',
'Evaluation fee $50; activation $150; payout split 75%; 5 target payouts; original win rate 20% for both phases.',
'Goal: Correct probabilities and ROI without altering trading strategy or presets.' ]}
]});
if(typeof jjRebuildMobileSelector==='function')jjRebuildMobileSelector();
if(typeof renderNav==='function')renderNav();
})();
