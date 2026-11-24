import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import * as parser from '../simulation/access-trusted-ingress.mjs';
import * as boundary from '../simulation/access-identity-boundary.mjs';
const {createTrustedIngress}=boundary;
const host='api1.example.test', issuer='https://synthetic-team.cloudflareaccess.com';
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const data=enc({alg:'RS256',typ:'JWT',kid:'synthetic'})+'.'+enc({iss:issuer,aud:['synthetic-aud'],sub:'synthetic-sub',type:'app',iat:99900,nbf:99900,exp:100500});
const assertion=data+'.'+sign('RSA-SHA256',Buffer.from(data),pair.privateKey).toString('base64url');
const trust={issuer,audience:'synthetic-aud',allowedSubjects:['synthetic-sub'],publicJwks:[{...pair.publicKey.export({format:'jwk'}),kid:'synthetic'}],clock:()=>100000};
const create=(overrides={})=>createTrustedIngress({expectedHost:host,...trust,...overrides});
const request=()=>({method:'POST',path:'/mcp',rawHeaders:['Host',host,'Content-Type','application/json','Cf-Access-Jwt-Assertion',assertion],body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
const blocked=r=>{assert.equal(r.admissionAuthorized,false);assert.equal(r.executionAuthorized,false);assert.equal(r.trustedIngressVerified,false);assert.equal(r.requiresExternalOwnershipFence,true);};
const denied=r=>{blocked(r);assert.equal(r.decision,'DENY');};
test('signed synthetic request stays review-only',()=>{
  const r=create().assess(request());blocked(r);assert.equal(r.decision,'STRUCTURE_REVIEWABLE');assert.ok(!JSON.stringify(r).includes(assertion));
});
test('missing, duplicate, combined and malformed assertions deny',()=>{
  const b=create(),r=request();
  for(const rawHeaders of [r.rawHeaders.slice(0,4),[...r.rawHeaders,'cf-access-jwt-assertion',assertion],[...r.rawHeaders.slice(0,5),assertion+','+assertion],[...r.rawHeaders.slice(0,5),'opaque']]) denied(b.assess({...r,rawHeaders}));
});
test('spoofed identity, forwarded routing and ambiguous framing deny',()=>{
  const b=create(),r=request();
  for(const h of ['cf-access-authenticated-user-email','x-forwarded-for','x-forwarded-host','forwarded','authorization','transfer-encoding','cookie','origin','HOST']) denied(b.assess({...r,rawHeaders:[...r.rawHeaders,h,'synthetic']}));
});
test('target and exact request shape required',()=>{
  const b=create(),r=request();
  for(const x of [{method:'GET'},{path:'/mcp?x=1'},{path:'//mcp'},{verifierConfig:{}},{identity:{}},{trustedIngressVerified:true},{rawHeaders:['Host','other.example.test',...r.rawHeaders.slice(2)]}]) denied(b.assess({...r,...x}));
});
test('header/body ceilings, framing and malformed input deny',()=>{
  const b=create(),r=request();
  for(const x of [{body:'x'.repeat(4097)},{body:'{'},{body:'[]'},{rawHeaders:['Host']},{rawHeaders:[...r.rawHeaders,'Content-Length','1']},{rawHeaders:[...r.rawHeaders,'Accept','x'.repeat(12001)]},{rawHeaders:[...r.rawHeaders,'Accept','x\r\ny']}]) denied(b.assess({...r,...x}));
  denied(create({maxHeaderBytes:1024}).assess({...r,rawHeaders:[...r.rawHeaders,'Accept','x'.repeat(1024)]}));
});
test('duplicate decoded JSON keys, nested duplicates and dangerous keys deny',()=>{
  const b=create(),r=request();
  for(const body of ['{"jsonrpc":"2.0","id":1,"method":"ping","method":"tools/list"}','{"jsonrpc":"2.0","id":1,"method":"ping","m\\u0065thod":"ping"}','{"jsonrpc":"2.0","id":1,"method":"ping","params":{"_meta":{"x":1,"x":2}}}','{"jsonrpc":"2.0","id":1,"method":"ping","params":{"_meta":{"__proto__":{}}}}']) denied(b.assess({...r,body}));
});

test('T04 fabricated identity dependency rejected',()=>{
  assert.throws(()=>create({identityBoundary:{assess:()=>({decision:'STRUCTURE_REVIEWABLE'})}}));
});
test('T05 no exported identity-only assessment',()=>{
  assert.deepEqual(Object.keys(boundary),['createTrustedIngress']);
  assert.equal(typeof parser.assess,'undefined');
  denied(create().assess({assertion,method:'POST',path:'/mcp',headers:{},rpc:{jsonrpc:'2.0',id:1,method:'ping'}}));
});
test('T06 nonfinite numbers deny',()=>{
  for(const n of ['1e999','-1e999']) denied(create().assess({...request(),body:'{"jsonrpc":"2.0","id":1,"method":"ping","params":{"_meta":{"x":'+n+'}}}'}));
});
test('T07 excessive nesting deny',()=>denied(create().assess({...request(),body:'{"jsonrpc":"2.0","id":1,"method":"ping","params":{"_meta":{"x":'+ '['.repeat(30)+'0'+']'.repeat(30)+'}}}'})));
test('T09 nested accessors and unusual objects deny without getter invocation',()=>{
  let calls=0; const r=request(); Object.defineProperty(r.rawHeaders,'1',{get(){calls++;return host;},enumerable:true});
  denied(create().assess(r)); assert.equal(calls,0);
  const c={...trust,publicJwks:[Object.create(trust.publicJwks[0])]}; assert.throws(()=>create(c));
  const k={...trust.publicJwks[0]};Object.defineProperty(k,'n',{get(){calls++;return 'AQ';},enumerable:true});
  assert.throws(()=>create({publicJwks:[k]})); assert.equal(calls,0);
  const sparse=request(); delete sparse.rawHeaders[1];denied(create().assess(sparse));
});
const modern='2026-07-28', tool='browser_automate_wikipedia_demo';
const modernRequest=()=>({...request(),rawHeaders:[...request().rawHeaders,'Mcp-Protocol-Version',modern,'Mcp-Method','tools/call','Mcp-Name',tool],body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:tool,arguments:{query:'Synthetic query'},_meta:{'io.modelcontextprotocol/protocolVersion':modern,'io.modelcontextprotocol/clientCapabilities':{}}}})});
test('T10 valid modern bindings review only',()=>{const r=create().assess(modernRequest());blocked(r);assert.equal(r.decision,'STRUCTURE_REVIEWABLE');});
test('T11 conflicting modern bindings deny',()=>{
  for(const name of ['Mcp-Method','Mcp-Name','Mcp-Protocol-Version']) {const r=modernRequest();r.rawHeaders[r.rawHeaders.indexOf(name)+1]='wrong';denied(create().assess(r));}
  const r=modernRequest();r.rawHeaders.push('mcp-method','tools/call');denied(create().assess(r));
});
test('T13 exact byte limits and framing',()=>{
  const r=request(); const n=Buffer.byteLength(r.body);r.rawHeaders.push('Content-Length',String(n));
  const size=r.rawHeaders.reduce((sum,x,i)=>sum+x.length+(i%2?4:0),0);
  const limit=Math.max(1025,size+20);r.rawHeaders.push('Accept','x'.repeat(limit-size-10));
  // Accept name length 6 plus four framing bytes.
  assert.equal(create({maxHeaderBytes:limit,maxBodyBytes:n}).assess(r).decision,'STRUCTURE_REVIEWABLE');
  denied(create({maxHeaderBytes:limit-1,maxBodyBytes:n}).assess(r));
  denied(create({maxHeaderBytes:limit,maxBodyBytes:n-1}).assess(r));
});
test('T14 valid UTF-8, escaped strings and whitespace',()=>{
  const r=request();r.body=' {"jsonrpc":"2.0","id":1,"method":"ping","params":{"_meta":{"x":"caf\u00e9","y":"escaped \\"quote\\""}}}  ';
  assert.equal(create().assess(r).decision,'STRUCTURE_REVIEWABLE');
  denied(create().assess({...r,body:r.body.replace('caf\u00e9','\ud800')}));
});

