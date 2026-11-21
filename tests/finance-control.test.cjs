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
