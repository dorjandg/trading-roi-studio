import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {parseIdentity,matchesOwnedSignalTarget,assessCanaries,assessDeathAcceptance,canObserveClosedSockets,NAMESPACE_PROBE,
  knownNamespaceEntryRefusal,canContinueAfterUnverifiedCanary,ownerAcceptanceStatus}
  from '../simulation/run-omnipilot-native-owner-acceptance.mjs';

// Pure synthetic observations. The embedded namespace program is syntax checked
// only; these tests never open listeners, signal processes, run nsenter or launch
// a browser. They do not establish real confinement or shutdown acceptance.
const namespaces=Object.fromEntries(['user','pid','mnt','net','ipc','uts','time'].map((name,i)=>[name,name+':['+(100+i)+']']));
const owner={pid:456,ppid:123,start:'987654',uid:1000,state:'S',ns:namespaces};
const before={tcpConnections:1,tcpMarkers:1,udpMessages:1,udpMarkers:1};
const expected={net:namespaces.net,pid:namespaces.pid,hostNet:'net:[9]',healthy:true};
const controls={tcpNonceRoundTrip:true,udpNonceRoundTrip:true};
const probe={attempts:{tcp:1,udp:1},namespaces:{net:namespaces.net,pid:namespaces.pid},loopbackOnly:true,
  routeInterfaces:['lo'],hostMarkerVisible:false,cleanEnvironment:true,
  tcp:{connected:false,code:'ECONNREFUSED',hostNonceAcknowledged:false},udp:{sendResult:'RETURNED',hostNonceAcknowledged:false}};
const gone={init:'gone',driver:'gone',wrapper:'gone',capturedInactive:true};
const closed={stopped:true,namespaceInitGone:true,processExitObserved:true,controlClosed:true,brokerClosed:true,
  brokerCloseComplete:true,cleanupComplete:true,shutdownTimedOut:false};

test('identity evidence retains start time and namespace PID with parentheses in the process name',()=>{
  const fields=['S','123',...Array(17).fill('0'),'987654',...Array(5).fill('0')];
  const value=parseIdentity('456 (owned ) process) '+fields.join(' '),'Uid:\t1000\t1000\t1000\t1000\nNSpid:\t456\t2\n');
  assert.equal(value.pid,456);assert.equal(value.ppid,123);assert.equal(value.start,'987654');assert.equal(value.innerPid,2);
  for(const [stat,status] of [['456 truncated','Uid: 1000\nNSpid: 2\n'],
    ['456 (owned) '+fields.join(' '),'Uid: 1000\n'],['x'.repeat(8193),'Uid: 1000\nNSpid: 2\n']])
    assert.throws(()=>parseIdentity(stat,status),{code:'ACCEPTANCE_IDENTITY_REFUSED'});
});

test('signal eligibility refuses PID reuse, changed ownership, reparenting and unrecognized namespaces',()=>{
  assert.equal(matchesOwnedSignalTarget(owner,owner,namespaces),true);
  for(const update of [{pid:457},{start:'987655'},{uid:1001},{ppid:999},{state:'Z'}])
    assert.equal(matchesOwnedSignalTarget(owner,{...owner,...update},namespaces),false);
  assert.equal(matchesOwnedSignalTarget(owner,owner,{...namespaces,net:'net:[999]'}),false);
  assert.equal(matchesOwnedSignalTarget({...owner,ns:undefined},owner,namespaces),false);
  const target={...namespaces,net:'net:[200]',mnt:'mnt:[201]'};
  assert.equal(matchesOwnedSignalTarget({...owner,allowedNs:target},owner,target),true);
  assert.equal(matchesOwnedSignalTarget({...owner,allowedNs:target},owner,{...target,user:'user:[999]'}),false);
});

test('zero canary packets require working nonce round-trips and healthy owned listeners',()=>{
  assert.equal(assessCanaries(probe,before,{...before},expected,controls).passed,true);
  for(const changed of [{tcpNonceRoundTrip:false},{udpNonceRoundTrip:false}])
    assert.equal(assessCanaries(probe,before,{...before},expected,{...controls,...changed}).passed,false);
  assert.equal(assessCanaries(probe,before,{...before},{...expected,healthy:false},controls).passed,false);
  assert.equal(assessCanaries(probe,{...before,udpMarkers:0},{...before,udpMarkers:0},expected,controls).passed,false);
});

test('any host receipt, nonce acknowledgement or wrong namespace invalidates the canary result',()=>{
  for(const key of Object.keys(before))assert.equal(assessCanaries(probe,before,{...before,[key]:2},expected,controls).passed,false);
  for(const changed of [{namespaces:{...probe.namespaces,net:'net:[9]'}},{routeInterfaces:['eth0']},
    {hostMarkerVisible:true},{cleanEnvironment:false},{tcp:{...probe.tcp,hostNonceAcknowledged:true}},
    {udp:{...probe.udp,hostNonceAcknowledged:true}}])
    assert.equal(assessCanaries({...probe,...changed},before,{...before},expected,controls).passed,false);
});

