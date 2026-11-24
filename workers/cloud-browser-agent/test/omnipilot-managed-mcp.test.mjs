import test from 'node:test';
import assert from 'node:assert/strict';
import {createMcpHandler} from '../src/mcp.mjs';

const token='isolated-demo-token-'+ 'x'.repeat(32);
const demo={url:'https://demo.playwright.dev/todomvc/',actions:[
  {op:'fill',selector:'input.new-todo',value:'OmniPilot MCP demo'},
  {op:'press',selector:'input.new-todo',key:'Enter'}
]};
const mk=(message,env={},authorization=token)=>{
  const req=new Request('https://isolated.example.invalid/mcp',{method:'POST',
    headers:{authorization:'Bearer '+authorization,'content-type':'application/json'},
    body:JSON.stringify(message)});
  return [req,{AGENT_API_TOKEN:token,...env}];
};
const rpc=(method,params={},id=9)=>({jsonrpc:'2.0',method,params,id});
const handler=createMcpHandler(async()=>{throw Error('Unexpected Chromium launch');});
test('managed browser tool is not exposed without opt-in',async()=>{
  const [request,env]=mk(rpc('tools/list'));
  const response=await handler(request,env),body=await response.json();
  assert.equal(response.status,200);
  assert.ok(!body.result.tools.some(t=>t.name==='omnipilot_managed_demo'));
  const [invokeRequest,invokeEnv]=mk(rpc('tools/call',{name:'omnipilot_managed_demo',arguments:demo}));
  const result=await(await handler(invokeRequest,invokeEnv)).json();
  assert.equal(result.error.code,-32602);
});
test('enabled tool is discoverable and malformed input cannot start browser',async()=>{
  let executed=0;
  const BROWSER={async script(){executed++;throw Error('should not call');}};
  const env={OMNIPILOT_MANAGED_PILOT_ENABLED:'true',BROWSER};
  const [listReq,listEnv]=mk(rpc('tools/list'),env);
  const list=await(await handler(listReq,listEnv)).json();
  const tool=list.result.tools.find(t=>t.name==='omnipilot_managed_demo');
  assert.equal(tool.inputSchema.properties.url.const,'https://demo.playwright.dev/todomvc/');
  const [callReq,callEnv]=mk(rpc('tools/call',{name:'omnipilot_managed_demo',
    arguments:{...demo,url:'http://127.0.0.1/admin'}}),env);
  const result=await(await handler(callReq,callEnv)).json();
  assert.equal(result.error.code,-32602);
  assert.equal(executed,0);
});
test('authorized pilot tool executes one bounded Browser Run command',async()=>{
  const calls=[];
  const env={OMNIPILOT_MANAGED_PILOT_ENABLED:'true',
    BROWSER:{async script(code,options){
      calls.push({code,options});
      return new Response(JSON.stringify({success:true,result:{ok:true,
        origin:'https://demo.playwright.dev',title:'React • TodoMVC',
        itemCount:1,items:['OmniPilot MCP demo']}}),{status:200});
    }}};
  const [req,vars]=mk(rpc('tools/call',{name:'omnipilot_managed_demo',arguments:demo}),env);
  const response=await handler(req,vars);
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.result.isError,false);
  const data=JSON.parse(body.result.content[0].text);
  assert.deepEqual(data.items,['OmniPilot MCP demo']);
  assert.equal(calls.length,1);
  assert.equal(calls[0].options.library,'playwright');
  assert.ok(calls[0].code.includes('demo.playwright.dev'));
});
test('MCP bearer boundary holds before exposing tool metadata or actions',async()=>{
  let called=0;
  const env={OMNIPILOT_MANAGED_PILOT_ENABLED:'true',BROWSER:{async script(){called++;}}};
  const [req,vars]=mk(rpc('tools/list'),env,'wrong-bearer');
  assert.equal((await handler(req,vars)).status,401);
  const [callReq,callEnv]=mk(rpc('tools/call',{name:'omnipilot_managed_demo',arguments:demo}),
    env,'wrong-bearer');
  assert.equal((await handler(callReq,callEnv)).status,401);
  assert.equal(called,0);
});
