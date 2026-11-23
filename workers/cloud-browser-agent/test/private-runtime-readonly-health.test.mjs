import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {
 parseReadOnlyPorts,checkPrivateRuntimeReadonly
} from "../simulation/check-private-runtime-readonly.mjs";

const NOW=Date.parse("2026-11-23T16:00:00.000Z");
const at=milliseconds=>new Date(milliseconds).toISOString();
const components={
 "/health/control-plane":{status:"ok",state:"polling"},
 "/health/queue":{status:"ok",state:"available"},
 "/health/dispatcher":{status:"ok",state:"accepting"},
 "/health/response-delivery":{status:"ok",state:"accepted"},
 "/health/mcp":{status:"unknown",state:"not_observed",details:{evidence:"unsupported_transport"}}
};
const write=(res,status,payload)=>{
 res.writeHead(status,{"content-type":"application/json","cache-control":"no-store"});
 res.end(typeof payload==="string"?payload:JSON.stringify(payload));
};
async function localServer(handler){
 const server=createServer(handler);
 await new Promise((resolve,reject)=>{
  server.once("error",reject);
  server.listen(0,"127.0.0.1",resolve);
 });
 return {port:server.address().port,async close(){
  await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
 }};
}
async function fixture(options={}){
 const requests=[];
 let ready=options.ready!==false;
 let polling=options.polling!==false;
 let stale=options.stale===true;
 let mcpStatus=options.mcpStatus??401;
 const health=await localServer((req,res)=>{
  requests.push({service:"health",method:req.method,path:req.url,
   authorized:Boolean(req.headers.authorization)});
  if(req.url==="/healthz")return write(res,200,"live");
  if(req.url==="/readyz")return write(res,ready?200:503,ready?"ready":"not ready");
  if(req.url==="/health")return write(res,options.redirect?302:200,
   options.redirect?"not followed":{
    schema_version:1,live:true,ready,
    snapshot_at:at(stale?NOW-360000:NOW),
    // Must never be echoed into health reports.
    secretFromUntrustedResponse:"Bearer SECRET_MUST_NOT_LEAK"
   });
  const component=components[req.url];
  if(component){
   const value={...component};
   if(req.url==="/health/control-plane"&&!polling){
    value.status="degraded";value.state="backoff";
   }
   return write(res,200,{schema_version:1,component:req.url.slice(8),
    ...value,untrusted:"Bearer SECRET_MUST_NOT_LEAK"});
  }
  return write(res,404,"missing");
 });
 const mcp=await localServer((req,res)=>{
  requests.push({service:"mcp",method:req.method,path:req.url,
   authorized:Boolean(req.headers.authorization)});
  return write(res,mcpStatus,
   mcpStatus===401?{error:"Authentication required"}:{secret:"Bearer SECRET_MUST_NOT_LEAK"});
 });
 return {
  healthPort:health.port,mcpPort:mcp.port,requests,
  setReady(value){ready=value;},
  setPolling(value){polling=value;},
  setStale(value){stale=value;},
  setMcpStatus(value){mcpStatus=value;},
  async close(){await Promise.all([health.close(),mcp.close()]);}
 };
}

test("P2-D accepts only two distinct explicit numeric local ports; no URL or default fallback",()=>{
 const p=parseReadOnlyPorts(["--mcp-port","40931","--health-port","40363"]);
 assert.deepEqual(p,{mcpPort:40931,healthPort:40363});
 for(const args of [
  [],["--health-port","40363"],["--health-port","40363","--health-port","40931"],
  ["--mcp-port","40931","--health-port","40931"],
  ["--health-port","http://127.0.0.1:443","--mcp-port","40931"],
  ["--health-port","localhost","--mcp-port","40931"],
  ["--health-port","0","--mcp-port","40931"],
  ["--health-port","65536","--mcp-port","40931"],
  ["--health-port","40363/evil","--mcp-port","40931"],
  ["--health-port","-1","--mcp-port","40931"],
  ["--health-port","40363","--mcp-port","40931","--token","supersecret"]
 ])assert.throws(()=>parseReadOnlyPorts(args),/port|required/);
});

test("P2-D healthy tunnel + guarded MCP: nine read-only loopback GETs, no bearer, no tool calls",async()=>{
 const services=await fixture();
 try{
  const result=await checkPrivateRuntimeReadonly({
   healthPort:services.healthPort,mcpPort:services.mcpPort,now:()=>NOW
  });
  assert.equal(result.overall,"ready_snapshot");
  assert.equal(result.checks.tunnelLiveness,"ok");
  assert.equal(result.checks.tunnelReadiness,"ok");
  assert.equal(result.checks.tunnelSnapshot,"current");
  assert.equal(result.checks.controlPlane,"ok");
  assert.equal(result.checks.mcpBearerBoundary,"authorization_required");
  assert.equal(result.checks.queue,"ok");
  assert.equal(result.checks.dispatcher,"ok");
  assert.equal(result.checks.responseDelivery,"ok");
  assert.equal(result.checks.mcpHealth,"http_transport_evidence_limited");
  assert.equal(services.requests.length,9);
  assert.deepEqual(services.requests.map(x=>x.method),Array(9).fill("GET"));
  assert.ok(services.requests.every(x=>!x.authorized));
  assert.ok(services.requests.every(x=>!x.path.includes("api/logs")));
  assert.ok(services.requests.every(x=>!x.path.includes("tools/call")));
  assert.doesNotMatch(JSON.stringify(result),/SECRET_MUST_NOT_LEAK|tunnel_[a-z0-9]/i);
  assert.match(result.limitations.join(" "),/No authenticated MCP/);
 }finally{await services.close();}
});

