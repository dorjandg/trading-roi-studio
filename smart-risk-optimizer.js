/* Smart Setup Optimizer — deterministic illustrative R1-first candidate search.
   Does not modify user settings, infer win probabilities, or place trades. */
(function(global){
 'use strict';
 const LEVELS=['r1','r2','r3','r4'];
 const OBJECTIVES=[
  ['fast','S1 · Fastest'],['low','S2 · Lowest Risk'],
  ['balanced','S3 · Balanced'],['recovery','S4 · Recovery'],['overall','S5 · Best Overall']
 ];
 const money=n=>Math.round((Number(n)||0)*100)/100;
 const ceil=n=>Math.ceil((Number(n)||0)*100-1e-7)/100;
 const num=(v,defaultValue=0)=>Number.isFinite(Number(v))?Number(v):defaultValue;
 function configOf(x){
  const p={
   goal:num(x.goal),rr:num(x.rr),pnl:num(x.initialPnl),minDays:Math.max(0,Math.floor(num(x.minDays))),
   completedDays:Math.max(0,Math.floor(num(x.completedDays))),
   daily:Math.max(0,num(x.daily)),overall:Math.max(0,num(x.overall)),
   buffer:Math.max(.01,num(x.buffer)),staticFloor:!!x.staticFloor,
   winCap:Math.max(1,Math.min(6,Math.floor(num(x.winCap,2)))),
   depth:Math.max(1,Math.min(8,Math.floor(num(x.depth,6))))
  };
  p.need=p.goal-p.pnl;
  // This is modeled *initial* headroom, not intratrade equity or live broker margin.
  p.cap=Math.min(p.daily>0?p.daily-p.buffer:Infinity,
   p.staticFloor&&p.overall>0?p.overall+p.pnl-p.buffer:Infinity);
  if(!(p.goal>0&&p.rr>0))p.error='Set a positive stage target and RR.';
  else if(!Number.isFinite(p.cap))p.error='A verified numeric daily or static loss allowance is required to optimize risk.';
  else if(p.cap<.01)p.error='No usable risk headroom remains after the safety buffer.';
  else if(p.need<=.005)p.error='Target already reached; no new risk is needed.';
  return p;
 }
 function evaluate(p,risks){
  const hit=[],fail=[],blocked=[],stop=[],active=[];
  const stack=[{pnl:p.pnl,dayStart:p.pnl,tradesDay:0,days:0,peak:p.pnl,dd:0,
   wl:'',tiers:'',next:'r1',history:[]}];
  while(stack.length){
   const a=stack.pop();
   if(a.pnl>=p.goal-.005){hit.push(a);continue}
   if(a.wl.length>=p.depth){active.push(a);continue}
   const tier=a.next,risk=risks[tier]||0;
   if(!(risk>=.01)){stop.push(a);continue}
   const room=Math.min(p.daily>0?p.daily+a.pnl-a.dayStart-p.buffer:Infinity,
    p.staticFloor&&p.overall>0?p.overall+a.pnl-p.buffer:Infinity);
   if(risk>room+1e-7){blocked.push(a);continue}
   for(const outcome of ['L','W']){
    const win=outcome==='W',newPnl=money(a.pnl+(win?risk*p.rr:-risk));
    const newDays=a.days+(a.tradesDay===0?1:0);
    const item={pnl:newPnl,dayStart:a.dayStart,tradesDay:a.tradesDay+1,days:newDays,
      peak:Math.max(a.peak,newPnl),dd:Math.max(a.dd,a.peak-newPnl),
      wl:a.wl+outcome,tiers:a.tiers+tier.slice(-1),history:[...a.history,{tier,outcome,risk,day:newDays,pnl:newPnl}],next:tier};
    if(p.staticFloor&&p.overall>0&&p.overall+newPnl<=0||
       p.daily>0&&p.daily+newPnl-a.dayStart<=0){fail.push(item);continue}
    if(newPnl>=p.goal-.005){hit.push(item);continue}
    if(win){
     item.next=tier==='r1'?'r2':tier==='r2'?'r2':tier==='r3'?'r2':'r2';
    }else{
     item.next=tier==='r1'?'r2':tier==='r2'?'r3':tier==='r3'?'r4':'stop';
    }
    if(!win||item.tradesDay>=p.winCap){
     item.dayStart=newPnl;item.tradesDay=0;
    }
    if(item.next==='stop'||!risks[item.next])stop.push(item);
    else stack.push(item);
   }
  }
  const routeOrder=(a,b)=>a.wl.length-b.wl.length||a.days-b.days||a.dd-b.dd||a.history.reduce((s,h)=>s+h.risk,0)-b.history.reduce((s,h)=>s+h.risk,0);
  hit.sort(routeOrder);
  const afterLoss=hit.filter(x=>x.wl.includes('L'));
  const afterDouble=hit.filter(x=>x.wl.includes('LL'));
  const fastest=hit[0]||null;
  const bestAfterLoss=afterLoss[0]||null;
  const bestAfterDouble=afterDouble[0]||null;
  return {fastest,bestAfterLoss,bestAfterDouble,
   examples:[fastest,bestAfterLoss,bestAfterDouble].filter((v,i,a)=>v&&a.findIndex(x=>x?.wl===v.wl&&x?.tiers===v.tiers)===i).slice(0,3),
   counts:{hit:hit.length,active:active.length,blocked:blocked.length,stopped:stop.length,failed:fail.length},
   maxRisk:Math.max(...LEVELS.map(n=>risks[n]||0)),risks};
 }
 function candidates(p){
  const used=new Set(),all=[];
  const need=p.need,rr=p.rr,cap=p.cap;
  function addR(list,v){
   const amount=ceil(v);
   if(amount>=.01&&amount<=cap+1e-8&&!list.includes(amount))list.push(amount);
  }
  const r1List=[];
  for(const fraction of [1,.9,.8,.75,.67,.6,.5,.4,.33,.25,.2,.15,.125])addR(r1List,need/rr*fraction);
  for(const fraction of [1,.9,.75,.6])addR(r1List,cap*fraction);
  r1List.sort((a,b)=>b-a);
  for(const r1 of r1List){
   const r2List=[];
   for(const fraction of [1,.9,.8,.67,.5,.4,.33])addR(r2List,(need+r1)/rr*fraction);
   for(const fraction of [1,.8,.6])addR(r2List,cap*fraction);
   for(const v of [r1,need/(rr*2),need/(rr*3),need/(rr*5)])addR(r2List,v);
   r2List.sort((a,b)=>b-a);
   for(const r2 of r2List){
    const llRoom=Math.min(cap,p.staticFloor&&p.overall>0?p.overall+p.pnl-r1-r2-p.buffer:cap);
    const r3List=[0];
    if(llRoom>=.01){
     // After L(R1) L(R2), W(R3) W(R2) should finish whenever possible.
     const booster=(need+r1-(rr-1)*r2)/rr;
     for(const v of [booster,booster*.8,booster*1.15,r1*.4,llRoom*.5,llRoom*.85]){
      const n=ceil(v);
      if(n>=.01&&n<=llRoom+1e-8&&!r3List.includes(n))r3List.push(n);
     }
    }
    for(const r3 of r3List){
     const r4List=[0];
     if(r3>=.01){
      const lllRoom=Math.min(cap,p.staticFloor&&p.overall>0?p.overall+p.pnl-r1-r2-r3-p.buffer:cap);
      const recovery=(need+r1+r2+r3-rr*r2)/rr;
      for(const v of [recovery,lllRoom*.7]){
       const n=ceil(v);
       if(n>=.01&&n<=lllRoom+1e-8&&!r4List.includes(n))r4List.push(n);
      }
     }
     for(const r4 of r4List){
      const risk={r1,r2,r3,r4};
      const key=LEVELS.map(x=>risk[x].toFixed(2)).join('/');
      if(used.has(key))continue;used.add(key);
      all.push(risk);
     }
    }
   }
  }
  return all;
 }
 function rank(p,obj,rec){
  const path=obj==='recovery'?(rec.bestAfterDouble||rec.bestAfterLoss):rec.fastest;
  if(!path)return Infinity;
  const cap=Math.max(.01,p.cap),r=rec.maxRisk/cap,dd=path.dd/cap;
  const losses=path.wl.split('L').length-1;
  if(obj==='fast')return path.wl.length*1000+path.days*50+r*25+dd*10;
  if(obj==='low')return rec.maxRisk*100+path.wl.length*12+path.days;
  if(obj==='balanced')return path.wl.length*110+r*200+dd*30+(rec.bestAfterLoss?0:45);
  if(obj==='recovery')return (rec.bestAfterDouble?0:350)+path.wl.length*65+r*120+dd*65-losses*2;
  return path.wl.length*100+r*180+dd*35+(rec.bestAfterLoss?0:80)+(rec.bestAfterDouble?0:40)+
   (rec.counts.blocked+rec.counts.failed)/(rec.counts.hit+rec.counts.active+rec.counts.stopped+1)*30;
 }
 function search(input,onProgress){
  const p=configOf(input);
  if(p.error)return Promise.resolve({error:p.error});
  const grid=candidates(p);
  if(!grid.length)return Promise.resolve({error:'No candidate risks fit the modeled initial loss headroom.'});
  const results=[];let i=0;
  return new Promise(resolve=>{
   function batch(){
    const limit=Math.min(grid.length,i+75);
    for(;i<limit;i++){
     const evaluated=evaluate(p,grid[i]);
     if(evaluated.fastest)results.push(evaluated);
    }
    if(onProgress)onProgress({done:i,total:grid.length,valid:results.length});
    if(i<grid.length){setTimeout(batch,0);return}
    if(!results.length){resolve({error:'No tested setup reaches the profit target inside '+p.depth+' trades. Increase the search horizon or review the modeled limits.',tested:grid.length});return}
    const used=new Set(),models=[];
    for(const [kind,label] of OBJECTIVES){
     const pool=[...results].sort((a,b)=>rank(p,kind,a)-rank(p,kind,b)||
      a.maxRisk-b.maxRisk||a.fastest.wl.length-b.fastest.wl.length);
     const record=pool.find(r=>!used.has(LEVELS.map(k=>r.risks[k]).join('/'))&&
      (kind!=='recovery'||r.bestAfterDouble||r.bestAfterLoss));
     if(!record)continue;
     const signature=LEVELS.map(k=>record.risks[k]).join('/');
     used.add(signature);
     const primary=kind==='recovery'?(record.bestAfterDouble||record.bestAfterLoss):record.fastest;
     models.push({kind,label,risks:{...record.risks},route:{
      wl:primary.wl,tiers:primary.tiers,trades:primary.wl.length,days:primary.days,
      pnl:primary.pnl,dd:money(primary.dd),
      pendingDays:Math.max(0,p.minDays-p.completedDays-primary.days)
     },examples:record.examples.map(v=>({wl:v.wl,tiers:v.tiers,pnl:v.pnl,dd:money(v.dd),
      trades:v.wl.length,days:v.days,pendingDays:Math.max(0,p.minDays-p.completedDays-v.days)})),
     maxRisk:record.maxRisk,hitAfterLoss:!!record.bestAfterLoss,
     hitAfterDouble:!!record.bestAfterDouble,counts:record.counts});
    }
    resolve({models,tested:grid.length,viable:results.length,horizon:p.depth,
      maxInitialRisk:money(p.cap),limitsVerified:p.staticFloor,searchType:'sampled candidate optimization'});
   }
   setTimeout(batch,0);
  });
 }
 global.StudioSmartRiskOptimizer={search,version:'1.0'};
})(window);
