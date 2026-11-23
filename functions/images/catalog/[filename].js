// Serve GLAM catalog photographs directly from the production R2 bucket.
export async function onRequestGet({params,env,request}){
 const filename=String(params.filename||'');
 if(!/^[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|gif|avif)$/i.test(filename))return new Response('Invalid image',{status:400});
 if(!env.GLAM_IMAGES)return new Response('Image storage unavailable',{status:503});
 const object=await env.GLAM_IMAGES.get('catalog/'+filename);
 if(!object)return new Response('Image not found',{status:404});
 const headers=new Headers();
 object.writeHttpMetadata(headers);
 headers.set('content-type',object.httpMetadata?.contentType||'application/octet-stream');
 headers.set('cache-control','public, max-age=3600');
 headers.set('x-content-type-options','nosniff');
 if(object.httpEtag)headers.set('etag',object.httpEtag);
 return new Response(object.body,{headers});
}
