/* Read-only provenance and freshness checks for one canonical Portfolio Sim report.
   Firm account profiles and phase planners remain the source of settings.
   Reports are calculated snapshots, never editable profile state. */
(function(root){
'use strict';
const KEY='options-portfolio-summary-v1';
const prefixes=['p1','p2','funded'];
function signature(storage,user,accountKey){
 if(!/^[a-zA-Z0-9_-]+$/.test(String(user))||!/^[a-zA-Z0-9_-]+:\d+$/.test(String(accountKey)))return '';
 const rootKey='4ds:v1:'+user+':';
 const rawProfile=storage.getItem(rootKey+'studio-account-profile-v1:'+accountKey);
 const fallback=!rawProfile&&storage.getItem(rootKey+'studio-active-profile-v1')===accountKey?
  storage.getItem(rootKey+'ftmo-roi-studio-v1')||'':'';
 const parts=[accountKey,rawProfile||'',fallback,
  ...prefixes.map(stage=>storage.getItem('4ds:recovery-planner:v2:'+user+':'+accountKey+':'+stage)||'')];
 // Stable lightweight change fingerprint; not a security signature.
 const raw=JSON.stringify(parts);let hash=2166136261;
 for(let i=0;i<raw.length;i++)hash=Math.imul(hash^raw.charCodeAt(i),16777619)>>>0;
 return 's2-'+hash.toString(16).padStart(8,'0');
}
function status(storage,user,accountKey,budget){
 let obj=null;
 try{obj=JSON.parse(storage.getItem('4ds:v1:'+user+':'+KEY)||'null')}catch(_){}
 if(!obj||obj.v!==2||obj.user!==user||!Array.isArray(obj.rows))
  return {state:'missing',message:'No compatible Portfolio Sim report saved for this user.'};
 const row=obj.rows.find(r=>r.id+':'+r.size===accountKey);
 if(!row)return {state:'different-account',message:'The last Portfolio Sim run did not include this selected account.',report:obj};
 if(row.hasTestOverrides)return {state:'test-only',message:'Last run used Portfolio Sim test risks, not the saved Firms settings.',report:obj,row};
 if(row.sourceSignature!==signature(storage,user,accountKey))
  return {state:'stale-settings',message:'Firms account or phase-plan settings changed since this simulation.',report:obj,row};
 if(Math.abs(Number(row.budget)-Number(budget))>.01)
  return {state:'different-budget',message:'Portfolio Sim used a different investment budget.',report:obj,row};
 if(!(Number.isFinite(row.net)&&Number.isFinite(row.roi)&&Number.isFinite(row.spent)))
  return {state:'invalid',message:'Saved simulation result is incomplete.',report:obj};
 return {state:'matched',message:'Latest matching Portfolio Sim result.',report:obj,row};
}
root.StudioReportSource={signature,status};
})(typeof window!=='undefined'?window:globalThis);