// Offline policy/lifecycle tests: only test-owned TCP loopback listeners and fake
// destination Duplexes. This environment refuses AF_UNIX bind; no UDS/browser
// confinement or public Internet acceptance is claimed by this suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,rmSync,mkdirSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createConnection,createServer} from 'node:net';
import {Duplex} from 'node:stream';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createPublicConnectProxy,isPublicConnectAddress} from '../simulation/omnipilot-public-connect-proxy.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const request=(target='example.com:443',extra='')=>`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n${extra}\r\n`;
class Peer extends Duplex{
 constructor({address='1.1.1.1',family=4,port=443,autoConnect=true}={}){
  super();this.remoteAddress=address;this.remoteFamily=`IPv${family}`;this.remotePort=port;this.written=[];
  if(autoConnect)queueMicrotask(()=>this.emit('connect'));
 }
 _read(){}
 _write(chunk,_encoding,done){this.written.push(Buffer.from(chunk));done();}
}
async function fixture(t,options={}){
 const dir=mkdtempSync(join(tmpdir(),'ocp-'));chmodSync(dir,0o700);
 const peers=[],dials=[],resolves=[];let server;
 const proxy=await createPublicConnectProxy({socketPath:join(dir,'broker.sock'),
  testOnlyLocalAddresses:['127.0.0.1','::1'],
  testOnlyResolve:async(host,args)=>{resolves.push({host,...args});return[{address:'1.1.1.1',family:4}];},
  testOnlyDial:args=>{dials.push(args);const peer=new Peer(args);peers.push(peer);return peer;},
  ...options,testOnlyServerFactory:config=>{
   // Explicit test adapter: production socket-path listen is never called here.
   server=createServer(config);const listen=server.listen.bind(server);
   server.listen=(_pathOptions,callback)=>listen({host:'127.0.0.1',port:0},callback);
   return server;
  }});
 t.after(async()=>{await proxy.close();rmSync(dir,{recursive:true,force:true});});
 async function client(){
  const socket=createConnection({host:'127.0.0.1',port:server.address().port});
  const chunks=[];socket.on('data',chunk=>chunks.push(Buffer.from(chunk)));socket.on('error',()=>{});
  const closed=new Promise(resolve=>socket.once('close',resolve));
  t.after(()=>socket.destroy());await once(socket,'connect');
  return{socket,chunks,closed,text:()=>Buffer.concat(chunks).toString('latin1')};
 }
 async function refused(text){const c=await client();c.socket.write(text);await c.closed;return c.text();}
 async function tunnel(text=request()){
  const c=await client();c.socket.write(text);
  for(let i=0;i<100&&!c.text().includes('\r\n\r\n')&&!c.socket.destroyed;i++)await delay(2);
  assert.match(c.text(),/^HTTP\/1\.1 200 Connection Established\r\n\r\n/);
  return c;
 }
 return{proxy,client,refused,tunnel,peers,dials,resolves,dir,server};
}

