import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectProcessIdentity} from '../simulation/private-runtime-process-identity.mjs';

const pid=9001;
const boot='12345678-abcd-1234-abcd-1234567890ab';
const exe='/usr/bin/synthetic-node';
const expected={bootId:boot,startTicks:'9876543210123456789',executableLink:exe};
const paths={boot:'/proc/sys/kernel/random/boot_id',stat:'/proc/9001/stat',exe:'/proc/9001/exe'};
const stat=(ticks=expected.startTicks,state='S',comm='synthetic (proc) name')=>
  `${pid} (${comm}) ${[state,...Array(18).fill('0'),ticks].join(' ')}\n`;
function harness({bootIds=[boot,boot],stats=[stat(),stat()],links=[exe,exe],errorAt=-1}={}){
  const calls=[];
  let bootIndex=0,statIndex=0,linkIndex=0;
  const record=(kind,path)=>{
    calls.push({kind,path});
    if(calls.length===errorAt)throw Error('secret: BOGUS_TOKEN');
  };
  const readFile=async path=>{
    record('file',path);
    if(path===paths.boot)return bootIds[bootIndex++];
    if(path===paths.stat)return stats[statIndex++];
    throw Error('unexpected fixture path');
  };
  const readLink=async path=>{
    record('link',path);
    if(path===paths.exe)return links[linkIndex++];
    throw Error('unexpected fixture link');
  };
  return {calls,readFile,readLink};
}
const inspect=(fixture,changes={})=>inspectProcessIdentity({pid,expected,
  readFile:fixture.readFile,readLink:fixture.readLink,...changes});

test('P3-A static synthetic process is only reviewable, never authorized',async()=>{
  const f=harness();
  const report=await inspect(f);
  assert.deepEqual(report.issues,[]);
  assert.equal(report.decision,'REVIEWABLE');
  assert.equal(report.executionAuthorized,false);
  assert.equal(report.requiresExternalVerification,true);
  assert.equal(report.executableFingerprintVerified,false);
  assert.ok(Object.isFrozen(report)&&Object.isFrozen(report.issues));
  assert.deepEqual(f.calls,[
    {kind:'file',path:paths.boot},{kind:'file',path:paths.stat},
    {kind:'link',path:paths.exe},{kind:'file',path:paths.stat},
    {kind:'link',path:paths.exe},{kind:'file',path:paths.boot}
  ]);
});

test('P3-A PID reuse or executable replacement during double read blocks review',async()=>{
  const reused=await inspect(harness({stats:[stat(),stat('9876543210123456788')]}));
  assert.ok(reused.issues.includes('PROCESS_CHANGED_DURING_INSPECTION'));
  assert.ok(reused.issues.includes('START_IDENTITY_MISMATCH'));
  const replaced=await inspect(harness({links:[exe,'/usr/bin/synthetic-replacement']}));
  assert.ok(replaced.issues.includes('PROCESS_CHANGED_DURING_INSPECTION'));
  assert.ok(replaced.issues.includes('EXECUTABLE_LINK_MISMATCH'));
});

test('P3-A wrong boot, wrong start time and dead process fail closed',async()=>{
  const badBoot=await inspect(harness({bootIds:['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']}));
  assert.ok(badBoot.issues.includes('BOOT_ID_MISMATCH'));
  const badStart=await inspect(harness({stats:[stat('42'),stat('42')]}));
  assert.ok(badStart.issues.includes('START_IDENTITY_MISMATCH'));
  const dead=await inspect(harness({stats:[stat(expected.startTicks,'Z'),stat(expected.startTicks,'Z')]}));
  assert.ok(dead.issues.includes('PROCESS_NOT_LIVE'));
});

test('P3-A failure is sanitized; no process path or reader exception leaks',async()=>{
  const f=harness({errorAt:2});
  const report=await inspect(f);
  assert.deepEqual(report.issues,['PROCESS_IDENTITY_READ_UNAVAILABLE']);
  assert.equal(report.decision,'HOLD');
  assert.doesNotMatch(JSON.stringify(report),/BOGUS_TOKEN|synthetic-node|\/proc\//);
});

test('P3-A malformed proc stat and oversized payload are rejected',async()=>{
  for(const bad of ['9002 (wrong) S 0 1','garbage',stat().repeat(900),
    `${pid} (process) S ${Array(19).fill('0').join(' ')}`]){
    const report=await inspect(harness({stats:[bad,bad]}));
    assert.deepEqual(report.issues,['PROCESS_IDENTITY_MALFORMED']);
  }
});

test('P3-A unusual parenthesized process name is parsed without shelling out',async()=>{
  const report=await inspect(harness({stats:[stat(undefined,'S','a) b (c)'),stat(undefined,'S','a) b (c')]}));
  assert.equal(report.decision,'REVIEWABLE');
});

test('P3-A deleted executable links always hold, even when expected',async()=>{
  const deleted=exe+' (deleted)';
  const report=await inspect(harness({links:[deleted,deleted]}),{expected:{...expected,executableLink:deleted}});
  assert.ok(report.issues.includes('EXECUTABLE_LINK_DELETED'));
  assert.equal(report.executionAuthorized,false);
});

test('P3-A invalid expectations/reader handles never reach a reader',async()=>{
  for(const changes of [
    {pid:0},{pid:2147483648},
    {expected:{...expected,bootId:'bad'}},
    {expected:{...expected,startTicks:'0'}},
    {expected:{...expected,executableLink:'relative/path'}},
    {expected:{...expected,executableLink:'/file\ntoken'}},
    {expected:{...expected,secret:'value'}},
    {readFile:null},{readLink:null}
  ]){
    const f=harness();
    await assert.rejects(inspect(f,changes),/Invalid read-only process identity input/);
    assert.equal(f.calls.length,0);
  }
});

test('P3-A immutable input and untrusted data are never echoed in the report',async()=>{
  const f=harness();const before={...expected};
  const result=await inspect(f);
  assert.deepEqual(expected,before);
  assert.doesNotMatch(JSON.stringify(result),/987654321|12345678-abcd|synthetic-node/);
});
