export async function onRequest({request,env}){
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(!env.PRESET_KV)return reply({error:'Cloud storage not configured'},503);
 if(request.method!=='GET'&&request.method!=='PUT')return reply({error:'Method not allowed'},405);
 if(!env.GOOGLE_CLIENT_ID)return reply({error:'Google sign-in not configured'},503);
 const authorization=request.headers.get('Authorization')||'';
 const match=/^Bearer (\S+)$/.exec(authorization);
 if(!match||match[1].length>5000)return reply({error:'Google sign-in required'},401);
 let identity;
 try{
  const check=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(match[1]));
  if(!check.ok)return reply({error:'Google session expired; sign in again'},401);
  identity=await check.json();
 }catch(e){return reply({error:'Could not verify Google sign-in'},503)}
 if(identity.aud!==env.GOOGLE_CLIENT_ID||!identity.sub||identity.iss!=='https://accounts.google.com'&&identity.iss!=='accounts.google.com'||Number(identity.exp)*1000<=Date.now())return reply({error:'Invalid Google sign-in'},401);
 const id='jj-google-presets:'+identity.sub;
 if(request.method==='GET'){const data=await env.PRESET_KV.get(id,'json');return reply({data:data||null})}
 const raw=await request.text();if(raw.length>200000)return reply({error:'Preset data too large'},413);
 let body;try{body=JSON.parse(raw)}catch(e){return reply({error:'Invalid JSON'},400)}
 if(!body||body.version!==1||!body.presets||typeof body.presets!=='object'||Array.isArray(body.presets))return reply({error:'Invalid preset data'},400);
 const safe={version:1,presets:{ftmo:{},topstep:{}},updatedAt:new Date().toISOString()};
 for(const firm of ['ftmo','topstep']){const group=body.presets[firm]||{};if(typeof group!=='object'||Array.isArray(group))return reply({error:'Invalid firm'},400);for(const [name,value] of Object.entries(group)){if(name.length>60||!value||typeof value!=='object'||Array.isArray(value))continue;safe.presets[firm][name]=value}}
 await env.PRESET_KV.put(id,JSON.stringify(safe));return reply({ok:true,updatedAt:safe.updatedAt});
}
