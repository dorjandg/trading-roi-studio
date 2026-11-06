/* Standalone UI for reverse payout investment planning. */
(function(root){
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function start(){
 const bridge=root.StudioPayoutBridge,solver=root.StudioPayoutOptimizer;
 if(!bridge||!solver||!document.getElementById('results'))return;
 const panel=document.createElement('details');
 panel.id='payoutOptimizerPanel';panel.className='sim-charts-panel numbered-panel';
 panel.innerHTML='<summary><strong>3A · Calculate Investment &amp; Compare Models</strong>'+
  '<button class="primary section-run-btn" type="button" id="runPayoutOptimizer">Calculate Investment</button>'+
  '<span class="sim-charts-hint">Show / hide</span></summary>'+
  '<div class="numbered-content"><p class="hint">Search investment and risk combinations for a payout goal. Open any result to compare its R1/R2/R3 and trade KPIs, or search additional risk models in Section 3A without leaving these results. These are separate from Run Simulation.</p>'+
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
  '</details><p class="hint" id="payoutOptMath">10 first payouts required.</p>'+
  '<p id="payoutOptStatus" class="status" role="status">Choose targets, then Calculate Investment.</p>'+
  '<div id="payoutOptResults"></div><div id="payoutOptMoreModels"></div></div>';
 document.getElementById('results').before(panel);
 const $=id=>document.getElementById(id);
 const style=document.createElement('style');
 style.textContent=`
 #payoutOptimizerPanel>.numbered-content{padding:8px 5px}
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

 #payoutOptMoreModels:not(:empty){margin:13px 0;border-top:2px solid var(--line);padding-top:8px}
 .payout-more-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
 .payout-more-title strong{font-size:13px}
 .payout-more-title small{font-size:10px;color:var(--muted);flex:1 1 220px}
 .payout-more-title button{font-size:11px;min-height:28px;padding:5px 9px}
 .payout-more-table{width:100%;min-width:1040px;border-collapse:collapse;font-size:10px}
 .payout-more-table th,.payout-more-table td{padding:6px 7px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap;font-variant-numeric:tabular-nums}
 .payout-more-table th:first-child{text-align:left;min-width:180px}
 .payout-more-table thead{background:var(--panel2)}
 .payout-more-table details>summary{font-size:10px;cursor:pointer;margin:4px 0}
 .payout-more-phase{white-space:normal;line-height:1.4;font-size:10px;font-weight:400;padding:3px 0}
 .payout-more-table button{font-size:10px;padding:5px 7px;min-height:27px}
 `;document.head.appendChild(style);
 const key='4ds:v1:'+bridge.user+':payout-optimizer:v1';
 let prior={};try{prior=JSON.parse(localStorage.getItem(key)||'{}')}catch(_){}
 for(const [name,id] of [['per','payoutOptPer'],['max','payoutOptMax'],['roi','payoutOptRoi'],['netRoi','payoutOptNetRoi'],['netPnl','payoutOptNetPnl'],['minRR','payoutOptMinRR'],['maxRR','payoutOptMaxRR']])
  if(prior[name]!=null)$(id).value=String(prior[name]);
 if(Number($('payoutOptNetPnl').value)<=0)$('payoutOptNetPnl').value='5000';
 panel.open=!window.matchMedia('(max-width:650px)').matches&&prior.open===true;

 $('payoutOptSignals').innerHTML=Array.from({length:20},(_,i)=>'<option>'+String(i+1)+'</option>').join('');
 const assumptionIds={days:'payoutOptDays',tradesPerDay:'payoutOptSignals',winRate:'payoutOptWinRate',
  purchaseMode:'payoutOptPurchase',signalMode:'payoutOptSignalMode',reinvestPayouts:'payoutOptReinvest',
  capacityMode:'payoutOptCapacity',maxActive:'payoutOptMaxActive',maxBuysPerDay:'payoutOptBuys',seed:'payoutOptSeed',
  p1MinDays:'payoutOptP1Days',p2MinDays:'payoutOptP2Days',wait:'payoutOptWait',processing:'payoutOptProcessing'};
 const accountAssumptions=prior.assumptionsByAccount||{};
 function loadAssumptions(reset=false){
  const key=$('payoutOptAccount').value,row=bridge.getRows().find(r=>r.id+':'+r.size===key);
  if(!row)return;
  const base=bridge.getInputs(row),p=bridge.getPlan(row);
  const inherited={days:base.days,tradesPerDay:base.tradesPerDay,winRate:base.winRate,
   purchaseMode:base.purchaseMode,signalMode:base.signalMode,reinvestPayouts:base.reinvestPayouts?'yes':'no',
   capacityMode:base.capacityMode,maxActive:base.maxActive,maxBuysPerDay:base.maxBuysPerDay,seed:base.seed,
   p1MinDays:p.riskProfiles.p1?.minDays??0,p2MinDays:p.riskProfiles.p2?.minDays??0,
   wait:p.payoutWaitCalendarDays??0,processing:p.payoutProcessingCalendarDays??0};
  if(reset)accountAssumptions[key]=inherited;
  const vals={...inherited,...(accountAssumptions[key]||{})};
  for(const [name,id] of Object.entries(assumptionIds))$(id).value=String(vals[name]);
  $('payoutOptP2Days').disabled=!p.riskProfiles.p2;
  $('payoutOptWait').disabled=p.id==='topstep';
  const usd=n=>Number.isFinite(n)?'$'+n.toLocaleString():'not set';
  $('payoutOptLimits').textContent='Firm rules (read-only): daily '+usd(p.dailyLoss)+
   ' · overall '+usd(p.overallLoss)+' · reserve '+usd(p.riskReserve)+
   (p.id==='topstep'?' · funded winning-day eligibility applies':'');
  $('payoutOptAssumptionsSummary').textContent='· '+vals.days+'d · '+vals.tradesPerDay+
   ' signals/day · '+vals.winRate+'% WR';
 }
 function storeAssumptions(){
  const key=$('payoutOptAccount').value;if(!key)return;
  const v={};for(const [name,id] of Object.entries(assumptionIds))v[name]=$(id).value;
  accountAssumptions[key]=v;
  $('payoutOptAssumptionsSummary').textContent='· '+v.days+'d · '+v.tradesPerDay+
   ' signals/day · '+v.winRate+'% WR';
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
 function math(){
  const a=Number($('payoutOptNetPnl').value),b=Number($('payoutOptPer').value);
  $('payoutOptMath').textContent=a>0&&b>0?
   'At least '+Math.ceil(a/b)+' payouts at $'+b.toLocaleString('en-US')+' each before fees. Additional payouts may be required to net $'+a.toLocaleString('en-US')+'.':
   'Enter positive payout amounts.';
 }
 $('payoutOptAssumptions').open=prior.assumptionsOpen===true;
 syncOptions();math();
 for(const id of ['payoutOptPer','payoutOptMax','payoutOptRoi','payoutOptNetRoi','payoutOptNetPnl','payoutOptMinRR','payoutOptMaxRR','payoutOptAccount']){
  $(id).addEventListener('change',()=>{math();save()});
 }
 panel.addEventListener('toggle',save);
 $('payoutOptAssumptions').addEventListener('toggle',save);
 for(const id of Object.values(assumptionIds))$(id).addEventListener('change',()=>{storeAssumptions();save()});
 $('payoutOptReset').addEventListener('click',()=>{loadAssumptions(true);storeAssumptions();save()});
 $('payoutOptAccount').addEventListener('change',()=>{loadAssumptions();loadedAssumptionsAccount=acctValue();save()});
 let currentSortMode=['model','net','budgetRoi','feeRoi','chance','payouts','investment','firstDay'].includes(prior.sortMode)?prior.sortMode:'model';
 let lastOptimizerOutput=null,lastOptimizerAccountKey='',lastOptimizerInputs=null,lastModelSearch=null;
 document.addEventListener('portfolio-investment-import',event=>{
  const key=event.detail?.accountKey||'';
  if(!key||!bridge.getRows().some(r=>r.id+':'+r.size===key))return;
  const field=$('payoutOptAccount');
  if(!Array.from(field.options).some(x=>x.value===key))syncOptions();
  field.value=key;
  loadAssumptions();loadedAssumptionsAccount=acctValue();
  lastOptimizerOutput=null;lastOptimizerInputs=null;lastOptimizerAccountKey='';lastModelSearch=null;$('payoutOptMoreModels').innerHTML='';
  $('payoutOptResults').innerHTML='';
  $('payoutOptStatus').textContent='Imported simulator-only model: '+(event.detail?.title||'selected risk setup')+
   '. Review the investment budget and assumptions, then Calculate Investment. No Firms rules changed.';
  math();save();panel.open=true;
  panel.scrollIntoView({behavior:'smooth',block:'start'});
 }); 
 function renderLastOptimizer(){
  if(!lastOptimizerOutput)return;
  const row=bridge.getRows().find(r=>r.id+':'+r.size===lastOptimizerAccountKey);
  const saved=row?bridge.getSavedPlan?.(row):null;
  $('payoutOptResults').innerHTML=solver.render(lastOptimizerOutput,currentSortMode,saved);
 }
 $('payoutOptResults').addEventListener('click',async event=>{
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
    const opts={...lastOptimizerInputs,budget:candidate.initialBudget,
     netGoal:lastOptimizerOutput.minNetPnl,objective:'goal',
     trainTrials:80,testTrials:150,shortlist:10};
    const result=root.StudioModelDiscovery.search(root.StudioModelDiscovery.clonePlan(candidate.plan),opts);
    lastModelSearch={candidate,result,origin:'Investment Option '+(index+1)};
    $('payoutOptMoreModels').innerHTML=solver.renderMoreInvestmentModels(result,lastModelSearch.origin);
    if(status)status.textContent=result.ideas.length+' additional models compared below in Section 3A.';
    $('payoutOptMoreModels').scrollIntoView({behavior:'smooth',block:'start'});
   }catch(error){if(status)status.textContent='Model search failed: '+(error?.message||'Unknown error');}
   finally{more.disabled=false;more.textContent='Find More Risk Models';}
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
    else if(status)status.textContent='Full simulation completed. See Sections 4–7 for the updated paths and results.';
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
 $('payoutOptMoreModels').addEventListener('click',async event=>{
  if(event.target.closest?.('[data-more-close]')){
   lastModelSearch=null;$('payoutOptMoreModels').innerHTML='';return;
  }
  const button=event.target.closest?.('[data-more-analyze]');
  if(!button||!lastModelSearch)return;
  const index=Number(button.dataset.moreAnalyze),{result,candidate}=lastModelSearch;
  const record=index===0?{title:'Original investment baseline',plan:result.baseline.plan,holdout:result.baseline.holdout}:result.ideas[index-1];
  if(!record||button.disabled)return;
  button.disabled=true;button.textContent='Analyzing…';
  try{
   const model={plan:record.plan,result:record.holdout,initialBudget:candidate.initialBudget};
   const ok=await bridge.analyzeOptimizerCandidate?.(model,lastOptimizerOutput,lastOptimizerInputs,record.title);
   if(!ok)throw Error('Detailed report was unavailable');
  }catch(error){$('payoutOptStatus').textContent='Analyze model: '+(error?.message||'Unknown error');}
  finally{button.disabled=false;button.textContent='Analyze'}
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
  lastOptimizerOutput=null;lastOptimizerInputs=null;lastModelSearch=null;
  $('payoutOptResults').innerHTML='';$('payoutOptMoreModels').innerHTML='';save();
  try{
   const output=await solver.optimize({plan:selectedPlan,perPayout,
    maxInvestment,minRoi:minRoiPct/100,minNetRoi:minNetRoiPct/100,minNetPnl,minRR,maxRR,inputs,onProgress:text=>status.textContent=text});
   lastOptimizerOutput=output;
   lastOptimizerAccountKey=selected;
   lastOptimizerInputs={...inputs};
   renderLastOptimizer();
   let historyResult=' · history not available';
   try{
    const record=bridge.saveOptimizer?.({output,inputs,account:{
     id:row.id,size:row.size,firm:output.firm,
     programName:bridge.label(row)
    }});
    if(record?.id)historyResult=' · saved to Section 8 (cloud sync attempted)';
   }catch(saveError){historyResult=' · history save failed: '+saveError.message}
   status.textContent='Finished · '+output.checked+' scenarios evaluated · '+output.requiredPayouts+
    ' minimum payouts before fees. '+(output.feasible?'Expected net P&L, payout count and ROI filters were met.':'No validated scenario met all selected targets.')+historyResult;
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
