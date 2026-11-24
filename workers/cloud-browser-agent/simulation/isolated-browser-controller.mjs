// Isolated, transport-neutral controller. Never import into production Worker/MCP.
// The adapter still owns destination policy and session shutdown. Closing this
// queue cannot undo, interrupt, or prove the outcome of a dispatched operation.
import {createLocalControllerAuth} from "./local-controller-auth.mjs";

const validText=(value,max)=>typeof value==="string"&&value.length>0&&
 value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
function snapshotCommand(input){
 // Inputs must come from a trusted JSON parse boundary. Descriptor checks avoid
 // invoking ordinary getters; arbitrary JavaScript Proxies are not a sandbox.
 try{
  if(input===null||typeof input!=="object"||Array.isArray(input))throw Error();
  const prototype=Object.getPrototypeOf(input);
  if(prototype!==Object.prototype&&prototype!==null)throw Error();
  const descriptors=Object.getOwnPropertyDescriptors(input),keys=Reflect.ownKeys(descriptors);
  if(keys.length<1||keys.length>2||keys.some(k=>typeof k!=="string"||
    !Object.hasOwn(descriptors[k],"value")||!descriptors[k].enumerable))throw Error();
  const type=descriptors.type?.value;
  const value=key=>descriptors[key]?.value;
  const exact=expected=>keys.length===expected.length&&expected.every(k=>Object.hasOwn(descriptors,k));
  if(type==="back"&&exact(["type"]))return Object.freeze({type});
  if(type==="search"&&exact(["type","term"])&&validText(value("term"),80))
   return Object.freeze({type,term:value("term")});
  if(type==="click"&&exact(["type","href"])&&validText(value("href"),2048))
   return Object.freeze({type,href:value("href")});
  if(type==="switch-tab"&&exact(["type","name"])&&validText(value("name"),64))
   return Object.freeze({type,name:value("name")});
  if(type==="navigate-fixture"&&exact(["type","index"])&&
    Number.isSafeInteger(value("index"))&&value("index")>=0)
   return Object.freeze({type,index:value("index")});
 }catch{}
 throw Error("Command refused");
}
function stoppedError(dispatched){
 const error=Error(dispatched?
  "Controller closed; dispatched operation outcome is unknown":
  "Controller closed before dispatch");
 error.code=dispatched?"CONTROLLER_CLOSED_IN_FLIGHT":"CONTROLLER_CLOSED";
 error.dispatched=dispatched;
 error.outcomeUnknown=dispatched;
 error.retrySafe=false;
 return error;
}
function commandError(source,dispatched){
 let message;
 try{message=Object.getOwnPropertyDescriptor(source,"message")?.value;}catch{}
 const error=Error(typeof message==="string"?message.slice(0,160):"Controller command failed");
 error.code=dispatched?"CONTROLLER_OPERATION_FAILED":"CONTROLLER_COMMAND_REJECTED";
 error.dispatched=dispatched;
 error.outcomeUnknown=dispatched;
 error.retrySafe=false;
 return error;
}

