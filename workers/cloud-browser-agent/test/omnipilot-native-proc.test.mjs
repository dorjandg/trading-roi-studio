import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {verifyNativeProcIsolation} from '../simulation/omnipilot-native-child.mjs';
import {nativeSandboxPlan} from '../simulation/omnipilot-native-runtime.mjs';

// Fixed synthetic kernel observations only. No actual proc-control opens,
// namespace, browser, network listener or installed profile is used here.
const root='71 60 0:60 / / ro,nosuid,nodev,relatime - tmpfs tmpfs rw';
const proc='72 71 0:61 / /proc rw,nosuid,nodev,noexec,relatime - proc proc rw';
const controls=['/proc/sys/kernel/randomize_va_space','/proc/sys/user/max_user_namespaces',
  '/proc/sysrq-trigger','/proc/irq/default_smp_affinity'];
const safeMounts=root+'\n'+proc+'\n';
function syntheticProc(options,run){
  const original=Object.fromEntries(['openSync','readSync','closeSync','readlinkSync','writeSync'].map(key=>[key,fs[key]]));
  const data=Buffer.isBuffer(options.mounts)?options.mounts:Buffer.from(options.mounts??safeMounts);
  const calls={opens:[],closes:[],links:[],writes:0,bytes:0};let offset=0;
  try{
    fs.openSync=(path,flags)=>{
      calls.opens.push({path,flags});
      if(path==='/proc/self/mountinfo')return 41;
      assert.ok(controls.includes(path),'only fixed protected controls may be opened');
      assert.equal(flags,fs.constants.O_WRONLY,'control opens cannot truncate or create');
      if(options.openControl===path)return 42;
      const code=options.controlError??'EACCES';
      throw Object.assign(Error('owned synthetic error details must not escape'),{code});
    };
    fs.readSync=(fd,buffer,start,length)=>{
      assert.equal(fd,41);
      if(options.readError)throw Error('owned synthetic read failure');
      const count=Math.min(length,options.chunkSize??17,data.length-offset);
      data.copy(buffer,start,offset,offset+count);offset+=count;calls.bytes+=count;return count;
    };
    fs.closeSync=fd=>{calls.closes.push(fd);if(options.closeError===true||options.closeError===fd)throw Error('owned synthetic close failure');};
    fs.readlinkSync=path=>{calls.links.push(path);assert.equal(path,'/proc/self');return options.selfLink??String(process.pid);};
    fs.writeSync=()=>{calls.writes++;throw Error('control data must never be written');};
    syncBuiltinESMExports();
    run(calls);
  }finally{Object.assign(fs,original);syncBuiltinESMExports();}
  return calls;
}

test('fixed plan permits Chromium private map writes while retaining read-only root and isolation flags',()=>{
  const plan=nativeSandboxPlan({installation:{node:'/opt/owned/bin/node',chromium:'/opt/owned/chromium-1194/chrome-linux/chrome',
    playwrightCore:'/opt/owned/playwright-core'},stage:'/tmp/omnipilot-native-owned',
    brokerSocket:'/tmp/omnipilot-native-owned/broker/egress.sock',controlSocket:'/tmp/omnipilot-native-owned/control/commands.sock',uid:1000,gid:1000});
  const remounts=plan.args.flatMap((value,index)=>value==='--remount-ro'?[plan.args[index+1]]:[]);
  assert.deepEqual(remounts,['/']);
  assert.equal(plan.args[plan.args.indexOf('--proc')+1],'/proc');
  for(const flag of ['--unshare-all','--die-with-parent','--new-session','--clearenv'])assert.ok(plan.args.includes(flag));
  assert.equal(plan.args[plan.args.indexOf('--cap-drop')+1],'ALL');
  for(const flag of ['--share-net','--disable-userns','--no-sandbox','--bind'])assert.ok(!plan.args.includes(flag));
});

test('private proc observations accept bounded fragmented reads and only fixed no-write control probes',()=>{
  const mounts=safeMounts+'73 71 0:62 / /tmp rw,nosuid,nodev shared:7 - tmpfs tmpfs rw,size=524288k\n';
  for(const controlError of ['EACCES','EPERM','EROFS']){
    const calls=syntheticProc({mounts,controlError},()=>assert.doesNotThrow(()=>verifyNativeProcIsolation()));
    assert.deepEqual(calls.opens,[{path:'/proc/self/mountinfo',flags:fs.constants.O_RDONLY},
      ...controls.map(path=>({path,flags:fs.constants.O_WRONLY}))]);
    assert.deepEqual(calls.closes,[41]);assert.deepEqual(calls.links,['/proc/self']);assert.equal(calls.writes,0);
    assert.equal(calls.bytes,Buffer.byteLength(mounts));
  }
});

