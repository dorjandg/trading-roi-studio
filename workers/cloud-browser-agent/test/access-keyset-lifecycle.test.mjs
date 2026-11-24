import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {createAccessKeysetLifecycle} from '../simulation/access-keyset-lifecycle.mjs';

// Synthetic key pairs exist only in this test process; no key bytes are logged
// or written. Neither tests nor the lifecycle module open a socket or fetch keys.
const pairs = Array.from({length:5}, () => generateKeyPairSync('rsa',{modulusLength:2048}));
const issuer = 'https://synthetic-team.cloudflareaccess.com';
const audience = 'synthetic-audience', subject = 'synthetic-subject';
const key = (index = 0, kid = `key-${index}`) => ({...pairs[index].publicKey.export({format:'jwk'}),kid});
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(index = 0, kid = `key-${index}`, claims = {}) {
  const body = encode({alg:'RS256',typ:'JWT',kid}) + '.' + encode({
    iss:issuer,aud:[audience],sub:subject,type:'app',iat:99990,nbf:99990,exp:100600,...claims
  });
  return body + '.' + sign('RSA-SHA256',Buffer.from(body),pairs[index].privateKey).toString('base64url');
}
const request = (assertion = token()) => ({method:'POST',path:'/mcp',
  rawHeaders:['Host','api1.example.test','Content-Type','application/json','Cf-Access-Jwt-Assertion',assertion],
  body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
function fixture(options = {}) {
  let now = 100000;
  const config = {issuer,audience,allowedSubjects:[subject],expectedHost:'api1.example.test',clock:()=>now,...options};
  const lifecycle = createAccessKeysetLifecycle(config);
  return {lifecycle,config,setTime:value=>{now=value;},
    publish:(generation = 1, publicJwks = [key()], extra = {}) => lifecycle.publish({
      generation,observedAtSeconds:now,publicJwks,revokedKids:[],...extra
    })};
}
function noGrant(value) {
  assert.equal(value.admissionAuthorized,false);
  assert.equal(value.executionAuthorized,false);
  assert.equal(value.trustedIngressVerified,false);
  assert.equal(value.keyLifecycleRuntimeVerified,false);
  assert.equal(value.requiresTrustedKeySource,true);
  assert.equal(value.requiresDurableGenerationFloor,true);
  assert.equal(value.requiresExternalOwnershipFence,true);
  assert.ok(Object.isFrozen(value));
}
function deny(value, reason) {
  noGrant(value);assert.equal(value.decision,'DENY');
  if (reason) assert.equal(value.reason,reason);
}
function review(value) { noGrant(value);assert.equal(value.decision,'STRUCTURE_REVIEWABLE'); }

test('starts without trust and remains review-only after valid publication', () => {
  const f=fixture();
  deny(f.lifecycle.assess(request()),'KEYSET_MISSING');
  assert.equal(f.lifecycle.status().decision,'HOLD');
  review(f.publish());
  review(f.lifecycle.assess(request()));
  review(f.lifecycle.status());
  for (const value of [f.lifecycle.status(),f.lifecycle.assess(request())]) {
    for (const secret of [issuer,audience,subject,token(),key().n]) assert.ok(!JSON.stringify(value).includes(secret));
  }
});

test('unknown kid and wrong signature deny without fetching or accepting caller trust', () => {
  const f=fixture();f.publish();
  deny(f.lifecycle.assess(request(token(1))),'REQUEST_DENIED');
  deny(f.lifecycle.assess(request(token(1,'key-0'))),'REQUEST_DENIED');
  for (const extra of [{clock:()=>100000},{nowSeconds:100000},{generation:2},
    {publicJwks:[key(1)]},{verifierConfig:f.config},{identity:{verified:true}}]) {
    deny(f.lifecycle.assess({...request(),...extra}),'REQUEST_DENIED');
  }
});

test('generation floor, duplicate generation and rollback fail without replacing valid state', () => {
  const f=fixture({generationFloor:7});
  deny(f.publish(7),'GENERATION_NOT_ADVANCING');
  review(f.publish(8));
  for (const generation of [0,7,8,-1,8.1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) {
    deny(f.publish(generation,[key(1)]));
    review(f.lifecycle.assess(request()));
  }
  assert.equal(f.lifecycle.status().generation,8);
});

test('freshness is exclusive at the deadline and refresh requires advancing generation', () => {
  const f=fixture({maxSnapshotAgeSeconds:30});f.publish();
  f.setTime(100029);review(f.lifecycle.assess(request()));
  f.setTime(100030);deny(f.lifecycle.assess(request()),'KEYSET_STALE');
  assert.equal(f.lifecycle.status().reason,'KEYSET_STALE');
  deny(f.publish(1),'GENERATION_NOT_ADVANCING');
  review(f.publish(2));review(f.lifecycle.assess(request()));
});

test('publication rejects future, stale, regressing and overflowing observation times', () => {
  const f=fixture({maxSnapshotAgeSeconds:30});f.publish();
  for (const observedAtSeconds of [100001,99970,-1,NaN,Number.MAX_SAFE_INTEGER]) {
    deny(f.publish(2,[key(1)],{observedAtSeconds}));review(f.lifecycle.assess(request()));
  }
  f.setTime(100005);
  deny(f.publish(2,[key(1)],{observedAtSeconds:99999}),'SNAPSHOT_TIME_REVERSED');
  assert.equal(f.lifecycle.status().generation,1);
});

test('removed keys overlap briefly, then reject still-valid signed assertions', () => {
  const f=fixture({maxSnapshotAgeSeconds:300,maxOverlapSeconds:20});f.publish();
  f.setTime(100010);review(f.publish(2,[key(1)]));
  f.setTime(100029);review(f.lifecycle.assess(request()));review(f.lifecycle.assess(request(token(1))));
  f.setTime(100030);deny(f.lifecycle.assess(request()),'REQUEST_DENIED');
  review(f.lifecycle.assess(request(token(1))));
  assert.equal(f.lifecycle.status().retiringKeyCount,0);
});

test('refresh cannot extend overlap or reactivate retired material under another name', () => {
  const f=fixture({maxOverlapSeconds:20});f.publish();
  f.setTime(100010);f.publish(2,[key(1)]);
  f.setTime(100020);review(f.publish(3,[key(1)]));
  deny(f.publish(4,[key(),key(1)]),'KEY_RETIRED_OR_REVOKED');
  deny(f.publish(4,[key(0,'alias'),key(1)]),'KEY_MATERIAL_REUSED');
  f.setTime(100030);deny(f.lifecycle.assess(request()),'REQUEST_DENIED');
  review(f.lifecycle.assess(request(token(1))));
});

test('overlap cannot outlive old snapshot freshness; stale rotation has no grace', () => {
  const f=fixture({maxSnapshotAgeSeconds:30,maxOverlapSeconds:100});f.publish();
  f.setTime(100025);f.publish(2,[key(1)]);
  f.setTime(100029);review(f.lifecycle.assess(request()));
  f.setTime(100030);deny(f.lifecycle.assess(request()),'REQUEST_DENIED');
  review(f.lifecycle.assess(request(token(1))));
  f.setTime(100060);review(f.publish(3,[key(2)]));
  deny(f.lifecycle.assess(request(token(1))),'REQUEST_DENIED');
  review(f.lifecycle.assess(request(token(2))));
});

test('revocation immediately removes an active key and remains sticky across refreshes', () => {
  const f=fixture();f.publish(1,[key(),key(1)]);
  review(f.publish(2,[key(1)],{revokedKids:['key-0']}));
  deny(f.lifecycle.assess(request()),'REQUEST_DENIED');
  review(f.lifecycle.assess(request(token(1))));
  review(f.publish(3,[key(1)]));
  deny(f.publish(4,[key()]),'KEY_RETIRED_OR_REVOKED');
  deny(f.publish(4,[key(0,'renamed')]),'KEY_MATERIAL_REUSED');
  deny(f.publish(4,[key(2,'key-0')]),'KEY_ID_REUSED');
  assert.equal(f.lifecycle.status().revokedKeyCount,1);
});

test('revocation removes a retiring key before its overlap deadline', () => {
  const f=fixture();f.publish();f.setTime(100010);f.publish(2,[key(1)]);
  review(f.lifecycle.assess(request()));
  review(f.publish(3,[key(1)],{revokedKids:['key-0']}));
  deny(f.lifecycle.assess(request()),'REQUEST_DENIED');
  review(f.lifecycle.assess(request(token(1))));
});

test('revoking all keys fails closed and a distinct trusted replacement can recover', () => {
  const f=fixture();f.publish();
  review(f.publish(2,[],{revokedKids:['key-0']}));
  deny(f.lifecycle.assess(request()),'KEYSET_EMPTY');
  assert.equal(f.lifecycle.status().decision,'HOLD');
  review(f.publish(3,[key(1)]));review(f.lifecycle.assess(request(token(1))));
  deny(f.lifecycle.assess(request()),'REQUEST_DENIED');
});

test('unknown, duplicate and conflicting revocations leave current trust unchanged', () => {
  const f=fixture();f.publish();
  for (const [keys,revokedKids] of [ [[key()],['missing']], [[key()],['key-0']],
    [[],['key-0','key-0']], [[],['bad kid']], [[],[3]] ]) {
    deny(f.publish(2,keys,{revokedKids}));review(f.lifecycle.assess(request()));
  }
  assert.equal(f.lifecycle.status().generation,1);
});

test('key identity and material are immutable and alias duplicates are rejected', () => {
  const f=fixture();f.publish();
  deny(f.publish(2,[key(1,'key-0')]),'KEY_ID_REUSED');
  deny(f.publish(2,[key(),key(0,'alias')]),'KEY_MATERIAL_REUSED');
  deny(f.publish(2,[key(),key()]),'INVALID_SNAPSHOT');
  review(f.lifecycle.assess(request()));
});

test('publication validates key material using the existing P2-A boundary', () => {
  const f=fixture();f.publish();
  for (const invalid of [{...key(1),n:'!'}, {...key(1),n:'AQ'}, {...key(1),e:'Aw'},
    {...key(1),d:'not-allowed'}, {...key(1),alg:'HS256'}, {...key(1),key_ops:['sign']}]) {
    deny(f.publish(2,[invalid]),'INVALID_SNAPSHOT');review(f.lifecycle.assess(request()));
  }
});

test('four-key acceptance ceiling includes retiring keys and failure is atomic', () => {
  const f=fixture();f.publish(1,[key(),key(1),key(2),key(3)]);
  deny(f.publish(2,[key(4)]),'KEYSET_LIMIT');
  assert.equal(f.lifecycle.status().generation,1);review(f.lifecycle.assess(request()));
  review(f.publish(2,[key(4)],{revokedKids:['key-0','key-1','key-2','key-3']}));
  review(f.lifecycle.assess(request(token(4))));
});

test('zero overlap removes old trust immediately without requiring revocation', () => {
  const f=fixture({maxOverlapSeconds:0});f.publish();f.publish(2,[key(1)]);
  deny(f.lifecycle.assess(request()),'REQUEST_DENIED');review(f.lifecycle.assess(request(token(1))));
});

test('bounded lifetime history refuses silent eviction of tombstones', () => {
  const f=fixture({maxTrackedKeys:4,maxOverlapSeconds:0});
  for (let i=0;i<4;i++) review(f.publish(i+1,[key(i)]));
  deny(f.publish(5,[key(4)]),'KEY_HISTORY_LIMIT');
  assert.equal(f.lifecycle.status().generation,4);
  review(f.lifecycle.assess(request(token(3))));
  deny(f.publish(5,[key()]),'KEY_RETIRED_OR_REVOKED');
});

test('clock regression cannot revive stale snapshots or accept a new publication', () => {
  const f=fixture({maxSnapshotAgeSeconds:30});f.publish();
  f.setTime(100030);deny(f.lifecycle.assess(request()),'KEYSET_STALE');
  f.setTime(100001);deny(f.lifecycle.assess(request()),'CLOCK_REJECTED');
  deny(f.publish(2),'CLOCK_REJECTED');
  f.setTime(100030);review(f.publish(2));review(f.lifecycle.assess(request()));
});

test('invalid or throwing clock fails closed on every entry point', () => {
  for (const clock of [()=>NaN,()=>Infinity,()=>-1,()=>1.5,()=>{throw Error('private diagnostic');}]) {
    const f=fixture({clock});
    for (const value of [f.publish(),f.lifecycle.status(),f.lifecycle.assess(request())]) {
      deny(value,'CLOCK_REJECTED');assert.ok(!JSON.stringify(value).includes('private diagnostic'));
    }
  }
});

test('copies policy, clock reference and published keys before caller mutation', () => {
  const f=fixture(),keys=[key()];f.publish(1,keys);
  f.config.clock=()=>1;f.config.allowedSubjects[0]='other';f.config.issuer='other';
  keys[0].n='!';keys[0].kid='altered';keys.push(key(1));
  review(f.lifecycle.assess(request()));
  deny(f.lifecycle.assess(request(token(1))),'REQUEST_DENIED');
});

test('rejects getters, non-data structures and undeclared snapshot authority', () => {
  const f=fixture();f.publish();let getterCalls=0;
  const plain={generation:2,observedAtSeconds:100000,publicJwks:[key(1)],revokedKids:[]};
  const accessor={...plain};Object.defineProperty(accessor,'publicJwks',{enumerable:true,get(){getterCalls++;return [key(1)];}});
  const nonEnumerable={...plain};Object.defineProperty(nonEnumerable,'generation',{value:2,enumerable:false});
  const sparse={...plain,publicJwks:new Array(1)};
  const symbol={...plain,[Symbol('extra')]:true};
  const cycle={...plain};cycle.publicJwks=[cycle];
  for (const invalid of [accessor,nonEnumerable,sparse,symbol,cycle,
    {...plain,clock:()=>0},{...plain,nowSeconds:100000},{...plain,trusted:true},Object.create(plain)]) {
    deny(f.lifecycle.publish(invalid),'INVALID_SNAPSHOT');review(f.lifecycle.assess(request()));
  }
  assert.equal(getterCalls,0);
});

test('validates factory policy limits and descriptors before calling a clock', () => {
  const valid={issuer,audience,allowedSubjects:[subject],expectedHost:'api1.example.test',clock:()=>100000};
  for (const invalid of [{maxSnapshotAgeSeconds:0},{maxSnapshotAgeSeconds:3601},{maxSnapshotAgeSeconds:null},
    {maxOverlapSeconds:-1},{maxOverlapSeconds:3601},{maxOverlapSeconds:null},{maxTrackedKeys:3},
    {maxTrackedKeys:65},{generationFloor:-1},{generationFloor:null},{maxLifetimeSeconds:null},
    {issuer:'https://wrong.example.test'},{allowedSubjects:[]},{publicJwks:[key()]},{clock:1}]) {
    assert.throws(()=>createAccessKeysetLifecycle({...valid,...invalid}),/INVALID_LIFECYCLE_CONFIG/);
  }
  let calls=0;const getter={...valid};Object.defineProperty(getter,'clock',{enumerable:true,get(){calls++;return ()=>0;}});
  assert.throws(()=>createAccessKeysetLifecycle(getter),/INVALID_LIFECYCLE_CONFIG/);assert.equal(calls,0);
});

test('default freshness is 300 seconds and short assertion policy bounds default overlap', () => {
  const f=fixture();f.publish();f.setTime(100299);review(f.lifecycle.assess(request()));
  f.setTime(100300);deny(f.lifecycle.assess(request()),'KEYSET_STALE');
  assert.doesNotThrow(()=>fixture({maxLifetimeSeconds:60}));
  assert.throws(()=>fixture({maxLifetimeSeconds:60,maxOverlapSeconds:61}),/INVALID_LIFECYCLE_CONFIG/);
});
