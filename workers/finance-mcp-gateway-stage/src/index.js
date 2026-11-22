// Read-only MCP staging gateway. Never modifies financial data.
// Cloudflare Access must protect all routes at the edge.
const TEAM = "https://floral-river-0fbd.cloudflareaccess.com";
const AUD = "aa652288029a24ffdf14eea9c732546a70dddd5bffda460e58272e1f6ac33d41";
const ALLOWED = new Set(["dorjan.gjoni.dg@gmail.com","doengjoni@gmail.com","liridonapjetri91@gmail.com"]);
const json = (body,status=200,headers={}) => new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const bytes = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
const part = s => JSON.parse(new TextDecoder().decode(bytes(s)));
const tools = [
 {name:"finance_api_contract",description:"Read gateway integration status; no financial records.",inputSchema:{type:"object",properties:{},additionalProperties:false}},
 {name:"finance_access_check",description:"Check whether the authenticated user has exactly one existing Finance Hub workspace membership; no financial data returned.",inputSchema:{type:"object",properties:{},additionalProperties:false}},
 {name:"finance_snapshot_meta",description:"Read the authenticated user's Finance Hub snapshot revision and record counts, only when read-only data access is configured.",inputSchema:{type:"object",properties:{},additionalProperties:false}},
 {name:"finance_report_summary",description:"Diagnostic read-only transaction breakdown by month, currency, type, category and provider. Raw records only; NOT official dashboard totals or reconciliation.",inputSchema:{type:"object",properties:{from:{type:"string",description:"Inclusive YYYY-MM-DD"},to:{type:"string",description:"Inclusive YYYY-MM-DD"}},additionalProperties:false}},
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
  if(rpc.method==="tools/call"&&rpc.params?.name==="finance_access_check"){
   if(!env.FINANCE_DB)return json({jsonrpc:"2.0",id,result:toolResult({status:"DATABASE_NOT_CONFIGURED"})});
   try{
    const rows=await env.FINANCE_DB.prepare("SELECT m.workspace_id FROM users u JOIN memberships m ON m.user_id=u.id WHERE lower(u.email)=? LIMIT 2").bind(principal.email).all();
    const count=rows.results?.length||0;
    return json({jsonrpc:"2.0",id,result:toolResult({status:count===1?"AUTHORIZED":count===0?"MEMBERSHIP_NOT_FOUND":"AMBIGUOUS_MEMBERSHIP",financialDataAccess:false})});
   }catch{return json({jsonrpc:"2.0",id,result:toolResult({status:"MEMBERSHIP_CHECK_FAILED"})})}
  }
  if(rpc.method==="tools/call"&&["finance_snapshot_meta","finance_transactions_list","finance_report_summary"].includes(rpc.params?.name)){
   let snapshot;try{snapshot=await snapshotFor(principal,env)}catch{return json({jsonrpc:"2.0",id,result:toolResult({error:"Financial data unavailable",code:"READ_FAILED"})})}
   if(snapshot.error)return json({jsonrpc:"2.0",id,result:toolResult(snapshot)});
   if(rpc.params.name==="finance_snapshot_meta"){
    const counts=snapshot.data?Object.fromEntries(["transactions","propAccounts","propEvents","subscriptions","invoices"].map(k=>[k,Array.isArray(snapshot.data[k])?snapshot.data[k].length:0])):{};
    return json({jsonrpc:"2.0",id,result:toolResult({revision:snapshot.revision,updated_at:snapshot.updated_at,counts})});
   }
   if(rpc.params.name==="finance_report_summary"){
    const args=rpc.params.arguments||{},from=args.from,to=args.to,valid=d=>typeof d==="string"&&/^\\d{4}-\\d{2}-\\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+"T00:00:00Z"));
    if((from!==undefined&&!valid(from))||(to!==undefined&&!valid(to))||(from&&to&&from>to))return json({jsonrpc:"2.0",id,result:toolResult({code:"INVALID_DATE_RANGE"})});
    const groups=new Map(),excluded={invalidDate:0,invalidAmount:0,missingCurrency:0},all=snapshot.data?.transactions||[];
    let matched=0;
    for(const t of all){
     if(!valid(t.date)){excluded.invalidDate++;continue}
     if((from&&t.date<from)||(to&&t.date>to))continue;
     const amount=typeof t.amount==="number"?t.amount:typeof t.amount==="string"&&t.amount.trim()!==""?Number(t.amount):NaN;
     if(!Number.isFinite(amount)){excluded.invalidAmount++;continue}
     if(typeof t.currency!=="string"||!t.currency.trim()){excluded.missingCurrency++;continue}
     matched++;
     const key=[t.date.slice(0,7),t.currency.trim().toUpperCase(),String(t.type||"Unspecified"),String(t.category||"Unspecified"),String(t.provider||"Unspecified")];
     const encoded=JSON.stringify(key),current=groups.get(encoded)||{month:key[0],currency:key[1],type:key[2],category:key[3],provider:key[4],count:0,amount:0};
     current.count++;current.amount+=amount;groups.set(encoded,current);
    }
    const breakdown=[...groups.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.currency.localeCompare(b.currency)||a.type.localeCompare(b.type)||a.category.localeCompare(b.category)||a.provider.localeCompare(b.provider));
    return json({jsonrpc:"2.0",id,result:toolResult({revision:snapshot.revision,updated_at:snapshot.updated_at,from:from||null,to:to||null,totalRecords:all.length,matched,excluded,breakdown,notice:"Raw diagnostic totals only. Currency groups must not be combined. Transfer exclusions, reporting holds, credit notes, and dashboard classifications have not been reconciled; do not use as official income, expense, or profit totals."})});
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
