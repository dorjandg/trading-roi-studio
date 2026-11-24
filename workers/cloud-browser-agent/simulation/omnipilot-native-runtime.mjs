// Trusted Linux/x64 composition root. No CLI, profile, credentials-file reader,
// tunnel registration, caller flags, test broker seams or unconfined fallback.
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {lstatSync,statSync,realpathSync,readFileSync,readlinkSync,readdirSync,mkdtempSync,mkdirSync,
  writeFileSync,chmodSync,rmSync} from 'node:fs';
import {dirname,basename,resolve,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPublicConnectProxy} from './omnipilot-public-connect-proxy.mjs';
import {createOmniPilotMcpServer} from './omnipilot-tunnel-mcp.mjs';
import {CHILD_ENV} from './omnipilot-native-child.mjs';
import {NATIVE_LIMITS,exactRecord,createNativeFramedChannel,createNativeCommandClient} from './omnipilot-native-channel.mjs';

const NAMESPACES=['user','pid','mnt','net','ipc','uts','time'];
const SYSTEM=Object.freeze({libraries:'/usr/lib/x86_64-linux-gnu',
  loader:'/usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2',
  certificates:'/etc/ssl/certs/ca-certificates.crt',fonts:'/usr/share/fonts/truetype/dejavu'});
const SOURCE_NAMES=['omnipilot-native-child.mjs','omnipilot-native-channel.mjs','omnipilot-generic-browser.mjs'];
const fail=code=>Object.assign(Error(code),{code});
function pathString(value){
  if(typeof value!=='string'||value.length>512||!isAbsolute(value)||resolve(value)!==value||
    !/^\/[A-Za-z0-9/._-]+$/.test(value)||['/','/home','/root','/workspaces','/tmp','/etc','/usr','/usr/lib'].includes(value))
    throw fail('NATIVE_INSTALLATION_REFUSED');
  return value;
}
function checkedPath(path,type){
  pathString(path);const stat=lstatSync(path);
  if(realpathSync(path)!==path||stat.isSymbolicLink()||!(type==='file'?stat.isFile():stat.isDirectory())||
    ![0,process.getuid()].includes(stat.uid)||(stat.mode&0o022)!==0)throw fail('NATIVE_INSTALLATION_REFUSED');
  for(let current=dirname(path);;current=dirname(current)){
    const parent=lstatSync(current);
    if(!parent.isDirectory()||parent.isSymbolicLink()||![0,process.getuid()].includes(parent.uid)||
      (parent.mode&0o022)!==0&&(parent.mode&0o1000)===0)throw fail('NATIVE_INSTALLATION_REFUSED');
    if(dirname(current)===current)break;
  }
  return stat;
}
function boundedFile(path,limit){
  const stat=checkedPath(path,'file');if(stat.size<1||stat.size>limit)throw fail('NATIVE_INSTALLATION_REFUSED');
  const data=readFileSync(path);if(data.length!==stat.size)throw fail('NATIVE_INSTALLATION_REFUSED');return data;
}
function packageTree(root,maxEntries,maxBytes){
  let entries=0,bytes=0;const queue=[root];
  while(queue.length){
    const path=queue.pop(),stat=lstatSync(path);
    if(++entries>maxEntries||![0,process.getuid()].includes(stat.uid)||(stat.mode&0o022)!==0||stat.isSymbolicLink())
      throw fail('NATIVE_INSTALLATION_REFUSED');
    if(stat.isDirectory())for(const name of readdirSync(path)){
      if(!/^[A-Za-z0-9@_.+-]+$/.test(name))throw fail('NATIVE_INSTALLATION_REFUSED');queue.push(join(path,name));
    }
    else if(!stat.isFile()||(bytes+=stat.size)>maxBytes)throw fail('NATIVE_INSTALLATION_REFUSED');
  }
}
export function inspectNativeInstallation(input){
  const installation=exactRecord(input,['node','chromium','playwrightCore']);
  if(process.platform!=='linux'||process.arch!=='x64'||!/^v24\./.test(process.version)||typeof process.getuid!=='function')
    throw fail('NATIVE_HOST_UNSUPPORTED');
  for(const name of ['node','chromium']){
    checkedPath(installation[name],'file');
    if((statSync(installation[name]).mode&0o111)===0)throw fail('NATIVE_INSTALLATION_REFUSED');
  }
  if(installation.node!==realpathSync(process.execPath)||basename(installation.node)!=='node'||
    basename(installation.chromium)!=='chrome'||basename(dirname(installation.chromium))!=='chrome-linux'||
    basename(dirname(dirname(installation.chromium)))!=='chromium-1194'||
    basename(installation.playwrightCore)!=='playwright-core')throw fail('NATIVE_INSTALLATION_REFUSED');
  checkedPath(installation.playwrightCore,'directory');
  const pkg=JSON.parse(boundedFile(join(installation.playwrightCore,'package.json'),65536));
  if(pkg.name!=='playwright-core'||pkg.version!=='1.56.1')throw fail('NATIVE_INSTALLATION_REFUSED');
  packageTree(installation.playwrightCore,8192,128*1024*1024);
  packageTree(dirname(installation.chromium),1024,1024*1024*1024);
  for(const [name,path] of Object.entries(SYSTEM))checkedPath(path,['libraries','fonts'].includes(name)?'directory':'file');
  checkedPath('/usr/bin/bwrap','file');
  const options={env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},timeout:2000,maxBuffer:32768,encoding:'utf8',stdio:['ignore','pipe','pipe']};
  const version=execFileSync('/usr/bin/bwrap',['--version'],options).trim();
  const help=execFileSync('/usr/bin/bwrap',['--help'],options);
  if(version!=='bubblewrap 0.9.0'||['--unshare-all','--die-with-parent','--new-session','--info-fd','--clearenv','--cap-drop','--remount-ro']
    .some(flag=>!help.includes(flag)))throw fail('NATIVE_HOST_UNSUPPORTED');
  return Object.freeze({...installation});
}

