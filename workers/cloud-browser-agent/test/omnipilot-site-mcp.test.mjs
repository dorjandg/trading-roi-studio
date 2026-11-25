import test from 'node:test';
import assert from 'node:assert/strict';
import {createMcpHandler} from '../src/mcp.mjs';
const authToken='site-test-'+('b'.repeat(45));
const grants=JSON.stringify({version:1,sites:[
  {origin:'https://www.wikipedia.org',mode:'read'},
  {origin:'https://demo.playwright.dev',mode:'draft'}]});
const image=Buffer.from([255,216,255,...Array(80).fill(0),255,217]).toString('base64');
const rpc=(method,params={},id=3)=>({jsonrpc:'2.0',id,method,params});
const call=(name,args)=>rpc('tools/call',{name,arguments:args});
const readArgs={url:'https://www.wikipedia.org/'};
const draftArgs={url:'https://demo.playwright.dev/todomvc/',
  actions:[{op:'fill',selector:'input.new-todo',value:'safe plan'}]};
const env=(other={})=>({AGENT_API_TOKEN:authToken,...other});
const request=(body,token=authToken)=>new Request('https://isolated.invalid/mcp',{
  method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify(body)});
const handler=createMcpHandler(async()=>{throw Error('No direct browser launch allowed')});
const run=async(msg,vars,token)=>handler(request(msg,token),vars);
const mock=(mode,url,actionCount)=>({
  async acquire(options){this.gate=options;return {sessionId:'site-session-test-12345'};},
  async script(script,opts){this.scriptCode=script;this.scriptOptions=opts;
    return new Response(JSON.stringify({success:true,result:{ok:true,
      origin:new URL(url).origin,url,title:'Site',mode,headings:['Safe heading'],
      actionCount,submitted:false,persisted:false,
      screenshotMime:'image/jpeg',screenshotBase64:image}}),{status:200});},
  async closeSession(id){this.closed=id;return {status:'closed'};}
});
test('default deployed MCP tool list remains unchanged without separate grants',async()=>{
  const regular=await(await run(rpc('tools/list'),env())).json();
  assert.equal(regular.result.tools.length,6);
  const ignored=await(await run(rpc('tools/list'),env({OMNIPILOT_SITE_CONTROL_ENABLED:'true'}))).json();
  assert.equal(ignored.result.tools.length,6);
  const newEnv=env({OMNIPILOT_SITE_CONTROL_ENABLED:'true',OMNIPILOT_SITE_GRANTS:grants});
  const enabled=await(await run(rpc('tools/list'),newEnv)).json();
  assert.deepEqual(enabled.result.tools.slice(-2).map(x=>x.name),
    ['omnipilot_site_read','omnipilot_site_draft']);
  assert.equal(enabled.result.tools.length,8);
});
test('unapproved host, lack of draft grant and missing feature flag refuse before browser acquisition',async()=>{
  let acquired=0;
  const BROWSER={async acquire(){acquired++;throw Error('Forbidden I/O');}};
  const vars=env({OMNIPILOT_SITE_CONTROL_ENABLED:'true',OMNIPILOT_SITE_GRANTS:grants,BROWSER});
  const inputs=[
    call('omnipilot_site_read',{url:'https://example.com/'}),
    call('omnipilot_site_draft',{url:'https://www.wikipedia.org/',
      actions:[{op:'fill',selector:'input.test',value:'never'}]}),
    call('omnipilot_site_read',{url:'https://fin-kac.pages.dev/'}),
    call('omnipilot_site_read',{url:'https://www.wikipedia.org/?secret=1'})
  ];
  for(const input of inputs){
    const result=await(await run(input,vars)).json();
    assert.equal(result.error.code,-32602);
  }
  const disabled=await(await run(call('omnipilot_site_read',readArgs),
    env({OMNIPILOT_SITE_GRANTS:grants,BROWSER}))).json();
  assert.equal(disabled.error.code,-32602);
  assert.equal(acquired,0);
});
test('owned read session returns isolated screenshot and page metadata',async()=>{
  const BROWSER=mock('read','https://www.wikipedia.org/',0);
  const vars=env({OMNIPILOT_SITE_CONTROL_ENABLED:'true',OMNIPILOT_SITE_GRANTS:grants,BROWSER});
  const response=await run(call('omnipilot_site_read',readArgs),vars);
  assert.equal(response.status,200);
  const result=(await response.json()).result;
  assert.equal(result.isError,false);
  assert.equal(result.content.length,2);
  assert.equal(result.content[1].type,'image');
  assert.equal(result.content[1].mimeType,'image/jpeg');
  assert.equal(result.content[1].data,image);
  const metadata=JSON.parse(result.content[0].text);
  assert.equal(metadata.ok,true);
  assert.equal(metadata.submitted,false);
  assert.equal(metadata.screenshotBase64,undefined);
  assert.deepEqual(BROWSER.gate.guardrails.allowedDomains,['www.wikipedia.org']);
  assert.equal(BROWSER.closed,'site-session-test-12345');
});
test('draft mode is separately granted and result never claims persistence',async()=>{
  const BROWSER=mock('draft','https://demo.playwright.dev/todomvc/',1);
  const vars=env({OMNIPILOT_SITE_CONTROL_ENABLED:'true',OMNIPILOT_SITE_GRANTS:grants,BROWSER});
  const result=(await(await run(call('omnipilot_site_draft',draftArgs),vars)).json()).result;
  const metadata=JSON.parse(result.content[0].text);
  assert.equal(result.isError,false);
  assert.equal(metadata.mode,'draft');
  assert.equal(metadata.persisted,false);
  assert.deepEqual(BROWSER.gate.guardrails.allowedDomains,['demo.playwright.dev']);
});
test('backend bearer is always required before tool listing or interactions',async()=>{
  let acquired=0;
  const vars=env({OMNIPILOT_SITE_CONTROL_ENABLED:'true',OMNIPILOT_SITE_GRANTS:grants,
    BROWSER:{async acquire(){acquired++;}}});
  assert.equal((await run(rpc('tools/list'),vars,'bad-token')).status,401);
  assert.equal((await run(call('omnipilot_site_read',readArgs),vars,'bad-token')).status,401);
  assert.equal(acquired,0);
});
