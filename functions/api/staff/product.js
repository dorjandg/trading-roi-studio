// Cloudflare Access must protect /api/staff/* at the edge.
// This endpoint updates one product only; it never bulk-replaces the catalog.
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function onRequestPut({request,env}){
 if(!request.headers.get('Cf-Access-Jwt-Assertion'))return json({error:'Staff login required'},401);
 if(!env.GLAM_DB)return json({error:'Catalog database unavailable'},503);
 let input;try{input=await request.json()}catch{return json({error:'Invalid JSON'},400)}
 const p=input?.product;
 if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.id!=='string'||!p.id||p.id.length>200)return json({error:'Invalid product'},400);
 const allowed=new Set(['published','unpublished','pending','sold_out','archived','reference']);
 if(!allowed.has(p.catalog_status))return json({error:'Invalid product status'},400);
 if(p.name!=null&&(typeof p.name!=='string'||p.name.length>300))return json({error:'Invalid product name'},400);
 try{
  const existing=await env.GLAM_DB.prepare('SELECT status FROM glam_catalog WHERE id=?').bind(p.id).first();
  // Editing an existing published product does not silently change its visibility.
  // Publish/Unpublish will be a separate explicit action.
  const status=existing?.status||'unpublished';
  const clean={...p,name:p.name??'',catalog_status:status};
  if(status==='published'&&(!String(clean.name||'').trim()||!String(clean.brand||'').trim()||!String(clean.category||'').trim()||!String(clean.price??'').trim()||!Number.isFinite(Number(clean.price))||Number(clean.price)<0))return json({error:'Published products require name, brand, collection and valid price. Unpublish to save incomplete details.'},400);
  const saved=await env.GLAM_DB.prepare('INSERT INTO glam_catalog (id,data,status,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE glam_catalog.status=excluded.status').bind(p.id,JSON.stringify(clean),status,new Date().toISOString()).run();
  if(saved.meta?.changes===0)return json({error:'Publication status changed; reload and retry'},409);
  return json({ok:true,id:p.id,status});
 }catch{return json({error:'Could not save product'},503)}
}
