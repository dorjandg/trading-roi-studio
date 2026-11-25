// Cloudflare Access protects /api/staff/*; status changes are deliberate, never autosaved.
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function onRequestPut({request,env}){
 if(!request.headers.get('Cf-Access-Jwt-Assertion'))return reply({error:'Staff login required'},401);
 if(!env.GLAM_DB)return reply({error:'Catalog database unavailable'},503);
 let input;try{input=await request.json()}catch{return reply({error:'Invalid JSON'},400)}
 const id=input?.id,status=input?.status;
 if(typeof id!=='string'||!id||id.length>200||!['published','unpublished'].includes(status))return reply({error:'Invalid product or publication status'},400);
 try{
  const row=await env.GLAM_DB.prepare('SELECT data,status FROM glam_catalog WHERE id=?').bind(id).first();
  if(!row)return reply({error:'Save this product before publishing'},404);
  const product=JSON.parse(row.data);
  // Support color-specific galleries for products that have no separate main photo.
  const firstColor=String(product.colors||'').split(',').map(c=>c.trim()).find(Boolean);
  const gallery=firstColor&&product.color_gallery?.[firstColor];
  const colorMain=(Array.isArray(gallery)&&gallery[0])||(firstColor&&product.color_images?.[firstColor]);
  const hasMain=Boolean((Array.isArray(product.images)&&product.images.length)||product.image_url||product.image);
  if(!hasMain&&colorMain){product.image_url=colorMain;product.images=[colorMain]}
  if(status==='published'&&(!String(product.name||'').trim()||!String(product.brand||'').trim()||!String(product.category||'').trim()||!String(product.price??'').trim()||!Number.isFinite(Number(product.price))||Number(product.price)<0||!(Array.isArray(product.images)&&product.images.length||product.image_url||product.image)))return reply({error:'Name, brand, collection, valid price and image are required before publishing. Your draft is preserved.'},400);
  const updated={...product,catalog_status:status};
  const changed=await env.GLAM_DB.prepare('UPDATE glam_catalog SET data=?,status=?,updated_at=? WHERE id=? AND data=? AND status=?').bind(JSON.stringify(updated),status,new Date().toISOString(),id,row.data,row.status).run();
  if(changed.meta?.changes===0)return reply({error:'Product changed during publication; reload and retry'},409);
  return reply({ok:true,id,status});
 }catch{return reply({error:'Could not change publication status'},503)}
}
