/* Target-first per-phase discovery; illustrative short-horizon paths, not a full firm pass engine. */
(()=>{'use strict';
function enableDirectTableHeaderDrag(table,onDrop,keepFirst=false){
 const heads=Array.from(table?.tHead?.rows[0]?.cells||[]);
 heads.forEach((head,index)=>{
  if((keepFirst&&index===0)||head.hidden)return;
  head.style.touchAction='none';head.style.cursor='grab';head.style.userSelect='none';
  // Keep the header tooltip dedicated to the metric definition; drag behavior remains available.
  let active=null,startX=0,startY=0,lastX=0,dragging=false;
  const clear=()=>{active=null;dragging=false;head.style.opacity='';heads.forEach(h=>h.style.outline='');};
  const targetAt=x=>{
   const candidates=heads.filter(h=>!h.hidden&&(!keepFirst||h!==heads[0])&&h.getBoundingClientRect().width>0);
   return candidates.find(h=>{const r=h.getBoundingClientRect();return x>=r.left&&x<=r.right;})||
    candidates.reduce((best,h)=>Math.abs(h.getBoundingClientRect().left+h.getBoundingClientRect().width/2-x)<Math.abs(best.getBoundingClientRect().left+best.getBoundingClientRect().width/2-x)?h:best,candidates[0]);
  };
  head.addEventListener('pointerdown',e=>{
   if(e.button!==0||e.target.closest('button,input,select,a'))return;
   active=e.pointerId;startX=e.clientX;startY=e.clientY;lastX=e.clientX;
   head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove',e=>{
   if(active!==e.pointerId)return;
   lastX=e.clientX;
   if(!dragging&&Math.hypot(e.clientX-startX,e.clientY-startY)>7)dragging=true;
   if(!dragging)return;
   e.preventDefault();head.style.opacity='.6';
   const target=targetAt(e.clientX);
   heads.forEach(h=>h.style.outline='');
   if(target&&target!==head)target.style.outline='2px solid var(--accent,#4aa3ff)';
   const scroll=table.closest('.tablewrap,[style*="overflow-x:auto"]');
   if(scroll){const r=scroll.getBoundingClientRect();if(e.clientX>r.right-25)scroll.scrollLeft+=15;else if(e.clientX<r.left+25)scroll.scrollLeft-=15;}
  });
  head.addEventListener('pointerup',e=>{
   if(active!==e.pointerId)return;
   const target=dragging?targetAt(lastX):null;
   clear();
   if(target&&target!==head)onDrop(head,target);
  });
  head.addEventListener('pointercancel',clear);
 });
}
const stages=['p1','p2','funded'],money=n=>'$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:0}),pct=n=>(100*n).toFixed(1)+'%';
const templates=[{id:'recover390',name:'Recover $390',r:[500,670,390,0]},{id:'attack830',name:'Attack $830',r:[500,670,830,0]},{id:'controlled',name:'Controlled',r:[350,450,250,0]}];
function init(stage){
 const host=document.querySelector('[data-recovery-stage="'+stage+'"]');if(!host||host.dataset.discoveryReady)return;
 host.dataset.discoveryReady='1';
 const p=document.createElement('details');p.className='scenario-discovery';p.style.cssText='margin:8px 0;padding:10px;border:1px solid #344257;border-radius:10px';
 p.innerHTML='<summary style="cursor:pointer;font-weight:600">Scenario Optimizer · find daily target paths</summary><div style="margin:5px 0 6px;display:flex;gap:5px;flex-wrap:wrap;align-items:center;font-size:11px"><label style="display:flex;gap:3px;align-items:center">Goal $ <input data-f="goal" title="Daily profit target. Risk sequences are derived from this target and RR." type="number" min="1" value="'+(stage==='p1'?1500:stage==='funded'?1000:500)+'" style="width:74px;padding:3px 4px;font-size:11px"></label><label style="display:flex;gap:3px;align-items:center">Win % <input data-f="wr" title="Estimated independent probability of a winning trade" type="number" min="1" max="99" value="40" style="width:48px;padding:3px 4px;font-size:11px"></label><label style="display:flex;gap:3px;align-items:center">RR <input data-f="rr" title="Profit multiple of risk on a winning trade" type="number" min=".1" max="20" step=".1" value="3" style="width:44px;padding:3px 4px;font-size:11px"></label><span title="Simulates until the target or risk cap; four-trade attempt, then restart separately" style="opacity:.75">4-trade attempt</span><label style="display:flex;gap:3px;align-items:center">Cap $ <input data-f="cap" title="Manual maximum modeled loss, not a verified firm limit" type="number" min="1" value="2000" style="width:66px;padding:3px 4px;font-size:11px"></label><button type="button" data-run style="padding:4px 8px;font-size:11px;min-height:27px">Find paths</button></div><div data-out style="margin-top:6px;font-size:12px"></div><small>Fast Pass + Reset: first two trades attack the pass target; third can recover to breakeven; fourth uses remaining risk budget. Stop on pass, reset, or exhaustion. Four-trade attempt: first two target the pass, third targets breakeven recovery, fourth uses remaining risk budget. Recovery to breakeven is a reset, not a pass. Risks are derived from the target and RR, not fixed dollar presets. Research model only: independent wins, fixed RR, no commissions/slippage; manual cap is not a verified firm rule. Not a Topstep pass or consistency simulation. Saved selections do not alter Portfolio Simulation.</small>';
 host.before(p);p.querySelector('[data-run]').addEventListener('click',()=>run(p,stage));
}
function run(p,stage){
 const n=k=>Number(p.querySelector('[data-f="'+k+'"]').value),goal=n('goal'),wr=n('wr')/100,rr=n('rr'),max=4,cap=n('cap'),out=p.querySelector('[data-out]');
 if(!(goal>0&&wr>0&&wr<1&&rr>0&&cap>0)){out.textContent='Check goal, win rate, RR and risk cap.';return;}
 // Fast Pass + Reset model. Each attempt has up to four trades:
 // 1/2 aim to pass, 3 aims to restore starting balance, 4 uses remaining capacity.
 // Reset is a distinct terminal outcome, never counted as a pass.
 const roundMoney=x=>Math.round((x+Number.EPSILON)*100)/100;
 const roundRisk=x=>Math.max(.01,roundMoney(x));
 const candidates=[];
 const add=(name,first,second,third,final)=>{
  candidates.push({id:[first,second,third,final].join('-'),name,first,second,third,final,r:[roundRisk(goal/rr*first)],weights:[first,second,third,final]});
 };
 for(const first of [1,.9,.8,.65,.5]){
  add('Fast pass '+Math.round(first*100)+'% · reset',first,1,'reset','remaining');
  add('Fast pass '+Math.round(first*100)+'% · reserve',first,1,'reset','half');
 }
 add('Two attacks · strong reset',1,1,'reset','remaining');
 add('Two attacks · third pass',1,1,'pass','remaining');
 function evaluate(c){
  let hit=0,breach=0,negative=0,reset=0,trades=0,expected=0,paths=[];
  const push=(pnl,prob,steps,result)=>{
   if(result==='hit')hit+=prob;
   else if(result==='reset')reset+=prob;
   else if(result==='cap')breach+=prob;
   else if(pnl<0)negative+=prob;
   expected+=prob*pnl;
   paths.push({pnl,prob,steps:steps.join(' → ')||'Stop',result});
  };
  function walk(i,pnl,prob,steps){
   const remaining=roundMoney(cap+pnl);
   if(pnl>=goal-.005){push(goal,prob,steps,'hit');return}
   if(pnl>=-.005&&i>=3){push(pnl,prob,steps,'reset');return}
   if(remaining<.01){push(pnl,prob,steps,'cap');return}
   if(i>=max){push(pnl,prob,steps,pnl>=-.005?'reset':pnl<=-cap+.005?'cap':'other');return}
   let desired;
   if(i===0)desired=goal/rr*c.first;
   else if(i===1)desired=(goal-pnl)/rr*c.second;
   else if(i===2)desired=(c.third==='pass'?goal-pnl:Math.max(0,-pnl))/rr;
   else desired=c.final==='half'?remaining/2:remaining;
   desired=roundRisk(desired);
   // Do not breach the loss budget just to attempt a pass or reset.
   if(desired>remaining+.005){
    if(i<3){walk(i+1,pnl,prob,[...steps,'Skip T'+(i+1)+' (insufficient budget)']);return}
    desired=remaining;
   }
   if(desired<.01){push(pnl,prob,steps,pnl>=-.005?'reset':'other');return}
   trades+=prob;
   const won=roundMoney(pnl+desired*rr);
   const lost=roundMoney(pnl-desired);
   walk(i+1,won,prob*wr,[...steps,'W '+money(desired)]);
   walk(i+1,lost,prob*(1-wr),[...steps,'L '+money(desired)]);
  }
  walk(0,0,1,[]);
  return {...c,hit,breach,negative,reset,trades,expected,paths};
 }
 const ranked=candidates.map(evaluate).sort((a,b)=>b.hit-a.hit||b.reset-a.reset||a.breach-b.breach||a.trades-b.trades);
 const key='studio:scenario-discovery:fast-reset:v1:'+stage;let saved=[];try{saved=JSON.parse(localStorage.getItem(key)||'[]')}catch(e){}
 const pageKey='studio:scenario-discovery:pagesize:'+stage;
 let pageSize='all';try{const stored=localStorage.getItem(pageKey);if(['5','10','20','all'].includes(stored))pageSize=stored==='all'?'all':Number(stored)}catch(e){}
 const priorityKey='studio:scenario-discovery:priority:'+stage;let priority='hit-trades';try{priority=localStorage.getItem(priorityKey)||priority}catch(e){}
 const sortKey='studio:scenario-discovery:sort:'+stage;let sort={field:'hit',dir:'desc'};try{const v=JSON.parse(localStorage.getItem(sortKey)||'null');if(v&&['name','risks','hit','breach','reset','trades'].includes(v.field)&&['asc','desc'].includes(v.dir))sort=v}catch(e){}
 const value=(c,k)=>k==='name'?c.name.toLowerCase():k==='risks'?c.r[0]:c[k];
 const sortRows=()=>{ranked.sort((a,b)=>{
  if(priority!=='manual'){
   const compare=(k,dir)=>dir*(value(a,k)-value(b,k));
   const criteria=priority==='trades-hit'?[['trades',1],['hit',-1],['breach',1]]:priority==='safe'?[['breach',1],['hit',-1],['trades',1]]:priority==='profit'?[['expected',-1],['hit',-1],['trades',1]]:[['hit',-1],['trades',1],['breach',1]];
   for(const [k,dir] of criteria){const diff=compare(k,dir);if(diff)return diff}
   return a.r[0]-b.r[0];
  }
  const x=value(a,sort.field),y=value(b,sort.field),diff=typeof x==='string'?x.localeCompare(y):x-y;
  return (sort.dir==='asc'?1:-1)*diff;
 });};
 sortRows();
 const perPage=()=>pageSize==='all'?ranked.length:pageSize;
 let page=1;
 const renderPage=()=>{
  const total=Math.max(1,Math.ceil(ranked.length/perPage()));page=Math.min(Math.max(1,page),total);
  const start=(page-1)*perPage();
  out.querySelectorAll('tbody tr[data-scenario-row]').forEach((tr,i)=>{tr.hidden=i<start||i>=start+perPage();});
  const status=out.querySelector('[data-page-status]');if(status)status.textContent=(ranked.length?start+1:0)+'–'+Math.min(ranked.length,start+perPage())+' / '+ranked.length+' · '+page+'/'+total;
  const prev=out.querySelector('[data-prev]'),next=out.querySelector('[data-next]');if(prev)prev.disabled=page===1;if(next)next.disabled=page===total;
 };
 const renderPaths=c=>{
 const paths=[...c.paths].map((x,i)=>({...x,original:i,stepsCount:x.steps==='Stop'?0:x.steps.split(' → ').length})).sort((a,b)=>b.prob-a.prob||b.pnl-a.pnl);
 const riskKey=c.id;
 const row=x=>{
  const color=x.pnl>=goal?'#80d6a6':x.pnl<0?'#f3a3a3':'#c5d2e2';
  const sequence=String(x.steps).split(' → ').map(t=>'<span style="color:'+(t.startsWith('W ')?'#80d6a6':t.startsWith('L ')?'#f3a3a3':'#c5d2e2')+'">'+esc(t)+'</span>').join(' <span style="opacity:.5">→</span> ');
  return '<tr data-path-row data-pnl="'+x.pnl+'" data-prob="'+x.prob+'" data-trades="'+x.stepsCount+'" data-result="'+(x.result==='hit'?'hit':x.result==='reset'?'reset':x.result==='cap'?'cap':x.pnl<0?'loss':'other')+'" style="border-bottom:1px solid #34425766"><td style="padding:2px 4px;white-space:normal">'+sequence+'</td><td style="padding:2px 4px;color:'+color+';white-space:nowrap;text-align:right">'+money(x.pnl)+'</td><td style="padding:2px 4px;text-align:right;white-space:nowrap">'+pct(x.prob)+'</td><td style="padding:2px 4px;text-align:right">'+x.stepsCount+'</td></tr>';
 };
 return '<div data-path-mini data-risk-key="'+esc(riskKey)+'" style="font-size:9px;line-height:1.35;width:min(550px,76vw);max-width:100%;white-space:normal">'+
 '<div style="display:flex;gap:5px;align-items:center;justify-content:space-between;margin:3px 0"><span data-path-count>'+paths.length+' paths</span><div style="display:flex;gap:4px;align-items:center">'+
 '<select data-path-filter aria-label="Filter scenario paths" style="font-size:9px;padding:1px 2px"><option value="all">All paths</option><option value="hit">Passed</option><option value="reset">Reset</option><option value="cap">Cap reached</option><option value="loss">Negative P&L</option><option value="other">Other</option></select>'+
 '<select data-path-sort aria-label="Sort scenario paths" style="font-size:9px;padding:1px 2px"><option value="prob-desc">Probability ↓</option><option value="prob-asc">Probability ↑</option><option value="pnl-desc">P&L ↓</option><option value="pnl-asc">P&L ↑</option><option value="trades-asc">Trades ↑</option><option value="trades-desc">Trades ↓</option></select></div></div>'+
 '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:9px"><thead><tr style="text-align:left;opacity:.8"><th style="padding:2px 4px">Win/loss sequence</th><th style="text-align:right">Net P&L</th><th style="text-align:right">Chance</th><th style="text-align:right">Trades</th></tr></thead><tbody>'+paths.map(row).join('')+'</tbody></table></div></div>';
 };
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 out.innerHTML='<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin:4px 0;font-size:11px"><label>Show first <select data-priority aria-label="Rank scenarios by priority" style="font-size:11px;padding:2px 4px"><option value="hit-trades">Highest hit % → fewest trades</option><option value="trades-hit">Fewest trades → highest hit %</option><option value="safe">Lowest cap risk → highest hit %</option><option value="profit">Highest expected profit → hit %</option><option value="manual">Manual column sorting</option></select></label><span title="Days to full phase target are not modeled by this daily optimizer" style="opacity:.7">Days: not modeled</span></div><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap;margin:4px 0 6px"><label style="font-size:11px">Rows <select data-page-size aria-label="Scenario rows per page" style="font-size:11px;padding:2px 4px">'+['all',5,10,20].map(x=>'<option value="'+x+'"'+(pageSize===x?' selected':'')+'>'+ (x==='all'?'All':x)+'</option>').join('')+'</select></label><button type="button" data-prev aria-label="Previous scenario page" style="padding:2px 8px">‹</button><span data-page-status style="font-size:11px;white-space:nowrap"></span><button type="button" data-next aria-label="Next scenario page" style="padding:2px 8px">›</button></div><div style="overflow-x:auto"><table style="width:100%;font-size:10px;border-collapse:collapse"><!--compact--><thead><tr>'+[['Keep','Save for later comparison'],['Scenario','Risk sizing sequence; all candidates aim for the same full daily target'],['Risks','First trade risk only. Later risks are recalculated after each actual outcome; expanded paths show executed trades only.'],['Hit %','Estimated probability of reaching the exact daily target before loss cap or calculation horizon'],['Cap %','Chance of hitting the modeled risk cap'],['Reset %','Chance of reaching breakeven or better without passing within four trades'],['Trades','Probability-weighted expected number of trades executed before target, cap or horizon']].map((x,i)=>'<th title="'+esc(x[1])+'" style="padding:2px 4px;white-space:nowrap"><button type="button" data-head-help="'+i+'" aria-label="Explain '+esc(x[0])+'" title="'+esc(x[1])+'" style="font:inherit;color:inherit;background:none;border:0;padding:1px 2px;cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px">'+esc(x[0])+' <span aria-hidden="true" style="opacity:.7">ⓘ</span></button></th>').join('')+'</tr></thead><tbody>'+ranked.map((c,i)=>'<tr data-scenario-row style="height:23px"><td style="padding:3px 5px"><input type="checkbox" data-keep="'+i+'" '+(saved.includes(c.id)?'checked':'')+' aria-label="Keep '+esc(c.name)+'"></td><td style="padding:3px 5px"><details><summary style="cursor:pointer;white-space:nowrap">'+esc(c.name)+'</summary>'+renderPaths(c)+'</details></td><td style="padding:3px 5px;white-space:nowrap">'+money(c.r[0])+' first · dynamic'+'</td><td style="padding:3px 5px">'+pct(c.hit)+'</td><td style="padding:3px 5px">'+pct(c.breach)+'</td><td style="padding:3px 5px">'+pct(c.reset)+'</td><td style="padding:3px 5px">'+c.trades.toFixed(2)+'</td></tr>').join('')+'</tbody></table></div><small>Ranking: daily-goal hit chance first, then cap risk, then trades. Click a scenario name to see win/loss paths. This is NOT a multi-day pass probability or a firm-approved risk plan.</small>'; out.querySelectorAll('[data-keep]').forEach(el=>el.addEventListener('change',()=>{const picks=[...out.querySelectorAll('[data-keep]:checked')].map(x=>ranked[Number(x.dataset.keep)].r.join('/'));try{localStorage.setItem(key,JSON.stringify(picks))}catch(e){}}));
 const help=[['Keep','Check to remember a risk scenario for comparison. This does not apply it to the main simulation.'],['Scenario','Name of the candidate. Open its row to inspect the possible win/loss paths.'],['Risks','Starting trade risk. Later risks depend on the outcome: second pass attempt, third breakeven reset, fourth remaining budget.'],['Hit %','Estimated chance of reaching the pass target within the four-trade attempt, not an entire multi-day evaluation.'],['Cap %','Estimated probability of reaching the manually entered loss cap in this simplified daily model; not a verified firm-rule breach rate.'],['Reset %','Estimated chance of returning to breakeven or above without reaching the pass target in this four-trade attempt.'],['Trades','Expected number of trades attempted per simulated daily sequence, including early stops.']];
 // Portfolio SIM-style floating tooltip: overlays the table without affecting row layout.
 const explanation=document.createElement('div');
 explanation.setAttribute('data-head-explanation','');
 explanation.setAttribute('role','tooltip');
 explanation.hidden=true;
 explanation.style.cssText='position:fixed;z-index:2147483000;width:max-content;min-width:190px;max-width:min(330px,76vw);white-space:normal;overflow-wrap:anywhere;padding:10px 12px;text-align:left;background:#202f41;color:#f3f8ff;border:1px solid #6284a9;border-radius:8px;box-shadow:0 7px 22px rgba(0,0,0,.48);font-size:12px;font-weight:400;line-height:1.5;pointer-events:none';
 document.body.appendChild(explanation);
 let activeHelp=null;
 const hideHelp=()=>{explanation.hidden=true;activeHelp=null};
 const showHelp=btn=>{
  const h=help[Number(btn.dataset.headHelp)];if(!h)return;
  explanation.textContent=h[0]+' — '+h[1];
  explanation.hidden=false;
  const r=btn.getBoundingClientRect(),w=explanation.getBoundingClientRect().width,hgt=explanation.getBoundingClientRect().height;
  const left=Math.max(8,Math.min(r.left,window.innerWidth-w-8));
  const top=r.bottom+hgt+8<=window.innerHeight?r.bottom+7:Math.max(8,r.top-hgt-7);
  explanation.style.left=left+'px';explanation.style.top=top+'px';activeHelp=btn;
 };
 out.querySelectorAll('[data-head-help]').forEach(btn=>{
  btn.addEventListener('click',e=>{e.stopPropagation();if(activeHelp===btn&&!explanation.hidden)hideHelp();else showHelp(btn)});
  btn.addEventListener('mouseenter',()=>showHelp(btn));
  btn.addEventListener('mouseleave',()=>{if(activeHelp===btn)hideHelp()});
  btn.addEventListener('focus',()=>showHelp(btn));
  btn.addEventListener('blur',()=>{if(activeHelp===btn)hideHelp()});
 });
 document.addEventListener('pointerdown',e=>{if(activeHelp&&!activeHelp.contains(e.target))hideHelp()},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hideHelp()});
 window.addEventListener('scroll',hideHelp,true);
 window.addEventListener('resize',hideHelp);

 // Independent sorting/filtering within each expanded scenario; never reorder outer table rows.
 out.querySelectorAll('[data-path-mini]').forEach(mini=>{
  const filter=mini.querySelector('[data-path-filter]'),sorter=mini.querySelector('[data-path-sort]'),body=mini.querySelector('tbody'),rows=[...body.querySelectorAll('[data-path-row]')],counter=mini.querySelector('[data-path-count]');
  const key='studio:scenario-discovery:pathprefs:'+stage+':'+mini.dataset.riskKey;
  try{const pref=JSON.parse(localStorage.getItem(key)||'null');if(pref){if([...filter.options].some(x=>x.value===pref.filter))filter.value=pref.filter;if([...sorter.options].some(x=>x.value===pref.sort))sorter.value=pref.sort}}catch(e){}
  const update=()=>{
   const [field,dir]=sorter.value.split('-');
   const attr=field==='pnl'?'pnl':field==='trades'?'trades':'prob';
   rows.sort((a,b)=>(Number(a.dataset[attr])-Number(b.dataset[attr]))*(dir==='asc'?1:-1));
   rows.forEach(tr=>{tr.hidden=filter.value!=='all'&&tr.dataset.result!==filter.value;body.appendChild(tr)});
   const count=rows.filter(tr=>!tr.hidden).length;
   counter.textContent=count+' / '+rows.length+' paths';
   try{localStorage.setItem(key,JSON.stringify({filter:filter.value,sort:sorter.value}))}catch(e){}
  };
  filter.addEventListener('change',update);sorter.addEventListener('change',update);update();
 });
 const table=out.querySelector('table'),tbody=table.tBodies[0];
 // Stable row identities make sorting compatible with saved checkboxes and pagination.
 [...tbody.rows].forEach((tr,i)=>{tr.dataset.riskKey=ranked[i].r.join('/');tr.querySelector('[data-keep]').dataset.riskKey=tr.dataset.riskKey});
 const keepByRisk=()=>{const keys=[...out.querySelectorAll('[data-keep]:checked')].map(x=>x.dataset.riskKey);try{localStorage.setItem(key,JSON.stringify(keys))}catch(e){}};
 out.querySelectorAll('[data-keep]').forEach(x=>x.addEventListener('change',keepByRisk));
 const reorderRows=()=>{sortRows();const rows=new Map([...tbody.rows].map(tr=>[tr.dataset.riskKey,tr]));ranked.forEach(c=>{const tr=rows.get(c.r.join('/'));if(tr)tbody.appendChild(tr)});page=1;renderPage()};
 const prioritySelect=out.querySelector('[data-priority]');prioritySelect.value=priority;
 prioritySelect.addEventListener('change',()=>{priority=prioritySelect.value;try{localStorage.setItem(priorityKey,priority)}catch(e){}reorderRows()});
 const sortable={1:'name',2:'risks',3:'hit',4:'breach',5:'negative',6:'trades'};
 [...table.tHead.rows[0].cells].forEach((th,i)=>{
  if(!(i in sortable))return;
  const b=document.createElement('button');b.type='button';b.textContent='↕';b.title='Sort ascending or descending';b.setAttribute('aria-label','Sort '+help[i][0]);b.style.cssText='font:inherit;background:none;border:0;color:inherit;cursor:pointer;padding:0 2px';
  th.appendChild(b);
  b.addEventListener('click',()=>{const field=sortable[i];priority='manual';prioritySelect.value='manual';try{localStorage.setItem(priorityKey,priority)}catch(e){}sort={field,dir:sort.field===field&&sort.dir==='desc'?'asc':'desc'};try{localStorage.setItem(sortKey,JSON.stringify(sort))}catch(e){};[...table.tHead.querySelectorAll('[data-sort-indicator]')].forEach(x=>x.textContent='↕');b.textContent=sort.dir==='asc'?'↑':'↓';reorderRows()});
  if(sort.field===sortable[i])b.textContent=sort.dir==='asc'?'↑':'↓';
  b.dataset.sortIndicator='1';
 });
 // Drag headers on desktop, or use accessible left/right buttons on touch.
 const orderKey='studio:scenario-discovery:order:'+stage;
 const cols=['keep','name','risks','hit','breach','negative','trades'];
 let order=cols.slice();try{const v=JSON.parse(localStorage.getItem(orderKey)||'null');if(Array.isArray(v)&&v.length===cols.length&&cols.every(k=>v.includes(k)))order=v}catch(e){}
 [...table.tHead.rows[0].cells].forEach((th,i)=>{th.dataset.col=cols[i];th.draggable=false;th.title=(th.title||'')+' · Drag to reorder';});
 [...tbody.rows].forEach(tr=>[...tr.cells].forEach((td,i)=>td.dataset.col=cols[i]));
 const applyOrder=()=>{for(const tr of [table.tHead.rows[0],...tbody.rows]){const cells=new Map([...tr.cells].map(c=>[c.dataset.col,c]));order.forEach(k=>{if(cells.has(k))tr.appendChild(cells.get(k))})}try{localStorage.setItem(orderKey,JSON.stringify(order))}catch(e){}};
 const move=(from,to)=>{if(!cols.includes(from)||!cols.includes(to)||from===to)return;order=order.filter(k=>k!==from);order.splice(order.indexOf(to),0,from);applyOrder()};
 enableDirectTableHeaderDrag(table,(source,target)=>move(source.dataset.col,target.dataset.col),false);
 // Same compact upper-right filter placement as Portfolio SIM; filter choices never change saved order.
 const filterKey='studio:scenario-discovery:visible:'+stage;
 let visible=cols.slice();try{const v=JSON.parse(localStorage.getItem(filterKey)||'null');if(Array.isArray(v)&&v.length&&v.every(k=>cols.includes(k)))visible=v}catch(e){}
 const toolbar=document.createElement('div');toolbar.style.cssText='display:flex;justify-content:flex-end;position:relative;margin:4px 0';
 const trigger=document.createElement('button');trigger.type='button';trigger.textContent='☷';trigger.title='Filter visible columns';trigger.setAttribute('aria-label','Filter columns');trigger.setAttribute('aria-expanded','false');trigger.style.cssText='font-size:15px;padding:3px 9px;min-width:30px';
 const panel=document.createElement('div');panel.hidden=true;panel.style.cssText='position:absolute;right:0;top:100%;z-index:30;width:min(330px,90vw);max-height:360px;overflow:auto;padding:10px;border:1px solid var(--border,#354359);border-radius:8px;background:var(--panel,#182232);color:var(--text,#fff);box-shadow:0 6px 20px #0005';
 const modes=document.createElement('div');modes.style.cssText='display:flex;gap:5px;margin-bottom:6px';
 const category=document.createElement('button'),manual=document.createElement('button');category.type=manual.type='button';category.textContent='By category';manual.textContent='Manual';modes.append(category,manual);panel.append(modes);
 const options=document.createElement('div');panel.append(options);
 const names=Object.fromEntries(cols.map((k,i)=>[k,help[i][0]]));
 const groups={Selection:['keep'],Strategy:['name','risks'],Results:['hit','breach','negative','trades']};
 const applyVisible=()=>{for(const tr of [table.tHead.rows[0],...tbody.rows])for(const cell of tr.cells)cell.hidden=!visible.includes(cell.dataset.col);try{localStorage.setItem(filterKey,JSON.stringify(visible))}catch(e){}};
 const checkbox=(name,keys)=>{const label=document.createElement('label');label.style.cssText='display:flex;gap:7px;align-items:center;margin:4px 0;font-size:12px';const input=document.createElement('input');input.type='checkbox';input.checked=keys.every(k=>visible.includes(k));input.addEventListener('change',()=>{const next=input.checked?[...new Set([...visible,...keys])]:visible.filter(k=>!keys.includes(k));if(next.length){visible=next;applyVisible()}else input.checked=true});label.append(input,document.createTextNode(name));return label};
 const drawMode=mode=>{options.replaceChildren();const entries=mode==='category'?Object.entries(groups):cols.map(k=>[names[k],[k]]);for(const [name,keys] of entries)options.append(checkbox(name,keys));category.style.fontWeight=mode==='category'?'700':'400';manual.style.fontWeight=mode==='manual'?'700':'400'};
 category.addEventListener('click',()=>drawMode('category'));manual.addEventListener('click',()=>drawMode('manual'));drawMode('category');
 const closePanel=()=>{panel.hidden=true;panel.style.display='none';trigger.setAttribute('aria-expanded','false')};
 trigger.addEventListener('click',()=>{panel.hidden=!panel.hidden;panel.style.display=panel.hidden?'none':'';trigger.setAttribute('aria-expanded',String(!panel.hidden))});
 document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!toolbar.contains(e.target))closePanel()},true);
 document.addEventListener('touchstart',e=>{if(!panel.hidden&&!toolbar.contains(e.target))closePanel()},{capture:true,passive:true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){closePanel();trigger.focus()}});
 toolbar.append(trigger,panel);table.parentElement.before(toolbar);
 applyVisible();

 applyOrder();
 out.querySelector('[data-page-size]').addEventListener('change',e=>{pageSize=e.target.value==='all'?'all':Number(e.target.value);try{localStorage.setItem(pageKey,String(pageSize))}catch(err){}page=1;renderPage();});
 out.querySelector('[data-prev]').addEventListener('click',()=>{page--;renderPage()});
 out.querySelector('[data-next]').addEventListener('click',()=>{page++;renderPage()});
 renderPage();
}
function boot(){stages.forEach(init)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();