import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewRetirementWitnessEnvelope as review} from '../simulation/private-runtime-retirement-witness-contract.mjs';
const D=c=>c.repeat(64),copy=x=>structuredClone(x);
const owner={resourceId:'synthetic-resource',ownerId:'synthetic-old-owner',hostId:'synthetic-host',
  bootId:'boot-1',pid:30001,startTicks:'123456789',executableFingerprint:'exe-hash',
  generationId:'old-gen',leaseId:'lease-old',fencingEpoch:7};
const challenge={schemaVersion:1,nonce:D('a'),resourceId:owner.resourceId,
  ownerId:owner.ownerId,generationId:owner.generationId,leaseId:owner.leaseId,
  fencingEpoch:7,coordinatorRevision:21,journalDigest:D('b'),issuedAtMs:1000,expiresAtMs:2500};
const report={schemaVersion:1,monitorId:'independent-monitor',keyId:'signer-key-1',
  signatureAlgorithm:'Ed25519',signatureDigest:D('c'),challengeNonce:D('a'),
  coordinatorRevision:21,journalDigest:D('b'),...owner,
  method:'pidfd-waitid',descriptorBinding:'pre-opened-generation-bound',
  status:'EXIT_OBSERVED',exitObservedAtMs:1800,signedAtMs:1900,exitEvidenceDigest:D('d')};
const sample=()=>({owner:copy(owner),challenge:copy(challenge),report:copy(report),
  spentNonces:[],nowMs:2000,maxAgeMs:3000});
const hold=(changes,reason)=>{const obj=sample(),r=review({...obj,...changes});
  assert.equal(r.decision,'HOLD');assert.ok(r.issues.includes(reason),JSON.stringify(r.issues));
  assert.equal(r.exitVerified,false);assert.equal(r.retirementAuthorized,false);};

