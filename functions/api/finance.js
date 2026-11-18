// Cloudflare Pages Function: authenticated, workspace-scoped Finance Hub API.
// Requires D1 binding FINANCE_DB, CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD,
// FINANCE_BOOTSTRAP_EMAIL. No endpoint is public until configured.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const enc=new TextEncoder();
const b64=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
async function identity(req,env){
 const token=req.headers.get("cf-access-jwt-assertion");
 if(!token||!env.CF_ACCESS_TEAM_DOMAIN||!env.CF_ACCESS_AUD)throw Error("Authentication unavailable");
 const [head,body,sig]=token.split(".");if(!sig)throw Error("Invalid token");
 const header=JSON.parse(new TextDecoder().decode(b64(head))),claims=JSON.parse(new TextDecoder().decode(b64(body)));
 const domain=env.CF_ACCESS_TEAM_DOMAIN.replace(/\/$/,"");
 if(!domain.startsWith("https://")||claims.iss!==domain||!(Array.isArray(claims.aud)&&claims.aud.includes(env.CF_ACCESS_AUD))||!claims.exp||claims.exp*1000<Date.now()||claims.nbf&&claims.nbf*1000>Date.now()||header.alg!=="RS256")throw Error("Invalid claims");
 const jwks=await fetch(domain+"/cdn-cgi/access/certs");if(!jwks.ok)throw Error("Identity keys unavailable");
 const keys=(await jwks.json()).keys||[];const jwk=keys.find(k=>k.kid===header.kid&&k.kty==="RSA");if(!jwk)throw Error("Signing key not found");
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64(sig),enc.encode(head+"."+body)))throw Error("Invalid signature");
 if(!claims.email||!claims.sub)throw Error("Identity incomplete");
 return {id:claims.sub,email:claims.email.toLowerCase()};
}
async function handler(ctx){
 const {request,env}=ctx;if(!env.FINANCE_DB)return json({error:"Database not configured"},503);
 let user;try{user=await identity(request,env)}catch{return json({error:"Authentication required"},401)}
 const db=env.FINANCE_DB;const url=new URL(request.url);const method=request.method;
 let member=await db.prepare("SELECT m.workspace_id,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE u.id=? LIMIT 1").bind(user.id).first();
 if(!member){
  if(user.email!==String(env.FINANCE_BOOTSTRAP_EMAIL||"").toLowerCase())return json({error:"No workspace membership; request an invitation from the owner"},403);
  const id=crypto.randomUUID();
  await db.batch([
   db.prepare("INSERT OR IGNORE INTO users(id,email,display_name) VALUES(?,?,?)").bind(user.id,user.email,user.email),
   db.prepare("INSERT OR IGNORE INTO workspaces(id,name) VALUES(?,?)").bind(id,"Finance Hub"),
   db.prepare("INSERT OR IGNORE INTO memberships(workspace_id,user_id,role) VALUES(?,?,?)").bind(id,user.id,"owner")
  ]);
  member={workspace_id:id,role:"owner"};
 }
 const ws=member.workspace_id,write=["owner","admin","member"].includes(member.role);
 if(method==="GET"&&url.searchParams.get("resource")==="me")return json({user:{email:user.email,id:user.id},workspace_id:ws,role:member.role});
 if(method==="GET"&&url.searchParams.get("resource")==="connections"){
  const rows=await db.prepare("SELECT a.id,a.account_label,a.account_type,a.currency,a.owner_user_id,p.name AS provider_name FROM financial_accounts a LEFT JOIN providers p ON p.id=a.provider_id WHERE a.workspace_id=? ORDER BY a.created_at DESC LIMIT 500").bind(ws).all();
  return json({connections:rows.results});
 }
 if(method==="GET"&&url.searchParams.get("resource")==="transactions"){
  const rows=await db.prepare("SELECT id,occurred_on,category,transaction_type,amount_minor,currency,notes,account_id,user_id FROM transactions WHERE workspace_id=? ORDER BY occurred_on DESC LIMIT 1000").bind(ws).all();
  return json({transactions:rows.results});
 }
 if(method==="POST"&&url.searchParams.get("resource")==="connections"&&write){
  let data;try{data=await request.json()}catch{return json({error:"Invalid JSON"},400)}
  const provider=String(data.provider||"").trim().slice(0,80),label=String(data.label||"").trim().slice(0,120),owner=String(data.owner_user_id||user.id);
  if(!provider||!label||!["USD","EUR","AED","GBP"].includes(data.currency))return json({error:"Invalid connection"},400);
  const permitted=await db.prepare("SELECT 1 FROM memberships WHERE workspace_id=? AND user_id=?").bind(ws,owner).first();if(!permitted)return json({error:"Account owner must belong to workspace"},403);
  let p=await db.prepare("SELECT id FROM providers WHERE workspace_id=? AND name=?").bind(ws,provider).first();
  if(!p){const pid=crypto.randomUUID();await db.prepare("INSERT INTO providers(id,workspace_id,name,provider_type) VALUES(?,?,?,?)").bind(pid,ws,provider,"trading").run();p={id:pid}}
  const id=crypto.randomUUID();await db.prepare("INSERT INTO financial_accounts(id,workspace_id,provider_id,owner_user_id,account_label,account_type,currency) VALUES(?,?,?,?,?,?,?)").bind(id,ws,p.id,owner,label,"manual",data.currency).run();
  return json({id,status:"manual_record_only"},201);
 }
 if(method==="GET"&&url.searchParams.get("resource")==="members"){
  const rows=await db.prepare("SELECT u.id,u.email,u.display_name,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=?").bind(ws).all();
  return json({members:rows.results});
 }
 return json({error:"Unknown route or insufficient permissions"},404);
}
export const onRequest=handler;
