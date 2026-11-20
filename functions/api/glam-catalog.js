// GLAM catalog API. Public reads; staff writes require verified Cloudflare Access JWT.
// Bind D1 as DB, set ACCESS_TEAM_DOMAIN and ACCESS_AUD on the preview environment.
// All mutations fail closed until all three are configured.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const cors={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
function slug(s){return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90)}
function decode(s){const b=s.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(b.padEnd(Math.ceil(b.length/4)*4,"=")),c=>c.charCodeAt(0))}
async function authorize(req,env){
 if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD||!env.DB)return false;
 const token=req.headers.get("cf-access-jwt-assertion");if(!token)return false;
 const parts=token.split(".");if(parts.length!==3)return false;
 try{
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const payload=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if(header.alg!=="RS256"||!header.kid||payload.iss!==`https://${env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//,"").replace(/\/$/,"")}`||!Array.isArray(payload.aud)||!payload.aud.includes(env.ACCESS_AUD)||!Number.isFinite(payload.exp)||payload.exp*1000<Date.now()||!Number.isFinite(payload.iat)||payload.iat*1000>Date.now()+60000)return false;
  const domain=env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//,"").replace(/\/$/,"");
  if(!/^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(domain))return false;
  const r=await fetch(`https://${domain}/cdn-cgi/access/certs`);
  if(!r.ok)return false;
  const keys=(await r.json()).keys||[];const jwk=keys.find(k=>k.kid===header.kid&&k.kty==="RSA");if(!jwk)return false;
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
 }catch{return false}
}
export async function onRequest({request,env}){
 if(!env.DB)return json({error:"Catalog database is not configured."},503);
 const method=request.method;
 try{
  if(method==="GET"){
   const [categories,products]=await Promise.all([
    env.DB.prepare("SELECT id,parent_id,slug,name_en,name_sq,name_it,cover_image_key,sort_order,is_visible FROM categories WHERE is_visible=1 ORDER BY sort_order,name_en").all(),
    env.DB.prepare("SELECT id,slug,category_id,name_en,name_sq,name_it,description_en,price_cents,currency FROM catalog_products WHERE status='published' ORDER BY sort_order,name_en").all()
   ]);
   return json({categories:categories.results,products:products.results});
  }
  if(method!=="POST")return json({error:"Method not allowed"},405);
  if(!await authorize(request,env))return json({error:"Staff authentication is required."},403);
  if(Number(request.headers.get("content-length")||0)>20000)return json({error:"Request too large"},413);
  const body=await request.json();if(!body||typeof body!=="object")return json({error:"Invalid body"},400);
  if(body.action==="category.create"){
   const name=String(body.name_en||"").trim().slice(0,120);if(!name)return json({error:"Category name required"},400);
   const id=crypto.randomUUID(),sl=slug(name)+"-"+id.slice(0,8),parent=body.parent_id||null;
   if(parent){const p=await env.DB.prepare("SELECT id FROM categories WHERE id=?").bind(parent).first();if(!p)return json({error:"Parent category not found"},400)}
   await env.DB.prepare("INSERT INTO categories(id,parent_id,slug,name_en,name_sq,name_it,is_visible) VALUES(?,?,?,?,?,?,?)").bind(id,parent,sl,name,String(body.name_sq||"").slice(0,120),String(body.name_it||"").slice(0,120),body.is_visible===false?0:1).run();
   return json({ok:true,id},201);
  }
  if(body.action==="product.create"){
   const name=String(body.name_en||"").trim().slice(0,160),price=Number(body.price_cents);
   if(!name||!Number.isSafeInteger(price)||price<0||price>100000000)return json({error:"Invalid product or price"},400);
   const category=String(body.category_id||"");if(category){const found=await env.DB.prepare("SELECT id FROM categories WHERE id=?").bind(category).first();if(!found)return json({error:"Category not found"},400)}
   const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO catalog_products(id,slug,category_id,name_en,name_sq,name_it,description_en,price_cents,status) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,slug(name)+"-"+id.slice(0,8),category||null,name,String(body.name_sq||"").slice(0,160),String(body.name_it||"").slice(0,160),String(body.description_en||"").slice(0,4000),price,"draft").run();
   return json({ok:true,id,status:"draft"},201);
  }
  return json({error:"Unsupported action"},400);
 }catch(e){console.error("GLAM catalog API",e);return json({error:"Catalog request failed."},500)}
}
