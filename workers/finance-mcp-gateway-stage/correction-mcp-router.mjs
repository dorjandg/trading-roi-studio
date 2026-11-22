// Standalone MCP JSON-RPC tool router for a dedicated, Access-protected Worker.
// This is NOT deployed. The existing connected Finance Hub MCP remains read-only.
// A gateway must be protected by Cloudflare Access; do not expose this endpoint publicly.
// Upstream Finance Hub independently verifies the original Cloudflare Access JWT.
// No arbitrary upstream URL, workspace, user, or authentication token is accepted in tool inputs.
const response=(id,result)=>({jsonrpc:"2.0",id,result});
const error=(id,code,message)=>({jsonrpc:"2.0",id,error:{code,message}});
const preview={name:"finance_correction_preview",description:"Read-only preview of exactly one Finance Hub metadata correction. Does not save.",inputSchema:{type:"object",additionalProperties:false,required:["transaction_id","field","expected_revision","expected_value","new_value"],properties:{transaction_id:{type:"string",pattern:"^[a-fA-F0-9-]{36}$"},field:{type:"string",enum:["category","provider","description"]},expected_revision:{type:"integer",minimum:1},expected_value:{type:"string"},new_value:{type:"string",minLength:1,maxLength:300}}}};
const save={name:"finance_correction_save",description:"Save one previously previewed, explicitly confirmed metadata correction. Disabled until separately authorized and configured.",inputSchema:{type:"object",additionalProperties:false,required:[...preview.inputSchema.required,"approval_ticket","confirmed"],properties:{...preview.inputSchema.properties,approval_ticket:{type:"string"},confirmed:{type:"boolean",const:true}}}};
const required=preview.inputSchema.required;
function valid(a,forSave){
 if(!a||typeof a!=="object"||Array.isArray(a))return false;
 const keys=forSave?[...required,"approval_ticket","confirmed"]:required;
 if(Object.keys(a).some(k=>!keys.includes(k))||keys.some(k=>!(k in a)))return false;
 return /^[a-f\d-]{36}$/i.test(a.transaction_id)&&["category","provider","description"].includes(a.field)&&
 Number.isSafeInteger(a.expected_revision)&&a.expected_revision>0&&typeof a.expected_value==="string"&&
 typeof a.new_value==="string"&&!!a.new_value.trim()&&a.new_value.length<=300&&a.expected_value!==a.new_value&&
 (!forSave||(a.confirmed===true&&typeof a.approval_ticket==="string"&&a.approval_ticket.length>10&&a.approval_ticket.length<=4096));
}
export async function routeMcp(payload,env,identityJwt,fetcher=fetch){
 const id=payload?.id??null;
 if(payload?.jsonrpc!=="2.0"||typeof payload.method!=="string")return error(id,-32600,"Invalid request");
 if(payload.method==="initialize")return response(id,{protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"finance-correction-gateway",version:"0.1.0"}});
 if(payload.method==="notifications/initialized")return null;
 if(payload.method==="ping")return response(id,{});
 if(payload.method==="tools/list")return response(id,{tools:[preview,...(env.FINANCE_MCP_WRITE_TOOLS_ENABLED==="true"?[save]:[])]});
 if(payload.method!=="tools/call")return error(id,-32601,"Method not found");
 const name=payload.params?.name,a=payload.params?.arguments;
 if(name!=="finance_correction_preview"&&name!=="finance_correction_save")return error(id,-32602,"Unknown tool");
 const forSave=name==="finance_correction_save";
 if(forSave&&env.FINANCE_MCP_WRITE_TOOLS_ENABLED!=="true")return error(id,-32602,"Write tool disabled");
 if(!valid(a,forSave))return error(id,-32602,"Invalid correction arguments");
 if(!identityJwt||typeof identityJwt!=="string")return error(id,-32001,"Cloudflare Access authentication required");
 if(!env.FINANCE_HUB_API_ORIGIN||!/^https:\/\/[^/]+$/.test(env.FINANCE_HUB_API_ORIGIN))return error(id,-32002,"Finance API origin not configured");
 const resource=forSave?"transaction-change-save":"transaction-change-preview";
 try{
  const upstream=await fetcher(env.FINANCE_HUB_API_ORIGIN+"/api/finance?resource="+resource,{method:"POST",headers:{"content-type":"application/json","cf-access-jwt-assertion":identityJwt},body:JSON.stringify(a),redirect:"manual"});
  if(!upstream.ok){
   return response(id,{isError:true,content:[{type:"text",text:"Finance API rejected request (HTTP "+upstream.status+"). No success reported."}]});
  }
  const result=await upstream.json();
  if(forSave&&result?.saved!==true)return response(id,{isError:true,content:[{type:"text",text:"Finance API did not confirm save."}]});
  if(!forSave&&(result?.previewOnly!==true||result?.saved!==false))return response(id,{isError:true,content:[{type:"text",text:"Finance API did not confirm read-only preview."}]});
  return response(id,{content:[{type:"text",text:JSON.stringify(result)}]});
 }catch{return response(id,{isError:true,content:[{type:"text",text:"Finance API unavailable. Do not assume any change was saved."}]})}
}
// Verify the Access assertion before exposing even tool discovery.
// Finance Hub still independently verifies the same assertion and its audience.
export async function verifyGatewayAccess(jwt,env,fetcher=fetch){
 const domain=String(env.CF_ACCESS_TEAM_DOMAIN||"").replace(/\/$/,"");
 if(!domain.startsWith("https://")||!env.CF_ACCESS_AUD||typeof jwt!=="string")return false;
 try{
  const parts=jwt.split(".");if(parts.length!==3)return false;
  const decode=x=>Uint8Array.from(atob(x.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(x.length/4)*4,"=")),c=>c.charCodeAt(0));
  const head=JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const body=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if(head.alg!=="RS256"||typeof head.kid!=="string"||body.iss!==domain||
    !Array.isArray(body.aud)||!body.aud.includes(env.CF_ACCESS_AUD)||
    !Number.isFinite(body.exp)||body.exp*1000<=Date.now()||
    (body.nbf&&body.nbf*1000>Date.now())||!body.sub||!body.email)return false;
  const certs=await fetcher(domain+"/cdn-cgi/access/certs");
  if(!certs.ok)return false;
  const jwk=(await certs.json()).keys?.find(k=>k.kid===head.kid&&k.kty==="RSA");
  if(!jwk)return false;
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  return await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
 }catch{return false}
}
export default {async fetch(request,env){
 // Cloudflare Access MUST also protect the gateway hostname. The forwarded JWT
 // is independently verified by Finance Hub. Never accept a JWT from tool args.
 if(request.method!=="POST")return new Response("Method not allowed",{status:405});
 const jwt=request.headers.get("cf-access-jwt-assertion");
 if(!jwt||!await verifyGatewayAccess(jwt,env))return new Response("Cloudflare Access required",{status:401});
 let payload;try{payload=await request.json()}catch{return new Response("Invalid JSON",{status:400})}
 const out=await routeMcp(payload,env,jwt);
 return out===null?new Response(null,{status:202}):new Response(JSON.stringify(out),{headers:{"content-type":"application/json","cache-control":"no-store"}});
}};
