import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {request} from 'node:http';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync,realpathSync,chmodSync} from 'node:fs';
import {NATIVE_LIMITS,canonicalData,createNativeFramedChannel,createNativeCommandClient} from '../simulation/omnipilot-native-channel.mjs';
import {CHILD_ENV,checkChildEnvironment,assertNativeStartupLive,advanceNativeBridgeBudget} from '../simulation/omnipilot-native-child.mjs';
import {nativeSandboxPlan,parseProcessIdentity,inspectNativeInstallation,createNativeOmniPilotRuntime,finalNativeShutdownReceipt} from '../simulation/omnipilot-native-runtime.mjs';
import {createOmniPilotMcpServer} from '../simulation/omnipilot-tunnel-mcp.mjs';

// Synthetic private streams, pure mount/identity checks, and owned MCP loopback.
// No bwrap, browser, destination broker, public network or installed profile runs.
const defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const bytes=value=>Buffer.from(JSON.stringify(value));
const frame=raw=>{const body=Buffer.isBuffer(raw)?raw:bytes(raw),out=Buffer.alloc(body.length+4);out.writeUInt32BE(body.length);body.copy(out,4);return out;};
const result=(id=1,sequence=1)=>({v:1,kind:'result',id,result:{op:'status',sequence,untrustedContent:true,data:{tabCount:0,selectedTabId:null}}});
class Socket extends EventEmitter{
  destroyed=false;writes=[];
  write(value,callback){this.writes.push(Buffer.from(value));queueMicrotask(()=>callback?.());return true;}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.emit('close');}
}
function fakeNow(t,value){
  const own=Object.getOwnPropertyDescriptor(performance,'now');
  Object.defineProperty(performance,'now',{configurable:true,value});
  t.after(()=>{if(own)Object.defineProperty(performance,'now',own);else delete performance.now;});
}

test('fixed mount plan excludes host roots, parent directories, credentials and inherited environment',()=>{
  const plan=nativeSandboxPlan({installation:{node:'/opt/owned/bin/node',chromium:'/opt/owned/chromium-1194/chrome-linux/chrome',
    playwrightCore:'/opt/owned/playwright-core'},stage:'/tmp/omnipilot-native-owned',
    brokerSocket:'/tmp/omnipilot-native-owned/broker/egress.sock',controlSocket:'/tmp/omnipilot-native-owned/control/commands.sock',uid:1000,gid:1000});
  const mounts=[];for(let i=0;i<plan.args.length;i++)if(plan.args[i]==='--ro-bind')mounts.push([plan.args[i+1],plan.args[i+2]]);
  for(const [source] of mounts)assert.ok(!['/','/home','/root','/workspaces','/etc','/usr','/tmp/omnipilot-native-owned',
    '/tmp/omnipilot-native-owned/broker','/tmp/omnipilot-native-owned/control'].includes(source));
  assert.deepEqual(mounts.filter(([,target])=>target.startsWith('/run/omnipilot/')).map(([,target])=>target).sort(),
    ['/run/omnipilot/broker.sock','/run/omnipilot/control.sock']);
  for(const flag of ['--unshare-all','--die-with-parent','--new-session','--clearenv','--cap-drop','--remount-ro'])assert.ok(plan.args.includes(flag));
  for(const flag of ['--share-net','--ro-bind-try','--bind','--disable-userns','--not-a-security-boundary'])assert.ok(!plan.args.includes(flag));
  assert.deepEqual(Object.keys(plan.env).sort(),['LANG','LC_ALL','PATH']);
  assert.deepEqual(plan.stdio,['ignore','pipe','pipe','pipe']);assert.ok(Object.isFrozen(plan.args));
});

