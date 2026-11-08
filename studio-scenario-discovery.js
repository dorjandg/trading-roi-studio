/* Target-first per-phase discovery; illustrative short-horizon paths, not a full firm pass engine. */
(()=>{'use strict';
const stages=['p1','p2','funded'],money=n=>'$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:0}),pct=n=>(100*n).toFixed(1)+'%';
const templates=[{id:'recover390',name:'Recover $390',r:[500,670,390,0]},{id:'attack830',name:'Attack $830',r:[500,670,830,0]},{id:'controlled',name:'Controlled',r:[350,450,250,0]}];
function init(stage){
 const host=document.querySelector('[data-recovery-stage="'+stage+'"]');if(!host||host.dataset.discoveryReady)return;
 host.dataset.discoveryReady='1';
 const p=document.createElement('details');p.className='scenario-discovery';p.style.cssText='margin:8px 0;padding:10px;border:1px solid #344257;border-radius:10px';
 p.innerHTML='<summary style="cursor:pointer;font-weight:600">Scenario Optimizer · find daily target paths</summary><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:end"><label>Daily goal $ <input data-f="goal" type="number" min="1" value="'+(stage==='p1'?1500:stage==='funded'?1000:500)+'" style="width:86px"></label><label>Win % <input data-f="wr" type="number" min="1" max="99" value="40" style="width:62px"></label><label>RR <input data-f="rr" type="number" min=".1" max="20" step=".1" value="3" style="width:62px"></label><label>Max/day <select data-f="max"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label><label>Risk cap $ <input data-f="cap" type="number" min="1" value="2000" style="width:84px"></label><button type="button" data-run>Find best paths</button></div><div data-out style="margin-top:10px;font-size:12px"></div><small>Research model only: independent wins, fixed RR, no commissions or slippage. Risk cap is a manual scenario constraint, not a verified firm rule. The model stops on reaching the daily goal; it does not establish account passing or Topstep trailing/consistency compliance. Saved selections do not alter Portfolio Simulation.</small>';
 host.before(p);p.querySelector('[data-run]').addEventListener('click',()=>run(p,stage));
}
function run(p,stage){
 const n=k=>Number(p.querySelector('[data-f="'+k+'"]').value),goal=n('goal'),wr=n('wr')/100,rr=n('rr'),max=n('max'),cap=n('cap'),out=p.querySelector('[data-out]');
 if(!(goal>0&&wr>0&&wr<1&&rr>0&&max>=1&&max<=4&&cap>0)){out.textContent='Check goal, win rate, RR, trades/day and risk cap.';return;}
 const candidates=[...templates];
 // Search for first trades that can achieve the daily objective in one win.
 for(const first of [250,350,400,450,500,Math.ceil(goal/rr/10)*10]){
  if(first>cap)continue;
  const second=Math.ceil((goal+first)/rr/10)*10;
  const thirdRecovery=Math.ceil((first+second)/rr/10)*10;
  candidates.push({id:'g'+first,name:'Target-first '+money(first),r:[first,second,thirdRecovery,0]});
  candidates.push({id:'s'+first,name:'Single-win '+money(first),r:[first,0,0,0]});
 }
 const unique=[...new Map(candidates.map(x=>[x.r.join('/'),x])).values()];
 function evaluate(c){
  let hit=0,breach=0,negative=0,trades=0,expected=0,paths=[];
  function walk(i,pnl,prob,steps){
   if(pnl>=goal||pnl<=-cap||i>=max||!c.r[i]||c.r[i]>cap+pnl){
    if(pnl>=goal)hit+=prob;
    else if(pnl<=-cap)breach+=prob;
    else if(pnl<0)negative+=prob;
    expected+=prob*pnl;paths.push({steps:steps.join(' → ')||'Stop',pnl,prob});return;
   }
   const risk=c.r[i];trades+=prob;
   walk(i+1,pnl+risk*rr,prob*wr,[...steps,'W '+money(risk)]);
   walk(i+1,pnl-risk,prob*(1-wr),[...steps,'L '+money(risk)]);
  }
  walk(0,0,1,[]);
  return {...c,hit,breach,negative,trades,expected,paths};
 }
 const ranked=unique.map(evaluate).sort((a,b)=>b.hit-a.hit||a.breach-b.breach||a.trades-b.trades).slice(0,14);
 const key='studio:scenario-discovery:v2:'+stage;let saved=[];try{saved=JSON.parse(localStorage.getItem(key)||'[]')}catch(e){}
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 out.innerHTML='<div style="overflow-x:auto"><table style="width:100%;font-size:12px"><thead><tr>'+[['Keep','Save for later comparison'],['Scenario','Candidate daily trading sequence'],['Risks','Risk amounts in trade order'],['Hit %','Chance of hitting daily goal within allowed trades'],['Cap %','Chance of hitting the modeled risk cap'],['Neg %','Chance of ending negative but above cap'],['Trades','Expected attempted trades']].map(x=>'<th title="'+x[1]+'">'+x[0]+'</th>').join('')+'</tr></thead><tbody>'+ranked.map((c,i)=>'<tr><td><input type="checkbox" data-keep="'+i+'" '+(saved.includes(c.r.join('/'))?'checked':'')+' aria-label="Keep '+esc(c.name)+'"></td><td><details><summary style="cursor:pointer">'+esc(c.name)+'</summary><div>'+c.paths.sort((a,b)=>b.prob-a.prob).map(x=>esc(x.steps)+' = '+money(x.pnl)+' ('+pct(x.prob)+')').join('<div style="border-top:1px solid #344257;margin:3px 0"></div>')+'</div></details></td><td>'+c.r.slice(0,max).filter(Boolean).join(' / ')+'</td><td>'+pct(c.hit)+'</td><td>'+pct(c.breach)+'</td><td>'+pct(c.negative)+'</td><td>'+c.trades.toFixed(2)+'</td></tr>').join('')+'</tbody></table></div><small>Ranking: daily-goal hit chance first, then cap risk, then trades. Click a scenario name to see win/loss paths. This is NOT a multi-day pass probability or a firm-approved risk plan.</small>';
 out.querySelectorAll('[data-keep]').forEach(el=>el.addEventListener('change',()=>{const picks=[...out.querySelectorAll('[data-keep]:checked')].map(x=>ranked[Number(x.dataset.keep)].r.join('/'));try{localStorage.setItem(key,JSON.stringify(picks))}catch(e){}}));
}
function boot(){stages.forEach(init)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();