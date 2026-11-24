// CI mock ingress helper. No listener; all transport and shutdown are injected.
import {commandFailure,closedCommandFailure,runBoundedTask} from "./private-gateway-lifecycle.mjs";
export function createGatewayCommandProxy(gateway,{request=fetch,requestTimeoutMs=10000,
 stopTimeoutMs=2000,timers}={}){
 if(!gateway||!/^http:\/\/127\.0\.0\.1:\d+$/.test(gateway.url)||typeof gateway.accessKey!=="string"||
   timers!==undefined&&(!timers||typeof timers.setTimer!=="function"||typeof timers.clearTimer!=="function"||timers.now!==undefined&&typeof timers.now!=="function")||
   typeof gateway.close!=="function"||typeof request!=="function"||
   !Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>10000||
   !Number.isSafeInteger(stopTimeoutMs)||stopTimeoutMs<1||stopTimeoutMs>5000)
  throw Error("Invalid local controller gateway");
 let stopped=false,stopping=null;
 const controllers=new Set();
 function stop(){
  if(stopping)return stopping;
  let finishStop;
  stopping=new Promise(resolve=>{finishStop=resolve;});
  stopped=true;
  for(const controller of controllers)controller.abort();
  // The actual in-process gateway closes its controller synchronously. The
  // bounded result is cleanup evidence only, never permission to resume/retry.
  let closed;
  try{closed=Promise.resolve(gateway.close()).then(()=>"fulfilled",()=>"rejected");}
  catch{closed=Promise.resolve("rejected");}
  // Closure is already invoked and its rejection consumed, even when the
  // timing source fails and the bounded wait refuses to start its operation.
  void runBoundedTask(()=>closed,stopTimeoutMs,timers).then(result=>finishStop(
   Object.freeze({stopped:true,shutdownStatus:result.status==="fulfilled"?result.value:result.status,retrySafe:false})));
  return stopping;
 }
 async function execute(command){
  if(stopped)return {status:400,body:{...closedCommandFailure(),error:"Navigation refused"}};
  const abort=new AbortController();controllers.add(abort);
  const result=await runBoundedTask(async()=>{
   const response=await request(gateway.url+"/command",{method:"POST",
    headers:{authorization:"Bearer "+gateway.accessKey,"content-type":"application/json"},
    body:JSON.stringify(command),signal:abort.signal});
   const raw=await response.text();
   if(typeof raw!=="string"||raw.length>100000)throw Error("Invalid upstream response");
   const body=JSON.parse(raw);
   if(!response.ok)return {ok:false,body};
   if(body===null||typeof body!=="object"||Array.isArray(body)||
     !Number.isSafeInteger(body.sequence)||body.sequence<0)throw Error("Invalid upstream state");
   return {ok:true,body};
  },requestTimeoutMs,timers);
  controllers.delete(abort);
  if(result.status==="fulfilled"&&result.value.ok&&!stopped)return {status:200,body:result.value.body};
  const body=commandFailure(result.status==="fulfilled"?result.value.body:null,
   {submitted:true,timedOut:result.status==="timed-out",legacyError:"Navigation refused"});
  if(body.outcomeUnknown||body.code==="CONTROLLER_CLOSED"||body.code==="GATEWAY_CLOSED"){
   abort.abort();void stop();
  }
  return {status:400,body};
 }
 return Object.freeze({execute,stop,isStopped:()=>stopped});
}