test('plan and production config reject broad paths, caller flags, borrowed sockets and invalid tokens',async()=>{
  const common={installation:{node:'/opt/node',chromium:'/opt/chrome-linux/chrome',playwrightCore:'/opt/playwright-core'},
    stage:'/tmp/omnipilot-native-owned',brokerSocket:'/tmp/omnipilot-native-owned/broker/e.sock',
    controlSocket:'/tmp/omnipilot-native-owned/control/c.sock',uid:1000,gid:1000};
  for(const changed of [{stage:'/'},{stage:'/home'},{controlSocket:'/tmp/other/c.sock'},{brokerSocket:'/tmp/other/e.sock'},
    {installation:{...common.installation,node:'/tmp/../root/node'}},{uid:-1}])assert.throws(()=>nativeSandboxPlan({...common,...changed}));
  await assert.rejects(createNativeOmniPilotRuntime({installation:common.installation,bearerToken:'short'}));
  await assert.rejects(createNativeOmniPilotRuntime({installation:common.installation,bearerToken:'x'.repeat(32),testOnlyDial(){}}));
  await assert.rejects(createNativeOmniPilotRuntime({installation:{...common.installation,env:{}},bearerToken:'x'.repeat(32)}));
});

test('installation preflight refuses symlink and writable ancestry before any launcher can start',()=>{
  const dir=mkdtempSync('/tmp/omnipilot-native-install-test-');
  try{
    const unsafe=dir+'/unsafe';mkdirSync(unsafe,{mode:0o777});chmodSync(unsafe,0o777);
    // chmod is necessary when the process umask narrows mkdir's requested mode.
    const target=unsafe+'/node';writeFileSync(target,'inert',{mode:0o700});
    const alias=dir+'/node';symlinkSync(realpathSync(process.execPath),alias);
    assert.throws(()=>inspectNativeInstallation({node:alias,chromium:target,playwrightCore:dir+'/playwright-core'}));
    assert.throws(()=>inspectNativeInstallation({node:realpathSync(process.execPath),chromium:target,playwrightCore:dir+'/playwright-core'}),
      {code:'NATIVE_INSTALLATION_REFUSED'});
  }finally{rmSync(dir,{recursive:true});}
});

test('process ownership parser preserves start identity and recognizes namespace init without PID guessing',()=>{
  const fields=['S','123',...Array(17).fill('0'),'987654',...Array(5).fill('0')];
  const parsed=parseProcessIdentity('456 (owned ) reaper) '+fields.join(' '),'Name:\towned\nUid:\t1000\t1000\t1000\t1000\nNSpid:\t456\t1\n');
  assert.equal(parsed.pid,456);assert.equal(parsed.ppid,123);assert.equal(parsed.start,'987654');assert.equal(parsed.innerPid,1);
  assert.equal(parsed.uid,1000);assert.ok(Object.isFrozen(parsed));
  assert.throws(()=>parseProcessIdentity('456 bad','NSpid:\t456 1'));
  assert.throws(()=>parseProcessIdentity('456 (owned) '+fields.join(' '),'Uid:\t1000\n'));
});

test('child environmental evidence rejects inherited secrets, extra interfaces and unrecognized namespace forms',()=>{
  const ids=Object.fromEntries(['user','pid','mnt','net','ipc','uts','time'].map((key,i)=>[key,key+':['+(100+i)+']']));
  const interfaces={lo:[{address:'127.0.0.1',internal:true}]};
  assert.doesNotThrow(()=>checkChildEnvironment({...CHILD_ENV},interfaces,ids));
  for(const env of [{...CHILD_ENV,HTTP_PROXY:'http://untrusted'},{...CHILD_ENV,OMNIPILOT_BEARER:'synthetic'},
    {...CHILD_ENV,HOME:'/home/codespace'},{...CHILD_ENV,NODE_OPTIONS:'--inspect'}])assert.throws(()=>checkChildEnvironment(env,interfaces,ids));
  assert.throws(()=>checkChildEnvironment({...CHILD_ENV},{...interfaces,eth0:[{address:'192.0.2.1',internal:false}]},ids));
  assert.throws(()=>checkChildEnvironment({...CHILD_ENV},interfaces,{...ids,time:'caller asserted safe'}));
});

