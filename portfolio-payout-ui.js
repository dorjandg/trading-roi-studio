/* Standalone UI for reverse payout investment planning. */
(function(root){
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function start(){
 const bridge=root.StudioPayoutBridge,solver=root.StudioPayoutOptimizer;
 if(!bridge||!solver||!document.getElementById('results'))return;
 const panel=document.createElement('details');
 panel.id='payoutOptimizerPanel';panel.className='sim-charts-panel numbered-panel';
 panel.innerHTML='<summary><strong>3A · Reverse Engineer Payouts</strong>'+
  '<button class="primary section-run-btn" type="button" id="runPayoutOptimizer">Calculate Investment</button>'+
  '<span class="sim-charts-hint">Show / hide</span></summary>'+
  '<div class="numbered-content"><p class="hint">Choose your total payout goal, per-account payout, fee-based ROI and net ROI on starting investment. The optimizer tests starting investment and phase risks; payout-goal probability is reported as an outcome.</p>'+
  '<div class="payout-opt-fields">'+
  '<label>Total payout cash ($)<input id="payoutOptTotal" type="number" min="1" step="500" value="10000"></label>'+
  '<label>Minimum payout per account ($)<input id="payoutOptPer" type="number" min="1" step="100" value="1000"></label>'+
  '<label>Account type<select id="payoutOptAccount"></select></label>'+
  '<label>Maximum starting investment ($)<input id="payoutOptMax" type="number" min="1" step="500" value="10000"></label>'+
  '<label>Minimum ROI on fees (%)<input id="payoutOptRoi" type="number" min="0" max="10000" step="25" value="200" title="Expected net cash divided by fees incurred"></label>'+ 
  '<label>Minimum net ROI (%)<input id="payoutOptNetRoi" type="number" min="0" max="10000" step="25" value="100" title="Expected net cash after fees divided by starting investment"></label>'+
  '</div><p class="hint" id="payoutOptMath">10 first payouts required.</p>'+
  '<p id="payoutOptStatus" class="status" role="status">Choose targets, then Calculate Investment.</p>'+
  '<div id="payoutOptResults"></div></div>';
 document.getElementById('results').before(panel);
 const $=id=>document.getElementById(id);
 const style=document.createElement('style');
 style.textContent=`
 #payoutOptimizerPanel>.numbered-content{padding:8px 5px}
 #payoutOptimizerPanel>summary .section-run-btn{height:34px;min-height:34px;flex:0 0 170px;width:170px;padding:5px 8px;font-size:12px}
 #payoutOptimizerPanel>summary .sim-charts-hint{margin-left:0}
 .payout-opt-fields{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:7px 0}
 .payout-opt-fields label{font-size:11px;font-weight:700;color:var(--muted);min-width:0}
 .payout-opt-fields input,.payout-opt-fields select{margin-top:3px;width:100%;min-height:35px;padding:5px 7px;font-size:12px}
 .reverse-candidate{border:1px solid var(--line);border-radius:8px;padding:8px;margin:8px 0}
 .reverse-candidate h4{margin:0 0 5px}
 .reverse-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;margin:7px 0}
 .reverse-kpis>div{border:1px solid var(--line);padding:6px;border-radius:6px;min-width:0}
 .reverse-kpis small{display:block;color:var(--muted);font-size:10px}
 .reverse-kpis strong{display:block;font-size:15px}
 @media(max-width:1000px){.payout-opt-fields{grid-template-columns:repeat(3,minmax(0,1fr))}.reverse-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
 @media(max-width:600px){.payout-opt-fields{grid-template-columns:repeat(2,minmax(0,1fr))}
 .payout-opt-fields input,.payout-opt-fields select{font-size:16px}
 #payoutOptimizerPanel>summary .section-run-btn{width:144px;flex-basis:144px;min-height:30px;height:30px;padding:4px;font-size:11px}
 .reverse-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
 `;document.head.appendChild(style);
 const key='4ds:v1:'+bridge.user+':payout-optimizer:v1';
 let prior={};try{prior=JSON.parse(localStorage.getItem(key)||'{}')}catch(_){}
 for(const [name,id] of [['total','payoutOptTotal'],['per','payoutOptPer'],['max','payoutOptMax'],['roi','payoutOptRoi'],['netRoi','payoutOptNetRoi']])
  if(prior[name]!=null)$(id).value=String(prior[name]);
 panel.open=prior.open===true;
 function syncOptions(){
  const list=bridge.getRows(),select=$('payoutOptAccount'),existing=select.value||prior.account||'';
  select.innerHTML=[...new Map(list.map(r=>[r.id+':'+r.size,r])).entries()]
   .map(([id,r])=>'<option value="'+escape(id)+'">'+escape(bridge.label(r))+'</option>').join('');
  if([...select.options].some(o=>o.value===existing))select.value=existing;
 }
 function save(){
  try{localStorage.setItem(key,JSON.stringify({total:$('payoutOptTotal').value,per:$('payoutOptPer').value,
   max:$('payoutOptMax').value,roi:$('payoutOptRoi').value,netRoi:$('payoutOptNetRoi').value,
   account:$('payoutOptAccount').value,open:panel.open}))}catch(_){}
 }
 function math(){
  const a=Number($('payoutOptTotal').value),b=Number($('payoutOptPer').value);
  $('payoutOptMath').textContent=a>0&&b>0?
   '$'+a.toLocaleString('en-US')+' ÷ $'+b.toLocaleString('en-US')+' = '+Math.ceil(a/b)+
   ' separate first payouts required. The account funded profit target is adjusted for the firm payout split.':
   'Enter positive payout amounts.';
 }
 syncOptions();math();
 for(const id of ['payoutOptTotal','payoutOptPer','payoutOptMax','payoutOptRoi','payoutOptNetRoi','payoutOptAccount']){
  $(id).addEventListener('change',()=>{math();save()});
 }
 panel.addEventListener('toggle',save);
 let busy=false;
 $('runPayoutOptimizer').addEventListener('click',async ev=>{
  ev.preventDefault();ev.stopPropagation();
  if(busy)return;
  syncOptions();
  const selected=$('payoutOptAccount').value;
  const row=bridge.getRows().find(r=>r.id+':'+r.size===selected);
  const status=$('payoutOptStatus'),button=$('runPayoutOptimizer');
  if(!row){status.textContent='No supported account selected.';return;}
  const inputs=bridge.getInputs(row);
  const total=Number($('payoutOptTotal').value),perPayout=Number($('payoutOptPer').value),
   maxInvestment=Number($('payoutOptMax').value),minRoiPct=Number($('payoutOptRoi').value),
   minNetRoiPct=Number($('payoutOptNetRoi').value);
  if(![total,perPayout,maxInvestment,minRoiPct,minNetRoiPct].every(Number.isFinite)||total<=0||
   perPayout<=0||maxInvestment<=0||minRoiPct<0||minRoiPct>10000||minNetRoiPct<0||minNetRoiPct>10000){
   status.textContent='Enter positive payout amounts, investment ceiling, and ROI between 0% and 10,000%.';return;
  }
  busy=true;button.disabled=true;status.textContent='Running reverse payout scenarios…';
  $('payoutOptResults').innerHTML='';save();
  try{
   const output=await solver.optimize({plan:bridge.getPlan(row),total,perPayout,
    maxInvestment,minRoi:minRoiPct/100,minNetRoi:minNetRoiPct/100,inputs,onProgress:text=>status.textContent=text});
   $('payoutOptResults').innerHTML=solver.render(output);
   status.textContent='Finished · '+output.checked+' scenarios evaluated · '+output.requiredPayouts+
    ' payouts required. '+(output.feasible?'Expected payout counts, cash and both ROI targets were met in validation.':'No validated scenario reached all payout and ROI targets.');
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
