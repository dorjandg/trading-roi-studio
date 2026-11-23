// Disposable loopback-only frame bridge. NOT a production MCP tool or public endpoint.
import {createServer} from "node:http";
import {randomBytes,timingSafeEqual} from "node:crypto";
import {createPersistentVisualSession} from "./persistent-visual-session.mjs";
function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(body));}
export async function createAuthenticatedFrameBridge(chromium){
 const session=await createPersistentVisualSession(chromium);
 const token=randomBytes(32).toString("hex");
 let closed=false,queue=Promise.resolve();
 const server=createServer(async(req,res)=>{
  res.setHeader("cache-control","no-store");
  res.setHeader("x-content-type-options","nosniff");
  res.setHeader("content-security-policy","default-src 'none'; frame-ancestors 'none'");
  res.setHeader("referrer-policy","no-referrer");
  const host=req.headers.host||"";
  if(!/^127\.0\.0\.1:\d+$/.test(host)||req.headers.origin){json(res,403,{error:"Local client only"});return;}
  const authorization=req.headers.authorization||"";
  const candidate=authorization.startsWith("Bearer ")?authorization.slice(7):"";
  const a=Buffer.from(candidate),b=Buffer.from(token);
  if(a.length!==b.length||!timingSafeEqual(a,b)){json(res,401,{error:"Unauthorized"});return;}
  const path=new URL(req.url||"/","http://127.0.0.1").pathname;
  if(req.method==="GET"&&path==="/state"){json(res,200,{...session.state(),tabs:session.tabs(),events:session.events()});return;}
  if(req.method==="GET"&&path==="/frame"){
   const frame=await session.frame();
   res.writeHead(200,{"content-type":"image/png","x-frame-sequence":String(frame.sequence)});
   res.end(frame.png);return;
  }
  if(req.method==="POST"&&path==="/command"){
   if(req.headers["content-type"]!=="application/json"){json(res,415,{error:"JSON required"});return;}
   try{
    let raw="";
    for await(const chunk of req){raw+=chunk;if(raw.length>256)throw Error("Command too large");}
    const command=JSON.parse(raw);
    if(!command||typeof command!=="object"||Array.isArray(command))throw Error("Command refused");
    const keys=Object.keys(command).sort().join(",");
    const op=async()=>{
     if(command.type==="switch"&&keys==="tab,type"&&["google","youtube","github","staging"].includes(command.tab))await session.switchTab(command.tab);
     else if(command.type==="navigate"&&keys==="index,type"&&Number.isInteger(command.index))await session.navigate(command.index);
     else if(command.type==="history"&&keys==="delta,type"&&[-1,1].includes(command.delta))await session.history(command.delta);
     else throw Error("Command refused");
     return session.state();
    };
    const result=queue.then(op);queue=result.then(()=>{},()=>{});
    json(res,200,await result);
   }catch(e){json(res,400,{error:e.message});}
   return;
  }
  json(res,404,{error:"Not found"});
 });
 try{
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  return Object.freeze({
   url:`http://127.0.0.1:${server.address().port}`,
   // Capability stays in caller memory. Never log or persist it.
   authorization:`Bearer ${token}`,
   async close(){if(closed)return;closed=true;await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await session.close();}
  });
 }catch(e){await session.close();throw e;}
}
