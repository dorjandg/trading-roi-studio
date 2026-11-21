/**
 * Finance AI Control Gateway: OAuth/JWT protected, metadata-only MCP endpoint.
 * Disabled unless AI_GATEWAY_ENABLED=true and issuer, audience, JWKS URL are configured.
 * No database access or financial records. Only one read-only tool.
 */
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store",...extra}});
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
const parse=s=>JSON.parse(new TextDecoder().decode(decode(s)));
const TOOLS=[{name:"finance_api_contract",description:"Describe the Finance Hub API integration status. Does not retrieve financial records.",inputSchema:{type:"object",properties:{},additionalProperties:false}}];
async function authorize(request,env){
 const issuer=String(env.AI_GATEWAY_ISSUER||""),audience=String(env.AI_GATEWAY_AUDIENCE||""),jwksUrl=String(env.AI_GATEWAY_JWKS_URL||"");
 if(!issuer.startsWith("https://")||!audience||!jwksUrl.startsWith("https://"))throw Error("OAuth not configured");
 const bearer=request.headers.get("authorization")||"";
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(bearer))throw Error("Bearer token required");
 const token=bearer.slice(7),parts=token.split(".");
 if(parts.length!==3)throw Error("Invalid token");
 const [header,claims]=parts.slice(0,2).map(parse);
 if(header.alg!=="RS256"||!header.kid||claims.iss!==issuer||!(Array.isArray(claims.aud)?claims.aud.includes(audience):claims.aud===audience)||!claims.sub||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||claims.nbf&&claims.nbf*1000>Date.now())throw Error("Invalid claims");
 const response=await fetch(jwksUrl);
 if(!response.ok)throw Error("JWKS unavailable");
 const jwks=await response.json();
 const jwk=(jwks.keys||[]).find(k=>k.kid===header.kid&&k.kty==="RSA"&&(!k.alg||k.alg==="RS256")&&(!k.use||k.use==="sig"));
 if(!jwk)throw Error("Signing key unavailable");
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1])))throw Error("Invalid signature");
 // Scope is mandatory, even for metadata discovery.
 const scopes=String(claims.scope||"").split(/\s+/);
 if(!scopes.includes("finance:metadata:read"))throw Error("Missing scope");
 return {subject:claims.sub};
}
export async function onRequest({request,env}){
 if(env.AI_GATEWAY_ENABLED!=="true")return json({error:"Gateway disabled"},503);
 let principal;try{principal=await authorize(request,env)}catch{const origin=new URL(request.url).origin;const metadata=origin+"/.well-known/oauth-protected-resource";return json({error:"Unauthorized"},401,{"www-authenticate":'Bearer resource_metadata="'+metadata+'"'})}
 if(request.method!=="POST")return json({error:"Method not allowed"},405,{"allow":"POST"});
 let rpc;try{rpc=await request.json()}catch{return json({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Parse error"}},400)}
 if(!rpc||rpc.jsonrpc!=="2.0"||typeof rpc.method!=="string")return json({jsonrpc:"2.0",id:rpc?.id??null,error:{code:-32600,message:"Invalid Request"}},400);
 const id=rpc.id??null;
 if(rpc.method==="initialize")return json({jsonrpc:"2.0",id,result:{protocolVersion:"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"finance-ai-control",version:"0.1.0"}}});
 if(rpc.method==="notifications/initialized")return new Response(null,{status:202});
 if(rpc.method==="tools/list")return json({jsonrpc:"2.0",id,result:{tools:TOOLS}});
 if(rpc.method==="tools/call"&&rpc.params?.name==="finance_api_contract")return json({jsonrpc:"2.0",id,result:{content:[{type:"text",text:JSON.stringify({service:"finance-hub",gateway:"metadata-only",financialDataAccess:false,writeAccess:false,principalAuthenticated:true})}]}});
 return json({jsonrpc:"2.0",id,error:{code:-32601,message:"Method not found"}},404);
}
