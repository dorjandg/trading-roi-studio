/* 4Ds Trading Studio — explicit R1/R2/R3/R4 route explorer.
   Enumerates every valid risk-tier choice and W/L continuation to the selected
   horizon; early target / floor / blocked paths terminate instead of duplicating
   artificial later trades. Purely illustrative; does not modify any strategy. */
(function(global){
 'use strict';
 const LEVELS=['r1','r2','r3','r4'];
 const LIMITS={target:500,active:200,failed:200,blocked:200};
 function finite(n,fallback=0){n=Number(n);return Number.isFinite(n)?n:fallback}
 function score(rec){
  return rec.days*100000000+rec.trades*1000000+Math.round(rec.drawdown*100);
 }
 function keepBest(lists,rec,worst){
  const list=lists[rec.status],cap=LIMITS[rec.status],s=score(rec);
  const bound=worst[rec.status];
  if(list.length>=cap&&s>=bound.score)return;
  rec.score=s;
  if(list.length<cap){
   list.push(rec);
   if(s>bound.score){bound.score=s;bound.index=list.length-1}
   return;
  }
  list[bound.index]=rec;
  let wi=0;
  for(let i=1;i<list.length;i++)if(list[i].score>list[wi].score)wi=i;
  bound.index=wi;bound.score=list[wi].score;
 }
 function search(input,onProgress){
  const p={
   rr:finite(input.rr),goal:finite(input.goal),pnl:finite(input.initialPnl),
   days:Math.max(0,Math.floor(finite(input.completedDays))),
   daily:Math.max(0,finite(input.daily)),overall:Math.max(0,finite(input.overall)),
   buffer:Math.max(0.01,finite(input.buffer)),staticFloor:!!input.staticFloor,
   winCap:Math.max(1,Math.min(6,Math.floor(finite(input.winCap,2)))),
   depth:Math.max(1,Math.min(8,Math.floor(finite(input.depth,6)))),
   levels:Object.fromEntries(LEVELS.map(k=>[k,Math.max(0,finite(input.levels?.[k]))]))
  };
  if(p.rr<=0||p.goal<=0)return Promise.resolve({error:'A positive target and RR are required.'});
  const activeLevels=LEVELS.filter(level=>p.levels[level]>=0.01);
  if(!activeLevels.length)return Promise.resolve({error:'All risk tiers are 0. Enter a positive amount in at least one of R1–R4.'});
  const stats={visited:0,target:0,targetReady:0,targetPending:0,active:0,failed:0,blocked:0};
  const lists={target:[],active:[],failed:[],blocked:[]};
  const worst=Object.fromEntries(Object.keys(lists).map(k=>[k,{score:-Infinity,index:0}]));
  const stack=[{wl:'',tiers:'',pnl:p.pnl,day:0,dayStart:p.pnl,tradesToday:0,usedDays:0,peak:p.pnl,dd:0}];
  function finish(status,node,extraTier){
   stats[status]++;
   if(status==='target')stats[p.days+node.usedDays>=Math.floor(finite(input.minDays))?'targetReady':'targetPending']++;
   const rec={
    status,sequence:node.wl,tiers:node.tiers+(extraTier||''),
    pnl:node.pnl,days:node.usedDays,trades:node.wl.length,
    drawdown:node.dd,
    minDaysPending:status==='target'?Math.max(0,Math.floor(finite(input.minDays))-(p.days+node.usedDays)):0
   };
   keepBest(lists,rec,worst);
  }
  return new Promise(resolve=>{
   function batch(){
    let n=0;
    while(stack.length&&n++<4000){
     const node=stack.pop();stats.visited++;
     if(node.pnl>=p.goal-0.005){finish('target',node);continue}
     if(node.wl.length>=p.depth){finish('active',node);continue}
     // A loss closes the trading day. The next executed trade starts a new day.
     const day=node.day||1;
     const dayStart=node.day?node.dayStart:node.pnl;
     const dailyRoom=p.daily>0?p.daily+node.pnl-dayStart:Infinity;
     const overallRoom=p.staticFloor&&p.overall>0?p.overall+node.pnl:Infinity;
     const available=Math.min(dailyRoom-p.buffer,overallRoom-p.buffer);
     for(const tier of activeLevels){
      const risk=p.levels[tier];
      if(!(risk>=0.01)||risk>available+0.000001){
       finish('blocked',node,tier.slice(-1));
       continue;
      }
      for(const outcome of ['L','W']){
       const nextPnl=node.pnl+(outcome==='W'?risk*p.rr:-risk);
       const usedDays=node.usedDays+(node.tradesToday===0?1:0);
       const peak=Math.max(node.peak,nextPnl);
       const dd=Math.max(node.dd,node.peak-nextPnl);
       const next={
        wl:node.wl+outcome,tiers:node.tiers+tier.slice(-1),pnl:nextPnl,
        usedDays,peak,dd,
        day,tradesToday:node.tradesToday+1,dayStart
       };
       const breached=(p.staticFloor&&p.overall>0&&p.overall+nextPnl<=0)||
        (p.daily>0&&p.daily+nextPnl-dayStart<=0);
       if(breached){finish('failed',next);continue}
       if(nextPnl>=p.goal-0.005){finish('target',next);continue}
       if(next.wl.length>=p.depth){finish('active',next);continue}
       if(outcome==='L'||next.tradesToday>=p.winCap){
        next.day=day+1;next.dayStart=nextPnl;next.tradesToday=0;
       }
       stack.push(next);
      }
     }
    }
    if(typeof onProgress==='function')onProgress({ ...stats,remaining:stack.length,depth:p.depth,done:!stack.length});
    if(stack.length)setTimeout(batch,0);
    else {
     for(const key of Object.keys(lists))lists[key].sort((a,b)=>a.score-b.score||a.tiers.localeCompare(b.tiers));
     resolve({stats,lists,depth:p.depth,levels:p.levels,activeLevels,retentionLimits:LIMITS});
    }
   }
   setTimeout(batch,0);
  });
 }
 global.StudioRiskRouteExplorer={search};
})(window);
