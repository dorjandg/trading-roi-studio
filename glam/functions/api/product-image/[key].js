// Public read-only product image route. Objects are uploaded through staff-only API.
export async function onRequestGet({params,env}){
 const key=String(params.key||'');
 if(!/^[a-f0-9-]{36}\.(jpg|png|webp|gif|avif)$/.test(key))return new Response('Not found',{status:404});
 if(!env.GLAM_IMAGES)return new Response('Image storage unavailable',{status:503});
 const object=await env.GLAM_IMAGES.get('products/'+key);
 if(!object)return new Response('Not found',{status:404});
 return new Response(object.body,{headers:{'content-type':object.httpMetadata?.contentType||'application/octet-stream','cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff'}});
}
