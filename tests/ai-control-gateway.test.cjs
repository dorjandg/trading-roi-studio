const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('functions/api/ai-control.js','utf8');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('gateway disabled by default',async()=>{
 const {onRequest}=await load();
 const response=await onRequest({request:new Request('https://example.test/api/ai-control',{method:'POST'}),env:{}});
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,'Gateway disabled');
});
test('gateway never exposes tools without OAuth even when enabled',async()=>{
 const {onRequest}=await load();
 const response=await onRequest({request:new Request('https://example.test/api/ai-control',{method:'POST'}),env:{AI_GATEWAY_ENABLED:'true'}});
 assert.equal(response.status,501);
 assert.match((await response.json()).error,/OAuth/);
});
