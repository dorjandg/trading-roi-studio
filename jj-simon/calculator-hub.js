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
   title:'Evaluation Acquisition Calculator',
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
  title:'Evaluation Acquisition Calculator',
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

if(!chapters.some(c=>c.slug===slug))chapters.push({slug,group:'Calculators & Simulations',title:'Dynamic Risk Scenario Calculator',intro:'Explore all win/loss sequences until the profit target is hit or remaining loss allowance falls below the stop threshold. This is an independent mathematical model, not a JJ course rule.',status:'Interactive calculator · illustrative',sections:[{title:'Risk and stopping rules',points:['Each stage calculates risk from its own target and stage P&L. After T1 passes, T2 starts with a fresh loss allowance while total profit remains accumulated.','A win adds risk multiplied by reward multiple; a loss subtracts risk. Stop immediately at the target or if remaining loss allowance falls below the closing threshold.','Active paths at the selected trade depth are unfinished, not failures. Select one and extend it by Win or Loss.','Probability estimates assume independent trades at the editable win rate. They do not account for fees, slippage, drawdown equity rules or actual market execution.'],src:[]}]});
if(!curriculum.some(c=>c.slug===slug))curriculum.push({slug,title:'Dynamic Risk Scenario Calculator',status:'review',reason:'User-defined risk scenario model; not attributed to JJ.'});
/* Place immediately after chapter 08 in the existing numbered sidebar/dashboard/mobile navigation. */
if(typeof jjCategoryOverrides!=='undefined')jjCategoryOverrides[slug]='Calculators & Simulations';
if(typeof jjPreferredChapterOrder!=='undefined'){const order=jjPreferredChapterOrder['Calculators & Simulations'];if(Array.isArray(order)&&!order.includes(slug)){const idx=order.indexOf('calc-prop-vs-live');order.splice(idx<0?order.length:idx+1,0,slug)}}
const style=document.createElement('style');style.textContent='.jj-risk-workbench{margin:12px 0;padding:12px;border:1px solid var(--border,#64748b55);border-radius:12px}.jj-risk-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.jj-risk-fields label{font-size:12px;display:grid;gap:4px}.jj-risk-fields input{width:100%;min-width:0;box-sizing:border-box;padding:8px;border:1px solid #8886;border-radius:7px;background:var(--card,var(--bg,#fff));color:inherit}.jj-risk-kpis,.jj-risk-results-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin:5px 0}.jj-risk-kpis>div,.jj-risk-results-grid>div{min-width:0;padding:5px 6px;background:var(--bg,#8881);border-radius:5px;font-size:10px;line-height:1.25;overflow-wrap:anywhere}.jj-risk-kpis strong,.jj-risk-results-grid strong{display:block;font-size:13px;line-height:1.3;margin-top:2px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}@media(min-width:640px){.jj-risk-kpis,.jj-risk-results-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}.jj-risk-kpis>div,.jj-risk-results-grid>div{padding:6px 7px}}.jj-kpi-help{position:relative;cursor:help;outline-offset:2px}.jj-kpi-tooltip{display:none;position:absolute;z-index:90;left:0;top:calc(100% + 5px);width:max-content;max-width:min(270px,75vw);white-space:normal;overflow-wrap:break-word;background:var(--card,#202631);color:var(--text,#fff);border:1px solid #8888;box-shadow:0 5px 16px #0003;border-radius:7px;padding:9px;font-size:12px;line-height:1.4;font-weight:400}.jj-kpi-help:hover .jj-kpi-tooltip,.jj-kpi-help:focus .jj-kpi-tooltip,.jj-kpi-help:focus-within .jj-kpi-tooltip{display:block}.jj-kpi-help:nth-child(3n) .jj-kpi-tooltip{left:auto;right:0}@media(min-width:640px){.jj-kpi-help:nth-child(3n) .jj-kpi-tooltip{left:0;right:auto}.jj-kpi-help:nth-child(5n) .jj-kpi-tooltip{left:auto;right:0}}.jj-risk-workbench button{cursor:pointer;padding:7px 10px;border-radius:7px;border:1px solid #8887;background:transparent;color:inherit}.jj-risk-workbench button:disabled{opacity:.4}.jj-risk-actions{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}.jj-risk-workbench table{width:100%;border-collapse:collapse;font-size:12px}.jj-risk-workbench th,.jj-risk-workbench td{padding:7px 4px;border-bottom:1px solid #8883;text-align:right}.jj-risk-workbench th:first-child,.jj-risk-workbench td:first-child{text-align:left}.jj-risk-workbench [data-table] table{font-variant-numeric:tabular-nums;white-space:nowrap}.jj-risk-workbench [data-table] th,.jj-risk-workbench [data-table] td{padding:5px 3px}.jj-risk-win{color:#00df83!important;font-weight:800}.jj-risk-loss{color:#f05b65!important;font-weight:750}.jj-risk-muted{opacity:.7;font-size:12px}.jj-risk-workbench select{max-width:100%;padding:6px;border-radius:6px;background:transparent;color:inherit}.jj-risk-workbench .jj-risk-path{font-weight:700;text-decoration:underline;text-underline-offset:3px}.jj-risk-workbench .jj-risk-page{display:flex;justify-content:space-between;align-items:center;margin-top:8px}@media(max-width:520px){.jj-risk-workbench{padding:9px}.jj-risk-kpis strong{font-size:16px}.jj-risk-workbench th,.jj-risk-workbench td{font-size:11px;padding:6px 2px}}';style.textContent+=' .jj-risk-section{border:1px solid var(--border,#64748b55);border-radius:8px;margin:6px 0;overflow:visible}.jj-risk-section>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;padding:9px 10px;font-size:12px;font-weight:700}.jj-risk-section>summary::-webkit-details-marker{display:none}.jj-risk-section>summary:before{content:"▸";font-size:13px;display:inline-block;transition:transform .12s}.jj-risk-section[open]>summary:before{transform:rotate(90deg)}.jj-risk-section-body{padding:0 9px 9px}.jj-risk-section:not([open]) .jj-risk-section-body{display:none}';style.textContent+=' .jj-risk-chevron{display:inline-block!important;flex:0 0 14px;font-size:15px!important;line-height:1!important;color:currentColor!important;opacity:1!important;transform:rotate(0deg);transition:transform .15s}.jj-risk-section[open]>summary .jj-risk-chevron{transform:rotate(90deg)}.jj-risk-section>summary:before{content:none!important}';style.textContent+=' .jj-funnel-wrap{display:grid;gap:8px}.jj-funnel-row{padding:6px 7px;border-radius:7px;background:var(--card,#64748b12)}.jj-funnel-top,.jj-funnel-summary{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12px}.jj-funnel-top span{font-variant-numeric:tabular-nums}.jj-funnel-track{height:5px;background:#64748b35;border-radius:8px;overflow:hidden;margin:6px 0}.jj-funnel-track>span{display:block;height:100%;background:var(--accent,#4ca98f);border-radius:8px}.jj-funnel-money{font-size:11px;opacity:.8}.jj-funnel-summary{padding:9px 7px;border-top:1px solid #64748b55}.jj-funnel-note{font-size:10px;opacity:.75;line-height:1.5}';style.textContent+=' .jj-funnel-portfolio{padding:9px 7px;border:1px solid #64748b55;border-radius:8px;display:grid;gap:8px;font-size:12px}.jj-funnel-portfolio-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.jj-funnel-portfolio-grid>div{display:flex;flex-direction:column;gap:2px}.jj-funnel-portfolio-grid small{font-size:10px;opacity:.75}.jj-funnel-portfolio-grid strong{font-size:15px;font-variant-numeric:tabular-nums}';document.head.append(style);
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
const manualPanel=document.createElement('div');
manualPanel.style.cssText='margin:8px 0;font-size:11px';
manualPanel.innerHTML='<details><summary style="cursor:pointer;font-weight:600">Manual R1 / R2 / R3 / R4 by phase</summary><p style="opacity:.75;margin:5px 0">R1 first trade; R2 after one consecutive loss; R3 after two consecutive losses; R4 after three or more consecutive losses. A win resets to R1 unless the phase target is reached. Automatic leaves existing strategy unchanged.</p><div style="overflow-x:auto"><table style="font-size:11px"><thead><tr><th>Phase</th><th>Mode</th><th>R1 $</th><th>RR1</th><th>R2 $</th><th>RR2</th><th>R3 $</th><th>RR3</th><th>R4 $</th><th>RR4</th></tr></thead><tbody>'+[1,2,3].map(n=>'<tr><td>P'+n+'</td><td><select data-manual-mode="'+n+'"><option value="auto">Auto</option><option value="manual">Manual</option></select></td>'+[1,2,3,4].map(k=>'<td><input data-manual-risk="'+n+'-'+k+'" type="number" min="0.01" step="0.01" value="100" style="width:70px;padding:4px"></td><td><input data-manual-rr="'+n+'-'+k+'" type="number" min="0.1" max="100" step="0.1" placeholder="Auto" style="width:55px;padding:4px"></td>').join('')+'</tr>').join('')+'</tbody></table></div></details>';
box.querySelector('[data-section="challenge-settings"] .jj-risk-section-body').append(manualPanel);
const fundedManualPanel=document.createElement('div');
fundedManualPanel.style.cssText='margin:8px 0;font-size:11px;min-width:0;max-width:100%';
fundedManualPanel.innerHTML='<details><summary style="cursor:pointer;font-weight:600">P3 · Manual R1 / R2 / R3 / R4</summary><p style="font-size:11px;opacity:.75">R2 after one consecutive loss; R3 after two; R4 after three or more. A win resets to R1. Auto uses the selected funded strategy.</p><div data-manual-funded-slot></div></details>';
const fundedManualRow=box.querySelector('[data-manual-mode="3"]').closest('tr');
const fundedManualTable=document.createElement('table');fundedManualTable.style.fontSize='11px';const fundedManualBody=document.createElement('tbody');fundedManualBody.append(fundedManualRow);fundedManualTable.append(fundedManualBody);const fundedScroll=fundedManualPanel.querySelector('[data-manual-funded-slot]');fundedScroll.style.cssText='display:block;width:100%;max-width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y';fundedManualTable.style.width='max-content';fundedManualTable.style.minWidth='740px';fundedScroll.append(fundedManualTable);
box.querySelector('[data-section="funded-settings"] .jj-risk-section-body').append(fundedManualPanel);

