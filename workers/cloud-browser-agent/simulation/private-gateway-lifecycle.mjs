// Development-only lifecycle helpers. All effectful dependencies are injected.
// A deadline or closed transport never proves that a browser effect was undone.
const stoppedCodes=Object.freeze({
 CONTROLLER_CLOSED:[false,false],CONTROLLER_CLOSED_IN_FLIGHT:[true,true],
 CONTROLLER_COMMAND_REJECTED:[false,false],CONTROLLER_OPERATION_FAILED:[true,true],
 GATEWAY_CLOSED:[false,false],GATEWAY_REQUEST_REJECTED:[false,false],
 GATEWAY_COMMAND_TIMEOUT:[null,true],GATEWAY_COMMAND_OUTCOME_UNKNOWN:[null,true]
});
function fields(value){
 try{
  if(value===null||typeof value!=="object")return {};
  const result={};
  for(const key of ["code","dispatched","outcomeUnknown","retrySafe"]){
   const descriptor=Object.getOwnPropertyDescriptor(value,key);
   if(descriptor&&Object.hasOwn(descriptor,"value"))result[key]=descriptor.value;
  }
  return result;
 }catch{return {};}
}
export function commandFailure(value,{submitted=false,timedOut=false,legacyError="Command refused"}={}){
 const error=legacyError==="Navigation refused"?legacyError:"Command refused";
 let code=timedOut?"GATEWAY_COMMAND_TIMEOUT":
  submitted?"GATEWAY_COMMAND_OUTCOME_UNKNOWN":"GATEWAY_REQUEST_REJECTED";
 if(!timedOut){
  const data=fields(value),expected=typeof data.code==="string"&&Object.hasOwn(stoppedCodes,data.code)?stoppedCodes[data.code]:null;
  if(expected&&data.dispatched===expected[0]&&data.outcomeUnknown===expected[1]&&data.retrySafe===false)
   code=data.code;
 }
 const [dispatched,outcomeUnknown]=stoppedCodes[code];
 return Object.freeze({error,code,dispatched,outcomeUnknown,retrySafe:false});
}
export const closedCommandFailure=()=>commandFailure({
 code:"GATEWAY_CLOSED",dispatched:false,outcomeUnknown:false,retrySafe:false
});

export function runBoundedTask(operation,timeoutMs,{setTimer=setTimeout,clearTimer=clearTimeout,now=()=>performance.now(),startedAt}={}){
 if(typeof operation!=="function"||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000||
   typeof setTimer!=="function"||typeof clearTimer!=="function"||typeof now!=="function")throw Error("Invalid bounded operation");
 let last;
 try{last=now();}catch{return Promise.resolve(Object.freeze({status:"timed-out"}));}
 if(!Number.isFinite(last)||last<0)return Promise.resolve(Object.freeze({status:"timed-out"}));
 const start=startedAt===undefined?last:startedAt;
 if(!Number.isFinite(start)||start<0||start>last)return Promise.resolve(Object.freeze({status:"timed-out"}));
 const deadline=start+timeoutMs;
 const expired=()=>{
  try{const current=now();
   if(!Number.isFinite(current)||current<last||current>=deadline)return true;
   last=current;return false;
  }catch{return true;}
 };
 return new Promise(resolve=>{
  let finished=false,timer;
  const finish=result=>{
   if(finished)return;
   finished=true;
   if(timer!==undefined)clearTimer(timer);
   // An overdue timer may run after the promise microtask. The monotonic
   // deadline, not callback order, decides whether settlement is timely.
   resolve(Object.freeze(result.status==="timed-out"||expired()?{status:"timed-out"}:result));
  };
  timer=setTimer(()=>finish({status:"timed-out"}),Math.max(0,deadline-last));
  if(finished)return;
  if(expired()){finish({status:"timed-out"});return;}
  try{
   // Start synchronously so invalidation callbacks gate further admission now.
   Promise.resolve(operation()).then(value=>finish({status:"fulfilled",value}),
    reason=>finish({status:"rejected",reason}));
  }catch(reason){finish({status:"rejected",reason});}
 });
}

export function createBoundedGatewayShutdown({controller,closeSession,closeTransport,
 forceTransport=()=>false,timeoutMs=2000,timers}={}){
 if(!controller||typeof controller.close!=="function"||typeof closeSession!=="function"||
   timers!==undefined&&(!timers||typeof timers.setTimer!=="function"||typeof timers.clearTimer!=="function"||timers.now!==undefined&&typeof timers.now!=="function")||
   typeof closeTransport!=="function"||typeof forceTransport!=="function"||
   !Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000)throw Error("Invalid shutdown contract");
 let closed=false,closing=null,releaseDeadline;
 const deadline=new Promise(resolve=>{releaseDeadline=resolve;});
 function close(){
  if(closing)return closing;
  let finishClosing;
  closing=new Promise(resolve=>{finishClosing=resolve;});
  closed=true;
  let startedAt;
  try{startedAt=(timers?.now??(()=>performance.now()))();}catch{startedAt=NaN;}
  let initial,controllerFailed=false;
  try{initial=controller.close();}catch{controllerFailed=true;}
  const status={session:"pending",transport:"pending"};
  const begin=(name,operation)=>{
   try{return Promise.resolve(operation()).then(()=>{status[name]="fulfilled";},()=>{status[name]="rejected";});}
   catch{status[name]="rejected";return Promise.resolve();}
  };
  // Session closure starts before transport draining. Neither is awaited first.
  const session=begin("session",closeSession),transport=begin("transport",closeTransport);
  void (async()=>{
   const result=await runBoundedTask(()=>Promise.all([session,transport]),timeoutMs,{...timers,startedAt});
   let forceRequested=false,forceFailed=false;
   if(result.status!=="fulfilled"||status.transport!=="fulfilled"){
    releaseDeadline();
    try{forceRequested=forceTransport()===true;}catch{forceFailed=true;}
   }
   let final;
   try{final=controller.close();}catch{controllerFailed=true;}
   const sessionClose=status.session==="pending"?"timed-out":status.session;
   const transportClose=status.transport==="pending"?"timed-out":status.transport;
   const deadlineExceeded=result.status!=="fulfilled";
   finishClosing(Object.freeze({closed:true,sessionClose,transportClose,forceRequested,forceFailed,deadlineExceeded,
    controllerDrained:!controllerFailed&&final?.controllerDrained===true,
    shutdownComplete:!deadlineExceeded&&!controllerFailed&&final?.controllerDrained===true&&
     sessionClose==="fulfilled"&&transportClose==="fulfilled",
    outcomeUnknown:deadlineExceeded||controllerFailed||initial?.activeOutcome==="unknown"||initial?.outcomeUnknown===true||final?.outcomeUnknown===true||
     sessionClose!=="fulfilled"||transportClose!=="fulfilled",
    retrySafe:false}));
  })();
  return closing;
 }
 return Object.freeze({close,isClosed:()=>closed,deadline});
}
