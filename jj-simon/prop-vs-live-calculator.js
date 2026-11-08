/* JJ Academy: same-budget prop vs live calculator. Illustrative, not trade replay. */
(function(){
'use strict';
const slug='calc-prop-vs-live';
if(!chapters.some(c=>c.slug===slug))chapters.push({slug,group:'Calculators & Simulations',title:'Prop Firm vs Live Account Calculator',intro:'Compare JJ-style evaluation spending with trading the same personal budget in a live account over identical signals.',status:'Illustrative mathematical model',sections:[{title:'Same-budget comparison',points:['Prop evaluation fees become the live account starting capital. Both approaches use the same personal budget.','The live example uses a fixed percentage of starting capital per trade; it is not a sequence-aware backtest.','Prop payout is an assumption, not a verified guarantee. Extra activation, reset and trading fees reduce actual net returns.'],src:[]}]});
if(!curriculum.some(c=>c.slug===slug))curriculum.push({slug,title:'Prop Firm vs Live Account Calculator',status:'review',reason:'Interactive same-budget comparison; outcomes and trade assumptions are editable.'});
const css=document.createElement('style');css.textContent=`
#jj-live-compare{margin:10px 0;padding:10px;border:1px solid var(--stroke);border-radius:12px;background:var(--panel);font:inherit}
#jj-live-compare .inputs{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:7px}
#jj-live-compare label{display:flex;flex-direction:column;gap:4px;color:var(--muted);font-size:11px;padding:6px 8px;border:1px solid var(--stroke);border-radius:9px;background:var(--bg)}
#jj-live-compare .slider-head{display:flex;align-items:center;justify-content:space-between;gap:8px}#jj-live-compare output{font-size:12px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums}
#jj-live-compare input[type=range]{width:100%;height:20px;min-height:20px;padding:0;margin:0;accent-color:var(--accent);cursor:pointer;touch-action:pan-y}#jj-live-compare input[type=range]::-webkit-slider-thumb{cursor:grab}
#jj-live-compare .outputs{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:6px;margin-top:9px}
#jj-live-compare .metric{border:1px solid var(--stroke);border-radius:7px;padding:7px 8px;background:var(--bg)}
#jj-live-compare .metric small{display:block;color:var(--muted)}#jj-live-compare .metric strong{display:block;font-size:16px;margin-top:1px}
#jj-live-compare .warning{color:var(--muted);font-size:11px;margin-top:8px}
@media(max-width:480px){#jj-live-compare .inputs{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}#jj-live-compare .outputs{grid-template-columns:repeat(2,minmax(0,1fr))}#jj-live-compare .slider-head{flex-wrap:wrap}#jj-live-compare .metric strong{font-size:15px}}
`;document.head.appendChild(css);
const key='jj-same-budget-compare-v1';
const defaults={budget:1500,fee:100,trades:100,risk:5,wr:30,rr:4,payout:10000,extra:0};
let values={...defaults};try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&typeof saved==='object')for(const k in defaults)if(Number.isFinite(Number(saved[k])))values[k]=Number(saved[k])}catch(_){}
const money=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):'—';
function mount(){
 if(active!==slug)return;
 const article=document.getElementById(slug);if(!article||article.querySelector('#jj-live-compare'))return;
 const root=document.createElement('section');root.id='jj-live-compare';
 const fields=[['budget','Starting budget ($)',100,10000,100],['fee','Evaluation fee ($)',25,500,5],['trades','Number of signals',10,500,5],['risk','Live risk per trade (%)',0.5,20,0.5],['wr','Trade win rate (%)',0,100,1],['rr','Reward / risk ratio',0.5,10,0.5],['payout','Assumed prop payouts ($)',0,50000,250],['extra','Additional prop fees ($)',0,5000,50]];
 const formatValue=(id,n)=>['budget','fee','payout','extra'].includes(id)?money(n):id==='risk'||id==='wr'?n+'%':id==='rr'?n+'R':String(n);
 for(const [id,,min,max] of fields)values[id]=Math.max(min,Math.min(max,values[id]));
 root.innerHTML='<h3>Same-budget comparison</h3><p>Drag a slider to change the assumptions. Results update immediately and values save automatically.</p><div class="inputs">'+fields.map(([id,label,min,max,step])=>'<label><span class="slider-head"><span>'+label+'</span><output data-value="'+id+'">'+formatValue(id,values[id])+'</output></span><input type="range" aria-label="'+label+'" data-k="'+id+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+values[id]+'"></label>').join('')+'</div><div class="outputs" aria-live="polite"></div><p class="warning">Illustrative fixed-dollar risk per signal, calculated from the initial live balance. No compounding, trade-order drawdown, bankruptcy, spreads or commissions. Actual payouts depend on passing and firm rules; evaluation pass rate is not the signal win rate. Copied accounts share correlated trade outcomes.</p>';
 const output=root.querySelector('.outputs');
 function update(){
 const v=values;
 const count=Math.max(0,Math.floor(v.budget/Math.max(0.01,v.fee)));
 const riskD=v.budget*v.risk/100;
 const expectancy=(v.wr/100*v.rr-(1-v.wr/100));
 const liveProfit=v.trades*riskD*expectancy;
 const propNet=v.payout-v.budget-v.extra;
 const metrics=[['Evaluations affordable',String(count)],['Live risk per signal',money(riskD)],['Live expected P&L',money(liveProfit)],['Live ending balance',money(v.budget+liveProfit)],['Live ROI',(liveProfit/v.budget*100).toFixed(1)+'%'],['Prop assumed net profit',money(propNet)],['Prop ROI',(propNet/v.budget*100).toFixed(1)+'%'],['Prop vs live net difference',money(propNet-liveProfit)]];
 output.innerHTML=metrics.map(([label,val])=>'<div class="metric"><small>'+label+'</small><strong>'+val+'</strong></div>').join('');
 }
 root.addEventListener('input',e=>{const k=e.target.dataset.k;if(!Object.hasOwn(defaults,k))return;const n=Number(e.target.value);if(!Number.isFinite(n))return;const def=fields.find(f=>f[0]===k);values[k]=Math.min(def[3],Math.max(def[2],n));const shown=root.querySelector('[data-value="'+k+'"]');if(shown)shown.textContent=formatValue(k,values[k]);try{localStorage.setItem(key,JSON.stringify(values))}catch(_){}update()});
 const inside=article.querySelector('.chapter-inside');if(inside)inside.after(root);else article.append(root);update();
}
const previousRender=render;render=function(){previousRender();mount()};
if(new URLSearchParams(location.search).get('topic')===slug)active=slug;
if(typeof jjRebuildMobileSelector==='function')jjRebuildMobileSelector();
renderNav();render();
})();