import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createAccessKeysetLifecycle,restoreAccessKeysetLifecycle} from '../simulation/access-keyset-lifecycle.mjs';

// Owned synthetic fixtures only. No real key material, file persistence, network,
// browser, process launch or runtime authorization is exercised by these tests.
const pairs = Array.from({length:5},()=>generateKeyPairSync('rsa',{modulusLength:2048}));
const issuer = 'https://checkpoint-fixture.cloudflareaccess.com';
const audience = 'checkpoint-audience', subject = 'checkpoint-subject';
const key = (i = 0, kid = `key-${i}`) => ({...pairs[i].publicKey.export({format:'jwk'}),kid});
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const material = value => hash({e:value.e,kty:value.kty,n:value.n});
const clone = value => JSON.parse(JSON.stringify(value));
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function request(index = 0) {
  const body = encode({alg:'RS256',typ:'JWT',kid:`key-${index}`}) + '.' + encode({
    iss:issuer,aud:[audience],sub:subject,type:'app',iat:99990,nbf:99990,exp:100600
  });
  const assertion = body + '.' + sign('RSA-SHA256',Buffer.from(body),pairs[index].privateKey).toString('base64url');
  return {method:'POST',path:'/mcp',rawHeaders:['Host','api1.example.test','Content-Type','application/json',
    'Cf-Access-Jwt-Assertion',assertion],body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})};
}
function fixture(options = {}) {
  let now = 100000, clockCalls = 0;
  const config = {issuer,audience,allowedSubjects:[subject],expectedHost:'api1.example.test',
    clock:()=>{clockCalls++;return now;},...options};
  const lifecycle = createAccessKeysetLifecycle(config);
  return {lifecycle,config,setTime:value=>{now=value;},clockCalls:()=>clockCalls,
    publish:(generation = 1, publicJwks = [key()], revokedKids = [], target = lifecycle) => target.publish({
      generation,observedAtSeconds:now,publicJwks,revokedKids
    })};
}
function anchor(checkpoint, overrides = {}) {
  return {revision:7,sha256:hash(checkpoint),generationFloor:0,lastClockFloorSeconds:null,...overrides};
}
function restore(f, checkpoint = f.lifecycle.exportCheckpoint().checkpoint, overrides = {}) {
  return restoreAccessKeysetLifecycle(f.config,checkpoint,anchor(checkpoint,overrides));
}
function noGrant(value) {
  for (const name of ['admissionAuthorized','executionAuthorized','trustedIngressVerified','keyLifecycleRuntimeVerified']) {
    assert.equal(value[name],false);
  }
  for (const name of ['requiresTrustedKeySource','requiresDurableGenerationFloor','requiresExternalOwnershipFence']) {
    assert.equal(value[name],true);
  }
  assert.ok(Object.isFrozen(value));
}
function review(value) { noGrant(value);assert.equal(value.decision,'STRUCTURE_REVIEWABLE'); }
function denied(value, reason) {
  noGrant(value);assert.equal(value.decision,'DENY');
  if (reason) assert.equal(value.reason,reason);
}
function held(lifecycle) {
  const value = lifecycle.status();noGrant(value);
  assert.equal(value.decision,'HOLD');assert.equal(value.reason,'RESTORED_AWAITING_PUBLICATION');
}
function rejected(f, checkpoint, overrides = {}) {
  assert.throws(()=>restore(f,checkpoint,overrides),{message:'INVALID_LIFECYCLE_CHECKPOINT'});
}
function historyFixture() {
  const f = fixture({maxOverlapSeconds:20});
  review(f.publish(1,[key(0),key(1)]));
  f.setTime(100010);review(f.publish(2,[key(1),key(2)]));
  f.setTime(100020);review(f.publish(3,[key(2),key(3)],['key-0']));
  f.setTime(100050);review(f.publish(4,[key(3),key(4)],['key-2']));
  return f;
}

