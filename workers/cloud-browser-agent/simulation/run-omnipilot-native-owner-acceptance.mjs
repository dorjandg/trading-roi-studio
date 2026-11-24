// Owner-only acceptance controller for reviewed commit 1fc3208b. No import-time
// execution, production API change, profile access, real bearer or tunnel action.
import {spawn} from 'node:child_process';
import {createServer,createConnection} from 'node:net';
import {createSocket} from 'node:dgram';
import {request} from 'node:http';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,readlinkSync,lstatSync,statSync,fstatSync,openSync,closeSync,mkdtempSync,
  writeFileSync,chmodSync,rmSync,constants} from 'node:fs';
import {dirname,basename,isAbsolute,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const SELF=fileURLToPath(import.meta.url),CLEAN_ENV=Object.freeze({PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8'});
const REVIEWED_COMMIT='1fc3208b7e5a3ea4a9a97c1f993d0f32037d661a';
const PINS=Object.freeze({
  'omnipilot-native-runtime.mjs':'e2f98ef7d37f5b42e2e0011813c5de44a26a5fa440ca56494cd33e7843946e7a',
  'omnipilot-native-child.mjs':'272f716c1fc15ff33d6792d866e79e72df4fa81190fbbf53fcf15e789da9ae4b',
  'omnipilot-native-channel.mjs':'b9f0cf3c5386a86f55a973e5d0ee78506bd4c652745b1736f6c403c2ab8e7345',
  'omnipilot-tunnel-mcp.mjs':'433639d34bf5240d903e574a4539ff865aac9e72aecbf19bd466a7a206c698da',
  'omnipilot-generic-browser.mjs':'ef9b6e0e3495858f94a1350972443cf55597e4b8439b80bba5ccc3c939dd554f',
  'omnipilot-public-connect-proxy.mjs':'905ba005091c0cb13c360234b4ff5f8a85ec03cdc6dbd3ec3205250d6f904ee6',
  'access-trusted-ingress.mjs':'752f11d639252a2693f3dc2b1dd3b42a60dc9f655501ae28a0961f08ed1d43fe',
  'access-assertion-verifier.mjs':'cb12341aad48415b8e9eca537ae91b5dd8a7620c92d58630ad85cc50dacb53c7',
});
const error=code=>Object.assign(Error(code),{code});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});promise.catch(()=>{});return {promise,resolve,reject};}
function safePath(path){
  if(typeof path!=='string'||!isAbsolute(path)||resolve(path)!==path||path.length>512||!/^\/[A-Za-z0-9/._-]+$/.test(path))throw error('ACCEPTANCE_PATH_REFUSED');
  const leaf=lstatSync(path);if(leaf.isSymbolicLink()||![0,process.getuid()].includes(leaf.uid)||(leaf.mode&0o022)!==0)throw error('ACCEPTANCE_PATH_REFUSED');
  for(let parent=dirname(path);;parent=dirname(parent)){
    const stat=lstatSync(parent);
    if(!stat.isDirectory()||stat.isSymbolicLink()||![0,process.getuid()].includes(stat.uid)||
      (stat.mode&0o022)!==0&&(stat.mode&0o1000)===0)throw error('ACCEPTANCE_PATH_REFUSED');
    if(dirname(parent)===parent)break;
  }
  return leaf;
}
function verifyRuntime(runtimeModule){
  if(basename(runtimeModule)!=='omnipilot-native-runtime.mjs')throw error('ACCEPTANCE_SOURCE_REFUSED');
  for(const [name,digest] of Object.entries(PINS)){
    const path=dirname(runtimeModule)+'/'+name,stat=safePath(path);
    if(!stat.isFile()||stat.size>300000||createHash('sha256').update(readFileSync(path)).digest('hex')!==digest)
      throw error('ACCEPTANCE_SOURCE_REFUSED');
  }
}
export function parseIdentity(stat,status){
  if(typeof stat!=='string'||stat.length>8192||typeof status!=='string'||status.length>32768)throw error('ACCEPTANCE_IDENTITY_REFUSED');
  const match=/^([1-9][0-9]*) \(.+\) ([\s\S]+)$/.exec(stat.trim());
  const uid=/^Uid:\s+([0-9 \t]+)$/m.exec(status),ns=/^NSpid:\s+([0-9 \t]+)$/m.exec(status);
  if(!match||!uid||!ns)throw error('ACCEPTANCE_IDENTITY_REFUSED');
  const fields=match[2].split(' ');if(!/^\d+$/.test(fields[1]??'')||!/^\d+$/.test(fields[19]??''))throw error('ACCEPTANCE_IDENTITY_REFUSED');
  return {pid:Number(match[1]),ppid:Number(fields[1]),start:fields[19],state:fields[0],
    uid:Number(uid[1].trim().split(/\s+/)[0]),innerPid:Number(ns[1].trim().split(/\s+/).at(-1))};
}
function identity(pid){
  if(!Number.isSafeInteger(pid)||pid<1)throw error('ACCEPTANCE_IDENTITY_REFUSED');
  return parseIdentity(readFileSync('/proc/'+pid+'/stat','utf8'),readFileSync('/proc/'+pid+'/status','utf8'));
}
function currentState(owned){
  try{const value=identity(owned.pid);if(value.start!==owned.start||value.uid!==owned.uid)return 'reused';
    return value.state==='Z'?'zombie':'alive';}
  catch(cause){return ['ENOENT','ESRCH'].includes(cause.code)?'gone':'unknown';}
}
const inactive=state=>['gone','reused','zombie'].includes(state);
export function matchesOwnedSignalTarget(owned,current,ns){
  if(!owned?.ns||current?.pid!==owned.pid||current.start!==owned.start||current.uid!==owned.uid||
    current.ppid!==owned.ppid||['Z','X','x'].includes(current.state))return false;
  return ['user','pid','mnt','net','ipc','uts','time'].every(name=>typeof owned.ns[name]==='string'&&
    (ns?.[name]===owned.ns[name]||typeof owned.allowedNs?.[name]==='string'&&ns?.[name]===owned.allowedNs[name]));
}
function killOwned(owned){
  // An observed direct ownership chain and start identity are required. This
  // does not claim pidfd fencing against a hostile same-UID host actor.
  try{
    const now=identity(owned.pid),ns=namespaceIds(owned.pid);
    if(!matchesOwnedSignalTarget(owned,now,ns))return false;
    process.kill(owned.pid,'SIGKILL');return true;
  }catch{return false;}
}
function childIds(pid){
  const raw=readFileSync('/proc/'+pid+'/task/'+pid+'/children','utf8');
  if(raw.length>4096||!/^\s*(?:[1-9][0-9]*\s*)*$/.test(raw))throw error('ACCEPTANCE_LINEAGE_REFUSED');
  const ids=raw.trim()?raw.trim().split(/\s+/).map(Number):[];
  if(ids.length>128)throw error('ACCEPTANCE_LINEAGE_REFUSED');return ids;
}
function direct(parent){
  return childIds(parent.pid).flatMap(pid=>{try{const value=identity(pid);
    return value.ppid===parent.pid&&value.uid===parent.uid?[value]:[];
  }catch(cause){if(['ENOENT','ESRCH'].includes(cause.code))return[];throw cause;}});
}
const namespaceIds=pid=>Object.fromEntries(['user','pid','mnt','net','ipc','uts','time'].map(name=>[name,readlinkSync('/proc/'+pid+'/ns/'+name)]));
function captureOwnership(installation,url){
  const owner={...identity(process.pid),ns:namespaceIds(process.pid)},children=direct(owner);if(children.length!==1)throw error('ACCEPTANCE_LINEAGE_REFUSED');
  const wrapper={...children[0],ns:namespaceIds(children[0].pid)},raw=readFileSync('/proc/'+wrapper.pid+'/cmdline');
  if(raw.length>32768)throw error('ACCEPTANCE_LINEAGE_REFUSED');
  const args=raw.toString('utf8').split('\0').filter(Boolean);if(args[0]!=='/usr/bin/bwrap')throw error('ACCEPTANCE_LINEAGE_REFUSED');
  const candidates=direct(wrapper).filter(item=>item.innerPid===1);if(candidates.length!==1)throw error('ACCEPTANCE_LINEAGE_REFUSED');
  const init={...candidates[0],ns:namespaceIds(candidates[0].pid)},ns=init.ns,ownerNs=owner.ns;
  for(const name of Object.keys(ns))if(name==='time'?ns[name]!==ownerNs[name]:ns[name]===ownerNs[name])throw error('ACCEPTANCE_NAMESPACE_REFUSED');
  const node=statSync(installation.node),drivers=direct(init).filter(item=>{
    if(item.innerPid!==2)return false;
    const exe=statSync('/proc/'+item.pid+'/exe');return exe.dev===node.dev&&exe.ino===node.ino;
  });
  if(drivers.length!==1)throw error('ACCEPTANCE_LINEAGE_REFUSED');
  const driver={...drivers[0],ns:namespaceIds(drivers[0].pid)};if(JSON.stringify(driver.ns)!==JSON.stringify(ns))throw error('ACCEPTANCE_NAMESPACE_REFUSED');
  const mounts=new Map();for(let i=0;i<args.length-2;i++)if(args[i]==='--ro-bind')mounts.set(args[i+2],args[i+1]);
  const broker=mounts.get('/run/omnipilot/broker.sock'),control=mounts.get('/run/omnipilot/control.sock');
  const stage=broker&&dirname(dirname(broker));
  if(!/^\/tmp\/omnipilot-native-[A-Za-z0-9]{6}$/.test(stage??'')||broker!==stage+'/broker/egress.sock'||
    control!==stage+'/control/commands.sock')throw error('ACCEPTANCE_SOCKET_REFUSED');
  const stat=safePath(stage);if(!stat.isDirectory()||(stat.mode&0o777)!==0o700||stat.uid!==owner.uid)throw error('ACCEPTANCE_SOCKET_REFUSED');
  for(const path of [broker,control]){const socket=safePath(path);if(!socket.isSocket()||(socket.mode&0o777)!==0o600)throw error('ACCEPTANCE_SOCKET_REFUSED');}
  const captured=[init],queue=[init];
  while(queue.length){for(const item of direct(queue.shift())){captured.push(item);queue.push(item);if(captured.length>128)throw error('ACCEPTANCE_LINEAGE_REFUSED');}}
  return {owner,wrapper,init,driver,namespaces:ns,hostNamespaces:ownerNs,captured,
    sockets:{broker,control,mcp:url},stage:{path:stage,dev:stat.dev,ino:stat.ino,uid:stat.uid}};
}
function validateOwnership(value,ownerPid){
  if(value?.owner?.pid!==ownerPid||value.owner.ppid!==process.pid)throw error('ACCEPTANCE_LINEAGE_REFUSED');
  for(const item of [value.owner,value.wrapper,value.init,value.driver]){
    const now=identity(item.pid);if(now.start!==item.start||now.uid!==process.getuid()||now.ppid!==item.ppid||['Z','X','x'].includes(now.state)||
      JSON.stringify(namespaceIds(item.pid))!==JSON.stringify(item.ns))throw error('ACCEPTANCE_IDENTITY_REFUSED');
  }
  if(value.wrapper.ppid!==ownerPid||value.init.ppid!==value.wrapper.pid||value.driver.ppid!==value.init.pid||
    value.init.innerPid!==1||value.driver.innerPid!==2||JSON.stringify(namespaceIds(value.init.pid))!==JSON.stringify(value.namespaces))
    throw error('ACCEPTANCE_LINEAGE_REFUSED');
}
async function socketClosed(address){
  return new Promise(resolve=>{
    const socket=createConnection(address);let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);socket.destroy();resolve(value);};
    const timer=setTimeout(()=>finish(false),250);
    socket.on('connect',()=>finish(false));socket.on('error',cause=>finish(['ECONNREFUSED','ENOENT'].includes(cause.code)));
  });
}
export function canObserveClosedSockets(processes,ownerState,diagnostics){
  if(!inactive(processes?.init)||!inactive(processes?.driver)||!inactive(processes?.wrapper)||processes?.capturedInactive!==true)return false;
  return inactive(ownerState)||diagnostics?.stopped===true&&diagnostics.namespaceInitGone===true&&
    diagnostics.processExitObserved===true&&diagnostics.controlClosed===true&&diagnostics.brokerClosed===true&&
    diagnostics.brokerCloseComplete===true&&diagnostics.cleanupComplete===true&&diagnostics.shutdownTimedOut===false;
}
async function deathEvidence(owned,deadline,observeClosed){
  let value;
  do{
    const init=currentState(owned.init),driver=currentState(owned.driver),wrapper=currentState(owned.wrapper);
    const captured=owned.captured.map(currentState),ownerState=currentState(owned.owner),url=new URL(owned.sockets.mcp);
    value={init,driver,wrapper,capturedCount:captured.length,capturedInactive:captured.every(inactive),
      brokerClosed:false,controlClosed:false,mcpClosed:false,closureObservedBeforeConnect:false};
    const processesInactive=inactive(init)&&inactive(driver)&&inactive(wrapper)&&value.capturedInactive;
    let diagnostics;
    if(processesInactive&&!inactive(ownerState)&&observeClosed&&performance.now()<deadline){
      try{diagnostics=await observeClosed(Math.max(1,Math.min(1000,deadline-performance.now())));}
      catch{return {...value,passed:false,readOnlyDiagnosticsFailed:true};}
    }
    // Replacement control connections are fatal in production. Never use a
    // connection as the event that causes the shutdown we are trying to observe.
    if(canObserveClosedSockets(value,ownerState,diagnostics)&&performance.now()<deadline){
      value.closureObservedBeforeConnect=true;
      const closed=await Promise.all([socketClosed({path:owned.sockets.broker}),socketClosed({path:owned.sockets.control}),
        socketClosed({host:'127.0.0.1',port:Number(url.port)})]);
      value.brokerClosed=closed[0];value.controlClosed=closed[1];value.mcpClosed=closed[2];
      if(closed.every(Boolean)&&performance.now()<deadline)return {...value,passed:true};
    }
    await delay(25);
  }while(performance.now()<deadline);
  return {...value,passed:false};
}
function removeOwnedStage(owned,evidence){
  const incomplete={complete:false,removedByAcceptanceObserver:false,alreadyAbsent:false};
  if(!evidence.passed)return incomplete;
  try{const stat=lstatSync(owned.stage.path);
    if(stat.dev!==owned.stage.dev||stat.ino!==owned.stage.ino||stat.uid!==owned.stage.uid||!stat.isDirectory()||stat.isSymbolicLink())return incomplete;
    rmSync(owned.stage.path,{recursive:true});return {complete:true,removedByAcceptanceObserver:true,alreadyAbsent:false};
  }catch(cause){return cause.code==='ENOENT'?{complete:true,removedByAcceptanceObserver:false,alreadyAbsent:true}:incomplete;}
}

