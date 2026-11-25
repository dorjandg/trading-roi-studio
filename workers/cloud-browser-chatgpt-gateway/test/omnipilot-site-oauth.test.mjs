import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRpc,forwardAuthorizedMcp} from '../src/forward.mjs';
import {publicDiscovery} from '../src/discovery.mjs';
import {renderConsent} from '../src/consent.mjs';
const env={
  CF_ACCESS_CLIENT_ID:'synthetic-id',CF_ACCESS_CLIENT_SECRET:'synthetic-secret',
  BROWSER_AGENT_API_TOKEN:'synthetic-token',OMNIPILOT_SITE_CONTROL_ENABLED:'true'
};
const rpc=(method,params={},id=11)=>({jsonrpc:'2.0',id,method,params});
const req=rpc=>new Request('https://cloud-browser-chatgpt-stage.example.invalid/mcp',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(rpc)});
const read=rpc('tools/call',{name:'omnipilot_site_read',arguments:{url:'https://www.wikipedia.org/'}});
const draft=rpc('tools/call',{name:'omnipilot_site_draft',arguments:{
  url:'https://demo.playwright.dev/todomvc/',
  actions:[{op:'fill',selector:'input.new-todo',value:'safe'}]}});
const user=scopes=>({userId:'synthetic-user',scopes});
test('new site tools remain absent unless the independent feature flag is true',async()=>{
  const baseline=await publicDiscovery(req(rpc('tools/list')));
  assert.equal((await baseline.json()).result.tools.length,6);
  const enabled=await publicDiscovery(req(rpc('tools/list')),env);
  const tools=(await enabled.json()).result.tools;
  assert.deepEqual(tools.slice(-2).map(x=>x.name),
    ['omnipilot_site_read','omnipilot_site_draft']);
  assert.deepEqual(tools.at(-2)._meta.securitySchemes[0].scopes,
    ['mcp:read','mcp:site.read']);
  assert.deepEqual(tools.at(-1)._meta.securitySchemes[0].scopes,
    ['mcp:read','mcp:site.read','mcp:site.interact']);
  assert.equal(tools.at(-2).annotations.readOnlyHint,true);
  assert.equal(tools.at(-1).annotations.readOnlyHint,false);
  assert.equal(tools.at(-1).annotations.destructiveHint,true);
  assert.equal(tools.length,8);
});
test('gateway validates structure but defers exact origin grants to protected backend',()=>{
  assert.equal(validateRpc(read),true);
  assert.equal(validateRpc(draft),true);
  assert.equal(validateRpc(rpc('tools/call',{name:'omnipilot_site_draft',
    arguments:{url:'https://demo.playwright.dev/todomvc/',actions:[]}})),false);
  assert.equal(validateRpc(rpc('tools/call',{name:'omnipilot_site_read',
    arguments:{url:'https://www.wikipedia.org/',secret:'anything'}})),false);
});
test('read-only OAuth scope is insufficient for site inspection',async()=>{
  let forwarded=0;
  const res=await forwardAuthorizedMcp(req(read),env,user(['mcp:read']),
    async()=>{forwarded++;return Response.json({});});
  assert.equal(res.status,200);
  const x=await res.json();
  assert.equal(x.result.isError,true);
  const challenge=x.result._meta['mcp/www_authenticate'][0];
  assert.match(challenge,/scope="mcp:read mcp:site\.read"/);
  assert.match(challenge,/error="insufficient_scope"/);
  assert.equal(forwarded,0);
});
test('site inspection grant cannot authorize typing, clicking or drafting',async()=>{
  let forwarded=0;
  const res=await forwardAuthorizedMcp(req(draft),env,
    user(['mcp:read','mcp:site.read']),async()=>{forwarded++;return Response.json({});});
  assert.equal(res.status,200);
  const x=await res.json();
  assert.equal(x.result.isError,true);
  assert.match(x.result._meta['mcp/www_authenticate'][0],
    /scope="mcp:read mcp:site\.read mcp:site\.interact"/);
  assert.equal(forwarded,0);
});
test('separately scoped site request forwards only to the Access-protected staging backend',async()=>{
  let forwarded=0;
  for(const [method,scopes] of [
    [read,['mcp:read','mcp:site.read']],
    [draft,['mcp:read','mcp:site.read','mcp:site.interact']]
  ]){
    const r=await forwardAuthorizedMcp(req(method),env,user(scopes),
      async(url,opts)=>{
        forwarded++;
        assert.equal(url,'https://cloud-browser-agent-stage.dorjan-gjoni-dg.workers.dev/mcp');
        assert.equal(opts.redirect,'manual');
        assert.equal(opts.headers['CF-Access-Client-Id'],env.CF_ACCESS_CLIENT_ID);
        assert.equal(opts.headers.Authorization,'Bearer '+env.BROWSER_AGENT_API_TOKEN);
        return Response.json({jsonrpc:'2.0',id:11,result:{content:[{type:'text',text:'{}'}]}});
      });
    assert.equal(r.status,200);
  }
  assert.equal(forwarded,2);
});
test('disabled flag cannot be bypassed with even fully granted OAuth',async()=>{
  let forwarded=0;
  for(const params of [read,draft]){
    const response=await forwardAuthorizedMcp(req(params),
      {...env,OMNIPILOT_SITE_CONTROL_ENABLED:'false'},
      user(['mcp:read','mcp:site.read','mcp:site.interact']),
      async()=>{forwarded++;return Response.json({});});
    assert.equal(response.status,403);
  }
  assert.equal(forwarded,0);
});
test('OAuth consent names each separate site permission rather than labeling it read-only',()=>{
  const html=renderConsent({clientName:'ChatGPT',clientDomain:'chatgpt.com',
    redirectHost:'chatgpt.com',redirectIsLoopback:false,
    scope:['mcp:read','mcp:site.read','mcp:site.interact']},'test');
  assert.match(html,/explicitly granted public sites/);
  assert.match(html,/non-submitting interaction/);
  assert.match(html,/mcp:site\.read/);
  assert.match(html,/mcp:site\.interact/);
});
