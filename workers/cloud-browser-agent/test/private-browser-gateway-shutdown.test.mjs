// No listeners, real browsers, or external requests: injected objects and timers only.
import test from "node:test";
import assert from "node:assert/strict";
import {createPrivateBrowserGateway} from "../simulation/private-browser-gateway.mjs";
import {createIsolatedBrowserController} from "../simulation/isolated-browser-controller.mjs";
import {commandFailure,runBoundedTask,createBoundedGatewayShutdown} from "../simulation/private-gateway-lifecycle.mjs";
import {createGatewayCommandProxy} from "../simulation/private-gateway-command-proxy.mjs";

function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
async function flush(){for(let i=0;i<24;i++)await Promise.resolve();}
function clock(){
 let now=0,id=0;const tasks=new Map();
 return {timers:{setTimer(fn,delay){tasks.set(++id,{fn,at:now+delay});return id;},clearTimer(key){tasks.delete(key);},now:()=>now},
  advance(delta){now+=delta;for(const [key,task] of [...tasks].sort((a,b)=>a[1].at-b[1].at))
   if(task.at<=now&&tasks.delete(key))task.fn();},elapseWithoutTimers(delta){now+=delta;},pending:()=>tasks.size};
}
function serverFixture({listenFailure=false,holdClose=false}={}){
 let handler,errorHandler,closeCallback,closing=false;
 const active=new Set(),events=[];let forced=0;
 const completeClose=()=>{if(closing&&!holdClose&&active.size===0&&closeCallback){const done=closeCallback;closeCallback=null;done();}};
 const server={
  once(event,fn){assert.equal(event,"error");errorHandler=fn;return server;},
  listen(port,host,ready){assert.equal(port,0);assert.equal(host,"127.0.0.1");
   queueMicrotask(()=>listenFailure?errorHandler(Error("PRIVATE_SERVER_DETAIL")):ready());},
  address:()=>({port:43111}),
  close(fn){events.push("transport-close");closing=true;closeCallback=fn;completeClose();},
  closeIdleConnections(){events.push("idle-close");},
  closeAllConnections(){forced++;events.push("forced-close");}
 };
 function request(gateway,{method="POST",path="/command",body={type:"back"},raw,key=gateway.accessKey,headers={}}={}){
  const token={};active.add(token);
  const response={status:0,headers:{},writableEnded:false,destroyed:false,
   setHeader(name,value){this.headers[name]=value;},
   writeHead(status,values){this.status=status;Object.assign(this.headers,values);},
   end(value){this.raw=value;this.writableEnded=true;}};
  const req={method,url:path,headers:{host:"127.0.0.1:43111",
   authorization:"Bearer "+key,"content-type":"application/json",...headers},
   async *[Symbol.asyncIterator](){yield raw??JSON.stringify(body);}};
  const done=handler(req,response).finally(()=>{active.delete(token);completeClose();});
  return {response,done,body:()=>JSON.parse(response.raw)};
 }
 return {factory(fn){handler=fn;return server;},request,events,forced:()=>forced};
}
function sessionFixture({onSearch=async()=>{},onClose=()=>Promise.resolve(),onBack=async()=>{}}={}){
 let sequence=0,closeCalls=0;const calls=[];
 return {calls,closeCalls:()=>closeCalls,session:{
  state:()=>({sequence}),links:async()=>[],frame:async()=>({sequence,png:Buffer.from("fixture")}),
  async search(term){calls.push(["search",term]);await onSearch();sequence++;},
  async click(href){calls.push(["click",href]);sequence++;},
  async back(){calls.push(["back"]);await onBack();sequence++;},
  async close(){closeCalls++;return onClose();}
 }};
}
async function fakeGateway({session= sessionFixture(),server=serverFixture(),timer=clock(),...options}={}){
 const gateway=await createPrivateBrowserGateway(null,{sessionFactory:async()=>session.session,
  serverFactory:server.factory,timers:timer.timers,commandTimeoutMs:20,shutdownTimeoutMs:5,...options});
 return {gateway,session,server,timer};
}
const expectedFailure=(code,dispatched,outcomeUnknown,error="Command refused")=>
 ({error,code,dispatched,outcomeUnknown,retrySafe:false});
