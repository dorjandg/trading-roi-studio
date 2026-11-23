// API1 isolated read-only viewer relay, loopback-only. NOT a deployable public service.
// A future authenticated HTTPS ingress must enforce identity before reaching this relay.
import {createServer} from "node:http";
import {randomBytes,timingSafeEqual} from "node:crypto";
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const json=(res,status,value)=>{res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(value));};
export async function createReadOnlyViewerRelay(gateway,{maxFrameBytes=3_000_000}={}){
 if(!gateway||!/^http:\/\/127\.0\.0\.1:\d+$/.test(gateway.url)||typeof gateway.accessKey!=="string")throw Error("Local gateway required");
 const viewerKey=randomBytes(32).toString("base64url");
 let closed=false;
 const server=createServer(async(req,res)=>{
  const host=req.headers.host||"";
  const origin=req.headers.origin;
  res.setHeader("cache-control","no-store");
  res.setHeader("referrer-policy","no-referrer");
  res.setHeader("x-content-type-options","nosniff");
  res.setHeader("x-frame-options","DENY");
  res.setHeader("content-security-policy","default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  if(!/^127\.0\.0\.1:\d+$/.test(host))return json(res,403,{error:"Loopback only"});
  if(origin&&origin!==`http://${host}`)return json(res,403,{error:"Origin denied"});
  if(!equal(typeof req.headers.authorization==="string"?req.headers.authorization:"","Bearer "+viewerKey))return json(res,401,{error:"Unauthorized"});
  const path=new URL(req.url||"/","http://127.0.0.1").pathname;
  if(req.method!=="GET"||!["/state","/frame","/links","/health"].includes(path))return json(res,404,{error:"Read-only endpoint not found"});
  try{
   const upstream=await fetch(gateway.url+path,{headers:{authorization:"Bearer "+gateway.accessKey},signal:AbortSignal.timeout(10000)});
   if(!upstream.ok)return json(res,502,{error:"Upstream unavailable"});
   const contentType=upstream.headers.get("content-type")||"";
   if(path==="/frame"){
    if(!contentType.startsWith("image/png"))throw Error("Unexpected frame type");
    const size=Number(upstream.headers.get("content-length")||0);
    if(size>maxFrameBytes)throw Error("Frame too large");
    const bytes=Buffer.from(await upstream.arrayBuffer());
    if(bytes.length>maxFrameBytes||bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a")throw Error("Invalid frame");
    res.writeHead(200,{"content-type":"image/png","cache-control":"no-store","x-frame-sequence":upstream.headers.get("x-frame-sequence")||"0","x-content-type-options":"nosniff"});
    return res.end(bytes);
   }
   if(!contentType.startsWith("application/json"))throw Error("Unexpected upstream type");
   const raw=await upstream.text();
   if(raw.length>100_000)throw Error("Response too large");
   return json(res,200,JSON.parse(raw));
  }catch{return json(res,502,{error:"Upstream unavailable"});}
 });
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 return Object.freeze({url:`http://127.0.0.1:${server.address().port}`,viewerKey,async close(){if(closed)return;closed=true;await new Promise(resolve=>server.close(resolve));}});
}
