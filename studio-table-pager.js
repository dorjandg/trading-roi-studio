/* Compact, non-destructive pagination for simulator tables without native paging. */
(()=>{
 'use strict';
 const sizes=[5,10,20,50,100];
 const prefsKey='4ds:table-page-sizes:v1';
 let prefs={};try{prefs=JSON.parse(localStorage.getItem(prefsKey)||'{}')||{};}catch(_){}
 const save=()=>{try{localStorage.setItem(prefsKey,JSON.stringify(prefs));}catch(_){}};
 function init(table,index){
  if(table.dataset.compactPager||!table.tBodies.length||!table.tHead)return;
  if(table.closest('#journeyContents'))return; // Journey has its own accurate day pagination.
  const body=table.tBodies[0],rows=Array.from(body.rows);
  if(rows.length<2)return;
  const wrap=table.closest('.tablewrap')||table.parentElement;
  if(!wrap)return;
  const key=(table.id||table.tBodies[0].id||table.closest('[id]')?.id||'table')+':'+index;
  const pageSize=sizes.includes(Number(prefs[key]))?Number(prefs[key]):10;
  let page=1,size=pageSize;
  table.dataset.compactPager='1';
  const bar=document.createElement('div');
  bar.style.cssText='display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap;font-size:11px;padding:5px 2px;color:var(--muted)';
  const label=document.createElement('span');label.textContent='Rows';
  const select=document.createElement('select');select.setAttribute('aria-label','Rows per page');
  select.style.cssText='width:auto;min-width:55px;padding:2px 5px;font-size:11px';
  for(const n of sizes){const opt=document.createElement('option');opt.value=n;opt.textContent=n;select.appendChild(opt);}
  select.value=String(size);
  const status=document.createElement('span');status.style.whiteSpace='nowrap';
  const prev=document.createElement('button'),next=document.createElement('button');
  for(const [btn,txt] of [[prev,'‹'],[next,'›']]){btn.type='button';btn.textContent=txt;btn.style.cssText='padding:2px 7px;min-width:26px;font-size:13px';}
  bar.append(label,select,status,prev,next);wrap.after(bar);
  const originalHidden=new WeakMap();
  const render=()=>{
   const current=Array.from(body.rows);
   // Cash Flow period details are paired with the preceding period row.
   const groups=[];
   for(let i=0;i<current.length;i++){
    const row=current[i];
    if(row.classList.contains('cash-period-detail-row'))continue;
    if(row.classList.contains('cash-totals-row')||row.classList.contains('cash-total-row'))continue;
    const group=[row];
    if(current[i+1]?.classList.contains('cash-period-detail-row'))group.push(current[++i]);
    groups.push(group);
   }
   // Preserve rows hidden by an independent filter, e.g. account selection.
   for(const group of groups){const row=group[0];if(!originalHidden.has(row))originalHidden.set(row,row.hidden);}
   const available=groups.filter(group=>!originalHidden.get(group[0]));
   const pages=Math.max(1,Math.ceil(available.length/size));page=Math.min(page,pages);
   const start=(page-1)*size,end=Math.min(start+size,available.length);
   const shown=new Set(available.slice(start,end).map(group=>group[0]));
   for(const group of groups){
    const visible=shown.has(group[0]);
    group[0].hidden=!visible;
    if(group[1])group[1].hidden=!visible||group[1].getAttribute('aria-expanded')==='false'||!group[1].dataset.pagerDetailOpen;
   }
   status.textContent=available.length?(start+1)+'–'+end+' / '+available.length:'0 / 0';
   prev.disabled=page<=1;next.disabled=page>=pages;
   bar.hidden=available.length<=size;
  };
  select.addEventListener('change',()=>{size=Number(select.value)||10;page=1;prefs[key]=size;save();render();});
  prev.addEventListener('click',()=>{page=Math.max(1,page-1);render();});
  next.addEventListener('click',()=>{page++;render();});
  render();
 }
 let scheduled=false;
 function scan(){
  scheduled=false;
  document.querySelectorAll('#comparisonRows, #weeklyEconomicsContents table, #section7Panel table, #combined table, #chartsContents table').forEach((node,i)=>{
   const table=node.tagName==='TABLE'?node:node.closest('table');if(table)init(table,i);
  });
 }
 const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(scan);}});
 const start=()=>{scan();observer.observe(document.body,{childList:true,subtree:true});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
