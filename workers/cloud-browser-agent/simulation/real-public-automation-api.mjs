// API 1 CI-only authenticated loopback API for real public Chromium automation.
// Not imported by deployed src/, Cloudflare Workers, Finance, or MCP gateways.
import {createServer} from "node:http";
import {randomBytes,timingSafeEqual} from "node:crypto";
import {runRealWikipediaAutomation} from "./real-public-automation.mjs";
const json=(res,status,data)=>{
 res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
 "x-content-type-options":"nosniff","referrer-policy":"no-referrer","x-frame-options":"DENY",
 "content-security-policy":"default-src 'none'; frame-ancestors 'none'"});
 res.end(JSON.stringify(data));
};
function equal(a,b){
 const x=Buffer.from(typeof a==="string"?a:""),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
}
export async function createRealPublicAutomationApi(chromium,{routeFixture,timeoutMs=20000,diagnostics=false}={}){
 if(!chromium||typeof chromium.launch!=="function")throw Error("Chromium required");
 const apiKey=randomBytes(32).toString("base64url");
 let active=null,closed=false;
 const server=createServer(async(req,res)=>{
  const host=req.headers.host||"";
  if(!/^127\.0\.0\.1:\d+$/.test(host))return json(res,403,{error:"Loopback only"});
  if(req.headers.origin&&req.headers.origin!=="http://"+host)return json(res,403,{error:"Cross-origin refused"});
  if(!equal(req.headers.authorization,"Bearer "+apiKey))return json(res,401,{error:"Unauthorized"});
  const path=new URL(req.url||"/","http://127.0.0.1").pathname;
  if(req.method==="GET"&&path==="/health")return json(res,200,{ok:true,isolated:true,productionWritesAllowed:false});
  if(req.method!=="POST"||path!=="/run")return json(res,404,{error:"Unknown endpoint"});
  if(req.headers["content-type"]!=="application/json")return json(res,415,{error:"JSON only"});
  if(active)return json(res,429,{error:"Browser busy"});
  try{
   let raw="";
   for await(const part of req){raw+=part;if(raw.length>500)throw Error("Request too large");}
   const body=JSON.parse(raw);
   if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).sort().join(",")!=="query,task"||body.task!=="wikipedia-demo"){
    return json(res,400,{error:"Task refused"});
   }
   if(typeof body.query!=="string"||body.query.length<3||body.query.length>80||!/^[A-Za-z0-9 ,.'-]+$/.test(body.query)){
    return json(res,400,{error:"Invalid query"});
   }
   active=runRealWikipediaAutomation(chromium,{query:body.query,routeFixture,timeoutMs});
   const result=await active;
   return json(res,200,result);
  }catch(e){
   const known=/^(Invalid|Request too large|Task refused)/.test(String(e?.message||""));
   return json(res,known?400:502,{error:known?String(e.message).slice(0,90):diagnostics?String(e?.message||e).slice(0,200):"Isolated automation failed"});
  }finally{active=null;}
 });
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 return Object.freeze({url:"http://127.0.0.1:"+server.address().port,apiKey,async close(){
  if(closed)return;closed=true;
  await new Promise(resolve=>server.close(resolve));
  if(active)await active.catch(()=>{});
 }});
}
