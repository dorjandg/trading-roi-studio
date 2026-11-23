// Isolated MCP Streamable HTTP / JSON-RPC gateway for API1 Chromium.
// Development and CI only. No production imports, OAuth registration, deployment,
// user logins, arbitrary URLs, writes, or third-party automation engine.
// It forwards exactly one bounded, read-only public Wikipedia task to the
// existing token-protected loopback browser API.
import {createServer} from "node:http";
import {randomBytes,timingSafeEqual} from "node:crypto";
import {createRealPublicAutomationApi} from "./real-public-automation-api.mjs";

const VERSION="2025-06-18";
const MODERN_VERSION="2026-07-28";
const SUPPORTED_VERSIONS=Object.freeze([MODERN_VERSION,VERSION]);
const SERVER_INFO=Object.freeze({name:"api1-isolated-wikipedia-chromium",version:"0.1.0"});
const MODERN_IDENTITY=Object.freeze({"io.modelcontextprotocol/serverInfo":SERVER_INFO});
const isObject=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const modernResult=value=>({resultType:"complete",...value,_meta:MODERN_IDENTITY});
function validModernMetadata(params){
 if(!isObject(params)||!isObject(params._meta))return false;
 const meta=params._meta,client=meta["io.modelcontextprotocol/clientInfo"];
 return meta["io.modelcontextprotocol/protocolVersion"]===MODERN_VERSION&&
  isObject(meta["io.modelcontextprotocol/clientCapabilities"])&&
  (client===undefined||(isObject(client)&&typeof client.name==="string"&&
   client.name.length>0&&typeof client.version==="string"&&client.version.length>0));
}
const TOOL_NAME="browser_automate_wikipedia_demo";
const MAX_REQUEST_BYTES=4096;
const MAX_RESPONSE_BYTES=9_000_000;
const PNG_MAGIC="89504e470d0a1a0a";
const TOOL=Object.freeze({
 name:TOOL_NAME,
 title:"Read-only Wikipedia browser automation demo",
 description:"Launch fresh isolated Chromium; search public Wikipedia via its GET form, click a permitted internal article, extract article paragraphs, and return real PNG screenshots. No accounts, arbitrary URLs or writes.",
 inputSchema:{
  type:"object",additionalProperties:false,required:["query"],
  properties:{query:{type:"string",minLength:3,maxLength:80,pattern:"^[A-Za-z0-9 ,.'-]+$",
   description:"Plain text search term for the public Wikipedia GET search form."}}
 },
 annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:false,openWorldHint:false}
});
const header={
 "content-type":"application/json; charset=utf-8",
 "cache-control":"no-store","x-content-type-options":"nosniff",
 "x-frame-options":"DENY","referrer-policy":"no-referrer",
 "content-security-policy":"default-src 'none'; frame-ancestors 'none'"
};
function safeEqual(supplied,expected){
 const a=Buffer.from(typeof supplied==="string"?supplied:""),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
function send(res,status,payload){
 const data=typeof payload==="string"?payload:JSON.stringify(payload);
 res.writeHead(status,header);res.end(data);
}
const reply=(id,result)=>({jsonrpc:"2.0",id,result});
const error=(id,code,message,data)=>({jsonrpc:"2.0",id,
 error:{code,message,...(data===undefined?{}:{data})}});
function validateQuery(value){
 return typeof value==="string"&&value.length>=3&&value.length<=80&&
  /^[A-Za-z0-9 ,.'-]+$/.test(value);
}
function assertPng(base64){
 if(typeof base64!=="string"||base64.length>3_000_000||
  Buffer.from(base64,"base64").subarray(0,8).toString("hex")!==PNG_MAGIC)throw Error("Invalid browser evidence");
}
export async function createIsolatedBrowserMcpServer(chromium,{routeFixture,timeoutMs=30000,maxResponseBytes=MAX_RESPONSE_BYTES}={}){
 if(!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1024||maxResponseBytes>MAX_RESPONSE_BYTES)
  throw Error("Invalid MCP response ceiling");
 // Reuse the existing, independent authenticated API boundary. This is not
 // a production proxy or public endpoint; both listeners bind to 127.0.0.1.
 const upstream=await createRealPublicAutomationApi(chromium,{routeFixture,timeoutMs});
 const accessToken=randomBytes(32).toString("base64url");
 let busy=false,closed=false;
 const server=createServer(async(req,res)=>{
  if(closed)return send(res,503,{error:"Gateway closed"});
  const host=req.headers.host||"";
  if(!/^127\.0\.0\.1:\d+$/.test(host))return send(res,403,{error:"Loopback required"});
  if(req.headers.origin&&req.headers.origin!=="http://"+host)return send(res,403,{error:"Origin denied"});
  if(!safeEqual(req.headers.authorization,"Bearer "+accessToken))return send(res,401,{error:"Authentication required"});
  const path=new URL(req.url||"/","http://127.0.0.1").pathname;
  if(path!=="/mcp"||req.method!=="POST")return send(res,405,{error:"Only MCP POST available"});
  if(!(req.headers["content-type"]||"").startsWith("application/json"))return send(res,415,{error:"JSON required"});
  if(Number(req.headers["content-length"]||0)>MAX_REQUEST_BYTES)return send(res,413,{error:"Request too large"});
  let raw="";
  try{
   for await(const part of req){raw+=part;if(Buffer.byteLength(raw,"utf8")>MAX_REQUEST_BYTES)throw Error("Request too large");}
  }catch{return send(res,413,{error:"Request too large"});}
  let rpc;
  try{rpc=JSON.parse(raw);}catch{return send(res,400,{error:"Invalid JSON"});}
  if(!rpc||typeof rpc!=="object"||Array.isArray(rpc)||rpc.jsonrpc!=="2.0"||
   typeof rpc.method!=="string"||Object.keys(rpc).some(k=>!["jsonrpc","id","method","params"].includes(k)))
   return send(res,400,{error:"Invalid JSON-RPC envelope"});
  // MCP clients send this notification after initialize. It has no response.
  if(rpc.method==="notifications/initialized"&&!Object.hasOwn(rpc,"id")){
   res.writeHead(202,{"cache-control":"no-store"});return res.end();
  }
  const id=rpc.id;
  if(!Object.hasOwn(rpc,"id")||
   !(typeof id==="string"&&id.length>0&&id.length<=64||Number.isSafeInteger(id)&&id>=0))
   return send(res,400,{error:"Invalid JSON-RPC id"});
  const p=rpc.params;
  const requestedVersion=isObject(p)&&isObject(p._meta)?
   p._meta["io.modelcontextprotocol/protocolVersion"]:undefined;
  const modern=rpc.method==="server/discover"||requestedVersion===MODERN_VERSION;
  if(requestedVersion!==undefined&&!SUPPORTED_VERSIONS.includes(requestedVersion))
   return send(res,400,error(id,-32022,"Unsupported protocol version",
    {supported:SUPPORTED_VERSIONS,requested:requestedVersion}));
  // The 2026 protocol is stateless; clients must repeat metadata on every call.
  // Validate the three routing headers before dispatching to any method.
  if(modern){
   if(!validModernMetadata(p))
    return send(res,400,error(id,-32602,"Invalid modern MCP metadata"));
   if(req.headers["mcp-protocol-version"]!==MODERN_VERSION||
      req.headers["mcp-method"]!==rpc.method||
      (rpc.method==="tools/call"&&req.headers["mcp-name"]!==p.name))
    return send(res,400,error(id,-32020,"MCP header mismatch"));
  }
  if(rpc.method==="server/discover"){
   if(Object.keys(p).some(k=>k!=="_meta"))
    return send(res,200,error(id,-32602,"Unexpected discovery parameters"));
   return send(res,200,reply(id,modernResult({
    supportedVersions:SUPPORTED_VERSIONS,capabilities:{tools:{listChanged:false}},
    instructions:"Read-only English Wikipedia searches and article extraction only. No logins, arbitrary URLs, account actions or writes.",
    ttlMs:0,cacheScope:"private"
   })));
  }
  if(rpc.method==="initialize"){
   if(modern)return send(res,404,error(id,-32601,"Method not found"));
   if(p!==undefined&&(!isObject(p)||
    (p.protocolVersion!==undefined&&typeof p.protocolVersion!=="string")))
    return send(res,200,error(id,-32602,"Invalid initialization"));
   return send(res,200,reply(id,{protocolVersion:VERSION,
    capabilities:{tools:{listChanged:false}},serverInfo:SERVER_INFO}));
  }
  if(rpc.method==="ping"||rpc.method==="tools/list"){
   if(p!==undefined&&(!isObject(p)||
    Object.keys(p).some(k=>k!=="_meta")||
    (p._meta!==undefined&&!isObject(p._meta))))
    return send(res,200,error(id,-32602,"Unexpected parameters"));
   const result=rpc.method==="ping"?{}:{tools:[TOOL]};
   return send(res,200,reply(id,modern?
    modernResult(rpc.method==="tools/list"?{...result,ttlMs:0,cacheScope:"private"}:result):result));
  }
  if(rpc.method!=="tools/call")
   return send(res,modern?404:200,error(id,-32601,"Method not found"));
  if(!isObject(p)||Object.keys(p).some(k=>!["arguments","name",...(modern?["_meta"]:[])].includes(k))||
   p.name!==TOOL_NAME||!isObject(p.arguments)||
   Object.keys(p.arguments).join(",")!=="query"||!validateQuery(p.arguments.query))
   return send(res,200,error(id,-32602,"Tool refused"));
  if(busy)return send(res,200,error(id,-32001,"Isolated Chromium is busy"));
  busy=true;
  try{
   const upstreamResponse=await fetch(upstream.url+"/run",{
    method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+upstream.apiKey},
    body:JSON.stringify({task:"wikipedia-demo",query:p.arguments.query}),
    signal:AbortSignal.timeout(Math.min(120000,timeoutMs*5))
   });
   if(upstreamResponse.status!==200)throw Error("Upstream automation failed");
   const result=await upstreamResponse.json();
   if(result.status!=="passed"||result.productionWritesAllowed!==false||
    result.thirdPartyAutomationUsed!==false||!Array.isArray(result.steps)||
    result.steps.map(s=>s.action).join(",")!=="navigate,search,click"||
    !Array.isArray(result.screenshots)||result.screenshots.length!==3||
    !result.extracted?.heading||!Array.isArray(result.extracted.paragraphs)||!result.extracted.paragraphs.length)
    throw Error("Invalid upstream evidence");
   for(const screenshot of result.screenshots)assertPng(screenshot.base64);
   const summary={
    task:result.task,status:result.status,source:result.source,website:result.website,
    query:result.query,steps:result.steps,clickedLink:result.clickedLink,
    extracted:result.extracted,screenshotCount:result.screenshots.length,
    readOnly:true,productionWritesAllowed:false,thirdPartyAutomationUsed:false
   };
   const toolResult={
    ...(modern?{resultType:"complete",_meta:MODERN_IDENTITY}:{}),
    isError:false,structuredContent:summary,
    content:[{type:"text",text:JSON.stringify(summary)},
     ...result.screenshots.map((s,i)=>({type:"image",mimeType:"image/png",
      data:s.base64,annotations:{audience:["user"],priority:i===2?1:0.5}}))]
   };
   const payload=reply(id,toolResult);
   if(Buffer.byteLength(JSON.stringify(payload),"utf8")>maxResponseBytes)
    return send(res,200,error(id,-32000,"MCP image response exceeds ceiling"));
   return send(res,200,payload);
  }catch{
   // Never return private auth tokens, page HTML or network details.
   return send(res,200,error(id,-32000,"Isolated public browser automation failed"));
  }finally{busy=false;}
 });
 try{
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 }catch(e){await upstream.close();throw e;}
 return Object.freeze({
  url:"http://127.0.0.1:"+server.address().port+"/mcp",accessToken,
  async close(){if(closed)return;closed=true;
   await new Promise(resolve=>server.close(resolve));await upstream.close();}
 });
}