test("P2-D readiness and poller backoff report attention; recovery is observed without restarting",async()=>{
 const services=await fixture({ready:false,polling:false});
 try{
  const degraded=await checkPrivateRuntimeReadonly({
   healthPort:services.healthPort,mcpPort:services.mcpPort,now:()=>NOW
  });
  assert.equal(degraded.overall,"attention");
  assert.equal(degraded.checks.tunnelReadiness,"not_ready");
  assert.equal(degraded.checks.controlPlane,"degraded");
  services.setReady(true);
  services.setPolling(true);
  const recovered=await checkPrivateRuntimeReadonly({
   healthPort:services.healthPort,mcpPort:services.mcpPort,now:()=>NOW
  });
  assert.equal(recovered.overall,"ready_snapshot");
  assert.equal(recovered.nextStep,"No corrective action indicated by this local snapshot.");
  assert.ok(services.requests.every(x=>x.method==="GET"));
 }finally{await services.close();}
});

test("P2-D missing or unguarded MCP reports attention and never falls back to another port",async()=>{
 const services=await fixture({mcpStatus:200});
 try{
  const unsafe=await checkPrivateRuntimeReadonly({
   healthPort:services.healthPort,mcpPort:services.mcpPort,now:()=>NOW
  });
  assert.equal(unsafe.overall,"attention");
  assert.equal(unsafe.checks.mcpBearerBoundary,"unexpected_mcp_response");
  assert.match(unsafe.nextStep,/MCP process/);
  assert.doesNotMatch(JSON.stringify(unsafe),/SECRET_MUST_NOT_LEAK/);
  services.setMcpStatus(401);
  const fixed=await checkPrivateRuntimeReadonly({
   healthPort:services.healthPort,mcpPort:services.mcpPort,now:()=>NOW
  });
  assert.equal(fixed.overall,"ready_snapshot");
 }finally{await services.close();}
});

test("P2-D detects stale snapshots and never treats HTTP 200 alone as fresh health",async()=>{
 const services=await fixture({stale:true});
 try{
  const report=await checkPrivateRuntimeReadonly({
   healthPort:services.healthPort,mcpPort:services.mcpPort,now:()=>NOW
  });
  assert.equal(report.overall,"attention");
  assert.equal(report.checks.tunnelSnapshot,"stale");
  services.setStale(false);
  const recovered=await checkPrivateRuntimeReadonly({
   healthPort:services.healthPort,mcpPort:services.mcpPort,now:()=>NOW
  });
  assert.equal(recovered.overall,"ready_snapshot");
 }finally{await services.close();}
});

test("P2-D missing MCP port is reported unreachable; no open-port scans or auto-restarts",async()=>{
 const services=await fixture();
 const dead=await localServer((_req,res)=>res.end("unused"));
 const deadPort=dead.port;
 await dead.close();
 try{
  const report=await checkPrivateRuntimeReadonly({
   healthPort:services.healthPort,mcpPort:deadPort,now:()=>NOW,timeoutMs:500
  });
  assert.equal(report.overall,"attention");
  assert.equal(report.checks.mcpBearerBoundary,"unreachable");
  assert.equal(services.requests.filter(x=>x.service==="mcp").length,0);
  assert.match(report.nextStep,/existing terminal/);
 }finally{await services.close();}
});

test("P2-D local fetch never follows redirect or leaks raw response fields",async()=>{
 const services=await fixture({redirect:true});
 try{
  const urls=[];
  const wrappedFetch=(url,options)=>{
   urls.push(url);
   assert.equal(options.method,"GET");
   assert.equal(options.redirect,"manual");
   assert.ok(!Object.keys(options.headers).some(k=>k.toLowerCase()==="authorization"));
   assert.match(url,/^http:\/\/127\.0\.0\.1:\d+\//);
   return fetch(url,options);
  };
  const report=await checkPrivateRuntimeReadonly({
   healthPort:services.healthPort,mcpPort:services.mcpPort,
   fetchImpl:wrappedFetch,now:()=>NOW
  });
  assert.equal(report.overall,"attention");
  assert.equal(report.checks.tunnelSnapshot,"unexpected_http_status");
  assert.equal(urls.length,9);
  assert.doesNotMatch(JSON.stringify(report),/SECRET_MUST_NOT_LEAK/);
 }finally{await services.close();}
});
