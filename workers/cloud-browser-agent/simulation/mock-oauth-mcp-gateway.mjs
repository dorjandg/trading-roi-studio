// API1 OAuth CHALLENGE SIMULATOR; isolated loopback CI only.
// No OAuth provider, real keys, external HTTPS listener, deployment or token issuance.
// Inject an in-memory test-only Ed25519 public JWK; all accepted tokens must be
// synthetic, resource-bound, signed, time-valid and scoped to Wikipedia read.
import {createServer} from "node:http";
import {createIsolatedBrowserMcpServer} from "./isolated-real-browser-mcp.mjs";
import {createMockJwtVerifier,TEST_SCOPE} from "./mock-oauth-jwt.mjs";
import {buildProtectedResourcePlan,withOAuthSecurityScheme} from "./oauth-staging-readiness.mjs";

const JSON_HEADER={"content-type":"application/json; charset=utf-8",
 "cache-control":"no-store","x-content-type-options":"nosniff",
 "x-frame-options":"DENY","referrer-policy":"no-referrer",
 "content-security-policy":"default-src 'none'; frame-ancestors 'none'"};
const MAX_BYTES=4096;
const respond=(res,status,value,extra={})=>{
 res.writeHead(status,{...JSON_HEADER,...extra});res.end(JSON.stringify(value));
};
const errorResult=(id,challenge)=>({jsonrpc:"2.0",id,result:{
 isError:true,
 content:[{type:"text",text:"Authorization required for the Wikipedia read-only browser tool."}],
 _meta:{"mcp/www_authenticate":[challenge]}
}});
const validId=id=>Number.isSafeInteger(id)&&id>=0||
 typeof id==="string"&&id.length>0&&id.length<=64;
export async function createMockOauthMcpGateway(chromium,{
 routeFixture,timeoutMs=12000,issuer,resource,publicJwk,kid,allowedSubjects,nowSeconds
}={}){
 const plan=buildProtectedResourcePlan({resource,issuer,scope:TEST_SCOPE});
 const verifier=createMockJwtVerifier({issuer,resource,publicJwk,kid,allowedSubjects,nowSeconds});
 const upstream=await createIsolatedBrowserMcpServer(chromium,{routeFixture,timeoutMs});
 let closed=false;
 const server=createServer(async(req,res)=>{
  const host=req.headers.host||"";
  if(!/^127\.0\.0\.1:\d+$/.test(host))return respond(res,403,{error:"Loopback required"});
  if(req.headers.origin&&req.headers.origin!=="http://"+host)
   return respond(res,403,{error:"Origin refused"});
  const path=new URL(req.url||"/","http://127.0.0.1").pathname;
  if(req.method==="GET"&&path==="/.well-known/oauth-protected-resource")
   return respond(res,200,plan.metadata);
  if(path!=="/mcp"||req.method!=="POST")return respond(res,405,{error:"MCP POST only"});
  if(!(req.headers["content-type"]||"").startsWith("application/json"))
   return respond(res,415,{error:"JSON required"});
  if(Number(req.headers["content-length"]||0)>MAX_BYTES)
   return respond(res,413,{error:"MCP request too large"});
  let raw="";
  try{
   for await(const chunk of req){
    raw+=chunk;if(Buffer.byteLength(raw)>MAX_BYTES)throw Error("Too large");
   }
  }catch{return respond(res,413,{error:"MCP request too large"});}
  let rpc;
  try{rpc=JSON.parse(raw);}catch{return respond(res,400,{error:"Invalid JSON"});}
  if(!rpc||typeof rpc!=="object"||Array.isArray(rpc)||
   rpc.jsonrpc!=="2.0"||typeof rpc.method!=="string"||
   Object.keys(rpc).some(k=>!["jsonrpc","method","id","params"].includes(k))||
   !(validId(rpc.id)||(rpc.method==="notifications/initialized"&&!Object.hasOwn(rpc,"id"))))
   return respond(res,400,{error:"Invalid JSON-RPC envelope"});
  const auth=verifier.verify(req.headers.authorization);
  if(!auth.ok){
   const code=auth.error==="insufficient_scope"?"insufficient_scope":"invalid_token";
   const challenge='Bearer resource_metadata="'+plan.metadataUrl+
    '", scope="'+TEST_SCOPE+'", error="'+code+
    '", error_description="Wikipedia read authorization required"';
   const isToolCall=rpc.method==="tools/call"&&validId(rpc.id);
   if(isToolCall)return respond(res,200,errorResult(rpc.id,challenge));
   return respond(res,401,{error:"Authorization required"},
    {"www-authenticate":challenge});
  }
  try{
   // Forward to the previously tested internal MCP on its own 127.0.0.1
   // port; the external synthetic bearer never leaves this wrapper.
   const forwarded=await fetch(upstream.url,{
    method:"POST",headers:{"content-type":"application/json",
     authorization:"Bearer "+upstream.accessToken},
    body:raw,signal:AbortSignal.timeout(Math.min(120000,timeoutMs*5))
   });
   if(forwarded.status===202){res.writeHead(202,{"cache-control":"no-store"});return res.end();}
   const payload=await forwarded.json();
   // Tool discovery advertises the scope that will be enforced on call.
   if(rpc.method==="tools/list"&&forwarded.ok&&Array.isArray(payload.result?.tools)){
    payload.result.tools=payload.result.tools.map(t=>withOAuthSecurityScheme(t,plan));
   }
   return respond(res,forwarded.status,payload);
  }catch{
   return respond(res,502,{error:"Isolated mock MCP upstream failed"});
  }
 });
 try{
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 }catch(e){await upstream.close();throw e;}
 return Object.freeze({
  url:"http://127.0.0.1:"+server.address().port+"/mcp",
  metadataUrl:"http://127.0.0.1:"+server.address().port+"/.well-known/oauth-protected-resource",
  discovery:plan.metadata,
  async close(){
   if(closed)return;closed=true;
   await new Promise(resolve=>server.close(resolve));
   await upstream.close();
  }
 });
}