export function createIsolatedBrowserController(session,{auth=createLocalControllerAuth(),maxPendingCommands=32,stopOnDispatchedFailure=false,monotonicNow=()=>performance.now()}={}){
 if(!session||!["state","search","click","back"].every(k=>typeof session[k]==="function"))
  throw Error("Browser session required");
 if(!auth||typeof auth.issue!=="function"||typeof auth.verify!=="function")throw Error("Controller authentication required");
 if(!Number.isSafeInteger(maxPendingCommands)||maxPendingCommands<1||maxPendingCommands>256)
  throw Error("Invalid pending command limit");
 if(typeof stopOnDispatchedFailure!=="boolean")throw Error("Invalid failure-stop policy");
 if(typeof monotonicNow!=="function")throw Error("Invalid monotonic clock");
 let closed=false,generation=0,scheduled=false,active=null,outcomeUnknown=false;
 const pending=[],history=[];
 const verify=(token,consume=false)=>{
  try{return typeof token==="string"&&token.length<=1024&&
   auth.verify(token,"viewer:control",{consume})===true;}catch{return false;}
 };
 function checkDeadline(entry){
  if(entry.deadlineAt===undefined)return;
  let observed;
  try{observed=monotonicNow();}catch{}
  if(!Number.isFinite(observed)||observed<0||
    entry.lastObservedAt!==null&&observed<entry.lastObservedAt||observed>=entry.deadlineAt){
   entry.deadlineFailed=true;
   throw Error("Controller command deadline exceeded or unavailable");
  }
  entry.lastObservedAt=observed;
 }
 function eligible(entry){
  // Local invalidation only: this generation is not a durable runtime lease.
  if(closed||entry.generation!==generation)throw stoppedError(entry.dispatched);
  checkDeadline(entry);
 }
 function schedule(){
  if(scheduled||active||closed||pending.length===0)return;
  scheduled=true;
  queueMicrotask(()=>{scheduled=false;void dispatchNext();});
 }
 async function dispatchNext(){
  if(active||closed)return;
  const entry=pending.shift();
  if(!entry)return;
  active=entry;
  try{
   eligible(entry);
   // The one-use grant was consumed on admission. This non-consuming check
   // verifies that its scope/expiry is still valid when the adapter is called.
   if(!verify(entry.token))throw Error("Unauthorized or grant expired before dispatch");
   eligible(entry);
   const command=entry.command;
   entry.dispatched=true;
   if(command.type==="search")await session.search(command.term);
   else if(command.type==="click")await session.click(command.href);
   else if(command.type==="back")await session.back();
   else if(command.type==="switch-tab")await session.switchTab(command.name);
   else await session.navigate(command.index);
   eligible(entry);
   const state=session.state();
   eligible(entry);
   history.push({type:command.type,sequence:state.sequence,at:Date.now()});
   entry.resolve(state);
  }catch(error){
   const failure=closed||entry.generation!==generation?stoppedError(entry.dispatched):commandError(error,entry.dispatched);
   if(entry.dispatched)outcomeUnknown=true;
   // A gateway opts into fail-stop before any later queued adapter can run.
   if((entry.deadlineFailed||entry.dispatched&&stopOnDispatchedFailure)&&!closed)close();
   entry.reject(failure);
  }finally{
   // The HTTP owner must classify the result and invalidate on uncertainty
   // before this queue can dispatch another effect. A clock sample alone
   // cannot close the gap before the owner's promise continuation runs.
   if(entry.ownerSettled)await entry.ownerSettled;
   active=null;
   schedule();
  }
 }
 function read(token){
  if(closed||!auth.verify(token,"viewer:read"))throw Error("Unauthorized");
  return session.state();
 }
 async function execute(token,input,execution={}){
  try{
  if(closed||!verify(token))throw Error("Unauthorized or grant used");
  const command=snapshotCommand(input);
  // This separate context is supplied only by the trusted owner. It is never
  // read from caller command JSON. Deadlines require owner acknowledgment so
  // the queue stays held until the HTTP outcome has been classified.
  if(!execution||typeof execution!=="object"||Array.isArray(execution)||
    Object.keys(execution).some(key=>!["deadlineAt","ownerSettled"].includes(key))||
    execution.deadlineAt===undefined&&execution.ownerSettled!==undefined||
    execution.deadlineAt!==undefined&&(!Number.isFinite(execution.deadlineAt)||execution.deadlineAt<0||
      !(execution.ownerSettled instanceof Promise)))
   throw Error("Invalid execution deadline");
  const deadlineState={deadlineAt:execution.deadlineAt,lastObservedAt:null,deadlineFailed:false};
  try{checkDeadline(deadlineState);}catch(error){close();throw error;}
  if(command.type==="switch-tab"&&typeof session.switchTab!=="function"||
    command.type==="navigate-fixture"&&typeof session.navigate!=="function")throw Error("Command refused");
  if(pending.length>=maxPendingCommands)throw Error("Controller queue full");
  if(closed||!verify(token,true)||closed)throw Error("Unauthorized or grant used");
  return new Promise((resolve,reject)=>{
   // Observe rejection now, including while the adapter is still pending.
   const ownerSettled=execution.ownerSettled?.then(()=>{},()=>{close();});
   pending.push({command,token,generation,dispatched:false,resolve,reject,ownerSettled,...deadlineState});
   schedule();
  });
  }catch(error){throw commandError(error,false);}
 }
 function issue(scope,ttlMs){
  if(closed)throw Error("Unauthorized");
  return auth.issue({scope,ttlMs});
 }
 function close(){
  if(active?.dispatched)outcomeUnknown=true;
  if(!closed){closed=true;generation++;}
  const cancelledPending=pending.length;
  for(const entry of pending.splice(0))entry.reject(stoppedError(false));
  return Object.freeze({closed:true,cancelledPending,controllerDrained:active===null,
   activeOutcome:active?(active.dispatched?"unknown":"not-dispatched"):"none",
   adapterCancellationRequested:false,outcomeUnknown});
 }
 return Object.freeze({
  issueReadGrant:()=>issue("viewer:read",60000),
  issueControlGrant:()=>issue("viewer:control",30000),
  read,execute,audit:()=>history.map(x=>({...x})),close
 });
}
