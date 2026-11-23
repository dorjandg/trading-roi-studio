import test from 'node:test';
import assert from 'node:assert/strict';
import {planAtomicOwnershipLease} from '../simulation/private-runtime-atomic-lease.mjs';

const D=x=>x.repeat(64),resourceId='synthetic-tunnel';
const retired={state:'COMMITTED',ownerId:'old-owner',generationId:'gen-old',
  leaseId:'lease-old',fencingEpoch:9,journalSequence:21,recordDigest:D('a')};
const vacant={schemaVersion:1,resourceId,revision:22,fencingEpoch:9,
  mode:'VACANT',holder:null,retired};
const acquire={kind:'ACQUIRE',resourceId,expectedRevision:22,expectedEpoch:9,
  ownerId:'new-owner',generationId:'gen-new',leaseId:'lease-new',
  ttlMs:1000,retirementDigest:D('a')};
const held={...vacant,revision:23,fencingEpoch:10,mode:'HELD',
  holder:{ownerId:'new-owner',generationId:'gen-new',leaseId:'lease-new',
    fencingEpoch:10,expiresAtMs:5000}};
const renew={...acquire,kind:'RENEW',expectedRevision:23,expectedEpoch:10,
  ttlMs:2000,retirementDigest:null};
const plan=(snapshot=vacant,request=acquire,coordinatorClockMs=2000)=>
  planAtomicOwnershipLease({snapshot,request,coordinatorClockMs});
const expectHold=(snapshot,request,reason,now=2000)=>{
  const r=plan(snapshot,request,now);
  assert.equal(r.decision,'HOLD');assert.equal(r.proposedCAS,null);
  assert.ok(r.reasons.includes(reason));assert.equal(r.leaseGranted,false);
};

test('vacant committed predecessor produces a CAS proposal, never a lease',()=>{
  const before=structuredClone(vacant),r=plan();
  assert.equal(r.decision,'CAS_PROPOSAL');
  assert.equal(r.executionAuthorized,false);assert.equal(r.leaseGranted,false);
  assert.equal(r.requiresDurableLinearizableCAS,true);
  assert.equal(r.requiresTransportFencing,true);
  assert.equal(r.requiresTrustedCoordinatorClock,true);
  assert.equal(r.requiresExternalVerification,true);
  assert.equal(r.proposedCAS.expectedRevision,22);
  assert.deepEqual(r.proposedCAS.nextSnapshot.holder,{ownerId:'new-owner',
    generationId:'gen-new',leaseId:'lease-new',fencingEpoch:10,expiresAtMs:3000});
  assert.equal(r.proposedCAS.nextSnapshot.fencingEpoch,10);
  assert.ok(Object.isFrozen(r.proposedCAS.nextSnapshot.holder));
  assert.deepEqual(vacant,before);
});

test('a stale CAS revision and epoch cannot be reused',()=>{
  expectHold(vacant,{...acquire,expectedRevision:21},'LEASE_CAS_REVISION_STALE');
  expectHold(vacant,{...acquire,expectedEpoch:8},'LEASE_FENCING_EPOCH_STALE');
});

test('the old holder blocks acquisition, even after lease expiry',()=>{
  expectHold(held,{...acquire,expectedRevision:23,expectedEpoch:10},'LEASE_EXISTING_OWNER_UNRETIRED',100000);
});

test('retiring, unknown or uncommitted ownership cannot be silently acquired',()=>{
  expectHold({...held,mode:'RETIRING'},
    {...acquire,expectedRevision:23,expectedEpoch:10},'LEASE_RETIREMENT_INCOMPLETE');
  expectHold({...vacant,mode:'UNKNOWN'},acquire,'LEASE_OWNERSHIP_UNKNOWN');
  expectHold({...vacant,retired:null},acquire,'LEASE_RETIREMENT_BARRIER_MISSING');
  expectHold({...vacant,retired:{...retired,fencingEpoch:8}},acquire,'LEASE_RETIREMENT_BARRIER_MISSING');
});

test('predecessor digest mismatch and recycled owner identity do not acquire',()=>{
  expectHold(vacant,{...acquire,retirementDigest:D('b')},'LEASE_RETIREMENT_DIGEST_MISMATCH');
  for(const [k,v] of [['ownerId','old-owner'],['generationId','gen-old'],['leaseId','lease-old']])
    expectHold(vacant,{...acquire,[k]:v},'LEASE_PREDECESSOR_IDENTITY_REUSED');
});

test('renewal of the exact current owner keeps the same epoch and advances CAS revision',()=>{
  const r=plan(held,renew,4000);
  assert.equal(r.decision,'CAS_PROPOSAL');
  assert.equal(r.proposedCAS.nextSnapshot.revision,24);
  assert.equal(r.proposedCAS.nextSnapshot.fencingEpoch,10);
  assert.equal(r.proposedCAS.nextSnapshot.holder.expiresAtMs,6000);
  assert.equal(r.leaseGranted,false);
});

test('renewal requires exact owner, lease, generation and fenced epoch',()=>{
  for(const [k,v] of [['ownerId','other-owner'],['generationId','gen-old'],
    ['leaseId','lease-old']])
    expectHold(held,{...renew,[k]:v},'LEASE_RENEWAL_OWNER_MISMATCH',4000);
  expectHold(held,{...renew,retirementDigest:D('a')},'LEASE_RENEWAL_OWNER_MISMATCH',4000);
  expectHold(held,{...renew,expectedEpoch:9},'LEASE_FENCING_EPOCH_STALE',4000);
});

