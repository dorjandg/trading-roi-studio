/* Shared JJ Academy presets. All devices read/write one Cloudflare KV record.
   This deliberately requires no sign-in; protect the website if public editing is unwanted. */
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
export async function onRequest({request,env}){
 if(!env.PRESET_KV)return reply({ready:false,error:'PRESET_KV binding not configured'},503);
 if(request.method==='GET'){
  try{const data=await env.PRESET_KV.get('jj-academy-shared-presets-v1','json');return reply({ready:true,data:data||null})}
  catch(e){return reply({ready:false,error:'Could not read saved presets'},503)}
 }
 if(request.method!=='PUT')return reply({error:'Method not allowed'},405);
 const raw=await request.text();
 if(raw.length>200000)return reply({error:'Preset data too large'},413);
 let body;try{body=JSON.parse(raw)}catch(e){return reply({error:'Invalid JSON'},400)}
 if(!body||body.version!==1||!body.presets||typeof body.presets!=='object'||Array.isArray(body.presets))return reply({error:'Invalid preset data'},400);
 const safe={version:1,presets:{ftmo:{},topstep:{}},updatedAt:new Date().toISOString()};
 for(const firm of ['ftmo','topstep']){
  const group=body.presets[firm]||{};
  if(!group||typeof group!=='object'||Array.isArray(group))return reply({error:'Invalid firm presets'},400);
  for(const [name,value] of Object.entries(group)){
   if(!name||name.length>60||['__proto__','constructor','prototype'].includes(name)||!value||typeof value!=='object'||Array.isArray(value))continue;
   safe.presets[firm][name]=value;
  }
 }
 try{await env.PRESET_KV.put('jj-academy-shared-presets-v1',JSON.stringify(safe));return reply({ok:true,updatedAt:safe.updatedAt})}
 catch(e){return reply({error:'Could not save presets'},503)}
}
