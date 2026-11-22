// Metadata-only MCP staging gateway. Never reads or modifies financial data.
// Cloudflare Access must protect all routes at the edge.
const TEAM = "https://floral-river-0fbd.cloudflareaccess.com";
const AUD = "aa652288029a24ffdf14eea9c732546a70dddd5bffda460e58272e1f6ac33d41";
const ALLOWED = new Set(["dorjan.gjoni.dg@gmail.com","doengjoni@gmail.com","liridonapjetri91@gmail.com"]);
const json = (body,status=200,headers={}) => new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const bytes = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
const part = s => JSON.parse(new TextDecoder().decode(bytes(s)));
const tools = [{name:"finance_api_contract",description:"Read the gateway integration contract and status; no financial records.",inputSchema:{type:"object",properties:{},additionalProperties:false}}];
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
  return {subject:claims.sub};
}
export default {
 async fetch(request,env) {
  if(env.AI_GATEWAY_ENABLED!=="true")return json({error:"Gateway disabled"},503);
  const path=new URL(request.url).pathname;
  if(path!=="/api/ai-control")return json({error:"Not found"},404);
  try{await accessPrincipal(request)}catch{return json({error:"Unauthorized"},401)}
  if(request.method!=="POST")return json({error:"Method not allowed"},405,{allow:"POST"});
  let rpc;try{rpc=await request.json()}catch{return json({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Parse error"}},400)}
  if(!rpc||rpc.jsonrpc!=="2.0"||typeof rpc.method!=="string")return json({jsonrpc:"2.0",id:rpc?.id??null,error:{code:-32600,message:"Invalid Request"}},400);
  const id=rpc.id??null;
  if(rpc.method==="notifications/initialized")return new Response(null,{status:202});
  if(rpc.method==="initialize")return json({jsonrpc:"2.0",id,result:{protocolVersion:"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"finance-mcp-stage",version:"0.1.0"}}});
  if(rpc.method==="ping")return json({jsonrpc:"2.0",id,result:{}});
  if(rpc.method==="tools/list")return json({jsonrpc:"2.0",id,result:{tools}});
  if(rpc.method==="tools/call"&&rpc.params?.name==="finance_api_contract")return json({jsonrpc:"2.0",id,result:{content:[{type:"text",text:JSON.stringify({service:"finance-hub",gateway:"metadata-only",financialDataAccess:false,writeAccess:false,principalAuthenticated:true})}]}});
  return json({jsonrpc:"2.0",id,error:{code:-32601,message:"Method not found"}},404);
 }
};
