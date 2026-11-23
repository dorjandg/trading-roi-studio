// API1 P2-D: manual, credential-free, read-only local health snapshot.
// Does not read files/environment secrets, spawn processes, modify configuration,
// call MCP tools, restart services, or probe public/non-loopback addresses.
import {pathToFileURL} from "node:url";

const MAX_RESPONSE_BYTES=16_384;
const DEFAULT_TIMEOUT_MS=3_000;
const DEFAULT_MAX_AGE_MS=120_000;
const PORT_PATTERN=/^[1-9][0-9]{0,4}$/;
const HEALTH_PATHS=Object.freeze([
 "/healthz","/readyz","/health","/health/control-plane",
 "/health/queue","/health/dispatcher","/health/response-delivery","/health/mcp"
]);

function validPort(value){
 const raw=typeof value==="number"?String(value):value;
 if(typeof raw!=="string"||!PORT_PATTERN.test(raw))return false;
 const port=Number(raw);
 return Number.isSafeInteger(port)&&port>=1&&port<=65535;
}

export function parseReadOnlyPorts(argv){
 if(!Array.isArray(argv)||argv.length!==4)throw Error("Two explicit local ports required");
 const seen=new Map();
 for(let i=0;i<4;i+=2){
  const flag=argv[i],value=argv[i+1];
  if(!["--health-port","--mcp-port"].includes(flag)||seen.has(flag)||!validPort(value))
   throw Error("Invalid local probe port");
  seen.set(flag,Number(value));
 }
 if(!seen.has("--health-port")||!seen.has("--mcp-port")||
    seen.get("--health-port")===seen.get("--mcp-port"))
  throw Error("Two distinct local service ports required");
 return Object.freeze({healthPort:seen.get("--health-port"),mcpPort:seen.get("--mcp-port")});
}

async function readLocalResponse(fetchImpl,port,path,timeoutMs){
 const uri="http://127.0.0.1:"+port+path; // no caller-selected URL, hostname or path
 try{
  const response=await fetchImpl(uri,{
   method:"GET",redirect:"manual",headers:{"accept":"application/json"},
   signal:AbortSignal.timeout(timeoutMs)
  });
  if(!response||!Number.isInteger(response.status))return {status:0,issue:"unavailable"};
  const length=Number(response.headers?.get?.("content-length")||0);
  if(length>MAX_RESPONSE_BYTES)return {status:response.status,issue:"oversized"};
  let body="";
  if(response.body){
   const reader=response.body.getReader();
   try{
    while(true){
     const part=await reader.read();
     if(part.done)break;
     body+=new TextDecoder().decode(part.value);
     if(Buffer.byteLength(body,"utf8")>MAX_RESPONSE_BYTES)
      return {status:response.status,issue:"oversized"};
    }
   }finally{await reader.cancel().catch(()=>{});}
  }
  return {status:response.status,body};
 }catch{
  // Never expose network exception text, addresses, headers or response bodies.
  return {status:0,issue:"unavailable"};
 }
}
function jsonOnly(response){
 if(response.status!==200||response.issue)return null;
 try{
  const obj=JSON.parse(response.body);
  return obj!==null&&typeof obj==="object"&&!Array.isArray(obj)?obj:null;
 }catch{return null;}
}
function code(response,expected=200){
 if(response.issue==="oversized")return "oversized_response";
 if(response.status===0)return "unreachable";
 if(response.status!==expected)return "unexpected_http_status";
 return "ok";
}
function component(response,expectedState){
 const common=code(response);
 if(common!=="ok")return common;
 const obj=jsonOnly(response);
 if(!obj||obj.schema_version!==1)return "invalid_component_snapshot";
 if(obj.status==="ok"&&obj.state===expectedState)return "ok";
 if(obj.status==="degraded")return "degraded";
 if(obj.status==="unknown")return "unknown";
 return "unexpected_component_state";
}
function secondary(response){
 const common=code(response);
 if(common!=="ok")return common;
 const obj=jsonOnly(response);
 if(!obj||obj.schema_version!==1)return "invalid_component_snapshot";
 return obj.status==="ok"?"ok":obj.status==="unknown"?"unknown":
  obj.status==="disabled"?"disabled":"degraded";
}
function mcpComponent(response){
 const common=code(response);
 if(common!=="ok")return common;
 const obj=jsonOnly(response);
 if(!obj||obj.schema_version!==1)return "invalid_component_snapshot";
 if(obj.status==="unknown"&&obj.details?.evidence==="unsupported_transport")
  return "http_transport_evidence_limited";
 return obj.status==="ok"?"reported_ok":"no_direct_protocol_proof";
}

