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
  const leaves=[],todo=[{pnl:p.pnl,dayStart:p.pnl,tradesDay:0,days:0,peak:p.pnl,dd:0,
   wl:'',tiers:'',next:'r1',prob:1}];
  const counts={hit:0,stopped:0,blocked:0,failed:0,active:0};
  let success=0,stopped=0,blocked=0,failed=0,active=0;
  let tradeSum=0,daysSum=0,ddSum=0,hitTradesSum=0;
  function finish(node,status,reason){
   const entry={wl:node.wl,tiers:node.tiers,status,reason:reason||'',pnl:node.pnl,
    trades:node.wl.length,days:node.days,dd:money(node.dd),prob:node.prob,
    pendingDays:status==='hit'?Math.max(0,p.minDays-p.completedDays-node.days):0};
   leaves.push(entry);counts[status]++;
   tradeSum+=node.prob*entry.trades;daysSum+=node.prob*entry.days;ddSum+=node.prob*entry.dd;
   if(status==='hit'){success+=node.prob;hitTradesSum+=node.prob*entry.trades}
   else if(status==='stopped')stopped+=node.prob;
   else if(status==='blocked')blocked+=node.prob;
   else if(status==='failed')failed+=node.prob;
   else active+=node.prob;
  }
  while(todo.length){
   const a=todo.pop();
   if(a.pnl>=p.goal-.005){finish(a,'hit');continue}
   if(a.wl.length>=p.depth){finish(a,'active','Trade horizon reached');continue}
   const tier=a.next,risk=risks[tier]||0;
   if(tier==='stop'||risk<.01){finish(a,'stopped','Next risk tier disabled');continue}
   const room=Math.min(p.daily>0?p.daily+a.pnl-a.dayStart-p.buffer:Infinity,
    p.staticFloor&&p.overall>0?p.overall+a.pnl-p.buffer:Infinity);
   if(risk>room+1e-7){finish(a,'blocked','Risk exceeds modeled daily/overall allowance after buffer');continue}
   for(const outcome of ['L','W']){
    const win=outcome==='W',newPnl=money(a.pnl+(win?risk*p.rr:-risk));
    const dayCount=a.days+(a.tradesDay===0?1:0);
    const next={pnl:newPnl,dayStart:a.dayStart,tradesDay:a.tradesDay+1,days:dayCount,
     peak:Math.max(a.peak,newPnl),dd:Math.max(a.dd,a.peak-newPnl),wl:a.wl+outcome,
     tiers:a.tiers+tier.slice(-1),prob:a.prob*(win?p.wr:1-p.wr),
     next:win?'r2':tier==='r1'?'r2':tier==='r2'?'r3':tier==='r3'?'r4':'stop'};
    if((p.staticFloor&&p.overall>0&&p.overall+newPnl<=0)||
       (p.daily>0&&p.daily+newPnl-a.dayStart<=0)){finish(next,'failed','Modeled firm loss limit breached');continue}
    if(newPnl>=p.goal-.005){finish(next,'hit');continue}
    if(next.wl.length>=p.depth){finish(next,'active','Trade horizon reached');continue}
    if(!win||next.tradesDay>=p.winCap){next.dayStart=newPnl;next.tradesDay=0}
    if(next.next==='stop'||!(risks[next.next]>=.01))
     finish(next,'stopped',tier==='r3'&&!win?'R3 loss — strategy stopped; not necessarily account breach':'Next risk tier disabled');
    else todo.push(next);
   }
  }
  leaves.sort((a,b)=>a.trades-b.trades||b.prob-a.prob||a.wl.localeCompare(b.wl));
  const find=wl=>leaves.find(x=>x.wl===wl)||null;
  const first=find('W'),second=find('LW'),booster=find('LLWW'),thirdLoss=find('LLL');
  const afterLoss=leaves.filter(x=>x.status==='hit'&&x.wl.includes('L'));
  const afterDouble=leaves.filter(x=>x.status==='hit'&&x.wl.includes('LL'));
  const fastest=leaves.find(x=>x.status==='hit')||null;
  const bestAfterLoss=afterLoss[0]||null,bestAfterDouble=afterDouble[0]||null;
  const complete=risks.r1>=.01&&risks.r2>=.01&&risks.r3>=.01&&booster?.status==='hit';
  return {fastest,bestAfterLoss,bestAfterDouble,bestBooster:booster?.status==='hit'?booster:null,
   bestAfterTriple:leaves.find(x=>x.status==='hit'&&x.wl.includes('LLL'))||null,
   first,second,thirdLoss,leaves,complete,risks,
   examples:[first,second,booster,thirdLoss,leaves.find(x=>x.status==='blocked'||x.status==='failed')]
    .filter(Boolean).filter((v,i,a)=>a.findIndex(x=>x.wl===v.wl)===i),
   counts,hitProbability:success,stopProbability:stopped,blockedProbability:blocked,
   failedProbability:failed,activeProbability:active,expectedTrades:tradeSum,
   expectedDays:daysSum,expectedDD:ddSum,expectedHitTrades:success?hitTradesSum/success:null,
   maxRisk:Math.max(...LEVELS.map(x=>risks[x]||0)),
   worstDD:Math.max(0,...leaves.map(x=>x.dd)),
   fullTree:counts.active===0};
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
  for(let n=2;n<=p.depth;n++)addR(r1List,need/(rr*n));
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
 function rank(p,obj,r){
  if(!r.complete)return -Infinity;
  const risk=r.maxRisk/Math.max(.01,p.cap);
  const dd=r.worstDD/Math.max(.01,p.overall||p.daily||p.cap);
  const stop=r.stopProbability,block=r.blockedProbability,fail=r.failedProbability;
  if(obj==='fast')return (r.first?.status==='hit'?3:0)+(r.second?.status==='hit'?2:0)+
   r.hitProbability*2-r.expectedHitTrades*.04-risk*.08-(block+fail)*2;
  if(obj==='low')return 3-risk*.9-dd*.15+r.hitProbability*.1-block-r.activeProbability*.15;
  if(obj==='balanced')return r.hitProbability*3-stop*.6-fail*2-risk*.5-dd*.4-r.expectedTrades*.025-r.activeProbability*.8;
  if(obj==='recovery')return 2+r.hitProbability*2.5-stop*.7-risk*.4+
   (r.bestAfterTriple?.status==='hit'?.08:0)-block*2;
  return r.hitProbability*4-stop*.8-block*2-fail*2-risk*.3-dd*.2-r.expectedTrades*.02-r.activeProbability*.8;
 }
 function search(input,onProgress){
  const p=configOf(input);
  p.wr=Math.min(.99,Math.max(.01,num(input.winRate,40)/100));
  if(p.error)return Promise.resolve({error:p.error});
  if(p.depth<4)return Promise.resolve({error:'Full R1 → R2 → R3 → R2 recovery needs a search depth of at least 4 trades.'});
  const grid=candidates(p);
  if(input.levels?.r1>=.01&&input.levels?.r2>=.01&&input.levels?.r3>=.01){
   const r={...input.levels};
   if(!grid.some(v=>LEVELS.every(k=>Math.abs(v[k]-r[k])<.001)))grid.push(r);
  }
  if(!grid.length)return Promise.resolve({error:'No three-tier risks fit the account limits.'});
  const results=[],current=input.levels?evaluate(p,input.levels):null;
  let i=0;
  return new Promise(resolve=>{
   function batch(){
    const limit=Math.min(grid.length,i+65);
    for(;i<limit;i++){
     const evaluated=evaluate(p,grid[i]);
     if(evaluated.complete)results.push(evaluated);
    }
    if(onProgress)onProgress({done:i,total:grid.length,valid:results.length});
    if(i<grid.length){setTimeout(batch,0);return}
    if(!results.length){
     resolve({error:'No complete 3-risk recovery tree found within the loss limits and selected trade horizon.',tested:grid.length});
     return;
    }
    const models=[];
    for(const [kind,label] of OBJECTIVES){
     const sorted=[...results].sort((a,b)=>rank(p,kind,b)-rank(p,kind,a)||
      a.maxRisk-b.maxRisk||b.hitProbability-a.hitProbability);
     const record=sorted[0];
     if(!record)continue;
     const primary=record.first?.status==='hit'?record.first:
      record.second?.status==='hit'?record.second:record.bestBooster;
     const convert=v=>({wl:v.wl,tiers:v.tiers,trades:v.trades,days:v.days,pnl:v.pnl,
      dd:v.dd,status:v.status,reason:v.reason,pendingDays:v.pendingDays,
      probability:Math.round(v.prob*10000)/100});
     models.push({kind,label,risks:{...record.risks},route:convert(primary),
      examples:record.examples.map(convert),leaves:record.leaves.map(convert),
      maxRisk:record.maxRisk,maxDD:record.worstDD,
      hitProbability:Math.round(record.hitProbability*10000)/100,
      stopProbability:Math.round(record.stopProbability*10000)/100,
      blockedProbability:Math.round(record.blockedProbability*10000)/100,
      failedProbability:Math.round(record.failedProbability*10000)/100,
      activeProbability:Math.round(record.activeProbability*10000)/100,
      expectedTrades:money(record.expectedTrades),expectedHitTrades:record.expectedHitTrades===null?null:money(record.expectedHitTrades),
      expectedDD:money(record.expectedDD),firstHit:record.first?.status==='hit',
      secondHit:record.second?.status==='hit',thirdLossOutcome:record.thirdLoss?.status||'continued',
      fullTree:record.fullTree,treeBranches:record.leaves.length,boosterRoute:true,
      hitAfterLoss:!!record.bestAfterLoss,hitAfterDouble:!!record.bestAfterDouble,
      hitAfterTriple:!!record.bestAfterTriple,counts:record.counts});
    }
    resolve({models,tested:grid.length,viable:results.length,horizon:p.depth,
      winRate:Math.round(p.wr*10000)/100,
      currentPlan:current?{complete:current.complete,first:current.first?.status||'none',
       second:current.second?.status||'none',booster:current.bestBooster?.status||'none',
       thirdLoss:current.thirdLoss?.status||'continued',
       blockedProbability:Math.round(current.blockedProbability*10000)/100}:null,
      maxInitialRisk:money(p.cap),limitsVerified:p.staticFloor,
      searchType:'full WIN/LOSS recovery decision trees over sampled R1–R4 candidates'});
   }
   setTimeout(batch,0);
  });
 }
 global.StudioSmartRiskOptimizer={search,evaluate,version:'2.0-full-tree'};
})(window);