test('canonical protocol rejects duplicate fields, alternate encodings, prototype names and invalid Unicode',()=>{
  for(const raw of ['{"v":1,"v":2}','{ "v":1}','{"__proto__":{}}','{"value":1e999}','{"value":"\\ud800"}',
    '\ufeff{"v":1}','{"value":-0}','{"v":1}\n'])assert.throws(()=>canonicalData(Buffer.from(raw),8192));
  assert.throws(()=>canonicalData(Buffer.from([0xff]),8192));assert.throws(()=>canonicalData(Buffer.alloc(8193),8192));
  const value=canonicalData(bytes({v:1,items:['owned']}),8192);
  assert.ok(Object.isFrozen(value));assert.ok(Object.isFrozen(value.items));
});

test('fragmented bounded frames preserve one immutable message without trusting TCP chunk boundaries',()=>{
  const socket=new Socket(),messages=[];let failures=0;
  const channel=createNativeFramedChannel(socket,{maxReadBytes:8192,maxWriteBytes:8192,onMessage:value=>messages.push(value),onFailure:()=>failures++});
  const input=frame({v:1,kind:'start'});
  for(const byte of input)socket.emit('data',Buffer.from([byte]));
  assert.deepEqual(messages,[{v:1,kind:'start'}]);assert.ok(Object.isFrozen(messages[0]));assert.equal(failures,0);
  channel.close();assert.equal(failures,1);
});

test('oversized, malformed and burst frames revoke the channel before another message can dispatch',()=>{
  for(const input of [Buffer.from([0,0,32,1]),frame(Buffer.from('{"a":1,"a":2}')),
    Buffer.concat(Array(5).fill(frame({v:1})))]){
    const socket=new Socket();let failures=0,count=0;
    const channel=createNativeFramedChannel(socket,{maxReadBytes:8192,maxWriteBytes:8192,onMessage:()=>count++,onFailure:()=>failures++});
    socket.emit('data',input);assert.equal(failures,1);assert.equal(channel.diagnostics().closed,true);
    socket.emit('data',frame({v:1}));assert.ok(count<=4);assert.equal(failures,1);
  }
});

test('expiry after frame encoding prevents even the first write',async t=>{
  const socket=new Socket();let failures=0,reads=0;
  fakeNow(t,()=>++reads===1?0:11);
  const channel=createNativeFramedChannel(socket,{maxReadBytes:8192,maxWriteBytes:8192,onMessage(){},onFailure:()=>failures++});
  await assert.rejects(channel.send({v:1,kind:'start'},10));
  assert.equal(socket.writes.length,0);assert.equal(failures,1);
});

test('overdue local write completion revokes before rejecting the sender promise',async t=>{
  const socket=new Socket(),events=[];let reads=0;
  fakeNow(t,()=>[0,1,11][Math.min(reads++,2)]);
  const channel=createNativeFramedChannel(socket,{maxReadBytes:8192,maxWriteBytes:8192,onMessage(){},onFailure:()=>events.push('revoke')});
  await channel.send({v:1},10).then(()=>assert.fail('late success'),()=>events.push('rejected'));
  assert.deepEqual(events,['revoke','rejected']);assert.equal(socket.writes.length,1);
});

test('one-command client validates input before send and keeps external optional fields immutable',async()=>{
  const sent=[];let halted=0;const client=createNativeCommandClient({send:message=>{sent.push(message);},halt:()=>halted++});
  await assert.rejects(client.adapter.execute({op:'status',expiresNs:'caller-value'}),{code:'INVALID_INPUT'});
  await assert.rejects(client.adapter.execute({op:'status'},{expiresNs:'caller-string'}),{code:'INVALID_INPUT'});
  assert.equal(sent.length,0);
  const pending=client.adapter.execute({op:'screenshot',tabId:'tab-1'});
  assert.equal(sent.length,1);assert.ok(Object.isFrozen(sent[0].command));assert.ok(!Object.hasOwn(sent[0].command,'width'));
  await assert.rejects(client.adapter.execute({op:'status'}),{code:'QUEUE_FULL'});
  client.stop();await assert.rejects(pending,{code:'OWNER_STOPPED',dispatched:true,outcomeUnknown:true});assert.equal(halted,0);
});

