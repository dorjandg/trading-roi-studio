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
if(deep===slug)active=slug;
if(typeof jjRebuildMobileSelector==='function')jjRebuildMobileSelector();
renderNav();
render();
})();


/* Dynamic risk scenario explorer: independent, editable trading mathematics model. */
(function(){
'use strict';
const slug='calc-risk-scenarios';
if(!chapters.some(c=>c.slug===slug))chapters.push({slug,group:'Calculators & Simulations',title:'Dynamic Risk Scenario Calculator',intro:'Explore all win/loss sequences until the profit target is hit or remaining loss allowance falls below the stop threshold. This is an independent mathematical model, not a JJ course rule.',status:'Interactive calculator · illustrative',sections:[{title:'Risk and stopping rules',points:['Each stage calculates risk from its own target and stage P&L. After T1 passes, T2 starts with a fresh loss allowance while total profit remains accumulated.','A win adds risk multiplied by reward multiple; a loss subtracts risk. Stop immediately at the target or if remaining loss allowance falls below the closing threshold.','Active paths at the selected trade depth are unfinished, not failures. Select one and extend it by Win or Loss.','Probability estimates assume independent trades at the editable win rate. They do not account for fees, slippage, drawdown equity rules or actual market execution.'],src:[]}]});
if(!curriculum.some(c=>c.slug===slug))curriculum.push({slug,title:'Dynamic Risk Scenario Calculator',status:'review',reason:'User-defined risk scenario model; not attributed to JJ.'});
/* Place immediately after chapter 08 in the existing numbered sidebar/dashboard/mobile navigation. */
if(typeof jjCategoryOverrides!=='undefined')jjCategoryOverrides[slug]='Calculators & Simulations';
if(typeof jjPreferredChapterOrder!=='undefined'){const order=jjPreferredChapterOrder['Calculators & Simulations'];if(Array.isArray(order)&&!order.includes(slug)){const idx=order.indexOf('calc-prop-vs-live');order.splice(idx<0?order.length:idx+1,0,slug)}}
const style=document.createElement('style');style.textContent='.jj-risk-workbench{margin:12px 0;padding:12px;border:1px solid var(--border,#64748b55);border-radius:12px}.jj-risk-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.jj-risk-fields label{font-size:12px;display:grid;gap:4px}.jj-risk-fields input{width:100%;min-width:0;box-sizing:border-box;padding:8px;border:1px solid #8886;border-radius:7px;background:var(--card,var(--bg,#fff));color:inherit}.jj-risk-kpis,.jj-risk-results-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin:5px 0}.jj-risk-kpis>div,.jj-risk-results-grid>div{min-width:0;padding:5px 6px;background:var(--bg,#8881);border-radius:5px;font-size:10px;line-height:1.25;overflow-wrap:anywhere}.jj-risk-kpis strong,.jj-risk-results-grid strong{display:block;font-size:13px;line-height:1.3;margin-top:2px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}@media(min-width:640px){.jj-risk-kpis,.jj-risk-results-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}.jj-risk-kpis>div,.jj-risk-results-grid>div{padding:6px 7px}}.jj-kpi-help{position:relative;cursor:help;outline-offset:2px}.jj-kpi-tooltip{display:none;position:absolute;z-index:90;left:0;top:calc(100% + 5px);width:max-content;max-width:min(270px,75vw);white-space:normal;overflow-wrap:break-word;background:var(--card,#202631);color:var(--text,#fff);border:1px solid #8888;box-shadow:0 5px 16px #0003;border-radius:7px;padding:9px;font-size:12px;line-height:1.4;font-weight:400}.jj-kpi-help:hover .jj-kpi-tooltip,.jj-kpi-help:focus .jj-kpi-tooltip,.jj-kpi-help:focus-within .jj-kpi-tooltip{display:block}.jj-kpi-help:nth-child(3n) .jj-kpi-tooltip{left:auto;right:0}@media(min-width:640px){.jj-kpi-help:nth-child(3n) .jj-kpi-tooltip{left:0;right:auto}.jj-kpi-help:nth-child(5n) .jj-kpi-tooltip{left:auto;right:0}}.jj-risk-workbench button{cursor:pointer;padding:7px 10px;border-radius:7px;border:1px solid #8887;background:transparent;color:inherit}.jj-risk-workbench button:disabled{opacity:.4}.jj-risk-actions{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}.jj-risk-workbench table{width:100%;border-collapse:collapse;font-size:12px}.jj-risk-workbench th,.jj-risk-workbench td{padding:7px 4px;border-bottom:1px solid #8883;text-align:right}.jj-risk-workbench th:first-child,.jj-risk-workbench td:first-child{text-align:left}.jj-risk-workbench [data-table] table{font-variant-numeric:tabular-nums;white-space:nowrap}.jj-risk-workbench [data-table] th,.jj-risk-workbench [data-table] td{padding:5px 3px}.jj-risk-win{color:#00df83!important;font-weight:800}.jj-risk-loss{color:#f05b65!important;font-weight:750}.jj-risk-muted{opacity:.7;font-size:12px}.jj-risk-workbench select{max-width:100%;padding:6px;border-radius:6px;background:transparent;color:inherit}.jj-risk-workbench .jj-risk-path{font-weight:700;text-decoration:underline;text-underline-offset:3px}.jj-risk-workbench .jj-risk-page{display:flex;justify-content:space-between;align-items:center;margin-top:8px}@media(max-width:520px){.jj-risk-workbench{padding:9px}.jj-risk-kpis strong{font-size:16px}.jj-risk-workbench th,.jj-risk-workbench td{font-size:11px;padding:6px 2px}}';style.textContent+=' .jj-risk-section{border:1px solid var(--border,#64748b55);border-radius:8px;margin:6px 0;overflow:visible}.jj-risk-section>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;padding:9px 10px;font-size:12px;font-weight:700}.jj-risk-section>summary::-webkit-details-marker{display:none}.jj-risk-section>summary:before{content:"▸";font-size:13px;display:inline-block;transition:transform .12s}.jj-risk-section[open]>summary:before{transform:rotate(90deg)}.jj-risk-section-body{padding:0 9px 9px}.jj-risk-section:not([open]) .jj-risk-section-body{display:none}';style.textContent+=' .jj-risk-chevron{display:inline-block!important;flex:0 0 14px;font-size:15px!important;line-height:1!important;color:currentColor!important;opacity:1!important;transform:rotate(0deg);transition:transform .15s}.jj-risk-section[open]>summary .jj-risk-chevron{transform:rotate(90deg)}.jj-risk-section>summary:before{content:none!important}';document.head.append(style);
const money=x=>(x<0?'−':x>0?'+':'')+'$'+Math.abs(x).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const tableNumber=x=>(x<0?'-':'')+Math.abs(x).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function mount(){
const root=document.querySelector('#'+slug);if(!root||root.querySelector('.jj-risk-workbench'))return;
const box=document.createElement('div');box.className='jj-risk-workbench';box.innerHTML='<h3>Dynamic Risk · Scenario Explorer</h3><div class="jj-risk-mode" style="display:flex;gap:5px;margin:8px 0"><button type="button" data-phase="evaluation" style="flex:1">Evaluation</button><button type="button" data-phase="funded" style="flex:1">Funded</button><button type="button" data-phase="combined" style="flex:1">Combined</button></div><div class="jj-risk-mode" role="group" aria-label="Target mode" style="display:flex;gap:6px;margin:8px 0 12px"><button type="button" data-mode-button="1" aria-pressed="true" style="flex:1">1 Target</button><button type="button" data-mode-button="2" aria-pressed="false" style="flex:1">2 Targets</button></div><input type="hidden" data-target-mode value="1"><div class="jj-risk-fields" data-risk-fields><label data-target1-field>Target 1 ($)<input data-k="target" type="number" min=".01" step="any" value="1000"></label><label>Win rate (%)<input data-k="winRate" type="number" min="0" max="100" value="50"></label><label>Loss allowance per stage ($)<input data-k="limit" type="number" min=".01" step="any" value="1000"></label><label>Maximum daily loss ($)<input data-k="dailyLimit" type="number" min=".01" step="any" value="500"></label><label>Losses per day<input data-k="tradesPerDay" type="number" min="1" max="100" step="1" value="3"></label><label>Risk reward (1:R)<input data-k="rr" type="number" min=".01" step="any" value="3"></label><label>Close if allowance below ($)<input data-k="floor" type="number" min="0" step="any" value="100"></label><label>Scenario depth (1–12)<input data-k="depth" type="number" min="1" max="12" value="6"></label><label data-target2-field>Target 2 ($)<input data-k="target2" type="number" min=".01" step="any" value="500"></label></div><div class="jj-risk-mode" style="display:flex;gap:6px;margin:8px 0"><button type="button" data-account-mode="single" aria-pressed="true" style="flex:1">1 Account</button><button type="button" data-account-mode="multi" aria-pressed="false" style="flex:1">Multiple Accounts</button></div><div data-multi-controls style="display:none;margin:6px 0"><label style="display:block;font-size:12px">Number of accounts <input data-account-count type="number" min="2" max="100" step="1" value="10" style="width:76px;padding:5px;margin-left:7px"></label><div style="font-size:11px;opacity:.75;margin-top:4px">Assumes independent challenge outcomes, not copied trades. Passing a target does not automatically mean funded status.</div></div><div style="margin:7px 0"><label style="display:flex;align-items:center;gap:8px;font-size:12px">Evaluation purchase fee ($) <input data-k="accountCost" type="number" min="0" step="0.01" value="100" style="width:100px;max-width:42%;padding:5px;border:1px solid #8886;border-radius:6px;background:var(--card,var(--bg,#fff));color:inherit"></label></div><div data-funded-fields style="display:none"><div class="jj-risk-fields"><label>Funded target ($)<input data-funded="target" type="number" value="4000"></label><label>Funded win rate (%)<input data-funded="winRate" type="number" value="50"></label><label>Funded RR<input data-funded="rr" type="number" value="3"></label><label>Funded loss allowance ($)<input data-funded="limit" type="number" value="2000"></label><label>Funded daily loss ($)<input data-funded="dailyLimit" type="number" value="1000"></label><label>Funded losses per day<input data-funded="tradesPerDay" type="number" value="3"></label><label>Funded minimum allowance ($)<input data-funded="floor" type="number" value="100"></label><label>Funded depth<input data-funded="depth" type="number" value="6"></label><label>Payout split (%)<input data-funded="split" type="number" value="80"></label><label>Activation fee ($)<input data-funded="activation" type="number" value="0"></label></div></div><div data-funded-results></div><div class="jj-risk-kpis" data-kpis></div><div data-multi-results style="display:none"></div><div data-prob-results style="margin:8px 0"></div><div class="jj-risk-muted" data-prob></div><h4>All scenario paths</h4><select data-filter><option value="all">All paths</option><option value="target">Pass</option><option value="closed">Fail</option><option value="active">Active</option><option value="daily-blocked">Day Block</option></select><div data-table></div><div class="jj-risk-page"><button data-prev>Previous</button><span data-count></span><button data-next>Next</button></div><p class="jj-risk-muted">Illustrative only. Full remaining allowance can breach prop-firm equity limits once spreads, commissions or slippage are included. No order placement.</p>';
const section=root.querySelector('.chapter-content')||root.querySelector('.sections')||root;section.prepend(box);

const group=(id,label,nodes,open=false)=>{const d=document.createElement('details');d.className='jj-risk-section';d.dataset.section=id;d.open=open;const summary=document.createElement('summary');summary.textContent=label;const arrow=document.createElement('span');arrow.className='jj-risk-chevron';arrow.setAttribute('aria-hidden','true');arrow.textContent='▸';summary.prepend(arrow);d.append(summary);const body=document.createElement('div');body.className='jj-risk-section-body';d.append(body);nodes[0].before(d);nodes.forEach(n=>body.append(n));return d};
const targetModeBar=box.querySelector('[aria-label="Target mode"]');
const accountBar=box.querySelector('[data-account-mode="single"]').parentElement;
const feeBar=box.querySelector('[data-k="accountCost"]').closest('div');
group('challenge-settings','01 · Challenge · Parameters',[targetModeBar,box.querySelector('[data-target-mode]'),box.querySelector('[data-risk-fields]'),accountBar,box.querySelector('[data-multi-controls]'),feeBar]);
group('funded-settings','02 · Funded · Parameters',[box.querySelector('[data-funded-fields]')]);
group('funded-results','04 · Funded · Results',[box.querySelector('[data-funded-results]')]);
group('challenge-results','03 · Challenge · Results',[box.querySelector('[data-kpis]'),box.querySelector('[data-multi-results]'),box.querySelector('[data-prob-results]'),box.querySelector('[data-prob]')]);
// Results order: Challenge, Funded, Combined (preserve existing nodes and saved disclosure states).
box.querySelector('[data-section="funded-results"]').before(box.querySelector('[data-section="challenge-results"]'));
const combined=document.createElement('div');combined.dataset.combinedResults='';
box.querySelector('[data-section="funded-results"]').after(combined);
group('combined-results','05 · Combined · Final Results',[combined]);
const title=Array.from(box.querySelectorAll('h4')).find(x=>x.textContent.includes('All scenario paths'));
if(title){const nodes=[];let n=title;while(n&&n.tagName!=='P'){nodes.push(n);n=n.nextElementSibling}group('paths','06 · Challenge · Scenario Paths',nodes)}
try{const saved=JSON.parse(localStorage.getItem('jj-risk-calculator09-sections-v1')||'{}');box.querySelectorAll('.jj-risk-section').forEach(d=>{if(typeof saved[d.dataset.section]==='boolean')d.open=saved[d.dataset.section]})}catch(e){}
box.addEventListener('toggle',e=>{if(!e.target.matches||!e.target.matches('.jj-risk-section'))return;try{const state={};box.querySelectorAll('.jj-risk-section').forEach(d=>state[d.dataset.section]=d.open);localStorage.setItem('jj-risk-calculator09-sections-v1',JSON.stringify(state))}catch(err){}},true);
const $=q=>box.querySelector(q);let page=0;const expandedPaths=new Set();
const settingsKey='jj-risk-calculator09-settings-v1';let accountMode='single';let phaseMode='evaluation';
function saveSettings(){try{const data={mode:$('[data-target-mode]').value,fields:{},accountMode,accountCount:$('[data-account-count]').value,phaseMode,funded:{}};box.querySelectorAll('[data-funded]').forEach(el=>data.funded[el.dataset.funded]=el.value);box.querySelectorAll('[data-k]').forEach(el=>{data.fields[el.dataset.k]=el.value});localStorage.setItem(settingsKey,JSON.stringify(data))}catch(err){}}
function restoreSettings(){try{const data=JSON.parse(localStorage.getItem(settingsKey)||'null');if(!data||typeof data!=='object')return;if(data.accountMode==='multi')accountMode='multi';if(['evaluation','funded','combined'].includes(data.phaseMode))phaseMode=data.phaseMode;if(data.funded)box.querySelectorAll('[data-funded]').forEach(el=>{const x=data.funded[el.dataset.funded];if(x!==undefined&&Number.isFinite(Number(x)))el.value=String(x)});if(Number.isFinite(Number(data.accountCount)))$('[data-account-count]').value=String(Math.max(2,Math.min(100,Math.floor(Number(data.accountCount)))));if(data.mode==='1'||data.mode==='2')$('[data-target-mode]').value=data.mode;if(data.fields&&typeof data.fields==='object'){box.querySelectorAll('[data-k]').forEach(el=>{const value=data.fields[el.dataset.k];if(value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value)))el.value=String(value)})}}catch(err){}}
restoreSettings();
const vals=()=>{const num=(k,f)=>{const x=Number(box.querySelector('[data-k="'+k+'"]').value);return Number.isFinite(x)?x:f};return {targetMode:box.querySelector('[data-target-mode]').value==='1'?1:2,target:Math.max(.01,num('target',1000)),target2:Math.max(.01,num('target2',500)),limit:Math.max(.01,num('limit',1000)),dailyLimit:Math.max(.01,num('dailyLimit',500)),tradesPerDay:Math.max(1,Math.min(100,Math.floor(num('tradesPerDay',3)))),rr:Math.max(.01,num('rr',3)),floor:Math.max(0,num('floor',100)),winRate:Math.min(100,Math.max(0,num('winRate',50))),accountCost:Math.max(0,num('accountCost',100)),depth:Math.max(1,Math.min(12,Math.floor(num('depth',6))))}};
function calc(path,v){
let stage=1,stagePnl=0,total=0,prob=1,steps=[],status='active',day=1,dayPnl=0,lossesToday=0;
for(const c of path){
 if(status!=='active')break;
 // A negative day, exhausted daily drawdown, or the loss-count cap closes that day.
 // The next simulated trade belongs to the following day, not the stopped day.
 if(dayPnl<-1e-7||lossesToday>=v.tradesPerDay||v.dailyLimit+dayPnl<=1e-7){day++;dayPnl=0;lossesToday=0}
 const left=v.limit+stagePnl,goal=stage===1?v.target:v.target2;
 const dailyLeft=Math.max(0,Math.min(v.dailyLimit,v.dailyLimit+dayPnl));
 if(left<v.floor-1e-7||left<=1e-7){status='closed';break}
 const risk=Math.min((goal-stagePnl)/v.rr,left,dailyLeft);
 if(risk<=1e-7){status='closed';break}
 const delta=c==='W'?risk*v.rr:-risk,tradeDay=day,tradeStage=stage;
 stagePnl+=delta;total+=delta;dayPnl+=delta;
 if(c==='L')lossesToday++;
 prob*=c==='W'?v.winRate/100:1-v.winRate/100;
 let passed=false;
 if(stagePnl>=goal-1e-7){passed=true;if(stage===1&&v.targetMode===2){stage=2;stagePnl=0}else status='target'}
 else if(v.limit+stagePnl<v.floor-1e-7||v.limit+stagePnl<=1e-7)status='closed';
 steps.push({c,risk,pnl:total,stage:tradeStage,stagePnl:passed?goal:stagePnl,passed,day:tradeDay,dayPnl,lossesToday,dailyLeft:Math.max(0,Math.min(v.dailyLimit,v.dailyLimit+dayPnl))});
}
const left=v.limit+stagePnl,goal=stage===1?v.target:v.target2;
if(status==='active'&&(left<v.floor-1e-7||left<=1e-7))status='closed';
const nextDay=dayPnl<-1e-7||lossesToday>=v.tradesPerDay||v.dailyLimit+dayPnl<=1e-7;
const nextDailyLeft=nextDay?v.dailyLimit:Math.max(0,Math.min(v.dailyLimit,v.dailyLimit+dayPnl));
return {path:steps.map(x=>x.c).join(''),pnl:total,stage,stagePnl,left,status,
risk:status==='active'?Math.max(0,Math.min((goal-stagePnl)/v.rr,left,nextDailyLeft)):0,
steps,prob,day:day+(nextDay?1:0),dailyLeft:nextDailyLeft,dayPnl:nextDay?0:dayPnl,lossesToday:nextDay?0:lossesToday};
}
function renderRisk(){
const v=vals(),leaves=[],allPaths=[];
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
let fp=0,fr=0;
if(phaseMode!=='evaluation'){function fw(path){const x=calc(path,fv);if(x.status!=='active'||x.steps.length>=fv.depth){if(x.status==='target')fp+=x.prob;if(x.status==='closed')fr+=x.prob;return}fw(path+'W');fw(path+'L')}fw('')}
const nn=accountMode==='multi'?Math.max(2,Math.min(100,Math.floor(Number($('[data-account-count]').value)||10))):1;
const totalFees=nn*v.accountCost,expectedFunded=nn*probability,activationFee=Math.max(0,fn('activation',0)),splitPct=Math.max(0,Math.min(1,fn('split',80)/100));
const grossPayout=expectedFunded*fp*fv.target*splitPct,activationFees=expectedFunded*activationFee,netCash=grossPayout-totalFees-activationFees;
const cash=x=>'$'+x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
box.querySelectorAll('[data-phase]').forEach(btn=>{const on=btn.dataset.phase===phaseMode;btn.setAttribute('aria-pressed',String(on));btn.style.fontWeight=on?'700':'400';btn.style.background=on?'var(--accent-soft,rgba(85,137,201,.15))':''});
$('[data-funded-fields]').style.display=phaseMode==='evaluation'?'none':'';
$('[data-funded-results]').style.display=phaseMode==='evaluation'?'none':'';
const metricFund=(label,value,help)=>kpiTooltip(label,value,help);
const fundedCards=metricFund('Funded pass',(fp*100).toFixed(2)+'%','Probability of reaching funded profit target within funded trade depth.')+metricFund('Funded ruin',(fr*100).toFixed(2)+'%','Probability of breaching funded loss allowance within funded trade depth.')+metricFund('Funded unresolved',(Math.max(0,1-fp-fr)*100).toFixed(2)+'%','Probability of still being active after funded simulation depth.')+metricFund('Payout per success',cash(fv.target*splitPct),'Funded target multiplied by payout split.');
const combinedCards=metricFund('Expected funded',expectedFunded.toFixed(2),'Expected evaluation passes. Assumes one evaluation pass gives funded access.')+metricFund('Expected payouts',cash(grossPayout),'Expected funded accounts times funded pass probability times payout per success.')+metricFund('Evaluation fees',cash(totalFees),'Total evaluation purchase fees.')+metricFund('Activation fees',cash(activationFees),'Expected passed evaluations multiplied by activation fee.')+metricFund('Expected net',cash(netCash),'Expected payout cash less evaluation and activation fees.')+metricFund('Expected ROI',totalFees+activationFees>0?(netCash/(totalFees+activationFees)*100).toFixed(1)+'%':'—','Expected net cash divided by expected fees spent.');
$('[data-funded-results]').innerHTML='<div style="font-size:12px;font-weight:700;margin:8px 0">Funded / Combined Results</div><div class="jj-risk-results-grid">'+fundedCards+''+'</div><div style="font-size:11px;opacity:.75;margin:5px 0">Finite-depth estimates. Assumes independent accounts, one evaluation stage and one funded payout target. Unresolved paths are not counted as passes. Additional qualification phases, resets and taxes excluded.</div>';

$('[data-combined-results]').innerHTML=phaseMode==='combined'?'<div class="jj-risk-results-grid">'+combinedCards+'</div>':'';box.querySelector('[data-section="combined-results"]').style.display=phaseMode==='combined'?'':'none';box.querySelector('[data-section="funded-settings"]').style.display=phaseMode==='evaluation'?'none':'';box.querySelector('[data-section="funded-results"]').style.display=phaseMode==='evaluation'?'none':'';box.querySelector('[data-section="challenge-results"]').style.display=phaseMode==='funded'?'none':'';box.querySelector('[data-section="paths"]').style.display=phaseMode==='funded'?'none':'';
box.querySelectorAll('[data-account-mode]').forEach(btn=>{const active=btn.dataset.accountMode===accountMode;btn.setAttribute('aria-pressed',String(active));btn.style.fontWeight=active?'700':'400';btn.style.background=active?'var(--accent-soft,rgba(85,137,201,.15))':''});
$('[data-multi-controls]').style.display=accountMode==='multi'?'':'none';
$('[data-multi-results]').style.display=accountMode==='multi'?'':'none';
if(accountMode==='multi'){
 const n=Math.max(2,Math.min(100,Math.floor(Number($('[data-account-count]').value)||10))),p=Math.max(0,Math.min(1,probability));
 const none=Math.pow(1-p,n),all=Math.pow(p,n);
 const costPerPass=p>0?v.accountCost/p:null;
 const card=(label,value)=>kpiTooltip(label,value,kpiHelp[label]);
 $('[data-multi-results]').innerHTML='<div style="font-size:12px;font-weight:700;margin:8px 0 5px">'+n+' Accounts · Probability</div><div class="jj-risk-results-grid">'+card('At least 1 challenge passes',((1-none)*100).toFixed(2)+'%')+card('No challenges pass',(none*100).toFixed(2)+'%')+card('Expected passed challenges',(n*p).toFixed(2))+card('All challenges pass',(all*100).toFixed(3)+'%')+card('Expected ruined',(n*failProbability).toFixed(2))+card('Expected unresolved',(n*unresolvedProbability).toFixed(2))+card('Total evaluation fees',tableNumber(n*v.accountCost))+card('Cost per passed challenge',costPerPass===null?'—':tableNumber(costPerPass))+'</div><div style="font-size:11px;opacity:.75;margin:5px 0">Binomial model using single-account pass probability. Shared trades or correlated outcomes can substantially change these chances.</div>';
}
const metric=(label,value)=>kpiTooltip(label,value,kpiHelp[label]);
const singleCostPerPass=probability>0?v.accountCost/probability:null;
$('[data-prob-results]').innerHTML='<div style="font-size:12px;font-weight:700;margin-bottom:5px">Probability & Results</div><div class="jj-risk-results-grid">'+metric('Pass chance',(probability*100).toFixed(1)+'%')+metric('Risk of ruin',(failProbability*100).toFixed(1)+'%')+metric('Unresolved',(unresolvedProbability*100).toFixed(1)+'%')+metric('Most likely path',(mostLikely?.path||'Start')+' · '+((mostLikely?.prob||0)*100).toFixed(1)+'%')+metric('Pass / resolved',resolvedProbability>0?(resolvedPassRate*100).toFixed(1)+'%':'—')+metric('Cost per passed challenge',singleCostPerPass===null?'—':tableNumber(singleCostPerPass))+'</div><div style="font-size:11px;opacity:.75;margin-top:5px">Within '+v.depth+' trades. Risk of ruin = probability of hitting the modeled account loss limit before passing. Pass + ruin + unresolved = 100%. Assumes independent trades at '+v.winRate+'% win rate; estimates only.</div>';
$('[data-target2-field]').style.display=v.targetMode===1?'none':'';
$('[data-target1-field]').firstChild.textContent=v.targetMode===1?'Profit target ($)':'Target 1 ($)';
box.querySelectorAll('[data-mode-button]').forEach(btn=>{const active=btn.dataset.modeButton===String(v.targetMode);btn.setAttribute('aria-pressed',String(active));btn.style.fontWeight=active?'700':'400';btn.style.borderColor=active?'var(--accent,#5589c9)':'';btn.style.background=active?'var(--accent-soft,rgba(85,137,201,.15))':''});
$('[data-kpis]').innerHTML=['target','closed','active','daily-blocked'] .map(k=>kpiTooltip(k==='target'?(v.targetMode===1?'PASS T1':'PASS BOTH'):k==='closed'?'FAIL':k==='daily-blocked'?'DAY BLOCK':'ACTIVE',counts[k],kpiHelp[k])).join('');
$('[data-prob]').textContent=(v.targetMode===1?'T1 reached within '+v.depth+' trades: '+(probability*100).toFixed(2)+'%.': 'T1 reached: '+(t1Probability*100).toFixed(2)+'% · Both targets reached within '+v.depth+' trades: '+(probability*100).toFixed(2)+'%. T2 starts at stage P&L 0 with a fresh '+tableNumber(v.limit)+' stage allowance; T1 profit remains banked.')+' Independent trades, '+v.winRate+'% win rate. Daily loss cap '+tableNumber(v.dailyLimit)+' with '+v.tradesPerDay+' losses/day maximum. A negative daily P&L or exhausted daily allowance stops that day; the next simulated trade begins a new day.';
const filter=$('[data-filter]').value;
const decisions=[calc('',v),...allPaths].filter(x=>x.status==='active').map(x=>({...x,win:calc(x.path+'W',v),loss:calc(x.path+'L',v)}));
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
const detail='<div style="padding:6px 0"><strong>Path '+(x.path||'Start')+'</strong> · Total P&L '+tableNumber(x.pnl)+' · Stage T'+x.stage+' · '+(terminal?'Stopped: '+(x.status==='target'?'target reached':x.status):'Next risk '+tableNumber(x.risk))+' · Day '+x.day+' · Daily loss remaining '+tableNumber(x.dailyLeft)+'</div>'+stageRows+(terminal?'<div style="padding-top:6px"><strong>No further trades in this path.</strong></div>':'<div style="padding-top:6px">Next Win: '+tableNumber(x.win.pnl)+' · Next Loss: '+tableNumber(x.loss.pnl)+'</div>');
return '<tr><td><button class="jj-risk-path" data-path="'+x.path+'">'+(x.path||'Start')+'</button></td><td>'+((x.prob||0)*100).toFixed(2)+'%</td><td>T'+x.stage+'</td><td>'+(terminal?'Stopped':tableNumber(x.risk))+'</td><td class="'+(!terminal&&x.win.status==='target'?'jj-risk-win':'')+'">'+(terminal?'—':tableNumber(x.win.pnl))+'</td><td class="'+(!terminal&&x.loss.status==='closed'?'jj-risk-loss':'')+'">'+(terminal?'—':tableNumber(x.loss.pnl))+'</td><td>'+tableNumber(x.pnl)+(terminal?' · '+(x.status==='target'?'PASS':x.status==='closed'?'FAIL':'DAY BLOCK'):'')+'</td><td><button data-expand-path="'+x.path+'" aria-expanded="'+isOpen+'">'+(isOpen?'Hide':'Show')+'</button></td></tr>'+(isOpen?'<tr><td colspan="8" class="jj-risk-muted" style="text-align:left;white-space:normal;padding:8px">'+detail+'</td></tr>':'');
}).join('')+'</tbody></table></div>';
$('[data-count]').textContent=shown.length?(page*10+1)+'–'+Math.min((page+1)*10,shown.length)+' / '+shown.length:'0 paths';
$('[data-prev]').disabled=page===0;$('[data-next]').disabled=(page+1)*10>=shown.length;
}
box.addEventListener('input',e=>{if(e.target.matches('[data-k],[data-account-count],[data-funded]')){page=0;saveSettings();renderRisk()}});
box.addEventListener('change',e=>{if(e.target.matches('[data-filter]')){page=0;expandedPaths.clear();renderRisk()}});
box.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;if(btn.hasAttribute('data-phase')){phaseMode=btn.dataset.phase;saveSettings()}else if(btn.hasAttribute('data-account-mode')){accountMode=btn.dataset.accountMode;saveSettings()}else if(btn.hasAttribute('data-mode-button')){box.querySelector('[data-target-mode]').value=btn.dataset.modeButton;page=0;expandedPaths.clear();saveSettings()}else if(btn.hasAttribute('data-expand-path')||btn.hasAttribute('data-path')){const key=btn.hasAttribute('data-expand-path')?btn.dataset.expandPath:btn.dataset.path;if(expandedPaths.has(key))expandedPaths.delete(key);else expandedPaths.add(key)}else if(btn.hasAttribute('data-prev'))page--;else if(btn.hasAttribute('data-next'))page++;renderRisk()});
renderRisk();
}
const original=render;render=function(){original();if(active===slug)mount()};if(new URLSearchParams(location.search).get('topic')===slug)active=slug;if(typeof jjRebuildMobileSelector==='function')jjRebuildMobileSelector();renderNav();render();
})();;