const upstream=(body,ok=false)=>({ok,async text(){return JSON.stringify(body);}});

test("controller failures carry trusted dispatch metadata without parsing messages",async()=>{
 const session=sessionFixture({onBack:async()=>{throw Error("Command refused");}});
 const controller=createIsolatedBrowserController(session.session);
 await assert.rejects(controller.execute(controller.issueControlGrant(),{type:"unknown"}),error=>{
  assert.equal(error.code,"CONTROLLER_COMMAND_REJECTED");assert.equal(error.dispatched,false);
  assert.equal(error.outcomeUnknown,false);assert.equal(error.retrySafe,false);return true;
 });
 await assert.rejects(controller.execute(controller.issueControlGrant(),{type:"back"}),error=>{
  assert.equal(error.code,"CONTROLLER_OPERATION_FAILED");assert.equal(error.dispatched,true);
  assert.equal(error.outcomeUnknown,true);assert.equal(error.retrySafe,false);return true;
 });
 controller.close();
});
test("owner acknowledgment releases a known pre-dispatch refusal without losing the queue",async()=>{
 const timer=clock(),session=sessionFixture(),denied=new Set();let serial=0;
 const controller=createIsolatedBrowserController(session.session,{stopOnDispatchedFailure:true,
  monotonicNow:timer.timers.now,auth:{issue:()=>"synthetic-"+(++serial),verify:token=>!denied.has(token)}});
 await assert.rejects(controller.execute(controller.issueControlGrant(),{type:"back"},{deadlineAt:10}),
  error=>error.code==="CONTROLLER_COMMAND_REJECTED"&&error.dispatched===false);
 const owner=deferred(),token=controller.issueControlGrant();
 const refused=controller.execute(token,{type:"back"},{deadlineAt:10,ownerSettled:owner.promise});
 denied.add(token);
 await assert.rejects(refused,error=>error.code==="CONTROLLER_COMMAND_REJECTED"&&
  error.dispatched===false&&error.outcomeUnknown===false);
 const next=controller.execute(controller.issueControlGrant(),{type:"back"});
 await flush();assert.deepEqual(session.calls,[]);
 owner.resolve();assert.equal((await next).sequence,1);
 assert.deepEqual(session.calls,[["back"]]);controller.close();
});
test("rejected owner acknowledgment immediately invalidates during a pending adapter",async()=>{
 const timer=clock(),started=deferred(),release=deferred(),owner=deferred();
 const session=sessionFixture({onSearch:async()=>{started.resolve();await release.promise;}});
 const controller=createIsolatedBrowserController(session.session,{stopOnDispatchedFailure:true,monotonicNow:timer.timers.now});
 const active=controller.execute(controller.issueControlGrant(),{type:"search",term:"fixture"},
  {deadlineAt:10,ownerSettled:owner.promise});
 const activeRejected=assert.rejects(active,error=>error.code==="CONTROLLER_CLOSED_IN_FLIGHT"&&error.outcomeUnknown===true);
 await started.promise;
 const queued=controller.execute(controller.issueControlGrant(),{type:"back"});
 const queuedRejected=assert.rejects(queued,error=>error.code==="CONTROLLER_CLOSED"&&error.dispatched===false);
 owner.reject(Error("PRIVATE_OWNER_FAILURE"));await queuedRejected;await flush();
 assert.deepEqual(session.calls,[["search","fixture"]]);
 const status=controller.close();assert.equal(status.controllerDrained,false);assert.equal(status.outcomeUnknown,true);
 release.resolve();await activeRejected;await flush();
 assert.deepEqual(session.calls,[["search","fixture"]]);
});
test("failure packets preserve only coherent fixed fields and never raw error text",()=>{
 const raw={...expectedFailure("CONTROLLER_OPERATION_FAILED",true,true),error:"PRIVATE_DETAIL",message:"SECRET"};
 assert.deepEqual(commandFailure(raw,{submitted:true}),expectedFailure("CONTROLLER_OPERATION_FAILED",true,true));
 assert.deepEqual(commandFailure({...raw,dispatched:false,retrySafe:true},{submitted:true}),
  expectedFailure("GATEWAY_COMMAND_OUTCOME_UNKNOWN",null,true));
 let touched=0;const getter={get code(){touched++;return "CONTROLLER_CLOSED";}};
 assert.equal(commandFailure(getter,{submitted:true}).outcomeUnknown,true);assert.equal(touched,0);
});
test("bounded tasks clear timers and consume late rejection after timeout",async()=>{
 const timer=clock(),late=deferred();
 const result=runBoundedTask(()=>late.promise,3,timer.timers);
 timer.advance(3);assert.equal((await result).status,"timed-out");
 late.reject(Error("PRIVATE_LATE_FAILURE"));await flush();assert.equal(timer.pending(),0);
 const good=await runBoundedTask(()=>7,3,timer.timers);
 assert.equal(good.value,7);assert.equal(timer.pending(),0);
});
test("absolute monotonic deadline rejects a sync-late result before its timer fires",async()=>{
 const timer=clock();
 const result=await runBoundedTask(()=>{timer.elapseWithoutTimers(6);return "late-success";},5,timer.timers);
 assert.equal(result.status,"timed-out");assert.equal(Object.hasOwn(result,"value"),false);
 assert.equal(timer.pending(),0);
});
test("absolute monotonic deadline rejects a delayed promise microtask without timer delivery",async()=>{
 const timer=clock(),pending=deferred();
 const result=runBoundedTask(()=>pending.promise,5,timer.timers);
 timer.elapseWithoutTimers(5);pending.resolve("late-success");
 assert.equal((await result).status,"timed-out");assert.equal(timer.pending(),0);
});
test("shared deadline arms only the remaining budget for pending work",async()=>{
 const timer=clock(),held=deferred(),delays=[],originalSetTimer=timer.timers.setTimer;
 timer.elapseWithoutTimers(3);
 const result=runBoundedTask(()=>held.promise,5,{...timer.timers,startedAt:0,
  setTimer(fn,delay){delays.push(delay);return originalSetTimer(fn,delay);}});
 assert.deepEqual(delays,[2]);
 timer.advance(2);assert.equal((await result).status,"timed-out");
 assert.equal(timer.pending(),0);held.resolve();await flush();
});
test("shutdown starts session close before HTTP drain and is idempotent under reentry",async()=>{
 const timer=clock(),events=[];let shutdown,again,controllerCalls=0;
 const controller={close(){controllerCalls++;return {controllerDrained:true,activeOutcome:"none"};}};
 shutdown=createBoundedGatewayShutdown({controller,timers:timer.timers,timeoutMs:5,
  closeSession(){events.push("session");again=shutdown.close();},
  closeTransport(){events.push("transport");}});
 const closing=shutdown.close();
 assert.equal(again,closing);
 const result=await closing;assert.deepEqual(events,["session","transport"]);
 assert.equal(result.shutdownComplete,true);assert.equal(controllerCalls,2);
 assert.equal(shutdown.close(),closing);assert.equal(timer.pending(),0);
});
test("hung shutdown returns bounded incomplete evidence and attempts transport termination",async()=>{
 const timer=clock(),session=deferred(),transport=deferred();let forceCalls=0;
 const shutdown=createBoundedGatewayShutdown({
  controller:{close:()=>({controllerDrained:false,activeOutcome:"unknown"})},
  closeSession:()=>session.promise,closeTransport:()=>transport.promise,
  forceTransport:()=>{forceCalls++;return true;},timers:timer.timers,timeoutMs:5});
 const result=shutdown.close();timer.advance(5);
 const status=await result;
 assert.equal(status.sessionClose,"timed-out");assert.equal(status.transportClose,"timed-out");
 assert.equal(status.shutdownComplete,false);assert.equal(status.outcomeUnknown,true);
 assert.equal(status.retrySafe,false);assert.equal(forceCalls,1);await shutdown.deadline;
 session.reject(Error("PRIVATE_CLEANUP"));transport.reject(Error("PRIVATE_TRANSPORT"));await flush();
});
test("late cleanup cannot report complete when its absolute budget was exceeded",async()=>{
 const timer=clock(),session=deferred(),transport=deferred();
 const shutdown=createBoundedGatewayShutdown({controller:{close:()=>({controllerDrained:true,activeOutcome:"none"})},
  closeSession:()=>session.promise,closeTransport:()=>transport.promise,forceTransport:()=>true,timers:timer.timers,timeoutMs:5});
 const result=shutdown.close();timer.elapseWithoutTimers(6);session.resolve();transport.resolve();
 const status=await result;
 assert.equal(status.sessionClose,"fulfilled");assert.equal(status.transportClose,"fulfilled");
 assert.equal(status.deadlineExceeded,true);assert.equal(status.shutdownComplete,false);assert.equal(status.outcomeUnknown,true);
});
test("shutdown budget includes synchronous cleanup time without suppressing closure",async()=>{
 const timer=clock();let sessionCalls=0,transportCalls=0;
 const shutdown=createBoundedGatewayShutdown({controller:{close:()=>({controllerDrained:true,activeOutcome:"none"})},
  closeSession:()=>{sessionCalls++;timer.elapseWithoutTimers(6);},closeTransport:()=>{transportCalls++;},
  timers:timer.timers,timeoutMs:5});
 const status=await shutdown.close();
 assert.equal(status.deadlineExceeded,true);assert.equal(status.shutdownComplete,false);
 assert.equal(sessionCalls,1);assert.equal(transportCalls,1);
});
test("gateway keeps known pre-dispatch failures usable and preserves security guards",async()=>{
 const f=await fakeGateway();
 for(const options of [{key:"wrong"},{headers:{host:"evil.invalid"}},{headers:{origin:"https://evil.invalid"}}]){
  const r=f.server.request(f.gateway,options);await r.done;assert.ok([401,403].includes(r.response.status));
 }
 const invalid=f.server.request(f.gateway,{body:{type:"unsupported"}});await invalid.done;
 assert.deepEqual(invalid.body(),expectedFailure("CONTROLLER_COMMAND_REJECTED",false,false));
 const malformed=f.server.request(f.gateway,{raw:"{"});await malformed.done;
 assert.deepEqual(malformed.body(),expectedFailure("GATEWAY_REQUEST_REJECTED",false,false));
 const valid=f.server.request(f.gateway);await valid.done;assert.equal(valid.response.status,200);
 assert.equal(valid.body().sequence,1);assert.equal(f.session.closeCalls(),0);
 assert.equal(valid.response.headers["cache-control"],"no-store");
 assert.equal((await f.gateway.close()).shutdownComplete,true);
});
test("gateway adapter failure retains uncertainty, sanitizes errors and blocks the next effect",async()=>{
 const session=sessionFixture({onBack:async()=>{throw Error("PRIVATE_ADAPTER_SECRET");}});
 const f=await fakeGateway({session});
 const failed=f.server.request(f.gateway);await failed.done;
 assert.deepEqual(failed.body(),expectedFailure("CONTROLLER_OPERATION_FAILED",true,true));
 assert.equal(failed.response.raw.includes("PRIVATE_ADAPTER_SECRET"),false);
 const next=f.server.request(f.gateway);await next.done;
 assert.equal(next.response.status,503);assert.equal(next.body().code,"GATEWAY_CLOSED");
 assert.deepEqual(session.calls,[["back"]]);assert.equal(session.closeCalls(),1);
 assert.equal((await f.gateway.close()).outcomeUnknown,true);
});
test("gateway failure-stop closes the queue before its next command can dispatch",async()=>{
 const started=deferred(),release=deferred();
 const session=sessionFixture({onSearch:async()=>{started.resolve();await release.promise;throw Error("PRIVATE_PARTIAL_EFFECT");}});
 const f=await fakeGateway({session});
 const active=f.server.request(f.gateway,{body:{type:"search",term:"fixture"}});await started.promise;
 const queued=f.server.request(f.gateway);await flush();
 release.resolve();await Promise.all([active.done,queued.done]);
 assert.deepEqual(active.body(),expectedFailure("CONTROLLER_OPERATION_FAILED",true,true));
 assert.deepEqual(queued.body(),expectedFailure("CONTROLLER_CLOSED",false,false));
 assert.deepEqual(session.calls,[["search","fixture"]]);
 const result=await f.gateway.close();assert.equal(result.outcomeUnknown,true);
 assert.equal(result.shutdownComplete,true);
});
test("gateway closes the session without first waiting for an active HTTP command",async()=>{
 const started=deferred(),release=deferred(),order=[];
 const session=sessionFixture({onSearch:async()=>{started.resolve();await release.promise;},
  onClose:()=>{order.push("session-close");release.resolve();}});
 const f=await fakeGateway({session});
 const active=f.server.request(f.gateway,{body:{type:"search",term:"fixture"}});
 await started.promise;
 const closed=f.gateway.close();
 assert.equal(order[0],"session-close");assert.equal(f.server.events[0],"transport-close");
 await active.done;
 assert.deepEqual(active.body(),expectedFailure("CONTROLLER_CLOSED_IN_FLIGHT",true,true));
 const result=await closed;assert.equal(result.shutdownComplete,true);assert.equal(result.outcomeUnknown,true);
});
test("gateway command deadline invalidates queued and future effects before responding",async()=>{
 const started=deferred(),release=deferred(),closeHeld=deferred();
 const session=sessionFixture({onSearch:async()=>{started.resolve();await release.promise;},onClose:()=>closeHeld.promise});
 const f=await fakeGateway({session,commandTimeoutMs:5});
 const active=f.server.request(f.gateway,{body:{type:"search",term:"fixture"}});await started.promise;
 f.timer.advance(1);
 const queued=f.server.request(f.gateway);await flush();
 f.timer.advance(4);await active.done;await queued.done;
 assert.deepEqual(active.body(),expectedFailure("GATEWAY_COMMAND_TIMEOUT",null,true));
 assert.deepEqual(queued.body(),expectedFailure("CONTROLLER_CLOSED",false,false));
 assert.equal(session.closeCalls(),1);assert.deepEqual(session.calls,[["search","fixture"]]);
 const next=f.server.request(f.gateway);await next.done;assert.equal(next.response.status,503);
 f.timer.advance(5);
 const shutdown=await f.gateway.close();
 assert.equal(shutdown.sessionClose,"timed-out");assert.equal(shutdown.shutdownComplete,false);
 assert.equal(shutdown.outcomeUnknown,true);
 release.resolve();closeHeld.resolve();await flush();
 assert.deepEqual(active.body(),expectedFailure("GATEWAY_COMMAND_TIMEOUT",null,true));
 assert.deepEqual(session.calls,[["search","fixture"]]);
});
test("shared absolute deadline stops queued dispatch before overdue timers or outer continuations",async()=>{
 const timer=clock(),originalNow=timer.timers.now;
 let reads=0;
 timer.timers.now=()=>{if(++reads===2)timer.elapseWithoutTimers(1);return originalNow();};
 const started=deferred(),release=deferred();
 const session=sessionFixture({onSearch:async()=>{started.resolve();await release.promise;}});
 const f=await fakeGateway({session,timer,commandTimeoutMs:5});
 const active=f.server.request(f.gateway,{body:{type:"search",term:"fixture"}});await started.promise;
 const queued=f.server.request(f.gateway);await flush();
 timer.elapseWithoutTimers(4);release.resolve();
 await Promise.all([active.done,queued.done]);
 assert.equal(active.body().code,"GATEWAY_COMMAND_TIMEOUT");
 assert.equal(queued.body().code,"CONTROLLER_CLOSED");
 assert.deepEqual(session.calls,[["search","fixture"]]);
 const closed=await f.gateway.close();assert.equal(closed.outcomeUnknown,true);
});
test("owner classification fences the boundary after the controller's final clock sample",async()=>{
 const timer=clock(),originalNow=timer.timers.now;
 let armBoundary=false;
 timer.timers.now=()=>{const observed=originalNow();
  if(armBoundary){armBoundary=false;timer.elapseWithoutTimers(1);}return observed;};
 const started=deferred(),release=deferred();
 const session=sessionFixture({onSearch:async()=>{started.resolve();await release.promise;}});
 const originalState=session.session.state;
 session.session.state=()=>{armBoundary=true;return originalState();};
 const f=await fakeGateway({session,timer,commandTimeoutMs:5});
 const active=f.server.request(f.gateway,{body:{type:"search",term:"fixture"}});await started.promise;
 timer.elapseWithoutTimers(1);
 const queued=f.server.request(f.gateway);await flush();
 timer.elapseWithoutTimers(3);release.resolve();
 await Promise.all([active.done,queued.done]);
 assert.deepEqual(active.body(),expectedFailure("GATEWAY_COMMAND_TIMEOUT",null,true));
 assert.deepEqual(queued.body(),expectedFailure("CONTROLLER_CLOSED",false,false));
 assert.deepEqual(session.calls,[["search","fixture"]]);
 assert.equal((await f.gateway.close()).outcomeUnknown,true);
});
test("startup transport failures are sanitized and cleanup remains bounded",async()=>{
 const timer=clock(),held=deferred(),session=sessionFixture({onClose:()=>held.promise});
 const server=serverFixture({listenFailure:true});
 const result=createPrivateBrowserGateway(null,{sessionFactory:async()=>session.session,
  serverFactory:server.factory,timers:timer.timers,shutdownTimeoutMs:5});
 const rejected=assert.rejects(result,error=>{
  assert.equal(error.message,"Private browser gateway startup failed");
  assert.equal(error.message.includes("PRIVATE_SERVER_DETAIL"),false);return true;
 });
 await flush();assert.equal(session.closeCalls(),1);timer.advance(5);await rejected;
 assert.equal(server.forced(),1);held.resolve();await flush();
});
test("invalid deadline configuration is rejected before a session is created",async()=>{
 let calls=0;
 for(const options of [{commandTimeoutMs:8001},{shutdownTimeoutMs:0},{timers:{}}])
  await assert.rejects(createPrivateBrowserGateway(null,{sessionFactory:async()=>{calls++;},...options}),/configuration/);
 assert.equal(calls,0);
});
test("mock ingress proxy preserves known refusal metadata and old recognizable error",async()=>{
 const timer=clock();let calls=0,closed=0;
 const gateway={url:"http://127.0.0.1:43111",accessKey:"fixture-key",close(){closed++;}};
 const proxy=createGatewayCommandProxy(gateway,{timers:timer.timers,request:async(url,options)=>{
  calls++;assert.equal(url,gateway.url+"/command");assert.equal(options.method,"POST");
  return calls===1?upstream({...expectedFailure("CONTROLLER_COMMAND_REJECTED",false,false),error:"PRIVATE_UPSTREAM"}):
   upstream({sequence:1},true);
 }});
 const failed=await proxy.execute({type:"back"});
 assert.deepEqual(failed.body,expectedFailure("CONTROLLER_COMMAND_REJECTED",false,false,"Navigation refused"));
 assert.equal((await proxy.execute({type:"back"})).status,200);assert.equal(closed,0);
});
test("mock ingress proxy timeout aborts its request and stops the gateway before future commands",async()=>{
 const timer=clock(),held=deferred();let calls=0,closed=0,signal;
 const gateway={url:"http://127.0.0.1:43111",accessKey:"fixture-key",close(){closed++;}};
 const proxy=createGatewayCommandProxy(gateway,{timers:timer.timers,requestTimeoutMs:5,request:async(url,options)=>{
  calls++;signal=options.signal;return held.promise;
 }});
 const result=proxy.execute({type:"back"});timer.advance(5);
 const failed=await result;
 assert.deepEqual(failed.body,expectedFailure("GATEWAY_COMMAND_TIMEOUT",null,true,"Navigation refused"));
 assert.equal(signal.aborted,true);assert.equal(closed,1);assert.equal(proxy.isStopped(),true);
 assert.equal((await proxy.execute({type:"back"})).body.code,"GATEWAY_CLOSED");assert.equal(calls,1);
 held.resolve(upstream({sequence:9},true));await flush();assert.equal(closed,1);
});
test("mock ingress preserves an ambiguous controller code and invalidates its gateway",async()=>{
 const timer=clock();let closed=0;
 const proxy=createGatewayCommandProxy({url:"http://127.0.0.1:43111",accessKey:"fixture-key",close(){closed++;}},
  {timers:timer.timers,request:async()=>upstream({...expectedFailure("CONTROLLER_CLOSED_IN_FLIGHT",true,true),error:"PRIVATE_DETAIL"})});
 const response=await proxy.execute({type:"back"});
 assert.deepEqual(response.body,expectedFailure("CONTROLLER_CLOSED_IN_FLIGHT",true,true,"Navigation refused"));
 assert.equal(proxy.isStopped(),true);assert.equal(closed,1);
});
test("mock ingress proxy distrusts contradictory upstream success and failure shapes",async()=>{
 for(const response of [
  upstream({...expectedFailure("CONTROLLER_OPERATION_FAILED",true,true),retrySafe:true,error:"PRIVATE_DATA"}),
  {ok:false,text:async()=>"<html>PRIVATE_DETAIL</html>"},
  upstream({error:"PRIVATE_DETAIL"},true)
 ]){
  const timer=clock();let closed=0;
  const proxy=createGatewayCommandProxy({url:"http://127.0.0.1:43111",accessKey:"fixture-key",close(){closed++;}},
   {timers:timer.timers,request:async()=>response});
  const result=await proxy.execute({type:"back"});
  assert.equal(result.body.outcomeUnknown,true);assert.equal(result.body.retrySafe,false);
  assert.equal(JSON.stringify(result.body).includes("PRIVATE"),false);assert.equal(closed,1);
 }
});
test("mock ingress proxy cannot revive a late successful response after stop",async()=>{
 const timer=clock(),held=deferred();let closed=0;
 const proxy=createGatewayCommandProxy({url:"http://127.0.0.1:43111",accessKey:"fixture-key",close(){closed++;}},
  {timers:timer.timers,request:async()=>held.promise});
 const result=proxy.execute({type:"back"});await proxy.stop();
 held.resolve(upstream({sequence:1},true));
 const response=await result;assert.equal(response.status,400);assert.equal(response.body.outcomeUnknown,true);
 assert.equal(closed,1);
});
test("proxy invalidation runs once despite a bad clock and reentrant stop",async()=>{
 let proxy,again,closed=0;
 const late=deferred();
 const gateway={url:"http://127.0.0.1:43111",accessKey:"fixture-key",close(){
  closed++;again=proxy.stop();return late.promise;
 }};
 proxy=createGatewayCommandProxy(gateway,{request:async()=>upstream({sequence:1},true),
  timers:{now:()=>NaN,setTimer:()=>1,clearTimer:()=>{}}});
 const stopped=proxy.stop();assert.equal(again,stopped);assert.equal(closed,1);
 assert.equal((await stopped).shutdownStatus,"timed-out");
 late.reject(Error("PRIVATE_LATE_CLOSE"));await flush();
 assert.equal(proxy.stop(),stopped);assert.equal(closed,1);
});