async function helperSend(value){
  if(!process.connected||Buffer.byteLength(JSON.stringify(value))>32768)throw error('ACCEPTANCE_IPC_REFUSED');
  await new Promise((resolve,reject)=>{
    const deadline=performance.now()+1000,timer=setTimeout(()=>reject(error('ACCEPTANCE_IPC_REFUSED')),1000);
    process.send(value,cause=>{clearTimeout(timer);cause||performance.now()>=deadline?reject(error('ACCEPTANCE_IPC_REFUSED')):resolve();});
  });
}
async function mcpCommand(runtime,token,command,id){
  const url=new URL(runtime.url),body=Buffer.from(JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',
    params:{name:'omnipilot_browser',arguments:{command}}}));
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.pathname!=='/mcp')throw error('ACCEPTANCE_URL_REFUSED');
  return new Promise((resolve,reject)=>{
    let req,done=false;const deadline=performance.now()+12000;
    const finish=(cause,value)=>{if(done)return;done=true;clearTimeout(timer);if(cause)req?.destroy();
      cause?reject(error('ACCEPTANCE_COMMAND_UNCERTAIN')):resolve(value);};
    const timer=setTimeout(()=>finish(true),12000);
    req=request({host:'127.0.0.1',port:url.port,path:'/mcp',method:'POST',agent:false,
      headers:{authorization:'Bearer '+token,'content-type':'application/json','content-length':body.length}},res=>{
      const chunks=[];let size=0;res.on('data',part=>{size+=part.length;if(size>3000000||performance.now()>=deadline)finish(true);else chunks.push(part);});
      res.on('error',()=>finish(true));res.on('end',()=>{try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(res.statusCode!==200||value.jsonrpc!=='2.0'||value.id!==id||value.result?.isError!==false||performance.now()>=deadline)throw Error();
        finish(false,value.result);
      }catch{finish(true);}});
    });
    req.on('error',()=>finish(true));req.end(body);
  });
}
async function ownedHelper(runtimeModule,installation){
  verifyRuntime(runtimeModule);let runtime,closing=false,busy=false,lastId=0;
  const token=randomBytes(32).toString('base64url');
  async function close(){
    if(closing)return;closing=true;
    const timer=setTimeout(()=>process.exit(1),2500);
    try{await runtime?.close();}finally{clearTimeout(timer);process.exit(0);}
  }
  process.on('disconnect',()=>void close());process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
  if(!process.connected)throw error('ACCEPTANCE_IPC_REFUSED');
  setTimeout(()=>void close(),90000).unref();
  const {createNativeOmniPilotRuntime}=await import(pathToFileURL(runtimeModule));
  runtime=await createNativeOmniPilotRuntime({installation,bearerToken:token});if(closing){await runtime.close();return;}
  const ownership=captureOwnership(installation,runtime.url);
  process.on('message',message=>{void(async()=>{
    if(!message||Object.keys(message).sort().join(',')!=='id,kind'||!Number.isSafeInteger(message.id)||message.id!==lastId+1||busy||closing)throw Error();
    lastId=message.id;busy=true;
    try{
      if(message.kind==='public-check'){
        const status=await mcpCommand(runtime,token,{op:'status'},1),tabId=status.structuredContent.data.selectedTabId;
        await mcpCommand(runtime,token,{op:'navigate',tabId,url:'https://example.com/',timeoutMs:15000},2);
        const tabs=await mcpCommand(runtime,token,{op:'tabs.list'},3);
        const snapshot=await mcpCommand(runtime,token,{op:'snapshot',tabId,maxChars:2000},4);
        const picture=await mcpCommand(runtime,token,{op:'screenshot',tabId,width:640,height:360},5);
        const png=picture.content.find(block=>block.type==='image'),image=png&&Buffer.from(png.data,'base64');
        if(!tabs.structuredContent.data.tabs.some(tab=>tab.id===tabId&&tab.origin==='https://example.com')||
          !snapshot.structuredContent.data.text.includes('Example Domain')||!image||image.length>2000000||
          image.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error();
        await helperSend({kind:'result',id:message.id,value:{passed:true,origin:'https://example.com',expectedHeadingSeen:true,
          screenshotBytes:image.length,screenshotSha256:createHash('sha256').update(image).digest('hex'),
          redactionComplete:false,tlsValidationConfigured:true,negativeCertificateTest:false,diagnostics:runtime.diagnostics()}});
      }else if(message.kind==='diagnostics'){
        await helperSend({kind:'result',id:message.id,value:runtime.diagnostics()});
      }else if(message.kind==='close'){
        const receipt=await runtime.close();await helperSend({kind:'result',id:message.id,value:receipt});void close();
      }else throw Error();
    }finally{busy=false;}
  })().catch(async()=>{void runtime?.close();try{await helperSend({kind:'failed',code:'ACCEPTANCE_HELPER_UNCERTAIN'});}catch{}void close();});});
  await helperSend({kind:'ready',ownership,diagnostics:runtime.diagnostics()});
}

async function startSession(runtimeModule,installation,hostMarker,onCreated){
  verifyRuntime(runtimeModule);const started=deferred(),pending=new Map();
  let nextId=1,owned=null,readyDiagnostics=null,bytes=0,exited=false,poisoned=false,cleanupPromise;
  const deadline=performance.now()+35000;
  const child=spawn(process.execPath,[SELF,'--owned-helper',runtimeModule,installation.node,installation.chromium,installation.playwrightCore],
    {env:{...CLEAN_ENV,OMNIPILOT_ACCEPTANCE_HOST_ONLY:hostMarker},stdio:['ignore','pipe','pipe','ipc']});
  child.on('error',()=>started.reject(error('ACCEPTANCE_OWNER_FAILED')));
  let owner;
  try{owner={...identity(child.pid),ns:namespaceIds(child.pid)};
    if(owner.ppid!==process.pid||owner.uid!==process.getuid())throw Error();
  }catch{try{child.disconnect();}catch{}throw error('ACCEPTANCE_OWNER_REFUSED');}
  function failSession(code){
    poisoned=true;killOwned(owner);started.reject(error(code));
    for(const value of pending.values()){clearTimeout(value.timer);value.reject(error(code));}pending.clear();
  }
  const startupTimer=setTimeout(()=>failSession('ACCEPTANCE_START_TIMEOUT'),35000);
  child.on('exit',()=>{exited=true;clearTimeout(startupTimer);started.reject(error('ACCEPTANCE_OWNER_EXITED'));
    for(const value of pending.values()){clearTimeout(value.timer);value.reject(error('ACCEPTANCE_OWNER_EXITED'));}pending.clear();});
  for(const stream of [child.stdout,child.stderr])stream.on('data',part=>{bytes+=part.length;if(bytes>16384)failSession('ACCEPTANCE_OUTPUT_LIMIT');});
  child.on('message',message=>{
    try{
      if(poisoned||Buffer.byteLength(JSON.stringify(message))>32768)throw Error();
      if(message.kind==='ready'&&!owned){
        if(performance.now()>=deadline)throw Error();validateOwnership(message.ownership,child.pid);
        owned=message.ownership;readyDiagnostics=message.diagnostics;clearTimeout(startupTimer);started.resolve();return;
      }
      if(message.kind==='failed')throw Error();
      const value=message.kind==='result'&&pending.get(message.id);
      if(!value||performance.now()>=value.deadline)throw Error();
      pending.delete(message.id);clearTimeout(value.timer);value.resolve(message.value);
    }catch{failSession('ACCEPTANCE_IPC_REFUSED');}
  });
  function ask(kind,timeoutMs=20000){
    return new Promise((resolve,reject)=>{
      if(poisoned||exited||!child.connected||pending.size)return reject(error('ACCEPTANCE_OWNER_UNAVAILABLE'));
      const id=nextId++,requestDeadline=performance.now()+timeoutMs;
      const timer=setTimeout(()=>failSession('ACCEPTANCE_HELPER_TIMEOUT'),timeoutMs);
      pending.set(id,{resolve,reject,timer,deadline:requestDeadline});
      child.send({kind,id},cause=>{if(cause)failSession('ACCEPTANCE_IPC_REFUSED');});
    });
  }
  function cleanup(){
    if(cleanupPromise)return cleanupPromise;
    cleanupPromise=(async()=>{
      let receipt=null,closeRequested=false;
      if(!poisoned&&!exited&&child.connected){closeRequested=true;try{receipt=await ask('close',2500);}catch{}}
      if(!exited){await delay(25);if(!exited)killOwned(owner);}
      if(!owned)return {passed:false,ownershipUnobserved:true,ownerState:currentState(owner)};
      const observe=timeout=>receipt?Promise.resolve(receipt):ask('diagnostics',timeout);
      let evidence=await deathEvidence(owned,performance.now()+2500,observe),forced=false;
      if(!evidence.passed){forced=true;killOwned(owned.init);killOwned(owned.wrapper);killOwned(owned.driver);
        evidence=await deathEvidence(owned,performance.now()+2500,observe);}
      const stageCleanup=removeOwnedStage(owned,evidence),stageRemoved=stageCleanup.complete,receiptVerified=receipt===null?null:
        receipt.namespaceInitGone===true&&receipt.processExitObserved===true&&receipt.controlClosed===true&&
        receipt.brokerCloseComplete===true&&receipt.cleanupComplete===true&&receipt.shutdownTimedOut===false;
      return {...evidence,passed:evidence.passed&&!forced&&stageRemoved&&(!closeRequested||receiptVerified===true),
        containmentComplete:evidence.passed,forcedFallback:forced,stageRemoved,stageCleanup,closeRequested,receiptVerified,
        productionCleanupVerified:receiptVerified===true};
    })();return cleanupPromise;
  }
  const session={child,owner,get owned(){return owned;},get ready(){return readyDiagnostics;},ask,cleanup};
  onCreated(session);
  try{await started.promise;return session;}
  catch(cause){clearTimeout(startupTimer);await cleanup();throw cause;}
}

export const NAMESPACE_PROBE=String.raw`
import {createConnection} from 'node:net';
import {createSocket} from 'node:dgram';
import {readFileSync,readlinkSync,statSync,fstatSync,closeSync} from 'node:fs';
import {networkInterfaces} from 'node:os';
const p=JSON.parse(process.argv[1]);
if(Object.keys(p).sort().join(',')!=='marker,markerPath,net,pid,tcpPort,udpPort'||
 ![p.tcpPort,p.udpPort].every(v=>Number.isInteger(v)&&v>0&&v<65536)||!/^[a-f0-9]{32}$/.test(p.marker)||
 !/^\/tmp\/omnipilot-acceptance-[A-Za-z0-9]{6}\/outside.marker$/.test(p.markerPath))throw Error('PROBE_INPUT_REFUSED');
const ids={net:readlinkSync('/proc/self/ns/net'),pid:readlinkSync('/proc/self/ns/pid')};
if(ids.net!==p.net||ids.pid!==p.pid)throw Error('PROBE_NAMESPACE_REFUSED');
// nsenter may already have closed an inherited descriptor before exec. Do not
// close a number that Node has since reused for its own event-loop resources.
for(const [index,name] of ['user','mnt','net','pid','ipc','uts'].entries()){
 const fd=index+3;let link;
 try{link=readlinkSync('/proc/self/fd/'+fd);}catch(e){if(e.code==='ENOENT')continue;throw e;}
 if(link===readlinkSync('/proc/self/ns/'+name))closeSync(fd);
 else if(/^(?:user|mnt|net|pid|ipc|uts):\[[0-9]+\]$/.test(link))throw Error('PROBE_DESCRIPTOR_REFUSED');
}
try{const fdRoot=fstatSync(9),root=statSync('/');if(fdRoot.isDirectory()){
 if(fdRoot.dev!==root.dev||fdRoot.ino!==root.ino)throw Error('PROBE_DESCRIPTOR_REFUSED');closeSync(9);}}
catch(e){if(e.code!=='EBADF')throw e;}
const allowed=['PATH','HOME','LANG','LC_ALL','TMPDIR'];
if(Object.keys(process.env).some(k=>!allowed.includes(k)))throw Error('PROBE_ENV_REFUSED');
const interfaces=networkInterfaces();
if(Object.keys(interfaces).some(k=>k!=='lo')||!interfaces.lo?.length||interfaces.lo.some(i=>!i.internal||!['127.0.0.1','::1'].includes(i.address)))throw Error('PROBE_NETWORK_REFUSED');
const route4=readFileSync('/proc/net/route','utf8'),route6=readFileSync('/proc/net/ipv6_route','utf8');
if(route4.length>8192||route6.length>8192)throw Error('PROBE_ROUTE_REFUSED');
const routes4=route4.trim().split('\n').slice(1).filter(Boolean).map(line=>line.trim().split(/\s+/)[0]);
const routes6=route6.trim().split('\n').filter(Boolean).map(line=>line.trim().split(/\s+/).at(-1));
if([...routes4,...routes6].some(i=>i!=='lo'))throw Error('PROBE_ROUTE_REFUSED');
let hostMarkerVisible=false;try{statSync(p.markerPath);hostMarkerVisible=true;}catch(e){if(e.code!=='ENOENT')throw e;}
if(hostMarkerVisible)throw Error('PROBE_FILESYSTEM_REFUSED');
const acknowledgement='ack:'+p.marker;
const tcp=await new Promise(resolve=>{const s=createConnection({host:'127.0.0.1',port:p.tcpPort});
 let done=false,connected=false,data='',code='TIMEOUT';
 const finish=hostNonceAcknowledged=>{if(done)return;done=true;clearTimeout(timer);s.destroy();resolve({connected,code,hostNonceAcknowledged});};
 const timer=setTimeout(()=>finish(false),500);
 s.on('connect',()=>{connected=true;code='CONNECTED_NO_ACK';s.write(p.marker,e=>{if(e)finish(false);});});
 s.on('data',part=>{if(data.length+part.length>128)return finish(false);data+=part.toString('utf8');
  if(data===acknowledgement){code='ACKNOWLEDGED';finish(true);}else if(data.length>=acknowledgement.length)finish(false);});
 s.on('end',()=>finish(false));s.on('error',e=>{code=['ECONNREFUSED','ENETUNREACH','EHOSTUNREACH'].includes(e.code)?e.code:'OTHER';finish(false);});});
const udp=await new Promise(resolve=>{const s=createSocket('udp4');let done=false,messages=0,sendResult='PENDING';
 const finish=hostNonceAcknowledged=>{if(done)return;done=true;clearTimeout(timer);try{s.close();}catch{}resolve({sendResult,messages,hostNonceAcknowledged});};
 const timer=setTimeout(()=>finish(false),500);
 s.on('message',(part,remote)=>{messages++;if(messages>8)return finish(false);
  if(remote.address==='127.0.0.1'&&remote.port===p.udpPort&&part.toString('utf8')===acknowledgement)finish(true);});
 s.on('error',()=>{sendResult='ERROR';finish(false);});
 s.send(Buffer.from(p.marker),p.udpPort,'127.0.0.1',e=>{sendResult=e?'ERROR':'RETURNED';if(e)finish(false);});});
process.stdout.write(JSON.stringify({attempts:{tcp:1,udp:1},namespaces:ids,loopbackOnly:true,routeInterfaces:[...new Set([...routes4,...routes6])],
 hostMarkerVisible:false,cleanEnvironment:true,tcp,udp})+'\n');
`;

export function assessCanaries(probe,before,after,expected,positiveControls){
  const keys=['tcpConnections','tcpMarkers','udpMessages','udpMarkers'];
  const countsValid=keys.every(key=>Number.isSafeInteger(before?.[key])&&before[key]>=1&&
    Number.isSafeInteger(after?.[key])&&after[key]===before[key]);
  const valid=positiveControls?.tcpNonceRoundTrip===true&&positiveControls?.udpNonceRoundTrip===true&&
    expected.healthy===true&&countsValid&&probe?.attempts?.tcp===1&&probe?.attempts?.udp===1&&
    probe?.namespaces?.net===expected.net&&probe?.namespaces?.pid===expected.pid&&expected.net!==expected.hostNet&&
    probe.loopbackOnly===true&&Array.isArray(probe.routeInterfaces)&&probe.routeInterfaces.every(value=>value==='lo')&&
    probe.hostMarkerVisible===false&&probe.cleanEnvironment===true&&probe.tcp?.hostNonceAcknowledged===false&&
    probe.udp?.hostNonceAcknowledged===false;
  return {passed:valid,hostTcpObservedDelta:after.tcpConnections-before.tcpConnections,
    hostUdpObservedDelta:after.udpMessages-before.udpMessages,udpSendResult:probe?.udp?.sendResult??'UNKNOWN',
    udpSendResultUsedAsRefusalProof:false,
    scope:'Owned IPv4 loopback nonce canaries, target namespace/interfaces/routes and a bounded observation window; not all possible network channels.'};
}
export function assessDeathAcceptance(evidence,cleanup,signalVerified){
  return signalVerified===true&&evidence?.passed===true&&cleanup?.containmentComplete===true&&
    cleanup.forcedFallback===false&&cleanup.stageRemoved===true&&cleanup.passed===true;
}

async function runNamespaceProbe(owned,ports,markerPath,marker){
  const executable='/usr/bin/nsenter';if(!safePath(executable).isFile())throw error('ACCEPTANCE_NSENTER_UNAVAILABLE');
  const original=identity(owned.init.pid);
  if(currentState(owned.init)!=='alive'||original.ppid!==owned.init.ppid||
    JSON.stringify(namespaceIds(owned.init.pid))!==JSON.stringify(owned.namespaces))throw error('ACCEPTANCE_IDENTITY_REFUSED');
  const fds=[],names=['user','mnt','net','pid','ipc','uts'];
  try{
    for(const name of names){const fd=openSync('/proc/'+owned.init.pid+'/ns/'+name,constants.O_RDONLY);fds.push(fd);
      if(readlinkSync('/proc/self/fd/'+fd)!==owned.namespaces[name])throw error('ACCEPTANCE_IDENTITY_REFUSED');}
    fds.push(openSync('/proc/'+owned.init.pid+'/root',constants.O_RDONLY|constants.O_DIRECTORY));
    const expectedRoot=statSync('/proc/'+owned.init.pid+'/root'),pinnedRoot=fstatSync(fds.at(-1));
    if(expectedRoot.dev!==pinnedRoot.dev||expectedRoot.ino!==pinnedRoot.ino||currentState(owned.init)!=='alive'||
      identity(owned.init.pid).ppid!==owned.init.ppid||JSON.stringify(namespaceIds(owned.init.pid))!==JSON.stringify(owned.namespaces))
      throw error('ACCEPTANCE_IDENTITY_REFUSED');
    const flags=['--user=/proc/self/fd/3','--mount=/proc/self/fd/4','--net=/proc/self/fd/5','--pid=/proc/self/fd/6',
      '--ipc=/proc/self/fd/7','--uts=/proc/self/fd/8','--root=/proc/self/fd/9','--preserve-credentials','--wdns=/home/omnipilot'];
    const args=[...flags,'--','/opt/node/node','--input-type=module','-e',NAMESPACE_PROBE,
      JSON.stringify({tcpPort:ports.tcp,udpPort:ports.udp,marker,markerPath,net:owned.namespaces.net,pid:owned.namespaces.pid})];
    const child=spawn(executable,args,{env:{PATH:'/opt/node',HOME:'/home/omnipilot',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',TMPDIR:'/tmp'},
      cwd:'/',stdio:['ignore','pipe','pipe',...fds]});
    child.on('error',()=>{});
    if(!Number.isSafeInteger(child.pid)||child.pid<1)throw error('ACCEPTANCE_NSENTER_UNAVAILABLE');
    const proc={...identity(child.pid),ns:namespaceIds(child.pid),allowedNs:owned.namespaces};let output=Buffer.alloc(0),errors=0;
    if(proc.ppid!==process.pid||proc.uid!==process.getuid())throw error('ACCEPTANCE_IDENTITY_REFUSED');
    return await new Promise((resolve,reject)=>{
      let done=false;const deadline=performance.now()+2500;
      const finish=(code,value)=>{if(done)return;done=true;clearTimeout(timer);
        if(code){killOwned(proc);reject(error(code));}else resolve(value);};
      const timer=setTimeout(()=>finish('ACCEPTANCE_PROBE_TIMEOUT'),2500);
      child.stdout.on('data',part=>{if(output.length+part.length>8192)finish('ACCEPTANCE_PROBE_OUTPUT');else output=Buffer.concat([output,part]);});
      child.stderr.on('data',part=>{errors+=part.length;if(errors>8192)finish('ACCEPTANCE_PROBE_OUTPUT');});
      child.once('error',()=>finish('ACCEPTANCE_NSENTER_UNAVAILABLE'));
      child.once('close',code=>{
        if(code!==0||performance.now()>=deadline)return finish('ACCEPTANCE_NSENTER_UNAVAILABLE');
        try{finish(null,JSON.parse(output.toString('utf8')));}catch{finish('ACCEPTANCE_PROBE_OUTPUT');}
      });
    });
  }finally{for(const fd of fds)try{closeSync(fd);}catch{}}
}
async function runCanaries(owned,markerPath,marker){
  const counts={tcpConnections:0,tcpMarkers:0,udpMessages:0,udpMarkers:0},clients=new Set();
  const acknowledgement=Buffer.from('ack:'+marker);let healthy=true;
  const server=createServer(socket=>{
    counts.tcpConnections++;clients.add(socket);let data='',acknowledged=false;
    if(clients.size>8){healthy=false;socket.destroy();return;}
    socket.setTimeout(1000,()=>socket.destroy());socket.on('error',()=>{});
    socket.once('close',()=>clients.delete(socket));socket.on('data',part=>{
      if(acknowledged)return;
      if(data.length+part.length>64){socket.destroy();return;}data+=part.toString('utf8');
      if(data===marker){acknowledged=true;counts.tcpMarkers++;socket.end(acknowledgement);}
      else if(data.length>=marker.length)socket.destroy();
    });
  });
  const udp=createSocket('udp4');server.on('error',()=>{healthy=false;});udp.on('error',()=>{healthy=false;});
  udp.on('message',(part,remote)=>{counts.udpMessages++;
    if(remote.address==='127.0.0.1'&&part.toString('utf8')===marker){counts.udpMarkers++;
      udp.send(acknowledgement,remote.port,remote.address,cause=>{if(cause)healthy=false;});}
  });
  async function listen(start,emitter){
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(error('ACCEPTANCE_CANARY_START_FAILED')),1000);
      emitter.once('error',()=>{clearTimeout(timer);reject(error('ACCEPTANCE_CANARY_START_FAILED'));});
      start(()=>{clearTimeout(timer);resolve();});
    });
  }
  async function positiveTcp(port){
    await new Promise((resolve,reject)=>{
      const socket=createConnection({host:'127.0.0.1',port});let done=false,data='';
      const deadline=performance.now()+1000;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timer);socket.destroy();
        ok&&performance.now()<deadline?resolve():reject(error('ACCEPTANCE_CANARY_CONTROL_FAILED'));};
      const timer=setTimeout(()=>finish(false),1000);
      socket.on('connect',()=>socket.write(marker));socket.on('error',()=>finish(false));socket.on('end',()=>finish(false));
      socket.on('data',part=>{if(data.length+part.length>128)return finish(false);data+=part.toString('utf8');
        if(data===acknowledgement.toString())finish(true);else if(data.length>=acknowledgement.length)finish(false);});
    });
  }
  async function positiveUdp(port){
    await new Promise((resolve,reject)=>{
      const socket=createSocket('udp4');let done=false;const deadline=performance.now()+1000;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timer);try{socket.close();}catch{}
        ok&&performance.now()<deadline?resolve():reject(error('ACCEPTANCE_CANARY_CONTROL_FAILED'));};
      const timer=setTimeout(()=>finish(false),1000);socket.on('error',()=>finish(false));
      socket.on('message',(part,remote)=>finish(remote.address==='127.0.0.1'&&remote.port===port&&part.equals(acknowledgement)));
      socket.send(Buffer.from(marker),port,'127.0.0.1',cause=>{if(cause)finish(false);});
    });
  }
  try{
    await listen(callback=>server.listen(0,'127.0.0.1',callback),server);
    await listen(callback=>udp.bind(0,'127.0.0.1',callback),udp);
    const ports={tcp:server.address().port,udp:udp.address().port};
    await positiveTcp(ports.tcp);await positiveUdp(ports.udp);await delay(50);
    const before={...counts},positiveControls={tcpNonceRoundTrip:true,udpNonceRoundTrip:true};
    if(!healthy||Object.values(before).some(value=>value!==1))throw error('ACCEPTANCE_CANARY_CONTROL_FAILED');
    const probe=await runNamespaceProbe(owned,ports,markerPath,marker);await delay(300);
    const report=assessCanaries(probe,before,{...counts},{...owned.namespaces,hostNet:owned.hostNamespaces.net,healthy},positiveControls);
    return {...report,positiveControls,baseline:before,after:{...counts},observationAfterProbeMs:300,probe};
  }finally{
    for(const socket of clients)socket.destroy();try{udp.close();}catch{}
    await Promise.race([new Promise(resolve=>{try{server.close(resolve);}catch{resolve();}}),delay(500)]);
  }
}

