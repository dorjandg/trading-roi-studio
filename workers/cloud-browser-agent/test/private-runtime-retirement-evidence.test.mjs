import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewRetirementEvidence} from '../simulation/private-runtime-retirement-evidence.mjs';

const D=x=>x.repeat(64);
const expected={resourceId:'synthetic-tunnel',ownerId:'old-owner',hostId:'host-a',
  generationId:'gen-old',leaseId:'lease-old',bootId:'boot-old',pid:9001,
  startTicks:'1234567890',executableFingerprint:'exe-fingerprint',
  fencingEpoch:18,lastJournalSequence:91,lastJournalDigest:D('a')};
const receipt={schemaVersion:1,resourceId:expected.resourceId,
  ownerId:expected.ownerId,hostId:expected.hostId,generationId:expected.generationId,
  leaseId:expected.leaseId,bootId:expected.bootId,pid:expected.pid,
  startTicks:expected.startTicks,executableFingerprint:expected.executableFingerprint,
  fencingEpoch:expected.fencingEpoch,journalSequence:92,
  previousDigest:D('a'),recordDigest:D('b'),phase:'COMMITTED',
  checkpoint:{intentSynced:true,routingFenced:true,requestsDrained:true,
    exitObserved:true,commitSynced:true,directorySynced:true,
    coordinatorReleaseCAS:true,intentOrder:1,fenceOrder:2,drainOrder:3,
    exitOrder:4,commitOrder:5,directoryOrder:6,casOrder:7},
  witness:{monitorId:'independent-supervisor',method:'pidfd-exit',
    generationId:'gen-old',leaseId:'lease-old',fencingEpoch:18,
    observedAtMs:1999,attestationDigest:D('c')}};
const fresh=()=>structuredClone(receipt);
const review=(r=receipt,extras={})=>reviewRetirementEvidence({expected,receipt:r,nowMs:2000,...extras});
const has=(r,issue)=>{const out=review(r);assert.equal(out.decision,'HOLD');assert.ok(out.issues.includes(issue));};

test('well-structured synthetic record is not a verified exit, lease, or execution permission',()=>{
  const before=structuredClone(receipt),r=review();
  assert.equal(r.decision,'STRUCTURE_REVIEWABLE');
  assert.equal(r.retirementVerified,false);
  assert.equal(r.attestationVerified,false);
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.requiresIndependentVerification,true);
  assert.equal(r.requiresDurableCoordinatorCAS,true);
  assert.deepEqual(receipt,before);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.issues));
  assert.doesNotMatch(JSON.stringify(r),/synthetic-tunnel|independent-supervisor|exe-fingerprint/);
});

test('PREPARED retirement is not committed and cannot show a safe exit',()=>{
  const r=fresh();r.phase='PREPARED';has(r,'RETIREMENT_NOT_COMMITTED');
});

test('every interrupted write, fence, drain, exit or durable commit window stays on HOLD',()=>{
  for(const key of Object.keys(receipt.checkpoint).filter(k=>typeof receipt.checkpoint[k]==='boolean')){
    const r=fresh();r.checkpoint[key]=false;
    has(r,'RETIREMENT_DURABILITY_OR_EXIT_UNCONFIRMED');
  }
});

test('reordered checkpoint claims never support retirement',()=>{
  for(const [key,val] of [['fenceOrder',1],['drainOrder',1],['exitOrder',3],['commitOrder',4],['directoryOrder',5],['casOrder',6]]){
    const r=fresh();r.checkpoint[key]=val;has(r,'RETIREMENT_ORDER_INVALID');
  }
});

test('cross-generation, PID reuse, boot change or executable change are rejected',()=>{
  for(const [key,val] of [['generationId','gen-new'],['pid',9002],
    ['bootId','boot-new'],['startTicks','987654321'],
    ['executableFingerprint','other-executable'],['hostId','host-b']]){
    const r=fresh();r[key]=val;has(r,'RETIREMENT_OWNER_IDENTITY_MISMATCH');
  }
});

test('lease epoch mismatch and witness scope mismatch hold separately',()=>{
  const e=fresh();e.fencingEpoch=19;has(e,'RETIREMENT_EPOCH_MISMATCH');
  for(const [k,v] of [['generationId','other-gen'],['leaseId','other-lease'],['fencingEpoch',19]]){
    const r=fresh();r.witness[k]=v;has(r,'RETIREMENT_WITNESS_SCOPE_MISMATCH');
  }
});

test('same-owner self witness is not independently attested',()=>{
  const r=fresh();r.witness.monitorId=r.ownerId;has(r,'RETIREMENT_WITNESS_NOT_INDEPENDENT');
});

test('record replay, journal gaps, backwards history and broken digest chain hold',()=>{
  for(const [k,v] of [['journalSequence',91],['journalSequence',93],
    ['previousDigest',D('d')],['recordDigest',D('a')]]){
    const r=fresh();r[k]=v;has(r,'RETIREMENT_CHAIN_NOT_ADVANCING');
  }
});

test('witness freshness enforces same-clock stale and future bounds',()=>{
  const r=fresh();r.witness.observedAtMs=1999;
  assert.equal(review(r,{nowMs:32000}).decision,'HOLD');
  const future=fresh();future.witness.observedAtMs=2001;
  has(future,'RETIREMENT_WITNESS_STALE');
  assert.equal(review(r,{nowMs:2000,maxAgeMs:1}).decision,'STRUCTURE_REVIEWABLE');
});

test('inherited fields, getters, symbols and extra secret fields fail before review',()=>{
  const prototype=Object.create(receipt);
  for(const r of [prototype,
    {...fresh(),secret:'TOKEN_SHOULD_NOT_APPEAR'},
    Object.defineProperty(fresh(),'leaseId',{get(){throw Error('SECRET_FROM_GETTER');}}),
    Object.assign(fresh(),{[Symbol('secret')]:true})]){
    assert.throws(()=>review(r),/^Error: Invalid synthetic retirement evidence input$/);
  }
});

test('bad attestation metadata and huge unsafe sequence numbers are rejected',()=>{
  const invalid=[
    {...fresh(),journalSequence:Number.MAX_SAFE_INTEGER},
    {...fresh(),recordDigest:'bad'},
    {...fresh(),witness:{...receipt.witness,method:'webhook-trust-me'}},
    {...fresh(),checkpoint:{...receipt.checkpoint,exitObserved:'true'}},
    {...fresh(),witness:{...receipt.witness,observedAtMs:-1}}
  ];
  for(const r of invalid)assert.throws(()=>review(r),/^Error: Invalid synthetic retirement evidence input$/);
});

test('no retrospective proof arises from a synthetic matching process observation',()=>{
  const r=review();
  assert.equal(r.retirementVerified,false);
  assert.equal(r.requiresIndependentVerification,true);
});