test('UDP send return is not refusal evidence and a child bridge port collision is not a host connection',()=>{
  const collision={...probe,tcp:{connected:true,code:'CONNECTED_NO_ACK',hostNonceAcknowledged:false}};
  const result=assessCanaries(collision,before,{...before},expected,controls);
  assert.equal(result.passed,true);assert.equal(result.udpSendResult,'RETURNED');assert.equal(result.udpSendResultUsedAsRefusalProof,false);
  assert.equal(result.hostTcpObservedDelta,0);assert.equal(result.hostUdpObservedDelta,0);
});

test('socket observation cannot itself initiate the shutdown under test',()=>{
  assert.equal(canObserveClosedSockets(gone,'gone',undefined),true);
  assert.equal(canObserveClosedSockets(gone,'alive',closed),true);
  for(const changed of [{init:'alive'},{driver:'alive'},{wrapper:'unknown'},{capturedInactive:false}])
    assert.equal(canObserveClosedSockets({...gone,...changed},'gone',closed),false);
  assert.equal(canObserveClosedSockets(gone,'alive',undefined),false);
  for(const key of ['stopped','namespaceInitGone','processExitObserved','controlClosed','brokerClosed','brokerCloseComplete','cleanupComplete'])
    assert.equal(canObserveClosedSockets(gone,'alive',{...closed,[key]:false}),false);
  assert.equal(canObserveClosedSockets(gone,'alive',{...closed,shutdownTimedOut:true}),false);
});

test('fallback cleanup and failed initial observation cannot become passing parent or driver death acceptance',()=>{
  const cleanup={passed:true,containmentComplete:true,forcedFallback:false,stageRemoved:true};
  assert.equal(assessDeathAcceptance({passed:true},cleanup,true),true);
  for(const changed of [{forcedFallback:true},{passed:false},{containmentComplete:false},{stageRemoved:false}])
    assert.equal(assessDeathAcceptance({passed:true},{...cleanup,...changed},true),false);
  assert.equal(assessDeathAcceptance({passed:false},cleanup,true),false);
  assert.equal(assessDeathAcceptance({passed:true},cleanup,false),false);
});

test('the fixed namespace probe parses as a module without executing any of its operations',()=>{
  const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:NAMESPACE_PROBE,encoding:'utf8',timeout:3000,
    maxBuffer:8192,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8'},stdio:['pipe','pipe','pipe']});
  assert.equal(result.status,0);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.equal(result.stderr,'');
});

test('only the exact timely nsenter IPC entry refusal is classified as an unverified diagnostic gate',()=>{
  const stderr="nsenter: reassociate to namespace 'ns/ipc' failed: Operation not permitted\n";
  assert.equal(knownNamespaceEntryRefusal(1,null,stderr,0,false),true);
  for(const args of [[0,null,stderr,0,false],[2,null,stderr,0,false],[1,'SIGKILL',stderr,0,false],
    [1,null,stderr,1,false],[1,null,stderr,0,true],[1,null,stderr.trim(),0,false],
    [1,null,stderr.replace('ns/ipc','ns/net'),0,false],[1,null,stderr+'extra output\n',0,false],
    [1,null,'Error: PROBE_NAMESPACE_REFUSED\n',0,false],[1,null,'',0,false]])
    assert.equal(knownNamespaceEntryRefusal(...args),false);
});

test('independent work after entry refusal requires verified normal cleanup and cannot accept a breach or unrelated error',()=>{
  const canary={passed:false,status:'unverified',code:'ACCEPTANCE_NSENTER_ENTRY_REFUSED'};
  const cleanup={passed:true,forcedFallback:false,productionCleanupVerified:true,
    stageCleanup:{alreadyAbsent:true,removedByAcceptanceObserver:false}};
  assert.equal(canContinueAfterUnverifiedCanary(canary,cleanup),true);
  for(const changed of [{passed:true},{status:'failed'},{code:'ACCEPTANCE_NSENTER_UNAVAILABLE'},
    {code:'ACCEPTANCE_PROBE_OUTPUT'},{code:'ACCEPTANCE_CANARIES_FAILED'}])
    assert.equal(canContinueAfterUnverifiedCanary({...canary,...changed},cleanup),false);
  for(const changed of [{passed:false},{forcedFallback:true},{productionCleanupVerified:false},
    {stageCleanup:{alreadyAbsent:false,removedByAcceptanceObserver:true}}])
    assert.equal(canContinueAfterUnverifiedCanary(canary,{...cleanup,...changed}),false);
});

test('later HTTPS and death passes cannot turn the unverified canary gate into aggregate success',()=>{
  const other={publicHttps:{passed:true},parentDeath:{passed:true},childDeath:{passed:true}};
  const unverified={passed:false,status:'unverified',code:'ACCEPTANCE_NSENTER_ENTRY_REFUSED'};
  assert.equal(ownerAcceptanceStatus({...other,canaries:unverified}),'incomplete');
  assert.equal(ownerAcceptanceStatus({...other,canaries:{passed:true}}),'passed');
  assert.equal(ownerAcceptanceStatus({...other,canaries:{...unverified,code:'ACCEPTANCE_PROBE_OUTPUT'}}),'failed');
  for(const name of ['publicHttps','parentDeath','childDeath'])
    assert.equal(ownerAcceptanceStatus({...other,canaries:unverified,[name]:{passed:false}}),'failed');
  assert.equal(ownerAcceptanceStatus(other),'failed');
});