test('initial export, restore and fork never read the clock; exact bytes and frozen data round-trip',()=>{
  const f = fixture({generationFloor:4}), exported = f.lifecycle.exportCheckpoint();
  assert.equal(f.clockCalls(),0);
  assert.deepEqual(exported.checkpoint,{schema:'api1-access-keyset-checkpoint-v1',
    policySha256:exported.checkpoint.policySha256,generation:4,observedAt:null,freshUntil:null,lastClock:null,history:[]});
  assert.equal(exported.sha256,hash(exported.checkpoint));
  assert.ok(Buffer.byteLength(JSON.stringify(exported.checkpoint)) <= 128*1024);
  assert.ok(Object.isFrozen(exported));assert.ok(Object.isFrozen(exported.checkpoint));
  assert.ok(Object.isFrozen(exported.checkpoint.history));
  const restored = restore(f,clone(exported.checkpoint),{revision:0,generationFloor:4});
  const fork = restored.fork();
  assert.equal(f.clockCalls(),0);
  assert.deepEqual(restored.exportCheckpoint(),exported);
  assert.deepEqual(fork.exportCheckpoint(),exported);
  held(restored);held(fork);
  rejected(f,exported.checkpoint,{lastClockFloorSeconds:0});
});

test('canonical export preserves complete public JWK metadata and sorts key history deterministically',()=>{
  const f = fixture(), first = {...key(1),use:'sig',key_ops:['verify'],alg:'RS256'};
  review(f.publish(1,[first,key(0)]));
  const calls = f.clockCalls(), exported = f.lifecycle.exportCheckpoint();
  assert.equal(f.clockCalls(),calls);
  assert.deepEqual(exported.checkpoint.history.map(entry=>entry.jwk.kid),['key-0','key-1']);
  assert.deepEqual(Object.keys(exported.checkpoint.history[1].jwk),['kid','kty','n','e','alg','use','key_ops']);
  assert.equal(exported.sha256,hash(exported.checkpoint));
  for (const entry of exported.checkpoint.history) {
    assert.equal(entry.fingerprint,material(entry.jwk));
    assert.ok(Object.isFrozen(entry));assert.ok(Object.isFrozen(entry.jwk));
  }
  assert.ok(Object.isFrozen(exported.checkpoint.history[1].jwk.key_ops));
  assert.throws(()=>{exported.checkpoint.history[0].state='revoked';},TypeError);
  assert.throws(()=>{exported.checkpoint.history[1].jwk.key_ops[0]='sign';},TypeError);
  assert.deepEqual(restore(f,clone(exported.checkpoint)).exportCheckpoint(),exported);
});

test('policy digest binds effective defaults while clock and generation floors remain separate',()=>{
  const f = fixture(), explicit = fixture({maxLifetimeSeconds:3600,maxHeaderBytes:16384,maxBodyBytes:4096,
    maxSnapshotAgeSeconds:300,maxOverlapSeconds:300,maxTrackedKeys:64,generationFloor:7,clock:()=>200000});
  const original = f.lifecycle.exportCheckpoint().checkpoint;
  assert.equal(original.policySha256,explicit.lifecycle.exportCheckpoint().checkpoint.policySha256);
  review(f.publish(8));
  const checkpoint = f.lifecycle.exportCheckpoint().checkpoint;
  assert.doesNotThrow(()=>restoreAccessKeysetLifecycle(explicit.config,checkpoint,anchor(checkpoint,{generationFloor:8})));
  for (const changed of [{issuer:'https://different.cloudflareaccess.com'},{audience:'different'},
    {allowedSubjects:['different']},{expectedHost:'different.example.test'},{maxLifetimeSeconds:1200},
    {maxHeaderBytes:1024},{maxBodyBytes:1024},{maxSnapshotAgeSeconds:600},{maxOverlapSeconds:0},{maxTrackedKeys:4}]) {
    assert.throws(()=>restoreAccessKeysetLifecycle({...f.config,...changed},checkpoint,anchor(checkpoint)),
      {message:'INVALID_LIFECYCLE_CHECKPOINT'});
  }
  assert.throws(()=>restoreAccessKeysetLifecycle({...f.config,generationFloor:9},checkpoint,anchor(checkpoint)),
    {message:'INVALID_LIFECYCLE_CHECKPOINT'});
});

