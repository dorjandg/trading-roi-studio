import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createTrustedIngress} from '../simulation/access-identity-boundary.mjs';
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const other=generateKeyPairSync('rsa',{modulusLength:2048});
const issuer='https://synthetic-team.cloudflareaccess.com', audience='synthetic-aud', subject='synthetic-sub';
const config=()=>({expectedHost:'api1.example.test',issuer,audience,allowedSubjects:[subject],publicJwks:[{...pair.publicKey.export({format:'jwk'}),kid:'synthetic'}],clock:()=>100000});
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function token(overrides={},key=pair.privateKey) {
  const data=enc({alg:'RS256',typ:'JWT',kid:'synthetic'})+'.'+enc({iss:issuer,aud:[audience],sub:subject,type:'app',iat:99900,nbf:99900,exp:100500,...overrides});
  return data+'.'+sign('RSA-SHA256',Buffer.from(data),key).toString('base64url');
}
const request=(assertion=token())=>({method:'POST',path:'/mcp',rawHeaders:['Host','api1.example.test','Content-Type','application/json','Cf-Access-Jwt-Assertion',assertion],body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
const blocked=r=>{assert.equal(r.admissionAuthorized,false);assert.equal(r.executionAuthorized,false);assert.equal(r.trustedIngressVerified,false);assert.equal(r.requiresExternalOwnershipFence,true);};
const denied=r=>{blocked(r);assert.equal(r.decision,'DENY');};
test('valid identity is reviewable only and never disclosed',()=>{
  const req=request(),r=createTrustedIngress(config()).assess(req);
  blocked(r);assert.equal(r.decision,'STRUCTURE_REVIEWABLE');
  for(const s of [req.rawHeaders[5],issuer,audience,subject]) assert.ok(!JSON.stringify(r).includes(s));
});
test('wrong signing key, issuer, audience, subject and time deny',()=>{
  const b=createTrustedIngress(config());
  for(const t of [token({},other.privateKey),token({iss:'https://other.cloudflareaccess.com'}),token({aud:['other']}),token({sub:'other'}),token({exp:100000}),token({iat:100100,nbf:100100}),token({type:'org'}),'opaque']) denied(b.assess(request(t)));
});
test('caller cannot override configuration, identity or clock',()=>{
  const b=createTrustedIngress(config());
  for(const extra of [{verifierConfig:config()},{identity:{verified:true}},{clock:()=>1},{nowSeconds:1},{publicJwks:config().publicJwks},{executionAuthorized:true}]) denied(b.assess({...request(),...extra}));
});
test('factory captures configuration and clock reference',()=>{
  const c=config(),b=createTrustedIngress(c);c.allowedSubjects[0]='other';c.publicJwks[0].kid='other';c.issuer='other';c.clock=()=>1;
  const r=b.assess(request());blocked(r);assert.equal(r.decision,'STRUCTURE_REVIEWABLE');
  denied(b.assess(request(token({sub:'other'}))));
});
test('clock failure and invalid configuration fail closed',()=>{
  for(const clock of [()=>NaN,()=>{throw Error('synthetic');}]) denied(createTrustedIngress({...config(),clock}).assess(request()));
  assert.throws(()=>createTrustedIngress({...config(),issuer:'https://other.invalid'}));
  assert.throws(()=>createTrustedIngress({...config(),allowedSubjects:[]}));
});
test('unknown MCP method remains denied',()=>{
  denied(createTrustedIngress(config()).assess({...request(),body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/delete'})}));
});

// T01-T03: signed raw JSON, including decoded-equivalent names.
function rawToken(h,p) {
  const data=Buffer.from(h).toString('base64url')+'.'+Buffer.from(p).toString('base64url');
  return data+'.'+sign('RSA-SHA256',Buffer.from(data),pair.privateKey).toString('base64url');
}
const h='{"alg":"RS256","typ":"JWT","kid":"synthetic"}';
const p=JSON.stringify({iss:issuer,aud:[audience],sub:subject,type:'app',iat:99900,nbf:99900,exp:100500});
test('T01 duplicate signed claims deny',()=>denied(createTrustedIngress(config()).assess(request(rawToken(h,p.slice(0,-1)+',"sub":"synthetic-sub"}')))));
test('T02 duplicate signed header deny',()=>denied(createTrustedIngress(config()).assess(request(rawToken(h.slice(0,-1)+',"alg":"RS256"}',p)))));
test('T03 escaped equivalent JWT names deny',()=>{
  const b=createTrustedIngress(config());
  denied(b.assess(request(rawToken(h,p.slice(0,-1)+',"s\\u0075b":"synthetic-sub"}'))));
  denied(b.assess(request(rawToken(h.slice(0,-1)+',"k\\u0069d":"synthetic"}',p))));
});
test('T08 malformed or weak keys rejected at construction',()=>{
  const c=config();
  for(const n of ['!','AQ','AAE','AQ==']) assert.throws(()=>createTrustedIngress({...c,publicJwks:[{...c.publicJwks[0],n}]}));
  const weak=generateKeyPairSync('rsa',{modulusLength:1024});
  assert.throws(()=>createTrustedIngress({...c,publicJwks:[{...weak.publicKey.export({format:'jwk'}),kid:'weak'}]}));
});
test('T12 clock and expiry boundaries',()=>{
  const b=createTrustedIngress(config());
  denied(b.assess(request(token({exp:100000}))));
  assert.equal(b.assess(request(token({exp:100001}))).decision,'STRUCTURE_REVIEWABLE');
  assert.equal(b.assess(request(token({iat:100030,nbf:100000}))).decision,'STRUCTURE_REVIEWABLE');
  denied(b.assess(request(token({iat:100031,nbf:100001}))));
  denied(b.assess(request(token({nbf:100001}))));
});

test('T08 extended: even and small-factor modulus rejected',()=>{
  const c=config(), k=c.publicJwks[0];
  const bytes=Buffer.from(k.n,'base64url'); bytes[bytes.length-1]&=254;
  assert.throws(()=>createTrustedIngress({...c,publicJwks:[{...k,n:bytes.toString('base64url')}]}));
  const n=BigInt('0x'+Buffer.from(k.n,'base64url').toString('hex'));
  const multiple=n-n%3n; const hex=multiple.toString(16);
  assert.throws(()=>createTrustedIngress({...c,publicJwks:[{...k,n:Buffer.from(hex.padStart(Math.ceil(hex.length/2)*2,'0'),'hex').toString('base64url')}]}));
});
test('T12 extended: contradictory time interval denied',()=>{
  denied(createTrustedIngress(config()).assess(request(token({iat:99900,nbf:100000,exp:100000}))));
});
test('T14 extended: signed escaped lone surrogate denied',()=>{
  denied(createTrustedIngress(config()).assess(request(rawToken(h,p.slice(0,-1)+',"extra":"\\ud800"}'))));
});