try{const stored=JSON.parse(localStorage.getItem(manualRiskKey)||'{}');box.querySelectorAll('[data-manual-mode]').forEach(el=>{if(stored['m'+el.dataset.manualMode])el.value=stored['m'+el.dataset.manualMode]});box.querySelectorAll('[data-manual-risk]').forEach(el=>{const val=stored['r'+el.dataset.manualRisk];if(Number(val)>0)el.value=val});box.querySelectorAll('[data-manual-rr]').forEach(el=>{const val=stored['rr'+el.dataset.manualRr];if(Number(val)>0)el.value=val})}catch(e){}
const comparePanel=document.createElement('div');comparePanel.innerHTML='<div data-compare style="min-width:0"></div>';
const manualConfig=()=>{const result={};for(let n=1;n<=3;n++){const mode=box.querySelector('[data-manual-mode="'+n+'"]').value;if(mode==='manual')result[n]=[1,2,3,4].map(k=>Math.max(.01,Number(box.querySelector('[data-manual-risk="'+n+'-'+k+'"]').value)||.01))}return result};const manualRRConfig=()=>{const result={};for(let n=1;n<=3;n++)result[n]=[1,2,3,4].map(k=>{const el=box.querySelector('[data-manual-rr="'+n+'-'+k+'"]');return el.value!==''&&Number(el.value)>0?Number(el.value):null});return result};
const persistManualRisks=()=>{const stored={};box.querySelectorAll('[data-manual-mode]').forEach(el=>stored['m'+el.dataset.manualMode]=el.value);box.querySelectorAll('[data-manual-risk]').forEach(el=>stored['r'+el.dataset.manualRisk]=el.value);box.querySelectorAll('[data-manual-rr]').forEach(el=>stored['rr'+el.dataset.manualRr]=el.value);try{localStorage.setItem(manualRiskKey,JSON.stringify(stored))}catch(e){}renderRisk()};manualPanel.addEventListener('change',persistManualRisks);fundedManualPanel.addEventListener('change',persistManualRisks);