test('restore imposes HOLD until a fresh advancing publication; invalid attempts never release it',()=>{
  const f = fixture();review(f.publish());
  const restored = restore(f);held(restored);
  denied(restored.assess(request()),'RESTORED_AWAITING_PUBLICATION');
  denied(f.publish(1,[key()],[],restored),'GENERATION_NOT_ADVANCING');held(restored);
  denied(f.publish(2,[{...key(),n:'!'}],[],restored),'INVALID_SNAPSHOT');held(restored);
  denied(restored.publish({generation:2,observedAtSeconds:100001,publicJwks:[key()],revokedKids:[]}),
    'SNAPSHOT_NOT_FRESH');held(restored);
  f.setTime(100001);review(f.publish(2,[key()],[],restored));
  review(restored.status());review(restored.assess(request()));
  rejected(f,f.lifecycle.exportCheckpoint().checkpoint,{resume:true});
  assert.throws(()=>createAccessKeysetLifecycle({...f.config,recoveryHold:false}),{message:'INVALID_LIFECYCLE_CONFIG'});
});

test('full history survives restart, including expired and revoked retiring keys, without extending deadlines',()=>{
  const f = historyFixture(), exported = f.lifecycle.exportCheckpoint();
  const [revokedRetiring,expiredRetiring,revokedActive,active] = exported.checkpoint.history;
  assert.equal(revokedRetiring.state,'revoked');assert.equal(revokedRetiring.retireAt,100030);
  assert.equal(expiredRetiring.state,'retiring');assert.equal(expiredRetiring.retireAt,100040);
  assert.equal(revokedActive.state,'revoked');assert.ok(!Object.hasOwn(revokedActive,'retireAt'));
  assert.equal(active.state,'active');
  const restored = restore(f,clone(exported.checkpoint));
  assert.deepEqual(restored.exportCheckpoint(),exported);held(restored);
  f.setTime(100055);review(f.publish(5,[key(3),key(4)],[],restored));
  const after = restored.exportCheckpoint().checkpoint;
  assert.deepEqual(after.history.slice(0,3),exported.checkpoint.history.slice(0,3));
  for (const index of [0,1,2]) {
    denied(f.publish(6,[key(index)],[],restored),'KEY_RETIRED_OR_REVOKED');
    denied(f.publish(6,[key(index,`alias-${index}`)],[],restored),'KEY_MATERIAL_REUSED');
    denied(f.publish(6,[key(4,`key-${index}`)],[],restored),'KEY_ID_REUSED');
  }
  review(restored.assess(request(3)));review(restored.assess(request(4)));
  for (const index of [0,1,2]) denied(restored.assess(request(index)),'REQUEST_DENIED');
});

test('restoring stale state does not rebase its freshness or old overlap on a later refresh',()=>{
  const f = fixture({maxSnapshotAgeSeconds:30,maxOverlapSeconds:20});review(f.publish());
  f.setTime(100010);review(f.publish(2,[key(1)]));
  f.setTime(100050);denied(f.lifecycle.assess(request(1)),'KEYSET_STALE');
  const checkpoint = f.lifecycle.exportCheckpoint().checkpoint, restored = restore(f,checkpoint);
  assert.equal(restored.exportCheckpoint().checkpoint.freshUntil,100040);
  assert.equal(restored.exportCheckpoint().checkpoint.history[0].retireAt,100030);
  held(restored);review(f.publish(3,[key(1)],[],restored));
  denied(restored.assess(request()),'REQUEST_DENIED');review(restored.assess(request(1)));
  assert.equal(restored.exportCheckpoint().checkpoint.history[0].retireAt,100030);
});

test('restored generation and observed clock cannot roll back, even with no independent clock floor',()=>{
  const f = fixture();review(f.publish());f.setTime(100100);review(f.lifecycle.status());
  const checkpoint = f.lifecycle.exportCheckpoint().checkpoint;
  rejected(f,checkpoint,{generationFloor:2});rejected(f,checkpoint,{lastClockFloorSeconds:100101});
  const restored = restore(f,checkpoint,{generationFloor:1,lastClockFloorSeconds:null});
  f.setTime(100099);denied(restored.status(),'CLOCK_REJECTED');
  denied(restored.assess(request()),'CLOCK_REJECTED');denied(f.publish(2,[key()],[],restored),'CLOCK_REJECTED');
  assert.equal(restored.exportCheckpoint().checkpoint.lastClock,100100);
  f.setTime(100100);held(restored);review(f.publish(2,[key()],[],restored));
});

