/* Restore last workspace position on refresh, without changing risk settings or navigation. */
(()=>{'use strict';
const key='4ds:workspace-last-position:v1';
const page=location.pathname+location.search;
let previous=null;
try{previous=JSON.parse(sessionStorage.getItem(key)||'null')}catch(e){}
function idFor(d){if(d.id)return '#'+CSS.escape(d.id);const all=[...document.querySelectorAll('details')];return 'details:'+all.indexOf(d)}
function save(){
 const details=[...document.querySelectorAll('details')].filter(d=>d.open).map(idFor);
 const record={page,x:scrollX,y:scrollY,details,at:Date.now()};
 try{sessionStorage.setItem(key,JSON.stringify(record))}catch(e){}
}
function restore(){
 if(!previous||previous.page!==page)return;
 for(const k of previous.details||[]){
  const d=k.startsWith('details:')?document.querySelectorAll('details')[Number(k.slice(8))]:document.querySelector(k);
  if(d&&d.tagName==='DETAILS')d.open=true;
 }
 const y=Number(previous.y)||0;
 requestAnimationFrame(()=>requestAnimationFrame(()=>scrollTo(Number(previous.x)||0,y)));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore,{once:true});else restore();
addEventListener('pagehide',save);
document.addEventListener('toggle',e=>{if(e.target.tagName==='DETAILS')save()},true);
let queued=false;addEventListener('scroll',()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;save()})},{passive:true});
})();