test('T11 extended: modern non-tool methods reject mcp-name',()=>{
  const b=create();
  for(const method of ['ping','tools/list','server/discover']) {
    const r=modernRequest(); r.rawHeaders.splice(r.rawHeaders.indexOf('Mcp-Name'),2);
    r.rawHeaders[r.rawHeaders.indexOf('Mcp-Method')+1]=method;
    const rpc=JSON.parse(r.body); rpc.method=method; rpc.params={_meta:rpc.params._meta}; r.body=JSON.stringify(rpc);
    assert.equal(b.assess(r).decision,'STRUCTURE_REVIEWABLE');
    denied(b.assess({...r,rawHeaders:[...r.rawHeaders,'Mcp-Name',tool]}));
  }
});
test('T14 extended: escaped lone surrogate names and values deny; paired accepted',()=>{
  const r=request(),b=create();
  for(const meta of ['{"x":"\\ud800"}','{"\\udfff":1}']) denied(b.assess({...r,body:'{"jsonrpc":"2.0","id":1,"method":"ping","params":{"_meta":'+meta+'}}'}));
  assert.equal(b.assess({...r,body:'{"jsonrpc":"2.0","id":1,"method":"ping","params":{"_meta":{"x":"\\ud83d\\ude00"}}}'}).decision,'STRUCTURE_REVIEWABLE');
});
test('R2: early shape and string ceilings',()=>{
  const b=create(),r=request();
  denied(b.assess({...r,rawHeaders:new Array(100000)}));
  denied(b.assess({...r,body:'x'.repeat(12001)}));
  denied(b.assess({...r,...Object.fromEntries(Array.from({length:100},(_,i)=>['extra'+i,0]))}));
});
