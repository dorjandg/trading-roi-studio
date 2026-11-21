const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('functions/api/ai-control.js','utf8');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('gateway disabled by default',async()=>{
 const {onRequest}=await load();
 const response=await onRequest({request:new Request('https://example.test/api/ai-control',{method:'POST'}),env:{}});
 assert.equal(response.status,503);
});
test('gateway denies missing bearer token even when enabled',async()=>{
 const {onRequest}=await load();
 const response=await onRequest({request:new Request('https://example.test/api/ai-control',{method:'POST'}),env:{AI_GATEWAY_ENABLED:'true',AI_GATEWAY_ISSUER:'https://issuer.example.test',AI_GATEWAY_AUDIENCE:'finance',AI_GATEWAY_JWKS_URL:'https://issuer.example.test/jwks'}});
 assert.equal(response.status,401);
});
test('valid scoped signed JWT exposes only metadata MCP tool',async()=>{
 const {onRequest}=await load();
 const pair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await webcrypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='key1';
 const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const header=enc({alg:'RS256',kid:'key1'});
 const body=enc({iss:'https://issuer.example.test',aud:'finance',sub:'user1',scope:'finance:metadata:read',exp:Math.floor(Date.now()/1000)+300});
 const signing=header+'.'+body;
 const sig=Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(signing))).toString('base64url');
 const env={AI_GATEWAY_ENABLED:'true',AI_GATEWAY_ISSUER:'https://issuer.example.test',AI_GATEWAY_AUDIENCE:'finance',AI_GATEWAY_JWKS_URL:'https://issuer.example.test/jwks'};
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}));
 try{
  const request=new Request('https://example.test/api/ai-control',{method:'POST',headers:{authorization:'Bearer '+signing+'.'+sig,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
  const response=await onRequest({request,env});
  assert.equal(response.status,200);
  const rpc=await response.json();
  assert.deepEqual(rpc.result.tools.map(t=>t.name),['finance_api_contract']);
 }finally{globalThis.fetch=oldFetch}
});

test('rejects invalid signature and missing scope',async()=>{
 const {onRequest}=await load();
 const pair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await webcrypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='key2';
 const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const header=encode({alg:'RS256',kid:'key2'});
 const env={AI_GATEWAY_ENABLED:'true',AI_GATEWAY_ISSUER:'https://issuer.example.test',AI_GATEWAY_AUDIENCE:'finance',AI_GATEWAY_JWKS_URL:'https://issuer.example.test/jwks'};
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}));
 try{
  for(const [scope,tamper] of [['other:scope',false],['finance:metadata:read',true]]){
   const body=encode({iss:env.AI_GATEWAY_ISSUER,aud:'finance',sub:'user1',scope,exp:Math.floor(Date.now()/1000)+300});
   const payload=header+'.'+body;
   let signature=Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(payload))).toString('base64url');
   if(tamper)signature=signature.slice(0,-2)+(signature.slice(-2)==='AA'?'BB':'AA');
   const request=new Request('https://example.test/api/ai-control',{method:'POST',headers:{authorization:'Bearer '+payload+'.'+signature,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
   const response=await onRequest({request,env});
   assert.equal(response.status,401);
  }
 }finally{globalThis.fetch=oldFetch}
});

test('rejects expired tokens and incorrect audience or issuer',async()=>{
 const {onRequest}=await load();
 const pair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await webcrypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='key3';
 const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const header=encode({alg:'RS256',kid:'key3'});
 const env={AI_GATEWAY_ENABLED:'true',AI_GATEWAY_ISSUER:'https://issuer.example.test',AI_GATEWAY_AUDIENCE:'finance',AI_GATEWAY_JWKS_URL:'https://issuer.example.test/jwks'};
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}));
 try{
  const now=Math.floor(Date.now()/1000);
  for(const override of [{exp:now-30},{aud:'wrong-audience'},{iss:'https://untrusted.example.test'}]){
   const claims={iss:env.AI_GATEWAY_ISSUER,aud:'finance',sub:'user1',scope:'finance:metadata:read',exp:now+300,...override};
   const signing=header+'.'+encode(claims);
   const signature=Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(signing))).toString('base64url');
   const request=new Request('https://example.test/api/ai-control',{method:'POST',headers:{authorization:'Bearer '+signing+'.'+signature,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
   assert.equal((await onRequest({request,env})).status,401);
  }
 }finally{globalThis.fetch=oldFetch}
});

test('unauthorized MCP client receives OAuth resource metadata location',async()=>{
 const {onRequest}=await load();
 const response=await onRequest({request:new Request('https://gateway.example.test/api/ai-control',{method:'POST'}),env:{AI_GATEWAY_ENABLED:'true',AI_GATEWAY_ISSUER:'https://issuer.example.test',AI_GATEWAY_AUDIENCE:'finance',AI_GATEWAY_JWKS_URL:'https://issuer.example.test/jwks'}});
 assert.equal(response.status,401);
 assert.equal(response.headers.get('www-authenticate'),'Bearer resource_metadata="https://gateway.example.test/.well-known/oauth-protected-resource"');
});
