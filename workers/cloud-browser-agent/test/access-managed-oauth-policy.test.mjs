// Only synthetic, signed assertions and in-memory RPC shapes. No HTTP or browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {assessAuthorizedMcpRequest} from '../simulation/access-managed-oauth-policy.mjs';

const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...pair.publicKey.export({format:'jwk'}),kid:'policy-key'};
const verifierConfig={issuer:'https://synthetic-team.cloudflareaccess.com',audience:'api1-test-aud',
  publicJwks:[jwk],allowedSubjects:['synthetic-subject'],nowSeconds:100000};
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const data=enc({alg:'RS256',kid:'policy-key',typ:'JWT'})+'.'+enc({
  iss:verifierConfig.issuer,aud:[verifierConfig.audience],type:'app',sub:'synthetic-subject',
  iat:99900,nbf:99900,exp:100500});
const assertion=data+'.'+sign('RSA-SHA256',Buffer.from(data),pair.privateKey).toString('base64url');
const basic={assertion,verifierConfig,method:'POST',path:'/mcp',
  headers:{'content-type':'application/json'},
  rpc:{jsonrpc:'2.0',id:1,method:'tools/list',params:{}}};
const assess=extra=>assessAuthorizedMcpRequest({...basic,...extra});
const denied=r=>{assert.equal(r.decision,'DENY');assert.equal(r.executionAuthorized,false);};

test('discovery shapes reviewable but never authorize transport or runtime',()=>{
  for(const method of ['initialize','ping','tools/list']){
    const r=assess({rpc:{jsonrpc:'2.0',id:1,method,params:{}}});
    assert.equal(r.decision,'STRUCTURE_REVIEWABLE');
    assert.equal(r.admissionAuthorized,false);assert.equal(r.executionAuthorized,false);
  }
});
test('valid Wikipedia call remains review-only; cannot grant Phase3 execution',()=>{
  const rpc={jsonrpc:'2.0',id:'abc',method:'tools/call',params:{
    name:'browser_automate_wikipedia_demo',arguments:{query:'James Webb Space Telescope'}}};
  const r=assess({rpc,runtimeState:{executionAuthorized:true,ownerVerified:true}});
  assert.equal(r.decision,'STRUCTURE_REVIEWABLE');assert.equal(r.executionAuthorized,false);
  assert.equal(r.admissionAuthorized,false);assert.equal(r.tool,'browser_automate_wikipedia_demo');
});
test('missing/forged identity and invalid tokens deny before RPC review',()=>{
  denied(assess({assertion:undefined}));
  denied(assess({assertion:'oauth:opaque'}));
  denied(assess({identity:{verified:true,subject:'synthetic-subject'}}));
  denied(assess({verifierConfig:{...verifierConfig,allowedSubjects:['another-subject']}}));
});
test('non-POST /mcp or unsafe headers are rejected',()=>{
  for(const x of [{method:'GET'},{path:'/admin'},{path:'/mcp?query=x'},
    {headers:{'content-type':'text/plain'}},
    {headers:{'Content-Type':'application/json'}},
    {headers:{'content-type':['application/json']}}])denied(assess(x));
});
test('unknown methods, IDs, extra RPC keys and oversized bodies deny',()=>{
  const cases=[
    {jsonrpc:'2.0',id:1,method:'tools/delete'},
    {jsonrpc:'2.0',id:null,method:'ping'},
    {jsonrpc:'2.0',id:1,method:'ping',extra:1},
    {jsonrpc:'2.0',id:1,method:'ping',params:{ignored:1}},
    {jsonrpc:'2.0',id:1,method:'tools/list',params:{query:'x'.repeat(5000)}}
  ];
  for(const rpc of cases)denied(assess({rpc}));
});
test('arbitrary URLs, unknown tools and extra parameters are denied',()=>{
  const call=params=>assess({rpc:{jsonrpc:'2.0',id:2,method:'tools/call',params}});
  for(const params of [
    {name:'browser_open_url',arguments:{query:'Test'}},
    {name:'browser_automate_wikipedia_demo',arguments:{query:'https://finance.example'}},
    {name:'browser_automate_wikipedia_demo',arguments:{query:'Test',url:'https://example.com'}},
    {name:'browser_automate_wikipedia_demo',arguments:{query:'Ab'}},
    {name:'browser_automate_wikipedia_demo',arguments:{query:'Read; POST /login'}},
    {name:'browser_automate_wikipedia_demo',arguments:{query:'X'.repeat(81)}}
  ])denied(call(params));
});
test('modern MCP binding must match method, protocol and tool name',()=>{
  const meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28',
    'io.modelcontextprotocol/clientCapabilities':{}};
  const good={jsonrpc:'2.0',id:3,method:'server/discover',params:{_meta:meta}};
  const headers={...basic.headers,'mcp-protocol-version':'2026-07-28',
    'mcp-method':'server/discover'};
  assert.equal(assess({rpc:good,headers}).decision,'STRUCTURE_REVIEWABLE');
  denied(assess({rpc:good,headers:{...headers,'mcp-method':'tools/list'}}));
  denied(assess({rpc:good,headers:basic.headers}));
  denied(assess({rpc:{...good,params:{_meta:{...meta,
    'io.modelcontextprotocol/protocolVersion':'2099-01-01'}}},headers}));
});
test('initialized notification is accepted for review only without id',()=>{
  const r=assess({rpc:{jsonrpc:'2.0',method:'notifications/initialized'}});
  assert.equal(r.decision,'STRUCTURE_REVIEWABLE');
  denied(assess({rpc:{jsonrpc:'2.0',id:1,method:'notifications/initialized'}}));
});
