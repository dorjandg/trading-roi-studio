// Deletes one catalog record only. R2 objects are retained to avoid breaking shared image references.
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function onRequestDelete({request,env}){
 if(!request.headers.get('Cf-Access-Jwt-Assertion'))return json({error:'Staff login required'},401);
 if(!env.GLAM_DB)return json({error:'Catalog database unavailable'},503);
 let body;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400)}
 const id=body?.id;
 if(typeof id!=='string'||!id||id.length>200)return json({error:'Invalid product ID'},400);
 try{
  const result=await env.GLAM_DB.prepare('DELETE FROM glam_catalog WHERE id=?').bind(id).run();
  if(!result.meta?.changes)return json({error:'Product not found'},404);
  return json({ok:true,id});
 }catch{return json({error:'Could not delete product'},503)}
}
