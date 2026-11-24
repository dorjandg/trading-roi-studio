// Fixed namespace entrypoint. Importing this module does not open any resource.
import {createServer,createConnection} from 'node:net';
import {readFileSync,readlinkSync,readdirSync,statSync} from 'node:fs';
import {networkInterfaces} from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createGenericBrowserOwner,createGenericBrowserAdapter,normalizeGenericBrowserCommand} from './omnipilot-generic-browser.mjs';
import {NATIVE_LIMITS,exactRecord,createNativeFramedChannel,sanitizedNativeError} from './omnipilot-native-channel.mjs';

const BROKER='/run/omnipilot/broker.sock',CONTROL='/run/omnipilot/control.sock';
export const CHILD_ENV=Object.freeze({PATH:'/opt/node',HOME:'/home/omnipilot',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',
  TMPDIR:'/tmp',XDG_CONFIG_HOME:'/home/omnipilot/config',XDG_CACHE_HOME:'/home/omnipilot/cache',
  XDG_RUNTIME_DIR:'/run/user',FONTCONFIG_FILE:'/etc/fonts/fonts.conf',PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1'});
export function assertNativeStartupLive(closed,deadline,dispose){
  if(closed||performance.now()>=deadline){
    try{Promise.resolve(dispose?.()).catch(()=>{});}catch{}
    throw Error('NATIVE_START_REVOKED');
  }
}
// One sampled instant validates the previous phase/idle budget and supplies the
// replacement budget. A later unchecked sample cannot revive expired traffic.
export function advanceNativeBridgeBudget(pair,phase,bytes=0){
  const time=performance.now();
  if(pair.done||time>=pair.deadline||time>=pair.idleDeadline||
    !Number.isSafeInteger(bytes)||bytes<0||pair.bytes+bytes>NATIVE_LIMITS.bridgeBytes)return false;
  if(phase==='connected'){pair.deadline=time+120000;pair.idleDeadline=time+30000;}
  else if(phase==='forward'){pair.bytes+=bytes;pair.idleDeadline=time+30000;}
  else throw Error('NATIVE_BRIDGE_PHASE');
  return true;
}
export function checkChildEnvironment(env,interfaces,namespaceIds){
  exactRecord(env,[...Object.keys(CHILD_ENV),'PWD'],Object.keys(CHILD_ENV));
  for(const [key,value] of Object.entries(CHILD_ENV))if(env[key]!==value)throw Error('NATIVE_ENVIRONMENT_REFUSED');
  if(env.PWD!==undefined&&env.PWD!=='/home/omnipilot')throw Error('NATIVE_ENVIRONMENT_REFUSED');
  if(Object.keys(interfaces).length!==1||!Array.isArray(interfaces.lo)||interfaces.lo.length<1||interfaces.lo.length>2||
    interfaces.lo.some(item=>item.internal!==true||!['127.0.0.1','::1'].includes(item.address)))throw Error('NATIVE_NETWORK_REFUSED');
  exactRecord(namespaceIds,['user','pid','mnt','net','ipc','uts','time']);
  for(const [kind,value] of Object.entries(namespaceIds))if(typeof value!=='string'||
    !new RegExp('^'+kind+':\\[[0-9]+\\]$').test(value))throw Error('NATIVE_NAMESPACE_REFUSED');
}

// This bridge cannot choose an upstream destination: every accepted byte goes
// to the one mounted broker socket. The broker alone parses CONNECT and dials.
export async function createNamespaceConnectBridge(onFailure){
  if(typeof onFailure!=='function')throw Error('NATIVE_BRIDGE_CONFIG');
  const pairs=new Set();let closed=false,server;
  function end(pair){
    if(pair.done)return;pair.done=true;clearTimeout(pair.timer);clearTimeout(pair.idle);
    pair.client.destroy();pair.upstream.destroy();pairs.delete(pair);
  }
  function close(){
    if(closed)return;closed=true;
    for(const pair of pairs)end(pair);
    try{server.close();}catch{}
  }
  function fatal(){if(closed)return;close();onFailure();}
  function liveTime(pair){
    if(closed||pair.done)return null;
    const time=performance.now();
    if(time>=pair.deadline||time>=pair.idleDeadline){end(pair);return null;}
    return time;
  }
  function forward(pair,from,to,bytes){
    if(closed||!advanceNativeBridgeBudget(pair,'forward',bytes.length)){end(pair);return;}
    clearTimeout(pair.idle);pair.idle=setTimeout(()=>end(pair),30000);
    try{if(!to.write(bytes)){from.pause();to.once('drain',()=>{if(liveTime(pair)!==null)from.resume();});}}
    catch{end(pair);}
  }
  server=createServer({allowHalfOpen:false},client=>{
    if(closed||client.remoteAddress!=='127.0.0.1'||pairs.size>=NATIVE_LIMITS.bridgeConnections){client.destroy();return;}
    client.pause();const upstream=createConnection({path:BROKER});
    const pair={client,upstream,done:false,bytes:0,deadline:performance.now()+2000,
      idleDeadline:performance.now()+2000,timer:null,idle:null};pairs.add(pair);
    pair.timer=setTimeout(()=>{end(pair);fatal();},2000);
    client.on('error',()=>end(pair));client.on('close',()=>end(pair));client.on('end',()=>end(pair));
    upstream.on('error',()=>{end(pair);fatal();});upstream.on('close',()=>{if(!pair.remoteEnded)end(pair);});
    upstream.on('end',()=>{pair.remoteEnded=true;try{client.end(()=>end(pair));}catch{end(pair);}});
    upstream.once('connect',()=>{
      if(closed||!advanceNativeBridgeBudget(pair,'connected')){end(pair);fatal();return;}
      clearTimeout(pair.timer);
      pair.timer=setTimeout(()=>end(pair),120000);pair.idle=setTimeout(()=>end(pair),30000);
      client.on('data',bytes=>forward(pair,client,upstream,bytes));upstream.on('data',bytes=>forward(pair,upstream,client,bytes));
      client.resume();
    });
  });
  server.maxConnections=NATIVE_LIMITS.bridgeConnections;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{
    server.off('error',reject);resolve();});}).catch(()=>{close();throw Error('NATIVE_BRIDGE_REFUSED');});
  server.on('error',fatal);server.on('close',()=>{if(!closed)fatal();});
  return Object.freeze({port:server.address().port,close,
    diagnostics:()=>Object.freeze({closed,connections:pairs.size,listening:server.listening})});
}

