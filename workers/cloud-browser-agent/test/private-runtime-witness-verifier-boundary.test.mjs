import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewWitnessVerifierBoundary} from '../simulation/private-runtime-witness-verifier-boundary.mjs';

const H=x=>x.repeat(64);
const owner={resourceId:'synthetic-tunnel',ownerId:'synthetic-owner',hostId:'synthetic-host',
  bootId:'synthetic-boot',pid:9001,startTicks:'1234567890',
  executableFingerprint:'synthetic-exe',generationId:'generation-old',leaseId:'lease-old',
  fencingEpoch:8};
const challenge={schemaVersion:1,nonce:H('a'),resourceId:owner.resourceId,
  ownerId:owner.ownerId,generationId:owner.generationId,leaseId:owner.leaseId,
  fencingEpoch:8,coordinatorRevision:19,journalDigest:H('b'),
  issuedAtMs:1000,expiresAtMs:3000};
const report={schemaVersion:1,monitorId:'monitor-independent',keyId:'key-synthetic',
  signatureAlgorithm:'Ed25519',signatureDigest:H('c'),challengeNonce:H('a'),
  coordinatorRevision:19,journalDigest:H('b'),resourceId:owner.resourceId,
  ownerId:owner.ownerId,hostId:owner.hostId,bootId:owner.bootId,pid:owner.pid,
  startTicks:owner.startTicks,executableFingerprint:owner.executableFingerprint,
  generationId:owner.generationId,leaseId:owner.leaseId,fencingEpoch:8,
  method:'pidfd-waitid',descriptorBinding:'pre-opened-generation-bound',
  status:'EXIT_OBSERVED',exitObservedAtMs:1500,signedAtMs:1600,
  exitEvidenceDigest:H('d')};
const envelope={owner,challenge,report,spentNonces:[],nowMs:2000,maxAgeMs:3000};
const trustPolicy={schemaVersion:1,resourceId:owner.resourceId,
  monitorId:report.monitorId,keyId:report.keyId,algorithm:'Ed25519',
  status:'ACTIVE',validFromMs:500,validUntilMs:4000,policyRevision:6,
  trustAnchorDigest:H('e')};
const nonceRecord={schemaVersion:1,nonce:challenge.nonce,resourceId:owner.resourceId,
  generationId:owner.generationId,leaseId:owner.leaseId,fencingEpoch:8,
  coordinatorRevision:19,state:'AVAILABLE',observedAtMs:1950,journalDigest:H('b')};
const sample=()=>structuredClone({envelope,trustPolicy,nonceRecord});
const review=d=>reviewWitnessVerifierBoundary(d);
const hold=(d,reason)=>{const r=review(d);assert.equal(r.decision,'HOLD');
  assert.ok(r.issues.includes(reason),JSON.stringify(r));
  assert.equal(r.nonceConsumed,false);assert.equal(r.exitVerified,false);};