test('clock-only changes and denied publications change the checkpoint hash without advancing generation',()=>{
  const f = fixture();review(f.publish());const before = f.lifecycle.exportCheckpoint();
  f.setTime(100001);denied(f.publish(1),'GENERATION_NOT_ADVANCING');
  const after = f.lifecycle.exportCheckpoint();
  assert.equal(after.checkpoint.generation,before.checkpoint.generation);
  assert.equal(after.checkpoint.lastClock,100001);assert.notEqual(after.sha256,before.sha256);
  rejected(f,after.checkpoint,{sha256:before.sha256});
  f.setTime(100002);review(f.lifecycle.status());
  assert.notEqual(f.lifecycle.exportCheckpoint().sha256,after.sha256);
});

test('trusted digest detects removed tombstones or changed state; malformed anchors are rejected',()=>{
  const f = historyFixture(), original = f.lifecycle.exportCheckpoint();
  for (const mutate of [value=>value.history.splice(0,1),value=>{value.generation++;},
    value=>{value.lastClock++;},value=>{value.history[0].state='retiring';}]) {
    const changed = clone(original.checkpoint);mutate(changed);
    rejected(f,changed,{sha256:original.sha256});
  }
  for (const invalid of [{revision:-1},{revision:1.5},{revision:Number.MAX_SAFE_INTEGER+1},
    {sha256:'A'.repeat(64)},{sha256:null},{generationFloor:null},{generationFloor:-1},
    {lastClockFloorSeconds:-1},{lastClockFloorSeconds:NaN},{trusted:true}]) {
    rejected(f,original.checkpoint,invalid);
  }
});

test('every historical JWK is revalidated, including revoked material and private or noncanonical fields',()=>{
  const f = historyFixture(), checkpoint = f.lifecycle.exportCheckpoint().checkpoint;
  const badKeys = [value=>{value.n='!';},value=>{value.n='AQ';},value=>{value.e='Aw';},
    value=>{value.d='synthetic-private-marker';},value=>{value.alg='HS256';},value=>{value.use='enc';},
    value=>{value.key_ops=['sign'];},value=>{value.kid='bad kid';},
    value=>{value.n=Buffer.concat([Buffer.from([0]),Buffer.from(value.n,'base64url')]).toString('base64url');},
    value=>{const bytes=Buffer.from(value.n,'base64url');bytes[bytes.length-1]&=254;value.n=bytes.toString('base64url');}];
  for (const mutate of badKeys) {
    const changed = clone(checkpoint);mutate(changed.history[0].jwk);
    changed.history[0].fingerprint=material(changed.history[0].jwk);rejected(f,changed);
  }
  const fingerprintMismatch = clone(checkpoint);fingerprintMismatch.history[0].fingerprint='0'.repeat(64);
  rejected(f,fingerprintMismatch);
  const duplicateKid = clone(checkpoint);duplicateKid.history[1].jwk.kid=duplicateKid.history[0].jwk.kid;
  rejected(f,duplicateKid);
  const duplicateMaterial = clone(checkpoint);
  duplicateMaterial.history[1].jwk={...duplicateMaterial.history[0].jwk,kid:'key-1'};
  duplicateMaterial.history[1].fingerprint=duplicateMaterial.history[0].fingerprint;
  rejected(f,duplicateMaterial);
});