export async function checkPrivateRuntimeReadonly({
 healthPort,mcpPort,fetchImpl=fetch,now=()=>Date.now(),
 timeoutMs=DEFAULT_TIMEOUT_MS,maxSnapshotAgeMs=DEFAULT_MAX_AGE_MS
}={}){
 if(!validPort(healthPort)||!validPort(mcpPort)||Number(healthPort)===Number(mcpPort))
  throw Error("Two distinct loopback ports required");
 if(typeof fetchImpl!=="function"||typeof now!=="function"||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>10_000||
    !Number.isSafeInteger(maxSnapshotAgeMs)||maxSnapshotAgeMs<1000||maxSnapshotAgeMs>600_000)
  throw Error("Invalid read-only probe configuration");
 const [live,ready,snapshot,control,queue,dispatcher,delivery,mcpHealth,mcp]=await Promise.all([
  ...HEALTH_PATHS.map(path=>readLocalResponse(fetchImpl,Number(healthPort),path,timeoutMs)),
  readLocalResponse(fetchImpl,Number(mcpPort),"/mcp",timeoutMs)
 ]);
 const checks={
  tunnelLiveness:code(live),
  tunnelReadiness:ready.status===503?"not_ready":code(ready),
  tunnelSnapshot:"unknown",
  controlPlane:component(control,"polling"),
  mcpBearerBoundary:mcp.status===401&&!mcp.issue?"authorization_required":
   mcp.status===0?"unreachable":
   mcp.issue==="oversized"?"oversized_response":"unexpected_mcp_response",
  queue:secondary(queue),
  dispatcher:secondary(dispatcher),
  responseDelivery:secondary(delivery),
  mcpHealth:mcpComponent(mcpHealth)
 };
 if(snapshot.status===404)checks.tunnelSnapshot="unsupported";
 else if(code(snapshot)!=="ok")checks.tunnelSnapshot=code(snapshot);
 else{
  const obj=jsonOnly(snapshot),time=Date.parse(obj?.snapshot_at||"");
  const age=Number(now())-time;
  if(!obj||obj.schema_version!==1||obj.live!==true||obj.ready!==true)
   checks.tunnelSnapshot="inconsistent";
  else if(!Number.isFinite(age))checks.tunnelSnapshot="invalid_timestamp";
  else if(age < -10_000||age>maxSnapshotAgeMs)checks.tunnelSnapshot="stale";
  else checks.tunnelSnapshot="current";
 }
 const critical=[
  checks.tunnelLiveness!=="ok",checks.tunnelReadiness!=="ok",
  !["current","unsupported"].includes(checks.tunnelSnapshot),
  checks.controlPlane!=="ok",
  checks.mcpBearerBoundary!=="authorization_required"
 ];
 const overall=critical.some(Boolean)?"attention":
  checks.tunnelSnapshot==="unsupported"?"limited":"ready_snapshot";
 const nextStep=
  checks.mcpBearerBoundary!=="authorization_required"?
   "Inspect the private MCP process/port in its existing terminal; do not restart automatically.":
  checks.tunnelLiveness!=="ok"||checks.tunnelReadiness!=="ok"?
   "Inspect tunnel-client health and its existing terminal; do not restart automatically.":
  checks.controlPlane!=="ok"?
   "Inspect control-plane polling/retry health; do not change credentials automatically.":
  checks.tunnelSnapshot!=="current"?
   "The health schema is missing or stale; verify runtime compatibility before any changes.":
   "No corrective action indicated by this local snapshot.";
 return Object.freeze({
  mode:"api1-local-readonly",overall,checks,
  nextStep,
  limitations:[
   "Local health observations are point-in-time, not ongoing availability proof.",
   "No authenticated MCP initialize, discovery, tools/list or browser tool call was made.",
   "Does not prove the tunnel identity, ChatGPT workspace association or end-to-end delivery.",
   "MCP HTTP transport discovery may be unobservable from tunnel-client health."
  ]
 });
}

// CLI is opt-in. Without exact ports, never scan, search or fall back.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const {healthPort,mcpPort}=parseReadOnlyPorts(process.argv.slice(2));
  const report=await checkPrivateRuntimeReadonly({healthPort,mcpPort});
  console.log("API1_READONLY_HEALTH",JSON.stringify(report));
  if(report.overall==="attention")process.exitCode=2;
 }catch{
  console.error("API1_READONLY_HEALTH_USAGE: node simulation/check-private-runtime-readonly.mjs --health-port PORT --mcp-port PORT");
  process.exitCode=2;
 }
}
