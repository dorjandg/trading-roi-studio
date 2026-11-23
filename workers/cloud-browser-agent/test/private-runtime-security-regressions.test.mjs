// P3-A LOCAL PROPOSAL ONLY: adversarial synthetic regression cases.
// No real /proc access, process control, networking, credentials or tunnel calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectProcessIdentity} from '../simulation/private-runtime-process-identity.mjs';
import {planPrivateTunnelStartup} from '../simulation/private-runtime-startup-plan.mjs';

const pid=9001;
const boot='12345678-abcd-1234-abcd-1234567890ab';
const startTicks='9876543210123456789';
const exe='/usr/bin/synthetic-node';
const expected={bootId:boot,startTicks,executableLink:exe};
const stat=(ticks=startTicks,state='S')=>
  `${pid} (synthetic proc) ${[state,...Array(18).fill('0'),ticks].join(' ')}\n`;
function fixture({bootIds=[boot,boot],stats=[stat(),stat()],links=[exe,exe],failStep=0}={}){
  const calls=[]; let bi=0,si=0,li=0;
  const readFile=async path=>{
    calls.push(path);
    if(calls.length===failStep)throw Error('SECRET_SYNTHETIC_READER_FAILURE');
    if(path==='/proc/sys/kernel/random/boot_id')return bootIds[bi++];
    if(path===`/proc/${pid}/stat`)return stats[si++];
    throw Error('Unexpected test path');
  };
  const readLink=async path=>{
    calls.push(path);
    if(calls.length===failStep)throw Error('SECRET_SYNTHETIC_READER_FAILURE');
    if(path===`/proc/${pid}/exe`)return links[li++];
    throw Error('Unexpected test link');
  };
  return {readFile,readLink,calls};
}
const inspect=(f,changes={})=>inspectProcessIdentity({pid,expected,
  readFile:f.readFile,readLink:f.readLink,...changes});

const tunnelRef='synthetic-tunnel-p3a';
const generationId='synthetic-generation-p3a';
const state={phase:'OLD_TUNNEL_STOPPED',generationId,revision:7};
const ownershipInput={purpose:'activate',tunnelRef,observations:[],
  inventoryComplete:true,crossHostEvidence:'externally-verified-exclusive',
  nowMs:10000,inventoryObservedAtMs:9999,maxAgeMs:500};
const retiredProcessInspection={decision:'HOLD',issues:['PROCESS_IDENTITY_READ_UNAVAILABLE'],
  executionAuthorized:false,requiresExternalVerification:true};
const evidence={generationId,approvalFresh:true,approvalVerifiedExternally:true,
  oldTunnelExitVerifiedExternally:true,noConflictingOwnerVerifiedExternally:true};
const plan=(changes={})=>planPrivateTunnelStartup({state,tunnelRef,ownershipInput,
  retiredProcessInspection,evidence,...changes});

test('all six injected reader failures hold, sanitize and never gain authority',async()=>{
  for(let step=1;step<=6;step++){
    const outcome=await inspect(fixture({failStep:step}));
    assert.equal(outcome.decision,'HOLD');
    assert.deepEqual(outcome.issues,['PROCESS_IDENTITY_READ_UNAVAILABLE']);
    assert.equal(outcome.executionAuthorized,false);
    assert.doesNotMatch(JSON.stringify(outcome),/SECRET_SYNTHETIC_READER_FAILURE/);
  }
});

