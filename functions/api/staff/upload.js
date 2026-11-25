const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const signatures={'image/jpeg':b=>b[0]===255&&b[1]===216&&b[2]===255,'image/png':b=>b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71,'image/gif':b=>String.fromCharCode(...b.slice(0,3))==='GIF','image/webp':b=>String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP','image/avif':b=>String.fromCharCode(...b.slice(4,8))==='ftyp'&&['avif','avis'].includes(String.fromCharCode(...b.slice(8,12)))};
const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
const PART=8*1024*1024; // Streaming chunk size, not a file limit.
export async function onRequestPost({request,env}){
 if(!request.headers.get('Cf-Access-Jwt-Assertion'))return json({error:'Staff login required'},401);
 const bucket=env.GLAM_IMAGES;
 if(!bucket)return json({error:'Image storage not configured'},503);
 const mime=(request.headers.get('content-type')||'').split(';')[0].toLowerCase();
 if(!mime.startsWith('image/'))return json({error:'Only image files are accepted'},415);
 if(!Object.hasOwn(signatures,mime))return json({error:'Unsupported image format'},415);
 if(!request.body)return json({error:'Empty image'},413);
 const key='products/'+crypto.randomUUID()+'.'+ext[mime];
 const options={httpMetadata:{contentType:mime,cacheControl:'public, max-age=31536000, immutable'}};
 const declared=Number(request.headers.get('content-length')||0);
 let total=0,upload,reader;
 try{
  // Normal small requests use a single PUT; stream larger or unknown-length bodies
  // to R2 multipart storage, retaining only a bounded chunk in memory.
  if((declared>0&&declared<=PART)||typeof bucket.createMultipartUpload!=='function'){
   const data=new Uint8Array(await request.arrayBuffer());total=data.length;
   if(!total)return json({error:'Empty image'},413);
   if(!signatures[mime](data))return json({error:'Image contents do not match file type'},415);
   await bucket.put(key,data,options);
  }else{
   reader=request.body.getReader();
   let part=new Uint8Array(PART),used=0;
   const parts=[];
   const flush=async()=>{
    if(!used)return;
    const value=part.subarray(0,used);
    if(!upload){
     if(!signatures[mime](value))throw Object.assign(Error('Image contents do not match file type'),{status:415});
     upload=await bucket.createMultipartUpload(key,options);
    }
    parts.push(await upload.uploadPart(parts.length+1,value));used=0;
   };
   while(true){
    const {done,value}=await reader.read();if(done)break;
    for(let pos=0;pos<value.length;){
     const n=Math.min(PART-used,value.length-pos);
     part.set(value.subarray(pos,pos+n),used);used+=n;pos+=n;total+=n;
     if(used===PART)await flush();
    }
   }
   if(!total)return json({error:'Empty image'},413);
   await flush();
   await upload.complete(parts);upload=null;
  }
  return json({ok:true,url:'/api/product-image/'+key.split('/')[1],bytes:total});
 }catch(error){
  if(upload)try{await upload.abort()}catch{}
  return json({error:error?.status===415?'Image contents do not match file type':'Image storage or connection failed'},error?.status===415?415:503);
 }finally{if(reader){try{await reader.cancel()}catch{}try{reader.releaseLock()}catch{}}}
}
