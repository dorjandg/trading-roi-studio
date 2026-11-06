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
  '<div class="numbered-content"><p class="hint">Choose the cash you want to receive overall and the payout you want from each separate funded account. We will test starting investment and phase risk levels, including Challenge, Verification (if applicable), funded profit split, and payout waiting rules.</p>'+
  '<div class="payout-opt-fields">'+
  '<label>Total payout cash ($)<input id="payoutOptTotal" type="number" min="1" step="500" value="10000"></label>'+
  '<label>Minimum payout per account ($)<input id="payoutOptPer" type="number" min="1" step="100" value="1000"></label>'+
  '<label>Account type<select id="payoutOptAccount"></select></label>'+
  '<label>Maximum starting investment ($)<input id="payoutOptMax" type="number" min="1" step="500" value="10000"></label>'+
  '<label>Target success probability<select id="payoutOptProbability"><option value=".5">50%</option><option value=".7" selected>70%</option><option value=".9">90%</option></select></label>'+
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
 .payout-opt-fields{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:7px 0}
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
 for(const [name,id] of [['total','payoutOptTotal'],['per','payoutOptPer'],['max','payoutOptMax'],['probability','payoutOptProbability']])
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
   max:$('payoutOptMax').value,probability:$('payoutOptProbability').value,
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
 for(const id of ['payoutOptTotal','payoutOptPer','payoutOptMax','payoutOptProbability','payoutOptAccount']){
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
   maxInvestment=Number($('payoutOptMax').value),probability=Number($('payoutOptProbability').value);
  if(![total,perPayout,maxInvestment,probability].every(Number.isFinite)||total<=0||
   perPayout<=0||maxInvestment<=0||probability<=0||probability>1){
   status.textContent='Enter positive cash amounts, investment ceiling, and probability.';return;
  }
  busy=true;button.disabled=true;status.textContent='Running reverse payout scenarios…';
  $('payoutOptResults').innerHTML='';save();
  try{
   const output=await solver.optimize({plan:bridge.getPlan(row),total,perPayout,
    maxInvestment,probability,inputs,onProgress:text=>status.textContent=text});
   $('payoutOptResults').innerHTML=solver.render(output);
   status.textContent='Finished · '+output.checked+' scenarios evaluated · '+output.requiredPayouts+
    ' payouts required. '+(output.feasible?'A tested scenario met the selected probability.':'No scenario reached the selected probability.');
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