test('synthetically bound envelope is structurally reviewable but NEVER proof of exit',()=>{
  const a=sample(),b=copy(a),r=review(a);
  assert.equal(r.decision,'STRUCTURE_REVIEWABLE');assert.deepEqual(r.issues,[]);
  assert.equal(r.signatureVerified,false);assert.equal(r.observerAuthenticated,false);
  assert.equal(r.exitVerified,false);assert.equal(r.replayLedgerTrusted,false);
  assert.equal(r.retirementAuthorized,false);assert.equal(r.executionAuthorized,false);
  assert.equal(r.requiresCoordinatorReplayCAS,true);
  assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.issues));assert.deepEqual(a,b);
});
test('replayed spent nonce or duplicate local ledger entry holds',()=>{
  hold({spentNonces:[D('a')]},'WITNESS_NONCE_REPLAY_OR_AMBIGUOUS_LEDGER');
  hold({spentNonces:[D('e'),D('e')]},'WITNESS_NONCE_REPLAY_OR_AMBIGUOUS_LEDGER');
});
test('wrong challenge nonce, revision or journal digest holds',()=>{
  for(const [k,v] of [['challengeNonce',D('f')],['coordinatorRevision',22],['journalDigest',D('f')]]){
    const x=sample();x.report[k]=v;hold({report:x.report},'WITNESS_CHALLENGE_BINDING_MISMATCH');
  }
});
test('changed generation, lease or fencing epoch invalidates the witness scope',()=>{
  for(const [k,v] of [['generationId','new-gen'],['leaseId','other-lease'],['fencingEpoch',8]]){
    const x=sample();x.report[k]=v;hold({report:x.report},'WITNESS_OWNER_SCOPE_MISMATCH');
  }
});
test('PID reuse, boot change, start ticks and executable link changes hold',()=>{
  for(const [k,v] of [['pid',30002],['bootId','other-boot'],['startTicks','123456788'],['executableFingerprint','unknown-exe']]){
    const x=sample();x.report[k]=v;hold({report:x.report},'WITNESS_PROCESS_IDENTITY_MISMATCH');
  }
});
test('monitor cannot identify itself as the owner or lease',()=>{
  const a=sample();a.report.monitorId=owner.ownerId;hold({report:a.report},'WITNESS_NOT_INDEPENDENT');
  const b=sample();b.report.monitorId=owner.leaseId;hold({report:b.report},'WITNESS_NOT_INDEPENDENT');
});
test('expired challenge cannot be reused after time window',()=>{
  hold({nowMs:2501},'WITNESS_CHALLENGE_EXPIRED_OR_INVALID');
  const a=sample();a.challenge.expiresAtMs=1000;hold({challenge:a.challenge},'WITNESS_CHALLENGE_EXPIRED_OR_INVALID');
});
test('exit observed before challenge or signature produced in the future holds',()=>{
  const a=sample();a.report.exitObservedAtMs=999;hold({report:a.report},'WITNESS_EVENT_STALE_OR_UNORDERED');
  const b=sample();b.report.signedAtMs=2010;hold({report:b.report},'WITNESS_EVENT_STALE_OR_UNORDERED');
  const c=sample();c.report.signedAtMs=1700;hold({report:c.report},'WITNESS_EVENT_STALE_OR_UNORDERED');
});
test('future challenge and unknown clock comparisons cannot appear current',()=>{
  const a=sample();a.challenge.issuedAtMs=2100;hold({challenge:a.challenge},'WITNESS_CHALLENGE_EXPIRED_OR_INVALID');
});
test('invalid method, missing descriptor binding and unsigned receipt are rejected',()=>{
  for(const [k,v] of [['method','pid-check-only'],['descriptorBinding','pid-only'],['signatureAlgorithm','none'],['signatureDigest','bad']]){
    const x=sample();x.report[k]=v;
    assert.throws(()=>review(x),/^Error: Invalid synthetic witness envelope$/);
  }
});
test('unknown witness status cannot be treated as a confirmed exit',()=>{
  const x=sample();x.report.status='ALIVE';assert.throws(()=>review(x),/Invalid synthetic witness envelope/);
});
test('malformed or forged owner claims are rejected without invoking getters',()=>{
  let calls=0;
  const fake=sample();Object.defineProperty(fake.report,'leaseId',{get(){calls++;throw Error('SECRET');}});
  for(const bad of [fake,{...sample(),owner:Object.create(owner)},
    {...sample(),challenge:{...challenge,token:'SECRET'}},
    Object.assign(sample(),{[Symbol('hidden')]:true}),
    {...sample(),spentNonces:Array(257).fill(D('a'))},
    {...sample(),nowMs:NaN}])assert.throws(()=>review(bad),/^Error: Invalid synthetic witness envelope$/);
  assert.equal(calls,0);
});
test('forged but well-formed attestation cannot authorize anything',()=>{
  const x=sample();x.report.signatureDigest=D('f');
  const r=review(x);assert.equal(r.decision,'STRUCTURE_REVIEWABLE');
  assert.equal(r.signatureVerified,false);assert.equal(r.exitVerified,false);
});
test('sanitized decisions do not echo identity data or signature metadata',()=>{
  assert.doesNotMatch(JSON.stringify(review(sample())),/synthetic-resource|independent-monitor|signer-key|123456789|Bearer/);
});

test('accessor-valued replay ledger indices are rejected without executing the getter',()=>{
  let touched=0;const x=sample();
  const array=[D('e')];
  Object.defineProperty(array, '0', {enumerable:true,configurable:true,get(){touched++;throw Error('SECRET_ACCESSOR');}});
  x.spentNonces=array;
  assert.throws(()=>review(x),/^Error: Invalid synthetic witness envelope$/);
  assert.equal(touched,0);
});
test('sparse and prototype-altered replay ledgers are rejected',()=>{
  const sparse=Array(2);sparse[0]=D('e');
  const a=sample();a.spentNonces=sparse;
  assert.throws(()=>review(a),/^Error: Invalid synthetic witness envelope$/);
  const subclass=Object.setPrototypeOf([D('e')],null);
  const b=sample();b.spentNonces=subclass;
  assert.throws(()=>review(b),/^Error: Invalid synthetic witness envelope$/);
});