test('expired owner cannot renew or silently become vacant',()=>{
  expectHold(held,renew,'LEASE_ALREADY_EXPIRED',5000);
  expectHold(held,renew,'LEASE_ALREADY_EXPIRED',9000);
});

test('renewal that would not extend an existing lease stays on HOLD',()=>{
  expectHold(held,{...renew,ttlMs:500},'LEASE_RENEWAL_NO_EXTENSION',4000);
});

test('a lease with mismatched owner epoch must not renew',()=>{
  const altered={...held,holder:{...held.holder,fencingEpoch:9}};
  expectHold(altered,renew,'LEASE_HOLDER_FENCING_CONFLICT',4000);
});

test('global resource mismatch stays on HOLD',()=>{
  expectHold(vacant,{...acquire,resourceId:'other-resource'},'LEASE_RESOURCE_MISMATCH');
});

test('overflow of epoch or coordinator clock is blocked',()=>{
  const near=Number.MAX_SAFE_INTEGER-1;
  const snapshot={...vacant,fencingEpoch:near,retired:{...retired,fencingEpoch:near}};
  expectHold(snapshot,{...acquire,expectedEpoch:near},'LEASE_FENCING_OVERFLOW');
  expectHold(vacant,acquire,'LEASE_CLOCK_OVERFLOW',near);
});

test('malformed snapshots, inherited approval and unsafe TTLs fail without side effects',()=>{
  const inputs=[
    {snapshot:Object.create(vacant),request:acquire,coordinatorClockMs:2000},
    {snapshot:vacant,request:Object.create(acquire),coordinatorClockMs:2000},
    {snapshot:vacant,request:{...acquire,ttlMs:60000},coordinatorClockMs:2000},
    {snapshot:vacant,request:{...acquire,ttlMs:-1},coordinatorClockMs:2000},
    {snapshot:vacant,request:{...acquire,leaseId:'bad\nlease'},coordinatorClockMs:2000},
    {snapshot:{...vacant,mode:'HELD'},request:acquire,coordinatorClockMs:2000},
    {snapshot:{...vacant,secret:'Bearer TOKEN'},request:acquire,coordinatorClockMs:2000},
    {snapshot:vacant,request:acquire,coordinatorClockMs:NaN},
    {snapshot:vacant,request:acquire,coordinatorClockMs:-1}
  ];
  for(const i of inputs)assert.throws(()=>planAtomicOwnershipLease(i),/^Error: Invalid synthetic atomic lease input$/);
});

test('malformed accessor request never executes its getter and leaks no secret',()=>{
  let calls=0;
  const r=Object.defineProperty({...acquire},'leaseId',{
    get(){calls++;throw Error('SECRET_GETTER');}
  });
  assert.throws(()=>plan(vacant,r),/^Error: Invalid synthetic atomic lease input$/);
  assert.equal(calls,0);
});

test('proposals are bounded, immutable and contain no operational credentials',()=>{
  const r=plan();assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(r.proposedCAS));
  assert.ok(Object.isFrozen(r.proposedCAS.nextSnapshot));
  assert.doesNotMatch(JSON.stringify(r),/Bearer|Authorization|\/proc\//);
});

test('two synthetic contenders cannot both CAS-commit to a linearizable revision',()=>{
  const rival={...acquire,ownerId:'second-owner',generationId:'second-gen',leaseId:'second-lease'};
  const first=plan(vacant,acquire);
  const second=plan(vacant,rival);
  assert.equal(first.decision,'CAS_PROPOSAL');
  assert.equal(second.decision,'CAS_PROPOSAL');
  // This simulates ONLY the revision check the real durable coordinator must
  // perform atomically. A pure plan alone never guarantees exclusivity.
  let committed=structuredClone(vacant);
  const simulatedCAS=proposal=>{
    if(committed.revision!==proposal.expectedRevision)return false;
    committed=structuredClone(proposal.nextSnapshot);
    return true;
  };
  assert.equal(simulatedCAS(first.proposedCAS),true);
  assert.equal(simulatedCAS(second.proposedCAS),false);
  assert.equal(committed.holder.ownerId,'new-owner');
  const staleSecond=plan(committed,rival);
  assert.equal(staleSecond.decision,'HOLD');
  assert.ok(staleSecond.reasons.includes('LEASE_CAS_REVISION_STALE'));
});

test('the lease protocol never treats timeout alone as globally confirmed retirement',()=>{
  const expired={...held,holder:{...held.holder,expiresAtMs:1}};
  const attempt={...acquire,expectedRevision:23,expectedEpoch:10};
  expectHold(expired,attempt,'LEASE_EXISTING_OWNER_UNRETIRED',50000);
  assert.equal(plan(expired,{...renew,ttlMs:1000},50000).decision,'HOLD');
});

test('a terminal maximum CAS revision cannot produce an unusable next revision',()=>{
  const near=Number.MAX_SAFE_INTEGER-1;
  const snapshot={...vacant,revision:near};
  expectHold(snapshot,{...acquire,expectedRevision:near},'LEASE_CAS_REVISION_OVERFLOW');
});
