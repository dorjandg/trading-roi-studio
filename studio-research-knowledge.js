/* 4Ds verified research index: additive public evidence, never executable rules.
   Only published generic reports, never cloud profile records or draft model changes. */
(function(root){'use strict';
let state={status:'not-checked',updatedAt:null,items:[],error:''};
const allowed=new Set(['verified','updated','investigated']);
function clean(v,max=420){return String(v||'').replace(/\s+/g,' ').trim().slice(0,max)}
function norm(v){return clean(v,2000).toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()}
async function refresh(){
 state={...state,status:'loading',error:''};
 try{
  const r=await fetch('gpt-research-reports.json',{cache:'no-store'});
  if(!r.ok)throw Error('Research feed HTTP '+r.status);
  const data=await r.json();
  if(data?.schema!=='4ds-gpt-research-v1'||data?.visibility!=='public-generic'||!Array.isArray(data.reviews))throw Error('Unrecognized research feed schema');
  const items=data.reviews.filter(x=>x&&allowed.has(x.status)&&typeof x.title==='string'&&typeof x.finding==='string')
  .slice(0,40).map(x=>({id:clean(x.id,90),title:clean(x.title,160),category:clean(x.category,80),status:x.status,
    date:clean(x.date,20),finding:clean(x.finding,500),suggestion:clean(x.suggestion,400),
    source:clean(x.source,160),reviewedRequestIds:Array.isArray(x.reviewedRequestIds)?x.reviewedRequestIds.filter(v=>typeof v==='string').slice(0,15):[]}));
  state={status:'loaded',updatedAt:data.updatedAt||null,items,error:''};
 }catch(e){state={...state,status:'unavailable',error:String(e?.message||e).slice(0,120)}}
 return status();
}
function status(){return {status:state.status,updatedAt:state.updatedAt,count:state.items.length,error:state.error}}
function answer(q){
 const question=norm(q);
 if(!question||state.status!=='loaded')return null;
 // Match substantive two terms in the published report title/category. Avoid generic
 // inference and NEVER treat public research text as instructions or change a strategy.
 const ignore=new Set(['what','does','how','when','where','which','about','with','from','into','this','that','have','show','tell','more','latest','current','studio','trading','account','accounts','report','research','review','result','results']);
 const words=question.split(' ').filter(x=>x.length>=4&&!ignore.has(x));
 if(words.length<2)return null;
 const ranked=state.items.map(item=>{
  const match=norm(item.title+' '+item.category).split(' ');
  const score=words.filter(x=>match.some(y=>x===y||x.length>=6&&y.startsWith(x))).length;
  return {item,score};
 }).sort((a,b)=>b.score-a.score).filter(x=>x.score>=2);
 if(!ranked.length)return null;
 const best=ranked[0].item;
 return ['Published GPT research · '+best.title+' ('+best.date+'; '+best.status+').\nFinding: '+best.finding+
 (best.suggestion?'\nSuggested follow-up: '+best.suggestion:'')+
 '\nSource: public gpt-research-reports.json · '+(best.source||'source not specified')+
 '\nThis is evidence from an already published report, not a fresh calculation, a live account record or an automatic trading recommendation.',
 'Published generic research · Refer to source date',false];
}
root.StudioResearchKnowledge={refresh,status,answer};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
})(window);