// Pure, fixed-plan construction is exported for review/tests. The deployed
// factory always validates real installations and creates its own socket paths.
export function nativeSandboxPlan({installation,stage,brokerSocket,controlSocket,uid,gid}){
  exactRecord(installation,['node','chromium','playwrightCore']);
  for(const path of [...Object.values(installation),stage,brokerSocket,controlSocket])pathString(path);
  if(!Number.isSafeInteger(uid)||uid<0||!Number.isSafeInteger(gid)||gid<0||
    !stage.startsWith('/tmp/omnipilot-native-')||!brokerSocket.startsWith(stage+'/broker/')||
    !controlSocket.startsWith(stage+'/control/'))throw fail('NATIVE_PLAN_REFUSED');
  const args=['--unshare-all','--die-with-parent','--new-session','--cap-drop','ALL',
    '--clearenv','--hostname','omnipilot','--info-fd','3','--proc','/proc','--remount-ro','/proc','--dev','/dev',
    '--size','536870912','--perms','1777','--tmpfs','/tmp',
    '--size','67108864','--perms','1777','--tmpfs','/dev/shm',
    '--size','134217728','--perms','0700','--tmpfs','/home/omnipilot',
    '--size','8388608','--perms','0700','--tmpfs','/run/user',
    '--ro-bind',installation.node,'/opt/node/node',
    '--ro-bind',dirname(installation.chromium),'/opt/chromium',
    '--ro-bind',installation.playwrightCore,'/opt/playwright-core',
    '--ro-bind',SYSTEM.libraries,SYSTEM.libraries,'--symlink','usr/lib','/lib',
    '--ro-bind',SYSTEM.loader,'/lib64/ld-linux-x86-64.so.2',
    '--ro-bind',SYSTEM.certificates,'/etc/ssl/certs/ca-certificates.crt',
    '--ro-bind',SYSTEM.fonts,'/fonts',
    '--ro-bind',brokerSocket,'/run/omnipilot/broker.sock',
    '--ro-bind',controlSocket,'/run/omnipilot/control.sock'];
  for(const name of SOURCE_NAMES)args.push('--ro-bind',stage+'/source/'+name,'/app/'+name);
  for(const name of ['passwd','group','hosts','fonts.conf'])args.push('--ro-bind',stage+'/metadata/'+name,
    name==='fonts.conf'?'/etc/fonts/fonts.conf':'/etc/'+name);
  for(const [name,value] of Object.entries(CHILD_ENV))args.push('--setenv',name,value);
  args.push('--setenv','PWD','/home/omnipilot','--chdir','/home/omnipilot','--remount-ro','/',
    '--','/opt/node/node','/app/omnipilot-native-child.mjs');
  return Object.freeze({executable:'/usr/bin/bwrap',args:Object.freeze(args),
    env:Object.freeze({PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8'}),
    cwd:'/',stdio:Object.freeze(['ignore','pipe','pipe','pipe'])});
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});promise.catch(()=>{});return {promise,resolve,reject};}
function namespaces(pid){return Object.fromEntries(NAMESPACES.map(name=>[name,readlinkSync('/proc/'+pid+'/ns/'+name)]));}
export function parseProcessIdentity(stat,status){
  if(typeof stat!=='string'||stat.length>8192||typeof status!=='string'||status.length>32768)throw fail('NATIVE_PROCESS_REFUSED');
  const match=/^([1-9][0-9]*) \(.+\) ([\s\S]+)$/.exec(stat.trim());if(!match)throw fail('NATIVE_PROCESS_REFUSED');
  const fields=match[2].split(' '),nspid=/^NSpid:\s+([0-9 \t]+)$/m.exec(status),uids=/^Uid:\s+([0-9 \t]+)$/m.exec(status);
  if(fields.length<20||!/^\d+$/.test(fields[1])||!/^\d+$/.test(fields[19])||!nspid||!uids)throw fail('NATIVE_PROCESS_REFUSED');
  const ids=nspid[1].trim().split(/\s+/).map(Number),uidValues=uids[1].trim().split(/\s+/).map(Number);
  return Object.freeze({pid:Number(match[1]),ppid:Number(fields[1]),start:fields[19],state:fields[0],
    innerPid:ids.at(-1),uid:uidValues[0]});
}
function processIdentity(pid){
  if(!Number.isSafeInteger(pid)||pid<1)throw fail('NATIVE_PROCESS_REFUSED');
  return parseProcessIdentity(readFileSync('/proc/'+pid+'/stat','utf8'),readFileSync('/proc/'+pid+'/status','utf8'));
}
export function finalNativeShutdownReceipt(receipt,deadline){
  // Call only after synchronous identity reads and owned cleanup have settled.
  // Completed cleanup remains factual even when it exceeded the close budget.
  return Object.freeze({...receipt,shutdownTimedOut:receipt.shutdownTimedOut||performance.now()>=deadline});
}