test('address policy allows ordinary global IPv4/IPv6 and rejects special-use boundaries',()=>{
 for(const ip of ['1.1.1.1','8.8.8.8','93.184.215.14','100.63.255.255','100.128.0.0',
  '172.15.255.255','172.32.0.0','223.255.255.255','2001:4860:4860::8888','2606:4700:4700::1111'])
  assert.equal(isPublicConnectAddress(ip),true,ip);
 for(const ip of ['0.0.0.0','0.255.255.255','10.1.2.3','100.64.0.0','100.127.255.255','127.0.0.1',
  '169.254.169.254','172.16.0.0','172.31.255.255','192.0.0.9','192.0.2.1','192.31.196.1',
  '192.52.193.1','192.88.99.1','192.168.1.1','192.175.48.1','198.18.1.1','198.19.255.255',
  '198.51.100.2','203.0.113.1','224.0.0.0','239.255.255.255','240.0.0.1','255.255.255.255',
  '168.63.129.16','::','::1','::ffff:1.1.1.1','::ffff:127.0.0.1','64:ff9b::7f00:1',
  '64:ff9b:1::1','100::1','100:0:0:1::1','2001::1','2001:1::1','2001:2::1','2001:3::1',
  '2001:4:112::1','2001:10::1','2001:20::1','2001:30::1','2001:db8::1','2002:7f00:1::',
  '2620:4f:8000::1','3fff::1','5f00::1','fc00::1','fdff::1','fe80::1','ff02::1','fe80::1%lo',
  '127.1','0177.0.0.1','0x7f000001','2130706433','not-an-ip','',null])
  assert.equal(isPublicConnectAddress(ip),false,String(ip));
});
test('factory rejects invalid limits and never reads getters',async()=>{
 let reads=0;
 await assert.rejects(createPublicConnectProxy({get socketPath(){reads++;return'/tmp/a';}}),{code:'CONNECT_INVALID_ARGUMENT'});
 assert.equal(reads,0);
 for(const options of [{},null,{socketPath:'relative.sock'},{socketPath:'/tmp/../tmp/a'},
  {socketPath:'/tmp/a',limits:{maxConnections:65}},{socketPath:'/tmp/a',limits:{extra:1}},
  {socketPath:'/tmp/a',testOnlyDial:2}])await assert.rejects(createPublicConnectProxy(options),{code:'CONNECT_INVALID_ARGUMENT'});
});
test('private path refuses existing entries, wrong permissions and symlink ancestors',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'ocp-path-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 chmodSync(dir,0o755);await assert.rejects(createPublicConnectProxy({socketPath:join(dir,'s')}),{code:'CONNECT_PATH_DENIED'});
 chmodSync(dir,0o700);writeFileSync(join(dir,'s'),'existing');
 await assert.rejects(createPublicConnectProxy({socketPath:join(dir,'s')}),{code:'CONNECT_PATH_DENIED'});
 rmSync(join(dir,'s'));mkdirSync(join(dir,'private'),{mode:0o700});symlinkSync(join(dir,'private'),join(dir,'alias'));
 await assert.rejects(createPublicConnectProxy({socketPath:join(dir,'alias','s')}),{code:'CONNECT_PATH_DENIED'});
});
test('strict CONNECT parser rejects schemes, credentials, ports, unsafe names and HTTP variants',async t=>{
 const f=await fixture(t);
 for(const target of ['http://example.com:443','https://example.com:443','user@example.com:443',
  'example.com:80','example.com:0443','example.com','example.com:443/path','example.com:443?x',
  'localhost:443','a.local:443','a.internal:443','a.test:443','example.com.:443','a..com:443',
  '127.1:443','0177.0.0.1:443','[fe80::1%lo]:443','[invalid]:443'])
  assert.match(await f.refused(request(target)),/^HTTP\/1\.1 400 /,target);
 for(const text of [request().replace('CONNECT','GET'),request().replace('HTTP/1.1','HTTP/1.0'),
  request().replace('CONNECT ','CONNECT  '),request().replace('Host: example.com:443','Host: other.com:443'),
  'CONNECT example.com:443 HTTP/1.1\r\n\r\n'])assert.match(await f.refused(text),/^HTTP\/1\.1 400 /);
 assert.equal(f.dials.length,0);assert.equal(f.resolves.length,0);
});
test('rejects duplicate/credential/framing headers, folded lines, bodies and pipelining',async t=>{
 const f=await fixture(t);
 for(const extra of ['Host: example.com:443\r\n','hOsT: example.com:443\r\n',
  'Authorization: secret\r\n','Proxy-Authorization: secret\r\n','Cookie: secret\r\n',
  'Content-Length: 0\r\n','Transfer-Encoding: chunked\r\n','Connection: upgrade\r\n',
  'Upgrade: websocket\r\n',' Host: example.com:443\r\n','Host : example.com:443\r\n',
  'User-Agent: x\tsecret\r\n','X-Unknown: x\r\n',`User-Agent: ${'x'.repeat(1025)}\r\n`])
  assert.match(await f.refused(request('example.com:443',extra)),/^HTTP\/1\.1 400 /);
 for(const suffix of ['x',request(),'\x16\x03\x01'])assert.match(await f.refused(request()+suffix),/^HTTP\/1\.1 400 /);
 assert.equal(f.resolves.length,0);assert.equal(f.dials.length,0);
});
test('accepts fragmented Chromium headers and forwards opaque bytes in both directions',async t=>{
 const f=await fixture(t),c=await f.client();
 const text=request('example.com:443','Proxy-Connection: keep-alive\r\nUser-Agent: Chromium/156\r\n');
 c.socket.write(text.slice(0,21));await tick();c.socket.write(text.slice(21));
 for(let i=0;i<100&&!c.text().includes('200');i++)await delay(2);
 assert.match(c.text(),/^HTTP\/1\.1 200 /);assert.equal(f.dials.length,1);
 assert.equal(f.dials[0].address,'1.1.1.1');assert.equal(f.dials[0].family,4);assert.equal(f.dials[0].port,443);
 c.socket.write(Buffer.from([0x16,3,1,0,1]));await delay(5);
 assert.deepEqual(Buffer.concat(f.peers[0].written),Buffer.from([0x16,3,1,0,1]));
 f.peers[0].push('reply');await delay(5);assert.ok(c.text().endsWith('reply'));
 assert.equal(f.proxy.diagnostics().bytesForwarded,10);
 assert.equal(f.proxy.diagnostics().unixSocketBound,false);
 assert.equal(f.proxy.diagnostics().browserConfinementVerified,false);
 assert.ok(Object.isFrozen(f.proxy));assert.ok(Object.isFrozen(f.proxy.address));assert.ok(Object.isFrozen(f.proxy.diagnostics()));
});
test('denies mixed DNS answers before any dial, including mapped and special IPv6',async t=>{
 for(const address of ['127.0.0.1','169.254.169.254','2001:db8::1','::ffff:1.1.1.1','3fff::1']){
  let dials=0;
  const f=await fixture(t,{testOnlyResolve:async()=>[{address:'1.1.1.1',family:4},{address,family:address.includes(':')?6:4}],
   testOnlyDial:()=>{dials++;throw Error('must not dial');}});
  assert.match(await f.refused(request()),/^HTTP\/1\.1 403 /);assert.equal(dials,0);
 }
});
test('a globally numbered host interface is still denied as a local destination',async t=>{
 const f=await fixture(t,{testOnlyLocalAddresses:['1.1.1.1','127.0.0.1','::1']});
 assert.match(await f.refused(request()),/^HTTP\/1\.1 403 /);assert.equal(f.dials.length,0);
});
test('denies empty, oversized, malformed and failed resolver results',async t=>{
 for(const answers of [[],Array.from({length:33},()=>({address:'1.1.1.1',family:4})),
  [{address:'1.1.1.1',family:6}],[{address:'127.0.0.1',family:4}],{address:'1.1.1.1'},
  [{address:'1.1.1.1',family:4,extra:true}]]){
  const f=await fixture(t,{testOnlyResolve:async()=>answers});
  assert.match(await f.refused(request()),/^HTTP\/1\.1 403 /);assert.equal(f.dials.length,0);
 }
 const f=await fixture(t,{testOnlyResolve:async()=>{throw Error('SECRET upstream detail');}});
 const text=await f.refused(request());assert.match(text,/403/);assert.ok(!text.includes('SECRET'));
 assert.ok(!JSON.stringify(f.proxy.diagnostics()).includes('SECRET'));
});
test('numeric literals skip DNS; one checked address is dialed without fallback',async t=>{
 let resolutions=0,dials=[];
 const f=await fixture(t,{testOnlyResolve:async()=>{resolutions++;return[{address:'2001:4860:4860::8888',family:6},{address:'1.1.1.1',family:4}];},
  testOnlyDial:args=>{dials.push(args);const peer=new Peer({...args,autoConnect:false});queueMicrotask(()=>peer.emit('error',Error('SECRET')));return peer;}});
 assert.match(await f.refused(request('8.8.8.8:443')),/^HTTP\/1\.1 502 /);
 assert.equal(resolutions,0);assert.equal(dials.length,1);assert.equal(dials[0].address,'8.8.8.8');
 assert.match(await f.refused(request()),/^HTTP\/1\.1 502 /);
 assert.equal(resolutions,1);assert.equal(dials.length,2);assert.equal(dials[1].address,'1.1.1.1');
});
test('public IPv6 literal normalizes peer identity and preserves family without DNS',async t=>{
 const f=await fixture(t);const c=await f.tunnel(request('[2001:4860:4860:0000:0000:0000:0000:8888]:443'));
 assert.equal(f.resolves.length,0);assert.equal(f.dials[0].address,'2001:4860:4860::8888');assert.equal(f.dials[0].family,6);
 c.socket.destroy();
});
test('rejects changed peer address, family or port before acknowledging CONNECT',async t=>{
 for(const peer of [{address:'127.0.0.1'},{address:'8.8.8.8'},{address:'2001:4860::1',family:6},{port:80}]){
  const f=await fixture(t,{testOnlyDial:()=>new Peer(peer)});
  assert.match(await f.refused(request()),/^HTTP\/1\.1 502 /);assert.equal(f.proxy.diagnostics().tunnelsOpened,0);
 }
});
test('pending CONNECT rejects additional bytes and aborts a late DNS result',async t=>{
 const gate=deferred(),started=deferred();let signal;
 const f=await fixture(t,{testOnlyResolve:(_host,args)=>{signal=args.signal;started.resolve();return gate.promise;}});
 const c=await f.client();c.socket.write(request());await started.promise;c.socket.write('body');await c.closed;
 assert.match(c.text(),/^HTTP\/1\.1 400 /);assert.equal(signal.aborted,true);
 gate.resolve([{address:'1.1.1.1',family:4}]);await tick();assert.equal(f.dials.length,0);
});
test('resolution deadline rechecks monotonic time before dialing even without timer delivery',async t=>{
 let time=0;const gate=deferred(),started=deferred();
 const f=await fixture(t,{limits:{connectTimeoutMs:5},testOnlyNow:()=>time,
  testOnlyResolve:()=>{started.resolve();return gate.promise;}});
 const c=await f.client();c.socket.write(request());await started.promise;time=5;gate.resolve([{address:'1.1.1.1',family:4}]);
 await c.closed;assert.match(c.text(),/^HTTP\/1\.1 504 /);assert.equal(f.dials.length,0);
});
test('late connection event after deadline never returns 200 or resurrects a tunnel',async t=>{
 let time=0;const ready=deferred();let peer;
 const f=await fixture(t,{limits:{connectTimeoutMs:5},testOnlyNow:()=>time,
  testOnlyDial:args=>{peer=new Peer({...args,autoConnect:false});ready.resolve();return peer;}});
 const c=await f.client();c.socket.write(request());await ready.promise;time=6;peer.emit('connect');await c.closed;
 assert.match(c.text(),/^HTTP\/1\.1 504 /);assert.equal(peer.destroyed,true);assert.equal(f.proxy.diagnostics().tunnelsOpened,0);
});
test('connect-to-tunnel transition cannot overwrite a deadline reached on its second clock sample',async t=>{
 let phase='initial',reads=0;const ready=deferred();let peer;
 const f=await fixture(t,{limits:{connectTimeoutMs:5,tunnelTimeoutMs:100},
  testOnlyNow:()=>phase==='initial'?0:++reads===1?4:5,
  testOnlyDial:args=>{peer=new Peer({...args,autoConnect:false});ready.resolve();return peer;}});
 const c=await f.client();c.socket.write(request());await ready.promise;phase='boundary';peer.emit('connect');await c.closed;
 assert.match(c.text(),/^HTTP\/1\.1 504 /);assert.ok(!c.text().includes('200'));
 assert.equal(peer.destroyed,true);assert.equal(f.proxy.diagnostics().tunnelsOpened,0);
});
test('new tunnel deadline already elapsed during timer arming cannot acknowledge CONNECT',async t=>{
 let phase='initial',reads=0;const ready=deferred();let peer;
 const f=await fixture(t,{limits:{connectTimeoutMs:5,tunnelTimeoutMs:100},
  testOnlyNow:()=>phase==='initial'?0:++reads<=2?4:104,
  testOnlyDial:args=>{peer=new Peer({...args,autoConnect:false});ready.resolve();return peer;}});
 const c=await f.client();c.socket.write(request());await ready.promise;phase='boundary';peer.emit('connect');await c.closed;
 assert.match(c.text(),/^HTTP\/1\.1 504 /);assert.equal(f.proxy.diagnostics().tunnelsOpened,0);
});
test('prospective idle deadline is enforced before acknowledging and counting a new tunnel',async t=>{
 let phase='initial',reads=0;const ready=deferred();let peer;
 const f=await fixture(t,{limits:{connectTimeoutMs:100,tunnelTimeoutMs:100,idleTimeoutMs:1},
  testOnlyNow:()=>phase==='initial'?0:++reads<=2?4:5,
  testOnlyDial:args=>{peer=new Peer({...args,autoConnect:false});ready.resolve();return peer;}});
 const c=await f.client();c.socket.write(request());await ready.promise;phase='boundary';peer.emit('connect');await c.closed;
 assert.match(c.text(),/^HTTP\/1\.1 504 /);assert.equal(f.proxy.diagnostics().tunnelsOpened,0);
 assert.equal(f.proxy.diagnostics().activeTunnels,0);
});
test('owner close revokes pending DNS synchronously and consumes its late result',async t=>{
 const gate=deferred(),started=deferred();let signal;
 const f=await fixture(t,{limits:{closeTimeoutMs:10},testOnlyResolve:(_host,args)=>{signal=args.signal;started.resolve();return gate.promise;}});
 const c=await f.client();c.socket.write(request());await started.promise;
 const closing=f.proxy.close();assert.equal(closing,f.proxy.close());assert.equal(signal.aborted,true);assert.equal(f.proxy.diagnostics().closed,true);
 const receipt=await closing;assert.equal(receipt.complete,false);assert.equal(receipt.unsettledResolutions,1);assert.ok(Object.isFrozen(receipt));
 gate.resolve([{address:'1.1.1.1',family:4}]);await tick();assert.equal(f.dials.length,0);assert.equal(f.proxy.diagnostics().unsettledResolutions,0);
});
test('late DNS rejection after close is observed without an unhandled rejection',async t=>{
 const gate=deferred(),started=deferred();
 const f=await fixture(t,{limits:{closeTimeoutMs:5},testOnlyResolve:()=>{started.resolve();return gate.promise;}});
 const c=await f.client();c.socket.write(request());await started.promise;await f.proxy.close();
 gate.reject(Error('SECRET resolver detail'));await tick();
 assert.equal(f.proxy.diagnostics().unsettledResolutions,0);assert.equal(f.dials.length,0);assert.ok(!c.text().includes('SECRET'));
});
test('close revokes a pending dial and active tunnels with bounded complete receipt',async t=>{
 const f=await fixture(t),c=await f.tunnel();const close=f.proxy.close('OWNER_STOPPED');
 assert.equal(f.peers[0].destroyed,true);const receipt=await close;await c.closed;
 assert.equal(receipt.complete,true);assert.equal(receipt.activeConnections,0);assert.equal(receipt.upstreamSockets,0);
 const ready=deferred();let peer;
 const pending=await fixture(t,{testOnlyDial:args=>{peer=new Peer({...args,autoConnect:false});ready.resolve();return peer;}});
 const d=await pending.client();d.socket.write(request());await ready.promise;await pending.proxy.close();peer.emit('connect');
 assert.equal(peer.destroyed,true);assert.ok(!d.text().includes('200'));assert.equal(pending.proxy.diagnostics().tunnelsOpened,0);
});
test('cleanup completion after its absolute close deadline stays conservatively incomplete',async t=>{
 let phase='initial',reads=0;
 const f=await fixture(t,{limits:{closeTimeoutMs:5},testOnlyNow:()=>phase==='initial'?0:++reads<=2?0:6});
 await f.tunnel();phase='closing';const receipt=await f.proxy.close();
 assert.equal(receipt.closeDeadlineExceeded,true);assert.equal(receipt.complete,false);
 assert.equal(f.peers[0].destroyed,true);
});
test('bad shutdown clock never prevents immediate revocation and socket destruction',async t=>{
 let time=0;const f=await fixture(t,{testOnlyNow:()=>time}),c=await f.tunnel();time=NaN;
 const closing=f.proxy.close();assert.equal(closing,f.proxy.close());assert.equal(f.peers[0].destroyed,true);
 const receipt=await closing;await c.closed;
 assert.equal(receipt.closed,true);assert.equal(receipt.closeClockFailed,true);assert.equal(receipt.complete,false);
});
test('overdue header and oversized header are bounded without a resolver call',async t=>{
 const f=await fixture(t,{limits:{headerTimeoutMs:10,maxHeaderBytes:128}});
 const c=await f.client();c.socket.write('CON');await c.closed;assert.match(c.text(),/^HTTP\/1\.1 504 /);
 assert.match(await f.refused('X'.repeat(129)),/^HTTP\/1\.1 400 /);assert.equal(f.resolves.length,0);
});
test('connect concurrency and tunnel capacity reject excess work without queueing',async t=>{
 const gate=deferred(),started=deferred();let resolutions=0;
 const f=await fixture(t,{limits:{maxConcurrentConnects:1,maxTunnels:1},testOnlyResolve:()=>{resolutions++;started.resolve();return gate.promise;}});
 const c=await f.client();c.socket.write(request());await started.promise;
 assert.match(await f.refused(request()),/^HTTP\/1\.1 503 /);assert.equal(resolutions,1);
 gate.resolve([{address:'1.1.1.1',family:4}]);for(let i=0;i<100&&!c.text().includes('200');i++)await delay(2);
 assert.match(c.text(),/^HTTP\/1\.1 200 /);assert.match(await f.refused(request()),/^HTTP\/1\.1 503 /);assert.equal(resolutions,1);
});
test('total tunnel byte budget closes before forwarding an over-limit chunk',async t=>{
 const f=await fixture(t,{limits:{maxTunnelBytes:5}}),c=await f.tunnel();
 c.socket.write('abc');await delay(5);f.peers[0].push('de');await delay(5);c.socket.write('x');await c.closed;
 assert.equal(Buffer.concat(f.peers[0].written).toString(),'abc');assert.ok(c.text().endsWith('de'));
 assert.equal(f.proxy.diagnostics().bytesForwarded,5);assert.equal(f.peers[0].destroyed,true);
});
test('idle and total lifetime deadlines end idle or active tunnels',async t=>{
 const idle=await fixture(t,{limits:{idleTimeoutMs:10}}),a=await idle.tunnel();await a.closed;assert.equal(idle.peers[0].destroyed,true);
 let time=0;const f=await fixture(t,{limits:{tunnelTimeoutMs:5},testOnlyNow:()=>time}),c=await f.tunnel();
 time=5;c.socket.write('late');await c.closed;assert.equal(f.peers[0].written.length,0);
});
test('a packet arriving after the absolute idle deadline cannot reset that deadline',async t=>{
 let time=0;const f=await fixture(t,{limits:{idleTimeoutMs:5},testOnlyNow:()=>time}),c=await f.tunnel();
 time=5;c.socket.write('late');await c.closed;assert.equal(f.peers[0].written.length,0);
});
test('forwarding refresh rechecks total deadline before writing or accounting bytes',async t=>{
 let phase='initial',reads=0;
 const f=await fixture(t,{limits:{tunnelTimeoutMs:5,idleTimeoutMs:100},
  testOnlyNow:()=>phase==='initial'?0:++reads===1?4:5}),c=await f.tunnel();
 phase='boundary';f.peers[0].emit('data',Buffer.from('late'));await c.closed;
 assert.ok(!c.text().includes('late'));assert.equal(f.proxy.diagnostics().bytesForwarded,0);
});
test('forwarding refresh cannot replace an idle deadline reached on its second sample',async t=>{
 let phase='initial',reads=0;
 const f=await fixture(t,{limits:{tunnelTimeoutMs:100,idleTimeoutMs:5},
  testOnlyNow:()=>phase==='initial'?0:++reads===1?4:5}),c=await f.tunnel();
 phase='boundary';f.peers[0].emit('data',Buffer.from('late'));await c.closed;
 assert.ok(!c.text().includes('late'));assert.equal(f.proxy.diagnostics().bytesForwarded,0);
});
test('an invalid/regressed monotonic clock closes the broker rather than reviving work',async t=>{
 let time=10;const f=await fixture(t,{testOnlyNow:()=>time}),c=await f.tunnel();time=9;c.socket.write('no');await c.closed;
 assert.equal(f.proxy.diagnostics().closed,true);assert.equal(f.proxy.diagnostics().closeReason,'CLOCK_FAILED');assert.equal(f.peers[0].written.length,0);
});
test('loss of private directory ownership policy revokes listener before another dial',async t=>{
 const f=await fixture(t);chmodSync(f.dir,0o755);const c=await f.client();c.socket.write(request());await c.closed;
 assert.equal(f.proxy.diagnostics().closed,true);assert.equal(f.proxy.diagnostics().closeReason,'PATH_CHANGED');assert.equal(f.dials.length,0);
 chmodSync(f.dir,0o700);
});
