/* Portfolio Sim → Firms transfer helper. No network or order execution.
   Accept only one explicitly selected, existing account profile; preserve backup. */
(function(root){
'use strict';
const modes=new Set(['smart-sequence','saved','streak','flat','after-win','protect-after-loss','target-now','repair-r2','buffered-target','eval-recovery-burn','funded-profit-ladder','funded-staged-recovery']);
const stagesFor=id=>id==='topstep'?['p1','funded']:['ftmo2','holaPrime','holaPro'].includes(id)?['p1','p2','funded']:['funded'];
const profileKey=(user,key)=>'4ds:v1:'+user+':studio-account-profile-v1:'+key;
const snapKey=(user,key,stage)=>'4ds:recovery-planner:v2:'+user+':'+key+':'+stage;
const backupKey=(user,key)=>'4ds:v1:'+user+':portfolio-firms-backup-v1:'+key;
const read=(storage,key)=>{const raw=storage.getItem(key);if(raw===null)return null;try{return JSON.parse(raw)}catch(e){throw Error('Saved settings could not be read: '+key)}};
function validate(user,key,plan){
 if(!['doen','dori','dona','dion'].includes(user))throw Error('Unknown Studio user');
 if(!/^(ftmo2|holaPrime|holaPro|topstep):[1-9]\d{3,6}$/.test(key))throw Error('Invalid account selection');
 if(!plan||typeof plan!=='object'||plan.id+':'+plan.size!==key)throw Error('Model does not match selected account');
 const phases=stagesFor(plan.id);
 if(!Array.isArray(plan.stageList)||plan.stageList.join('|')!==phases.join('|'))throw Error('Model has unexpected phases');
 const reserve=Number(plan.riskReserve);
 if(!Number.isFinite(reserve)||reserve<0)throw Error('Risk reserve is invalid');
 for(const stage of phases){
  const c=plan.riskProfiles?.[stage];
  if(!c)throw Error(stage+' settings missing');
  for(const field of ['r1','r2','r3','rr']){
   const val=Number(c[field]);
   if(!Number.isFinite(val)||val<=0||val>10000000)throw Error(stage+' '+field+' is invalid');
   if(field==='rr'&&(val<.1||val>100))throw Error(stage+' RR out of range');
  }
  if(!Number.isInteger(c.maxWinsPerDay)||c.maxWinsPerDay<1||c.maxWinsPerDay>6)
   throw Error(stage+' winning-day cap invalid');
  if(!modes.has(c.policy?.mode||'saved'))throw Error(stage+' policy is unknown');
  if(c.policy?.mode==='smart-sequence'&&
   (!Number.isFinite(Number(c.r4||0))||Number(c.r4||0)<0))
   throw Error(stage+' optional R4 risk is invalid');
 }
 return phases;
}
function prepare(storage,user,key,plan){
 const phases=validate(user,key,plan),pk=profileKey(user,key),previous=read(storage,pk);
 if(!previous||previous.v!==1||!previous.state||typeof previous.state!=='object')
  throw Error('Open this account in Firms first to create its saved account profile');
 const state={...previous.state,rrByTier:{...(previous.state.rrByTier||{})}};
 state.buffer=Number(plan.riskReserve);
 const changes=[];
 for(const stage of phases){
  const c=plan.riskProfiles[stage];
  state[stage+'Base']=Number(c.r1);
  state[stage+'Recovery']=Number(c.r2);
  state[stage+'DailyCap']=c.maxWinsPerDay;
  state.rrByTier[stage+'Base']=Number(c.rr);
  state.rrByTier[stage+'Recovery']=Number(c.rr);
  const sk=snapKey(user,key,stage),prev=read(storage,sk)||{};
  const policyMode=c.policy?.mode||'saved';
  // Structured policy excludes stale per-option overrides. The pre-transfer
  // overrides are kept in the full backup and can be restored.
  const snapshot={...prev,
   levels:{...(prev.levels||{}),r1:Number(c.r1),r2:Number(c.r2),r3:Number(c.r3),r4:policyMode==='smart-sequence'?Number(c.r4||0):Number(prev.levels?.r4||0)},
   winCap:c.maxWinsPerDay,policyMode,
   sweepRemainder:policyMode==='smart-sequence'?c.sweepRemainder===true:prev.sweepRemainder,
   sweepThreshold:policyMode==='smart-sequence'?Number(c.sweepThreshold??100):prev.sweepThreshold,
   targetOverride:policyMode==='smart-sequence'?Number(c.target):prev.targetOverride,
   appliedSmartSetup:policyMode==='smart-sequence'?{
    label:String(c.appliedSmartLabel||'Portfolio Sim smart strategy').slice(0,100),
    source:'Portfolio Simulator',appliedAt:new Date().toISOString(),
    simulationPolicy:'smart-sequence',profitTarget:Number(c.target),rr:Number(c.rr),
    levels:{r1:Number(c.r1),r2:Number(c.r2),r3:Number(c.r3),r4:Number(c.r4||0)}
   }:undefined,
   rrByTier:c.rrByTier?{...c.rrByTier}:null,
   dynamicMaxRisk:Number.isFinite(Number(c.dynamicMaxRisk))&&c.dynamicMaxRisk!=null?Number(c.dynamicMaxRisk):null,
   fundedStarterRisk:Number.isFinite(Number(c.fundedStarterRisk))&&c.fundedStarterRisk!=null?Number(c.fundedStarterRisk):null,
   fundedMaxTradeRisk:Number.isFinite(Number(c.fundedMaxTradeRisk))&&c.fundedMaxTradeRisk!=null?Number(c.fundedMaxTradeRisk):null,
   fundedRecoveryLevels:Array.isArray(c.fundedRecoveryLevels)?c.fundedRecoveryLevels.map(Number):null,
   optionSequences:policyMode==='saved'?(prev.optionSequences||{}):{},
   open:true};
  changes.push({key:sk,value:JSON.stringify(snapshot)});
 }
 const now=new Date().toISOString();
 // Funded profit goal is a user planning target and must match the selected
 // simulated funded policy. Keep official firm loss/rule fields unchanged.
 const fundedGoal=Number(plan.riskProfiles?.funded?.target);
 if(Number.isFinite(fundedGoal)&&fundedGoal>0)state.profitTarget=fundedGoal;
 const destProfile={...previous,state,updatedAt:now};
 changes.unshift({key:pk,value:JSON.stringify(destProfile)});
 return {changes,backup:backupKey(user,key),phases,pk,title:plan.programName||plan.id};
}
function transfer(storage,user,key,plan,modelName,findings=null){
 const prep=prepare(storage,user,key,plan);
 if(findings&&typeof findings==='object'){
  const old=JSON.parse(prep.changes[0].value);
  const allowed=['net','roi','delta','p10','chancePayout','profitFactor','winRate','rewardRisk','realizedR','avgWin','avgLoss','expectancy','tradesPerTrial','trials','budget'];
  const metrics={};
  for(const key of allowed){
   const value=Number(findings[key]);
   if(findings[key]!=null&&Number.isFinite(value))metrics[key]=value;
  }
  old.latestImportedModel={name:String(modelName||'Selected model').slice(0,120),
   source:'Portfolio Sim',savedAt:new Date().toISOString(),metrics};
  prep.changes[0].value=JSON.stringify(old);
 }
 const before=prep.changes.map(x=>({key:x.key,raw:storage.getItem(x.key)}));
 const oldBackup=storage.getItem(prep.backup);
 const backup={v:1,savedAt:new Date().toISOString(),modelName:String(modelName||'Selected model').slice(0,120),
  user,key,files:before};
 const backupRaw=JSON.stringify(backup);
 const updated=[];
 try{
  storage.setItem(prep.backup,backupRaw);
  for(const change of prep.changes){storage.setItem(change.key,change.value);updated.push(change.key)}
 }catch(e){
  // Restore all touched keys and prior backup if the transfer could not complete.
  for(const item of before){
   try{if(item.raw===null)storage.removeItem(item.key);else storage.setItem(item.key,item.raw)}catch(_){}
  }
  try{if(oldBackup===null)storage.removeItem(prep.backup);else storage.setItem(prep.backup,oldBackup)}catch(_){}
  throw Error('Could not save to Firms: '+(e?.message||e));
 }
 return {user,key,modelName:backup.modelName,backupKey:prep.backup,phases:prep.phases};
}
function restore(storage,user,key){
 if(!['doen','dori','dona','dion'].includes(user)||!/^(ftmo2|holaPrime|holaPro|topstep):[1-9]\d{3,6}$/.test(key))throw Error('Invalid account');
 const bk=backupKey(user,key),record=read(storage,bk);
 if(!record||record.v!==1||record.user!==user||record.key!==key||!Array.isArray(record.files))throw Error('No previous Firms settings backup found for this account');
 const expected=new Set([profileKey(user,key),...stagesFor(key.split(':')[0]).map(s=>snapKey(user,key,s))]);
 if(record.files.length!==expected.size||record.files.some(f=>!expected.has(f.key)||!(f.raw===null||typeof f.raw==='string')))
  throw Error('Backup does not match this account');
 const before=record.files.map(x=>({key:x.key,raw:storage.getItem(x.key)}));
 try{
  for(const file of record.files){
   if(file.raw===null)storage.removeItem(file.key);else storage.setItem(file.key,file.raw);
  }
 }catch(e){
  for(const file of before)try{if(file.raw===null)storage.removeItem(file.key);else storage.setItem(file.key,file.raw)}catch(_){}
  throw Error('Could not restore previous account settings');
 }
 storage.removeItem(bk);
 return {user,key,modelName:record.modelName,savedAt:record.savedAt};
}
root.StudioFirmsTransfer={transfer,restore,prepare,profileKey,snapKey,backupKey,validate};
})(typeof window!=='undefined'?window:globalThis);