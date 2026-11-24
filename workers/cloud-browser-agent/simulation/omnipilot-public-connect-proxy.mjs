// Host-side public TCP/443 CONNECT broker for an isolated browser launcher.
// This is NOT browser confinement: the launcher must prevent every other egress
// path. CONNECT tunnels opaque bytes; it does not authenticate TLS or distinguish
// HTTPS/WSS from another protocol. No credentials, profile or Internet probe.
import {BlockList,createConnection,createServer,isIP} from 'node:net';
import {Resolver} from 'node:dns/promises';
import {chmodSync,lstatSync,readdirSync,realpathSync} from 'node:fs';
import {basename,dirname,isAbsolute,resolve} from 'node:path';
import {networkInterfaces} from 'node:os';
import {performance} from 'node:perf_hooks';

// Conservative public-unicast policy, reviewed against the IANA registries
// (registry revision 2025-10-09). Even globally reachable special-purpose
// exceptions are excluded. IPv6 is limited to 2000::/3, excluding special use.
// https://www.iana.org/assignments/iana-ipv4-special-registry/
// https://www.iana.org/assignments/iana-ipv6-special-registry/
const denied4=new BlockList(),denied6=new BlockList(),global6=new BlockList();
for(const [ip,bits] of [
 ['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],
 ['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],
 ['192.31.196.0',24],['192.52.193.0',24],['192.88.99.0',24],['192.168.0.0',16],
 ['192.175.48.0',24],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],
 ['224.0.0.0',4],['240.0.0.0',4]
])denied4.addSubnet(ip,bits,'ipv4');
// Azure's platform virtual address is globally numbered, not public web egress.
denied4.addAddress('168.63.129.16','ipv4');
global6.addSubnet('2000::',3,'ipv6');
for(const [ip,bits] of [
 ['2001::',23],['2001:db8::',32],['2002::',16],['2620:4f:8000::',48],['3fff::',20]
])denied6.addSubnet(ip,bits,'ipv6');

/** Address classification only, not evidence of routing or browser isolation. */
export function isPublicConnectAddress(address){
 if(typeof address!=='string'||address.includes('%')||address.length>45)return false;
 const family=isIP(address);
 return family===4?!denied4.check(address,'ipv4'):
  family===6&&global6.check(address,'ipv6')&&!denied6.check(address,'ipv6');
}
const normalizeIp=address=>isIP(address)===6?new URL(`https://[${address}]/`).hostname.slice(1,-1):address;
const defaults=Object.freeze({maxConnections:16,maxConcurrentConnects:4,maxTunnels:8,
 maxHeaderBytes:8192,maxTunnelBytes:32*1024*1024,headerTimeoutMs:2000,
 connectTimeoutMs:5000,idleTimeoutMs:30000,tunnelTimeoutMs:120000,closeTimeoutMs:1000});
const bounds={maxConnections:[1,64],maxConcurrentConnects:[1,16],maxTunnels:[1,32],
 maxHeaderBytes:[128,16384],maxTunnelBytes:[1,64*1024*1024],headerTimeoutMs:[1,10000],
 connectTimeoutMs:[1,15000],idleTimeoutMs:[1,60000],tunnelTimeoutMs:[1,300000],closeTimeoutMs:[1,2000]};
const failure=code=>Object.freeze(Object.assign(Error(code),{code}));
function record(value,allowed){
 try{
  if(value===null||typeof value!=='object'||Array.isArray(value)||
   ![null,Object.prototype].includes(Object.getPrototypeOf(value)))throw Error();
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(descriptors).some(key=>typeof key!=='string'||!allowed.includes(key)||
   !descriptors[key].enumerable||!Object.hasOwn(descriptors[key],'value')))throw Error();
  return Object.fromEntries(Object.entries(descriptors).map(([key,d])=>[key,d.value]));
 }catch{throw failure('CONNECT_INVALID_ARGUMENT');}
}
function privateDirectory(socketPath){
 const uid=process.getuid(),parent=dirname(socketPath);
 if(realpathSync(parent)!==parent)throw failure('CONNECT_PATH_DENIED');
 const direct=lstatSync(parent);
 if(!direct.isDirectory()||direct.uid!==uid||(direct.mode&0o777)!==0o700)throw failure('CONNECT_PATH_DENIED');
 for(let current=parent;;current=dirname(current)){
  const stat=lstatSync(current);
  if(!stat.isDirectory()||![0,uid].includes(stat.uid)||
   (stat.mode&0o022)!==0&&(stat.mode&0o1000)===0)throw failure('CONNECT_PATH_DENIED');
  if(dirname(current)===current)break;
 }
 return direct;
}
function authority(value){
 if(typeof value!=='string'||value.length>260||!/^[\x21-\x7e]+$/.test(value))throw Error();
 const match=/^(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9.-]+):443$/.exec(value);
 if(!match)throw Error();
 const host=match[1].startsWith('[')?match[1].slice(1,-1):match[1].toLowerCase();
 const family=isIP(host);
 if(match[1].startsWith('[')&&family!==6||!match[1].startsWith('[')&&family===6)throw Error();
 if(!family){
  const labels=host.split('.');
  if(host.length>253||labels.length<2||/^[\d.]+$/.test(host)||labels.some(label=>
   !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))throw Error();
  if(/(?:^|\.)(?:localhost|local|internal|invalid|test|example|onion)$/.test(host))throw Error();
 }
 return {host:family?normalizeIp(host):host,family};
}
function parseRequest(buffer){
 const text=buffer.toString('latin1');
 if(!/^[\x20-\x7e\r\n]+$/.test(text)||!text.endsWith('\r\n\r\n'))throw Error();
 const lines=text.slice(0,-4).split('\r\n');
 if(lines.length<2||lines.length>5)throw Error();
 const match=/^CONNECT (\S+) HTTP\/1\.1$/.exec(lines.shift());
 if(!match)throw Error();
 const destination=authority(match[1]),headers=new Map();
 for(const line of lines){
  const header=/^([A-Za-z-]+): ([\x20-\x7e]+)$/.exec(line);
  if(!header)throw Error();
  const key=header[1].toLowerCase(),value=header[2];
  if(headers.has(key)||!['host','proxy-connection','connection','user-agent'].includes(key))throw Error();
  if(key==='host'&&value!==match[1]||key==='user-agent'&&value.length>1024||
   ['proxy-connection','connection'].includes(key)&&!['keep-alive','close'].includes(value.toLowerCase()))throw Error();
  headers.set(key,value);
 }
 if(!headers.has('host'))throw Error();
 return destination;
}
async function resolveAddresses(host,{signal,timeoutMs}){
 const resolver=new Resolver({timeout:timeoutMs,tries:1});
 const cancel=()=>resolver.cancel();
 if(signal.aborted)throw Error();
 signal.addEventListener('abort',cancel,{once:true});
 try{
  const queries=[4,6].map(async family=>{
   try{return(await resolver[family===4?'resolve4':'resolve6'](host)).map(address=>({address,family}));}
   catch(error){if(error?.code==='ENODATA')return[];throw error;}
  });
  return(await Promise.all(queries)).flat();
 }finally{signal.removeEventListener('abort',cancel);resolver.cancel();}
}
function dialAddress({address,family,port,signal}){
 return createConnection({host:address,family,port,signal,autoSelectFamily:false,
  // Numeric host must never trigger another resolution or an address fallback.
  lookup(_host,_options,callback){callback(failure('CONNECT_SECOND_LOOKUP_REFUSED'));}});
}
const response=code=>`HTTP/1.1 ${code} ${({400:'Bad Request',403:'Forbidden',502:'Bad Gateway',503:'Service Unavailable',504:'Gateway Timeout'})[code]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`;