test('rejects inconsistent states, retirement deadlines, snapshot times and accepted-key counts',()=>{
  const f = historyFixture(), checkpoint = f.lifecycle.exportCheckpoint().checkpoint;
  for (const mutate of [value=>{value.history[0].state='unknown';},value=>{value.history[3].retireAt=100060;},
    value=>{delete value.history[1].retireAt;},value=>{value.history[1].retireAt=-1;},
    value=>{value.history[0].retireAt=100071;},value=>{value.history[1].retireAt=value.freshUntil+1;},
    value=>{value.history[1].retireAt=100040.5;},value=>{value.observedAt=null;},
    value=>{value.lastClock=null;},value=>{value.lastClock=value.observedAt-1;},
    value=>{value.freshUntil++;},value=>{value.generation=0;},
    value=>{value.observedAt=null;value.freshUntil=null;},
    value=>{value.observedAt=Number.MAX_SAFE_INTEGER;value.lastClock=Number.MAX_SAFE_INTEGER;},
    value=>{for(const entry of value.history){entry.state='active';delete entry.retireAt;}}]) {
    const changed = clone(checkpoint);mutate(changed);rejected(f,changed);
  }
});

test('rejects accessors and malformed structures before invoking getters or caller serialization',()=>{
  const f = fixture();review(f.publish());const checkpoint = f.lifecycle.exportCheckpoint().checkpoint;
  let calls = 0;
  const getter = (obj,name,value) => Object.defineProperty(obj,name,{enumerable:true,configurable:true,
    get(){calls++;return value;}});
  const badHeader = getter(clone(checkpoint),'generation',1);
  const badEntry = clone(checkpoint);getter(badEntry.history[0],'state','active');
  const badJwk = clone(checkpoint);getter(badJwk.history[0].jwk,'n',key().n);
  const badArray = clone(checkpoint);getter(badArray.history,'0',badArray.history[0]);
  const badToJson = clone(checkpoint);getter(badToJson,'toJSON',()=>{calls++;return checkpoint;});
  const nonEnumerable = clone(checkpoint);Object.defineProperty(nonEnumerable,'generation',{enumerable:false});
  const sparse = clone(checkpoint);sparse.history=new Array(1);
  const cycle = clone(checkpoint);cycle.history[0].jwk=cycle;
  for (const invalid of [badHeader,badEntry,badJwk,badArray,badToJson,nonEnumerable,sparse,cycle,
    {...clone(checkpoint),[Symbol('extra')]:1},Object.create(checkpoint),JSON.stringify(checkpoint)]) {
    assert.throws(()=>restoreAccessKeysetLifecycle(f.config,invalid,anchor(checkpoint)),
      {message:'INVALID_LIFECYCLE_CHECKPOINT'});
  }
  const badAnchor = getter(anchor(checkpoint),'sha256',hash(checkpoint));
  assert.throws(()=>restoreAccessKeysetLifecycle(f.config,checkpoint,badAnchor),{message:'INVALID_LIFECYCLE_CHECKPOINT'});
  assert.equal(calls,0);
});

test('only canonical checkpoint ordering is accepted, even if an anchor matches reordered bytes',()=>{
  const f = fixture();review(f.publish(1,[key(0),key(1)]));const checkpoint=f.lifecycle.exportCheckpoint().checkpoint;
  const topReversed = Object.fromEntries(Object.entries(clone(checkpoint)).reverse());
  const historyReversed = clone(checkpoint);historyReversed.history.reverse();
  const jwkReversed = clone(checkpoint);
  jwkReversed.history[0].jwk=Object.fromEntries(Object.entries(jwkReversed.history[0].jwk).reverse());
  const entryReversed = clone(checkpoint);
  entryReversed.history[0]=Object.fromEntries(Object.entries(entryReversed.history[0]).reverse());
  for (const invalid of [topReversed,historyReversed,jwkReversed,entryReversed]) rejected(f,invalid);
});