test('consistent synthetic witness is pending, never signed or exited in fact',()=>{
  const d=sample(),before=structuredClone(d),r=review(d);
  assert.equal(r.decision,'VERIFICATION_PENDING');assert.deepEqual(r.issues,[]);
  assert.equal(r.signatureVerified,false);assert.equal(r.monitorAuthenticated,false);
  assert.equal(r.trustRootAuthenticated,false);assert.equal(r.processDescriptorVerified,false);
  assert.equal(r.nonceLedgerTrusted,false);assert.equal(r.nonceConsumed,false);
  assert.equal(r.exitVerified,false);assert.equal(r.retirementAuthorized,false);
  assert.equal(r.executionAuthorized,false);assert.equal(r.requiresTrustedCryptoVerifier,true);
  assert.equal(r.requiresDurableCoordinatorNonceCAS,true);
  assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.issues));assert.deepEqual(d,before);
});
test('revoked or unknown key status holds',()=>{
  for(const status of ['REVOKED','UNKNOWN']){
    const d=sample();d.trustPolicy.status=status;
    hold(d,'WITNESS_TRUST_KEY_NOT_ACTIVE');
  }
});
test('signed event outside pinned key lifetime holds',()=>{
  for(const [k,v] of [['validFromMs',1700],['validUntilMs',1599],
    ['validUntilMs',1999],['validFromMs',5000]]){
    const d=sample();d.trustPolicy[k]=v;hold(d,'WITNESS_TRUST_KEY_OUT_OF_WINDOW');
  }
});
test('a monitor/key mismatch or cross-resource policy holds',()=>{
  for(const [k,v] of [['monitorId','another-monitor'],['keyId','another-key'],
    ['resourceId','other-resource']]){
    const d=sample();d.trustPolicy[k]=v;hold(d,'WITNESS_POLICY_SCOPE_MISMATCH');
  }
});
test('spent and unknown nonce ledger states hold',()=>{
  for(const [state,reason] of [['SPENT','WITNESS_NONCE_ALREADY_CONSUMED'],
    ['UNKNOWN','WITNESS_NONCE_LEDGER_UNKNOWN']]){
    const d=sample();d.nonceRecord.state=state;hold(d,reason);
  }
});
test('cross-scope nonce ledger records hold for every owner binding',()=>{
  for(const [k,v] of [['nonce',H('1')],['resourceId','other-resource'],
    ['generationId','other-generation'],['leaseId','other-lease'],
    ['fencingEpoch',9],['coordinatorRevision',18],['journalDigest',H('2')]]){
    const d=sample();d.nonceRecord[k]=v;
    hold(d,'WITNESS_NONCE_LEDGER_SCOPE_MISMATCH');
  }
});
test('stale or future nonce ledger evidence holds',()=>{
  for(const v of [0,2001]){
    const d=sample();d.nonceRecord.observedAtMs=v;
    const reason=v===0?null:'WITNESS_NONCE_LEDGER_STALE';
    // Freshness window is 3000 ms; 0 is not stale relative to 2000.
    if(reason)hold(d,reason);
    else assert.equal(review(d).decision,'VERIFICATION_PENDING');
  }
  const d=sample();d.envelope.maxAgeMs=100;
  d.nonceRecord.observedAtMs=1800;hold(d,'WITNESS_NONCE_LEDGER_STALE');
});
test('replayed nonce in supplied structural envelope is always HOLD',()=>{
  const d=sample();d.envelope.spentNonces=[challenge.nonce];
  hold(d,'WITNESS_NONCE_REPLAY_OR_AMBIGUOUS_LEDGER');
});
test('descriptor, PID, host, boot ID and generation substitution are rejected',()=>{
  for(const [k,v] of [['pid',9002],['hostId','other-host'],['bootId','other-boot'],
    ['startTicks','9876543210'],['generationId','other-generation'],
    ['executableFingerprint','another-binary']]){
    const d=sample();d.envelope.report[k]=v;
    const r=review(d);assert.equal(r.decision,'HOLD');
    assert.ok(r.issues.includes(k==='generationId'?'WITNESS_OWNER_SCOPE_MISMATCH':
      'WITNESS_PROCESS_IDENTITY_MISMATCH'));
  }
});
test('stale or future event ordering holds at the existing witness contract',()=>{
  for(const [k,v] of [['exitObservedAtMs',999],['signedAtMs',3100]]){
    const d=sample();d.envelope.report[k]=v;
    hold(d,'WITNESS_EVENT_STALE_OR_UNORDERED');
  }
});
test('a fake but format-correct Ed25519 digest never becomes verified',()=>{
  const d=sample();d.envelope.report.signatureDigest=H('f');
  const r=review(d);assert.equal(r.decision,'VERIFICATION_PENDING');
  assert.equal(r.signatureVerified,false);assert.equal(r.exitVerified,false);
});
test('self-witnessing monitor label is blocked by inherited base contract',()=>{
  const d=sample();d.envelope.report.monitorId=owner.ownerId;
  hold(d,'WITNESS_NOT_INDEPENDENT');
});
test('untrusted policy and nonce record cannot carry getters or extra secret fields',()=>{
  const bad=[];
  let d=sample();d.trustPolicy.secret='Bearer TOKEN';bad.push(d);
  d=sample();d.nonceRecord.extra=true;bad.push(d);
  d=sample();d.trustPolicy=Object.create(d.trustPolicy);bad.push(d);
  d=sample();d.nonceRecord=Object.create(d.nonceRecord);bad.push(d);
  d=sample();d.nonceRecord[Symbol('secret')]=true;bad.push(d);
  d=sample();Object.defineProperty(d.trustPolicy,'keyId',{
    get(){throw Error('GETTER_SECRET');}});bad.push(d);
  d=sample();Object.defineProperty(d.nonceRecord,'nonce',{
    get(){throw Error('GETTER_SECRET');}});bad.push(d);
  for(const item of bad)assert.throws(()=>review(item),
    /^Error: Invalid synthetic witness verification boundary$/);
});
test('envelope with malicious accessor fails with sanitized error',()=>{
  const d=sample();Object.defineProperty(d.envelope.challenge,'nonce',{
    get(){throw Error('SHOULD_NOT_EXECUTE');}});
  assert.throws(()=>review(d),/^Error: Invalid synthetic witness verification boundary$/);
});
test('malformed nonce or key policy is rejected without runtime access',()=>{
  const invalid=[];
  let d=sample();d.nonceRecord.nonce='not-a-nonce';invalid.push(d);
  d=sample();d.trustPolicy.trustAnchorDigest='bad';invalid.push(d);
  d=sample();d.trustPolicy.policyRevision=Number.MAX_SAFE_INTEGER;invalid.push(d);
  d=sample();d.nonceRecord.state='DONE';invalid.push(d);
  d=sample();d.trustPolicy.algorithm='HMAC';invalid.push(d);
  for(const item of invalid)assert.throws(()=>review(item),
    /^Error: Invalid synthetic witness verification boundary$/);
});
test('no nonce, key ID, process ID or signature data echoes into report',()=>{
  const r=review(sample());
  assert.doesNotMatch(JSON.stringify(r),/synthetic-|monitor-independent|key-synthetic|aaaaaaaa|9001/);
});
test('simulated two claimants cannot both consume nonce with one ledger revision',()=>{
  const d=sample();let ledger={revision:19,state:'AVAILABLE'};
  const consumeSyntheticCAS=expectedRevision=>{
    if(ledger.revision!==expectedRevision||ledger.state!=='AVAILABLE')return false;
    ledger={revision:ledger.revision+1,state:'SPENT'};return true;
  };
  assert.equal(consumeSyntheticCAS(19),true);
  assert.equal(consumeSyntheticCAS(19),false);
  d.nonceRecord.state='SPENT';hold(d,'WITNESS_NONCE_ALREADY_CONSUMED');
});