test('writable root, unsafe proc flags, wrong filesystem and host-PID proc observations fail before control probes',()=>{
  const cases=[
    {mounts:safeMounts.replace('ro,nosuid,nodev','rw,nosuid,nodev')},
    {mounts:safeMounts.replace('ro,nosuid,nodev','ro,nosuid')},
    {mounts:safeMounts.replace('rw,nosuid,nodev,noexec','ro,nosuid,nodev,noexec')},
    {mounts:safeMounts.replace('rw,nosuid,nodev,noexec','rw,nosuid,nodev')},
    {mounts:safeMounts.replace('- proc proc rw','- tmpfs proc rw')},
    {mounts:safeMounts.replace('- proc proc rw','- proc proc ro')},
    {mounts:safeMounts.replace('0:61 / /proc','0:61 /borrowed /proc')},
    {selfLink:String(process.pid+1)},
  ];
  for(const fixture of cases){
    const calls=syntheticProc(fixture,()=>assert.throws(()=>verifyNativeProcIsolation(),{message:'NATIVE_PROC_REFUSED'}));
    assert.equal(calls.opens.length,1);assert.deepEqual(calls.closes,[41]);assert.equal(calls.writes,0);
  }
});

test('ambiguous, malformed, oversized and invalid UTF-8 mount evidence is bounded and refused',()=>{
  const cases=['',safeMounts.slice(0,-1),safeMounts+proc+'\n',safeMounts+root+'\n',
    safeMounts.replace('72 71','72  71'),safeMounts.replace('- proc proc rw','- proc proc'),
    safeMounts.replace('/proc','/proc\0'),safeMounts+'x'.repeat(65537),
    Buffer.concat([Buffer.from(safeMounts),Buffer.from([0xff,10])]),
    safeMounts+Array(255).fill('73 71 0:62 / /tmp rw - tmpfs tmpfs rw\n').join('')];
  for(const mounts of cases){
    const calls=syntheticProc({mounts,chunkSize:8192},()=>assert.throws(()=>verifyNativeProcIsolation(),{message:'NATIVE_PROC_REFUSED'}));
    assert.ok(calls.bytes<=65537);assert.equal(calls.opens.length,1);assert.deepEqual(calls.closes,[41]);assert.equal(calls.writes,0);
  }
});

test('unexpected writable control is closed before refusal and no later control is attempted',()=>{
  for(const path of controls){
    const calls=syntheticProc({openControl:path},()=>assert.throws(()=>verifyNativeProcIsolation(),{message:'NATIVE_PROC_REFUSED'}));
    assert.deepEqual(calls.closes,[41,42]);assert.equal(calls.opens.at(-1).path,path);assert.equal(calls.writes,0);
  }
  for(const controlError of ['ENOENT','EIO','ELOOP']){
    const calls=syntheticProc({controlError},()=>assert.throws(()=>verifyNativeProcIsolation(),{message:'NATIVE_PROC_REFUSED'}));
    assert.equal(calls.opens.length,2);assert.deepEqual(calls.closes,[41]);assert.equal(calls.writes,0);
  }
});

test('mount read and descriptor-close failures remain sanitized and prevent control probes',()=>{
  for(const fixture of [{readError:true},{closeError:true}]){
    const calls=syntheticProc(fixture,()=>assert.throws(()=>verifyNativeProcIsolation(),{message:'NATIVE_PROC_REFUSED'}));
    assert.equal(calls.opens.length,1);assert.deepEqual(calls.closes,[41]);assert.equal(calls.writes,0);
  }
  const calls=syntheticProc({openControl:controls[0],closeError:42},()=>assert.throws(()=>verifyNativeProcIsolation(),{message:'NATIVE_PROC_REFUSED'}));
  assert.deepEqual(calls.closes,[41,42]);assert.equal(calls.opens.at(-1).path,controls[0]);assert.equal(calls.writes,0);
});