test('maximum 64-key history round-trips without the ingress copier node ceiling or silent eviction',()=>{
  const f = fixture({maxOverlapSeconds:0});
  // Synthetic public-only moduli satisfy the existing canonical modulus checks;
  // these fixtures do not sign assertions or claim to generate usable key pairs.
  const divisors=[3n,5n,7n,11n,13n,17n,19n,65537n];let n=(1n<<2047n)+1n;
  for(let i=0;i<64;i++) {
    while(divisors.some(p=>n%p===0n)) n+=2n;
    const publicKey={kid:`history-${String(i).padStart(2,'0')}`,kty:'RSA',
      n:Buffer.from(n.toString(16),'hex').toString('base64url'),e:'AQAB',alg:'RS256',use:'sig',key_ops:['verify']};
    review(f.publish(i+1,[publicKey]));n+=2n;
  }
  const exported=f.lifecycle.exportCheckpoint();assert.equal(exported.checkpoint.history.length,64);
  assert.ok(Buffer.byteLength(JSON.stringify(exported.checkpoint))>8192);
  assert.ok(Buffer.byteLength(JSON.stringify(exported.checkpoint))<=128*1024);
  const restored=restore(f,clone(exported.checkpoint));assert.deepEqual(restored.exportCheckpoint(),exported);
  held(restored);denied(f.publish(65,[key()],[],restored),'KEY_HISTORY_LIMIT');held(restored);
  const tooMany=clone(exported.checkpoint);tooMany.history.push(clone(tooMany.history[0]));rejected(f,tooMany);
});

test('oversized serialized data fails closed and reports no checkpoint material',()=>{
  const f=fixture();review(f.publish());const oversized=clone(f.lifecycle.exportCheckpoint().checkpoint);
  oversized.history[0].jwk.n='\0'.repeat(12000);
  oversized.history[0].fingerprint='\0'.repeat(12000);
  assert.ok(Buffer.byteLength(JSON.stringify(oversized))>128*1024);
  rejected(f,oversized);
  const secret=clone(f.lifecycle.exportCheckpoint().checkpoint);secret.history[0].jwk.d='synthetic-private-marker';
  rejected(f,secret);
});

test('fork isolates candidate publication and clock state without reading the clock or changing its parent',()=>{
  const f=fixture();review(f.publish());const original=f.lifecycle.exportCheckpoint(),calls=f.clockCalls();
  const candidate=f.lifecycle.fork();assert.equal(f.clockCalls(),calls);
  assert.deepEqual(candidate.exportCheckpoint(),original);
  f.setTime(100020);review(f.publish(2,[key(1)],['key-0'],candidate));
  assert.deepEqual(f.lifecycle.exportCheckpoint(),original);
  denied(candidate.assess(request()),'REQUEST_DENIED');review(candidate.assess(request(1)));
  f.setTime(100010);review(f.lifecycle.assess(request()));denied(candidate.status(),'CLOCK_REJECTED');
  assert.equal(f.lifecycle.exportCheckpoint().checkpoint.generation,1);
  assert.equal(f.lifecycle.exportCheckpoint().checkpoint.lastClock,100010);
  assert.equal(candidate.exportCheckpoint().checkpoint.lastClock,100020);
});

test('fork preserves recovery HOLD; recovering a candidate never releases its held parent',()=>{
  const f=fixture();review(f.publish());const restored=restore(f),before=restored.exportCheckpoint();
  const calls=f.clockCalls(),candidate=restored.fork();assert.equal(f.clockCalls(),calls);
  held(candidate);held(restored);denied(f.publish(1,[key()],[],candidate),'GENERATION_NOT_ADVANCING');held(candidate);
  review(f.publish(2,[key()],[],candidate));review(candidate.assess(request()));held(restored);
  assert.deepEqual(restored.exportCheckpoint(),before);
  assert.equal(candidate.exportCheckpoint().checkpoint.generation,2);
});

test('restoration copies caller data and empty publications remain representable and fail closed',()=>{
  const f=fixture();review(f.publish(1,[]));const empty=f.lifecycle.exportCheckpoint();
  assert.equal(empty.checkpoint.observedAt,100000);assert.deepEqual(empty.checkpoint.history,[]);
  const restoredEmpty=restore(f,clone(empty.checkpoint));held(restoredEmpty);
  review(f.publish(2,[],[],restoredEmpty));denied(restoredEmpty.assess(request()),'KEYSET_EMPTY');
  review(f.publish(2,[key()]));const mutable=clone(f.lifecycle.exportCheckpoint().checkpoint),saved=clone(mutable);
  const restored=restore(f,mutable);mutable.history[0].jwk.n='!';mutable.history.length=0;mutable.lastClock=0;
  assert.deepEqual(restored.exportCheckpoint().checkpoint,saved);
  review(f.publish(3,[key()],[],restored));review(restored.assess(request()));
});