test('boot ID changes between reads cannot be reviewable',async()=>{
  const outcome=await inspect(fixture({bootIds:[boot,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']}));
  assert.equal(outcome.decision,'HOLD');
  assert.ok(outcome.issues.includes('PROCESS_CHANGED_DURING_INSPECTION'));
});

test('process state changes between reads conservatively hold',async()=>{
  const outcome=await inspect(fixture({stats:[stat(startTicks,'R'),stat(startTicks,'S')]}));
  assert.equal(outcome.decision,'HOLD');
  assert.ok(outcome.issues.includes('PROCESS_CHANGED_DURING_INSPECTION'));
});

test('both terminal kernel process states X and x hold',async()=>{
  for(const dead of ['X','x']){
    const outcome=await inspect(fixture({stats:[stat(startTicks,dead),stat(startTicks,dead)]}));
    assert.equal(outcome.decision,'HOLD');
    assert.ok(outcome.issues.includes('PROCESS_NOT_LIVE'));
  }
});

test('unexpected process-state marker cannot fake liveness',async()=>{
  const outcome=await inspect(fixture({stats:[stat(startTicks,'Q'),stat(startTicks,'Q')]}));
  assert.deepEqual(outcome.issues,['PROCESS_IDENTITY_MALFORMED']);
});

test('missing executable link cannot fake an expected path',async()=>{
  const outcome=await inspect(fixture({links:[undefined,undefined]}));
  assert.equal(outcome.decision,'HOLD');
  assert.deepEqual(outcome.issues,['PROCESS_IDENTITY_MALFORMED']);
});

test('expected process identity must not be taken from an inherited prototype',async()=>{
  const f=fixture();
  await assert.rejects(inspect(f,{expected:Object.create(expected)}),/Invalid read-only process identity input/);
  assert.equal(f.calls.length,0);
});

test('multibyte expected executable link must honor the byte cap',async()=>{
  const long='/tmp/'+'\u00e9'.repeat(600);
  const f=fixture({links:[long,long]});
  await assert.rejects(inspect(f,{expected:{...expected,executableLink:long}}),/Invalid read-only process identity input/);
  assert.equal(f.calls.length,0);
});

test('multibyte observed executable link must honor the byte cap',async()=>{
  const long='/tmp/'+'\u00e9'.repeat(600);
  const outcome=await inspect(fixture({links:[long,long]}));
  assert.deepEqual(outcome.issues,['PROCESS_IDENTITY_MALFORMED']);
});

test('startup must not treat inherited approval fields as independent verified claims',()=>{
  assert.throws(()=>plan({evidence:Object.create(evidence)}),/Invalid startup planning input/);
});

test('startup must not treat inherited retirement inspection as authenticated evidence',()=>{
  assert.throws(()=>plan({retiredProcessInspection:Object.create(retiredProcessInspection)}),/Invalid startup planning input/);
});

test('startup must not treat inherited ownership inventory as externally verified',()=>{
  assert.throws(()=>plan({ownershipInput:Object.create(ownershipInput)}),/Invalid startup planning input/);
});

test('startup must not treat inherited lifecycle state as valid state',()=>{
  assert.throws(()=>plan({state:Object.create(state)}),/Invalid startup planning input/);
});

test('read-unavailable retired process is unresolved, even when caller claims verified exit',()=>{
  const outcome=plan();
  assert.equal(outcome.decision,'HOLD');
  assert.deepEqual(outcome.reasons,['RETIRED_PROCESS_UNOBSERVABLE']);
  assert.equal(outcome.executionAuthorized,false);
  assert.equal(outcome.proposedState,null);
});

test('unknown owner state and stale ownership inventory are independently blocked',()=>{
  const owner={tunnelRef,hostId:'synthetic-host-a',generationId,pid:9111,
    observedAtMs:9998,startIdentity:'boot-ticks',executableFingerprint:'synthetic-hash',state:'unknown'};
  for(const changes of [{observations:[owner]},{inventoryObservedAtMs:200}]){
    const outcome=plan({ownershipInput:{...ownershipInput,...changes}});
    assert.equal(outcome.decision,'HOLD');
    assert.ok(outcome.reasons.includes('OWNERSHIP_HOLD'));
  }
});

test('external approval denial holds even for apparently empty inventory',()=>{
  const outcome=plan({evidence:{...evidence,approvalVerifiedExternally:false}});
  assert.equal(outcome.decision,'HOLD');
  assert.ok(outcome.reasons.includes('APPROVAL_REVIEW_REQUIRED'));
  assert.equal(outcome.executionAuthorized,false);
});
