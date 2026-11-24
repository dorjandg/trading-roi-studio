// Offline only: ephemeral RSA keys, synthetic Access claims, injected clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {verifyAccessAssertion} from '../simulation/access-assertion-verifier.mjs';

const pair = generateKeyPairSync('rsa', {modulusLength: 2048});
const alt = generateKeyPairSync('rsa', {modulusLength: 2048});
const pub = (key, kid) => ({...key.export({format:'jwk'}), kid, alg:'RS256', use:'sig'});
const keyA = pub(pair.publicKey,'synthetic-a');
const keyB = pub(alt.publicKey,'synthetic-b');
const issuer = 'https://synthetic-team.cloudflareaccess.com';
const base = {issuer, audience:'api1-test-aud', allowedSubjects:['synthetic-human-subject'],
  publicJwks:[keyA], nowSeconds:100000};
const claims = () => ({iss:issuer, aud:['api1-test-aud'], type:'app',
  sub:'synthetic-human-subject', iat:99900, nbf:99900, exp:100500});
const encode = x => Buffer.from(JSON.stringify(x),'utf8').toString('base64url');
const make = (c = claims(), h = {alg:'RS256',typ:'JWT',kid:'synthetic-a'}, signingKey=pair.privateKey) => {
  const data=encode(h)+'.'+encode(c);
  return data+'.'+sign('RSA-SHA256',Buffer.from(data,'ascii'),signingKey).toString('base64url');
};
const check = (assertion, extra = {}) => verifyAccessAssertion({...base,...extra,assertion});
const isDenied = r => { assert.equal(r.decision,'DENY'); assert.equal(r.executionAuthorized,false); };

test('accepts synthetic, signed, single-audience human assertion without authorizing execution',()=>{
  const r=check(make());
  assert.equal(r.decision,'ALLOW');assert.equal(r.verified,true);
  assert.equal(r.executionAuthorized,false);assert.equal(r.identity.subject,'synthetic-human-subject');
  assert.ok(!('assertion' in r));assert.ok(!('email' in r.identity));
});
test('rejects opaque Managed OAuth token, missing token, and malformed segments',()=>{
  for(const v of [undefined,'oauth:opaque-value','aaa.bbb.ccc','a.b','a.b.c.d','a+.b.c'])isDenied(check(v));
});
test('rejects altered signature and untrusted kid',()=>{
  isDenied(check(make({...claims(), sub:'tampered'})));
  isDenied(check(make(claims(),{alg:'RS256',typ:'JWT',kid:'other'})));
  const ok=make();isDenied(check(ok.slice(0,-1)+(ok.endsWith('A')?'B':'A')));
});
test('rejects algorithm confusion, embedded untrusted signing key, and JOSE extensions',()=>{
  for(const header of [
    {alg:'none',typ:'JWT',kid:'synthetic-a'},
    {alg:'HS256',typ:'JWT',kid:'synthetic-a'},
    {alg:'RS256',typ:'JWT',kid:'synthetic-a',jku:'https://attacker.invalid/jwks'},
    {alg:'RS256',typ:'JWT',kid:'synthetic-a',jwk:keyA},
    {alg:'RS256',kid:'synthetic-a'},
    {alg:'RS256',typ:'JWT',kid:'synthetic-a',crit:['x']}
  ])isDenied(check(make(claims(),header)));
});
test('rejects issuer and exact application audience mismatch',()=>{
  isDenied(check(make({...claims(),iss:'https://other.cloudflareaccess.com'})));
  isDenied(check(make({...claims(),aud:['another-app']})));
  isDenied(check(make({...claims(),aud:['api1-test-aud','other-app']})));
  isDenied(check(make({...claims(),aud:'api1-test-aud'})));
});
test('rejects service identity and organization-wide token',()=>{
  isDenied(check(make({...claims(),type:'org'})));
  isDenied(check(make({...claims(),sub:''})));
  isDenied(check(make({...claims(),common_name:'fake-service'})));
  isDenied(check(make({...claims(),service_token_id:'fake-service'})));
});
test('rejects unauthorized human subject',()=>{
  assert.equal(check(make({...claims(),sub:'different-human'})).reason,'UNAUTHORIZED_SUBJECT');
});
test('rejects expired, not-yet-valid, future-issued, or overlong tokens',()=>{
  for(const c of [
    {...claims(),exp:100000},
    {...claims(),nbf:100001},
    {...claims(),iat:100031,nbf:100031},
    {...claims(),iat:95000,nbf:95000,exp:100500},
    {...claims(),iat:'99900'},
    {...claims(),exp:99900},
    {...claims(),nbf:99800}
  ])isDenied(check(make(c)));
});
test('accepts a new pinned public key after synthetic rotation, rejects removed old key',()=>{
  const tokenB=make(claims(),{alg:'RS256',typ:'JWT',kid:'synthetic-b'},alt.privateKey);
  assert.equal(check(tokenB,{publicJwks:[keyA,keyB]}).decision,'ALLOW');
  isDenied(check(tokenB));
  isDenied(check(make(),{publicJwks:[keyB]}));
});
test('rejects malformed/duplicate/untrusted key snapshots without revealing key content',()=>{
  isDenied(check(make(),{publicJwks:[keyA,keyA]}));
  isDenied(check(make(),{publicJwks:[{...keyA,d:'synthetic-private-material'}]}));
  isDenied(check(make(),{allowedSubjects:[]}));
  isDenied(check(make(),{nowSeconds:undefined}));
  isDenied(check(make(),{issuer:'http://not-secure.invalid'}));
});
