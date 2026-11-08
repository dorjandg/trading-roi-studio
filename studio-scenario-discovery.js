/* Phase scenario discovery: read-only candidates; never alters saved firm settings. */
(()=>{'use strict';
const stages=['p1','p2','funded'],fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:1});
function init(stage){
 const host=document.querySelector('[data-recovery-stage="'+stage+'"]');if(!host||host.dataset.discoveryReady)return;
 host.dataset.discoveryReady='1';
 const panel=document.createElement('details');panel.className='scenario-discovery';panel.style.cssText='margin:8px 0;padding:10px;border:1px solid #344257;border-radius:10px';
 panel.innerHTML='<summary style="cursor:pointer;font-weight:600">Scenario Discovery · compare risk paths</summary><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:end"><label>Win rate % <input data-field="wr" type="number" min="1" max="99" value="40" style="width:70px"></label><label>RR <input data-field="rr" type="number" min=".1" max="20" step=".1" value="3" style="width:65px"></label><label>Max trades <input data-field="trades" type="number" min="1" max="4" value="3" style="width:60px"></label><label>Daily loss cap $ <input data-field="cap" type="number" min="1" value="2000" style="width:90px"></label><button type="button" data-run>Discover scenarios</button></div><div data-results style="margin-top:8px;font-size:12px"></div><small>Independent illustrative one-day path model. Assumes independent wins, fixed RR, no fees, slippage or trailing-floor movement. Not a prop-firm eligibility or pass-probability model. Does not change saved trading settings.</small>';
 host.before(panel);panel.querySelector('[data-run]').addEventListener('click',()=>run(panel,stage));
}
function run(panel,stage){
 const get=k=>Number(panel.querySelector('[data-field="'+k+'"]').value),wr=get('wr')/100,rr=get('rr'),max=get('trades'),cap=get('cap');
 const out=panel.querySelector('[data-results]');
 if(!(wr>0&&wr<1&&rr>0&&max>=1&&max<=4&&cap>0)){out.textContent='Enter valid inputs.';return;}
 const targetInput=document.querySelector('[data-recovery-stage="'+stage+'"] input[type="number"]');
 const target=Number(targetInput?.value)|| (stage==='p1'?3000:stage==='p2'?500:4000);
 const candidates=[{name:'Baseline',r:[500,670,390,440]},{name:'Third-trade recovery',r:[500,670,390,0]},{name:'Third-trade $830 stress',r:[500,670,830,0]},{name:'Controlled risk',r:[350,450,250,0]}];
 // Candidate discovery across discrete risk steps, including dynamic recovery sizes.
 for(const first of [250,350,400,500])for(const second of [350,450,550,670]){
 const recovery=Math.ceil((first+second)/rr/10)*10;
 candidates.push({name:'Generated '+first+'/'+second,r:[first,second,recovery,0]});
 }
 const evaluate=c=>{
 let pass=0,ruin=0,flat=0,trades=0,profit=0,states=0;
 function walk(i,pnl,prob){
  if(i>=max||i>=4||!c.r[i]||pnl>=target||pnl<=-cap){
   states+=prob;pass+=prob*(pnl>=target);ruin+=prob*(pnl<=-cap);flat+=prob*(pnl<0&&pnl>-cap);profit+=prob*pnl;return;
  }
  const risk=c.r[i];if(risk>cap+pnl){states+=prob;flat+=prob*(pnl<0);profit+=prob*pnl;return;}
  trades+=prob;walk(i+1,pnl+risk*rr,prob*wr);walk(i+1,pnl-risk,prob*(1-wr));
 }
 walk(0,0,1);return {...c,pass,ruin,flat,trades,profit,states};
 };
 const ranked=candidates.map(evaluate).sort((a,b)=>b.pass-a.pass||a.ruin-b.ruin||a.trades-b.trades).slice(0,12);
 const key='studio:scenario-discovery:'+stage;
 const saved=JSON.parse(localStorage.getItem(key)||'[]');
 out.innerHTML='<div style="overflow:auto"><table style="width:100%;font-size:12px"><thead><tr><th>Keep</th><th>Scenario</th><th>R1–R4</th><th>Hit %</th><th>Fail %</th><th>Neg %</th><th>Avg trades</th></tr></thead><tbody>'+ranked.map((c,i)=>'<tr><td><input type="checkbox" data-keep="'+i+'" '+(saved.includes(c.name)?'checked':'')+'></td><td>'+c.name+'</td><td>'+c.r.join('/')+'</td><td>'+fmt(c.pass*100)+'</td><td>'+fmt(c.ruin*100)+'</td><td>'+fmt(c.flat*100)+'</td><td>'+fmt(c.trades)+'</td></tr>').join('')+'</tbody></table></div><small>Hit = target reached within this short path; Fail = reaches modeled daily cap; Neg = ends negative without hitting cap. These are NOT account pass/failure probabilities. Ranked by short-path target hits, not trading days.</small>';
 out.querySelectorAll('[data-keep]').forEach(el=>el.addEventListener('change',()=>{const names=[...out.querySelectorAll('[data-keep]:checked')].map(x=>ranked[Number(x.dataset.keep)].name);localStorage.setItem(key,JSON.stringify(names));}));
}
function boot(){stages.forEach(init)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();