import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {connect} from 'node:net';
import {createOmniPilotMcpServer} from '../simulation/omnipilot-tunnel-mcp.mjs';
import {normalizeGenericBrowserCommand} from '../simulation/omnipilot-generic-browser.mjs';

// Real TCP only on owned 127.0.0.1 listeners; adapters are inert synthetic
// objects. No browser, external network, real secret, profile or process launch.
const TOKEN='synthetic_only_omnipilot_mcp_token_1234567890';
const MODERN='2026-07-28',LEGACY='2025-06-18';
const meta={'io.modelcontextprotocol/protocolVersion':MODERN,'io.modelcontextprotocol/clientCapabilities':{}};
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+p9GQAAAAASUVORK5CYII=';
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function syntheticResult(command,sequence=1) {
  const c=normalizeGenericBrowserCommand(command);let data;
  if(c.op==='status')data={tabCount:1,selectedTabId:'tab-1'};
  else if(c.op==='tabs.list')data={tabs:[{id:'tab-1',selected:true,origin:'https://owned.example.test'}]};
  else if(c.op==='tabs.create')data={tabId:'tab-2',origin:'about:blank'};
  else if(c.op==='snapshot')data={text:'Owned fixture evidence',truncated:false,visited:3};
  else if(c.op==='screenshot')data={mimeType:'image/png',base64:png,width:1,height:1,redactionComplete:false};
  else data={tabId:c.tabId,completed:true};
  return {op:c.op,sequence,untrustedContent:true,data};
}
async function fixture(t,{execute,stop,...bounds}={}) {
  const calls=[],stops=[];let sequence=0;
  const adapter={execute(command){calls.push(command);return execute?execute(command,calls.length):syntheticResult(command,++sequence);}};
  const server=await createOmniPilotMcpServer({adapter,bearerToken:TOKEN,
    stop(){stops.push({busy:server.diagnostics().busy});return stop?.();},...bounds});
  t.after(()=>server.close());
  return {server,calls,stops};
}
function rpc(name,args,id=1,modern=false) {
  return {jsonrpc:'2.0',id,method:'tools/call',params:{name,arguments:args,...(modern?{_meta:meta}:{})}};
}
const browser=(command,id=1,modern=false)=>rpc('omnipilot_browser',{command},id,modern);
function call(server,value,{headers={},token=TOKEN,body,method='POST',path='/mcp'}={}) {
  const target=new URL(server.url),bytes=body===undefined?Buffer.from(JSON.stringify(value)):Buffer.from(body);
  return new Promise((resolve,reject)=>{
    const req=httpRequest({host:'127.0.0.1',port:target.port,path,method,agent:false,headers:{
      host:target.host,'content-type':'application/json','content-length':bytes.length,
      ...(token===null?{}:{authorization:'Bearer '+token}),...headers}},res=>{
      const chunks=[];
      res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);
      res.on('end',()=>{
        const raw=Buffer.concat(chunks).toString('utf8');let value;
        try{value=raw?JSON.parse(raw):null;}catch{return reject(Error('Response is not JSON'));}
        resolve({status:res.statusCode,value,raw,headers:res.headers});
      });
    });
    req.on('error',reject);req.end(bytes);
  });
}
function modernHeaders(method,name) {
  return {'mcp-protocol-version':MODERN,'mcp-method':method,...(name?{'mcp-name':name}:{})};
}
function rawCall(server,raw) {
  const target=new URL(server.url);
  return new Promise((resolve,reject)=>{
    const socket=connect(Number(target.port),'127.0.0.1');const chunks=[];
    socket.on('connect',()=>socket.end(raw));socket.on('data',chunk=>chunks.push(chunk));
    socket.on('error',reject);socket.on('close',()=>resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
function rawRequest(server,body,extra=[],omit=[]) {
  const target=new URL(server.url),bytes=Buffer.isBuffer(body)?body:Buffer.from(body);
  const headers=[['Host',target.host],['Authorization','Bearer '+TOKEN],['Content-Type','application/json'],
    ['Content-Length',String(bytes.length)],['Connection','close']].filter(([name])=>!omit.includes(name));
  return Buffer.concat([Buffer.from('POST /mcp HTTP/1.1\r\n'+[...headers,...extra].map(([a,b])=>a+': '+b).join('\r\n')+'\r\n\r\n'),bytes]);
}
function failure(response,code,dispatched=false,outcomeUnknown=false) {
  assert.equal(response.status,200);assert.equal(response.value.result.isError,true);
  assert.deepEqual(response.value.result.structuredContent,{code,dispatched,outcomeUnknown,retrySafe:false});
  assert.ok(!response.raw.includes(TOKEN));
}

test('requires trusted capabilities and bounded configuration before opening a listener',async()=>{
  const valid={adapter:{execute(){}},stop(){},bearerToken:TOKEN};
  for(const changed of [{adapter:{}},{stop:null},{bearerToken:'short'},{bearerToken:TOKEN+'\n'},
    {commandTimeoutMs:0},{commandTimeoutMs:15001},{shutdownTimeoutMs:0},{maxRequestBytes:8193},
    {maxResponseBytes:4000001},{maxConnections:65},{requestTimeoutMs:10001}]) {
    await assert.rejects(createOmniPilotMcpServer({...valid,...changed}),{message:'INVALID_OMNIPILOT_MCP_CONFIG'});
  }
  let getters=0;const adapter={get execute(){getters++;return ()=>{};}};
  await assert.rejects(createOmniPilotMcpServer({...valid,adapter}),{message:'INVALID_OMNIPILOT_MCP_CONFIG'});
  assert.equal(getters,0);
});

test('rejects absent or wrong bearer before browser dispatch, including identity-looking headers',async t=>{
  const f=await fixture(t);
  for(const token of [null,'wrong',TOKEN+'x']){
    const response=await call(f.server,browser({op:'status'}),{token,headers:{'x-user-id':'operator',
      'cf-access-jwt-assertion':'fabricated','x-role':'controller'}});
    assert.equal(response.status,401);assert.ok(!response.raw.includes(TOKEN));
  }
  assert.equal(f.calls.length,0);assert.equal(f.stops.length,0);
  const overridden=await call(f.server,browser({op:'status'}),{headers:{authorization:'Bearer forwarded-untrusted'}});
  assert.equal(overridden.status,401);assert.equal(f.calls.length,0);
});

test('requires exact local Host and Origin, POST /mcp, and JSON content type',async t=>{
  const f=await fixture(t),target=new URL(f.server.url),value=browser({op:'status'});
  for(const headers of [{host:'localhost:'+target.port},{host:'127.0.0.1:1'},
    {origin:'http://other.example.test'},{origin:'null'},{'content-type':'text/plain'}]) {
    const result=await call(f.server,value,{headers});assert.ok([400,415].includes(result.status));
  }
  for(const change of [{method:'GET'},{path:'/mcp?identity=operator'},{path:'http://127.0.0.1/mcp'},{path:'/other'}]) {
    assert.equal((await call(f.server,value,change)).status,405);
  }
  assert.equal(f.calls.length,0);
  assert.equal((await call(f.server,value,{headers:{origin:target.origin}})).status,200);
  assert.equal(f.calls.length,1);
});

test('duplicate security headers and ambiguous framing are rejected before execute',async t=>{
  const f=await fixture(t),body=JSON.stringify(browser({op:'status'})),target=new URL(f.server.url);
  for(const [name,value] of [['Host',target.host],['Authorization','Bearer '+TOKEN],['Content-Type','application/json'],
    ['Content-Length',String(Buffer.byteLength(body))],['Origin',target.origin]]) {
    const extra=name==='Origin'?[['Origin',target.origin],[name,value]]:[[name,value]];
    const response=await rawCall(f.server,rawRequest(f.server,body,extra));
    assert.match(response,/HTTP\/1\.1 400/);
  }
  const ambiguous=await rawCall(f.server,rawRequest(f.server,body,[['Transfer-Encoding','chunked']]));
  assert.match(ambiguous,/HTTP\/1\.1 400/);assert.equal(f.calls.length,0);
});

test('strict JSON rejects duplicate decoded keys, malformed UTF-8, dangerous names and oversized bodies',async t=>{
  const f=await fixture(t),valid=JSON.stringify(browser({op:'status'}));
  const invalid=[valid.replace('"op":"status"','"op":"status","op":"tabs.create"'),
    valid.replace('"op":"status"','"op":"status","\\u006fp":"tabs.create"'),
    valid.replace('"op":"status"','"op":"status","__proto__":{}'),
    valid.replace('"op":"status"','"op":"status","x":1e999'),
    Buffer.from([0xff,0xfe]),' '.repeat(8193),valid+' trailing'];
  for(const body of invalid){const response=await call(f.server,null,{body});assert.ok([400,413].includes(response.status));}
  assert.equal(f.calls.length,0);assert.equal(f.stops.length,0);
});

test('legacy and modern discovery expose only bounded generic browser and stop tools with honest annotations',async t=>{
  const f=await fixture(t);
  const legacy=await call(f.server,{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:LEGACY,capabilities:{},clientInfo:{name:'owned-test',version:'1'}}});
  assert.equal(legacy.value.result.protocolVersion,LEGACY);
  const notification=await call(f.server,{jsonrpc:'2.0',method:'notifications/initialized'},{headers:{'mcp-protocol-version':LEGACY}});
  assert.equal(notification.status,202);assert.equal(notification.value,null);
  const discovery=await call(f.server,{jsonrpc:'2.0',id:2,method:'server/discover',params:{_meta:meta}},
    {headers:modernHeaders('server/discover')});
  assert.deepEqual(discovery.value.result.supportedVersions,[MODERN,LEGACY]);
  assert.equal(discovery.value.result.resultType,'complete');
  const listed=await call(f.server,{jsonrpc:'2.0',id:3,method:'tools/list',params:{_meta:meta}},
    {headers:modernHeaders('tools/list')});
  assert.deepEqual(listed.value.result.tools.map(tool=>tool.name),['omnipilot_browser','omnipilot_stop']);
  const tool=listed.value.result.tools[0];
  assert.equal(tool.annotations.readOnlyHint,false);assert.equal(tool.annotations.openWorldHint,true);
  assert.equal(tool.annotations.idempotentHint,false);assert.equal(tool.inputSchema.additionalProperties,false);
  const commands=tool.inputSchema.properties.command.oneOf.map(branch=>branch.properties.op.const);
  for(const op of ['navigate','click','fill','press','scroll','snapshot','screenshot','wait'])assert.ok(commands.includes(op));
  for(const op of ['evaluate','script','upload','download','profile','credentials'])assert.ok(!commands.includes(op));
  assert.equal(f.calls.length,0);
});

test('modern routing and metadata bindings cannot be forged or downgraded to legacy',async t=>{
  const f=await fixture(t),value=browser({op:'status'},1,true),good=modernHeaders('tools/call','omnipilot_browser');
  for(const headers of [{},{...good,'mcp-method':'tools/list'},{...good,'mcp-name':'omnipilot_stop'},
    {...good,'mcp-protocol-version':LEGACY}])assert.equal((await call(f.server,value,{headers})).status,400);
  const extra={...value,params:{...value.params,_meta:{...meta,identity:{verified:true}}}};
  assert.equal((await call(f.server,extra,{headers:good})).status,400);
  const version={...value,params:{...value.params,_meta:{...meta,'io.modelcontextprotocol/protocolVersion':'2099-01-01'}}};
  assert.equal((await call(f.server,version,{headers:good})).status,400);
  assert.equal((await call(f.server,browser({op:'status'}),{headers:good})).status,400);
  assert.equal((await call(f.server,{jsonrpc:'2.0',id:2,method:'tools/list',params:{_meta:meta}},
    {headers:modernHeaders('tools/list','omnipilot_browser')})).status,400);
  const body=JSON.stringify(value);
  const raw=await rawCall(f.server,rawRequest(f.server,body,[...Object.entries(good),['Mcp-Name','omnipilot_browser']]));
  assert.match(raw,/HTTP\/1\.1 400/);assert.equal(f.calls.length,0);
});

test('same immutable command schema rejects scripts, files, credentials, authority and mixed selectors',async t=>{
  const f=await fixture(t);
  for(const command of [{op:'evaluate',expression:'1'},{op:'navigate',tabId:'tab-1',url:'http://owned.example.test'},
    {op:'navigate',tabId:'tab-1',url:'https://user:secret@owned.example.test'},
    {op:'click',tabId:'tab-1',selector:'#button',x:1,y:2},{op:'fill',tabId:'tab-1',selector:'#name',value:'x',role:'owner'},
    {op:'press',tabId:'tab-1',key:'Control+V'},{op:'type',tabId:'tab-1',text:'x'.repeat(4097)},
    {op:'screenshot',tabId:'tab-1',width:1920,height:1200},{op:'select',tabId:'tab-1',selector:'#a',values:[]},
    {op:'status',tabId:'tab-1'},{op:'status',timeoutMs:9},{op:'tabs.create',profile:'real'}]) {
    assert.equal((await call(f.server,browser(command))).status,400);
  }
  assert.equal((await call(f.server,rpc('omnipilot_browser',{command:{op:'status'},adapter:{}}))).status,400);
  assert.equal((await call(f.server,rpc('omnipilot_stop',{role:'owner'}))).status,400);
  assert.equal(f.calls.length,0);assert.equal(f.stops.length,0);
});

test('valid commands reach only the injected fixed adapter as frozen data; metadata cannot create identity',async t=>{
  const f=await fixture(t);
  const response=await call(f.server,browser({op:'select',tabId:'tab-1',selector:'#owned',values:['one']},9,true),
    {headers:{...modernHeaders('tools/call','omnipilot_browser'),'x-user-id':'forged-caller','x-role':'admin'}});
  assert.equal(response.value.result.isError,false);assert.equal(response.value.result.resultType,'complete');
  assert.equal(f.calls.length,1);assert.ok(Object.isFrozen(f.calls[0]));assert.ok(Object.isFrozen(f.calls[0].values));
  assert.deepEqual(Object.keys(f.calls[0]),['op','tabId','selector','values']);
  assert.ok(!response.raw.includes('forged-caller'));assert.ok(!response.raw.includes(TOKEN));
  assert.equal(response.value.result.structuredContent.untrustedContent,true);
});

test('screenshots convert canonical PNG into one image block without duplicating base64 in structured content',async t=>{
  const f=await fixture(t),response=await call(f.server,browser({op:'screenshot',tabId:'tab-1'},1,true),
    {headers:modernHeaders('tools/call','omnipilot_browser')});
  assert.equal(response.value.result.isError,false);
  const content=response.value.result.content,summary=response.value.result.structuredContent;
  assert.equal(content.length,2);assert.equal(content[1].type,'image');assert.equal(content[1].mimeType,'image/png');
  assert.equal(content[1].data,png);assert.ok(!JSON.stringify(summary).includes(png));
  assert.equal(summary.data.redactionComplete,false);assert.equal(summary.data.width,1);
  assert.ok(!Object.hasOwn(f.calls[0],'width'));assert.ok(!Object.hasOwn(f.calls[0],'height'));
});

test('invalid PNG and oversized post-dispatch response halt before releasing ownership',async t=>{
  for(const kind of ['bad-png','oversize']) {
    const f=await fixture(t,{maxResponseBytes:1024,execute(command){
      const value=syntheticResult(command);
      if(kind==='bad-png')value.data.base64=Buffer.from('not a PNG').toString('base64');
      else value.data.text='x'.repeat(2000);
      return value;
    }});
    const response=await call(f.server,browser(kind==='bad-png'?{op:'screenshot',tabId:'tab-1'}:{op:'snapshot',tabId:'tab-1'}));
    failure(response,'MCP_RESULT_INVALID',true,true);
    assert.equal(f.stops.length,1);assert.equal(f.stops[0].busy,true);assert.equal(f.server.diagnostics().halted,true);
    failure(await call(f.server,browser({op:'status'})),'MCP_OWNER_STOPPED');assert.equal(f.calls.length,1);
  }
});

test('malformed success data and arbitrary adapter failures are sanitized and permanently halt',async t=>{
  let getterCalls=0;
  for(const execute of [()=>({op:'status',sequence:1,untrustedContent:false,data:{}}),
    ()=>{throw Error('synthetic-secret-not-for-response');},
    ()=>{const value=syntheticResult({op:'status'});Object.defineProperty(value.data,'tabCount',
      {enumerable:true,get(){getterCalls++;return 1;}});return value;}]) {
    const f=await fixture(t,{execute});const response=await call(f.server,browser({op:'status'}));
    assert.equal(response.value.result.isError,true);assert.equal(response.value.result.structuredContent.outcomeUnknown,true);
    assert.ok(!response.raw.includes('synthetic-secret'));assert.equal(f.stops[0].busy,true);
    assert.equal(f.server.diagnostics().halted,true);
  }
  assert.equal(getterCalls,0);
});

test('validated safe adapter rejection preserves precise flags and allows later work',async t=>{
  const f=await fixture(t,{execute(command,count){
    if(count===1)throw Object.assign(Error('not exposed'),{code:'TARGET_NOT_UNIQUE',dispatched:true,outcomeUnknown:false,retrySafe:false});
    return syntheticResult(command,count);
  }});
  failure(await call(f.server,browser({op:'click',tabId:'tab-1',selector:'#owned'})),'TARGET_NOT_UNIQUE',true,false);
  assert.equal(f.stops.length,0);assert.equal(f.server.diagnostics().halted,false);
  assert.equal((await call(f.server,browser({op:'status'}))).value.result.isError,false);
});

test('validated uncertain adapter rejection stops once before releasing busy state',async t=>{
  const f=await fixture(t,{execute(){throw Object.assign(Error('not exposed'),{
    code:'OPERATION_UNCERTAIN',dispatched:true,outcomeUnknown:true,retrySafe:false});}});
  failure(await call(f.server,browser({op:'reload',tabId:'tab-1'})),'OPERATION_UNCERTAIN',true,true);
  assert.equal(f.stops.length,1);assert.equal(f.stops[0].busy,true);assert.equal(f.server.diagnostics().busy,false);
  failure(await call(f.server,browser({op:'status'})),'MCP_OWNER_STOPPED');
});

test('one in-flight browser command blocks concurrent dispatch; authenticated stop remains available',async t=>{
  const pending=defer(),entered=defer(),f=await fixture(t,{execute(){entered.resolve();return pending.promise;}});
  const first=call(f.server,browser({op:'click',tabId:'tab-1',selector:'#owned'}));await entered.promise;
  failure(await call(f.server,browser({op:'status'})),'MCP_BUSY');assert.equal(f.calls.length,1);
  const stopped=await call(f.server,rpc('omnipilot_stop',{}));
  assert.equal(stopped.value.result.structuredContent.stopRequested,true);
  assert.equal(stopped.value.result.structuredContent.interruptedCommand.outcomeUnknown,true);
  assert.equal(stopped.value.result.structuredContent.browserTerminationVerified,false);
  failure(await first,'MCP_OWNER_STOPPED',true,true);assert.equal(f.stops[0].busy,true);
  pending.resolve(syntheticResult({op:'click',tabId:'tab-1',selector:'#owned'}));await delay(5);
  failure(await call(f.server,browser({op:'status'})),'MCP_OWNER_STOPPED');assert.equal(f.calls.length,1);
});

test('command timeout stops owner before returning uncertainty and ignores a late success',async t=>{
  const pending=defer(),f=await fixture(t,{commandTimeoutMs:20,execute(){return pending.promise;}});
  const response=await call(f.server,browser({op:'navigate',tabId:'tab-1',url:'https://owned.example.test'}));
  failure(response,'MCP_COMMAND_TIMEOUT',true,true);assert.equal(f.stops[0].busy,true);
  pending.resolve(syntheticResult(f.calls[0]));await delay(5);
  failure(await call(f.server,browser({op:'status'})),'MCP_OWNER_STOPPED');assert.equal(f.calls.length,1);
});

test('absolute command deadline rejects a success queued ahead of an overdue timer',async t=>{
  const f=await fixture(t,{commandTimeoutMs:10,execute(command){
    const end=performance.now()+25;while(performance.now()<end){}return syntheticResult(command);
  }});
  failure(await call(f.server,browser({op:'status'})),'MCP_COMMAND_TIMEOUT',true,true);
  assert.equal(f.stops[0].busy,true);
});

test('local response finish after the command deadline halts before busy release',async t=>{
  const f=await fixture(t,{commandTimeoutMs:10,execute(command){
    // This next tick precedes the response finish callback while the adapter's
    // result microtask can serialize first. Timer ordering cannot certify it.
    process.nextTick(()=>{const end=performance.now()+25;while(performance.now()<end){}});
    return syntheticResult(command);
  }});
  await call(f.server,browser({op:'status'}));
  assert.equal(f.server.diagnostics().halted,true);
  assert.deepEqual(f.server.diagnostics().lastFailure,{code:'MCP_COMMAND_TIMEOUT',
    dispatched:true,outcomeUnknown:true,retrySafe:false});
  assert.equal(f.stops[0].busy,true);assert.equal(f.server.diagnostics().busy,false);
  failure(await call(f.server,browser({op:'status'})),'MCP_OWNER_STOPPED');
  assert.equal(f.calls.length,1);
});

test('incomplete response disconnect after possible dispatch stops before allowing another command',async t=>{
  const pending=defer(),entered=defer(),f=await fixture(t,{execute(){entered.resolve();return pending.promise;}});
  const target=new URL(f.server.url),bytes=Buffer.from(JSON.stringify(browser({op:'click',tabId:'tab-1',selector:'#owned'})));
  const req=httpRequest({host:'127.0.0.1',port:target.port,path:'/mcp',method:'POST',agent:false,
    headers:{authorization:'Bearer '+TOKEN,'content-type':'application/json','content-length':bytes.length}},()=>{});
  req.on('error',()=>{});req.end(bytes);await entered.promise;req.destroy();
  for(let i=0;i<50&&!f.server.diagnostics().halted;i++)await delay(2);
  assert.equal(f.server.diagnostics().halted,true);assert.equal(f.stops[0].busy,true);
  assert.equal(f.server.diagnostics().lastFailure.code,'MCP_RESPONSE_DISCONNECTED');
  pending.resolve(syntheticResult(f.calls[0]));
  failure(await call(f.server,browser({op:'status'})),'MCP_OWNER_STOPPED');assert.equal(f.calls.length,1);
});

test('request abort before complete body never reaches the browser owner',async t=>{
  const f=await fixture(t),target=new URL(f.server.url),socket=connect(Number(target.port),'127.0.0.1');
  socket.on('error',()=>{});await new Promise(resolve=>socket.once('connect',resolve));
  socket.write('POST /mcp HTTP/1.1\r\nHost: '+target.host+'\r\nAuthorization: Bearer '+TOKEN+
    '\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{');
  socket.destroy();await delay(10);assert.equal(f.calls.length,0);assert.equal(f.stops.length,0);
});

test('close is idempotent, requests stop before draining and forcibly bounds idle sockets',async t=>{
  const f=await fixture(t,{shutdownTimeoutMs:20}),target=new URL(f.server.url),socket=connect(Number(target.port),'127.0.0.1');
  socket.on('error',()=>{});await new Promise(resolve=>socket.once('connect',resolve));
  socket.write('POST /mcp HTTP/1.1\r\n');
  const first=f.server.close(),second=f.server.close();assert.equal(first,second);
  assert.equal(f.stops.length,1);const result=await first;
  assert.equal(result.closed,true);assert.equal(result.shutdownTimedOut,true);assert.equal(result.browserTerminationVerified,false);
  await delay(5);assert.equal(f.server.diagnostics().connections,0);assert.equal(f.server.diagnostics().listenerClosed,true);
});

test('stop failures and nonsettling callbacks remain sanitized and bounded',async t=>{
  for(const stop of [()=>{throw Error('private-stop-diagnostic');},()=>new Promise(()=>{})]){
    const f=await fixture(t,{stop,shutdownTimeoutMs:15});
    const response=await call(f.server,rpc('omnipilot_stop',{}));
    assert.ok(!response.raw.includes('private-stop-diagnostic'));assert.equal(f.stops.length,1);
    await f.server.close();assert.ok(['failed','timed-out'].includes(f.server.diagnostics().stopState));
    assert.equal(f.server.diagnostics().browserTerminationVerified,false);
  }
});

test('late synchronous stop cannot be acknowledged and close includes time spent invoking it',async t=>{
  const f=await fixture(t,{shutdownTimeoutMs:10,stop(){const end=performance.now()+25;while(performance.now()<end){}}});
  const result=await f.server.close();
  assert.equal(result.stopState,'timed-out');assert.equal(result.shutdownTimedOut,true);
  assert.equal(result.browserTerminationVerified,false);assert.equal(f.stops.length,1);
});

test('discovery response bounds do not dispatch or grant browser authority',async t=>{
  const f=await fixture(t,{maxResponseBytes:1024});
  const response=await call(f.server,{jsonrpc:'2.0',id:1,method:'tools/list'});
  assert.equal(response.status,500);assert.equal(f.calls.length,0);assert.equal(f.stops.length,0);
  assert.equal(f.server.diagnostics().halted,false);
});
