// GLAM staff-only catalog listing. Protect /api/staff/* with Cloudflare Access.
// Read-only endpoint: never writes to or migrates the existing catalog.
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
export async function onRequestGet({request,env}){
  // Cloudflare Access injects this assertion after authenticating a visitor.
  // Access policy is the primary enforcement layer; fail closed if it is absent.
  if(!request.headers.get('Cf-Access-Jwt-Assertion'))return reply({error:'Staff login required'},401);
  if(!env.GLAM_DB)return reply({error:'Catalog database unavailable'},503);
  try{
    const rows=await env.GLAM_DB.prepare("SELECT data,status FROM glam_catalog ORDER BY updated_at DESC LIMIT 2000").all();
    return reply({products:(rows.results||[]).map(r=>({...JSON.parse(r.data),catalog_status:r.status}))});
  }catch{return reply({error:'Could not load staff catalog'},503)}
}
