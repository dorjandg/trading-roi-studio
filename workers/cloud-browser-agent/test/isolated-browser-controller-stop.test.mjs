// Offline fake sessions only. No browser, network listener, files or processes.
import test from "node:test";
import assert from "node:assert/strict";
import {createIsolatedBrowserController} from "../simulation/isolated-browser-controller.mjs";
import {createLocalControllerAuth} from "../simulation/local-controller-auth.mjs";

function deferred(){
 let resolve,reject;
 const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail;});
 return {promise,resolve,reject};
}
function fakeSession(onCall=async()=>{}){
 const calls=[];
 let sequence=0;
 async function apply(type,value){
  calls.push(value===undefined?[type]:[type,value]);
  await onCall(type,value);
  sequence++;
 }
 return {calls,session:{state:()=>({sequence}),
  search:term=>apply("search",term),click:href=>apply("click",href),
  back:()=>apply("back"),switchTab:name=>apply("switch-tab",name),
  navigate:index=>apply("navigate-fixture",index)}};
}
const stopped=(dispatched)=>error=>{
 assert.equal(error.code,dispatched?"CONTROLLER_CLOSED_IN_FLIGHT":"CONTROLLER_CLOSED");
 assert.equal(error.dispatched,dispatched);
 assert.equal(error.outcomeUnknown,dispatched);
 assert.equal(error.retrySafe,false);
 return true;
};

test("close before scheduled dispatch never calls the adapter",async()=>{
 const {session,calls}=fakeSession(),c=createIsolatedBrowserController(session);
 const result=c.execute(c.issueControlGrant(),{type:"back"});
 const status=c.close();
 await assert.rejects(result,stopped(false));
 assert.deepEqual(calls,[]);
 assert.deepEqual(c.audit(),[]);
 assert.equal(status.cancelledPending,1);
 assert.equal(status.controllerDrained,true);
 assert.equal(status.adapterCancellationRequested,false);
});

test("close rejects queued work immediately and reports an active outcome as unknown",async()=>{
 const started=deferred(),release=deferred();
 const {session,calls}=fakeSession(async(type)=>{
  if(type==="search"){started.resolve();await release.promise;}
 });
 const c=createIsolatedBrowserController(session);
 const active=c.execute(c.issueControlGrant(),{type:"search",term:"fixture"});
 const activeRejected=assert.rejects(active,stopped(true));
 await started.promise;
 const queued=c.execute(c.issueControlGrant(),{type:"back"});
 const queuedRejected=assert.rejects(queued,stopped(false));
 try{
  const status=c.close();
  assert.equal(status.cancelledPending,1);
  assert.equal(status.controllerDrained,false);
  assert.equal(status.activeOutcome,"unknown");
  assert.equal(status.adapterCancellationRequested,false);
  await queuedRejected;
  assert.deepEqual(calls,[["search","fixture"]]);
 }finally{release.resolve();}
 await activeRejected;
 assert.deepEqual(calls,[["search","fixture"]]);
 assert.equal(session.state().sequence,1,"close must not pretend it rolled back the adapter");
 assert.deepEqual(c.audit(),[],"no successful receipt is emitted after close");
 assert.equal(c.close().controllerDrained,true);
});

test("queued commands use immutable scalar snapshots",async()=>{
 const started=deferred(),release=deferred();
 const {session,calls}=fakeSession(async(type,value)=>{
  if(type==="search"&&value==="first"){started.resolve();await release.promise;}
 });
 const c=createIsolatedBrowserController(session);
 const first=c.execute(c.issueControlGrant(),{type:"search",term:"first"});
 await started.promise;
 const command={type:"search",term:"original"};
 const second=c.execute(c.issueControlGrant(),command);
 command.term="mutated";
 release.resolve();
 await Promise.all([first,second]);
 assert.deepEqual(calls,[["search","first"],["search","original"]]);
 assert.deepEqual(c.audit().map(x=>x.type),["search","search"]);
 c.close();
});

test("grants that expire in the queue never dispatch",async()=>{
 let now=100000;
 const auth=createLocalControllerAuth({secret:Buffer.alloc(32,7),now:()=>now});
 const started=deferred(),release=deferred();
 const {session,calls}=fakeSession(async(type)=>{
  if(type==="search"){started.resolve();await release.promise;}
 });
 const c=createIsolatedBrowserController(session,{auth});
 const first=c.execute(c.issueControlGrant(),{type:"search",term:"first"});
 await started.promise;
 const queued=c.execute(c.issueControlGrant(),{type:"back"});
 const rejected=assert.rejects(queued,/expired before dispatch/);
 now+=30001;
 release.resolve();
 await Promise.all([first,rejected]);
 assert.deepEqual(calls,[["search","first"]]);
 assert.equal(c.audit().length,1);
 c.close();
});

test("pending work is bounded and queue overflow does not consume its grant",async()=>{
 const started=deferred(),release=deferred();
 const {session,calls}=fakeSession(async(type)=>{
  if(type==="search"){started.resolve();await release.promise;}
 });
 const c=createIsolatedBrowserController(session,{maxPendingCommands:1});
 const first=c.execute(c.issueControlGrant(),{type:"search",term:"first"});
 await started.promise;
 const second=c.execute(c.issueControlGrant(),{type:"back"});
 const overflowGrant=c.issueControlGrant();
 try{
  await assert.rejects(c.execute(overflowGrant,{type:"back"}),/queue full/);
  assert.deepEqual(calls,[["search","first"]]);
 }finally{release.resolve();}
 await Promise.all([first,second]);
 await c.execute(overflowGrant,{type:"back"});
 assert.deepEqual(calls,[["search","first"],["back"],["back"]]);
 c.close();
});

