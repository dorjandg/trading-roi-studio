export async function onRequest(context){
 const {request,env}=context;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(!env.PRESET_KV)return reply({error:'Cloud storage not configured'},503);
 if(request.method!=='GET'&&request.method!=='PUT')return reply({error:'Method not allowed'},405);
 const key=request.headers.get('X-Preset-Key')||'';
 if(!/^[A-Za-z0-9_-]{24,128}$/.test(key))return reply({error:'Invalid sync key'},401);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
 const id='jj-presets:'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 if(request.method==='GET'){const stored=await env.PRESET_KV.get(id,'json');return reply({data:stored||null})}
 const raw=await request.text();if(raw.length>200000)return reply({error:'Payload too large'},413);
 let body;try{body=JSON.parse(raw)}catch(e){return reply({error:'Invalid JSON'},400)}
 if(!body||body.version!==1||!body.presets||typeof body.presets!=='object'||Array.isArray(body.presets))return reply({error:'Invalid preset data'},400);
 const safe={version:1,presets:{ftmo:{},topstep:{}},updatedAt:new Date().toISOString()};
 for(const firm of ['ftmo','topstep']){const group=body.presets[firm]||{};if(typeof group!=='object'||Array.isArray(group))return reply({error:'Invalid firm'},400);for(const [name,value] of Object.entries(group)){if(name.length>60||!value||typeof value!=='object')continue;safe.presets[firm][name]=value}}
 await env.PRESET_KV.put(id,JSON.stringify(safe));return reply({ok:true,updatedAt:safe.updatedAt});
}
