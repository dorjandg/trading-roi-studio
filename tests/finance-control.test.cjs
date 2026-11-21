const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('functions/api/finance.js','utf8');
test('control capability route requires the existing authenticated handler', () => {
  const identityCheck = source.indexOf('user=await identity(request,env)');
  const membershipCheck = source.indexOf('const ws=member.workspace_id');
  const controlRoute = source.indexOf('resource")==="control-capabilities"');
  assert.ok(identityCheck >= 0 && membershipCheck > identityCheck && controlRoute > membershipCheck);
});
test('control capability endpoint is read-only and scoped to authenticated role', () => {
  const start=source.indexOf('resource")==="control-capabilities"');
  assert.ok(start>=0);
  const segment=source.slice(start,start+550);
  assert.match(segment,/method==="GET"/);
  assert.match(segment,/workspaceScoped:true/);
  assert.match(segment,/role:member.role/);
  assert.match(segment,/capabilities:/);
  assert.doesNotMatch(segment,/\.prepare\(|\.run\(|\.batch\(/);
});
test('unauthenticated calls are denied before any route', async () => {
  const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const response=await onRequest({request:new Request('https://example.test/api/finance?resource=control-capabilities'),env:{FINANCE_DB:{}}});
  assert.equal(response.status,401);
  assert.equal((await response.json()).error,'Authentication required');
});
test('missing database binding fails closed', async () => {
  const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const response=await onRequest({request:new Request('https://example.test/api/finance?resource=control-capabilities'),env:{}});
  assert.equal(response.status,503);
});

test('valid signed identity and membership return scoped capabilities without database writes', async () => {
  const {webcrypto}=require('node:crypto');
  const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const pair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await webcrypto.subtle.exportKey('jwk',pair.publicKey);
  jwk.kid='test-key';
  const encode=obj=>Buffer.from(JSON.stringify(obj)).toString('base64url');
  const head=encode({alg:'RS256',kid:'test-key'});
  const body=encode({iss:'https://team.example.test',aud:['finance-audience'],exp:Math.floor(Date.now()/1000)+300,sub:'user-123',email:'user@example.test'});
  const payload=head+'.'+body;
  const signature=Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(payload))).toString('base64url');
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async url=>{
    assert.equal(url,'https://team.example.test/cdn-cgi/access/certs');
    return new Response(JSON.stringify({keys:[jwk]}),{status:200});
  };
  let writes=0;
  const db={prepare(sql){
    assert.match(sql,/SELECT m.workspace_id,m.role FROM memberships/);
    return {bind(...args){assert.deepEqual(args,['user-123']);return {async first(){return {workspace_id:'workspace-123',role:'member'}}}}};
  },run(){writes++},batch(){writes++}};
  try {
    const request=new Request('https://example.test/api/finance?resource=control-capabilities',{headers:{'cf-access-jwt-assertion':payload+'.'+signature}});
    const response=await onRequest({request,env:{FINANCE_DB:db,CF_ACCESS_TEAM_DOMAIN:'https://team.example.test',CF_ACCESS_AUD:'finance-audience'}});
    assert.equal(response.status,200);
    const data=await response.json();
    assert.equal(data.service,'finance-hub');
    assert.equal(data.workspaceScoped,true);
    assert.equal(data.role,'member');
    assert.ok(data.capabilities.read.includes('transactions'));
    assert.deepEqual(data.capabilities.admin,[]);
    assert.equal(writes,0);
  } finally {globalThis.fetch=previousFetch}
});

test('rejects malformed JWT without querying workspace membership', async () => {
  const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  let queries=0;
  const db={prepare(){queries++;throw Error('database must not be queried')}};
  const request=new Request('https://example.test/api/finance?resource=control-capabilities',{headers:{'cf-access-jwt-assertion':'malformed.token'}});
  const response=await onRequest({request,env:{FINANCE_DB:db,CF_ACCESS_TEAM_DOMAIN:'https://team.example.test',CF_ACCESS_AUD:'finance-audience'}});
  assert.equal(response.status,401);
  assert.equal(queries,0);
});
test('capability discovery is not exposed to unauthenticated POST', async () => {
  const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const request=new Request('https://example.test/api/finance?resource=control-capabilities',{method:'POST'});
  const response=await onRequest({request,env:{FINANCE_DB:{}}});
  assert.equal(response.status,401);
});
