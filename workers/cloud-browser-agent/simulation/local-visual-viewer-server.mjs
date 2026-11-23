// TEST-ONLY loopback viewer. Never imported by production Worker/MCP.
// The server accepts no URL input, uses synthetic pages, and refuses non-loopback binding.
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {createPersistentVisualSession} from "./persistent-visual-session.mjs";
const viewerFile=fileURLToPath(new URL("./local-visual-viewer-client.html",import.meta.url));
const json=(res,status,body)=>{res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(body));};
export async function createLocalVisualViewerServer(chromium){
 const session=await createPersistentVisualSession(chromium);
 let closed=false,queue=Promise.resolve();
 const server=createServer(async(req,res)=>{
  const host=req.headers.host||"";
  if(!/^127\.0\.0\.1:\d+$/.test(host)){json(res,403,{error:"Loopback host required"});return;}
  if(req.headers.origin && req.headers.origin!==`http://${host}`){json(res,403,{error:"Cross-origin request refused"});return;}
  const path=new URL(req.url||"/","http://127.0.0.1").pathname;
  res.setHeader("content-security-policy","default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.setHeader("x-frame-options","DENY");
  res.setHeader("referrer-policy","no-referrer");
  if(req.method==="GET" && path==="/"){
   res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
   res.end(await readFile(viewerFile));return;
  }
  if(req.method==="GET" && path==="/viewer.js"){
   res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});
   res.end(await readFile(new URL("./local-visual-viewer-client.mjs",import.meta.url)));return;
  }
  if(req.method==="GET" && path==="/state"){
   json(res,200,{...session.state(),tabs:session.tabs(),events:session.events()});return;
  }
  if(req.method==="GET" && path==="/frame"){
   const frame=await session.frame();
   res.writeHead(200,{"content-type":"image/png","cache-control":"no-store","x-content-type-options":"nosniff","x-frame-sequence":String(frame.sequence)});
   res.end(frame.png);return;
  }
  if(req.method==="POST" && path==="/command"){
   if(req.headers["content-type"]!=="application/json"){json(res,415,{error:"JSON required"});return;}
   let raw="";
   try{
    for await(const chunk of req){raw+=chunk;if(raw.length>256)throw Error("Command too large");}
    const command=JSON.parse(raw);
    if(!command || typeof command!=="object" || Array.isArray(command))throw Error("Invalid command");
    const keys=Object.keys(command).sort().join(",");
    const operation=async()=>{
     if(command.type==="switch" && keys==="tab,type" && typeof command.tab==="string")await session.switchTab(command.tab);
     else if(command.type==="navigate" && keys==="index,type" && Number.isInteger(command.index))await session.navigate(command.index);
     else if(command.type==="history" && keys==="delta,type" && [1,-1].includes(command.delta))await session.history(command.delta);
     else throw Error("Command refused");
     return {...session.state(),tabs:session.tabs(),events:session.events()};
    };
    const result=queue.then(operation);
    queue=result.then(()=>{},()=>{});
    json(res,200,await result);
   }catch(e){json(res,400,{error:e.message});}
   return;
  }
  json(res,404,{error:"Not found"});
 });
 try{
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  const address=server.address();
  return Object.freeze({url:`http://127.0.0.1:${address.port}`,async close(){if(closed)return;closed=true;await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await session.close();}});
 }catch(e){await session.close();throw e;}
}
