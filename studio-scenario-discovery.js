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
 const pageKey='studio:scenario-discovery:pagesize:'+stage;
 let pageSize=5;try{const stored=localStorage.getItem(pageKey);if(['5','10','20','all'].includes(stored))pageSize=stored==='all'?'all':Number(stored)}catch(e){}
 const sortKey='studio:scenario-discovery:sort:'+stage;let sort={field:'hit',dir:'desc'};try{const v=JSON.parse(localStorage.getItem(sortKey)||'null');if(v&&['name','risks','hit','breach','negative','trades'].includes(v.field)&&['asc','desc'].includes(v.dir))sort=v}catch(e){}
 const value=(c,k)=>k==='name'?c.name.toLowerCase():k==='risks'?c.r[0]:c[k];
 const sortRows=()=>{ranked.sort((a,b)=>{const x=value(a,sort.field),y=value(b,sort.field);const diff=typeof x==='string'?x.localeCompare(y):x-y;return (sort.dir==='asc'?1:-1)*diff});};
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
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 out.innerHTML='<div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap;margin:4px 0 6px"><label style="font-size:11px">Rows <select data-page-size aria-label="Scenario rows per page" style="font-size:11px;padding:2px 4px">'+[5,10,20,'all'].map(x=>'<option value="'+x+'"'+(pageSize===x?' selected':'')+'>'+ (x==='all'?'All':x)+'</option>').join('')+'</select></label><button type="button" data-prev aria-label="Previous scenario page" style="padding:2px 8px">‹</button><span data-page-status style="font-size:11px;white-space:nowrap"></span><button type="button" data-next aria-label="Next scenario page" style="padding:2px 8px">›</button></div><div style="overflow-x:auto"><table style="width:100%;font-size:11px;border-collapse:collapse"><!--compact--><thead><tr>'+[['Keep','Save for later comparison'],['Scenario','Candidate daily trading sequence'],['Risks','Risk amounts in trade order'],['Hit %','Chance of hitting daily goal within allowed trades'],['Cap %','Chance of hitting the modeled risk cap'],['Neg %','Chance of ending negative but above cap'],['Trades','Expected attempted trades']].map((x,i)=>'<th title="'+esc(x[1])+'" style="padding:4px 5px;white-space:nowrap"><button type="button" data-head-help="'+i+'" aria-label="Explain '+esc(x[0])+'" title="'+esc(x[1])+'" style="font:inherit;color:inherit;background:none;border:0;padding:1px 2px;cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px">'+esc(x[0])+' <span aria-hidden="true" style="opacity:.7">ⓘ</span></button></th>').join('')+'</tr></thead><tbody>'+ranked.map((c,i)=>'<tr data-scenario-row style="height:29px"><td style="padding:3px 5px"><input type="checkbox" data-keep="'+i+'" '+(saved.includes(c.r.join('/'))?'checked':'')+' aria-label="Keep '+esc(c.name)+'"></td><td style="padding:3px 5px"><details><summary style="cursor:pointer;white-space:nowrap">'+esc(c.name)+'</summary><div>'+c.paths.sort((a,b)=>b.prob-a.prob).map(x=>esc(x.steps)+' = '+money(x.pnl)+' ('+pct(x.prob)+')').join('<div style="border-top:1px solid #344257;margin:3px 0"></div>')+'</div></details></td><td style="padding:3px 5px;white-space:nowrap">'+c.r.slice(0,max).filter(Boolean).join(' / ')+'</td><td style="padding:3px 5px">'+pct(c.hit)+'</td><td style="padding:3px 5px">'+pct(c.breach)+'</td><td style="padding:3px 5px">'+pct(c.negative)+'</td><td style="padding:3px 5px">'+c.trades.toFixed(2)+'</td></tr>').join('')+'</tbody></table></div><small>Ranking: daily-goal hit chance first, then cap risk, then trades. Click a scenario name to see win/loss paths. This is NOT a multi-day pass probability or a firm-approved risk plan.</small>'; out.querySelectorAll('[data-keep]').forEach(el=>el.addEventListener('change',()=>{const picks=[...out.querySelectorAll('[data-keep]:checked')].map(x=>ranked[Number(x.dataset.keep)].r.join('/'));try{localStorage.setItem(key,JSON.stringify(picks))}catch(e){}}));
 const help=[['Keep','Check to remember a risk scenario for comparison. This does not apply it to the main simulation.'],['Scenario','Name of the candidate. Open its row to inspect the possible win/loss paths.'],['Risks','Dollar amount risked on each successive trade, in order. Later trades are skipped if the daily target has already been reached.'],['Hit %','Estimated probability of reaching the DAILY profit goal within the selected maximum number of trades; not the probability of passing the evaluation.'],['Cap %','Estimated probability of reaching the manually entered loss cap in this simplified daily model; not a verified firm-rule breach rate.'],['Neg %','Estimated probability of ending the tested daily sequence below starting balance but above the modeled loss cap.'],['Trades','Expected number of trades attempted per simulated daily sequence, including early stops.']];
 const explanation=document.createElement('div');explanation.setAttribute('data-head-explanation','');explanation.setAttribute('role','status');explanation.style.cssText='display:none;margin:5px 0;padding:7px 9px;border:1px solid #506078;border-radius:7px;font-size:12px;line-height:1.45';
 out.querySelector('table').before(explanation);
 out.querySelectorAll('[data-head-help]').forEach(btn=>btn.addEventListener('click',()=>{const h=help[Number(btn.dataset.headHelp)];const same=explanation.dataset.active===btn.dataset.headHelp&&explanation.style.display!=='none';explanation.style.display=same?'none':'block';explanation.dataset.active=btn.dataset.headHelp;explanation.textContent=same?'':h[0]+' — '+h[1];}));
 const table=out.querySelector('table'),tbody=table.tBodies[0];
 // Stable row identities make sorting compatible with saved checkboxes and pagination.
 [...tbody.rows].forEach((tr,i)=>{tr.dataset.riskKey=ranked[i].r.join('/');tr.querySelector('[data-keep]').dataset.riskKey=tr.dataset.riskKey});
 const keepByRisk=()=>{const keys=[...out.querySelectorAll('[data-keep]:checked')].map(x=>x.dataset.riskKey);try{localStorage.setItem(key,JSON.stringify(keys))}catch(e){}};
 out.querySelectorAll('[data-keep]').forEach(x=>x.addEventListener('change',keepByRisk));
 const reorderRows=()=>{sortRows();const rows=new Map([...tbody.rows].map(tr=>[tr.dataset.riskKey,tr]));ranked.forEach(c=>{const tr=rows.get(c.r.join('/'));if(tr)tbody.appendChild(tr)});page=1;renderPage()};
 const sortable={1:'name',2:'risks',3:'hit',4:'breach',5:'negative',6:'trades'};
 [...table.tHead.rows[0].cells].forEach((th,i)=>{
  if(!(i in sortable))return;
  const b=document.createElement('button');b.type='button';b.textContent='↕';b.title='Sort ascending or descending';b.setAttribute('aria-label','Sort '+help[i][0]);b.style.cssText='font:inherit;background:none;border:0;color:inherit;cursor:pointer;padding:0 2px';
  th.appendChild(b);
  b.addEventListener('click',()=>{const field=sortable[i];sort={field,dir:sort.field===field&&sort.dir==='desc'?'asc':'desc'};try{localStorage.setItem(sortKey,JSON.stringify(sort))}catch(e){};[...table.tHead.querySelectorAll('[data-sort-indicator]')].forEach(x=>x.textContent='↕');b.textContent=sort.dir==='asc'?'↑':'↓';reorderRows()});
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