test('parent-generated expiry can only shorten the adapter budget and is never reset for IPC',async()=>{
  const sent=[];const client=createNativeCommandClient({send:message=>sent.push(message),halt(){}});
  const expiry=process.hrtime.bigint()+500000000n;
  const pending=client.adapter.execute({op:'status',timeoutMs:15000},Object.freeze({expiresNs:expiry}));
  assert.equal(sent[0].expiresNs,expiry.toString());assert.ok(!Object.hasOwn(sent[0].command,'expiresNs'));
  client.accept(canonicalData(bytes(result()),8192));await pending;
  const next=client.adapter.execute({op:'status',timeoutMs:100},Object.freeze({expiresNs:process.hrtime.bigint()+10000000000n}));
  assert.ok(BigInt(sent[1].expiresNs)<process.hrtime.bigint()+1000000000n);
  client.accept(canonicalData(bytes(result(2,2)),8192));await next;
});

test('already expired owner work never reaches send and permanently revokes the client',async()=>{
  let sends=0,halts=0;const client=createNativeCommandClient({send(){sends++;},halt(){halts++;}});
  await assert.rejects(client.adapter.execute({op:'status'},Object.freeze({expiresNs:process.hrtime.bigint()-1n})),
    {code:'OPERATION_UNCERTAIN',dispatched:false,outcomeUnknown:false});
  assert.equal(sends,0);assert.equal(halts,1);assert.equal(client.diagnostics().stopped,true);
});

test('wrong, malformed and replayed result bindings halt before pending ownership releases',async()=>{
  for(const reply of [result(2),{...result(),result:{...result().result,untrustedContent:false}},
    {v:1,kind:'error',id:1,error:{code:'raw-secret',dispatched:true,outcomeUnknown:true,retrySafe:false}}]){
    let busyAtHalt;const client=createNativeCommandClient({send(){},halt(){busyAtHalt=client.diagnostics().busy;}});
    const pending=client.adapter.execute({op:'status'});client.accept(reply);
    await assert.rejects(pending,{code:'OPERATION_UNCERTAIN',dispatched:true,outcomeUnknown:true});
    assert.equal(busyAtHalt,true);assert.equal(client.diagnostics().busy,false);
    await assert.rejects(client.adapter.execute({op:'status'}),{code:'OWNER_STOPPED'});
  }
  let halted=0;const client=createNativeCommandClient({send(){},halt(){halted++;}});
  const pending=client.adapter.execute({op:'status'});client.accept(result());await pending;
  client.accept(result());assert.equal(halted,1);
});

test('an overdue result cannot win against an undelivered timer callback',async()=>{
  let busyAtHalt;const client=createNativeCommandClient({send(){},halt(){busyAtHalt=client.diagnostics().busy;}});
  const pending=client.adapter.execute({op:'status',timeoutMs:10});
  const end=performance.now()+20;while(performance.now()<end){}
  client.accept(result());await assert.rejects(pending,{code:'OPERATION_UNCERTAIN',dispatched:true,outcomeUnknown:true});
  assert.equal(busyAtHalt,true);
});

test('channel loss and uncertain child errors halt once before rejection and prohibit resumption',async()=>{
  for(const kind of ['lost','uncertain']){
    const events=[];const client=createNativeCommandClient({send(){},halt(){events.push('revoke');}});
    const pending=client.adapter.execute({op:'status'}).catch(error=>{events.push('rejected');throw error;});
    if(kind==='lost')client.poison();else client.accept({v:1,kind:'error',id:1,error:{code:'OPERATION_UNCERTAIN',dispatched:true,outcomeUnknown:true,retrySafe:false}});
    await assert.rejects(pending,{code:'OPERATION_UNCERTAIN'});assert.deepEqual(events,['revoke','rejected']);
    client.poison();assert.equal(events.length,2);
  }
});

