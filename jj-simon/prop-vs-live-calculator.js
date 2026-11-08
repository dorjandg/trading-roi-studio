/* JJ Academy calculator 08: two compact, touch-friendly scenario tabs. */
(function(){
'use strict';
const slug='calc-prop-vs-live';
if(!chapters.some(c=>c.slug===slug))chapters.push({slug,group:'Calculators & Simulations',title:'Prop Firm vs Live Account Calculator',intro:'Compare the same personal cash budget across a live account and prop evaluations.',status:'Illustrative mathematical model',sections:[{title:'Assumptions and interpretation',points:['Both scenarios use the same cash budget. Live trading starts with that balance; prop purchases spend it on evaluation fees.','Prop results are probability-weighted expected values, not guaranteed payouts or a trade-by-trade backtest.','Evaluation pass probability and funded payout success probability are separate from the live trade win rate.','All results exclude unmodeled trading commissions, taxes, account restrictions and correlated account outcomes.'],src:[]}]});
if(!curriculum.some(c=>c.slug===slug))curriculum.push({slug,title:'Prop Firm vs Live Account Calculator',status:'review',reason:'Compact interactive same-budget live and prop comparison; user-adjustable assumptions.'});
const css=document.createElement('style');
css.textContent=`
#jj-live-compare{margin:7px 0;padding:8px;border:1px solid var(--stroke);border-radius:9px;background:var(--panel);font:inherit}
#jj-live-compare .jj-tabs{display:flex;gap:4px;margin:5px 0 8px}
#jj-live-compare .jj-tabs button{flex:1;padding:6px 8px;border:1px solid var(--stroke);border-radius:7px;background:var(--bg);color:var(--text);font-size:12px;cursor:pointer}
#jj-live-compare .jj-tabs button[aria-selected=true]{border-color:var(--accent);color:var(--accent);font-weight:700;background:var(--panel)}
#jj-live-compare .jj-compact-inputs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
#jj-live-compare .jj-field{display:flex;flex-direction:column;gap:3px;min-width:0;min-height:65px;justify-content:space-between;padding:5px 7px;border:1px solid var(--stroke);border-radius:7px;background:var(--bg)}
#jj-live-compare .jj-field-head{display:grid;grid-template-columns:minmax(0,1fr) 68px;align-items:center;gap:5px;min-height:32px;color:var(--muted);font-size:10px;line-height:1.2}
#jj-live-compare .jj-field-head>span{min-width:0;overflow-wrap:anywhere}
#jj-live-compare .jj-field-head>.jj-number{width:68px;min-width:0;justify-self:end}
#jj-live-compare .jj-compact-inputs>.jj-field{align-self:stretch}
#jj-live-compare .jj-compact-inputs{grid-auto-rows:minmax(70px,auto)}
#jj-live-compare .jj-number{width:68px;max-width:100%;min-height:25px;box-sizing:border-box;padding:3px 5px;border:1px solid var(--stroke);border-radius:5px;background:var(--panel);color:var(--text);font:700 12px inherit;font-variant-numeric:tabular-nums;text-align:right}#jj-live-compare .jj-number:focus{outline:1px solid var(--accent)}
#jj-live-compare input[type=range]{width:100%;height:16px;min-height:16px;padding:0;margin:0;accent-color:var(--accent);cursor:pointer;touch-action:pan-y}
#jj-live-compare .jj-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:7px}#jj-live-compare .jj-compact-inputs>.jj-field,#jj-live-compare .jj-kpis>.jj-kpi{width:100%;min-width:0;box-sizing:border-box}
#jj-live-compare .jj-kpi{min-width:0;min-height:54px;box-sizing:border-box;border:1px solid var(--stroke);border-radius:7px;padding:5px 7px;background:var(--bg)}
#jj-live-compare .jj-kpi small{display:block;color:var(--muted);font-size:10px;line-height:1.3}
#jj-live-compare .jj-kpi strong{display:block;font-size:14px;margin-top:1px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
#jj-live-compare .jj-kpi.is-negative,#jj-live-compare .jj-kpi.is-negative small,#jj-live-compare .jj-kpi.is-negative strong{color:#ef646b}
#jj-live-compare .jj-heading{font-size:12px;font-weight:700;margin:9px 0 4px}
#jj-live-compare .jj-note{font-size:10px;color:var(--muted);margin:7px 0 0;line-height:1.4}
#jj-live-compare .jj-tabpanel[hidden]{display:none}
@media(max-width:600px){
#jj-live-compare{margin:4px 0;padding:5px;border-radius:7px}
#jj-live-compare .jj-compact-inputs,#jj-live-compare .jj-kpis{gap:3px}
#jj-live-compare .jj-compact-inputs{grid-auto-rows:minmax(77px,auto)}
#jj-live-compare .jj-field{min-height:77px;padding:4px 5px;gap:3px;border-radius:5px}
#jj-live-compare .jj-field-head{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto;gap:2px;min-height:0;font-size:10px;line-height:1.15}
#jj-live-compare .jj-field-head>span{grid-column:1;white-space:normal;overflow-wrap:normal;word-break:normal;min-height:12px}
#jj-live-compare .jj-field-head>.jj-number{grid-column:1;justify-self:stretch;width:100%;max-width:100%;text-align:right}
#jj-live-compare .jj-field-head>.jj-number{width:54px}
#jj-live-compare .jj-number{min-height:23px;padding:2px 3px;font-size:11px}
#jj-live-compare input[type=range]{height:14px;min-height:14px}
#jj-live-compare .jj-tabs{margin:4px 0 5px;gap:3px}
#jj-live-compare .jj-tabs button{padding:4px 5px;font-size:11px}
#jj-live-compare .jj-kpis{margin-top:4px}
#jj-live-compare .jj-kpi{min-height:43px;padding:4px 5px;border-radius:5px}
#jj-live-compare .jj-kpi small{font-size:9px;line-height:1.15}
#jj-live-compare .jj-kpi strong{font-size:12px;margin-top:1px}
#jj-live-compare .jj-heading{font-size:11px;margin:6px 0 3px}
#jj-live-compare .jj-note{font-size:9px;margin-top:5px;line-height:1.3}
}
@media(max-width:600px){
#jj-live-compare .jj-compact-inputs{grid-auto-rows:minmax(55px,auto);gap:3px}
#jj-live-compare .jj-field{min-height:55px;padding:3px 5px;gap:2px;justify-content:center}
#jj-live-compare .jj-field-head{display:grid;grid-template-columns:minmax(0,1fr) 58px;grid-template-rows:auto;gap:3px;align-items:center;min-height:24px;font-size:9px;line-height:1.15}
#jj-live-compare .jj-field-head>span{grid-column:1;grid-row:1;overflow-wrap:normal;word-break:normal;min-height:0}
#jj-live-compare .jj-field-head>.jj-number{grid-column:2;grid-row:1;justify-self:end;width:58px;min-height:22px;font-size:11px;padding:2px 3px}
#jj-live-compare input[type=range]{height:10px;min-height:10px;margin:0;max-width:100%}
#jj-live-compare .jj-kpi{min-height:39px;padding:3px 5px}
#jj-live-compare .jj-kpi small{font-size:9px;line-height:1.15}
#jj-live-compare .jj-kpi strong{font-size:12px}
#jj-live-compare .jj-tabs button{padding:4px 5px;font-size:11px}
}
@media(min-width:850px){#jj-live-compare .jj-compact-inputs,#jj-live-compare .jj-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}
`;document.head.appendChild(css);
const key='jj-same-budget-compare-v2';
const legacy='jj-same-budget-compare-v1';
const defaults={budget:1500,fee:100,trades:100,risk:5,wr:30,rr:4,pass:33,success:50,payoutPer:2000,extra:0};
let values={...defaults};
try{const old=JSON.parse(localStorage.getItem(legacy)||'null');if(old&&typeof old==='object')for(const k of ['budget','fee','trades','risk','wr','rr','extra'])if(Number.isFinite(Number(old[k])))values[k]=Number(old[k])}catch(_){}
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&typeof saved==='object')for(const k in defaults)if(Number.isFinite(Number(saved[k])))values[k]=Number(saved[k])}catch(_){}
const fields={
budget:['Budget ($)',100,10000,100],
fee:['Eval fee ($)',25,500,5],
trades:['Signals',10,500,5],
risk:['Risk / trade (%)',0.5,20,0.5],
wr:['Win rate (%)',0,100,1],
rr:['Reward / risk',0.5,10,0.5],
pass:['Eval pass (%)',0,100,1],
success:['Funded payout (%)',0,100,1],
payoutPer:['Payout / success ($)',0,10000,100],
extra:['Extra fees ($)',0,5000,25]
};
const money=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):'—';
const fmt=(id,n)=>['budget','fee','payoutPer','extra'].includes(id)?money(n):['risk','wr','pass','success'].includes(id)?n+'%':id==='rr'?n+'R':String(n);
for(const id in fields){const [,min,max]=fields[id];values[id]=Math.max(min,Math.min(max,values[id]))}
let selected='live';try{if(localStorage.getItem(key+'-tab')==='prop')selected='prop'}catch(_){}
function field(id){const [label,min,max,step]=fields[id];return '<div class="jj-field"><div class="jj-field-head"><span>'+label+'</span><input class="jj-number" type="number" inputmode="decimal" data-number="'+id+'" aria-label="Edit '+label+'" min="'+min+'" max="'+max+'" step="any" value="'+values[id]+'"></div><input type="range" data-k="'+id+'" aria-label="Slide '+label+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+values[id]+'"></div>'}
function cards(items){return items.map(([name,val])=>{const negative=typeof val==='string'&&/^\s*(?:-\$|\$-|−\$|-\d|−\d)/.test(val);return '<div class="jj-kpi'+(negative?' is-negative':'')+'"><small>'+name+'</small><strong>'+val+'</strong></div>'}).join('')}
function mount(){
if(active!==slug)return;
const article=document.getElementById(slug);if(!article||article.querySelector('#jj-live-compare'))return;
const root=document.createElement('section');root.id='jj-live-compare';
root.innerHTML='<div class="jj-compact-inputs">'+['budget','trades','wr'].map(field).join('')+'</div><div class="jj-tabs" role="tablist" aria-label="Calculator scenario"><button type="button" role="tab" data-tab="live">Live Account</button><button type="button" role="tab" data-tab="prop">Prop Firm</button></div><section class="jj-tabpanel" data-panel="live" role="tabpanel"><div class="jj-compact-inputs">'+['risk','rr'].map(field).join('')+'</div><div class="jj-kpis" data-result="live"></div></section><section class="jj-tabpanel" data-panel="prop" role="tabpanel"><div class="jj-compact-inputs">'+['fee','pass','success','payoutPer','extra'].map(field).join('')+'</div><div class="jj-kpis" data-result="prop"></div></section><div class="jj-heading">Same-budget comparison</div><div class="jj-kpis" data-result="compare"></div><p class="jj-note">Expected-value illustration, not a simulated equity curve. Prop probabilities assume independent evaluation attempts. Cost per funded account is calculated as evaluation fee divided by evaluation pass probability. Additional fees are separate and are deducted from the shared budget. A payout is not guaranteed; live losses can exceed available capital in this simple linear model. Firm rules, account drawdowns, fees beyond those entered and copied-account correlation are not simulated.</p>';
const update=()=>{
const v=values;
const attempts=Math.max(0,Math.floor(Math.max(0,v.budget-v.extra)/v.fee));
const funded=attempts*v.pass/100;
const costPerFunded=v.pass>0?v.fee/(v.pass/100):Infinity;
const cost=attempts*v.fee+v.extra;
const payouts=funded*v.success/100;
const gross=payouts*v.payoutPer;
const propNet=gross-cost;
const riskD=v.budget*v.risk/100;
const liveNet=v.trades*riskD*((v.wr/100)*v.rr-(1-v.wr/100));
root.querySelector('[data-result="live"]').innerHTML=cards([['Risk per trade',money(riskD)],['Expected P&L',money(liveNet)],['Ending balance*',money(v.budget+liveNet)],['Expected ROI',(100*liveNet/v.budget).toFixed(1)+'%']]);
root.querySelector('[data-result="prop"]').innerHTML=cards([['Evaluations',String(attempts)],['Expected funded',funded.toFixed(2)],['Expected payouts',payouts.toFixed(2)],['Expected gross',money(gross)],['Cost per funded account',money(costPerFunded)],['Modeled cash spent',money(cost)],['Expected net',money(propNet)],['Expected ROI',(100*propNet/v.budget).toFixed(1)+'%']]);
root.querySelector('[data-result="compare"]').innerHTML=cards([['Live expected net',money(liveNet)],['Prop expected net',money(propNet)],['Prop minus live',money(propNet-liveNet)],['Shared cash budget',money(v.budget)]]);
};
const switchTab=tab=>{selected=tab;for(const b of root.querySelectorAll('[data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===tab));for(const panel of root.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==tab;try{localStorage.setItem(key+'-tab',tab)}catch(_){}};
root.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)switchTab(b.dataset.tab)});
function applyValue(id,n,fromNumber){if(!Object.prototype.hasOwnProperty.call(fields,id)||!Number.isFinite(n))return;const [,min,max]=fields[id];values[id]=Math.max(min,Math.min(max,n));const slider=root.querySelector('[data-k="'+id+'"]');if(slider)slider.value=String(values[id]);const number=root.querySelector('[data-number="'+id+'"]');if(number&&!fromNumber)number.value=String(values[id]);try{localStorage.setItem(key,JSON.stringify(values))}catch(_){}update()}
root.addEventListener('input',e=>{const id=e.target.dataset.k;if(id){applyValue(id,Number(e.target.value),false);return}const numberId=e.target.dataset.number;if(numberId&&e.target.value.trim()!==''&&Number.isFinite(e.target.valueAsNumber))applyValue(numberId,e.target.valueAsNumber,true)});
root.addEventListener('change',e=>{const id=e.target.dataset.number;if(!id)return;const n=e.target.valueAsNumber;if(Number.isFinite(n))applyValue(id,n,false);else e.target.value=String(values[id])});
const inside=article.querySelector('.chapter-inside');if(inside)inside.after(root);else article.append(root);
switchTab(selected);update();
}
const priorRender=render;render=function(){priorRender();mount()};
if(new URLSearchParams(location.search).get('topic')===slug)active=slug;
if(typeof jjRebuildMobileSelector==='function')jjRebuildMobileSelector();
renderNav();render();
})();