test("malformed, accessor, inherited and oversized commands fail before adapter dispatch",async()=>{
 const {session,calls}=fakeSession(),c=createIsolatedBrowserController(session);
 let getterCalls=0;
 const accessor={type:"search",get term(){getterCalls++;return "fixture";}};
 const nonEnumerable={};Object.defineProperty(nonEnumerable,"type",{value:"back"});
 const commands=[null,[],Object.create({type:"back"}),accessor,nonEnumerable,
  {type:"back",[Symbol("extra")]:true},{type:"back",extra:true},
  {type:"search",term:"a".repeat(81)},{type:"search",term:"a\u0000b"},
  {type:"click",href:"a".repeat(2049)},{type:"switch-tab",name:"a".repeat(65)},
  {type:"navigate-fixture",index:-1},{type:"navigate-fixture",index:Number.MAX_SAFE_INTEGER+1},
  {type:"navigate-fixture",index:"2"},{type:"upload",file:"a"}];
 for(const command of commands)
  await assert.rejects(c.execute(c.issueControlGrant(),command),/Command refused/);
 assert.equal(getterCalls,0);
 assert.deepEqual(calls,[]);
 c.close();
});

test("existing command names, return values and audit shape remain compatible",async()=>{
 const {session,calls}=fakeSession(),c=createIsolatedBrowserController(session);
 const commands=[{type:"search",term:"James Webb"},
  {type:"click",href:"https://en.wikipedia.org/wiki/Main_Page"},
  {type:"back"},{type:"switch-tab",name:"youtube"},{type:"navigate-fixture",index:2}];
 for(let index=0;index<commands.length;index++)
  assert.equal((await c.execute(c.issueControlGrant(),commands[index])).sequence,index+1);
 assert.equal(c.read(c.issueReadGrant()).sequence,5);
 assert.deepEqual(calls,[["search","James Webb"],["click","https://en.wikipedia.org/wiki/Main_Page"],
  ["back"],["switch-tab","youtube"],["navigate-fixture",2]]);
 assert.deepEqual(c.audit().map(x=>Object.keys(x).sort()),Array.from({length:5},()=>["at","sequence","type"]));
 c.close();
});

test("a rejected adapter operation does not block later queued commands",async()=>{
 const {session,calls}=fakeSession(async(type)=>{if(type==="search")throw Error("fixture failure");});
 const c=createIsolatedBrowserController(session);
 const failed=assert.rejects(c.execute(c.issueControlGrant(),{type:"search",term:"fixture"}),/fixture failure/);
 const next=c.execute(c.issueControlGrant(),{type:"back"});
 await failed;
 assert.equal((await next).sequence,1);
 assert.deepEqual(calls,[["search","fixture"],["back"]]);
 assert.deepEqual(c.audit().map(x=>x.type),["back"]);
 c.close();
});

test("close is permanent and idempotent, including grant issuance",async()=>{
 const {session,calls}=fakeSession(),c=createIsolatedBrowserController(session);
 const read=c.issueReadGrant(),control=c.issueControlGrant();
 assert.equal(c.close().controllerDrained,true);
 assert.equal(c.close().cancelledPending,0);
 assert.throws(()=>c.issueReadGrant(),/Unauthorized/);
 assert.throws(()=>c.issueControlGrant(),/Unauthorized/);
 assert.throws(()=>c.read(read),/Unauthorized/);
 await assert.rejects(c.execute(control,{type:"back"}),/Unauthorized/);
 assert.deepEqual(calls,[]);
});

test("dispatch checks invalidation again after the trusted auth callback",async()=>{
 const underlying=createLocalControllerAuth();
 let c,controlChecks=0;
 const auth={issue:options=>underlying.issue(options),verify(token,scope,options){
  const valid=underlying.verify(token,scope,options);
  if(scope==="viewer:control"&&++controlChecks===3)c.close();
  return valid;
 }};
 const {session,calls}=fakeSession();
 c=createIsolatedBrowserController(session,{auth});
 await assert.rejects(c.execute(c.issueControlGrant(),{type:"back"}),stopped(false));
 assert.deepEqual(calls,[]);
});

test("close inside an already dispatched adapter call never emits a successful receipt",async()=>{
 let c;
 const {session,calls}=fakeSession(async()=>{c.close();});
 c=createIsolatedBrowserController(session);
 await assert.rejects(c.execute(c.issueControlGrant(),{type:"back"}),stopped(true));
 assert.deepEqual(calls,[["back"]]);
 assert.equal(session.state().sequence,1);
 assert.deepEqual(c.audit(),[]);
});

test("invalid queue configuration and absent optional adapter methods fail closed",async()=>{
 const {session,calls}=fakeSession();
 for(const maxPendingCommands of [0,-1,257,1.5,Infinity,"32"])
  assert.throws(()=>createIsolatedBrowserController(session,{maxPendingCommands}),/Invalid pending/);
 assert.throws(()=>createIsolatedBrowserController(session,{auth:{}}),/authentication required/);
 delete session.switchTab;delete session.navigate;
 const c=createIsolatedBrowserController(session);
 await assert.rejects(c.execute(c.issueControlGrant(),{type:"switch-tab",name:"youtube"}),/Command refused/);
 await assert.rejects(c.execute(c.issueControlGrant(),{type:"navigate-fixture",index:1}),/Command refused/);
 assert.deepEqual(calls,[]);
 c.close();
});
