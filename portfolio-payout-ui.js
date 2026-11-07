/* Standalone UI for reverse payout investment planning. */
(function(root){
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function start(){
 const bridge=root.StudioPayoutBridge,solver=root.StudioPayoutOptimizer;
 if(!bridge||!solver||!document.getElementById('results'))return;
 const panel=document.createElement('details');
 panel.id='payoutOptimizerPanel';panel.className='sim-charts-panel numbered-panel';
 panel.innerHTML='<summary><strong>4 · Calculate Investment &amp; Compare Models</strong>'+
  '<button class="primary section-run-btn" type="button" id="runPayoutOptimizer">Calculate Investment</button>'+
  '<span class="sim-charts-hint">Show / hide</span></summary>'+
  '<div class="numbered-content"><details id="payoutOptInputsPanel" class="payout-opt-inputs" open>'+
  '<summary><strong>Investment inputs</strong><span id="payoutOptInputsSummary"> · Set target, account, payout and budget</span><span class="payout-opt-inputs-toggle">Show / hide</span></summary>'+
  '<div class="payout-opt-inputs-body"><p class="hint">Search investment and risk combinations for a payout goal. Open any result to compare its R1/R2/R3 and trade KPIs, or search additional risk models in Section 4 without leaving these results. These are separate from Run Simulation.</p>'+
  '<div class="payout-opt-fields">'+
  '<label><span class="payout-opt-field-title">Target net P&L (USD)</span><input id="payoutOptNetPnl" type="number" min="1" step="500" value="5000" title="Net cash receipts minus incurred costs"></label>'+

  '<label><span class="payout-opt-field-title">Minimum payout per account ($)</span><input id="payoutOptPer" type="number" min="1" step="100" value="1000"></label>'+
  '<label><span class="payout-opt-field-title">Account type</span><select id="payoutOptAccount"></select></label>'+
  '<label><span class="payout-opt-field-title">Maximum starting investment ($)</span><input id="payoutOptMax" type="number" min="1" step="500" value="10000"></label>'+



  '</div>'+ 
  '<details class="payout-assumptions" id="payoutOptAssumptions"><summary>Simulation assumptions <span class="hint" id="payoutOptAssumptionsSummary">· click to edit</span></summary>'+
  '<div class="payout-assumptions-grid">'+
  '<label>Min fee ROI (%)<input id="payoutOptRoi" type="number" min="0" max="10000" step="25" value="0"></label>'+
  '<label>Min budget ROI (%)<input id="payoutOptNetRoi" type="number" min="0" max="10000" step="25" value="0"></label>'+
  '<label>Min RR<input id="payoutOptMinRR" type="number" min="0.1" max="20" step="0.25" value="1.5"></label>'+
  '<label>Max RR<input id="payoutOptMaxRR" type="number" min="0.1" max="20" step="0.25" value="3"></label>'+
  '<label>Trading days<select id="payoutOptDays"><option>10</option><option>20</option><option>30</option><option>40</option><option>60</option><option>90</option><option>120</option></select></label>'+
  '<label>Signal schedule<select id="payoutOptPace"><option value="weekly20">20/week · 3,4,5,4,4</option><option value="daily">Fixed signals / day</option></select></label>'+
  '<label>Signals / day<select id="payoutOptSignals"></select></label>'+
  '<label>Win rate (%)<input id="payoutOptWinRate" type="number" min="0" max="100" step="0.5"></label>'+
  '<label>Purchase mode<select id="payoutOptPurchase"><option value="recycle">Dynamic · as needed</option><option value="upfront">Buy upfront</option></select></label>'+
  '<label>Signal outcomes<select id="payoutOptSignalMode"><option value="independent">Independent</option><option value="shared">Shared daily signal</option></select></label>'+
  '<label>Reinvest payouts<select id="payoutOptReinvest"><option value="no">No</option><option value="yes">Yes</option></select></label>'+
  '<label>Account allocation<select id="payoutOptCapacity"><option value="automatic">Automatic · reuse owned</option><option value="manual">Manual active limit</option></select></label>'+
  '<label>Max active accounts<input id="payoutOptMaxActive" type="number" min="1" max="100" step="1" title="Applies only in manual account allocation mode"></label>'+
  '<label>Max new accounts/day<input id="payoutOptBuys" type="number" min="1" max="20" step="1" title="Applies only in manual account allocation mode"></label>'+
  '<label>Random seed<input id="payoutOptSeed" type="number" min="1" step="1" title="Repeat the same simulation outcomes when unchanged"></label>'+
  '<label>Phase 1 min days<input id="payoutOptP1Days" type="number" min="0" max="60" step="1"></label>'+
  '<label>Phase 2 min days<input id="payoutOptP2Days" type="number" min="0" max="60" step="1"></label>'+
  '<label>Funded wait (calendar days)<input id="payoutOptWait" type="number" min="0" max="120" step="1"></label>'+
  '<label>Payout processing (calendar days)<input id="payoutOptProcessing" type="number" min="0" max="120" step="1"></label>'+
  '</div><p class="hint" id="payoutOptLimits"></p>'+
  '<button type="button" class="payout-assumptions-reset" id="payoutOptReset">Reset assumptions from Section 1 / Firms</button>'+
  '<p class="hint">These values apply only to Calculate Investment. The main simulator and saved Firms settings are not changed.</p>'+
  '</details><p class="hint" id="payoutOptMath">10 first payouts required.</p></div></details>'+
  '<p id="payoutOptStatus" class="status" role="status">Choose targets, then Calculate Investment.</p>'+
  '<div id="payoutOptResults"></div>'+
  '<details id="payoutMoreSearchSettings" class="payout-more-settings"><summary>More model search settings</summary>'+
  '<div class="payout-more-settings-fields">'+
  '<label>Goal to improve<select id="payoutMoreObjective"><option value="goal">Chance of net target</option><option value="balanced">Balanced · net + downside</option><option value="net">Highest expected net</option><option value="payout">Chance of first payout</option><option value="downside">Protect downside P10</option></select></label>'+
  '<label>Search depth<select id="payoutMoreEffort"><option value="quick">Quick · 50 + 80 trials</option><option value="normal" selected>Standard · 80 + 150 trials</option><option value="deep">Detailed · 150 + 250 trials</option></select></label>'+
  '</div><p class="hint">Uses the chosen option’s own safety reserve, firm limits and risk policy. New models have the same investment budget.</p></details>'+
  '<details id="payoutOptModelComparison" class="payout-model-collapse">'+
  '<summary><strong>Model comparison</strong><span id="payoutOptModelSummary"> · Results appear after Calculate Investment</span><span class="payout-model-collapse-toggle">Show / hide</span></summary>'+
  '<div id="payoutOptMoreModels" class="payout-model-collapse-body"></div></details>'+
  '<details id="payoutResultsAdvisor" class="payout-advisor" hidden>'+
  '<summary><strong>Results Advisor</strong><span id="payoutAdvisorSummary"> · Explain your simulation results · Free, rule-based</span></summary>'+
  '<div class="payout-advisor-body"><div class="payout-advisor-controls">'+
  '<label>Model<select id="payoutAdvisorModel"></select></label>'+
  '<label>Question<input id="payoutAdvisorQuestion" type="text" maxlength="240" placeholder="Why is my payout chance low?"></label>'+
  '<button type="button" id="payoutAdvisorAsk">Explain</button></div>'+
  '<div class="payout-advisor-topics" role="group" aria-label="Common questions">'+
  [['overview','Overview'],['bottleneck','Bottlenecks'],['funnel','Account funnel'],['risk','R1 / R2 / R3'],['payout','Payout timing'],['cost','Costs & ROI'],['compare','Compare models']].map(([id,name])=>
   '<button type="button" data-advisor-topic="'+id+'">'+name+'</button>').join('')+
  '</div><div id="payoutAdvisorSuggestions" class="payout-advisor-suggestions" aria-label="Questions suggested from this model"></div>'+
  '<div id="payoutAdvisorAnswer" class="payout-advisor-answer" aria-live="polite"></div>'+ 
  '<details class="payout-advisor-review"><summary><strong>Question &amp; answer log</strong> · <span id="payoutAdvisorLogCount">0 recorded</span> · Show / hide</summary>'+
  '<div class="payout-advisor-log-actions"><button type="button" id="payoutAdvisorExport">Export GPT review JSON</button><button type="button" id="payoutAdvisorSync">Sync questions</button><span class="hint" id="payoutAdvisorCloudStatus">Checking cloud review log…</span></div>'+
  '<div id="payoutAdvisorLog" class="payout-advisor-log"></div></details>'+
  '<p class="hint">Based only on the selected simulated results. No AI API, subscription or automatic changes. Suggestions are tests, not proof of future trading performance.</p>'+
  '</div></details></div>';
 document.getElementById('results').before(panel);
 // Section 4: one tooltip for every results-table header, including tables
 // that are replaced when sorting, changing a model or selecting an account.
 const tableHeaderHelp={
  'Model':'Trading strategy and its tested risk setup. Expand phase settings to inspect each phase.',
  'Net':'Average net portfolio cash P&L after incurred challenge and activation costs.',
  'ROI':'Expected net P&L divided by average incurred fees (fee ROI), not starting-budget ROI.',
  'Goal':'Percentage of trials meeting BOTH the required first-payout count and target net P&L.',
  'Investment':'Starting budget reserved for challenge purchases and any required activation fees; not fees actually spent.',
  'Δ Net':'Difference in average net P&L versus the stated reference investment option. A positive difference is not proof of a trading edge.',
  'P10':'10th-percentile modeled net P&L: around 10% of trials had a net result this low or lower.',
  'CP':'Chance of at least one completed first payout within the simulated trading horizon.',
  'BA':'Average risk-blocked accounts: unable to place another permissible trade within risk limits. Not the same as breached accounts.',
  'Paid':'Average number of distinct accounts receiving a first payout per simulation.',
  'Funded':'Average number of accounts reaching the funded stage, including those not yet paid.',
  'Bought':'Average number of challenges purchased per simulation, not necessarily all activated at once.',
  'Fees':'Average incurred challenge and activation fees; different from the reserved starting budget.',
  'PF':'Profit factor: gross profitable trade P&L divided by absolute gross losing trade P&L.',
  'WR':'Win rate: winning executed trades divided by all executed trades.',
  'RR':'Planned risk-weighted reward-to-risk ratio across modeled trades. Actual outcomes may differ.',
  'AR':'Average realized net R per executed trade, using each trade’s original risk.',
  'AW':'Average net dollar profit of winning trades.',
  'AL':'Average absolute net dollar loss of losing trades.',
  'EV':'Expected modeled dollar profit or loss per executed trade (average trade P&L).',
  'Trades':'Average executed trades per portfolio simulation trial.',
  'View':'Analyze opens full reports in Sections 5–8; Ledger opens the model’s day-by-day spending in Section 9.',
  'Day':'Trading day index in the simulated sample; not a calendar-date forecast.',
  'Phase':'Account stage: evaluation, verification or funded. Available stages depend on the firm.',
  'Trade':'Trade sequence number inside the selected account or phase.',
  'Result / event':'Modeled win, loss, stage transition, payout milestone or another recorded event.',
  'Tier':'Risk tier or state selected for this trade under the current policy (R1, R2 or R3).',
  'Risk':'Actual dollar risk assigned to that trade, after applicable firm limits and reserve.',
  'Trade P&L':'Modeled profit or loss on this trade, including modeled transaction costs.',
  'Phase P&L':'Cumulative P&L within the current evaluation, verification or funded phase.',
  'Parameter':'The setting being compared between the saved Firms profile and the modeled scenario.',
  'Current Firms':'Current saved firm-account configuration; not automatically changed by the optimizer.',
  'Scenario':'Alternative setting proposed by this simulated investment model.',
  'Risk sequence':'Rules selecting the next risk tier, such as flat, after-loss recovery or adaptive target.',
  'Target':'Modeled profit target required to complete the phase; not the final cash payout.',
  'Max wins/day':'Maximum winning trades allowed in a day for this account and phase.',
  'Min trading days':'Minimum qualifying trading days modeled before passing a phase.',
  'First trade':'Calculated risk for the first trade in a hypothetical new-phase loss path.',
  'After 1 loss':'Calculated next-trade risk after one loss, assuming a separate trading day.',
  'After 2 losses':'Calculated next-trade risk after two consecutive losses, assuming separate trading days.',
  'R1 / R2 / R3':'Configured risk tier amounts for fixed policies; for adaptive policies these may be caps, while actual sizes are recalculated.',
  'RR per tier':'Planned reward-to-risk multiplier for risk tier R1, R2 and R3, in that order.',
  'vs Firms':'Whether modeled risk settings differ from the saved Firms account settings.',
  'R3 headroom after LL':'Remaining risk allowance after two consecutive losses (L, L), including modeled reserve and costs.',
  'Can R3 trade?':'Whether the third trade can be legally sized and placed after two modeled losses.',
  'Stage P&L after LLW':'Phase profit or loss after loss, loss, then one winning recovery trade (L-L-W).'
 };
 const headerTooltip=document.createElement('div');
 headerTooltip.className='payout-header-tooltip';
 headerTooltip.id='payoutHeaderTooltip';
 headerTooltip.setAttribute('role','tooltip');
 headerTooltip.hidden=true;
 document.body.appendChild(headerTooltip);
 let activeHeader=null,headerPinned=false;
 function hideHeaderTooltip(force=false){
  if(headerPinned&&!force)return;
  headerTooltip.hidden=true;activeHeader=null;headerPinned=false;
 }
 function showHeaderTooltip(th,pin=false){
  if(!th||!th.dataset.headerHelp)return;
  activeHeader=th;headerPinned=pin;
  headerTooltip.textContent=th.dataset.headerHelp;
  headerTooltip.hidden=false;
  const rect=th.getBoundingClientRect(),w=headerTooltip.offsetWidth||260;
  const x=Math.min(window.innerWidth-w-10,Math.max(10,rect.left));
  const lower=rect.bottom+7,above=rect.top-headerTooltip.offsetHeight-7;
  headerTooltip.style.left=Math.max(8,x)+'px';
  headerTooltip.style.top=(lower+headerTooltip.offsetHeight>window.innerHeight-8&&above>=8?above:Math.max(8,lower))+'px';
 }
 function annotateHeaders(){
  for(const th of panel.querySelectorAll('table thead th')){
   const label=th.textContent.trim().replace(/\\s+/g,' ');
   if(!Object.prototype.hasOwnProperty.call(tableHeaderHelp,label))continue;
   th.dataset.headerHelp=tableHeaderHelp[label];
   th.setAttribute('title',tableHeaderHelp[label]);
   th.setAttribute('tabindex','0');
   th.setAttribute('aria-label',label+': '+tableHeaderHelp[label]);
   th.classList.add('payout-header-has-help');
  }
 }
 const headerObserver=new MutationObserver(annotateHeaders);
 headerObserver.observe(panel,{childList:true,subtree:true});
 panel.addEventListener('mouseover',event=>{
  const th=event.target.closest?.('table thead th[data-header-help]');
  if(th&&!headerPinned&&th!==activeHeader)showHeaderTooltip(th);
 });
 panel.addEventListener('mouseout',event=>{
  const th=event.target.closest?.('table thead th[data-header-help]');
  if(th&&!th.contains(event.relatedTarget)&&!headerPinned)hideHeaderTooltip();
 });
 panel.addEventListener('click',event=>{
  const th=event.target.closest?.('table thead th[data-header-help]');
  if(!th)return;
  if(activeHeader===th&&headerPinned)hideHeaderTooltip(true);
  else showHeaderTooltip(th,true);
 });
 panel.addEventListener('focusin',event=>{
  const th=event.target.closest?.('table thead th[data-header-help]');
  if(th)showHeaderTooltip(th);
 });
 panel.addEventListener('focusout',event=>{
  if(event.target.matches?.('table thead th[data-header-help]'))hideHeaderTooltip(true);
 });
 document.addEventListener('click',event=>{
  if(activeHeader&&!activeHeader.contains(event.target)&&!headerTooltip.contains(event.target))hideHeaderTooltip(true);
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape')hideHeaderTooltip(true);});
 window.addEventListener('scroll',()=>hideHeaderTooltip(true),true);
 window.addEventListener('resize',()=>hideHeaderTooltip(true));

 const $=id=>document.getElementById(id);
 const style=document.createElement('style');
 style.textContent=`
 .payout-header-tooltip{position:fixed;z-index:20000;box-sizing:border-box;max-width:min(310px,calc(100vw - 20px));width:max-content;max-width:min(310px,calc(100vw - 20px));padding:9px 11px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--text);font-size:12px;line-height:1.4;box-shadow:0 5px 20px rgba(0,0,0,.22);pointer-events:none}
 .payout-header-tooltip[hidden]{display:none}
 #payoutOptimizerPanel table thead th.payout-header-has-help{cursor:help;text-decoration:underline dotted;text-decoration-color:var(--muted);text-underline-offset:3px}
 #payoutOptimizerPanel table thead th.payout-header-has-help:focus-visible{outline:2px solid var(--blue);outline-offset:-2px}
 #payoutOptimizerPanel>.numbered-content{padding:8px 5px}
 #payoutOptimizerPanel .reverse-option-actions button[data-reverse-ledger]{font-size:11px;min-height:32px;white-space:normal}

 #payoutOptimizerPanel .payout-opt-inputs{margin:1px 0 7px;border:1px solid var(--line);border-radius:7px;overflow:hidden}
 #payoutOptimizerPanel .payout-opt-inputs>summary{display:flex;align-items:center;flex-wrap:wrap;gap:6px;cursor:pointer;background:var(--panel2);padding:8px 10px;list-style:none;font-size:12px}
 #payoutOptimizerPanel .payout-opt-inputs>summary::-webkit-details-marker{display:none}
 #payoutOptimizerPanel .payout-opt-inputs>summary:before{content:'▸';font-size:11px;color:var(--muted)}
 #payoutOptimizerPanel .payout-opt-inputs[open]>summary:before{content:'▾'}
 #payoutOptimizerPanel .payout-opt-inputs>summary strong{font-size:12px}
 #payoutOptimizerPanel #payoutOptInputsSummary{flex:1 1 190px;font-size:11px;color:var(--muted)}
 #payoutOptimizerPanel .payout-opt-inputs-toggle{font-size:10px;color:var(--muted)}
 #payoutOptimizerPanel .payout-opt-inputs[open]>summary{border-bottom:1px solid var(--line)}
 #payoutOptimizerPanel .payout-opt-inputs-body{padding:7px 8px}
 @media(max-width:650px){#payoutOptimizerPanel .payout-opt-inputs>summary{padding:7px 8px}#payoutOptimizerPanel .payout-opt-inputs-body{padding:6px}}
 #payoutOptimizerPanel>summary .section-run-btn{height:34px;min-height:34px;flex:0 0 170px;width:170px;padding:5px 8px;font-size:12px}
 #payoutOptimizerPanel>summary .sim-charts-hint{margin-left:0}
 .payout-opt-fields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:end;gap:5px;margin:5px 0}
 .payout-opt-fields label{display:flex;flex-direction:column;gap:3px;min-width:0;margin:0;font-size:10px;line-height:1.15;font-weight:700;color:var(--muted)}
 .payout-opt-field-title{display:flex;align-items:end;height:26px;min-height:26px;max-height:26px;overflow:hidden}
 .payout-opt-fields input,.payout-opt-fields select{box-sizing:border-box;display:block;margin:0;width:100%;height:31px;min-height:31px;max-height:31px;padding:4px 7px;border-radius:7px;font-size:12px;line-height:1.2}
 .payout-opt-fields select{padding-right:19px;text-overflow:ellipsis;white-space:nowrap}
 .payout-assumptions{margin:5px 0;border:1px solid var(--line);border-radius:6px;padding:3px 7px}
 .payout-assumptions>summary{cursor:pointer;font-weight:700;font-size:11px}
 .payout-assumptions>summary .hint{font-weight:400;font-size:10px}
 .payout-assumptions-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin:6px 0}
 .payout-assumptions-grid label{display:flex;flex-direction:column;gap:2px;font-weight:600;font-size:10px;min-width:0}
 .payout-assumptions-grid input,.payout-assumptions-grid select{width:100%;box-sizing:border-box;min-width:0;height:29px;min-height:29px;font-size:12px;padding:3px 6px;border-radius:5px}
 .payout-assumptions-reset{font-size:10px;padding:4px 7px;min-height:25px}
 @media(max-width:900px){.payout-assumptions-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
 @media(max-width:600px){.payout-assumptions-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.payout-assumptions-grid input,.payout-assumptions-grid select{font-size:16px;height:35px;min-height:35px}}
 .reverse-sort-bar{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:5px 7px;margin:5px 0;border:1px solid var(--line);border-radius:6px}
 .reverse-sort-bar label{font-size:11px}
 .reverse-sort-bar select{min-height:27px;max-width:220px;padding:3px 6px;font-size:11px;border-radius:5px}
 .reverse-sort-bar small{font-size:10px;color:var(--muted);flex:1 1 220px}
 @media(max-width:600px){.reverse-sort-bar select{font-size:16px;min-height:35px}}
 .reverse-review-panel{border:1px solid var(--line);border-radius:6px;margin:5px 0;padding:3px 7px}
 .reverse-review-panel>summary{font-size:11px;cursor:pointer;padding:4px 0}
 .reverse-funnel-grid{display:grid;gap:5px;margin:8px 0}
 .reverse-funnel-row{display:grid;grid-template-columns:minmax(118px,1.35fr) minmax(80px,2fr) 54px 75px 65px;gap:8px;align-items:center;font-size:11px}
 .reverse-funnel-label{line-height:1.3}
 .reverse-funnel-rail{display:block;min-width:0;height:12px;border:1px solid var(--line);border-radius:4px;background:var(--panel2);overflow:hidden}
 .reverse-funnel-fill{display:block;height:100%;border-radius:3px;background:var(--blue);min-width:0}
 .reverse-funnel-number{font-size:11px;text-align:right;font-variant-numeric:tabular-nums}
 .reverse-funnel-step{font-size:10px;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
 .reverse-funnel-total{font-size:10px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:var(--text)}
 @media(max-width:650px){.reverse-funnel-row{grid-template-columns:minmax(95px,1.4fr) minmax(48px,1fr) 44px 57px;gap:4px;font-size:10px}.reverse-funnel-step{grid-column:1 / 3;text-align:left;margin-top:-2px;padding-left:1px}.reverse-funnel-total{grid-column:4;grid-row:1;font-size:10px}.reverse-funnel-number{font-size:10px}}
 .reverse-review-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin:6px 0}
 .reverse-review-grid>div{padding:5px 7px;border:1px solid var(--line);border-radius:5px}
 .reverse-review-grid small{font-size:10px;color:var(--muted);display:block}
 .reverse-review-grid strong{font-size:11px;overflow-wrap:anywhere}
 .reverse-review-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:6px 0}
 .reverse-review-actions button{font-size:11px;min-height:29px}
 .reverse-review-actions span{font-size:10px;flex:1 1 250px}
 .reverse-review-status{font-size:11px;margin:4px 0}
 @media(max-width:800px){.reverse-review-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
 .reverse-candidate{border:1px solid var(--line);border-radius:7px;padding:0;margin:5px 0;overflow:hidden}
 .reverse-candidate>summary{list-style:none;cursor:pointer}
 .reverse-candidate>summary::-webkit-details-marker{display:none}
 .reverse-candidate-summary{display:flex;align-items:center;gap:7px;padding:5px 7px;min-width:0;flex-wrap:wrap}
 .reverse-candidate-summary::before{content:'▸';font-size:11px;color:var(--muted);flex:0 0 auto}
 .reverse-candidate[open]>.reverse-candidate-summary::before{content:'▾'}
 .reverse-candidate-name{font-size:11px;font-weight:700;line-height:1.2;white-space:nowrap;min-width:0}
 .reverse-candidate-status{font-weight:600;color:var(--muted);font-size:10px;margin-left:5px}
 .reverse-status-met{color:#087e63}
 .reverse-summary-kpis{display:flex;flex:1 1 auto;min-width:0;justify-content:flex-end;gap:3px;flex-wrap:wrap}
 .reverse-compact-metric{display:flex;gap:4px;align-items:center;white-space:nowrap;padding:3px 6px;border:1px solid var(--line);border-radius:5px;font-size:10px}
 .reverse-compact-metric small{font-size:9px;color:var(--muted)}
 .reverse-compact-metric strong{font-size:11px}
 .reverse-summary-toggle{color:var(--muted);font-size:10px;white-space:nowrap}
 .reverse-candidate-body{padding:3px 7px 6px;border-top:1px solid var(--line)}
 .reverse-candidate-advice{display:block;flex:1 0 100%;padding-left:16px;font-size:10px;line-height:1.2;color:var(--muted)}
 .reverse-advice{border:1px solid var(--line);border-radius:6px;padding:5px 7px;margin:4px 0 6px;font-size:10px;line-height:1.3}
 .reverse-advice>strong{font-size:11px}
 .reverse-advice-item{display:grid;grid-template-columns:minmax(120px,1fr) minmax(180px,1.3fr) minmax(180px,1.5fr);gap:6px;margin-top:4px;padding-top:4px;border-top:1px solid var(--line);align-items:start}
 .reverse-advice-item>strong{font-size:10px}
 .reverse-advice-item>span{color:var(--muted)}
 .reverse-advice-item>em{font-style:normal}
 .reverse-advice>small{display:block;margin-top:5px;color:var(--muted);font-size:9px}
 @media(max-width:700px){.reverse-advice-item{display:flex;flex-direction:column;gap:2px}.reverse-candidate-advice{padding-left:0}}

 @media(max-width:900px){.reverse-summary-kpis{justify-content:flex-start;width:100%;flex-basis:100%}}
 @media(max-width:600px){.reverse-compact-metric{padding:2px 4px;gap:3px}.reverse-compact-metric small{font-size:9px}.reverse-compact-metric strong{font-size:10px}.reverse-candidate-name{white-space:normal}}

 .reverse-candidate h4{font-size:13px;line-height:1.18;margin:0 0 3px}
 .reverse-candidate .hint{font-size:10px;line-height:1.25;margin:2px 0 4px!important}
 .reverse-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;margin:5px 0}
 .reverse-kpis>div{border:1px solid var(--line);padding:4px 6px;border-radius:5px;min-width:0}
 .reverse-kpis small{display:block;color:var(--muted);font-size:10px;line-height:1.12;margin:0 0 2px}
 .reverse-kpis strong{display:block;font-size:12px;line-height:1.2}
 .reverse-candidate .tablewrap{margin-top:4px;border-radius:6px}
 .reverse-candidate table{font-size:11px}
 .reverse-candidate th,.reverse-candidate td{padding:5px 7px;line-height:1.2}
 .reverse-candidate th{font-size:10px}
 .reverse-result-overview{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;padding:5px 7px;margin:5px 0;border:1px solid var(--line);border-radius:6px;background:var(--panel2)}
 .reverse-info-section{border:1px solid var(--line);border-radius:6px;margin:4px 0;padding:0;overflow:hidden}
 .reverse-info-section>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 8px;font-size:11px;line-height:1.25}
 .reverse-info-section>summary::-webkit-details-marker{display:none}
 .reverse-info-section>summary::before{content:'▸';font-size:10px;color:var(--muted)}
 .reverse-info-section[open]>summary::before{content:'▾'}
 .reverse-info-section>summary span{font-size:10px;font-weight:400;color:var(--muted)}
 .reverse-info-section>p{margin:0!important;padding:6px 9px;font-size:11px;line-height:1.4;border-top:1px solid var(--line)}
 .reverse-info-section>.reverse-speed-summary{margin:3px 7px 7px}
 .reverse-speed-summary{border:1px solid var(--line);border-radius:6px;margin:5px 0;padding:5px 7px;font-size:11px;line-height:1.3}
 .reverse-speed-summary strong{font-size:11px}
 .reverse-speed-summary small{font-size:10px;color:var(--muted)}
 .reverse-sizing-info{margin:4px 0 2px;border:1px solid var(--line);border-radius:5px;padding:2px 6px}
 .reverse-sizing-info>summary{cursor:pointer;font-size:10px;font-weight:700}
 .reverse-sizing-info .hint{margin:3px 0 2px!important}
 .reverse-trade-details{margin-top:5px;padding:3px 6px;border-radius:6px;border:1px solid var(--line)}
 .reverse-trade-details>summary{cursor:pointer;font-size:11px;font-weight:700;padding:3px 1px;line-height:1.25}
 .reverse-trade-details>summary small{font-size:10px;font-weight:400;color:var(--muted)}
 .reverse-path-controls{display:flex;align-items:center;gap:8px;margin:5px 0;flex-wrap:wrap}
 .reverse-path-controls label{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700}
 .reverse-path-controls select{min-height:27px;height:27px;max-width:260px;padding:3px 5px;font-size:11px;border-radius:5px}
 .reverse-path-table{max-height:275px;overflow:auto;overscroll-behavior:contain}
 .reverse-path-table table{min-width:650px;font-size:10px}
 .reverse-path-table th,.reverse-path-table td{padding:4px 6px;white-space:nowrap}
 .reverse-event-row{color:var(--muted);font-style:italic}
 @media(max-width:600px){.reverse-path-controls select{font-size:16px;height:35px;min-height:35px;max-width:230px}}
 @media(max-width:1000px){.payout-opt-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.reverse-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
 @media(max-width:600px){.payout-opt-fields{grid-template-columns:repeat(2,minmax(0,1fr))}
 .payout-opt-fields input,.payout-opt-fields select{font-size:16px;min-height:35px;height:35px;max-height:35px}
 #payoutOptimizerPanel>summary .section-run-btn{width:144px;flex-basis:144px;min-height:30px;height:30px;padding:4px;font-size:11px}
 .reverse-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}

 /* Reverse payout hierarchy: three levels, visible scenario ownership, minimal color. */
 #payoutOptResults{--reverse-accent:#3277a5;--reverse-border:color-mix(in srgb,var(--line) 60%,var(--text) 40%);display:flow-root}
 #payoutOptResults .reverse-section-divider{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:15px 0 7px;padding:8px 10px;border-bottom:2px solid var(--reverse-border);background:color-mix(in srgb,var(--panel2) 88%,var(--text) 12%);border-radius:5px 5px 0 0}
 #payoutOptResults .reverse-section-divider strong{font-size:11px;letter-spacing:.065em;line-height:1.25}
 #payoutOptResults .reverse-section-divider span{font-size:10px;color:var(--muted)}
 #payoutOptResults .reverse-section-global{margin-top:5px}
 #payoutOptResults .reverse-section-scenarios{border-bottom-color:var(--reverse-accent);margin-top:16px}
 #payoutOptResults .reverse-section-reference{margin-top:17px}
 #payoutOptResults .reverse-sort-bar{border-color:var(--reverse-border);background:var(--panel2);margin:7px 0 9px}
 #payoutOptResults .reverse-result-overview{min-height:34px;border-color:var(--reverse-border);border-left:3px solid var(--reverse-accent);padding:7px 10px;margin:7px 0;font-size:12px}
 #payoutOptResults .reverse-info-section{margin:6px 0;border-color:var(--reverse-border)}
 #payoutOptResults .reverse-info-section>summary{padding:8px 10px;background:color-mix(in srgb,var(--panel2) 93%,var(--text) 7%);font-weight:650}
 #payoutOptResults .reverse-info-section[open]>summary{border-bottom:1px solid var(--line)}
 #payoutOptResults .reverse-critical-gap{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 11px;margin:8px 0;border:1px solid var(--reverse-border);border-left:3px solid #b38b48;border-radius:6px;font-size:11px;line-height:1.35}
 #payoutOptResults .reverse-critical-gap strong{white-space:nowrap;font-size:11px}
 #payoutOptResults .reverse-critical-gap span{min-width:0}
 #payoutOptResults .reverse-candidate{margin:10px 0 12px;border:1px solid var(--reverse-border);border-radius:9px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
 #payoutOptResults .reverse-candidate>summary{background:color-mix(in srgb,var(--panel2) 83%,var(--text) 17%);padding:8px 10px}
 #payoutOptResults .reverse-candidate[open]{border:2px solid var(--reverse-accent);box-shadow:0 2px 10px rgba(0,0,0,.10)}
 #payoutOptResults .reverse-candidate[open]>summary{border-bottom:1px solid var(--reverse-border);background:color-mix(in srgb,var(--panel2) 78%,var(--text) 22%)}
 #payoutOptResults .reverse-candidate-name{font-size:12px;white-space:normal;flex:1 1 390px}
 #payoutOptResults .reverse-candidate-summary{gap:7px}
 #payoutOptResults .reverse-summary-toggle{font-size:11px;font-weight:700}
 #payoutOptResults .reverse-candidate-advice{padding-left:18px;margin-top:3px}
 #payoutOptResults .reverse-candidate-body{padding:10px 12px 12px;background:var(--panel)}
 #payoutOptResults .reverse-detail-label{font-size:10px;font-weight:800;letter-spacing:.045em;color:var(--muted);padding:4px 2px 7px;border-bottom:1px solid var(--line);margin-bottom:9px}
 #payoutOptResults .reverse-review-panel,#payoutOptResults .reverse-diagnostic,#payoutOptResults .reverse-trade-details{margin:8px 0;border:1px solid var(--reverse-border);border-radius:7px;overflow:hidden;padding:0}
 #payoutOptResults .reverse-review-panel>summary,#payoutOptResults .reverse-diagnostic>summary,#payoutOptResults .reverse-trade-details>summary{display:block;padding:9px 11px;font-size:11px;font-weight:650;line-height:1.35;background:var(--panel2);cursor:pointer}
 #payoutOptResults .reverse-review-panel[open],#payoutOptResults .reverse-diagnostic[open],#payoutOptResults .reverse-trade-details[open]{border-left:3px solid var(--reverse-accent)}
 #payoutOptResults .reverse-review-panel[open]>summary,#payoutOptResults .reverse-diagnostic[open]>summary,#payoutOptResults .reverse-trade-details[open]>summary{border-bottom:1px solid var(--line)}
 #payoutOptResults .reverse-review-panel>.tablewrap,#payoutOptResults .reverse-review-panel>.reverse-review-grid,#payoutOptResults .reverse-trade-details>.reverse-path-controls{margin:8px}
 #payoutOptResults .reverse-review-panel>.hint{margin:7px 10px!important}
 #payoutOptResults .reverse-diagnostic small{font-size:10px;font-weight:400;color:var(--muted)}
 #payoutOptResults .reverse-diagnostic .reverse-advice{margin:8px;border:0;padding:5px}
 #payoutOptResults .reverse-advice-item{padding:7px 2px;margin-top:7px;line-height:1.4}
 #payoutOptResults .reverse-advice-item>strong{font-size:11px}
 #payoutOptResults .reverse-review-actions{padding:8px 2px;border-top:1px solid var(--line);margin-top:10px}
 #payoutOptResults .reverse-kpis{margin:9px 0 12px}
 #payoutOptResults .reverse-kpis>div{background:var(--panel2);padding:7px 8px}
 #payoutOptResults .reverse-compact-metric{background:var(--panel);border-color:var(--reverse-border)}
 @media(max-width:600px){
  #payoutOptResults .reverse-section-divider{padding:7px 8px;margin-top:12px}
  #payoutOptResults .reverse-candidate{margin:8px 0 10px}
  #payoutOptResults .reverse-candidate>summary{padding:7px 8px}
  #payoutOptResults .reverse-candidate-body{padding:7px}
  #payoutOptResults .reverse-candidate-name{flex-basis:100%}
  #payoutOptResults .reverse-candidate-advice{padding-left:0}
 }

 /* Injected 3A panel: same compact mobile header as every other section. */
 @media(max-width:650px){
  #payoutOptimizerPanel>summary{
   display:grid;grid-template-columns:12px minmax(0,1fr);
   align-items:center;column-gap:8px;row-gap:5px;padding:10px 11px
  }
  #payoutOptimizerPanel>summary::before{grid-column:1;grid-row:1}
  #payoutOptimizerPanel>summary>strong{
   grid-column:2;grid-row:1;min-width:0;font-size:13px;
   line-height:1.25;font-weight:700;overflow-wrap:break-word
  }
  #payoutOptimizerPanel>summary .sim-charts-hint{display:none}
  #payoutOptimizerPanel>summary .section-run-btn{
   grid-column:2;grid-row:2;display:flex;justify-self:stretch;
   width:100%;height:31px;min-height:31px;max-height:31px;
   flex:none;margin:1px 0 0;padding:4px 8px;font-size:12px;
   border-radius:6px
  }
  #payoutOptimizerPanel>.numbered-content{padding:7px 6px}
 }

/* Clean-results pass: less chrome, one simple heading per group. */
#payoutOptResults .reverse-simple-heading{
 font-size:13px;font-weight:750;line-height:1.35;color:var(--text);
 padding:7px 1px 5px;margin:12px 0 5px;border-bottom:1px solid var(--line);
}
#payoutOptResults .reverse-simple-heading small{font-size:11px;font-weight:500;color:var(--muted)}
#payoutOptResults .reverse-result-overview{
 border:0;border-radius:5px;border-left:3px solid var(--blue);
 box-shadow:none;background:transparent;padding:6px 8px;margin:4px 0;
 font-size:12px;
}
#payoutOptResults .reverse-critical-gap{
 margin:3px 0 9px;padding:4px 8px;
 border:0;border-left:3px solid #ae8240;border-radius:3px;background:transparent;
 font-size:11px;
}
#payoutOptResults .reverse-info-section{
 margin:2px 0;border:0;border-bottom:1px solid var(--line);
 border-radius:0;background:transparent;
}
#payoutOptResults .reverse-info-section>summary{
 background:transparent;border:0;padding:7px 5px;
 font-size:11px;font-weight:600;
}
#payoutOptResults .reverse-info-section[open]>summary{border-bottom:0}
#payoutOptResults .reverse-info-section>p{padding:7px 10px;border-top:1px solid var(--line)}
#payoutOptResults .reverse-sort-bar{
 padding:4px 0 8px;margin:1px 0 4px;border:0;border-radius:0;background:transparent;
}
#payoutOptResults .reverse-sort-bar select{max-width:210px}
#payoutOptResults .reverse-sort-bar small{flex:1 1 200px;font-size:10px;opacity:.75}
#payoutOptResults .reverse-candidate{
 margin:5px 0;border:1px solid var(--line);border-radius:7px;
 box-shadow:none;background:var(--panel);
}
#payoutOptResults .reverse-candidate>summary{
 padding:8px 9px;background:transparent;
}
#payoutOptResults .reverse-candidate[open]{
 border:1px solid var(--blue);box-shadow:none;
}
#payoutOptResults .reverse-candidate[open]>summary{
 background:var(--panel2);border-bottom:1px solid var(--line);
}
#payoutOptResults .reverse-candidate-name{
 font-size:11px;line-height:1.35;flex:1 1 280px;
}
#payoutOptResults .reverse-candidate-status{font-size:10px}
#payoutOptResults .reverse-summary-kpis{gap:5px}
#payoutOptResults .reverse-compact-metric{
 background:transparent;border:0;border-radius:0;padding:1px 5px;
 border-left:1px solid var(--line);
}
#payoutOptResults .reverse-compact-metric:first-child{border-left:0}
#payoutOptResults .reverse-compact-metric strong{font-size:11px}
#payoutOptResults .reverse-candidate-body{background:var(--panel);padding:8px 10px}
#payoutOptResults .reverse-detail-label{border:0;margin:5px 0;padding:2px 0;font-size:10px}
#payoutOptResults .reverse-review-panel,#payoutOptResults .reverse-diagnostic,#payoutOptResults .reverse-trade-details{
 margin:4px 0;border:0;border-bottom:1px solid var(--line);border-radius:0;
}
#payoutOptResults .reverse-review-panel>summary,#payoutOptResults .reverse-diagnostic>summary,#payoutOptResults .reverse-trade-details>summary{
 background:transparent;padding:8px 2px;font-size:11px;
}
#payoutOptResults .reverse-review-panel[open],#payoutOptResults .reverse-diagnostic[open],#payoutOptResults .reverse-trade-details[open]{
 border-left:0;
}
#payoutOptResults .reverse-review-panel[open]>summary,#payoutOptResults .reverse-diagnostic[open]>summary,#payoutOptResults .reverse-trade-details[open]>summary{
 border-bottom:1px solid var(--line);
}
#payoutOptResults .reverse-meta-details{margin-top:11px;border-top:1px solid var(--line);padding:5px 0}
#payoutOptResults .reverse-meta-details>summary{cursor:pointer;font-size:11px;font-weight:600;color:var(--muted);padding:5px 2px}
#payoutOptResults .reverse-kpis>div{background:transparent}
@media(max-width:650px){
 #payoutOptResults .reverse-candidate-name{flex-basis:100%}
 #payoutOptResults .reverse-summary-kpis{justify-content:flex-start}
 #payoutOptResults .reverse-compact-metric{padding:2px 5px}
 #payoutOptResults .reverse-sort-bar small{display:none}
}

 .reverse-option-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:1px 0 10px;padding-bottom:9px;border-bottom:1px solid var(--line)}
 .reverse-option-actions button{min-height:32px;padding:6px 11px;font-size:11px;white-space:normal;text-align:center}
 .reverse-option-actions small{font-size:10px;color:var(--muted);flex:1 1 240px}
 @media(max-width:650px){.reverse-option-actions button{flex:1 1 100%}}

 #payoutOptResults .reverse-risk-tier{display:block;font-size:9px;color:var(--muted);font-weight:500;margin-top:2px}
 #payoutOptResults .reverse-review-panel table td{font-variant-numeric:tabular-nums}
 
 .reverse-model-comparison{margin:6px 0 9px;border-bottom:1px solid var(--line)}
 .reverse-model-comparison>summary{cursor:pointer;padding:8px 5px;font-size:11px}
 .reverse-model-comparison .hint{margin:5px}
 .reverse-model-table{width:100%;min-width:840px;border-collapse:collapse;font-size:10px}
 .reverse-model-table th,.reverse-model-table td{padding:6px 7px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap;font-variant-numeric:tabular-nums}
 .reverse-model-table th:first-child,.reverse-model-table td:first-child{text-align:left}
 .reverse-model-table thead{background:var(--panel2)}
 .reverse-model-table details>summary{cursor:pointer;font-size:10px;margin:3px 0}
 .reverse-model-table details[open]{min-width:180px}
 .reverse-model-phase{font-size:10px;line-height:1.35;white-space:normal;padding:2px 0}
 .reverse-option-actions button[data-reverse-more-models]{font-size:11px}

 .payout-more-settings{border:1px solid var(--line);border-radius:6px;margin:8px 0 5px;padding:5px 8px}
 .payout-more-settings>summary{cursor:pointer;font-weight:650;font-size:11px}
 .payout-more-settings-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:8px 0}
 .payout-more-settings-fields label{font-size:10px;font-weight:650;display:flex;flex-direction:column;gap:4px;min-width:0}
 .payout-more-settings-fields select{width:100%;min-height:30px;font-size:12px}
 .payout-more-sort{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:5px 0}
 .payout-more-sort label{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:650}
 .payout-more-sort select{min-height:30px;max-width:220px;font-size:11px}
 .payout-more-sort button{min-height:29px;padding:5px 9px;font-size:11px}
 .payout-more-sort .hint{flex:1 1 150px;font-size:10px}
 .payout-more-model-reason{display:block;margin:4px 0;color:var(--muted);font-weight:400;max-width:250px;white-space:normal;font-size:10px;line-height:1.35}
 .payout-more-help{margin:5px 0;padding:4px 0;font-size:10px}
 .payout-more-help>summary{cursor:pointer;font-weight:650}
 @media(max-width:650px){.payout-more-settings-fields{grid-template-columns:1fr}.payout-more-settings-fields select,.payout-more-sort select{font-size:16px;min-height:35px}}
  #payoutOptimizerPanel .payout-advisor{margin:9px 0;border:1px solid var(--line);border-radius:7px;overflow:hidden}
 #payoutOptimizerPanel .payout-advisor[hidden]{display:none}
 #payoutOptimizerPanel .payout-advisor>summary{cursor:pointer;padding:9px 10px;background:var(--panel2);font-size:12px}
 #payoutOptimizerPanel .payout-advisor>summary strong{font-size:12px}
 #payoutOptimizerPanel .payout-advisor>summary span{font-size:11px;color:var(--muted)}
 #payoutOptimizerPanel .payout-advisor[open]>summary{border-bottom:1px solid var(--line)}
 #payoutOptimizerPanel .payout-advisor-body{padding:10px;display:grid;gap:8px}
 #payoutOptimizerPanel .payout-advisor-controls{display:grid;grid-template-columns:minmax(150px,1fr) minmax(170px,1.5fr) auto;gap:7px;align-items:end}
 #payoutOptimizerPanel .payout-advisor-controls label{display:grid;gap:3px;font-size:11px;font-weight:600;min-width:0}
 #payoutOptimizerPanel .payout-advisor-controls select,#payoutOptimizerPanel .payout-advisor-controls input{width:100%;min-width:0;min-height:34px;font-size:12px}
 #payoutOptimizerPanel .payout-advisor-controls button{min-height:34px;padding:6px 12px}
 #payoutOptimizerPanel .payout-advisor-topics{display:flex;gap:5px;flex-wrap:wrap}
 #payoutOptimizerPanel .payout-advisor-topics button{padding:5px 8px;min-height:28px;font-size:11px}
 #payoutOptimizerPanel .payout-advisor-topics button[aria-pressed="true"]{border-color:var(--blue);font-weight:700}
 #payoutOptimizerPanel .payout-advisor-suggestions{display:grid;gap:6px}
 #payoutOptimizerPanel .payout-advisor-suggestions>strong{font-size:11px}
 #payoutOptimizerPanel .payout-advisor-suggestion-list{display:flex;gap:5px;flex-wrap:wrap}
 #payoutOptimizerPanel .payout-advisor-suggestion-list button{font-size:11px;line-height:1.4;min-height:30px;padding:5px 9px;white-space:normal;text-align:left;max-width:100%}
 @media(max-width:650px){#payoutOptimizerPanel .payout-advisor-suggestion-list button{flex:1 1 100%}}
  #payoutOptimizerPanel .payout-advisor-answer{padding:10px;border:1px solid var(--line);border-radius:6px;font-size:12px;line-height:1.48}
 #payoutOptimizerPanel .payout-advisor-review{border:1px solid var(--line);border-radius:7px;padding:7px}
 #payoutOptimizerPanel .payout-advisor-review summary{cursor:pointer;font-size:12px}
 #payoutOptimizerPanel .payout-advisor-log-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}
 #payoutOptimizerPanel .payout-advisor-log-entry{border-top:1px solid var(--line);padding:6px 0;font-size:11px;overflow-wrap:anywhere}
 #payoutOptimizerPanel .payout-advisor-log-entry strong{display:block;margin-bottom:3px}
 #payoutOptimizerPanel .payout-advisor-answer>strong{display:block;margin-bottom:5px}
 #payoutOptimizerPanel .payout-advisor-answer p{margin:5px 0}
 @media(max-width:650px){#payoutOptimizerPanel .payout-advisor-controls{grid-template-columns:1fr}#payoutOptimizerPanel .payout-advisor-controls input,#payoutOptimizerPanel .payout-advisor-controls select{font-size:16px}}
 #payoutOptimizerPanel .payout-model-collapse{margin:8px 0;border:1px solid var(--line);border-radius:7px;overflow:hidden}
 #payoutOptimizerPanel .payout-model-collapse[hidden]{display:none}
 #payoutOptimizerPanel .payout-model-collapse>summary{display:flex;align-items:center;gap:6px;flex-wrap:wrap;cursor:pointer;background:var(--panel2);padding:9px 10px;list-style:none;font-size:12px}
 #payoutOptimizerPanel .payout-model-collapse>summary::-webkit-details-marker{display:none}
 #payoutOptimizerPanel .payout-model-collapse>summary:before{content:'▸';font-size:11px;color:var(--muted)}
 #payoutOptimizerPanel .payout-model-collapse[open]>summary:before{content:'▾'}
 #payoutOptimizerPanel .payout-model-collapse>summary strong{font-size:12px}
 #payoutOptimizerPanel #payoutOptModelSummary{font-size:11px;color:var(--muted);flex:1 1 170px}
 #payoutOptimizerPanel .payout-model-collapse-toggle{font-size:10px;color:var(--muted)}
 #payoutOptimizerPanel .payout-model-collapse[open]>summary{border-bottom:1px solid var(--line)}
 #payoutOptimizerPanel .payout-model-collapse-body{padding:7px 8px;min-width:0}
 @media(max-width:650px){#payoutOptimizerPanel .payout-model-collapse>summary{padding:8px}#payoutOptimizerPanel .payout-model-collapse-body{padding:5px}}
 #payoutOptMoreModels:not(:empty){margin:13px 0;border-top:2px solid var(--line);padding-top:8px}
 .payout-more-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
 .payout-more-title strong{font-size:13px}
 .payout-more-title small{font-size:10px;color:var(--muted);flex:1 1 220px}
 .payout-more-title button{font-size:11px;min-height:28px;padding:5px 9px}
 .payout-more-table{width:100%;min-width:770px;border-collapse:collapse;font-size:10px}
 .payout-more-table[data-view="trading"] .payout-col-accounts{display:none}
 .payout-more-table[data-view="accounts"] .payout-col-trading{display:none}
 .payout-more-table[data-view="accounts"]{min-width:750px}
 .payout-more-table[data-view="all"]{min-width:1350px}
 .payout-more-table th,.payout-more-table td{padding:6px 7px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap;font-variant-numeric:tabular-nums}
 .payout-more-table th:first-child{text-align:left;min-width:180px}
 .payout-more-table thead{background:var(--panel2)}
 .payout-more-table details>summary{font-size:10px;cursor:pointer;margin:4px 0}
 .payout-more-phase{white-space:normal;line-height:1.4;font-size:10px;font-weight:400;padding:3px 0}
 .payout-more-table button{font-size:10px;padding:5px 7px;min-height:27px}
 .payout-model-actions{display:flex;gap:4px;align-items:center;justify-content:flex-end}
 `;document.head.appendChild(style);
 const key='4ds:v1:'+bridge.user+':payout-optimizer:v1';
 let prior={};try{prior=JSON.parse(localStorage.getItem(key)||'{}')}catch(_){}
 for(const [name,id] of [['per','payoutOptPer'],['max','payoutOptMax'],['roi','payoutOptRoi'],['netRoi','payoutOptNetRoi'],['netPnl','payoutOptNetPnl'],['minRR','payoutOptMinRR'],['maxRR','payoutOptMaxRR']])
  if(prior[name]!=null)$(id).value=String(prior[name]);
 if(Number($('payoutOptNetPnl').value)<=0)$('payoutOptNetPnl').value='5000';
 panel.open=!window.matchMedia('(max-width:650px)').matches&&prior.open===true;

 $('payoutOptSignals').innerHTML=Array.from({length:20},(_,i)=>'<option>'+String(i+1)+'</option>').join('');
 const assumptionIds={days:'payoutOptDays',pace:'payoutOptPace',tradesPerDay:'payoutOptSignals',winRate:'payoutOptWinRate',
  purchaseMode:'payoutOptPurchase',signalMode:'payoutOptSignalMode',reinvestPayouts:'payoutOptReinvest',
  capacityMode:'payoutOptCapacity',maxActive:'payoutOptMaxActive',maxBuysPerDay:'payoutOptBuys',seed:'payoutOptSeed',
  p1MinDays:'payoutOptP1Days',p2MinDays:'payoutOptP2Days',wait:'payoutOptWait',processing:'payoutOptProcessing'};
 const accountAssumptions=prior.assumptionsByAccount||{};
 function loadAssumptions(reset=false){
  const key=$('payoutOptAccount').value,row=bridge.getRows().find(r=>r.id+':'+r.size===key);
  if(!row)return;
  const base=bridge.getInputs(row),p=bridge.getPlan(row);
  const inherited={days:base.days,pace:base.signalPace==='weekly20'?'weekly20':'daily',tradesPerDay:base.tradesPerDay,winRate:base.winRate,
   purchaseMode:base.purchaseMode,signalMode:base.signalMode,reinvestPayouts:base.reinvestPayouts?'yes':'no',
   capacityMode:base.capacityMode,maxActive:base.maxActive,maxBuysPerDay:base.maxBuysPerDay,seed:base.seed,
   p1MinDays:p.riskProfiles.p1?.minDays??0,p2MinDays:p.riskProfiles.p2?.minDays??0,
   wait:p.payoutWaitCalendarDays??0,processing:p.payoutProcessingCalendarDays??0};
  if(reset)accountAssumptions[key]=inherited;
  const vals={...inherited,...(accountAssumptions[key]||{})};
  for(const [name,id] of Object.entries(assumptionIds))$(id).value=String(vals[name]);
  $('payoutOptSignals').disabled=vals.pace==='weekly20';
  $('payoutOptP2Days').disabled=!p.riskProfiles.p2;
  $('payoutOptWait').disabled=p.id==='topstep';
  const usd=n=>Number.isFinite(n)?'$'+n.toLocaleString():'not set';
  $('payoutOptLimits').textContent='Firm rules (read-only): daily '+usd(p.dailyLoss)+
   ' · overall '+usd(p.overallLoss)+' · reserve '+usd(p.riskReserve)+
   (p.id==='topstep'?' · funded winning-day eligibility applies':'');
  $('payoutOptAssumptionsSummary').textContent='· '+vals.days+'d · '+(vals.pace==='weekly20'?'20 signals/week':vals.tradesPerDay+' signals/day')+
   ' · '+vals.winRate+'% WR';
 }
 function storeAssumptions(){
  const key=$('payoutOptAccount').value;if(!key)return;
  const v={};for(const [name,id] of Object.entries(assumptionIds))v[name]=$(id).value;
  accountAssumptions[key]=v;
  $('payoutOptSignals').disabled=v.pace==='weekly20';
  $('payoutOptAssumptionsSummary').textContent='· '+v.days+'d · '+(v.pace==='weekly20'?'20 signals/week':v.tradesPerDay+' signals/day')+
   ' · '+v.winRate+'% WR';
 }

 let loadedAssumptionsAccount='';
 function syncOptions(){
  const list=bridge.getRows(),select=$('payoutOptAccount'),existing=select.value||prior.account||'';
  select.innerHTML=[...new Map(list.map(r=>[r.id+':'+r.size,r])).entries()]
   .map(([id,r])=>'<option value="'+escape(id)+'">'+escape(bridge.label(r))+'</option>').join('');
  if([...select.options].some(o=>o.value===existing))select.value=existing;
  if(loadedAssumptionsAccount!==select.value){
   loadAssumptions();loadedAssumptionsAccount=select.value;
  }
 }
 const acctValue=()=>$('payoutOptAccount').value;
 function save(){
  try{localStorage.setItem(key,JSON.stringify({per:$('payoutOptPer').value,
   max:$('payoutOptMax').value,roi:$('payoutOptRoi').value,netRoi:$('payoutOptNetRoi').value,netPnl:$('payoutOptNetPnl').value,minRR:$('payoutOptMinRR').value,maxRR:$('payoutOptMaxRR').value,
   assumptionsByAccount:accountAssumptions,assumptionsOpen:$('payoutOptAssumptions').open,
   account:$('payoutOptAccount').value,sortMode:currentSortMode,open:panel.open}))}catch(_){}
 }
 function updateInputSummary(){
  const account=$('payoutOptAccount'),accountName=account?.selectedOptions?.[0]?.textContent?.trim()||'Select account';
  const n=Number($('payoutOptNetPnl').value),p=Number($('payoutOptPer').value),budget=Number($('payoutOptMax').value);
  const value=x=>Number.isFinite(x)?String.fromCharCode(36)+x.toLocaleString('en-US',{maximumFractionDigits:0}):'—';
  $('payoutOptInputsSummary').textContent=' · '+accountName+' · Goal '+value(n)+
   ' · Payout '+value(p)+' · Limit '+value(budget);
 }
 function math(){
  const a=Number($('payoutOptNetPnl').value),b=Number($('payoutOptPer').value);
  updateInputSummary();
  $('payoutOptMath').textContent=a>0&&b>0?
   'At least '+Math.ceil(a/b)+' payouts at $'+b.toLocaleString('en-US')+' each before fees. Additional payouts may be required to net $'+a.toLocaleString('en-US')+'.':
   'Enter positive payout amounts.';
 }
 $('payoutOptAssumptions').open=prior.assumptionsOpen===true;
 $('payoutOptInputsPanel').open=true;
 syncOptions();math();
 for(const id of ['payoutOptPer','payoutOptMax','payoutOptRoi','payoutOptNetRoi','payoutOptNetPnl','payoutOptMinRR','payoutOptMaxRR','payoutOptAccount']){
  $(id).addEventListener('change',()=>{math();save()});
 }
 panel.addEventListener('toggle',save);
 $('payoutOptAssumptions').addEventListener('toggle',save);
 for(const id of Object.values(assumptionIds))$(id).addEventListener('change',()=>{storeAssumptions();save()});
 $('payoutOptReset').addEventListener('click',()=>{loadAssumptions(true);storeAssumptions();save()});
 $('payoutOptAccount').addEventListener('change',()=>{loadAssumptions();loadedAssumptionsAccount=acctValue();save()});
 let currentSortMode=['model','net','weeklyNet','budgetRoi','feeRoi','chance','payouts','investment','costGoal','firstDay'].includes(prior.sortMode)?prior.sortMode:'model';
 let lastOptimizerRecordId=null;
 let lastOptimizerOutput=null,lastOptimizerAccountKey='',lastOptimizerInputs=null,lastModelSearch=null,moreSortKey='net',moreDescending=true,moreColumnView='trading',moreSourceFilter='all';
 document.addEventListener('portfolio-investment-import',event=>{
  const key=event.detail?.accountKey||'';
  if(!key||!bridge.getRows().some(r=>r.id+':'+r.size===key))return;
  const field=$('payoutOptAccount');
  if(!Array.from(field.options).some(x=>x.value===key))syncOptions();
  field.value=key;
  loadAssumptions();loadedAssumptionsAccount=acctValue();
  lastOptimizerOutput=null;lastOptimizerInputs=null;lastOptimizerAccountKey='';lastModelSearch=null;$('payoutOptMoreModels').innerHTML='';refreshAdvisor();
  $('payoutOptResults').innerHTML='';
  $('payoutOptStatus').textContent='Imported simulator-only model: '+(event.detail?.title||'selected risk setup')+
   '. Review the investment budget and assumptions, then Calculate Investment. No Firms rules changed.';
  math();save();panel.open=true;
  panel.scrollIntoView({behavior:'smooth',block:'start'});
 }); 

 const advisorSelectedUser=localStorage.getItem('4ds:active-user:v1');
 const advisorUser=['doen','dori','dona','dion'].includes(advisorSelectedUser)?advisorSelectedUser:'dori';
 const advisorLogKey='4ds:v1:'+advisorUser+':results-advisor-review:v1';
 function needsAdvisorReview(question,topic){
  const q=String(question||'').toLowerCase();
  return topic==='unknown'||/why.{0,70}(funded|risk|risking|drawdown)|(?:funded|risk|risking).{0,55}(too much|too high|excessive|unsafe)/.test(q);
 }
 function normalizeAdvisorEntries(items){
  return items.map(x=>x&&typeof x==='object'&&needsAdvisorReview(x.question,x.topic)&&x.status==='answered'?
   {...x,status:'needs-review',reviewNotes:x.reviewNotes||'Qualitative risk diagnosis requires GPT investigation; generic risk settings are not a sufficient explanation.'}:x);
 }
 function readAdvisorLog(){
  try{const x=JSON.parse(localStorage.getItem(advisorLogKey)||'[]');return Array.isArray(x)?normalizeAdvisorEntries(x):[];}catch(_){return [];}
 }
 const advisorEndpoint=String(root.FOUR_DS_CLOUD_ENDPOINT||'').trim();
 const advisorCloudValid=/^https:\/\/script\.google\.com\/macros\/s\/[^/?]+\/exec(?:\?.*)?$/.test(advisorEndpoint);
 let advisorSyncTimer=null,advisorSyncBusy=false,advisorSyncAgain=false;
 function advisorCloudStatus(message){$('payoutAdvisorCloudStatus').textContent=message;}
 function mergeAdvisorLogs(a,b){
  const ids=new Set();
  return [...a,...b].filter(x=>{
   if(!x||!x.id||!x.timestamp||ids.has(x.id))return false;
   ids.add(x.id);return true;
  }).sort((x,y)=>String(y.timestamp).localeCompare(String(x.timestamp))).slice(0,50);
 }
 function readAdvisorCloud(){
  return new Promise((resolve,reject)=>{
   if(!advisorCloudValid){reject(new Error('Cloud endpoint is not configured'));return;}
   const cb='fourDsAdvisor_'+Math.random().toString(36).slice(2),el=document.createElement('script');
   const timer=setTimeout(()=>{cleanup();reject(new Error('Cloud read timeout'));},14000);
   function cleanup(){clearTimeout(timer);try{delete root[cb];}catch(_){}el.remove();}
   root[cb]=data=>{cleanup();data?.ok===true?resolve(data):reject(new Error(data?.error||'Cloud rejected read'));};
   el.onerror=()=>{cleanup();reject(new Error('Cloud read failed'));};
   el.src=advisorEndpoint+(advisorEndpoint.includes('?')?'&':'?')+new URLSearchParams({user:advisorUser,callback:cb,t:Date.now()});
   document.head.appendChild(el);
  });
 }
 async function syncAdvisorLog(){
  if(advisorSyncBusy){advisorSyncAgain=true;return;}
  if(!advisorCloudValid){advisorCloudStatus('Saved in browser · Cloud endpoint unavailable');return;}
  advisorSyncBusy=true;
  let ok=false;
  try{
   for(let attempt=0;attempt<3;attempt++){
    advisorCloudStatus('Syncing Q&A to cloud…');
    const remote=await readAdvisorCloud(),old=remote.snapshot;
    if(old&&(old.schema!=='4ds-profile-export-v1'||old.user!==advisorUser||
       !old.entries||typeof old.entries!=='object'))throw new Error('Unexpected cloud profile format');
    let cloudRecords=[];
    try{const x=JSON.parse(old?.entries?.[advisorLogKey]||'[]');if(Array.isArray(x))cloudRecords=x;}catch(_){}
    const combined=normalizeAdvisorEntries(mergeAdvisorLogs(readAdvisorLog(),cloudRecords));
    const entries={...(old?.entries||{}),[advisorLogKey]:JSON.stringify(combined)};
    const nonce=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    const snapshot={schema:'4ds-profile-export-v1',user:advisorUser,nonce,entries};
    const serialized=JSON.stringify(snapshot);
    if(serialized.length>850000)throw new Error('Cloud profile storage limit reached');
    const request=new URLSearchParams({user:advisorUser,expectedRevision:remote.revision||'',
      force:'no',snapshot:serialized});
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{await fetch(advisorEndpoint,{method:'POST',mode:'no-cors',body:request,cache:'no-store',signal:controller.signal});}
    finally{clearTimeout(timeout);}
    const verified=await readAdvisorCloud();
    if(verified.snapshot?.nonce===nonce){
     localStorage.setItem(advisorLogKey,JSON.stringify(combined));
     localStorage.setItem('4ds:cloud:last-revision:'+advisorUser,verified.revision||'');
     renderAdvisorLog();advisorCloudStatus('Cloud verified · '+new Date().toLocaleTimeString());
     ok=true;break;
    }
   }
   if(!ok)throw new Error('Cloud update conflict; retry manually');
  }catch(error){advisorCloudStatus('Browser saved · Cloud not verified: '+error.message);}
  finally{
   advisorSyncBusy=false;
   if(advisorSyncAgain){advisorSyncAgain=false;queueAdvisorSync();}
  }
 }
 function queueAdvisorSync(){
  clearTimeout(advisorSyncTimer);
  advisorSyncTimer=setTimeout(syncAdvisorLog,1800);
 }
 function renderAdvisorLog(){
  const records=readAdvisorLog(),host=$('payoutAdvisorLog');
  $('payoutAdvisorLogCount').textContent=records.length+' recorded · '+records.filter(x=>x.status==='needs-review').length+' needs GPT review';
  host.textContent='';
  for(const item of records.slice(0,15)){
   const row=document.createElement('div');row.className='payout-advisor-log-entry';
   const head=document.createElement('strong');head.textContent=(item.status==='needs-review'?'Needs GPT review':'Answered')+' · '+new Date(item.timestamp).toLocaleString()+' · '+item.model;
   const q=document.createElement('div');q.textContent=item.question;
   row.append(head,q);host.appendChild(row);
  }
 }
 function recordAdvisorQuestion(question,topic,record,reply){
  if(!question||!record)return;
  const avg=record.result?.avg||{},score=record.score||{};
  const entry={
   id:'aq-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),
   timestamp:new Date().toISOString(),user:advisorUser,model:record.name,modelKey:record.key,
   account:{firm:record.plan?.firm||'',size:record.plan?.size||0},
   question:String(question).slice(0,240),topic,
   status:needsAdvisorReview(question,topic)?'needs-review':'answered',
   answer:{title:reply.title,lines:reply.lines,tests:reply.tests},
   metrics:{net:avg.net,spent:avg.spent,bought:avg.bought,failed:avg.failed,
    exhausted:avg.exhausted,funded:avg.funded,paid:avg.paid,goalChance:score.hit,
    budget:record.budget,netGoal:lastOptimizerOutput?.minNetPnl},
   reviewedAt:null,reviewNotes:null
  };
  const items=readAdvisorLog();
  if(items[0]?.question===entry.question&&items[0]?.model===entry.model&&
   Date.now()-Date.parse(items[0].timestamp)<20000)return;
  items.unshift(entry);
  try{
   localStorage.setItem(advisorLogKey,JSON.stringify(items.slice(0,50)));
   queueAdvisorSync();
  }catch(e){console.warn('Advisor log storage unavailable',e);}
  renderAdvisorLog();
 }
 function exportAdvisorLog(){
  const payload={schema:'4ds-results-advisor-review-v1',user:advisorUser,
   exportedAt:new Date().toISOString(),records:readAdvisorLog()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='trading-studio-advisor-review-'+advisorUser+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
 }
 $('payoutAdvisorExport').addEventListener('click',exportAdvisorLog);
 $('payoutAdvisorSync').addEventListener('click',syncAdvisorLog);
 renderAdvisorLog();
 if(advisorCloudValid)syncAdvisorLog();
 else advisorCloudStatus('Browser only · Cloud endpoint unavailable');
 let advisorTopic='overview';
 function advisorRecords(){
  if(!lastOptimizerOutput)return [];
  const base=lastOptimizerOutput.candidates.map((candidate,i)=>({
   key:'original:'+i,name:'Investment Option '+(i+1)+' · '+(candidate.r3Route||candidate.riskMode),
   plan:candidate.plan,result:candidate.result,score:candidate.score,budget:candidate.initialBudget
  }));
  const extra=lastModelSearch?.result?.ideas?.map((idea,i)=>({
   key:'extra:'+i,name:idea.title,plan:idea.plan,result:idea.holdout,
   score:solver.assess(idea.holdout,lastOptimizerOutput.requiredPayouts,
    lastOptimizerOutput.minNetPnl,lastOptimizerOutput.perPayout),
   budget:lastModelSearch.candidate.initialBudget
  }))||[];
  return [...base,...extra];
 }
 function advisorMoney(n){
  return n!=null&&Number.isFinite(Number(n))?String.fromCharCode(36)+Math.round(Number(n)).toLocaleString('en-US'):'—';
 }
 function advisorPct(n){
  return n!=null&&Number.isFinite(Number(n))?(100*Number(n)).toFixed(1)+'%':'—';
 }
 function advisorAnswer(topic,record,all){
  const s=record.score||{},r=record.result||{},avg=r.avg||{},plan=record.plan||{};
  const input=lastOptimizerOutput||{},settings=lastOptimizerInputs||{};
  const bought=Number(avg.bought)||0,paid=Number(avg.paid)||0;
  const funded=Number(avg.funded)||0,net=Number(avg.net)||0,spent=Number(avg.spent)||0;
  const stages=root.StudioPortfolioEngine?.stageFunnel?.(r)||[];
  const visible=stages.filter(x=>!/Funded activated|Express Funded activated/.test(x.label));
  const eligible=visible.slice(1).filter(x=>x.previousRate!=null&&x.previousRate>=0);
  const weakest=eligible.length?eligible.reduce((a,b)=>a.previousRate<=b.previousRate?a:b):null;
  const blocked=Number(avg.exhausted)||0,breached=Number(avg.failed)||0;
  const lines=[],tests=[];
  const add=(sentence)=>lines.push(sentence);
  const test=(sentence)=>tests.push(sentence);
  let title='';
  if(topic==='overview'){
   title='Summary of '+record.name;
   add('Expected net P&L '+advisorMoney(net)+' with '+advisorMoney(spent)+' mean incurred fees and '+advisorPct(s.hit)+' chance of completing both payout-count and net-profit targets in the modeled horizon.');
   add('On average: '+bought.toFixed(2)+' purchased challenges, '+funded.toFixed(2)+' funded accounts, and '+paid.toFixed(2)+' accounts with a first payout.');
   add('Reported win rate '+advisorPct(r.tradeKpis?.wr)+'; modeled fee ROI '+advisorPct(r.roi)+'. These describe simulated results, not real-world win-rate evidence.');
   if(paid<Number(input.requiredPayouts||0))test('Inspect stage conversion and payout delays before increasing the number of purchased accounts.');
   else test('Stress-test lower win rates and payout delays before relying on these averages.');
  }else if(topic==='bottleneck'){
   title='Main observed bottlenecks';
   if(!bought)add('No challenges were purchased in the modeled trials. Without purchased accounts, funded payouts are impossible.');
   else{
    if(weakest)add('Lowest adjacent milestone conversion: '+weakest.label+' · '+advisorPct(weakest.previousRate)+' from the prior milestone within '+settings.days+' trading days.');
    if(blocked>=Math.max(.5,bought*.1))add(blocked.toFixed(2)+' accounts on average are risk-blocked versus '+breached.toFixed(2)+' breached. Risk-blocked does not mean a firm-rule breach.');
    if(funded>paid&&paid<funded*.6)add('Only '+paid.toFixed(2)+' of '+funded.toFixed(2)+' average funded accounts reach their first payout by the horizon; some are still progressing or awaiting eligibility.');
    if(net<Number(input.minNetPnl||0))add('Average net profit is '+advisorMoney(Number(input.minNetPnl)-net)+' below the requested net target. A positive average alone does not establish goal probability.');
   }
   if(lines.length===0)add('No single dominant bottleneck meets the advisor thresholds; inspect downside P10, model variance and payout completion before choosing a model.');
   test('Compare a longer realistic horizon and verify that risk size, trade opportunity count and account capacity are consistent with your trading plan.');
  }else if(topic==='funnel'){
   title='Where accounts progress or stop';
   if(!visible.length)add('No phase-funnel data was returned for this model.');
   visible.forEach((item,i)=>{
    const prior=i&&visible[i-1].count>0?item.count/visible[i-1].count:null;
    const total=bought>0?item.count/bought:null;
    add(item.label+': '+Number(item.count).toFixed(2)+' mean accounts · '+(i?'prior '+advisorPct(prior)+' · ':'')+'total '+advisorPct(total)+'.');
   });
   test('Check the stage with the weakest completed conversion. These percentages reflect the selected horizon, not lifetime eventual pass rates.');
  }else if(topic==='rr'){
   title='Planned risk-to-reward (RR)';
   for(const stage of plan.stageList||[]){
    const p=plan.riskProfiles?.[stage];if(!p)continue;
    add((p.name||stage)+': planned reward-to-risk '+Number(p.rr||0).toFixed(2)+'R per trade (for example, 3R means planned profit is three times planned loss).');
   }
   add('These are the configured target RRs, not the actual realized average RR or a guarantee of hitting take profit.');
   test('To inspect realized trade outcomes, use the Trade Risks & Detailed Accounts report and compare average win/loss sizes.');
  }else if(topic==='risk'){
   title='Risk sizing and recovery';
   for(const stage of plan.stageList||[]){
    const p=plan.riskProfiles?.[stage];
    if(!p)continue;
    const mode=p.policy?.mode||'saved';
    const dynamic=['target-now','repair-r2','buffered-target'].includes(mode);
    const risks=dynamic&&root.StudioPortfolioEngine?.previewLossPath?
     root.StudioPortfolioEngine.previewLossPath(plan,stage,3).map(t=>t.allowed?advisorMoney(t.risk)+' ('+t.slot.toUpperCase()+')':'blocked'):
     ['r1','r2','r3'].map(t=>advisorMoney(p[t]));
    add((p.name||stage)+': '+mode+' · '+(dynamic?'first trade / after losses ':'R1 / R2 / R3 ')+risks.join(' / ')+
     ' · planned RR '+Number(p.rr||0).toFixed(2)+'R.');
   }
   add('Simulation: '+blocked.toFixed(2)+' risk-blocked and '+breached.toFixed(2)+' breached accounts on average.');
   test('Compare smaller risk caps or recovery policies in Find More Risk Models. Adaptive trade amounts change with account P&L and remaining headroom.');
  }else if(topic==='payout'){
   title='Payout path and timing';
   add('Average accounts: funded '+funded.toFixed(2)+', funded profit target reached '+Number(avg.targetHit||0).toFixed(2)+', payout requested '+Number(avg.payoutRequested||0).toFixed(2)+', first payout received '+paid.toFixed(2)+'.');
   add('Average first payout day (only trials with a paid account): '+(s.firstPayoutDay==null?'not reached':'day '+Number(s.firstPayoutDay).toFixed(1))+
    '. Selected horizon: '+(settings.days||'—')+' trading days.');
   add('Chance of at least one payout '+advisorPct(r.chancePayout)+'; chance of BOTH payout count and net cash target '+advisorPct(s.hit)+'.');
   test('Test a longer trading horizon while preserving mandatory stage minimum days, payout waits, and processing delays.');
  }else if(topic==='cost'){
   title='Spending and investment efficiency';
   add('Average payouts received '+advisorMoney(avg.receipts)+' minus incurred costs '+advisorMoney(spent)+' = expected net '+advisorMoney(net)+'.');
   add('Starting investment '+advisorMoney(record.budget)+'; fee ROI '+advisorPct(r.roi)+' and return on starting investment '+advisorPct(record.budget>0?net/record.budget:null)+'.');
   add('Average challenges bought '+bought.toFixed(2)+'. Reserved starting budget and incurred fees are different quantities.');
   add('Modeled fees per successful full goal: '+(s.costPerGoal==null?'not estimable (0 goal hits in validation)':
    advisorMoney(s.costPerGoal))+' from '+(s.goalHits??0)+' / '+(s.goalTrials??0)+
    ' validation runs, including fees spent in unsuccessful runs. Successful-run fees alone: '+
    (s.spentIfGoal==null?'not observed':advisorMoney(s.spentIfGoal))+'.');
   add('Modeled fees per run with at least one payout: '+(s.costPerPayoutRun==null?'not observed':advisorMoney(s.costPerPayoutRun))+' ('+(s.anyPayoutRuns??0)+' runs with a payout). This is different from the complete net-profit goal cost.');
   test('Compare Cost / Goal Hit at the same trade win-rate, horizon and payout target. It is a model estimate, not a promised real-world purchase cost.');
   test('Use Section 9 Daily Spending Ledger for purchase and payout timing; compare expected net dollars alongside ROI.');
  }else if(topic==='compare'){
   title='Comparison with available models';
   const ranked=all.slice().sort((a,b)=>(b.result?.avg?.net||0)-(a.result?.avg?.net||0));
   if(ranked.length<2)add('Only one model is available. Run Find More Risk Models for alternatives before comparing.');
   else{
    const best=ranked[0],difference=(best.result.avg.net||0)-net;
    add('Highest average net in the currently available models: '+best.name+' at '+advisorMoney(best.result.avg.net)+'; selected model '+advisorMoney(net)+'; difference '+advisorMoney(difference)+'.');
    add('The highest-net model uses '+advisorMoney(best.budget)+' starting budget versus '+advisorMoney(record.budget)+' here. Different budgets and validation trial batches can make direct comparisons misleading.');
    add('Selected goal chance '+advisorPct(s.hit)+'; highest-net model goal chance '+advisorPct(best.score?.hit)+'. These are modeled sensitivities, not proven improvements.');
   }
   test('Compare identical budgets and trial assumptions before interpreting differences. Re-test promising models in the full simulation.');
  }else{
   title='Question outside supported rules';
   add('This free advisor answers questions about net results, payout chances and timing, phase conversion, risks, costs, and comparing existing models. It cannot answer unrestricted questions or predict live market performance.');
   test('Try a question containing payout, funded, risk, R1, costs, ROI, models, or why.');
  }
  return {title,lines,tests};
 }
 function advisorTopicForQuestion(question){
  const q=String(question||'').toLowerCase();
  if(/compar|better model|best model|which model|other model/.test(q))return 'compare';
  if(/\brr\b|risk.reward|reward.risk/.test(q))return 'rr';
  if(/r1|r2|r3|risk|drawdown|loss|stop/.test(q))return 'risk';
  if(/funnel|phase|conversion|funded|pass rate|challenge/.test(q))return 'funnel';
  if(/payout|waiting|delay|day|timing|when paid/.test(q))return 'payout';
  if(/roi|cost|fee|invest|budget|spend|net profit/.test(q))return 'cost';
  if(/why|problem|wrong|bottleneck|fail|improv|suggest/.test(q))return 'bottleneck';
  if(/overview|summary|result|performance/.test(q))return 'overview';
  return 'unknown';
 }
 function suggestedAdvisorQuestions(record,all){
  const avg=record.result?.avg||{},score=record.score||{},s=lastOptimizerOutput||{};
  const bought=Number(avg.bought)||0,funded=Number(avg.funded)||0,paid=Number(avg.paid)||0;
  const blocked=Number(avg.exhausted)||0,failed=Number(avg.failed)||0,spent=Number(avg.spent)||0;
  const net=Number(avg.net)||0,goal=Number(s.minNetPnl)||0;
  const stages=root.StudioPortfolioEngine?.stageFunnel?.(record.result)||[];
  const visible=stages.filter(x=>!/Funded activated|Express Funded activated/.test(x.label));
  const transitions=visible.slice(1).map((x,i)=>({
   label:x.label,rate:visible[i].count>0?x.count/visible[i].count:null
  })).filter(x=>x.rate!=null);
  const worst=transitions.sort((a,b)=>a.rate-b.rate)[0];
  const suggestions=[];
  function add(priority,topic,question){suggestions.push({priority,topic,question});}
  if(goal>0&&Number(score.hit)<.5)
   add(100,'bottleneck','Why is my full payout and net-profit goal chance only '+advisorPct(score.hit)+'?');
  if(blocked>=Math.max(.3,bought*.08))
   add(96,'risk','Why are '+blocked.toFixed(2)+' accounts risk-blocked? Which risk tiers should I test?');
  if(funded>0&&paid<funded*.65)
   add(92,'payout','Why do only '+paid.toFixed(2)+' of '+funded.toFixed(2)+' funded accounts receive payouts?');
  if(worst&&worst.rate<.65)
   add(89,'funnel','Why does conversion to '+worst.label+' fall to '+advisorPct(worst.rate)+'?');
  if(goal>0&&net<goal)
   add(86,'cost','What is keeping net P&L '+advisorMoney(goal-net)+' below my target?');
  if(spent>0&&net<=0)
   add(83,'cost','Why are my '+advisorMoney(spent)+' in incurred fees not covered by payouts?');
  if(goal>0&&Number(score.hit)>0&&Number(score.hit)<.8)
   add(81,'cost','How much in fees does this setup spend per successful full payout and net-profit goal?');
  if(bought>0&&failed/bought>.2)
   add(79,'risk','Are account failures too high compared with purchased challenges?');
  if(all.length>1)
   add(76,'compare','Which available model has higher expected net P&L and what is the trade-off?');
  if(paid>0)
   add(72,'payout','How long until the first payout and what could delay it?');
  if(!suggestions.length)
   add(60,'overview','What is the most important result of this simulation?');
  add(55,'funnel','Which phase loses the most accounts?');
  add(50,'risk','What do my R1, R2 and R3 risk settings actually do?');
  const seen=new Set();
  return suggestions.sort((a,b)=>b.priority-a.priority).filter(x=>{
   if(seen.has(x.topic))return false;
   seen.add(x.topic);return true;
  }).slice(0,5);
 }
 function renderAdvisorSuggestions(record,all){
  const host=$('payoutAdvisorSuggestions');
  host.textContent='';
  if(!record)return;
  const heading=document.createElement('strong');heading.textContent='Suggested questions based on this model';
  host.appendChild(heading);
  const choices=document.createElement('div');choices.className='payout-advisor-suggestion-list';
  for(const item of suggestedAdvisorQuestions(record,all)){
   const button=document.createElement('button');
   button.type='button';button.dataset.advisorSuggest=item.topic;
   button.textContent=item.question;
   choices.appendChild(button);
  }
  host.appendChild(choices);
 }
  function refreshAdvisor(options={}){
  const box=$('payoutResultsAdvisor'),select=$('payoutAdvisorModel');
  const records=advisorRecords();
  box.hidden=!records.length;
  if(!records.length){$('payoutAdvisorAnswer').textContent='';$('payoutAdvisorSuggestions').textContent='';return;}
  const old=select.value;
  select.innerHTML=records.map(r=>'<option value="'+escape(r.key)+'">'+escape(r.name)+'</option>').join('');
  select.value=records.some(r=>r.key===old)?old:records[0].key;
  renderAdvisorSuggestions(records.find(r=>r.key===select.value)||records[0],records);
  $('payoutAdvisorSummary').textContent=' · '+records.length+' models · Free, rule-based';
  if(options.answer!==false)askAdvisor(advisorTopic);
 }
 function askAdvisor(topic,loggedQuestion=null){
  if(!lastOptimizerOutput)return;
  advisorTopic=topic;
  const records=advisorRecords(),record=records.find(r=>r.key===$('payoutAdvisorModel').value)||records[0];
  if(!record)return;
  const reply=advisorAnswer(topic,record,records),answer=$('payoutAdvisorAnswer');
  if(loggedQuestion)recordAdvisorQuestion(loggedQuestion,topic,record,reply);
  answer.textContent='';
  const heading=document.createElement('strong');
  heading.textContent=reply.title;answer.appendChild(heading);
  for(const line of reply.lines){
   const p=document.createElement('p');p.textContent=line;answer.appendChild(p);
  }
  for(const suggestion of reply.tests){
   const p=document.createElement('p'),label=document.createElement('b');
   label.textContent='Test: ';p.appendChild(label);p.appendChild(document.createTextNode(suggestion));answer.appendChild(p);
  }
  for(const button of boxTopics())button.setAttribute('aria-pressed',String(button.dataset.advisorTopic===topic));
 }
 function boxTopics(){return Array.from($('payoutResultsAdvisor').querySelectorAll('[data-advisor-topic]'));}
  function renderUnifiedTable(){
  const box=$('payoutOptMoreModels'),comparison=$('payoutOptModelComparison');
  const original=lastOptimizerOutput?.candidates?.length||0;
  const extra=lastModelSearch?.result?.ideas?.length||0;
  const summary=original+extra+' models · '+original+' investment options'+
   (extra?' · '+extra+' additional models':'');
  $('payoutOptModelSummary').textContent=lastOptimizerOutput?' · '+summary:' · Results appear after Calculate Investment';
  const notice=$('payoutOptResults').querySelector('#fundedComparisonNotice');
  if(notice){
   if(extra){
    notice.innerHTML='<strong>'+original+' original scenarios + '+extra+' funded variants = '+summary+
     '.</strong> <button type="button" data-jump-funded-comparison="1">View all '+(original+extra)+' models in Model comparison</button>'+
     '<span> · The five cards here are only the original optimizer options.</span>';
   }else{
    notice.textContent=original+' original investment cards; additional funded models have not loaded. Check Model comparison or use Test Funded Compounding.';
   }
  }
  comparison.hidden=!lastOptimizerOutput;
  box.innerHTML=lastOptimizerOutput?
   solver.renderUnifiedInvestmentModels(lastOptimizerOutput,lastModelSearch,
    moreSortKey,moreDescending,moreColumnView,moreSourceFilter):'';
  if(lastOptimizerOutput)root.StudioModelDiscovery?.renderFundedPaths?.(box,lastModelSearch);
  refreshAdvisor();
 }
 function renderLastOptimizer(){
  if(!lastOptimizerOutput)return;
  const row=bridge.getRows().find(r=>r.id+':'+r.size===lastOptimizerAccountKey);
  const saved=row?bridge.getSavedPlan?.(row):null;
  $('payoutOptResults').innerHTML=solver.render(lastOptimizerOutput,currentSortMode,saved);
  renderUnifiedTable();
 }
 $('payoutAdvisorModel').addEventListener('change',()=>{
  const all=advisorRecords(),record=all.find(r=>r.key===$('payoutAdvisorModel').value);
  renderAdvisorSuggestions(record,all);
  askAdvisor(advisorTopic);
 });
 $('payoutResultsAdvisor').addEventListener('click',event=>{
  const suggested=event.target.closest?.('[data-advisor-suggest]');
  if(suggested){
   $('payoutAdvisorQuestion').value=suggested.textContent;
   $('payoutResultsAdvisor').open=true;
   askAdvisor(suggested.dataset.advisorSuggest,suggested.textContent);
   return;
  }
  const topic=event.target.closest?.('[data-advisor-topic]');
  if(topic){$('payoutResultsAdvisor').open=true;askAdvisor(topic.dataset.advisorTopic);}
 });
 function submitAdvisorQuestion(){
  const question=$('payoutAdvisorQuestion').value.trim();
  if(!question){askAdvisor('overview');return;}
  $('payoutResultsAdvisor').open=true;
  askAdvisor(advisorTopicForQuestion(question),question);
 }
 $('payoutAdvisorAsk').addEventListener('click',submitAdvisorQuestion);
 $('payoutAdvisorQuestion').addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();submitAdvisorQuestion();}
 });
 async function runFundedComparison(index,{scroll=false}={}){
  const candidate=lastOptimizerOutput?.candidates?.[index];
  if(!candidate||!lastOptimizerInputs)throw Error('Calculate Investment first.');
  if(candidate.plan.id+':'+candidate.plan.size!==lastOptimizerAccountKey)
   throw Error('Account changed. Calculate Investment again.');
  const discovery=root.StudioModelDiscovery;
  if(typeof discovery?.compareFundedRecovery450!=='function')
   throw Error('Funded compounding module is not loaded.');
  const effort=$('payoutMoreEffort')?.value;
  const trials=effort==='deep'?250:effort==='quick'?80:150;
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const result=discovery.compareFundedRecovery450(discovery.clonePlan(candidate.plan),{
   ...lastOptimizerInputs,budget:candidate.initialBudget,
   netGoal:lastOptimizerOutput.minNetPnl,
   requiredPayouts:lastOptimizerOutput.requiredPayouts,testTrials:trials
  });
  if(result?.ideas?.length!==4)throw Error('Expected four funded variants; found '+(result?.ideas?.length??0));
  lastModelSearch={candidate,result,origin:'Investment Option '+(index+1)+' · Funded compounding'};
  moreSortKey='goal';moreDescending=true;moreSourceFilter='all';
  renderUnifiedTable();
  $('payoutOptModelComparison').open=true;
  let saved=' · comparison only available in browser';
  if(lastOptimizerRecordId){
   try{
    const count=bridge.updateOptimizerComparison?.(lastOptimizerRecordId,result);
    if(count===4)saved=' · 4 variants saved to Section 10 (cloud sync attempted)';
   }catch(e){saved=' · history update error: '+e.message;}
  }
  if(scroll)$('payoutOptModelComparison').scrollIntoView({behavior:'smooth',block:'start'});
  return {total:lastOptimizerOutput.candidates.length+result.ideas.length,saved};
 }
 $('payoutOptResults').addEventListener('click',async event=>{
  if(event.target.closest?.('[data-jump-funded-comparison]')){
   const section=$('payoutOptModelComparison');section.open=true;
   section.scrollIntoView({behavior:'smooth',block:'start'});return;
  }
  const openAdvisor=event.target.closest?.('[data-reverse-advisor]');
  if(openAdvisor){
   const index=Number(openAdvisor.dataset.reverseAdvisor);
   if(!lastOptimizerOutput?.candidates?.[index])return;
   $('payoutResultsAdvisor').open=true;
   $('payoutAdvisorModel').value='original:'+index;
   askAdvisor('overview');
   $('payoutResultsAdvisor').scrollIntoView({behavior:'smooth',block:'start'});
   return;
  }
  const funded450=event.target.closest?.('[data-reverse-funded-450]');
  if(funded450){
   const index=Number(funded450.dataset.reverseFunded450),candidate=lastOptimizerOutput?.candidates?.[index];
   const status=funded450.closest('.reverse-candidate-body')?.querySelector('.reverse-review-status');
   if(!candidate||!lastOptimizerInputs||candidate.plan.id+':'+candidate.plan.size!==lastOptimizerAccountKey){
    if(status)status.textContent='Scenario changed. Calculate Investment again.';return;
   }
   if(!root.StudioModelDiscovery?.compareFundedRecovery450){
    if(status)status.textContent='Funded $450 Recovery module unavailable.';return;
   }
   if(funded450.disabled)return;
   const oldLabel=funded450.textContent;funded450.disabled=true;funded450.textContent='Testing funded compounding…';
   if(status)status.textContent='Comparing $450 → $1,800 → $3,150 compounded profit milestones with funded loss recovery and real risk ceilings…';
   try{
    const done=await runFundedComparison(index,{scroll:true});
    if(status)status.textContent='Funded compounding: '+done.total+' models visible.'+done.saved;
   }catch(error){if(status)status.textContent='Funded recovery test failed: '+(error?.message||'Unknown error');}
   finally{funded450.disabled=false;funded450.textContent=oldLabel;}
   return;
  }
  const ladder=event.target.closest?.('[data-reverse-recovery-ladder]');
  if(ladder){
   const index=Number(ladder.dataset.reverseRecoveryLadder),candidate=lastOptimizerOutput?.candidates?.[index];
   const status=ladder.closest('.reverse-candidate-body')?.querySelector('.reverse-review-status');
   if(!candidate||!lastOptimizerInputs||candidate.plan.id+':'+candidate.plan.size!==lastOptimizerAccountKey){
    if(status)status.textContent='Scenario changed. Calculate Investment again before testing.';return;
   }
   if(!root.StudioModelDiscovery?.compareRecoveryLadder){if(status)status.textContent='Recovery + Funded Ladder module unavailable.';return;}
   if(ladder.disabled)return;
   const starter=Number(ladder.closest('.reverse-candidate-body')?.querySelector('[data-reverse-starter]')?.value);
   if(!Number.isFinite(starter)||starter<10||starter>1000){
    if(status)status.textContent='Funded starter must be between $10 and $1,000.';return;
   }
   const oldLabel=ladder.textContent;ladder.disabled=true;ladder.textContent='Testing recovery + ladder…';
   if(status)status.textContent='Comparing evaluation risk recovery and profit-only funded ladders, with the selected original model unchanged…';
   try{
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const effort=$('payoutMoreEffort').value;
    const trials=effort==='deep'?250:effort==='quick'?80:150;
    const opts={...lastOptimizerInputs,budget:candidate.initialBudget,
     netGoal:lastOptimizerOutput.minNetPnl,requiredPayouts:lastOptimizerOutput.requiredPayouts,
     fundedStarterRisk:starter,testTrials:trials};
    const result=root.StudioModelDiscovery.compareRecoveryLadder(
     root.StudioModelDiscovery.clonePlan(candidate.plan),opts);
    lastModelSearch={candidate,result,origin:'Investment Option '+(index+1)+' · Evaluation Recovery / Funded Ladder'};
    moreSortKey='goal';moreDescending=true;moreSourceFilter='all';
    renderUnifiedTable();
    $('payoutOptModelComparison').open=true;
    if(status)status.textContent='Five funded starter variants tested with 3R evaluation recovery. A third consecutive evaluation loss can breach; funded profits can return to zero. Compare goal chance, average payout day, net and blocked accounts in the table. These are simulated scenarios; your saved strategy is unchanged.';
    $('payoutOptModelComparison').scrollIntoView({behavior:'smooth',block:'start'});
   }catch(error){if(status)status.textContent='Recovery + Funded Ladder test failed: '+(error?.message||'Unknown error');}
   finally{ladder.disabled=false;ladder.textContent=oldLabel;}
   return;
  }
  const exact=event.target.closest?.('[data-reverse-target-exact]');
  if(exact){
   const index=Number(exact.dataset.reverseTargetExact),candidate=lastOptimizerOutput?.candidates?.[index];
   const status=exact.closest('.reverse-candidate-body')?.querySelector('.reverse-review-status');
   if(!candidate||!lastOptimizerInputs||candidate.plan.id+':'+candidate.plan.size!==lastOptimizerAccountKey){
    if(status)status.textContent='Scenario changed. Calculate Investment again.';return;
   }
   if(!root.StudioModelDiscovery?.searchTargetExact){if(status)status.textContent='Target-exact search module unavailable.';return;}
   if(exact.disabled)return;
   const oldLabel=exact.textContent;exact.disabled=true;exact.textContent='Finding target-exact models…';
   if(status)status.textContent='Testing risk sized to each remaining phase target with fixed budget, RR and paired trade outcomes…';
   try{
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const effort=$('payoutMoreEffort').value;
    const trials=effort==='deep'?250:effort==='quick'?80:150;
    const opts={...lastOptimizerInputs,budget:candidate.initialBudget,
     netGoal:lastOptimizerOutput.minNetPnl,
     requiredPayouts:lastOptimizerOutput.requiredPayouts,testTrials:trials};
    const result=root.StudioModelDiscovery.searchTargetExact(
     root.StudioModelDiscovery.clonePlan(candidate.plan),opts);
    lastModelSearch={candidate,result,origin:'Investment Option '+(index+1)+' · Target-exact'};
    moreSortKey='goal';moreDescending=true;moreSourceFilter='all';
    renderUnifiedTable();
    $('payoutOptModelComparison').open=true;
    const baseline=result.baseline.holdout;
    const bySpeed=result.ideas.filter(x=>x.holdout.avgFirstPayoutDay!=null)
     .slice().sort((a,b)=>(a.holdout.avgFirstPayoutDay??Infinity)-(b.holdout.avgFirstPayoutDay??Infinity))[0];
    if(status)status.textContent='Target-exact search tested '+result.ideas.length+
     ' cap variants against unchanged baseline; '+(bySpeed?
      'fastest variant '+bySpeed.title+' averages day '+Number(bySpeed.holdout.avgFirstPayoutDay).toFixed(1)+
      ' for first payout (baseline '+(baseline.avgFirstPayoutDay==null?'not reached':'day '+Number(baseline.avgFirstPayoutDay).toFixed(1))+'). ':
      'No variant achieved a first payout during this horizon. ')+
     'See goal chance, net P&L, blocked accounts and phase risk in the unified table. Original settings unchanged.';
    $('payoutOptModelComparison').scrollIntoView({behavior:'smooth',block:'start'});
   }catch(error){if(status)status.textContent='Target-exact search failed: '+(error?.message||'Unknown error');}
   finally{exact.disabled=false;exact.textContent=oldLabel;}
   return;
  }
  const lower=event.target.closest?.('[data-reverse-lower-risk]');
  if(lower){
   const index=Number(lower.dataset.reverseLowerRisk),candidate=lastOptimizerOutput?.candidates?.[index];
   const status=lower.closest('.reverse-candidate-body')?.querySelector('.reverse-review-status');
   if(!candidate||!lastOptimizerInputs||candidate.plan.id+':'+candidate.plan.size!==lastOptimizerAccountKey){
    if(status)status.textContent='Model changed. Calculate Investment again before comparing risk.';return;
   }
   if(!root.StudioModelDiscovery?.compareLowerRisk){if(status)status.textContent='Lower-risk comparison module unavailable.';return;}
   if(lower.disabled)return;
   const originalLabel=lower.textContent;
   lower.disabled=true;lower.textContent='Comparing risk…';
   if(status)status.textContent='Running paired scenarios with identical win rate, signal sequence and starting budget…';
   try{
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const effort=$('payoutMoreEffort').value;
    const trials=effort==='deep'?250:effort==='quick'?80:150;
    const opts={...lastOptimizerInputs,budget:candidate.initialBudget,
     netGoal:lastOptimizerOutput.minNetPnl,testTrials:trials};
    const result=root.StudioModelDiscovery.compareLowerRisk(
     root.StudioModelDiscovery.clonePlan(candidate.plan),opts);
    lastModelSearch={candidate,result,origin:'Investment Option '+(index+1)+' · Lower risk'};
    moreSortKey='blocked';moreDescending=false;moreSourceFilter='all';
    renderUnifiedTable();
    const baseline=result.baseline.holdout.avg;
    const fewer=result.ideas.filter(x=>x.holdout.avg.exhausted<baseline.exhausted-0.01);
    const best=fewer.slice().sort((a,b)=>b.holdout.avg.net-a.holdout.avg.net)[0];
    const details=best?
     ' Best expected net among variants with fewer blocks: '+best.title+
     ' · blocked '+Number(best.holdout.avg.exhausted).toFixed(2)+' vs '+Number(baseline.exhausted).toFixed(2)+
     ' · net '+advisorMoney(best.holdout.avg.net)+' vs '+advisorMoney(baseline.net)+
     ' · paid '+Number(best.holdout.avg.paid).toFixed(2)+' vs '+Number(baseline.paid).toFixed(2)+'.':
     ' None reduced the blocked count under these assumptions.';
    if(status)status.textContent=result.ideas.length+' fixed-budget, paired-trial variants compared; '+
     fewer.length+' reduce risk blocks.'+details+
     ' These are model projections, not proof of trading performance. Firms settings unchanged.';
    $('payoutOptModelComparison').open=true;
    $('payoutOptModelComparison').scrollIntoView({behavior:'smooth',block:'start'});
   }catch(error){
    if(status)status.textContent='Lower-risk comparison failed: '+(error?.message||'Unknown error');
   }finally{lower.disabled=false;lower.textContent=originalLabel;}
   return;
  }
  const more=event.target.closest?.('[data-reverse-more-models]');
  if(more){
   const index=Number(more.dataset.reverseMoreModels),candidate=lastOptimizerOutput?.candidates?.[index];
   const status=more.closest('.reverse-candidate-body')?.querySelector('.reverse-review-status');
   if(!candidate||!lastOptimizerInputs||candidate.plan.id+':'+candidate.plan.size!==lastOptimizerAccountKey){
    if(status)status.textContent='Scenario has changed. Calculate Investment again before searching.';return;
   }
   if(!root.StudioModelDiscovery){if(status)status.textContent='Model discovery is unavailable.';return;}
   if(more.disabled)return;
   more.disabled=true;more.textContent='Searching models…';
   if(status)status.textContent='Testing new risk models using this investment amount and its trading assumptions.';
   try{
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const effort=$('payoutMoreEffort').value;
    const trials=effort==='deep'?[150,250]:effort==='quick'?[50,80]:[80,150];
    const opts={...lastOptimizerInputs,budget:candidate.initialBudget,
     netGoal:lastOptimizerOutput.minNetPnl,objective:$('payoutMoreObjective').value,trackCharts:true,
     trainTrials:trials[0],testTrials:trials[1],shortlist:10};
    const result=root.StudioModelDiscovery.search(root.StudioModelDiscovery.clonePlan(candidate.plan),opts);
    lastModelSearch={candidate,result,origin:'Investment Option '+(index+1)};
    moreSortKey='net';moreDescending=true;moreSourceFilter='all';
    renderUnifiedTable();
    $('payoutOptModelComparison').open=true;
    if(status)status.textContent=result.ideas.length+' additional risk models added to the single comparison table in Section 4.';
    $('payoutOptModelComparison').scrollIntoView({behavior:'smooth',block:'start'});
   }catch(error){if(status)status.textContent='Model search failed: '+(error?.message||'Unknown error');}
   finally{more.disabled=false;more.textContent='Find More Risk Models';}
   return;
  }
  const ledger=event.target.closest?.('[data-reverse-ledger]');
  if(ledger){
   const index=Number(ledger.dataset.reverseLedger),candidate=lastOptimizerOutput?.candidates?.[index];
   const status=ledger.closest('.reverse-candidate-body')?.querySelector('.reverse-review-status');
   if(!candidate||!lastOptimizerInputs||candidate.plan.id+':'+candidate.plan.size!==lastOptimizerAccountKey){
    if(status)status.textContent='Scenario changed. Calculate Investment again before viewing the ledger.';
    return;
   }
   if(ledger.disabled)return;
   ledger.disabled=true;ledger.textContent='Calculating spending…';
   try{
    const ok=await bridge.analyzeOptimizerCandidate?.(candidate,lastOptimizerOutput,lastOptimizerInputs,
     'Investment Option '+(index+1));
    if(!ok)throw Error('Full simulation unavailable');
    const section=document.getElementById('section9Panel');
    section.open=true;
    section.scrollIntoView({behavior:'smooth',block:'start'});
    if(status)status.textContent='Daily Spending Ledger opened in Section 9 using this investment option.';
   }catch(error){if(status)status.textContent='Spending ledger: '+(error?.message||'Unknown error');}
   finally{ledger.disabled=false;ledger.textContent='View Daily Spending Ledger · Section 9';}
   return;
  }
  const analyze=event.target.closest?.('[data-reverse-analyze]');
  if(analyze){
   const index=Number(analyze.dataset.reverseAnalyze),candidate=lastOptimizerOutput?.candidates?.[index];
   const status=analyze.closest('.reverse-candidate-body')?.querySelector('.reverse-review-status');
   if(!candidate||!lastOptimizerInputs||!lastOptimizerOutput||candidate.plan.id+':'+candidate.plan.size!==lastOptimizerAccountKey){
    if(status)status.textContent='Scenario no longer available. Recalculate Investment before analyzing.';
    return;
   }
   const name=(index+1)+' · '+(candidate.riskMode==='adaptive'?candidate.r3Route:candidate.riskMode+' / '+candidate.r3Route);
   if(analyze.disabled)return;
   const originalLabel=analyze.textContent;
   analyze.disabled=true;
   analyze.textContent='Running full simulation…';
   if(status)status.textContent='Using Section 2 simulation engine and selected trial count; optimizer risk tiers preserved.';
   Promise.resolve().then(()=>bridge.analyzeOptimizerCandidate?.(
    candidate,lastOptimizerOutput,lastOptimizerInputs,'Investment Option '+name
   )).then(ok=>{
    if(!ok&&status)status.textContent='Could not run this scenario. Recalculate Investment and try again.';
    else if(status)status.textContent='Full simulation completed. See Sections 5–8 for the updated paths and results.';
   }).catch(error=>{
    if(status)status.textContent='Simulation failed: '+(error?.message||'Unknown error');
   }).finally(()=>{
    analyze.disabled=false;
    analyze.textContent=originalLabel;
   });
   return;
  }
  const button=event.target.closest?.('[data-reverse-send-firms]');
  if(!button)return;
  const n=Number(button.dataset.reverseSendFirms);
  const candidate=lastOptimizerOutput?.candidates?.[n];
  const row=bridge.getRows().find(r=>r.id+':'+r.size===lastOptimizerAccountKey);
  const status=button.closest('.reverse-candidate-body')?.querySelector('.reverse-review-status');
  if(!candidate||!row||candidate.plan.id+':'+candidate.plan.size!==lastOptimizerAccountKey){
   if(status)status.textContent='This scenario is no longer current. Recalculate before sending.';
   return;
  }
  const phases=candidate.plan.stageList||[];
  const varying=phases.some(stage=>{
   const x=candidate.plan.riskProfiles?.[stage];
   return x&&['r1','r2','r3'].some(t=>Math.abs(Number(x.rrByTier?.[t]??x.rr)-Number(x.rr))>1e-8);
  });
  if(varying){if(status)status.textContent='This risk setup has different RR per tier; transfer cannot safely preserve every tier yet. No Firms settings changed.';return;}
  if(!bridge.getSavedPlan?.(row)){if(status)status.textContent='Open and save this account in Firms before importing this risk setup.';return;}
  const index=n+1;
  const metrics={net:candidate.score.avgNet,roi:candidate.score.roi,chancePayout:candidate.score.chanceAnyPayout,budget:candidate.initialBudget};
  const ok=bridge.sendOptimizerToFirms?.(candidate.plan,'Reverse payout option '+index,metrics);
  if(status)status.textContent=ok?'Risk settings saved to Firms after confirmation. Open Firms to review or use Restore previous in the Firms transfer notice.':'No changes applied. See the Firms transfer status for details.';
  // Preserve the confirmation message in the expanded option; the saved Firms comparison refreshes on the next render.
 });
 $('payoutOptMoreModels').addEventListener('change',event=>{
  if(!lastOptimizerOutput)return;
  const el=event.target;
  if(el.matches?.('[data-more-sort]')){moreSortKey=el.value;if(el.value==='costGoal')moreDescending=false;}
  else if(el.matches?.('[data-more-columns]'))moreColumnView=el.value;
  else if(el.matches?.('[data-more-source]'))moreSourceFilter=el.value;
  else return;
  renderUnifiedTable();
 });
 $('payoutOptMoreModels').addEventListener('click',async event=>{
  const quick=event.target.closest?.('[data-more-test-funded]');
  if(quick){
   const target=$('payoutOptResults').querySelector('[data-reverse-funded-450="0"]');
   const notice=$('payoutOptMoreModels').querySelector('[data-more-funded-status]');
   if(!target||!lastOptimizerOutput?.candidates?.length){
    if(notice)notice.textContent='Calculate Investment first to load an investment option.';
    return;
   }
   if(notice)notice.textContent='Running funded scenarios from Investment Option 1. The original strategy remains unchanged.';
   target.click();
   return;
  }
  if(event.target.closest?.('[data-more-direction]')){
   moreDescending=!moreDescending;renderUnifiedTable();return;
  }
  const sendButton=event.target.closest?.('[data-more-send-firms]');
  const ledgerButton=event.target.closest?.('[data-more-ledger]');
  const button=sendButton||ledgerButton||event.target.closest?.('[data-more-analyze]');
  if(!button||!lastOptimizerOutput||button.disabled)return;
  const raw=sendButton?button.dataset.moreSendFirms:ledgerButton?button.dataset.moreLedger:button.dataset.moreAnalyze;
  const match=/^(original|extra):([0-9]+)$/.exec(raw||'');
  if(!match)return;
  const index=Number(match[2]);
  let model,label;
  if(match[1]==='original'){
   const item=lastOptimizerOutput.candidates?.[index];
   if(!item)return;
   model=item;label='Investment Option '+(index+1);
  }else{
   const idea=lastModelSearch?.result?.ideas?.[index];
   if(!idea||!lastModelSearch)return;
   model={plan:idea.plan,result:idea.holdout,initialBudget:lastModelSearch.candidate.initialBudget};
   label=idea.title;
  }
  if(sendButton){
   if(typeof bridge.sendOptimizerToFirms!=='function'){
    $('payoutOptStatus').textContent='Prop Account transfer is unavailable.';return;
   }
   const result=model.result||{},k=result.tradeKpis||{};
   const metrics={net:result.avg?.net,roi:result.roi,p10:result.p10,chancePayout:result.chancePayout,
    profitFactor:k.pf,winRate:k.wr,rewardRisk:k.rr,realizedR:k.ar,
    avgWin:k.aw,avgLoss:k.al,expectancy:k.ev,tradesPerTrial:result.avg?.trades,
    trials:result.config?.trials,budget:model.initialBudget};
   const ok=bridge.sendOptimizerToFirms(model.plan,label,metrics);
   $('payoutOptStatus').textContent=ok?'Saved '+label+' as the selected Prop Account default, with a restorable backup. Open Firms to verify.':
    'Prop Account defaults unchanged; see the Firms transfer status for details.';
   return;
  }
  button.disabled=true;button.textContent=ledgerButton?'Calculating spending…':'Analyzing…';
  try{
   const ok=await bridge.analyzeOptimizerCandidate?.(model,lastOptimizerOutput,lastOptimizerInputs,label);
   if(!ok)throw Error('Detailed report unavailable');
   if(ledgerButton){
    const section=document.getElementById('section9Panel');
    section.open=true;
    section.scrollIntoView({behavior:'smooth',block:'start'});
   }
  }catch(error){$('payoutOptStatus').textContent=(ledgerButton?'Spending ledger: ':'Analyze model: ')+(error?.message||'Unknown error');}
  finally{button.disabled=false;button.textContent=ledgerButton?'Ledger':'Analyze';}
 });
 $('payoutOptResults').addEventListener('change',event=>{
  if(event.target.id==='payoutResultsSort'){
   currentSortMode=event.target.value;
   save();
   if(lastOptimizerOutput)renderLastOptimizer();
   return;
  }
  const select=event.target.closest('select[data-reverse-path]');
  if(!select||!lastOptimizerOutput)return;
  const index=Number(select.dataset.reversePath),candidate=lastOptimizerOutput.candidates[index];
  const target=$('payoutOptResults').querySelector('[data-reverse-path-body="'+index+'"]');
  if(candidate&&target)target.innerHTML=solver.renderAccountPath(candidate,select.value);
 });
 let busy=false;
 $('runPayoutOptimizer').addEventListener('click',async ev=>{
  ev.preventDefault();ev.stopPropagation();
  if(busy)return;
  storeAssumptions();
  const selected=$('payoutOptAccount').value;
  const row=bridge.getRows().find(r=>r.id+':'+r.size===selected);
  const status=$('payoutOptStatus'),button=$('runPayoutOptimizer');
  if(!row){status.textContent='No supported account selected.';return;}
  const inputs=bridge.getInputs(row),selectedPlan=bridge.getPlan(row);
  const readNum=(id,min,max)=>{const n=Number($(id).value);if(!Number.isFinite(n)||n<min||n>max)throw Error('Invalid assumption: '+id);return n};
  try{
   inputs.days=readNum('payoutOptDays',1,120);
   inputs.tradesPerDay=readNum('payoutOptSignals',1,20);
   inputs.signalPace=$('payoutOptPace').value;
   inputs.tradeSchedule=inputs.signalPace==='weekly20'?
    window.StudioWeeklyEconomics.schedule(inputs.days,'weekly20',4):null;
   if(inputs.signalPace==='weekly20')inputs.tradesPerDay=4;
   inputs.winRate=readNum('payoutOptWinRate',0,100);
   inputs.purchaseMode=$('payoutOptPurchase').value;
   inputs.signalMode=$('payoutOptSignalMode').value;
   inputs.reinvestPayouts=$('payoutOptReinvest').value==='yes';
   inputs.capacityMode=$('payoutOptCapacity').value;
   inputs.maxActive=readNum('payoutOptMaxActive',1,100);
   inputs.maxBuysPerDay=readNum('payoutOptBuys',1,20);
   inputs.seed=readNum('payoutOptSeed',1,2147483647);
   selectedPlan.riskProfiles.p1.minDays=readNum('payoutOptP1Days',0,60);
   if(selectedPlan.riskProfiles.p2)selectedPlan.riskProfiles.p2.minDays=readNum('payoutOptP2Days',0,60);
   if(selectedPlan.id!=='topstep'){
    selectedPlan.payoutWaitCalendarDays=readNum('payoutOptWait',0,120);
    selectedPlan.fundedWaitDays=Math.ceil(selectedPlan.payoutWaitCalendarDays*5/7);
   }
   selectedPlan.payoutProcessingCalendarDays=readNum('payoutOptProcessing',0,120);
   selectedPlan.payoutProcessingTradingDays=Math.ceil(selectedPlan.payoutProcessingCalendarDays*5/7);
   inputs.p1MinDays=selectedPlan.riskProfiles.p1.minDays;
   inputs.p2MinDays=selectedPlan.riskProfiles.p2?.minDays??null;
   inputs.payoutWaitCalendarDays=selectedPlan.payoutWaitCalendarDays;
   inputs.payoutProcessingCalendarDays=selectedPlan.payoutProcessingCalendarDays;
  }catch(e){$('payoutOptStatus').textContent=e.message;return;}
  const perPayout=Number($('payoutOptPer').value),
   maxInvestment=Number($('payoutOptMax').value),minRoiPct=Number($('payoutOptRoi').value),
   minNetRoiPct=Number($('payoutOptNetRoi').value),minNetPnl=Number($('payoutOptNetPnl').value),
   minRR=Number($('payoutOptMinRR').value),maxRR=Number($('payoutOptMaxRR').value);
  if(![perPayout,maxInvestment,minRoiPct,minNetRoiPct,minNetPnl,minRR,maxRR].every(Number.isFinite)||
   perPayout<=0||maxInvestment<=0||minNetPnl<=0||minRoiPct<0||minRoiPct>10000||minNetRoiPct<0||minNetRoiPct>10000||minNetPnl<0||minRR<.1||maxRR>20||minRR>maxRR){
   status.textContent='Enter valid payout amounts, ROI targets, and nonnegative net P&L in USD.';return;
  }
  busy=true;button.disabled=true;status.textContent='Running reverse payout scenarios…';
  lastOptimizerRecordId=null;lastOptimizerOutput=null;lastOptimizerInputs=null;lastModelSearch=null;moreSourceFilter='all';
  $('payoutOptResults').innerHTML='';renderUnifiedTable();save();
  try{
   const output=await solver.optimize({plan:selectedPlan,perPayout,
    maxInvestment,minRoi:minRoiPct/100,minNetRoi:minNetRoiPct/100,minNetPnl,minRR,maxRR,inputs,onProgress:text=>status.textContent=text});
   lastOptimizerOutput=output;
   lastOptimizerAccountKey=selected;
   lastOptimizerInputs={...inputs};
   renderLastOptimizer();
   $('payoutOptModelComparison').open=false;
   updateInputSummary();
   $('payoutOptInputsPanel').open=false;
   let historyResult=' · history not available';
   try{
    const record=bridge.saveOptimizer?.({output,inputs,account:{
     id:row.id,size:row.size,firm:output.firm,
     programName:bridge.label(row)
    }});
    if(record?.id){lastOptimizerRecordId=record.id;historyResult=' · saved to Section 10 (cloud sync attempted)';}
   }catch(saveError){historyResult=' · history save failed: '+saveError.message}
   status.textContent='Finished · '+output.checked+' scenarios evaluated · '+output.requiredPayouts+
    ' minimum payouts before fees. '+(output.feasible?'Expected net P&L, payout count and ROI filters were met.':'No validated scenario met all selected targets.')+historyResult;
   if(selectedPlan.stageList?.includes('p2')&&selectedPlan.id!=='topstep'){
    try{
     status.textContent+=' · Computing four funded variants…';
     const done=await runFundedComparison(0);
     status.textContent='Finished · '+output.checked+' optimizer scenarios · '+done.total+
      ' models visible (four funded compounding variants).'+historyResult+done.saved;
    }catch(e){
     status.textContent+=' · FUNDED COMPARISON FAILED: '+e.message;
     $('payoutOptModelComparison').open=true;
    }
   }
  }catch(error){status.textContent='Reverse optimizer: '+error.message}
  finally{busy=false;button.disabled=false;}
 });
 // The account list can change after the panel is created.
 const origRender=bridge.onAccountsChanged;
 bridge.onAccountsChanged=()=>{origRender?.();syncOptions();};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})(typeof window!=='undefined'?window:globalThis);