async function provePrivateConnectRefusal(port){
  await new Promise((resolve,reject)=>{
    const socket=createConnection({host:'127.0.0.1',port});let bytes=Buffer.alloc(0),done=false;
    const deadline=performance.now()+1500;
    const finish=error=>{if(done)return;done=true;clearTimeout(timer);socket.destroy();error?reject(Error('NATIVE_BROKER_REFUSED')):resolve();};
    const timer=setTimeout(()=>finish(true),1500);
    socket.on('error',()=>finish(true));socket.on('connect',()=>socket.write('CONNECT 127.0.0.1:443 HTTP/1.1\r\nHost: 127.0.0.1:443\r\n\r\n'));
    socket.on('data',chunk=>{
      if(performance.now()>=deadline||bytes.length+chunk.length>512)return finish(true);
      bytes=Buffer.concat([bytes,chunk]);
      if(bytes.includes('\r\n\r\n'))finish(bytes.toString()!=='HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    });
    socket.on('end',()=>{if(!done)finish(true);});
  });
}
function childObservations(){
  const namespaces=Object.fromEntries(['user','pid','mnt','net','ipc','uts','time'].map(name=>[name,readlinkSync('/proc/self/ns/'+name)]));
  checkChildEnvironment(process.env,networkInterfaces(),namespaces);
  if(process.pid!==2||process.ppid!==1)throw Error('NATIVE_PROCESS_REFUSED');
  const status=readFileSync('/proc/self/status','utf8');
  if(!/^CapEff:\s+0+$/m.test(status)||!/^NoNewPrivs:\s+1$/m.test(status))throw Error('NATIVE_CAPABILITIES_REFUSED');
  for(const path of ['/home/codespace','/workspaces','/root','/sys','/etc/resolv.conf']){
    try{statSync(path);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    throw Error('NATIVE_FILESYSTEM_REFUSED');
  }
  for(const path of [BROKER,CONTROL])if(!statSync(path).isSocket())throw Error('NATIVE_SOCKET_REFUSED');
  if(readdirSync('/home/omnipilot').length!==0||readdirSync('/tmp').length!==0)throw Error('NATIVE_PROFILE_REFUSED');
  return Object.freeze({v:1,kind:'hello',pid:process.pid,ppid:process.ppid,namespaces,
    cleanEnvironment:true,loopbackOnly:true,emptyHome:true,capabilitiesDropped:true});
}
function browserPipeObservation(){
  const pids=readdirSync('/proc').filter(value=>/^[1-9][0-9]*$/.test(value));
  if(pids.length>128)throw Error('NATIVE_PROCESS_LIMIT');
  let browsers=0;
  for(const pid of pids){
    let raw;try{raw=readFileSync('/proc/'+pid+'/cmdline');}catch(error){if(error.code==='ENOENT'||error.code==='ESRCH')continue;throw error;}
    if(raw.length>32768)throw Error('NATIVE_PROCESS_REFUSED');
    const args=raw.toString('utf8').split('\0').filter(Boolean);
    if(args[0]!=='/opt/chromium/chrome')continue;
    if(args.some(arg=>arg==='--no-sandbox'||arg.startsWith('--remote-debugging-port')))throw Error('NATIVE_BROWSER_REFUSED');
    if(!args.some(arg=>arg.startsWith('--type='))){
      if(!args.includes('--remote-debugging-pipe')||!args.some(arg=>arg.startsWith('--user-data-dir=/tmp/')))
        throw Error('NATIVE_BROWSER_REFUSED');
      browsers++;
    }
  }
  if(browsers!==1)throw Error('NATIVE_BROWSER_REFUSED');
}

async function runChild(){
  const observations=childObservations();
  let socket,channel,bridge,browser,context,owner,adapter,busy=false,lastId=0,phase='hello',closed=false,activeExpiry=null;
  const revoked=new AbortController();let exitTimer;
  function stop(){
    if(closed)return;closed=true;phase='closed';revoked.abort();bridge?.close();owner?.stop();
    // A child cannot certify its own final disappearance. The host owns and
    // verifies namespace-init termination; this path only attempts graceful exit.
    exitTimer=setTimeout(()=>process.exit(1),500);
    void Promise.allSettled([context?.close(),browser?.close()]).then(()=>{clearTimeout(exitTimer);process.exit(0);});
  }
  process.once('SIGTERM',stop);process.once('SIGINT',stop);process.once('SIGHUP',stop);
  process.on('uncaughtException',stop);process.on('unhandledRejection',stop);
  socket=createConnection({path:CONTROL});
  const deadline=performance.now()+NATIVE_LIMITS.startupMs;
  const startupTimer=setTimeout(stop,NATIVE_LIMITS.startupMs);
  function startupLive(dispose){
    try{assertNativeStartupLive(closed,deadline,dispose);}catch(error){stop();throw error;}
  }
  async function start(){
    startupLive();bridge=await createNamespaceConnectBridge(stop);startupLive(()=>bridge.close());
    await provePrivateConnectRefusal(bridge.port);startupLive();
    const require=createRequire('/opt/playwright-core/package.json');
    const {chromium}=require('/opt/playwright-core');
    startupLive();const launchBudget=Math.floor(deadline-performance.now());if(launchBudget<1)throw Error();
    browser=await chromium.launch({executablePath:'/opt/chromium/chrome',headless:true,chromiumSandbox:true,
      timeout:launchBudget,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false,
      env:{...CHILD_ENV},proxy:{server:'http://127.0.0.1:'+bridge.port,bypass:'<-loopback>'},
      args:['--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']});
    startupLive(()=>browser.close());browser.on('disconnected',stop);
    context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block',
      acceptDownloads:false,ignoreHTTPSErrors:false,permissions:[]});
    startupLive(()=>context.close());
    await context.route('**/*',route=>{
      try{const url=new URL(route.request().url());
        return url.protocol==='https:'&&!url.username&&!url.password&&!url.port?route.continue():route.abort();}
      catch{return route.abort();}
    });
    startupLive();
    const attach=page=>{page.on('filechooser',stop);page.on('download',download=>{void download.cancel().catch(()=>{});stop();});
      page.on('dialog',dialog=>{void dialog.dismiss().catch(()=>{});stop();});
      page.on('framenavigated',frame=>{if(frame!==page.mainFrame())return;
        try{const raw=frame.url(),url=raw==='about:blank'?null:new URL(raw);
          if(url&&(url.protocol!=='https:'||url.username||url.password||url.port))stop();}catch{stop();}});};
    context.on('page',attach);context.on('close',stop);startupLive();
    const firstPage=await context.newPage();startupLive(()=>firstPage.close());browserPipeObservation();
    const assertActive=()=>{if(activeExpiry!==null&&process.hrtime.bigint()>=activeExpiry)stop();
      if(closed||revoked.signal.aborted||channel.diagnostics().closed||
      !bridge.diagnostics().listening||bridge.diagnostics().closed||!browser.isConnected())throw Error('NATIVE_REVOKED');};
    let bound=false;
    const guard=Object.freeze({bindContext(value){
      if(bound||value!==context)throw Error('NATIVE_CONTEXT_REFUSED');assertActive();bound=true;
      return Object.freeze({context,revocationSignal:revoked.signal,assertActive,
        authorizeNavigation(){assertActive();},isolate(){stop();}});
    }});
    owner=createGenericBrowserOwner({context,egressGuard:guard,maxPendingCommands:1,maxTabs:8});
    adapter=createGenericBrowserAdapter(owner.capability);
    if(closed||performance.now()>=deadline)throw Error();
    phase='ready';clearTimeout(startupTimer);
    await channel.send({v:1,kind:'ready',browserPipeOnly:true,chromiumSandboxRequested:true,
      tlsValidation:true,privateConnectRefused:true,serviceWorkersBlocked:true,downloadsBlocked:true},deadline);
  }
  async function execute(message){
    const normalized=normalizeGenericBrowserCommand(message.command);
    if(typeof message.expiresNs!=='string'||!/^[1-9][0-9]{0,29}$/.test(message.expiresNs))throw Error();
    const expiry=BigInt(message.expiresNs),localStart=performance.now(),remaining=expiry-process.hrtime.bigint();
    if(remaining<10000000n||remaining>BigInt(normalized.timeoutMs)*1000000n)throw Error();
    const remainingMs=Number(remaining/1000000n),operationDeadline=localStart+remainingMs;
    const command=Object.freeze({...message.command,timeoutMs:remainingMs});
    activeExpiry=expiry;
    const timer=setTimeout(stop,remainingMs);
    busy=true;lastId=message.id;
    try{
      const result=await adapter.execute(command);
      if(closed||process.hrtime.bigint()>=expiry||performance.now()>=operationDeadline)throw Error();
      await channel.send({v:1,kind:'result',id:message.id,result},operationDeadline);
    }catch(error){
      const safe=sanitizedNativeError(error);
      if(safe.outcomeUnknown){stop();return;}
      if(!closed)await channel.send({v:1,kind:'error',id:message.id,error:safe},operationDeadline);
    }finally{clearTimeout(timer);activeExpiry=null;busy=false;}
  }
  channel=createNativeFramedChannel(socket,{maxReadBytes:NATIVE_LIMITS.commandBytes,maxWriteBytes:NATIVE_LIMITS.resultBytes,
    onFailure:stop,onMessage:message=>{
      try{
        if(message.kind==='stop'){exactRecord(message,['v','kind']);if(message.v!==1)throw Error();stop();return;}
        if(phase==='hello'){
          exactRecord(message,['v','kind']);if(message.v!==1||message.kind!=='start')throw Error();phase='starting';
          void start().catch(stop);return;
        }
        exactRecord(message,['v','kind','id','expiresNs','command']);
        if(closed||phase!=='ready'||busy||message.v!==1||message.kind!=='execute'||
          !Number.isSafeInteger(message.id)||message.id!==lastId+1)throw Error();
        void execute(message).catch(stop);
      }catch{stop();}
    }});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
  await channel.send(observations,deadline);
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(fileURLToPath(import.meta.url)!=='/app/omnipilot-native-child.mjs'){
    process.stderr.write('NATIVE_NAMESPACE_ENTRY_REQUIRED\n');process.exitCode=1;
  }else void runChild().catch(()=>{process.stderr.write('NATIVE_CHILD_START_FAILED\n');process.exit(1);});
}
