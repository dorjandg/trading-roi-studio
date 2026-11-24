import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMockMcpUpstreamHeaders} from '../simulation/mock-oauth-upstream-headers.mjs';

// Clearly synthetic, non-secret stand-in; no credential is read or generated.
const upstreamToken = 'synthetic-upstream-credential-placeholder-000';
const legacy = {'content-type':'application/json',authorization:'Bearer '+upstreamToken};
const modern = method => ({'mcp-protocol-version':'2026-07-28','mcp-method':method});
const build = headers => buildMockMcpUpstreamHeaders(headers,upstreamToken);

test('legacy requests retain only JSON and the gateway-owned upstream bearer', () => {
  assert.deepEqual(build({}),legacy);
  assert.deepEqual(build({'content-type':'text/plain',authorization:'Bearer caller-token'}),legacy);
  assert.deepEqual(build(Object.create(null)),legacy);
});

test('modern discovery, ping and tools/list preserve exact required routing bindings', () => {
  for (const method of ['server/discover','ping','tools/list']) {
    assert.deepEqual(build(modern(method)),{...legacy,...modern(method)});
  }
});

test('modern tool calls preserve their tool-name binding as well as method and version', () => {
  const headers={...modern('tools/call'),'mcp-name':'browser_automate_wikipedia_demo'};
  assert.deepEqual(build(headers),{...legacy,...headers});
});

test('caller authorization, Access assertions, cookies, hosts and unrelated headers never cross', () => {
  const incoming={...modern('tools/list'),authorization:'Bearer caller-token',
    'cf-access-jwt-assertion':'caller-assertion',cookie:'caller-session',host:'caller.invalid',
    origin:'https://caller.invalid','proxy-authorization':'Basic caller-secret',
    'x-forwarded-user':'caller-identity','mcp-session-id':'caller-session-id',
    'content-length':'999',accept:'text/event-stream'};
  const output=build(incoming);
  assert.deepEqual(output,{...legacy,...modern('tools/list')});
  assert.ok(!JSON.stringify(output).includes('caller'));
});

test('projection never repairs missing or mismatched routing bindings', () => {
  assert.deepEqual(build({'mcp-protocol-version':'2026-07-28'}),
    {...legacy,'mcp-protocol-version':'2026-07-28'});
  assert.deepEqual(build({'mcp-method':'tools/call'}),{...legacy,'mcp-method':'tools/call'});
  assert.deepEqual(build({...modern('tools/list'),'mcp-name':'different_tool'}),
    {...legacy,...modern('tools/list'),'mcp-name':'different_tool'});
  // The existing upstream remains responsible for binding headers to JSON-RPC.
  assert.deepEqual(build({'mcp-protocol-version':'2025-06-18'}),
    {...legacy,'mcp-protocol-version':'2025-06-18'});
});

test('malformed, duplicate-style, oversized and non-string routing values fail closed', () => {
  const cases={
    'mcp-protocol-version':['',' 2026-07-28','2026-07-28 ','2026-07-28, 2026-07-28',
      '2026-07-28\r\nAuthorization: injected',null,['2026-07-28'],20260728],
    'mcp-method':['','tools/list, tools/list','tools/list\n','tools/ list','m'.repeat(65),{},['tools/list']],
    'mcp-name':['','tool,tool','tool\tname','é','n'.repeat(129),false,['tool']]
  };
  for (const [name,values] of Object.entries(cases)) {
    for (const value of values) assert.throws(()=>build({[name]:value}),/^Error: INVALID_MCP_UPSTREAM_HEADERS$/);
  }
});

test('selected accessors and hidden fields reject without executing getters', () => {
  let calls=0;
  const getter={};Object.defineProperty(getter,'mcp-method',{enumerable:true,get(){calls++;return 'ping';}});
  const hidden={};Object.defineProperty(hidden,'mcp-method',{value:'ping',enumerable:false});
  assert.throws(()=>build(getter),/INVALID_MCP_UPSTREAM_HEADERS/);
  assert.throws(()=>build(hidden),/INVALID_MCP_UPSTREAM_HEADERS/);
  assert.equal(calls,0);
});

test('unselected authority getters are never read and output is an immutable copy', () => {
  let calls=0;
  const incoming=modern('ping');
  for (const name of ['authorization','cf-access-jwt-assertion','cookie']) {
    Object.defineProperty(incoming,name,{enumerable:true,get(){calls++;throw Error('caller secret');}});
  }
  const output=build(incoming);incoming['mcp-method']='tools/call';
  assert.equal(calls,0);assert.deepEqual(output,{...legacy,...modern('ping')});
  assert.ok(Object.isFrozen(output));
});

test('invalid source maps and invalid internal bearer inputs return a constant error', () => {
  for (const value of [null,undefined,[],new Map(),Object.create({'mcp-method':'ping'})]) {
    assert.throws(()=>build(value),/^Error: INVALID_MCP_UPSTREAM_HEADERS$/);
  }
  for (const token of [null,undefined,'','short','x'.repeat(257),'x'.repeat(32)+'\r\nInjected: value']) {
    assert.throws(()=>buildMockMcpUpstreamHeaders({},token),/^Error: INVALID_MCP_UPSTREAM_HEADERS$/);
  }
});
