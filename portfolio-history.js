/* 4Ds Portfolio Simulator: compact, per-user run history and optional
   conflict-checked Google Apps Script profile sync. Public shared profiles
   have no authentication; never store personal secrets. */
(function(root){
'use strict';
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact=x=>JSON.parse(JSON.stringify(x));
const number=x=>Number.isFinite(+x)?+x:0;
const USD=x=>(number(x)<0?'-':'')+'$'+Math.round(Math.abs(number(x))).toLocaleString('en-US');
const capRecords=(records,limit=15)=>records.filter(x=>x&&x.id&&x.timestamp).sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp))).filter((x,i,all)=>all.findIndex(y=>y.id===x.id)===i).slice(0,limit);
function create({user,element,endpoint}){
 const key='4ds:v1:'+user+':portfolio-simulation-history:v1';
 const remoteValid=/^https:\/\/script\.google\.com\/macros\/s\/[^/?]+\/exec(?:\?.*)?$/.test(endpoint||'');
 let runs=[],syncing=false,syncQueued=false,lastCloudStatus='not verified';
 const now=()=>new Date().toISOString();
 const status=(message)=>{lastCloudStatus=message;const target=element.querySelector('[data-history-status]');if(target)target.textContent=message;};
 function readLocal(){
  try{const parsed=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(parsed)?capRecords(parsed):[]}catch(_){return []}
 }
 function writeLocal(items){
  runs=capRecords(items);
  try{localStorage.setItem(key,JSON.stringify(runs));return true}catch(e){
   status('Local history save failed: '+e.message);return false;
  }
 }
 function simpleAccount(a){
  return {id:a.id,status:a.status,purchaseDay:a.purchaseDay,passes:a.passes,
   fundedActivatedDay:a.fundedActivatedDay,fundedFirstTradeDay:a.fundedFirstTradeDay,
   fundedTargetDay:a.fundedTargetDay,payoutRequestedDay:a.payoutRequestedDay,
   paidDay:a.paidDay,closedDay:a.closedDay,firstPaid:a.firstPaid,
   tradeCount:a.trades,wins:a.wins,losses:a.losses,stagePnl:a.stagePnl};
 }
 function summarize(result){
  return {
   programId:result.plan.id,firm:result.plan.firm,accountSize:result.plan.size,
   programName:result.plan.programName,
   risk:compact(result.plan.riskProfiles),
   caps:{overallLoss:result.plan.overallLoss,dailyLoss:result.plan.dailyLoss,
    drawdownKind:result.plan.drawdownKind,fee:result.plan.fee,
    fundedMaxActive:result.plan.fundedMaxActive},
   avg:compact(result.avg),stages:compact(result.stages),
   conversions:root.StudioPortfolioEngine?.stageFunnel?.(result)||[],
   chancePayout:result.chancePayout,chanceGoal:result.chanceGoal,
   roi:result.roi,budget:result.budget,tradeKpis:compact(result.tradeKpis),
   sample:{dailyCash:compact(result.sample?.dailyCash||[]),
    accounts:(result.sample?.accountDetails||[]).map(simpleAccount),
    tradeAssignments:compact(result.sample?.tradeAssignments||[])}
  };
 }
 function summarizeOptimizerCandidate(c){
  const r=c.result;
  return {riskScale:c.scale,initialBudget:c.initialBudget,accountsBudgeted:c.units,
   score:compact(c.score),
   stages:(r?.plan?.stageList||c.plan?.stageList||[]).map(stage=>{
    const x=(r?.plan?.riskProfiles||c.plan?.riskProfiles||{})[stage]||{};
    return {stage,name:x.name,r1:x.r1,r2:x.r2,r3:x.r3,rr:x.rr,target:x.target};
   }),
   stagePasses:compact(r?.stages||[]),
   expected:compact(r?.avg||{}),
   cashTimeline:compact(r?.cashCurve||[]),
   conversions:root.StudioPortfolioEngine?.stageFunnel?.(r)||[],
   payoutGoalProbability:c.score?.hit
  };
 }
 function makeOptimizerRecord({output,inputs,account}){
  if(!output||!Array.isArray(output.candidates)||!output.candidates.length)
   throw new Error('No completed optimizer scenarios to save.');
  const candidates=output.candidates.map(summarizeOptimizerCandidate);
  return {schema:'4ds-payout-optimizer-v1',kind:'calculate-investment',
   id:'opt-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),
   timestamp:now(),user,
   account:compact(account||{firm:output.firm,size:output.size}),
   targets:{totalCash:output.targetCash,perPayout:output.perPayout,
    requiredPayouts:output.requiredPayouts,minRoi:output.minRoi,
    minNetRoi:output.minNetRoi,minNetPnl:output.minNetPnl,
    maxInvestment:output.maxInvestment,profitPerAccount:output.profitPerAccount},
   inputs:compact(inputs),summary:{checked:output.checked,feasible:output.feasible,
    payoutCountFeasible:output.payoutCountFeasible},
   candidates};
 }
 function render(){
  const body=element.querySelector('[data-history-body]');if(!body)return;
  body.innerHTML=runs.map((r,i)=>{
   const isOptimizer=r.kind==='calculate-investment'||r.schema==='4ds-payout-optimizer-v1';
   if(isOptimizer){
    const best=r.candidates?.[0],x=best?.score||{};
    return '<tr><td>'+escapeHtml(new Date(r.timestamp).toLocaleString())+
     '<small style="display:block">Calculate Investment</small></td>'+
     '<td>'+escapeHtml(r.account?.firm||'')+' '+USD(r.account?.size||0)+'</td>'+
     '<td>'+escapeHtml(r.targets?.requiredPayouts||0)+' payouts · '+USD(r.targets?.totalCash||0)+
     ' target · '+escapeHtml(r.inputs?.days||0)+'d</td>'+
     '<td class="num">'+USD(x.avgNet)+'</td>'+
     '<td class="num">'+number(x.avgPaid).toFixed(2)+'</td>'+
     '<td><button type="button" data-history-export="'+i+'" title="Download full Calculate Investment result">Export</button></td></tr>';
   }
   const firms=Array.isArray(r.firms)?r.firms:[];
   const net=firms.reduce((v,x)=>v+number(x.avg?.net),0),
    paid=firms.reduce((v,x)=>v+number(x.avg?.paid),0);
   return '<tr><td>'+escapeHtml(new Date(r.timestamp).toLocaleString())+
    '<small style="display:block">Run Simulation</small></td>'+
    '<td>'+escapeHtml(firms.map(x=>x.firm+' '+USD(x.accountSize)).join(', '))+'</td>'+
    '<td>'+escapeHtml(r.inputs?.days||0)+'d · '+escapeHtml(r.inputs?.tradesPerDay||0)+
    ' trades/day · '+escapeHtml(r.inputs?.trials||0)+' trials</td>'+
    '<td class="num">'+USD(net)+'</td><td class="num">'+paid.toFixed(2)+'</td>'+
    '<td><button type="button" data-history-export="'+i+'" title="Download simulation run">Export</button></td></tr>';
  }).join('')||'<tr><td colspan="6">No saved runs yet. Run Simulation or Calculate Investment to create the first record.</td></tr>';
  const count=element.querySelector('[data-history-count]');
  if(count)count.textContent=runs.length+' saved run(s)';
 }
 function download(payload,name){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 // Existing Apps Script JSONP interface used by 4Ds cloud-sync.js.
 function getRemote(){
  return new Promise((resolve,reject)=>{
   if(!remoteValid){reject(new Error('Cloud endpoint not configured'));return;}
   const callback='fourDsHistory_'+Math.random().toString(36).slice(2),script=document.createElement('script');
   const timeout=setTimeout(()=>{cleanup();reject(new Error('Cloud read timed out'))},14000);
   function cleanup(){clearTimeout(timeout);delete root[callback];script.remove();}
   root[callback]=data=>{cleanup();data?.ok===true?resolve(data):reject(new Error(data?.error||'Cloud read rejected'))};
   script.onerror=()=>{cleanup();reject(new Error('Cloud read failed'))};
   script.src=endpoint+(endpoint.includes('?')?'&':'?')+new URLSearchParams({user,callback,t:Date.now()});
   document.head.appendChild(script);
  });
 }
 async function cloudSync(){
  if(syncing){syncQueued=true;return;}
  if(!remoteValid){status('Saved in browser · cloud endpoint not configured');return;}
  syncing=true;
  try{
   status('Saved locally · syncing history to cloud…');
   const response=await getRemote();
   const snapshot=response.snapshot;
   if(snapshot&&(snapshot.schema!=='4ds-profile-export-v1'||snapshot.user!==user||!snapshot.entries||typeof snapshot.entries!=='object'))
    throw new Error('Unexpected cloud profile format');
   const remoteEntries=snapshot?{...snapshot.entries}:{};
   const remoteHistory=(()=>{try{const x=JSON.parse(remoteEntries[key]||'[]');return Array.isArray(x)?x:[]}catch(_){return []}})();
   // Merge remote and local runs; update ONLY the history entry in the
   // retrieved cloud snapshot to avoid deleting unrelated profile settings.
   const merged=capRecords([...runs,...remoteHistory]);
   writeLocal(merged);render();
   // Keep cloud snapshot below the existing server's ~900KB guard.
   let proposed=capRecords(merged,8);
   let json='',snap;
   do{
    snap={schema:'4ds-profile-export-v1',user,
      nonce:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),
      entries:{...remoteEntries,[key]:JSON.stringify(proposed)}};
    json=JSON.stringify(snap);
    if(json.length<=850000)break;
    proposed=proposed.slice(0,-1);
   }while(proposed.length);
   if(json.length>850000||!proposed.length)throw new Error('Cloud profile is full; export history and reduce stored data');
   const post=new URLSearchParams({user,expectedRevision:response.revision||'',
    force:'no',snapshot:json});
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
   try{await fetch(endpoint,{method:'POST',mode:'no-cors',body:post,cache:'no-store',signal:controller.signal})}
   finally{clearTimeout(timeout)}
   const verified=await getRemote();
   if(verified.snapshot?.nonce!==snap.nonce)throw new Error('Cloud write could not be verified (profile may have changed)');
   localStorage.setItem('4ds:cloud:last-revision:'+user,verified.revision||'');
   status('Cloud verified · '+new Date().toLocaleTimeString()+' · '+proposed.length+' recent runs online');
  }catch(err){status('Saved in this browser · cloud sync unavailable: '+err.message);}
  finally{syncing=false;if(syncQueued){syncQueued=false;cloudSync()}}
 }
 async function loadCloud(){
  if(!remoteValid){status('Cloud endpoint not available');return;}
  try{
   status('Reading cloud history…');
   const remote=await getRemote();
   const list=JSON.parse(remote.snapshot?.entries?.[key]||'[]');
   if(!Array.isArray(list))throw new Error('Invalid cloud history');
   writeLocal([...runs,...list]);render();
   status('Loaded cloud history · '+list.length+' online run(s)');
  }catch(err){status('Cloud history could not be loaded: '+err.message)}
 }
 element.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.hasAttribute('data-history-export')){
   const r=runs[Number(target.dataset.historyExport)];if(r)download(r,'4ds-'+(r.kind==='calculate-investment'?'calculate-investment':'simulation')+'-'+user+'-'+r.timestamp.replace(/[:.]/g,'-')+'.json');
  }else if(target.hasAttribute('data-history-export-all')){
   download({schema:'4ds-portfolio-history-v1',user,exportedAt:now(),runs},'4ds-simulation-history-'+user+'.json');
  }else if(target.hasAttribute('data-history-refresh'))loadCloud();
  else if(target.hasAttribute('data-history-sync'))cloudSync();
 });
 runs=readLocal();render();status(remoteValid?'History stored locally · checking cloud…':'History stored in this browser only');
 if(remoteValid)loadCloud();
 return {
  save({results,inputs,rows}){
   const record={schema:'4ds-portfolio-simulation-v1',
    id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),
    timestamp:now(),user,inputs:compact(inputs),
    accounts:compact(rows),firms:results.map(summarize)};
   if(writeLocal([record,...runs])){render();cloudSync()}
   return record;
  },
  saveOptimizer(data){
   const record=makeOptimizerRecord(data);
   if(writeLocal([record,...runs])){render();cloudSync()}
   return record;
  },
  getRuns(){return runs.slice()},
  getCloudStatus(){return lastCloudStatus},
  sync:cloudSync
 };
}
root.StudioPortfolioHistory={create};
})(typeof window!=='undefined'?window:globalThis);
