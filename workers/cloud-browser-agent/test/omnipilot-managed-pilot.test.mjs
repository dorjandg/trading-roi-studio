import test from 'node:test';
import assert from 'node:assert/strict';
import {validateManagedPilot,createManagedPilotScript,executeManagedPilot}
  from '../src/omnipilot-managed-pilot.mjs';

const input=()=>({url:'https://demo.playwright.dev/todomvc/',actions:[
  {op:'fill',selector:'input.new-todo',value:'OmniPilot smoke'},
  {op:'press',selector:'input.new-todo',key:'Enter'}
]});
const denied=fn=>assert.throws(fn,{code:'PILOT_INPUT_REFUSED'});
test('Cloudflare managed pilot accepts only bounded public fixture actions',()=>{
  const plan=validateManagedPilot(input());
  assert.equal(plan.url,'https://demo.playwright.dev/todomvc/');
  assert.deepEqual(plan.actions.map(x=>x.op),['fill','press']);
  assert.equal(Object.isFrozen(plan),true);
  for(const url of ['https://127.0.0.1/','http://demo.playwright.dev/todomvc/',
    'https://demo.playwright.dev@127.0.0.1/todomvc/',
    'https://demo.playwright.dev/todomvc/?token=secret',
    'https://demo.playwright.dev/','https://example.com/']){
    denied(()=>validateManagedPilot({...input(),url}));
  }
  for(const x of [null,[],{...input(),extra:'fail'},
    {...input(),actions:[]},
    {...input(),actions:Array(6).fill({op:'click',selector:'#button'})},
    {...input(),actions:[{op:'evaluate',selector:'body'}]},
    {...input(),actions:[{op:'fill',selector:'input[type=password]',value:'never'}]},
    {...input(),actions:[{op:'fill',selector:'input.new-todo',value:'x'.repeat(257)}]},
    {...input(),actions:[{op:'press',selector:'body',key:'Control+L'}]},
    {...input(),actions:[{op:'click',selector:'body',value:'extra'}]},
    {...input(),actions:[{op:'wait',selector:'body',extra:1}]}])
    denied(()=>validateManagedPilot(x));
});
test('malformed arrays, accessors, prototypes and JS-injection attempts fail closed',()=>{
  let touched=0;
  const accessor={url:'https://demo.playwright.dev/todomvc/',
    get actions(){touched++;return [];}};
  denied(()=>validateManagedPilot(accessor));assert.equal(touched,0);
  const sparse=[];sparse.length=2;sparse[1]={op:'click',selector:'body'};
  denied(()=>validateManagedPilot({url:'https://demo.playwright.dev/todomvc/',actions:sparse}));
  denied(()=>validateManagedPilot({url:'https://demo.playwright.dev/todomvc/',
    actions:[{op:'fill',selector:'input.new-todo',value:'\ud800'}]}));
  denied(()=>validateManagedPilot(Object.create({url:'https://demo.playwright.dev/todomvc/',actions:[]})));
});
test('generated script is a fixed function with the original strict plan as data',()=>{
  const code=createManagedPilotScript(input());
  assert.match(code,/context\.route\("\*\*\/\*", async route/);
  assert.match(code,/req\.method\(\)/);
  assert.match(code,/PILOT_SENSITIVE_FIELD/);
  assert.match(code,/PILOT_ORIGIN_CHANGED/);
  assert.match(code,/page\.goto/);
  assert.doesNotMatch(code,/eval\s*\(|new Function/);
  const callable=Function('return ('+code+')')();
  assert.equal(typeof callable,'function');
  const tricky={url:'https://demo.playwright.dev/todomvc/',
    actions:[{op:'fill',selector:'input.new-todo',value:");process.exit(1);("}]};
  const safe=createManagedPilotScript(tricky);
  const callable2=Function('return ('+safe+')')();
  assert.equal(typeof callable2,'function');
  assert.ok(safe.includes(JSON.stringify(tricky.actions[0].value).slice(1,-1)));
});
test('client sends one bounded script and parses only validated response',async()=>{
  const calls=[],closed=[];
  const binding={async script(code,options){
    calls.push({code,options});
    return new Response(JSON.stringify({success:true,result:{
      ok:true,origin:'https://demo.playwright.dev',title:'React • TodoMVC',
      itemCount:1,items:['OmniPilot smoke']}}),{
      status:200,headers:{'content-type':'application/json','cf-browser-session-id':'pilot-session-abc123'}});
  },async closeSession(id){closed.push(id);return Response.json({status:'closed'});}};
  const result=await executeManagedPilot(binding,input());
  assert.deepEqual(result,{ok:true,origin:'https://demo.playwright.dev',
    title:'React • TodoMVC',itemCount:1,items:['OmniPilot smoke']});
  assert.equal(calls.length,1);
  assert.deepEqual(closed,['pilot-session-abc123']);
  assert.deepEqual(calls[0].options,{library:'playwright',timeout:45000,keepAlive:10000});
  denied(()=>createManagedPilotScript({...input(),url:'https://example.com'}));
});
test('unavailable bindings and unexpected outcomes fail closed and are not retried',async()=>{
  assert.deepEqual(await executeManagedPilot(null,input()),
    {ok:false,code:'PILOT_BROWSER_UNAVAILABLE',retrySafe:false});
  let calls=0;
  const broken={async script(){calls++;throw Error('private-details-must-not-leak');},async closeSession(){throw Error('not used');}};
  const result=await executeManagedPilot(broken,input());
  assert.deepEqual(result,{ok:false,code:'PILOT_EXECUTION_UNCERTAIN',
    outcomeUnknown:true,retrySafe:false});
  assert.equal(calls,1);
  for(const payload of [{success:false},{success:true,result:{ok:true,origin:'https://bad.invalid',
    itemCount:1,items:['x']}},{success:true,result:{ok:true,origin:'https://demo.playwright.dev',
    itemCount:3,items:'not-array'}}]){
    const binding={async script(){return new Response(JSON.stringify(payload),{status:200,
      headers:{'cf-browser-session-id':'pilot-session-abc123'}});},
      async closeSession(){return Response.json({status:'closed'});}};
    const actual=await executeManagedPilot(binding,input());
    assert.equal(actual.ok,false);assert.equal(actual.retrySafe,false);
  }
});

test('untracked sessions and failed cleanup cannot be reported as completed actions',async()=>{
 const response=new Response(JSON.stringify({success:true,result:{ok:true,
  origin:'https://demo.playwright.dev',title:'Demo',itemCount:0,items:[]}}),{status:200});
 const noReceipt={async script(){return response;},async closeSession(){throw Error('no session');}};
 const missing=await executeManagedPilot(noReceipt,input());
 assert.equal(missing.code,'PILOT_SESSION_UNTRACKED');assert.equal(missing.retrySafe,false);
 let closed=0;
 const badClose={async script(){return new Response(JSON.stringify({success:true,result:{ok:true,
  origin:'https://demo.playwright.dev',title:'Demo',itemCount:0,items:[]}}),{
   status:200,headers:{'cf-browser-session-id':'pilot-session-abc123'}});},
   async closeSession(){closed++;throw Error('close unavailable');}};
 const result=await executeManagedPilot(badClose,input());
 assert.equal(result.code,'PILOT_CLEANUP_UNVERIFIED');
 assert.equal(result.ok,false);
 assert.equal(result.outcomeUnknown,true);
 assert.equal(result.retrySafe,false);
 assert.equal(closed,1);
});
