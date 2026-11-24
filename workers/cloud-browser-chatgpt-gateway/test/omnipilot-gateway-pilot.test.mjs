import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRpc,forwardAuthorizedMcp} from '../src/forward.mjs';
import {publicDiscovery} from '../src/discovery.mjs';
import {renderConsent} from '../src/consent.mjs';
const env={CF_ACCESS_CLIENT_ID:'synthetic.access',CF_ACCESS_CLIENT_SECRET:'synthetic',
  BROWSER_AGENT_API_TOKEN:'synthetic',OMNIPILOT_MANAGED_PILOT_ENABLED:'true'};
const req=value=>new Request('https://gateway.example.invalid/mcp',{method:'POST',body:JSON.stringify(value)});
const rpc=(method,params)=>({jsonrpc:'2.0',id:8,method,params});
const demo={url:'https://demo.playwright.dev/todomvc/',actions:[
 {op:'fill',selector:'input.new-todo',value:'public-test'},
 {op:'press',selector:'input.new-todo',key:'Enter'}]};
const call=rpc('tools/call',{name:'omnipilot_managed_demo',arguments:demo});
test('original six read-only tools remain default',async()=>{
 const r=await publicDiscovery(req(rpc('tools/list')));
 assert.equal((await r.json()).result.tools.length,6);
});
test('pilot discovery requires opt-in and declares separate OAuth scope',async()=>{
 const r=await publicDiscovery(req(rpc('tools/list')),env);
 const item=(await r.json()).result.tools.find(x=>x.name==='omnipilot_managed_demo');
 assert.ok(item);assert.equal(item.annotations.readOnlyHint,false);
 assert.deepEqual(item._meta.securitySchemes,[{type:'oauth2',scopes:['mcp:demo.interact']}]);
 assert.equal(validateRpc(call),true);
 assert.equal(validateRpc(rpc('tools/call',{name:'omnipilot_managed_demo',arguments:{...demo,url:'https://127.0.0.1/'}})),false);
});
test('read-only grants and disabled flag cannot dispatch demo actions',async()=>{
 let sent=0;
 const fake=async()=>{sent++;return Response.json({});};
 for(const [vars,scopes] of [[env,['mcp:read']],[{...env,OMNIPILOT_MANAGED_PILOT_ENABLED:'false'},['mcp:read','mcp:demo.interact']]]){
  const response=await forwardAuthorizedMcp(req(call),vars,{userId:'trusted',scopes},fake);
  assert.equal(response.status,403);
 }
 assert.equal(sent,0);
});
test('separately scoped pilot forwards to fixed Access-protected backend',async()=>{
 let count=0;
 const response=await forwardAuthorizedMcp(req(call),env,{userId:'trusted',scopes:['mcp:read','mcp:demo.interact']},async(url,opts)=>{
  count++;assert.equal(url,'https://cloud-browser-agent-stage.dorjan-gjoni-dg.workers.dev/mcp');
  assert.equal(opts.redirect,'manual');assert.equal(opts.headers.Authorization,'Bearer synthetic');
  return Response.json({jsonrpc:'2.0',id:8,result:{content:[]}});
 });
 assert.equal(response.status,200);assert.equal(count,1);
});
test('consent explicitly discloses demo interaction permission',()=>{
 const page=renderConsent({clientName:'Client',clientDomain:'client.example',redirectHost:'chatgpt.com',
  redirectIsLoopback:false,scope:['mcp:read','mcp:demo.interact']},'h');
 assert.ok(page.includes('separate permission to interact'));
 assert.ok(page.includes('mcp:demo.interact'));
});