test('bridge phase and idle transitions cannot renew a budget that expired at the sampled instant',t=>{
  let now=10;fakeNow(t,()=>now);
  const connecting={done:false,bytes:0,deadline:10,idleDeadline:100},before={...connecting};
  assert.equal(advanceNativeBridgeBudget(connecting,'connected'),false);assert.deepEqual(connecting,before);
  const idle={done:false,bytes:12,deadline:100,idleDeadline:10};
  assert.equal(advanceNativeBridgeBudget(idle,'forward',3),false);assert.equal(idle.bytes,12);assert.equal(idle.idleDeadline,10);
  now=9;assert.equal(advanceNativeBridgeBudget(idle,'forward',3),true);assert.equal(idle.bytes,15);
  now=100;assert.equal(advanceNativeBridgeBudget(idle,'forward',1),false);assert.equal(idle.bytes,15);
  now=0;assert.equal(advanceNativeBridgeBudget({done:false,bytes:NATIVE_LIMITS.bridgeBytes,deadline:100,idleDeadline:100},'forward',1),false);
});

test('resource acquired after startup revocation is disposed before any later launch step',async()=>{
  const late=defer(),events=[];let closed=false;
  const acquisition=(async()=>{const resource=await late.promise;
    assertNativeStartupLive(closed,performance.now()+1000,()=>resource.close());events.push('launch');})();
  closed=true;late.resolve({close(){events.push('dispose');}});
  await assert.rejects(acquisition,{message:'NATIVE_START_REVOKED'});assert.deepEqual(events,['dispose']);
  assert.throws(()=>assertNativeStartupLive(false,performance.now()-1,()=>events.push('late-dispose')));
  assert.deepEqual(events,['dispose','late-dispose']);
});

test('shutdown receipt preserves completed cleanup but marks synchronous cleanup that finished after budget',t=>{
  let now=9;fakeNow(t,()=>now);
  const observed={namespaceInitGone:true,cleanupComplete:true,shutdownTimedOut:false};
  assert.equal(finalNativeShutdownReceipt(observed,10).shutdownTimedOut,false);
  now=10;const late=finalNativeShutdownReceipt(observed,10);
  assert.equal(late.shutdownTimedOut,true);assert.equal(late.cleanupComplete,true);assert.ok(Object.isFrozen(late));
  now=0;assert.equal(finalNativeShutdownReceipt({...observed,shutdownTimedOut:true},10).shutdownTimedOut,true);
});

test('MCP supplies an immutable owner-only expiry that the native client preserves exactly',async t=>{
  const token='synthetic_native_mcp_deadline_token_123456789';let ownerDeadline,wire;
  const client=createNativeCommandClient({send(message){wire=message;queueMicrotask(()=>client.accept(result()));},halt(){}});
  const server=await createOmniPilotMcpServer({bearerToken:token,commandTimeoutMs:500,stop(){client.stop();},
    adapter:{execute(command,deadline){ownerDeadline=deadline;return client.adapter.execute(command,deadline);}}});
  t.after(()=>server.close());
  const url=new URL(server.url),body=bytes({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'omnipilot_browser',arguments:{command:{op:'status',timeoutMs:15000}}}});
  const value=await new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port:url.port,path:'/mcp',method:'POST',agent:false,
      headers:{authorization:'Bearer '+token,'content-type':'application/json','content-length':body.length}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);
      res.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){reject(error);}});
    });req.on('error',reject);req.end(body);
  });
  assert.equal(value.result.isError,false);assert.ok(Object.isFrozen(ownerDeadline));assert.equal(typeof ownerDeadline.expiresNs,'bigint');
  assert.equal(wire.expiresNs,ownerDeadline.expiresNs.toString());assert.ok(!Object.hasOwn(wire.command,'expiresNs'));
  assert.ok(ownerDeadline.expiresNs<process.hrtime.bigint()+1000000000n);
});
