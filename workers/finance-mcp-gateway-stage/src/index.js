// Metadata-only MCP staging gateway. Never reads or modifies financial data.
// Cloudflare Access must protect all routes at the edge.
const TEAM = "https://floral-river-0fbd.cloudflareaccess.com";
const AUD = "aa652288029a24ffdf14eea9c732546a70dddd5bffda460e58272e1f6ac33d41";
const ALLOWED = new Set(["dorjan.gjoni.dg@gmail.com","doengjoni@gmail.com","liridonapjetri91@gmail.com"]);
const json = (body,status=200,headers={}) => new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const bytes = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
const part = s => JSON.parse(new TextDecoder().decode(bytes(s)));
const tools = [
 {name:"finance_api_contract",description:"Read gateway integration status; no financial records.",inputSchema:{type:"object",properties:{},additionalProperties:false}},
 {name:"finance_snapshot_meta",description:"Read the authenticated user's Finance Hub snapshot revision and record counts, only when read-only data access is configured.",inputSchema:{type:"object",properties:{},additionalProperties:false}},
 {name:"finance_transactions_list",description:"Read a limited page of the authenticated user's snapshot transactions; no writes or cross-user access.",inputSchema:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:50},offset:{type:"integer",minimum:0,maximum:100000}},additionalProperties:false}}
];
const toolResult = value => ({content:[{type:"text",text:JSON.stringify(value)}]});
async function snapshotFor(principal,env) {
 if(env.FINANCE_MCP_READ_ENABLED!=="true"||!env.FINANCE_DB) return {error:"Financial read access is not configured",code:"READ_NOT_CONFIGURED"};
 // Cloudflare Access supplies a verified email. Resolve the existing Finance Hub identity
 // by unique email, then require an existing membership; never create a user or membership.
 const rows=await env.FINANCE_DB.prepare("SELECT u.id AS user_id,m.workspace_id FROM users u JOIN memberships m ON m.user_id=u.id WHERE lower(u.email)=? LIMIT 2").bind(principal.email).all();
 if(rows.results?.length!==1)return {error:"Unique existing workspace membership required",code:"MEMBERSHIP_REQUIRED"};
 const {user_id,workspace_id}=rows.results[0];
 const row=await env.FINANCE_DB.prepare("SELECT revision,updated_at,payload FROM finance_snapshots WHERE workspace_id=? AND user_id=?").bind(workspace_id,user_id).first();
 if(!row)return {revision:0,updated_at:null,data:null};
 let data;try{data=JSON.parse(row.payload)}catch{return {error:"Snapshot unreadable",code:"SNAPSHOT_INVALID"}}
 if(data?.format!=="finance-hub-backup"||data?.version!==2||!Array.isArray(data.transactions))return {error:"Unsupported snapshot format",code:"SNAPSHOT_INVALID"};
 return {revision:row.revision,updated_at:row.updated_at,data};
}
async function accessPrincipal(request) {
  const token=request.headers.get("cf-access-jwt-assertion")||"";
  const segments=token.split(".");
  if(segments.length!==3)throw Error("Missing Access assertion");
  const [header,claims]=segments.slice(0,2).map(part);
  const aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(header.alg!=="RS256"||!header.kid||claims.iss!==TEAM||!aud.includes(AUD)||!claims.sub||!claims.email||!ALLOWED.has(String(claims.email).toLowerCase())||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||(claims.nbf&&claims.nbf*1000>Date.now()))throw Error("Invalid identity");
  const keysResponse=await fetch(TEAM+"/cdn-cgi/access/certs");
  if(!keysResponse.ok)throw Error("Keys unavailable");
  const jwk=((await keysResponse.json()).keys||[]).find(k=>k.kid===header.kid&&k.kty==="RSA");
  if(!jwk)throw Error("Key not found");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,bytes(segments[2]),new TextEncoder().encode(segments[0]+"."+segments[1])))throw Error("Bad signature");
  return {subject:claims.sub,email:String(claims.email).toLowerCase()};
}
export default {
 async fetch(request,env) {
  if(env.AI_GATEWAY_ENABLED!=="true")return json({error:"Gateway disabled"},503);
  const path=new URL(request.url).pathname;
  if(path!=="/api/ai-control")return json({error:"Not found"},404);
  let principal;try{principal=await accessPrincipal(request)}catch{const resourceMetadata=new URL("/.well-known/oauth-protected-resource/api/ai-control",request.url).href;return json({error:"Unauthorized"},401,{"www-authenticate":`Bearer resource_metadata="${resourceMetadata}"`})}
  if(request.method!=="POST")return json({error:"Method not allowed"},405,{allow:"POST"});
  let rpc;try{rpc=await request.json()}catch{return json({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Parse error"}},400)}
  if(!rpc||rpc.jsonrpc!=="2.0"||typeof rpc.method!=="string")return json({jsonrpc:"2.0",id:rpc?.id??null,error:{code:-32600,message:"Invalid Request"}},400);
  const id=rpc.id??null;
  if(rpc.method==="notifications/initialized")return new Response(null,{status:202});
  if(rpc.method==="initialize")return json({jsonrpc:"2.0",id,result:{protocolVersion:"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"finance-mcp-stage",version:"0.1.0"}}});
  if(rpc.method==="ping")return json({jsonrpc:"2.0",id,result:{}});
  if(rpc.method==="tools/list")return json({jsonrpc:"2.0",id,result:{tools}});
  if(rpc.method==="tools/call"&&rpc.params?.name==="finance_api_contract")return json({jsonrpc:"2.0",id,result:toolResult({service:"finance-hub",gateway:"staging",financialDataAccess:env.FINANCE_MCP_READ_ENABLED==="true"&&!!env.FINANCE_DB,writeAccess:false,principalAuthenticated:true})});
  if(rpc.method==="tools/call"&&["finance_snapshot_meta","finance_transactions_list"].includes(rpc.params?.name)){
   let snapshot;try{snapshot=await snapshotFor(principal,env)}catch{return json({jsonrpc:"2.0",id,result:toolResult({error:"Financial data unavailable",code:"READ_FAILED"})})}
   if(snapshot.error)return json({jsonrpc:"2.0",id,result:toolResult(snapshot)});
   if(rpc.params.name==="finance_snapshot_meta"){
    const counts=snapshot.data?Object.fromEntries(["transactions","propAccounts","propEvents","subscriptions","invoices"].map(k=>[k,Array.isArray(snapshot.data[k])?snapshot.data[k].length:0])):{};
    return json({jsonrpc:"2.0",id,result:toolResult({revision:snapshot.revision,updated_at:snapshot.updated_at,counts})});
   }
   const args=rpc.params.arguments||{},limit=args.limit===undefined?20:args.limit,offset=args.offset===undefined?0:args.offset;
   if(!Number.isInteger(limit)||limit<1||limit>50||!Number.isInteger(offset)||offset<0||offset>100000)return json({jsonrpc:"2.0",id,result:toolResult({error:"Invalid pagination",code:"INVALID_ARGUMENTS"})});
   const all=snapshot.data?.transactions||[];
   const rows=all.slice(offset,offset+limit).map(t=>({id:t.id,date:t.date,user:t.user,category:t.category,provider:t.provider,type:t.type,amount:t.amount,currency:t.currency}));
   return json({jsonrpc:"2.0",id,result:toolResult({revision:snapshot.revision,total:all.length,offset,limit,transactions:rows})});
  }
  return json({jsonrpc:"2.0",id,error:{code:-32601,message:"Method not found"}},404);
 }
};
