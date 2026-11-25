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

// Remove the exact selected photo from this product, never from the shared R2 bucket.
// A single conditional database write prevents a concurrent change being overwritten.
const photoUrls=value=>(Array.isArray(value)?value:[value]).filter(v=>typeof v==='string'&&v.trim());
const uniquePhotos=values=>[...new Set(values)];
function withoutPhoto(product,url,status){
 const galleries={...(product.color_gallery||{})},covers={...(product.color_images||{})};
 const general=uniquePhotos([...photoUrls(product.images),...photoUrls(product.image_url),...photoUrls(product.image)]);
 let found=general.includes(url);
 for(const color of new Set([...Object.keys(galleries),...Object.keys(covers)])){
  const old=uniquePhotos([...photoUrls(galleries[color]),...photoUrls(covers[color])]);
  if(!old.includes(url))continue;
  found=true;
  const left=old.filter(value=>value!==url);
  galleries[color]=left;
  if(left.length)covers[color]=left[0];else delete covers[color];
 }
 if(!found)return {product,removed:false};
 const left=general.filter(value=>value!==url);
 const colorPhotos=uniquePhotos([...Object.values(galleries).flatMap(photoUrls),...Object.values(covers).flatMap(photoUrls)]).filter(value=>value!==url);
 const nextMain=left[0]||colorPhotos[0]||'';
 if(['published','sold_out'].includes(status)&&!nextMain)return {error:'Add a replacement photo before deleting the last photo of a public product.'};
 const next={...product,images:left.length?left:(nextMain?[nextMain]:[]),image_url:nextMain,color_gallery:galleries,color_images:covers,catalog_status:status};
 if(photoUrls(product.image).includes(url))delete next.image;
 return {product:next,removed:true};
}
export async function onRequestDelete({request,env}){
 if(!request.headers.get('Cf-Access-Jwt-Assertion'))return json({error:'Staff login required'},401);
 if(!env.GLAM_DB)return json({error:'Catalog database unavailable'},503);
 let input;try{input=await request.json()}catch{return json({error:'Invalid JSON'},400)}
 const id=input?.id,url=input?.url;
 if(typeof id!=='string'||!id||id.length>200||typeof url!=='string'||!url.trim())return json({error:'Product and selected photo are required'},400);
 try{
  const row=await env.GLAM_DB.prepare('SELECT data,status FROM glam_catalog WHERE id=?').bind(id).first();
  if(!row)return json({error:'Product not found in cloud. Reload the catalog and retry.'},404);
  const result=withoutPhoto(JSON.parse(row.data),url,row.status);
  if(result.error)return json({error:result.error},409);
  if(!result.removed)return json({ok:true,id,status:row.status,product:{...result.product,catalog_status:row.status},removed:false});
  const changed=await env.GLAM_DB.prepare('UPDATE glam_catalog SET data=?,updated_at=? WHERE id=? AND data=? AND status=?').bind(JSON.stringify(result.product),new Date().toISOString(),id,row.data,row.status).run();
  if(changed.meta?.changes!==1)return json({error:'Product changed while deleting the photo. Refresh and retry.'},409);
  return json({ok:true,id,status:row.status,product:result.product,removed:true});
 }catch{return json({error:'Could not delete photo. No cloud deletion was confirmed.'},503)}
}
