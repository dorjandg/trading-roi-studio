// Read-only D1 connectivity probe for the protected GLAM preview.
// No catalog mutations are permitted until Access JWT verification is implemented.
export async function onRequestGet({request,env}) {
 const host=new URL(request.url).hostname.toLowerCase();
 if(host!=="studio-preview.glam-lingerie.com")return new Response("Not found",{status:404});
 if(!env.DB)return Response.json({connected:false,error:"D1 binding DB is missing"},{status:503,headers:{"cache-control":"no-store"}});
 try{
  const names=["categories","catalog_products","product_images","product_variants","catalog_orders","catalog_order_items"];
  const rows=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('categories','catalog_products','product_images','product_variants','catalog_orders','catalog_order_items')").all();
  const found=new Set((rows.results||[]).map(x=>x.name));
  return Response.json({connected:true,schemaReady:names.every(n=>found.has(n)),tables:names.map(name=>({name,exists:found.has(name)}))},{headers:{"cache-control":"no-store","x-robots-tag":"noindex"}});
 }catch(e){return Response.json({connected:false,error:"Database query failed"},{status:503,headers:{"cache-control":"no-store"}})}
}
