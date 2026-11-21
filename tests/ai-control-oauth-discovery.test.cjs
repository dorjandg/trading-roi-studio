const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('functions/.well-known/oauth-protected-resource.js','utf8');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const request=new Request('https://gateway.example.test/.well-known/oauth-protected-resource');
test('OAuth metadata hidden when disabled',async()=>{
 const {onRequest}=await load();
 assert.equal((await onRequest({request,env:{}})).status,503);
});
test('OAuth metadata rejects cross-origin resource',async()=>{
 const {onRequest}=await load();
 const response=await onRequest({request,env:{AI_GATEWAY_ENABLED:'true',AI_GATEWAY_ISSUER:'https://issuer.example.test',AI_GATEWAY_RESOURCE_URL:'https://evil.example.test/api/ai-control'}});
 assert.equal(response.status,503);
});
test('OAuth metadata declares trusted issuer and metadata scope',async()=>{
 const {onRequest}=await load();
 const response=await onRequest({request,env:{AI_GATEWAY_ENABLED:'true',AI_GATEWAY_ISSUER:'https://issuer.example.test',AI_GATEWAY_RESOURCE_URL:'https://gateway.example.test/api/ai-control'}});
 assert.equal(response.status,200);
 const metadata=await response.json();
 assert.equal(metadata.resource,'https://gateway.example.test/api/ai-control');
 assert.deepEqual(metadata.authorization_servers,['https://issuer.example.test']);
 assert.deepEqual(metadata.scopes_supported,['finance:metadata:read']);
});