/**
 * Caller must supply a NEW EMPTY private 0700 directory with exclusive ownership
 * for this socket, never a shared socket/profile path. Same-UID hostile owners and
 * malicious host routing are outside this boundary. No Internet work on create.
 * testOnlyResolve(host,{signal,timeoutMs}) returns address/family records.
 * testOnlyDial({address,family,port,signal}) synchronously returns a Socket-like
 * Duplex that emits connect. testOnlyNow is a monotonic clock. An injected
 * testOnlyServerFactory must return a Node Server-compatible test listener; it
 * disables Unix-socket identity verification and reports unixSocketBound:false.
 * testOnlyLocalAddresses supplies a synthetic host interface address inventory.
 * These seams must NEVER come from MCP/request arguments or production config.
 */
export async function createPublicConnectProxy(options){
 const config=record(options,['socketPath','limits','testOnlyResolve','testOnlyDial','testOnlyNow','testOnlyServerFactory','testOnlyLocalAddresses']);
 const {socketPath}=config;
 if(typeof process.getuid!=='function'||typeof socketPath!=='string'||!isAbsolute(socketPath)||
  resolve(socketPath)!==socketPath||Buffer.byteLength(socketPath)>103||
  !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(basename(socketPath)))throw failure('CONNECT_INVALID_ARGUMENT');
 const limits={...defaults,...record(config.limits??{},Object.keys(defaults))};
 for(const [name,[min,max]] of Object.entries(bounds))if(!Number.isInteger(limits[name])||
  limits[name]<min||limits[name]>max)throw failure('CONNECT_INVALID_ARGUMENT');
 const resolveHost=config.testOnlyResolve??resolveAddresses,dial=config.testOnlyDial??dialAddress;
 const clock=config.testOnlyNow??performance.now.bind(performance);
 const serverFactory=config.testOnlyServerFactory??createServer;
 if([resolveHost,dial,clock,serverFactory].some(value=>typeof value!=='function'))throw failure('CONNECT_INVALID_ARGUMENT');
 const unixSocketBound=config.testOnlyServerFactory===undefined;
 let syntheticLocal;
 if(config.testOnlyLocalAddresses!==undefined){
  if(!Array.isArray(config.testOnlyLocalAddresses)||config.testOnlyLocalAddresses.length>256||
   config.testOnlyLocalAddresses.some(address=>typeof address!=='string'||!isIP(address)||address.includes('%')))
   throw failure('CONNECT_INVALID_ARGUMENT');
  syntheticLocal=[...config.testOnlyLocalAddresses];
 }
 function localAddresses(){
  const addresses=syntheticLocal??Object.values(networkInterfaces()).flat().filter(Boolean).map(value=>value.address);
  if(addresses.length>256||addresses.some(address=>typeof address!=='string'||!isIP(address)||address.includes('%')))throw Error();
  return new Set(addresses.map(normalizeIp));
 }
 let parent;
 try{parent=privateDirectory(socketPath);if(readdirSync(dirname(socketPath)).length)throw Error();}
 catch{throw failure('CONNECT_PATH_DENIED');}
 try{localAddresses();}catch{throw failure('CONNECT_ADDRESS_POLICY_UNAVAILABLE');}
 let lastTime=-Infinity;
 function now(){
  try{const value=clock();if(!Number.isFinite(value)||value<lastTime)throw Error();lastTime=value;return value;}
  catch{throw failure('CONNECT_CLOCK_FAILED');}
 }
 try{now();}catch{throw failure('CONNECT_CLOCK_FAILED');}
 const clients=new Set(),upstreams=new Set();
 let socketIdentity,closed=false,closeReason=null,closePromise,finishClose,closeTimer,listenerClosed=false;
 let closeDeadline=Infinity,closeDeadlineExceeded=false,closeClockFailed=false;
 let pendingConnects=0,tunnels=0,unsettledResolutions=0,refused=0,tunnelsOpened=0,bytesForwarded=0;
 let server;
 try{
  server=serverFactory({allowHalfOpen:false});
  if(['on','once','off','listen','close'].some(key=>typeof server?.[key]!=='function'))throw Error();
 }catch{throw failure('CONNECT_LISTEN_FAILED');}
 server.maxConnections=limits.maxConnections;
 function diagnostics(){return Object.freeze({closed,closeReason,listenerClosed,activeConnections:clients.size,
  pendingConnects,activeTunnels:tunnels,upstreamSockets:upstreams.size,unsettledResolutions,
  refused,tunnelsOpened,bytesForwarded,unixSocketBound,closeDeadlineExceeded,closeClockFailed,browserConfinementVerified:false});}
 function finish(){
  if(!finishClose)return;
  const done=finishClose;finishClose=null;clearTimeout(closeTimer);
  try{if(now()>=closeDeadline)closeDeadlineExceeded=true;}catch{closeClockFailed=true;}
  done(Object.freeze({...diagnostics(),complete:!closeDeadlineExceeded&&!closeClockFailed&&
   listenerClosed&&clients.size===0&&upstreams.size===0&&unsettledResolutions===0}));
 }
 function maybeFinish(){if(closed&&listenerClosed&&clients.size===0&&upstreams.size===0&&unsettledResolutions===0)finish();}
 function close(reason='OWNER_CLOSED'){
  if(closePromise)return closePromise;
  closePromise=new Promise(resolveClose=>{finishClose=resolveClose;});
  closed=true;closeReason=['OWNER_CLOSED','OWNER_STOPPED','DEADLINE_EXCEEDED','CLOCK_FAILED','PATH_CHANGED','LISTENER_FAILED'].includes(reason)?reason:'OWNER_CLOSED';
  let remaining=0;
  try{closeDeadline=now()+limits.closeTimeoutMs;remaining=Math.max(0,closeDeadline-now());}
  catch{closeClockFailed=true;}
  closeTimer=setTimeout(()=>{closeDeadlineExceeded=true;finish();},remaining);
  // The clock can invalidate the receipt, never the critical containment work.
  for(const entry of clients)terminate(entry);
  for(const socket of upstreams)try{socket.destroy();}catch{}
  try{server.close(()=>{listenerClosed=true;maybeFinish();});}catch{listenerClosed=!server.listening;maybeFinish();}
  return closePromise;
 }
 function identity(){
  try{
   const current=privateDirectory(socketPath);
   if(current.dev!==parent.dev||current.ino!==parent.ino)throw Error();
   if(!unixSocketBound)return true;
   const socket=lstatSync(socketPath);
   if(!socket.isSocket()||
    socket.uid!==process.getuid()||(socket.mode&0o777)!==0o600||
    socket.dev!==socketIdentity.dev||socket.ino!==socketIdentity.ino)throw Error();
   return true;
  }catch{close('PATH_CHANGED');return false;}
 }
 function terminate(entry,reply){
  if(entry.done){if(!reply)entry.client.destroy();return;}
  entry.done=true;clearTimeout(entry.timer);clearTimeout(entry.idleTimer);
  if(entry.pending){entry.pending=false;pendingConnects--;}
  if(entry.tunnel){entry.tunnel=false;tunnels--;}
  entry.abort.abort();entry.upstream?.destroy();
  if(reply&&!closed&&!entry.client.destroyed){
   const timer=setTimeout(()=>entry.client.destroy(),Math.min(100,limits.closeTimeoutMs));
   entry.client.once('close',()=>clearTimeout(timer));
   try{entry.client.end(reply,()=>entry.client.destroy());}catch{entry.client.destroy();}
  }else entry.client.destroy();
 }
 function deny(entry,code){
  if(entry.done)return;
  refused=Math.min(Number.MAX_SAFE_INTEGER,refused+1);
  terminate(entry,entry.phase!=='tunnel'?response(code):undefined);
 }
 function liveTime(entry){
  if(closed||entry.done||entry.client.destroyed)return null;
  let time;
  try{time=now();}catch{close('CLOCK_FAILED');return null;}
  if(time>=entry.deadline||entry.idleDeadline!==undefined&&time>=entry.idleDeadline){deny(entry,504);return null;}
  return time;
 }
 const live=entry=>liveTime(entry)!==null;
 function armDeadline(entry){
  clearTimeout(entry.timer);
  const time=liveTime(entry);if(time===null)return;
  entry.timer=setTimeout(()=>{if(live(entry))armDeadline(entry);},entry.deadline-time);
 }
 function startDeadline(entry,duration,idleDuration){
  // Validate the previous phase's deadline at the SAME sampled instant used
  // to start the new budget. Never overwrite an already expired deadline.
  const time=liveTime(entry);if(time===null)return null;
  entry.deadline=time+duration;
  if(idleDuration!==undefined)entry.idleDeadline=time+idleDuration;
  armDeadline(entry);
  return closed||entry.done?null:time;
 }
 function forward(entry,source,destination,chunk){
  if(!live(entry))return;
  if(entry.bytes+chunk.length>limits.maxTunnelBytes){deny(entry,403);return;}
  // The second sample also validates total AND previous idle deadlines before
  // accounting bytes, resetting idle time or forwarding any of this chunk.
  const time=liveTime(entry);if(time===null)return;
  entry.bytes+=chunk.length;bytesForwarded=Math.min(Number.MAX_SAFE_INTEGER,bytesForwarded+chunk.length);
  clearTimeout(entry.idleTimer);
  entry.idleDeadline=time+limits.idleTimeoutMs;
  entry.idleTimer=setTimeout(()=>terminate(entry),limits.idleTimeoutMs);
  try{if(!destination.write(chunk)){
   source.pause();destination.once('drain',()=>{if(live(entry))source.resume();});
  }}catch{terminate(entry);}
 }
 function beginTunnel(entry,selected){
  if(!live(entry)||!identity())return;
  const remote=entry.upstream;
  if(!remote||remote.destroyed||isIP(remote.remoteAddress)!==selected.family||
   normalizeIp(remote.remoteAddress)!==selected.address||remote.remotePort!==443||
   !isPublicConnectAddress(remote.remoteAddress)||localAddresses().has(normalizeIp(remote.remoteAddress)))return deny(entry,502);
  if(tunnels>=limits.maxTunnels)return deny(entry,503);
  const started=startDeadline(entry,limits.tunnelTimeoutMs,limits.idleTimeoutMs);
  if(started===null||!live(entry))return;
  entry.pending=false;pendingConnects--;entry.tunnel=true;tunnels++;tunnelsOpened=Math.min(Number.MAX_SAFE_INTEGER,tunnelsOpened+1);
  entry.phase='tunnel';
  entry.idleTimer=setTimeout(()=>terminate(entry),limits.idleTimeoutMs);
  remote.on('data',chunk=>forward(entry,remote,entry.client,chunk));
  remote.on('end',()=>terminate(entry));
  entry.client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
 }
 async function connect(entry,destination){
  if(!live(entry)||!identity())return;
  if(pendingConnects>=limits.maxConcurrentConnects||tunnels>=limits.maxTunnels)return deny(entry,503);
  if(startDeadline(entry,limits.connectTimeoutMs)===null)return;
  entry.phase='connecting';entry.pending=true;pendingConnects++;
  try{
   let answers;
   if(destination.family)answers=[{address:destination.host,family:destination.family}];
   else{
    unsettledResolutions++;
    try{answers=await resolveHost(destination.host,{signal:entry.abort.signal,timeoutMs:limits.connectTimeoutMs});}
    finally{unsettledResolutions--;maybeFinish();}
   }
   if(!live(entry)||!identity())return;
   if(!Array.isArray(answers)||answers.length===0||answers.length>32)throw Error();
   const local=localAddresses();
   const checked=answers.map(value=>{
    const item=record(value,['address','family']);
    if(!isPublicConnectAddress(item.address)||item.family!==isIP(item.address))throw Error();
    const address=normalizeIp(item.address);
    if(local.has(address))throw Error();
    return Object.freeze({address,family:item.family});
   });
   // Choose once, prefer IPv4 for host compatibility, never retry another answer.
   const selected=checked.find(value=>value.family===4)??checked[0];
   if(!live(entry))return;
   const remote=dial({...selected,port:443,signal:entry.abort.signal});
   if(!remote||typeof remote.on!=='function'||typeof remote.once!=='function'||
    typeof remote.write!=='function'||typeof remote.destroy!=='function')throw Error();
   entry.upstream=remote;upstreams.add(remote);
   remote.on('error',()=>deny(entry,502));
   remote.once('close',()=>{upstreams.delete(remote);terminate(entry);maybeFinish();});
   remote.once('connect',()=>{
    try{beginTunnel(entry,selected);}catch(error){
     if(error?.code==='CONNECT_CLOCK_FAILED')close('CLOCK_FAILED');else deny(entry,502);
    }
   });
   if(!live(entry))remote.destroy();
  }catch{deny(entry,403);}
 }
 server.on('connection',client=>{
  if(closed){client.destroy();return;}
  let started;
  try{started=now();}catch{client.destroy();close('CLOCK_FAILED');return;}
  const entry={client,abort:new AbortController(),done:false,phase:'headers',pending:false,tunnel:false,
   upstream:null,buffer:Buffer.alloc(0),bytes:0,deadline:started+limits.headerTimeoutMs};
  clients.add(entry);armDeadline(entry);
  client.on('error',()=>terminate(entry));
  client.once('close',()=>{clients.delete(entry);terminate(entry);maybeFinish();});
  client.on('end',()=>terminate(entry));
  client.on('data',chunk=>{
   if(!live(entry))return;
   if(entry.phase==='tunnel')return forward(entry,client,entry.upstream,chunk);
   if(entry.phase!=='headers')return deny(entry,400);
   if(entry.buffer.length+chunk.length>limits.maxHeaderBytes)return deny(entry,400);
   entry.buffer=Buffer.concat([entry.buffer,chunk]);
   const end=entry.buffer.indexOf('\r\n\r\n');
   if(end===-1)return;
   if(end+4!==entry.buffer.length)return deny(entry,400);
   let destination;
   try{destination=parseRequest(entry.buffer);}catch{return deny(entry,400);}
   entry.buffer=Buffer.alloc(0);void connect(entry,destination).catch(()=>deny(entry,502));
  });
 });
 server.on('drop',()=>{refused=Math.min(Number.MAX_SAFE_INTEGER,refused+1);});
 try{
  await new Promise((resolveListen,rejectListen)=>{
   server.once('error',rejectListen);server.listen({path:socketPath,backlog:limits.maxConnections},()=>{
    server.off('error',rejectListen);resolveListen();
   });
  });
  server.on('error',()=>close('LISTENER_FAILED'));
  if(unixSocketBound){chmodSync(socketPath,0o600);socketIdentity=lstatSync(socketPath);}
  if(!identity())throw Error();
 }catch{await close('LISTENER_FAILED');throw failure('CONNECT_LISTEN_FAILED');}
 return Object.freeze({socketPath,address:Object.freeze({socketPath}),diagnostics,close});
}