group('funded-results','04 · Funded · Results',[box.querySelector('[data-funded-results]')]);
group('challenge-results','03 · Challenge · Results',[box.querySelector('[data-kpis]'),box.querySelector('[data-multi-results]'),box.querySelector('[data-prob-results]'),box.querySelector('[data-prob]')]);
// Results order: Challenge, Funded, Combined (preserve existing nodes and saved disclosure states).
box.querySelector('[data-section="funded-results"]').before(box.querySelector('[data-section="challenge-results"]'));
const combined=document.createElement('div');combined.dataset.combinedResults='';
box.querySelector('[data-section="funded-results"]').after(combined);
group('combined-results','05 · Combined · Final Results',[combined]);
combined.after(comparePanel);const compareSection=group('manual-auto','05A · Manual vs Auto · Comparison',[comparePanel]);compareSection.addEventListener('toggle',()=>{if(compareSection.open)renderRisk()});
const strategyPanel=document.createElement('div');strategyPanel.dataset.strategyPanel='';box.querySelector('[data-section="combined-results"]').after(strategyPanel);group('strategy-comparison','06 · Risk Strategy Comparison',[strategyPanel],true);
const funnel=document.createElement('div');funnel.dataset.funnel='';box.querySelector('[data-section="strategy-comparison"]').after(funnel);group('funnel','07 · P1 → P2 → P3 → P4 · Account Funnel',[funnel]);
const title=Array.from(box.querySelectorAll('h4')).find(x=>x.textContent.includes('All scenario paths'));
if(title){const nodes=[];let n=title;while(n&&n.tagName!=='P'){nodes.push(n);n=n.nextElementSibling}group('paths','10 · Challenge · Scenario Paths',nodes)}
const fundedScenario=document.createElement('div');fundedScenario.innerHTML='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><label style="font-size:12px">Filter <select data-funded-path-filter><option value="all">All paths</option><option value="target">Target hit</option><option value="closed">Failed</option><option value="active">Unresolved</option></select></label><span data-funded-path-count style="font-size:11px;opacity:.7"></span></div><div data-funded-path-table></div><div style="display:flex;align-items:center;gap:8px;margin-top:8px"><button data-funded-prev type="button">Previous</button><span data-funded-page style="font-size:11px"></span><button data-funded-next type="button">Next</button></div><p style="font-size:11px;opacity:.7">Illustrative funded paths from the existing funded engine; no payout waiting period or firm-specific day rules are enforced here.</p>';box.querySelector('[data-section="paths"]').after(fundedScenario);group('funded-paths','11 · P3 Funded · Scenario Paths',[fundedScenario]);let fundedPage=0;const expandedFunded=new Set();
const purchaseStrategy=document.createElement('div');purchaseStrategy.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;margin:0 0 10px';purchaseStrategy.innerHTML='<strong>Purchase strategy</strong><select data-purchase-strategy aria-label="Account purchase strategy"><option value="fixed">Fixed purchases</option><option value="target">Reach Funded Limit</option><option value="payout">Maximum Funded Limit Payout</option></select><span data-purchase-strategy-help style="opacity:.75"></span>';box.querySelector('[data-section="funnel"] .jj-risk-section-body').prepend(purchaseStrategy);const strategySelect=purchaseStrategy.querySelector('[data-purchase-strategy]');let purchaseStrategyMode='target';
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
accountMode=data.accountMode==='multi'?'multi':'single';purchaseStrategyMode=['fixed','target','payout'].includes(data.purchaseStrategy)?data.purchaseStrategy:'target';strategySelect.value=purchaseStrategyMode;
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
 const selectors=['[data-k]','[data-funded]','[data-manual-mode]','[data-manual-risk]','[data-manual-rr]',
  '[data-consistency-enabled]','[data-consistency-limit]','[data-account-count]','[data-funded-count]','[data-payout-count]',
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
 box.querySelectorAll('input[data-k],input[data-funded],input[data-manual-risk],input[data-manual-rr],select[data-manual-mode],input[data-consistency-enabled],input[data-consistency-limit],input[data-account-count],input[data-funded-count],input[data-payout-count],input[data-parallel-accounts],input[data-signals-per-day],select[data-purchase-strategy],input[data-target-mode]').forEach(el=>{
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
 if(['fixed','target','payout'].includes(pageSettings.purchaseStrategyMode)){
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
function calc(path,v){
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
 const checkpointDay=v.topstepConsistency?Object.entries(dailyTotals).filter(([d,p])=>Number(d)<day&&p>=v.target/2-1e-7).map(([d])=>Number(d)).sort((a,b)=>a-b)[0]:undefined;const stageTier=v.manualStage||(v.topstepConsistency&&checkpointDay!==undefined?2:stage);const stageManual=v.manualRisks?.[stageTier];let streak=0;for(let i=steps.length-1;i>=0;i--){if(steps[i].stage!==stage||steps[i].c==='W'||v.topstepConsistency&&checkpointDay!==undefined&&steps[i].day<=checkpointDay)break;streak++}const selectedRR=v.manualRRs?.[stageTier]?.[Math.min(3,streak)];const tradeRR=stageManual&&Number(selectedRR)>0?Number(selectedRR):v.rr;const plannedRisk=stageManual?stageManual[Math.min(3,streak)]:v.riskModel==='adaptive'?Math.max(0,Math.min(v.baseRisk,((goal-stagePnl)/v.rr)*v.targetFactor,Math.max(0,left-v.reserve))):v.riskModel==='fixed'?v.baseRisk:v.riskModel==='half'?Math.max(0,(goal-stagePnl)/v.rr/2):v.riskModel==='recovery'?Math.min(450,250*(1+.5*steps.filter(t=>t.stage===stage&&t.c==='L').length)):v.riskModel==='buffer'?(steps.some(t=>t.c==='W')?450:150):v.fixedRisk?v.fixedRisk:v.ftmoFundedBuilder?(steps.some(x=>x.c==='W')?450:150):Math.max(0,(goal-stagePnl)/v.rr);const remainingGoalRisk=Math.max(0,(goal-stagePnl)/tradeRR);const risk=Math.min(plannedRisk,left,dailyLeft,remainingGoalRisk);
 if(risk<=1e-7){status='closed';break}
 const delta=c==='W'?risk*tradeRR:-risk,tradeDay=day,tradeStage=stage;
 stagePnl+=delta;total+=delta;dayPnl+=delta;dailyTotals[day]=(dailyTotals[day]||0)+delta;bestDay=Math.max(0,...Object.values(dailyTotals));
 if(c==='L')lossesToday++;
 prob*=c==='W'?v.winRate/100:1-v.winRate/100;
 let passed=false;
 if(stagePnl>=Math.max(v.target,v.topstepConsistency?bestDay/(v.consistencyRate/100):goal)-1e-7&&(!v.topstepConsistency||(Object.values(dailyTotals).filter(n=>n>1e-7).length>=2&&bestDay<=stagePnl*(v.consistencyRate/100)+1e-7))){passed=true;if(stage===1&&v.targetMode===2){stage=2;stagePnl=0}else {status='target';/* Final target is terminal: no further trades on this path. */}}
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
function renderRisk(){
const firmForPhases=firmBar.querySelector('[data-firm-type]').value;const expectedPhases=firmForPhases==='ftmo'?'2':'1';if($('[data-target-mode]').value!==expectedPhases)$('[data-target-mode]').value=expectedPhases;
const v=vals(),leaves=[],allPaths=[];Object.assign(v,STRATEGIES[activeStrategy].eval);v.manualRisks=manualConfig();v.manualRRs=manualRRConfig();if(firmForPhases==='topstep'){v.topstepConsistency=true;if(activeStrategy==='current')v.fixedRisk=1000;v.consistencyRate=Math.max(1,Math.min(100,Number(box.querySelector('[data-consistency-limit]')?.value)||55));}
function walk(path){const x=calc(path,v);if(path)allPaths.push(x);if(x.status!=='active'||x.steps.length>=v.depth){leaves.push(x);return}walk(path+'W');walk(path+'L')}
walk('');
const counts={target:0,closed:0,active:0,'daily-blocked':0};leaves.forEach(x=>counts[x.status]++);
const probability=leaves.filter(x=>x.status==='target').reduce((sum,x)=>sum+x.prob,0);
const t1Probability=leaves.filter(x=>x.stage===2||x.status==='target').reduce((sum,x)=>sum+x.prob,0);
const failProbability=leaves.filter(x=>x.status==='closed').reduce((sum,x)=>sum+x.prob,0);
const unresolvedProbability=leaves.filter(x=>x.status==='active'||x.status==='daily-blocked').reduce((sum,x)=>sum+x.prob,0);
const expectedPnl=leaves.reduce((sum,x)=>sum+x.prob*x.pnl,0);
const resolvedProbability=probability+failProbability;
const resolvedPassRate=resolvedProbability>0?probability/resolvedProbability:0;
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
if(firmForPhases==='topstep'&&activeStrategy==='current')fv.fixedRisk=1000;else if(activeStrategy==='current')fv.ftmoFundedBuilder=true;Object.assign(fv,STRATEGIES[activeStrategy].fund);fv.manualRisks=manualConfig();fv.manualRRs=manualRRConfig();fv.manualStage=3;let fp=0,fr=0;const fundedLeaves=[];
if(phaseMode!=='evaluation'){function fw(path){const x=calc(path,fv);if(x.status!=='active'||x.steps.length>=fv.depth){fundedLeaves.push(x);if(x.status==='target')fp+=x.prob;if(x.status==='closed')fr+=x.prob;return}fw(path+'W');fw(path+'L')}fw('')}
if(compareSection.open){const sim=cfg=>{let hit=0,fail=0,ev=0;function go(p){const x=calc(p,cfg);if(x.status!=='active'||x.steps.length>=cfg.depth){if(x.status==='target')hit+=x.prob;if(x.status==='closed')fail+=x.prob;ev+=x.prob*x.pnl;return}go(p+'W');go(p+'L')}go('');return [hit*100,fail*100,ev]};const phases=firmForPhases==='ftmo'?[[1,v.target],[2,v.target2],[3,fv.target]]:[[1,v.target],[3,fv.target]];let rows='';for(const item of phases){const phase=item[0],target=item[1],base=phase===3?fv:v;const common=Object.assign({},base,{targetMode:1,target:target,manualStage:phase,topstepConsistency:phase===1&&firmForPhases==='topstep'});const auto=sim(Object.assign({},common,{manualRisks:{},manualRRs:{}}));const manual=sim(Object.assign({},common,{manualRisks:manualConfig(),manualRRs:manualRRConfig()}));let phaseRows='';for(let i=0;i<3;i++){const diff=manual[i]-auto[i];phaseRows+='<tr><td>'+['Target %','Failure %','EV'][i]+'</td><td>'+manual[i].toFixed(2)+'</td><td>'+auto[i].toFixed(2)+'</td><td class="'+((i===1?diff<0:diff>0)?'jj-risk-win':(i===1?diff>0:diff<0)?'jj-risk-loss':'')+'">'+diff.toFixed(2)+'</td></tr>';;}rows+='<details style="margin:6px 0;padding:8px;border:1px solid #8884;border-radius:7px"><summary style="cursor:pointer;font-weight:700">P'+phase+' · Target '+manual[0].toFixed(1)+'% / '+auto[0].toFixed(1)+'%</summary><div style="overflow-x:auto"><table style="font-size:11px;white-space:nowrap"><thead><tr><th>Metric</th><th>Manual</th><th>Auto</th><th>Δ</th></tr></thead><tbody>'+phaseRows+'</tbody></table></div></details>'; }comparePanel.querySelector('[data-compare]').innerHTML='<div style="font-size:11px;opacity:.7">Green = better · Red = worse · Δ = Manual − Auto</div>'+rows;}
const nn=Math.max(1,Math.min(100,Math.floor(Number($('[data-account-count]').value)||10)));
const totalFees=nn*v.accountCost,expectedFunded=nn*probability,activationFee=Math.max(0,fn('activation',0)),splitPct=Math.max(0,Math.min(1,fn('split',80)/100));
const grossPayout=expectedFunded*fp*fv.target*splitPct,activationFees=expectedFunded*activationFee,netCash=grossPayout-totalFees-activationFees;
const cash=x=>'$'+x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
let mathPanel=box.querySelector('[data-ch09-math]');
if(!mathPanel){
 mathPanel=document.createElement('details');mathPanel.dataset.ch09Math='';
 mathPanel.className='jj-risk-section';
 mathPanel.innerHTML='<summary>12 · Math &amp; Bankroll KPIs</summary><div data-math-cards class="jj-risk-results-grid"></div><small style="opacity:.75">Calculated from Chapter 09 settings. Probabilities use finite simulation depth; historical confidence intervals require observed trade/account records.</small>';
 (box.querySelector('[data-section="funded-paths"]')||box.lastElementChild).after(mathPanel);
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
const metricFund=(label,value,help)=>kpiTooltip(label,value,help);
const fundedCards=metricFund('Funded pass',(fp*100).toFixed(2)+'%','Probability of reaching funded profit target within funded trade depth.')+metricFund('Funded ruin',(fr*100).toFixed(2)+'%','Probability of breaching funded loss allowance within funded trade depth.')+metricFund('Funded unresolved',(Math.max(0,1-fp-fr)*100).toFixed(2)+'%','Probability of still being active after funded simulation depth.')+metricFund('At least 1 funded payout',((1-Math.pow(1-fp,nn))*100).toFixed(2)+'%','Chance at least one of '+nn+' already-funded independent accounts reaches the funded target within the trade depth.')+metricFund('Expected funded successes',(nn*fp).toFixed(2),'Expected number of successful funded accounts from '+nn+' already-funded accounts; this is not a count of evaluation passes.')+metricFund('Expected payout / funded',cash(fp*fv.target*splitPct),'Probability-weighted expected cash payout per funded account, excluding fees and unresolved paths.')+metricFund('Payout per success',cash(fv.target*splitPct),'Cash payout after a successful funded target, before fees.');
$('[data-funded-results]').innerHTML='<div class="jj-risk-results-grid">'+fundedCards+''+'</div><div style="font-size:11px;opacity:.75;margin:5px 0">Finite-depth estimates. Assumes independent accounts, one evaluation stage and one funded payout target. Unresolved paths are not counted as passes. Additional qualification phases, resets and taxes excluded.</div>';

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
const payoutMode=purchaseStrategyMode==='payout';
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
purchaseStrategy.querySelector('[data-purchase-strategy-help]').textContent=payoutMode?
 'Target '+payoutGoal+' projected payout successes; replace failed evaluations AND failed funded accounts. Expected funded attempts: '+(fp>0?(payoutGoal/fp).toFixed(2):'unreachable')+'. Max five Topstep funded accounts active simultaneously; timing is not modeled.':
 replacementMode?'Obtain '+fundedGoal+' funded account'+(fundedGoal===1?'':'s')+' (up to five active Topstep accounts). Payouts are NOT guaranteed in this mode. Select Maximum Funded Limit Payout to replace funded failures.':
 'Purchase '+nn+' evaluations only; no replacements';
const allocationCap=firmType==='ftmo'?nn:Infinity;
const evalPass=probability;
const replacementPurchases=evalPass>0&&(!payoutMode||fp>0)?allocationTarget/evalPass:null;
const replacementFailures=replacementPurchases===null?null:replacementPurchases-allocationTarget;
const replacementEvalFees=replacementPurchases===null?null:replacementPurchases*v.accountCost;
const replacementActivationFees=allocationTarget*activationFee;
const replacementExpectedPayout=allocationTarget*fp*fv.target*splitPct;
const replacementTotalFees=replacementEvalFees===null?null:replacementEvalFees+replacementActivationFees;
const replacementNet=replacementTotalFees===null?null:replacementExpectedPayout-replacementTotalFees;
const modelBuys=replacementMode?replacementPurchases:nn;const modelPassed=replacementMode?(replacementPurchases===null?0:allocationTarget):expectedFunded;const modelFailed=modelBuys===null?null:Math.max(0,modelBuys-modelPassed);const modelFees=modelBuys===null?null:modelBuys*v.accountCost+modelPassed*activationFee;const modelPayout=modelPassed*fp*fv.target*splitPct;const modelNet=modelFees===null?null:modelPayout-modelFees;const modelRoi=modelFees>0?100*modelNet/modelFees:null;const modelSuccess=modelBuys===null?0:modelPassed*fp;const modelPct=modelBuys>0?100*modelPassed/modelBuys:0;const modelCash=x=>x===null?'—':cash(x);const modelPossible=modelBuys!==null;const resultGroup=(heading,cards)=>'<div style="min-width:0;margin:5px 0 9px"><div style="font-size:11px;font-weight:700;opacity:.8;margin:0 0 5px">'+heading+'</div><div class="jj-risk-results-grid">'+cards+'</div></div>';
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
 const test=cfg=>{let pass=0,unresolved=0;const walk=p=>{const x=calc(p,cfg);if(x.status!=='active'||x.steps.length>=cfg.depth){if(x.status==='target')pass+=x.prob;else if(x.status==='active')unresolved+=x.prob;return}walk(p+'W');walk(p+'L')};walk('');return {pass,unresolved}};
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
 const run=cfg=>{let pass=0,fail=0,unresolved=0,success=[];const walk=p=>{const x=calc(p,cfg);if(x.status!=='active'||x.steps.length>=cfg.depth){if(x.status==='target'){pass+=x.prob;success.push(x)}else if(x.status==='closed')fail+=x.prob;else unresolved+=x.prob;return}walk(p+'W');walk(p+'L')};walk('');success.sort((a,b)=>b.prob-a.prob);return {pass,fail,unresolved,success}};
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
$('[data-strategy-panel]').innerHTML=phaseMode==='combined'?'<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:5px 0"><button type="button" data-optimize-risk style="font-size:11px;padding:6px 10px;border-radius:6px;cursor:pointer">Find Better Strategies</button><small style="opacity:.7">Uses current edited parameters</small></div><div data-optimizer-results></div>'+strategyComparison():'<p style="font-size:11px">Select Combined to compare risk strategies.</p>';
box.addEventListener('click',event=>{
 const btn=event.target.closest('[data-opt-path]');if(!btn||!box.contains(btn))return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 const tree=btn.closest('[data-opt-tree]'),parent=btn.closest('[data-opt-node]')||btn.parentElement.parentElement;
 const child=parent.querySelector('[data-opt-children]');if(!tree||!child)return;
 const cfg=JSON.parse(decodeURIComponent(tree.dataset.optCfg)),path=btn.dataset.optPath;
 const x=calc(path,cfg),last=x.steps[x.steps.length-1],next=calc(path+'W',cfg).steps[path.length];
 const risk=next?.risk||0,done=x.status!=='active'||x.steps.length>=cfg.depth||risk<=0;
 const fmt=n=>'$'+Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2});
 child.innerHTML='<div data-opt-node style="margin:5px 0 5px 8px;padding:6px;border-left:2px solid #8885"><b>Trade '+x.steps.length+' · '+(last?.c==='W'?'WIN':'LOSS')+'</b> · Risk '+fmt(last?.risk)+' · P&L '+fmt(last?.stagePnl)+' · DD left '+fmt(cfg.limit+x.stagePnl)+' · Day '+(last?.day||1)+'<div>'+(x.status==='target'?'TARGET REACHED':x.status==='closed'?'ACCOUNT CLOSED':x.steps.length>=cfg.depth?'TRADE LIMIT': 'CONTINUE')+'</div>'+(done?'':'<div>Next risk '+fmt(risk)+' · Win +'+fmt(risk*cfg.rr)+' / Loss −'+fmt(risk)+'</div><div style="display:flex;gap:5px;margin-top:4px"><button type="button" data-opt-path="'+path+'W">If WIN</button><button type="button" data-opt-path="'+path+'L">If LOSS</button></div><div data-opt-children></div>')+'</div>';
},true);
const optimizerButton=box.querySelector('[data-optimize-risk]');if(optimizerButton)optimizerButton.addEventListener('click',()=>{box.querySelector('[data-optimizer-results]').innerHTML=optimizeRiskStrategies()});

const riskPathDetails=(x,kind)=>'<div style="overflow-x:auto"><table style="width:100%;font-size:11px"><thead><tr><th>#</th><th>Phase</th><th>Day</th><th>Trade</th><th>Risk $</th><th>Trade P&L $</th><th>Phase P&L $</th><th>Target</th></tr></thead><tbody>'+x.steps.map((t,i)=>'<tr><td>'+(i+1)+'</td><td>P'+t.stage+'</td><td>'+t.day+'</td><td>'+(t.c==='W'?'Win':'Loss')+'</td><td>'+tableNumber(t.risk)+'</td><td>'+tableNumber(t.c==='W'?t.risk*(kind==='funded'?fv.rr:v.rr):-t.risk)+'</td><td>'+tableNumber(t.stagePnl)+'</td><td>'+(t.passed?'Hit':'—')+'</td></tr>').join('')+'</tbody></table></div>';
const topSuccess=(paths,title,kind)=>{const winning=paths.filter(x=>x.status==='target').sort((a,b)=>b.prob-a.prob||a.steps.length-b.steps.length).slice(0,8);return '<div style="margin:8px 0"><div style="font-size:11px;font-weight:700;margin:4px 0">'+title+'</div>'+(winning.length?'<div style="overflow-x:auto"><table style="font-size:11px;width:100%"><thead><tr><th>W/L path</th><th>Probability</th><th>Trades</th><th>Risk by trade ($)</th><th>Details</th></tr></thead><tbody>'+winning.map((x,i)=>'<tr><td>'+x.path+'</td><td>'+(100*x.prob).toFixed(3)+'%</td><td>'+x.steps.length+'</td><td>'+x.steps.map(t=>Math.round(t.risk*100)/100).join(' → ')+'</td><td><details><summary style="cursor:pointer">View</summary>'+riskPathDetails(x,kind)+'</details></td></tr>').join('')+'</tbody></table></div>':'No target-hit paths at this trade depth')+'</div>'};
$('[data-combined-results]').innerHTML=phaseMode==='combined'?combinedCards+'<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;font-weight:700">Successful paths · exact risk per trade</summary><div style="font-size:11px;opacity:.75;margin:5px 0">These are the eight highest-probability successful paths per stage, not optimized risk recommendations. Each path has its own probability; the overall success rate sums all passing paths.</div>'+topSuccess(leaves,'Evaluation target-hit paths','eval')+topSuccess(fundedLeaves,'Funded target-hit paths','funded')+'</details>':'';
const allocationText='<div class="jj-funnel-portfolio"><strong>'+firmType.toUpperCase()+' · '+(payoutMode?'Payout target replacement':replacementMode?'Funded limit replacement':'Fixed purchase')+' economics</strong><div class="jj-funnel-portfolio-grid"><div><small>Funded target</small><strong>'+(replacementMode?allocationTarget:'Not enforced')+'</strong></div><div><small>Expected evaluation buys</small><strong>'+(modelBuys===null?'—':modelBuys.toFixed(1))+'</strong></div><div><small>Expected failed evaluations</small><strong>'+(modelFailed===null?'—':modelFailed.toFixed(1))+'</strong></div><div><small>Expected fees</small><strong>'+modelCash(modelFees)+'</strong></div><div><small>Expected first payout cash</small><strong>'+cash(modelPayout)+'</strong></div><div><small>Expected net</small><strong>'+modelCash(modelNet)+'</strong></div><div><small>Net ROI on expected fees</small><strong>'+(modelRoi===null?'—':modelRoi.toFixed(1)+'%')+'</strong></div></div><div class="jj-funnel-note">Uses the same '+(replacementMode?'replacement':'fixed-purchase')+' assumptions as section 06. '+(replacementMode?'Expected evaluations = funded target / evaluation pass probability.':'No replacement purchases.')+' FTMO has a shared maximum of 20 simultaneously active P1, P2 and funded accounts, not 20 simultaneous evaluations plus 20 funded. This preview does not enforce the active cap over time, daily signals, minimum days or payout waits. Finite-depth unresolved paths make this an estimate, not a guaranteed outcome.</div></div>';
const portfolioSummary='<div class="jj-funnel-portfolio"><strong>Fixed cohort · '+nn+' purchased accounts (no replacements)</strong><div class="jj-funnel-parallel"></div><div class="jj-funnel-portfolio-grid"><div><small>Total expected trades</small><strong>'+portfolioTrades.toFixed(1)+'</strong></div><div><small>Total account-trading-days</small><strong>'+portfolioDays.toFixed(1)+'</strong></div><div><small>Avg trades / purchase</small><strong>'+(portfolioTrades/nn).toFixed(1)+'</strong></div><div><small>Avg account-days / purchase</small><strong>'+(portfolioDays/nn).toFixed(1)+'</strong></div><div><small>Capacity lower bound (days)</small><strong>'+capacityDays+'</strong></div></div><div class="jj-funnel-note">Challenge: '+portfolioChallengeTrades.toFixed(1)+' trades / '+portfolioChallengeDays.toFixed(1)+' account-days · Funded: '+portfolioFundedTrades.toFixed(1)+' trades / '+portfolioFundedDays.toFixed(1)+' account-days. Includes passed, failed and unresolved paths. Account-days are summed across accounts, not elapsed days. Lower bound = max(ceil(account-trading-days / parallel slots), ceil(expected trades / signals per day)). It is NOT a simulated elapsed schedule: stage sequencing, stop-after-loss, shared signals, minimum days and payout waits can make actual time longer.</div></div>';


/* Stage progression is taken from the same finite-depth challenge paths as the
   evaluation pass rate. P1 pass includes accounts that reached P2 even if they
   later failed or remained unresolved in P2. Topstep has no P2 verification. */
const hasVerification=firmType==='ftmo';
const p1Pass=hasVerification?
 leaves.reduce((sum,path)=>sum+(path.steps.some(step=>step.stage===1&&step.passed)?path.prob:0),0):
 leaves.reduce((sum,path)=>sum+(path.topstepCheckpoint?path.prob:0),0);
const funnelCount=count=>modelBuys===null?'—':count.toFixed(2);
const percent=value=>Number.isFinite(value)?(100*Math.max(0,Math.min(1,value))).toFixed(1)+'%':'—';
const p2Conditional=p1Pass>0?Math.min(1,pEval/p1Pass):null;
const funnelP1=modelBuys===null?null:modelBuys*p1Pass;
const funnelP2=modelBuys===null?null:modelBuys*pEval;
const funnelP3=modelBuys===null?null:modelPassed;
const funnelP4=modelBuys===null?null:modelSuccess;
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
const funnelData=[
 {phase:hasVerification?'P1 · Challenge':'P1 · First profit day',count:funnelP1,rate:p1Pass,total:p1Pass,newCost:evalSpend,unitCost:costPer(evalSpend,funnelP1)},
 {phase:hasVerification?'P2 · Verification':'P2 · Consistency',count:funnelP2,rate:p2Conditional,total:pEval,newCost:0,unitCost:costPer(evalSpend,funnelP2)},
 {phase:'P3 · Funded target passed',count:funnelP4,rate:pFund,total:pEval*pFund,newCost:activationSpend,unitCost:costPer(allSpend,funnelP4)},
 {phase:'P4 · Payout cash · '+modelCash(modelBuys===null?null:modelPayout),count:funnelP4,rate:null,total:null,newCost:0,unitCost:costPer(allSpend,funnelP4)}
];
const reversePayoutPlan=payoutMode?'<div style="margin:8px 0;padding:8px 10px;border:1px solid #8884;border-radius:7px;font-size:11px">'+
 '<strong>Reverse plan · '+payoutGoal+' projected payouts</strong>'+
 '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:7px">'+
 '<div><small>P4 · Payouts</small><div style="font-weight:700">'+(modelBuys===null?'—':modelSuccess.toFixed(2))+'</div></div>'+
 '<div><small>Funded attempts required</small><div style="font-weight:700">'+(modelBuys===null?'—':modelPassed.toFixed(2))+'</div></div>'+
 '<div><small>P2 · Eval passed</small><div style="font-weight:700">'+(modelBuys===null?'—':(modelBuys*pEval).toFixed(2))+'</div></div>'+
 '<div><small>Evaluations to buy</small><div style="font-weight:700">'+funnelCount(modelBuys)+'</div></div>'+
 '</div>'+
 '<div style="margin-top:6px;opacity:.8">Funded success '+percent(pFund)+' · Evaluation pass '+percent(pEval)+
 ' · Expected funded failures '+(modelBuys===null?'—':Math.max(0,modelPassed-modelSuccess).toFixed(2))+
 ' · Expected evaluation failures '+(modelBuys===null?'—':Math.max(0,modelBuys-modelPassed).toFixed(2))+'</div>'+
 '<div style="opacity:.75;margin-top:4px">Calculated backward: payouts ÷ funded success rate = funded attempts; funded attempts ÷ evaluation pass rate = evaluations purchased. More than five cumulative funded attempts may be needed. Topstep five active slots only limits simultaneous positions; no scheduling is modeled.</div></div>':'';
const rows=funnelData.map(x=>'<tr><td style="text-align:left;white-space:nowrap" title="'+(x.phase.startsWith('P4')?'Projected payout after funded success, not confirmed cash withdrawal':'')+'">'+x.phase+'</td>'+
 '<td style="text-align:right;font-variant-numeric:tabular-nums">'+(x.count===null?'—':funnelCount(x.count))+'</td>'+
 '<td style="text-align:right;font-variant-numeric:tabular-nums">'+(x.rate===null?'—':percent(x.rate))+'</td>'+
 '<td style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums">'+(x.total===null?'—':percent(x.total))+'</td>'+
 '<td style="text-align:right;font-variant-numeric:tabular-nums" title="New fees incurred at this stage for the modeled cohort">'+modelCash(x.newCost)+'</td>'+
 '<td style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums" title="Cumulative fees spent divided by expected accounts achieving this stage">'+x.unitCost+'</td></tr>').join('');
$('[data-funnel]').innerHTML='<div class="jj-funnel-wrap">'+
 '<div class="jj-funnel-note"><strong>'+(payoutMode?'Target '+payoutGoal+' projected payouts':replacementMode?'Target funded accounts':'Fixed cohort')+
 '</strong> · Start: '+funnelCount(modelBuys)+' evaluations · Fee: '+modelCash(modelBuys===null?null:modelBuys*v.accountCost)+'</div>'+reversePayoutPlan+
 '<div style="width:100%;overflow-x:auto"><table style="width:100%;font-size:11px;table-layout:auto"><thead><tr><th style="text-align:left">Phase</th><th style="text-align:right">Accounts</th><th style="text-align:right">Pass %</th><th style="text-align:right">Total %</th><th style="text-align:right" title="New expected fees incurred at this stage">Stage $</th><th style="text-align:right" title="Cumulative fees per expected successful account at this stage">Cost / result</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 (replacementMode?'':portfolioSummary)+
 '<div class="jj-funnel-summary"><span>Expected payout <strong>'+modelCash(modelPayout)+'</strong></span><span>Net <strong>'+modelCash(modelNet)+'</strong></span><span>ROI <strong>'+(modelRoi===null?'—':modelRoi.toFixed(1)+'%')+'</strong></span></div>'+
 '<div class="jj-funnel-note">'+
 (payoutMode?'To target '+payoutGoal+' projected payouts, funded attempts = '+payoutGoal+' / funded success probability and purchased evaluations = funded attempts / evaluation pass probability. Replace failed funded accounts with newly qualified accounts until the expected payout target is reached. ':'')+
 'Expected funded attempts entering P3: <strong>'+(modelBuys===null?'—':modelPassed.toFixed(2))+'</strong> · Estimated funded failures before reaching target: <strong>'+(modelBuys===null?'—':Math.max(0,modelPassed-modelSuccess).toFixed(2))+'</strong> · Evaluation failures: <strong>'+(modelBuys===null?'—':Math.max(0,modelBuys-modelPassed).toFixed(2))+'</strong>. '+
 'Pass % is conditional at the stage; Total % is cumulative from each purchased evaluation. P2 completion creates funded attempts; P3 applies the ACTUAL funded target success rate, never an automatic 100% pass. P4 converts those same target successes into projected payout cash without another independent pass rate. '+
 'Stage $ includes only newly incurred evaluation or activation fees; Cost / result includes those fees from failed accounts. '+
 'Payouts are projections, not confirmed withdrawals. Firm capacity, payout eligibility, payment waiting times and correlated trades are not simulated.</div></div>';
if(!replacementMode)$('[data-funnel]').querySelector('.jj-funnel-parallel').append(Object.assign(document.createElement('label'),{textContent:'Parallel active accounts  '}),parallelInput);
const funnelControls=$('[data-funnel]').querySelector('.jj-funnel-parallel');if(funnelControls)funnelControls.style.cssText='display:flex;gap:10px;flex-wrap:wrap;align-items:center';const signalLabel=document.createElement('label');signalLabel.textContent='Signals / day  ';signalLabel.append(signalsInput);if(funnelControls)funnelControls.append(signalLabel);
const consistencyHost=$('[data-consistency-panel]');if(consistencyHost){const topstep=firmType==='topstep';const toggle=$('[data-consistency-enabled]');consistencyToggle.style.display=topstep?'flex':'none';let consistencySettings={};try{consistencySettings=JSON.parse(localStorage.getItem(consistencyKey)||'{}')||{}}catch(e){}toggle.checked=consistencySettings.enabled!==false;consistencyHost.style.display=topstep&&toggle.checked?'':'none';if(topstep&&toggle.checked){const safeText=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let state={limit:55,days:'1500,1500'};try{state={...state,...JSON.parse(localStorage.getItem(consistencyKey)||'{}')}}catch(e){}const rate=Math.max(1,Math.min(100,Number(state.limit)||55));const days=String(state.days||'').split(/[;,\\s]+/).map(Number).filter(Number.isFinite);const total=days.reduce((a,b)=>a+b,0);const best=Math.max(0,...days);const actual=total>0?100*best/total:0;const adjusted=Math.max(v.target,best/(rate/100));const extra=Math.max(0,adjusted-total);const pass=total>=v.target-1e-7&&total>0&&actual<=rate+1e-7;const status=pass?'Passed':total<=0?'No positive profit yet':'Needs more profit';consistencyHost.innerHTML='<div class="jj-funnel-portfolio"><strong>Topstep · Daily profit consistency</strong><div class="jj-risk-fields"><label>Consistency max (%)<input data-consistency-limit type="number" min="1" max="100" step="0.1" value="'+rate+'"></label><label>Daily net P&L ($, comma separated)<input data-consistency-days type="text" value="'+safeText(state.days)+'" placeholder="1500, 1500"></label></div><div class="jj-funnel-portfolio-grid"><div><small>Evaluation target</small><strong>'+cash(v.target)+'</strong></div><div><small>Total net profit</small><strong>'+cash(total)+'</strong></div><div><small>Best profitable day</small><strong>'+cash(best)+'</strong></div><div><small>Current consistency</small><strong>'+actual.toFixed(1)+'%</strong></div><div><small>Adjusted profit target</small><strong>'+cash(adjusted)+'</strong></div><div><small>Additional profit needed</small><strong>'+cash(extra)+'</strong></div><div><small>Result</small><strong>'+status+'</strong></div></div><div class="jj-funnel-note">Daily net P&L may include losses. Pass requires total profit at least the base target and best profitable day / total profit no more than the consistency limit. This independent calculator does not yet change the existing scenario-path pass probability or model drawdown.</div></div>'}}
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
const fundedPrefixes=new Set(['']);fundedLeaves.forEach(x=>{for(let i=1;i<x.path.length;i++)fundedPrefixes.add(x.path.slice(0,i))});const fundedDecisions=[...fundedPrefixes].map(p=>calc(p,fv)).filter(x=>x.status==='active'&&x.steps.length<fv.depth).map(x=>({...x,win:calc(x.path+'W',fv),loss:calc(x.path+'L',fv)}));
const fundedShown=fundedDecisions.filter(x=>fundedFilter==='all'||fundedFilter==='active'||x.win.status===fundedFilter||x.loss.status===fundedFilter).sort((a,b)=>a.steps.length-b.steps.length||a.path.localeCompare(b.path));
fundedPage=Math.min(fundedPage,Math.max(0,Math.ceil(fundedShown.length/10)-1));
$('[data-funded-path-count]').textContent=fundedShown.length+' decision points · '+(fundedShown.reduce((a,x)=>a+x.prob,0)*100).toFixed(2)+'% cumulative path probability (overlapping prefixes)';
$('[data-funded-path-table]').innerHTML='<div style="overflow-x:auto"><table><thead><tr><th>Path</th><th>Chance %</th><th>Risk</th><th>If WIN</th><th>If LOSS</th><th>P&L</th><th>Details</th></tr></thead><tbody>'+fundedShown.slice(fundedPage*10,fundedPage*10+10).map(x=>{
 const open=expandedFunded.has(x.path);
 const winStep=x.win.steps[x.steps.length],lossStep=x.loss.steps[x.steps.length];
 const risk=winStep?.risk??lossStep?.risk??0;
 const detail='<div style="padding:6px"><strong>Path '+(x.path||'Start')+'</strong> · P3 Funded · Target '+tableNumber(fv.target)+' · RR '+fv.rr+' · Next risk '+tableNumber(risk)+' · Day '+x.day+'</div><div style="overflow-x:auto"><table><thead><tr><th>Trade</th><th>Day</th><th>Risk</th><th>Stage P&L</th><th>Daily left</th><th>Result</th></tr></thead><tbody>'+x.steps.map((t,i)=>'<tr><td class="'+(t.c==='W'?'jj-risk-win':'jj-risk-loss')+'">'+(i+1)+' '+(t.c==='W'?'WIN':'LOSS')+'</td><td>'+t.day+'</td><td>'+tableNumber(t.risk)+'</td><td>'+tableNumber(t.stagePnl)+'</td><td>'+tableNumber(t.dailyLeft)+'</td><td class="'+(t.passed?'jj-risk-win':'')+'">'+(t.passed?'TARGET HIT':'')+'</td></tr>').join('')+'</tbody></table></div><p style="font-size:11px">Next WIN: '+tableNumber(x.win.pnl)+' ('+x.win.status+') · Next LOSS: '+tableNumber(x.loss.pnl)+' ('+x.loss.status+')</p>';
 return '<tr><td>'+(x.path||'Start')+'</td><td>'+(x.prob*100).toFixed(2)+'%</td><td>'+tableNumber(risk)+'</td><td class="'+(x.win.status==='target'?'jj-risk-win':'')+'">'+tableNumber(x.win.pnl)+'</td><td class="'+(x.loss.status==='closed'?'jj-risk-loss':'')+'">'+tableNumber(x.loss.pnl)+'</td><td class="'+(x.pnl>0?'jj-risk-win':x.pnl<0?'jj-risk-loss':'')+'">'+tableNumber(x.pnl)+'</td><td><button type="button" data-funded-expand="'+x.path+'">'+(open?'▾':'▸')+' View</button></td></tr>'+(open?'<tr><td colspan="7">'+detail+'</td></tr>':'');
}).join('')+'</tbody></table></div>';
$('[data-funded-page]').textContent=fundedShown.length?(fundedPage*10+1)+'–'+Math.min(fundedShown.length,(fundedPage+1)*10)+' / '+fundedShown.length:'0';
$('[data-funded-prev]').disabled=fundedPage===0;$('[data-funded-next]').disabled=(fundedPage+1)*10>=fundedShown.length;
const filter=$('[data-filter]').value;
const decisions=[calc('',v),...allPaths].filter(x=>x.status==='active'&&x.steps.length<v.depth).map(x=>{const win=calc(x.path+'W',v),loss=calc(x.path+'L',v);return {...x,win,loss,nextRisk:win.steps[x.steps.length]?.risk??loss.steps[x.steps.length]?.risk??0}}).filter(x=>x.nextRisk>0);
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
const detail='<div style="padding:6px 0"><strong>Path '+(x.path||'Start')+'</strong> · Total P&L '+tableNumber(x.pnl)+' · Stage T'+x.stage+' · '+(terminal?'Stopped: '+(x.status==='target'?'target reached':x.status):'Next risk '+tableNumber(x.nextRisk))+' · Day '+x.day+' · Daily loss remaining '+tableNumber(x.dailyLeft)+'</div>'+stageRows+(terminal?'<div style="padding-top:6px"><strong>No further trades in this path.</strong></div>':'<div style="padding-top:6px">Next Win: '+tableNumber(x.win.pnl)+' · Next Loss: '+tableNumber(x.loss.pnl)+'</div>');
return '<tr><td><button class="jj-risk-path" data-path="'+x.path+'">'+(x.path||'Start')+'</button></td><td>'+((x.prob||0)*100).toFixed(2)+'%</td><td>T'+x.stage+'</td><td>'+(terminal?'Stopped':tableNumber(x.nextRisk))+'</td><td class="'+(!terminal&&x.win.status==='target'?'jj-risk-win':'')+'">'+(terminal?'—':tableNumber(x.win.pnl))+'</td><td class="'+(!terminal&&x.loss.status==='closed'?'jj-risk-loss':'')+'">'+(terminal?'—':tableNumber(x.loss.pnl))+'</td><td>'+tableNumber(x.pnl)+(terminal?' · '+(x.status==='target'?'PASS':x.status==='closed'?'FAIL':'DAY BLOCK'):'')+'</td><td><button data-expand-path="'+x.path+'" aria-expanded="'+isOpen+'">'+(isOpen?'Hide':'Show')+'</button></td></tr>'+(isOpen?'<tr><td colspan="8" class="jj-risk-muted" style="text-align:left;white-space:normal;padding:8px">'+detail+'</td></tr>':'');
}).join('')+'</tbody></table></div>';
$('[data-count]').textContent=shown.length?(page*10+1)+'–'+Math.min((page+1)*10,shown.length)+' / '+shown.length:'0 paths';
$('[data-prev]').disabled=page===0;$('[data-next]').disabled=(page+1)*10>=shown.length;
}
box.addEventListener('change',e=>{if(e.target.matches('[data-consistency-enabled]')){let old={};try{old=JSON.parse(localStorage.getItem(consistencyKey)||'{}')||{}}catch(x){}old.enabled=e.target.checked;try{localStorage.setItem(consistencyKey,JSON.stringify(old))}catch(x){}renderRisk()}});
box.addEventListener('change',e=>{if(e.target.matches('[data-consistency-limit],[data-consistency-days]')){const old=(()=>{try{return JSON.parse(localStorage.getItem(consistencyKey)||'{}')}catch(x){return {}}})();if(e.target.matches('[data-consistency-limit]'))old.limit=e.target.value;else old.days=e.target.value;try{localStorage.setItem(consistencyKey,JSON.stringify(old))}catch(x){}renderRisk()}});
box.addEventListener('input',e=>{if(e.target.matches('[data-k],[data-account-count],[data-funded]')){page=0;saveSettings();renderRisk()}});
box.addEventListener('change',e=>{if(e.target.matches('[data-funded-path-filter]')){fundedPage=0;expandedFunded.clear();renderRisk()}});
box.addEventListener('change',e=>{if(e.target.matches('[data-filter]')){page=0;expandedPaths.clear();renderRisk()}});
box.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;if(btn.hasAttribute('data-optimize-risk'))return;if(btn.hasAttribute('data-funded-expand')){const key=btn.dataset.fundedExpand;if(expandedFunded.has(key))expandedFunded.delete(key);else expandedFunded.add(key);renderRisk();return}if(btn.hasAttribute('data-funded-prev')){fundedPage=Math.max(0,fundedPage-1);renderRisk();return}if(btn.hasAttribute('data-funded-next')){fundedPage++;renderRisk();return}if(btn.hasAttribute('data-phase')){phaseMode=btn.dataset.phase;saveSettings()}else if(btn.hasAttribute('data-account-mode')){accountMode=btn.dataset.accountMode;saveSettings()}else if(btn.hasAttribute('data-mode-button')){box.querySelector('[data-target-mode]').value=btn.dataset.modeButton;page=0;expandedPaths.clear();saveSettings()}else if(btn.hasAttribute('data-expand-path')||btn.hasAttribute('data-path')){const key=btn.hasAttribute('data-expand-path')?btn.dataset.expandPath:btn.dataset.path;if(expandedPaths.has(key))expandedPaths.delete(key);else expandedPaths.add(key)}else if(btn.hasAttribute('data-prev'))page--;else if(btn.hasAttribute('data-next'))page++;renderRisk()});
renderRisk();
}
const original=render;render=function(){original();if(active===slug)mount()};if(new URLSearchParams(location.search).get('topic')===slug||(!new URLSearchParams(location.search).get('topic')&&(()=>{try{return localStorage.getItem('jj-academy-last-page-v1')===slug}catch(e){return false}})())){active=slug;try{localStorage.setItem('jj-academy-last-page-v1',slug)}catch(e){}}if(typeof jjRebuildMobileSelector==='function')jjRebuildMobileSelector();renderNav();render();
})();