export async function createNativeOmniPilotRuntime(options){
  let installation,bearerToken;
  try{({installation,bearerToken}=exactRecord(options,['installation','bearerToken']));
    if(typeof bearerToken!=='string'||!/^[A-Za-z0-9_-]{32,256}$/.test(bearerToken))throw Error();
    installation=inspectNativeInstallation(installation);
  }catch(error){throw fail(['NATIVE_HOST_UNSUPPORTED','NATIVE_INSTALLATION_REFUSED'].includes(error.code)?error.code:'NATIVE_CONFIG_REFUSED');}
  const hostNamespaces=namespaces('self'),stage=mkdtempSync('/tmp/omnipilot-native-');chmodSync(stage,0o700);
  const stageIdentity=lstatSync(stage),socketPath=stage+'/broker/egress.sock',controlPath=stage+'/control/commands.sock';
  let broker,controlServer,controlSocket,child,channel,client,mcp,monitor,startupTimer,ownedInit=null,
    childExited=false,wrapperIdentity=null,controlClosed=false,stopped=false,closing=null,phase='preparing',
    brokerReceipt=null,cleanupComplete=false,shutdownTimedOut=false,verified=false,readyEvidence=null,reason=null;
  const info=deferred(),ready=deferred();let infoBytes=Buffer.alloc(0),outputBytes=0;
  const startupDeadline=performance.now()+NATIVE_LIMITS.startupMs;
  function sameInit(){
    if(!ownedInit)return null;
    try{const current=processIdentity(ownedInit.pid);
      return current.start===ownedInit.start&&current.innerPid===1&&namespaces(ownedInit.pid).pid===ownedInit.namespace;}
    catch(error){return ['ENOENT','ESRCH'].includes(error.code)?false:null;}
  }
  function diagnostics(){const proxy=broker?.diagnostics();return Object.freeze({phase,stopped,reason,namespaceVerified:verified,
    namespaceInitObserved:ownedInit!==null,namespaceInitGone:ownedInit!==null&&sameInit()===false,
    processExitObserved:childExited,controlClosed,cleanupComplete,shutdownTimedOut,
    brokerClosed:proxy?.closed===true,brokerCloseComplete:brokerReceipt?.complete===true,
    brokerPublicTunnelsOpened:proxy?.tunnelsOpened??0,brokerBytesForwarded:proxy?.bytesForwarded??0,
    brokerRefusals:proxy?.refused??0,
    activeCommand:client?.diagnostics().busy===true,readyEvidence,
    browserTerminationVerified:false,liveConfinementAcceptance:false,retrySafe:false});}
  function signalOwned(){
    // Verify the original namespace-init identity. No process-name search or
    // signaling an arbitrary caller PID. The host is trusted against same-UID
    // process replacement; this is not a pidfd/cgroup durable fencing claim.
    if(ownedInit&&sameInit()===true)try{process.kill(ownedInit.pid,'SIGKILL');}catch{}
    if(child&&!childExited&&wrapperIdentity)try{
      const current=processIdentity(wrapperIdentity.pid);
      if(current.start===wrapperIdentity.start&&current.ppid===process.pid&&current.uid===process.getuid())child.kill('SIGKILL');
    }catch{}
  }
  function close(){
    if(closing)return closing;
    const deadline=performance.now()+NATIVE_LIMITS.shutdownMs;
    let resolveClose;closing=new Promise(resolve=>{resolveClose=resolve;});
    stopped=true;phase='closed';reason??='OWNER_STOPPED';clearTimeout(startupTimer);clearInterval(monitor);
    ready.reject(fail('NATIVE_START_FAILED'));info.reject(fail('NATIVE_START_FAILED'));
    // Invalidate host egress and signal the owned namespace before releasing a
    // pending result or admitting any later work. No retry/reconnect is possible.
    let brokerClosing=Promise.resolve();try{brokerClosing=broker?.close('OWNER_STOPPED')??brokerClosing;}catch{}
    if(channel&&!channel.diagnostics().closed)void channel.send({v:1,kind:'stop'},deadline).catch(()=>{});
    signalOwned();client?.stop();channel?.close();try{controlSocket?.destroy();}catch{}
    try{controlServer?.close(()=>{controlClosed=true;});}catch{controlClosed=!controlServer?.listening;}
    void mcp?.close().catch(()=>{});
    void Promise.resolve(brokerClosing).then(value=>{brokerReceipt=value;},()=>{});
    const finish=()=>{
      const time=performance.now(),gone=!child||childExited&&ownedInit!==null&&sameInit()===false;
      const complete=gone&&(!broker||brokerReceipt?.complete===true)&&(!controlServer||controlClosed);
      if(!complete&&time<deadline){setTimeout(finish,20);return;}
      shutdownTimedOut=time>=deadline||!complete;
      if(!shutdownTimedOut){
        try{const current=lstatSync(stage);
          if(current.dev===stageIdentity.dev&&current.ino===stageIdentity.ino&&current.uid===process.getuid()){
            rmSync(stage,{recursive:true});cleanupComplete=true;
          }
        }catch{}
      }
      const receipt=finalNativeShutdownReceipt(diagnostics(),deadline);
      shutdownTimedOut=receipt.shutdownTimedOut;resolveClose(receipt);
    };
    finish();return closing;
  }
  function fatal(code='NATIVE_OWNER_UNCERTAIN'){reason??=code;void close();}
  function checkStartup(){if(stopped||performance.now()>=startupDeadline)throw fail('NATIVE_START_FAILED');}
  async function hello(message){
    exactRecord(message,['v','kind','pid','ppid','namespaces','cleanEnvironment','loopbackOnly','emptyHome','capabilitiesDropped']);
    if(message.v!==1||message.kind!=='hello'||message.pid!==2||message.ppid!==1||
      ['cleanEnvironment','loopbackOnly','emptyHome','capabilitiesDropped'].some(key=>message[key]!==true))throw Error();
    exactRecord(message.namespaces,NAMESPACES);
    const initPid=await info.promise;checkStartup();
    const identity=processIdentity(initPid),actual=namespaces(initPid);
    if(identity.innerPid!==1||identity.ppid!==child.pid||identity.uid!==process.getuid()||identity.state==='Z')throw Error();
    for(const name of NAMESPACES)if(actual[name]!==message.namespaces[name]||
      (name==='time'?actual[name]!==hostNamespaces[name]:actual[name]===hostNamespaces[name]))throw Error();
    ownedInit=Object.freeze({...identity,namespace:actual.pid});verified=true;phase='starting-browser';
    await channel.send({v:1,kind:'start'},startupDeadline);
  }
  try{
    for(const name of ['broker','control','source','metadata'])mkdirSync(stage+'/'+name,{mode:0o700});
    const source=dirname(fileURLToPath(import.meta.url));
    for(const name of SOURCE_NAMES)writeFileSync(stage+'/source/'+name,boundedFile(source+'/'+name,256*1024),{mode:0o400,flag:'wx'});
    const metadata={passwd:`omnipilot:x:${process.getuid()}:${process.getgid()}:OmniPilot:/home/omnipilot:/nonexistent\n`,
      group:`omnipilot:x:${process.getgid()}:\n`,hosts:'127.0.0.1 localhost\n::1 localhost\n',
      'fonts.conf':'<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>/fonts</dir><cachedir>/home/omnipilot/cache/fontconfig</cachedir></fontconfig>\n'};
    for(const [name,value] of Object.entries(metadata))writeFileSync(stage+'/metadata/'+name,value,{mode:0o400,flag:'wx'});
    // Fixed production API only. No caller/config testOnly resolver, dialer,
    // server, clock or host-interface inventory can reach this composition.
    broker=await createPublicConnectProxy({socketPath});checkStartup();
    if(!broker.diagnostics().unixSocketBound)throw Error();
    controlServer=createServer(socket=>{
      if(stopped||controlSocket){socket.destroy();fatal('NATIVE_CHANNEL_REPLACEMENT');return;}
      controlSocket=socket;phase='verifying-child';
      channel=createNativeFramedChannel(socket,{maxReadBytes:NATIVE_LIMITS.resultBytes,maxWriteBytes:NATIVE_LIMITS.commandBytes,
        onFailure:()=>fatal('NATIVE_CHANNEL_LOST'),onMessage:message=>{
          if(stopped)return;
          if(phase==='verifying-child'){
            phase='verifying-namespaces';void hello(message).catch(()=>fatal('NATIVE_CONFINEMENT_REFUSED'));return;
          }
          if(phase==='starting-browser'){
            try{
              exactRecord(message,['v','kind','browserPipeOnly','chromiumSandboxRequested','tlsValidation',
                'privateConnectRefused','serviceWorkersBlocked','downloadsBlocked']);
              if(message.v!==1||message.kind!=='ready'||Object.entries(message).some(([key,value])=>
                !['v','kind'].includes(key)&&value!==true))throw Error();
              checkStartup();readyEvidence=message;phase='ready';ready.resolve();
            }catch{fatal('NATIVE_BROWSER_REFUSED');}return;
          }
          if(phase!=='ready'){fatal('NATIVE_PROTOCOL_REFUSED');return;}
          client.accept(message);
        }});
      client=createNativeCommandClient({send:channel.send,halt:()=>fatal('NATIVE_COMMAND_UNCERTAIN')});
    });
    controlServer.maxConnections=1;controlServer.on('error',()=>fatal('NATIVE_CONTROL_FAILED'));
    await new Promise((resolveListen,reject)=>{controlServer.once('error',reject);controlServer.listen(controlPath,()=>{
      controlServer.off('error',reject);resolveListen();});});chmodSync(controlPath,0o600);checkStartup();
    const plan=nativeSandboxPlan({installation,stage,brokerSocket:socketPath,controlSocket:controlPath,uid:process.getuid(),gid:process.getgid()});
    phase='spawning';startupTimer=setTimeout(()=>fatal('NATIVE_START_TIMEOUT'),Math.max(0,startupDeadline-performance.now()));
    child=spawn(plan.executable,[...plan.args],{env:{...plan.env},cwd:plan.cwd,stdio:[...plan.stdio]});
    if(Number.isSafeInteger(child.pid))try{
      const identity=processIdentity(child.pid);
      if(identity.ppid!==process.pid||identity.uid!==process.getuid())throw Error();wrapperIdentity=identity;
    }catch{fatal('NATIVE_PROCESS_IDENTITY_FAILED');}
    child.once('error',()=>fatal('NATIVE_SPAWN_FAILED'));
    child.once('exit',()=>{childExited=true;if(!stopped)fatal('NATIVE_PROCESS_EXITED');});
    for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{
      outputBytes+=bytes.length;if(outputBytes>16384)fatal('NATIVE_OUTPUT_LIMIT');
    });
    child.stdio[3].on('error',()=>fatal('NATIVE_INFO_FAILED'));
    child.stdio[3].on('data',bytes=>{
      if(infoBytes.length+bytes.length>4096){fatal('NATIVE_INFO_FAILED');return;}
      infoBytes=Buffer.concat([infoBytes,bytes]);
    });
    child.stdio[3].on('end',()=>{
      try{const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(infoBytes));
        if(!value||typeof value!=='object'||!Number.isSafeInteger(value['child-pid'])||value['child-pid']<1)throw Error();
        info.resolve(value['child-pid']);
      }catch{fatal('NATIVE_INFO_FAILED');}
    });
    await ready.promise;checkStartup();clearTimeout(startupTimer);
    monitor=setInterval(()=>{if(broker.diagnostics().closed||sameInit()!==true)fatal('NATIVE_BOUNDARY_LOST');},100);
    mcp=await createOmniPilotMcpServer({adapter:client.adapter,bearerToken,stop(){void close();}});
    if(stopped){await mcp.close();throw Error();}
    return Object.freeze({url:mcp.url,close,diagnostics});
  }catch{const stageReason=reason??phase;await close();throw Object.assign(fail('NATIVE_START_FAILED'),{stage:stageReason});}
}