export async function runOwnedNativeAcceptance({runtimeModule,installation}){
  verifyRuntime(runtimeModule);safePath(SELF);
  const marker=randomBytes(16).toString('hex'),directory=mkdtempSync('/tmp/omnipilot-acceptance-');chmodSync(directory,0o700);
  const markerPath=directory+'/outside.marker';writeFileSync(markerPath,marker,{mode:0o600,flag:'wx'});
  const markerIdentity=lstatSync(directory);
  const sessions=[],report={reviewedCommit:REVIEWED_COMMIT,status:'incomplete',
    pluginExposure:false,realCredentialsUsed:false,checks:{},cleanup:[],sessions:[],
    limits:['One fixed public HTTPS page; no authenticated profile.',
      'IPv4 loopback host nonce canaries; no general proof covering every network channel.',
      'Controlled redirect/subresource/WebSocket fixtures and negative certificate tests are unverified.',
      'Fresh Chromium sessions may produce background public traffic under the unchanged broker policy.',
      'PID/start/UID/lineage/namespace observations; no pidfd or cgroup claim against a hostile same-UID host.']};
  let interrupted=false;
  const interrupt=()=>{interrupted=true;for(const session of sessions)killOwned(session.owner);};
  process.once('SIGTERM',interrupt);process.once('SIGINT',interrupt);const overall=setTimeout(interrupt,150000);
  const register=session=>{sessions.push(session);if(interrupted)killOwned(session.owner);};
  const observeSession=(session,label)=>report.sessions.push({label,startup:session.ready,
    owner:session.owned.owner,wrapper:session.owned.wrapper,init:session.owned.init,driver:session.owned.driver});
  try{
    let session=await startSession(runtimeModule,installation,marker,register);observeSession(session,'canaries-and-public-https');
    report.checks.canaries=await runCanaries(session.owned,markerPath,marker);
    if(!report.checks.canaries.passed||interrupted)throw error('ACCEPTANCE_CANARIES_FAILED');
    report.checks.publicHttps=await session.ask('public-check');
    if(report.checks.publicHttps?.passed!==true)throw error('ACCEPTANCE_PUBLIC_HTTPS_FAILED');
    report.cleanup.push(await session.cleanup());if(!report.cleanup.at(-1).passed||report.cleanup.at(-1).forcedFallback)throw error('ACCEPTANCE_CLEANUP_FAILED');
    if(interrupted)throw error('ACCEPTANCE_INTERRUPTED');
    session=await startSession(runtimeModule,installation,marker,register);
    observeSession(session,'parent-death');
    validateOwnership(session.owned,session.owner.pid);
    const parentSignal=killOwned(session.owner);if(!parentSignal)throw error('ACCEPTANCE_PARENT_SIGNAL_REFUSED');
    report.checks.parentDeath=await deathEvidence(session.owned,performance.now()+4000);
    report.checks.parentDeath.ownerState=currentState(session.owner);
    const parentCleanup=await session.cleanup();report.cleanup.push(parentCleanup);
    report.checks.parentDeath.stageCleanup=parentCleanup.stageCleanup;
    report.checks.parentDeath.productionCleanupVerified=parentCleanup.productionCleanupVerified;
    report.checks.parentDeath.initialObservationPassed=report.checks.parentDeath.passed;
    report.checks.parentDeath.passed=assessDeathAcceptance(report.checks.parentDeath,parentCleanup,parentSignal)&&
      inactive(report.checks.parentDeath.ownerState);
    if(!report.checks.parentDeath.passed||interrupted)throw error('ACCEPTANCE_PARENT_DEATH_FAILED');
    session=await startSession(runtimeModule,installation,marker,register);
    observeSession(session,'driver-death');
    validateOwnership(session.owned,session.owner.pid);
    const driverSignal=killOwned(session.owned.driver);if(!driverSignal)throw error('ACCEPTANCE_CHILD_SIGNAL_REFUSED');
    report.checks.childDeath=await deathEvidence(session.owned,performance.now()+4000,timeout=>session.ask('diagnostics',timeout));
    report.checks.childDeath.target='namespace Node driver, NSpid 2';
    const childCleanup=await session.cleanup();report.cleanup.push(childCleanup);
    report.checks.childDeath.initialObservationPassed=report.checks.childDeath.passed;
    report.checks.childDeath.passed=assessDeathAcceptance(report.checks.childDeath,childCleanup,driverSignal);
    if(!report.checks.childDeath.passed||interrupted)throw error('ACCEPTANCE_CHILD_DEATH_FAILED');
    report.status='passed';return report;
  }catch(cause){report.status='failed';report.failure=/^ACCEPTANCE_[A-Z_]+$/.test(cause.code??'')?cause.code:'ACCEPTANCE_FAILED';return report;
  }finally{
    clearTimeout(overall);process.off('SIGTERM',interrupt);process.off('SIGINT',interrupt);
    for(const session of sessions)try{const cleanup=await session.cleanup();if(!report.cleanup.includes(cleanup))report.cleanup.push(cleanup);
      if(!cleanup.passed)report.status='failed';}catch{report.status='failed';}
    try{const now=lstatSync(directory);
      if(now.dev!==markerIdentity.dev||now.ino!==markerIdentity.ino||now.uid!==markerIdentity.uid||now.isSymbolicLink())throw Error();
      rmSync(directory,{recursive:true});
    }catch{report.status='failed';report.failure??='ACCEPTANCE_MARKER_CLEANUP_FAILED';}
  }
}

if(process.argv[1]===SELF){
  const args=process.argv.slice(2),helper=args[0]==='--owned-helper';if(helper)args.shift();
  if(args.length!==4){process.stderr.write('Expected runtime-module, node, chromium and playwright-core paths\n');process.exitCode=1;}
  else{
    const [runtimeModule,node,chromium,playwrightCore]=args,installation={node,chromium,playwrightCore};
    if(helper)ownedHelper(runtimeModule,installation).catch(async()=>{try{await helperSend({kind:'failed',code:'ACCEPTANCE_OWNER_START_FAILED'});}catch{}process.exit(1);});
    else runOwnedNativeAcceptance({runtimeModule,installation}).then(value=>{
      process.stdout.write(JSON.stringify(value)+'\n',()=>process.exit(value.status==='passed'?0:1));
    },()=>{process.stdout.write('{"status":"failed","failure":"ACCEPTANCE_SETUP_REFUSED"}\n',()=>process.exit(1));});
  }
}
