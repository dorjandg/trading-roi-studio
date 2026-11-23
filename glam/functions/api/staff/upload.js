const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function onRequestPost({request,env}){
 if(!request.headers.get('Cf-Access-Jwt-Assertion'))return json({error:'Staff login required'},401);
 if(!env.GLAM_IMAGES)return json({error:'Image storage not configured'},503);
 const type=request.headers.get('content-type')||'';
 if(!type.toLowerCase().startsWith('image/'))return json({error:'Only image files are accepted'},415);
 const allowed=['image/jpeg','image/png','image/webp','image/gif','image/avif'];
 if(!allowed.includes(type.split(';')[0].toLowerCase()))return json({error:'Unsupported image format'},415);
 const bytes=await request.arrayBuffer();
 if(!bytes.byteLength||bytes.byteLength>10*1024*1024)return json({error:'Image must be between 1 byte and 10 MB'},413);
 const mime=type.split(';')[0].toLowerCase();
 const signatures={'image/jpeg':b=>b[0]===255&&b[1]===216&&b[2]===255,'image/png':b=>b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71,'image/gif':b=>String.fromCharCode(...b.slice(0,3))==='GIF','image/webp':b=>String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP','image/avif':b=>String.fromCharCode(...b.slice(4,8))==='ftyp'&&['avif','avis'].includes(String.fromCharCode(...b.slice(8,12)))};
 if(!signatures[mime](new Uint8Array(bytes)))return json({error:'Image contents do not match file type'},415);
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'}[mime];
 const key='products/'+crypto.randomUUID()+'.'+ext;
 try{await env.GLAM_IMAGES.put(key,bytes,{httpMetadata:{contentType:mime,cacheControl:'public, max-age=31536000, immutable'}});
 return json({ok:true,url:'/api/product-image/'+key.split('/')[1]});}catch{return json({error:'Image storage failed'},503)}
}
