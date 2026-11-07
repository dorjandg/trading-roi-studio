/* FTMO 2-Step Funded Buffer Builder v1 — pure, account-specific sizing policy.
   Only an explicitly applied FTMO-funded policy may use this module.
   This is a cash-risk simulation model, not broker/prop-firm authorization. */
(function(root){
'use strict';
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const cents=n=>Math.round(num(n)*100)/100;
const ceil=n=>Math.ceil(num(n)*100-1e-9)/100;
const clamp=(x,low,high)=>Math.max(low,Math.min(high,num(x,low)));
const defaults=Object.freeze({starterRisk:150,bufferTarget:450,growthCap:450,recoveryCap:450});
function normalize(raw={}){
 const v=raw||{};
 return {
  starterRisk:cents(clamp(v.starterRisk??defaults.starterRisk,.01,10000000)),
  bufferTarget:cents(clamp(v.bufferTarget??defaults.bufferTarget,.01,10000000)),
  growthCap:cents(clamp(v.growthCap??defaults.growthCap,.01,10000000)),
  recoveryCap:cents(clamp(v.recoveryCap??defaults.recoveryCap,.01,10000000))
 };
}
function valid(raw){
 if(!raw||typeof raw!=='object')return false;
 return ['starterRisk','bufferTarget','growthCap','recoveryCap'].every(k=>
  Number.isFinite(Number(raw[k]))&&Number(raw[k])>=.01&&Number(raw[k])<=10000000);
}
function quote(raw,{pnl=0,stageTrades=0,rr=3,target=Infinity,tradeCost=0}={}){
 const cfg=normalize(raw),balance=cents(pnl);
 if(balance>=num(target,Infinity)-.005)return {risk:0,phase:'target',nextGoal:target,reason:'Funded profit target reached'};
 const ratio=Math.max(.1,num(rr,3)),fee=Math.max(0,num(tradeCost));
 let risk,phase;
 if(stageTrades<=0){
  phase='start';risk=cfg.starterRisk;
 }else if(balance<cfg.bufferTarget-.005){
  phase='rebuild';
  // Recover toward the $450 buffer on the next 3R win; include trade fee.
  risk=Math.min(cfg.recoveryCap,ceil((cfg.bufferTarget-balance+fee)/ratio));
 }else{
  phase='growth';
  // Never risk more than the realized funded profit cushion.
  risk=Math.min(cfg.growthCap,Math.max(0,balance));
 }
 risk=cents(risk);
 return {risk,phase,nextGoal:cfg.bufferTarget,reason:phase==='start'?'Starter risk':
  phase==='rebuild'?'Rebuild realized buffer after drawdown':'Grow using realized profit buffer'};
}
function preview(raw,outcomes,options={}){
 const cfg=normalize(raw),rr=num(options.rr,3),target=num(options.target,3150);
 const daily=num(options.daily,Infinity),overall=num(options.overall,Infinity);
 const reserve=Math.max(0,num(options.reserve,0)),fee=Math.max(0,num(options.tradeCost,0));
 let pnl=cents(num(options.initialPnl,0)),status='active';
 const rows=[],path=String(outcomes||'').toUpperCase().replace(/[^WL]/g,'').slice(0,14);
 for(let i=0;i<path.length;i++){
  const selection=quote(cfg,{pnl,stageTrades:i,rr,target,tradeCost:fee});
  if(selection.phase==='target'){status='hit';break}
  const risk=selection.risk,available=Math.min(daily-reserve-fee,overall+pnl-reserve-fee);
  if(!(risk>=.01)||risk>available+.000001){
   status='blocked';
   rows.push({step:i+1,letter:path[i],phase:selection.phase,risk,pnl,status:'blocked'});
   break;
  }
  pnl=cents(pnl+(path[i]==='W'?risk*rr:-risk)-fee);
  status=pnl>=target-.005?'hit':overall+pnl<=0?'failed':'active';
  rows.push({step:i+1,letter:path[i],phase:selection.phase,risk,pnl,status});
  if(status!=='active')break;
 }
 const next=quote(cfg,{pnl,stageTrades:rows.filter(x=>x.status!=='blocked').length,rr,target,tradeCost:fee});
 return {rows,pnl,status:status==='active'&&pnl>=target-.005?'hit':status,nextRisk:status==='active'?next.risk:0,
  nextPhase:status==='active'?next.phase:null};
}
root.StudioFtmoFundedBuffer={defaults,normalize,valid,quote,preview,version:'1.0'};
})(typeof window!=='undefined'?window:globalThis);
