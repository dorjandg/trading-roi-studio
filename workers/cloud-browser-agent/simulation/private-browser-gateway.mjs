// API1 private authenticated loopback gateway. Development-only; no deployment.
import {createServer} from "node:http";
import {randomBytes,timingSafeEqual} from "node:crypto";
import {createWikipediaVisualSession} from "./wikipedia-visual-session.mjs";
import {createIsolatedBrowserController} from "./isolated-browser-controller.mjs";
import {commandFailure,closedCommandFailure,runBoundedTask,
 createBoundedGatewayShutdown} from "./private-gateway-lifecycle.mjs";
const json=(res,status,value)=>{
 if(res.destroyed||res.writableEnded)return;
 res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});
 res.end(JSON.stringify(value));
};
const packet=(status,body)=>({status,body});
export async function createPrivateBrowserGateway(chromium,{fixture,timeoutMs=12000,
 sessionFactory=createWikipediaVisualSession,serverFactory=createServer,
 commandTimeoutMs=8000,shutdownTimeoutMs=2000,timers}={}){
 if(typeof sessionFactory!=="function"||typeof serverFactory!=="function"||
   timers!==undefined&&(!timers||typeof timers.setTimer!=="function"||typeof timers.clearTimer!=="function"||timers.now!==undefined&&typeof timers.now!=="function")||
   !Number.isSafeInteger(commandTimeoutMs)||commandTimeoutMs<1||commandTimeoutMs>8000||
   !Number.isSafeInteger(shutdownTimeoutMs)||shutdownTimeoutMs<1||shutdownTimeoutMs>5000)
  throw Error("Invalid private gateway configuration");
 let session;
 try{session=await sessionFactory(chromium,{fixture,timeoutMs});}
 catch{throw Error("Private browser gateway startup failed");}
 let controller,server,shutdown;
 try{
  controller=createIsolatedBrowserController(session,{stopOnDispatchedFailure:true,
   monotonicNow:timers?.now??(()=>performance.now())});
  if(typeof session.close!=="function")throw Error("Session shutdown required");
 }catch{
  await runBoundedTask(()=>session?.close?.(),shutdownTimeoutMs,timers);
  throw Error("Private browser gateway startup failed");
 }
 const accessKey=randomBytes(32).toString("base64url");
 const handler=async(req,res)=>{
  res.setHeader("cache-control","no-store");
  res.setHeader("referrer-policy","no-referrer");
  res.setHeader("x-frame-options","DENY");
  res.setHeader("content-security-policy","default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  const host=req.headers.host||"",origin=req.headers.origin;
  if(!/^127\.0\.0\.1:\d+$/.test(host))return json(res,403,{error:"Loopback host required"});
  if(origin&&origin!=="http://"+host)return json(res,403,{error:"Origin denied"});
  const supplied=req.headers.authorization,expected=Buffer.from("Bearer "+accessKey);
  const actual=Buffer.from(typeof supplied==="string"?supplied:"");
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return json(res,401,{error:"Unauthorized"});
  if(shutdown.isClosed())return json(res,503,closedCommandFailure());
  let submitted=false;
  const work=async()=>{
   const path=new URL(req.url||"/","http://127.0.0.1").pathname;
   if(req.method==="GET"&&path==="/health")return packet(200,{ok:true,private:true,readOnly:true});
   if(req.method==="GET"&&path==="/state")return packet(200,controller.read(controller.issueReadGrant()));
   if(req.method==="GET"&&path==="/frame"){
    const frame=await session.frame();
    return {status:200,png:frame.png,sequence:frame.sequence};
   }
   if(req.method==="GET"&&path==="/links"){
    controller.read(controller.issueReadGrant());
    return packet(200,await session.links());
   }
   if(req.method==="POST"&&path==="/command"){
    if(req.headers["content-type"]!=="application/json")
     return packet(415,commandFailure(null));
    let raw="";
    for await(const chunk of req){raw+=chunk;if(raw.length>500)throw Error("Command too large");}
    const command=JSON.parse(raw);
    if(shutdown.isClosed())return packet(503,closedCommandFailure());
    const grant=controller.issueControlGrant();
    submitted=true;
    let startedAt;
    try{startedAt=(timers?.now??(()=>performance.now()))();}catch{startedAt=NaN;}
    const deadlineAt=startedAt+commandTimeoutMs;
    let acknowledge;
    const ownerSettled=new Promise(resolve=>{acknowledge=resolve;});
    try{
     const outcome=await runBoundedTask(()=>controller.execute(grant,command,{deadlineAt,ownerSettled}),
      commandTimeoutMs,{...timers,startedAt});
     if(outcome.status==="fulfilled")return packet(200,outcome.value);
     const failure=commandFailure(outcome.reason,{submitted:true,timedOut:outcome.status==="timed-out"});
     // Invalidate before acknowledging the classified result to the queue.
     // Closing the adapter is bounded and cannot prove rollback.
     if(failure.outcomeUnknown)void shutdown.close();
     return packet(400,failure);
    }catch{
     void shutdown.close();
     return packet(400,commandFailure(null,{submitted:true}));
    }finally{acknowledge();}
   }
   return packet(404,{error:"Not found"});
  };
  const result=await Promise.race([
   work().catch(error=>{
    const failure=commandFailure(error,{submitted});
    if(failure.outcomeUnknown)void shutdown.close();
    return packet(400,failure);
   }),
   shutdown.deadline.then(()=>packet(400,commandFailure(null,{submitted,timedOut:submitted})))
  ]);
  try{
   if(result.png){
    if(res.destroyed||res.writableEnded)return;
    res.writeHead(200,{"content-type":"image/png","cache-control":"no-store",
     "x-frame-sequence":String(result.sequence),"x-content-type-options":"nosniff"});
    return res.end(result.png);
   }
   return json(res,result.status,result.body);
  }catch{
   // A lost response is uncertain delivery. Never leak a transport exception.
   if(submitted)void shutdown.close();
  }
 };
 try{
  server=serverFactory(handler);
  shutdown=createBoundedGatewayShutdown({controller,timeoutMs:shutdownTimeoutMs,timers,
   closeSession:()=>session.close(),
   closeTransport:()=>new Promise((resolve,reject)=>{
    server.close(error=>error?reject(error):resolve());
    if(typeof server.closeIdleConnections==="function")server.closeIdleConnections();
   }),
   forceTransport:()=>{
    if(typeof server.closeAllConnections!=="function")return false;
    server.closeAllConnections();return true;
   }});
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  return Object.freeze({url:"http://127.0.0.1:"+server.address().port,accessKey,
   close:()=>shutdown.close()});
 }catch{
  if(shutdown)await shutdown.close();
  else{controller.close();await runBoundedTask(()=>session.close(),shutdownTimeoutMs,timers);}
  throw Error("Private browser gateway startup failed");
 }
}
