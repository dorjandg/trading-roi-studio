// API1 private authenticated loopback gateway. Development-only; no deployment.
import {createServer} from "node:http";
import {randomBytes,timingSafeEqual} from "node:crypto";
import {createWikipediaVisualSession} from "./wikipedia-visual-session.mjs";
import {createIsolatedBrowserController} from "./isolated-browser-controller.mjs";
const json=(res,status,value)=>{res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(value));};
export async function createPrivateBrowserGateway(chromium,{fixture,timeoutMs=12000,sessionFactory=createWikipediaVisualSession}={}){
 const session=await sessionFactory(chromium,{fixture,timeoutMs});
 const controller=createIsolatedBrowserController(session);
 const accessKey=randomBytes(32).toString("base64url");
 let closed=false;
 const server=createServer(async(req,res)=>{
  const host=req.headers.host||"";
  const path=new URL(req.url||"/","http://127.0.0.1").pathname;
  const origin=req.headers.origin;
  res.setHeader("cache-control","no-store");
  res.setHeader("referrer-policy","no-referrer");
  res.setHeader("x-frame-options","DENY");
  res.setHeader("content-security-policy","default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  if(!/^127\.0\.0\.1:\d+$/.test(host))return json(res,403,{error:"Loopback host required"});
  if(origin&&origin!==`http://${host}`)return json(res,403,{error:"Origin denied"});
  const supplied=req.headers.authorization;
  const expected=Buffer.from("Bearer "+accessKey);
  const actual=Buffer.from(typeof supplied==="string"?supplied:"");
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return json(res,401,{error:"Unauthorized"});
  try{
   if(req.method==="GET"&&path==="/health")return json(res,200,{ok:true,private:true,readOnly:true});
   if(req.method==="GET"&&path==="/state")return json(res,200,controller.read(controller.issueReadGrant()));
   if(req.method==="GET"&&path==="/frame"){
    const f=await session.frame();
    res.writeHead(200,{"content-type":"image/png","cache-control":"no-store","x-frame-sequence":String(f.sequence),"x-content-type-options":"nosniff"});
    return res.end(f.png);
   }
   if(req.method==="GET"&&path==="/links"){
    controller.read(controller.issueReadGrant());
    return json(res,200,await session.links());
   }
   if(req.method==="POST"&&path==="/command"){
    if(req.headers["content-type"]!=="application/json")return json(res,415,{error:"JSON required"});
    let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>500)throw Error("Command too large");}
    const command=JSON.parse(raw);
    const state=await controller.execute(controller.issueControlGrant(),command);
    return json(res,200,state);
   }
   return json(res,404,{error:"Not found"});
  }catch(e){return json(res,400,{error:String(e.message).slice(0,120)});}
 });
 try{
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  return Object.freeze({url:`http://127.0.0.1:${server.address().port}`,accessKey,async close(){if(closed)return;closed=true;controller.close();await new Promise(resolve=>server.close(resolve));await session.close();}});
 }catch(e){controller.close();await session.close();throw e;}
}
