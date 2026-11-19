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
  const invitation=await db.prepare("SELECT workspace_id,role FROM invitations WHERE email=? AND accepted_at IS NULL AND expires_at > CURRENT_TIMESTAMP LIMIT 1").bind(user.email).first();
  if(invitation){
   await db.batch([db.prepare("INSERT OR IGNORE INTO users(id,email,display_name) VALUES(?,?,?)").bind(user.id,user.email,user.email),db.prepare("INSERT OR IGNORE INTO memberships(workspace_id,user_id,role) VALUES(?,?,?)").bind(invitation.workspace_id,user.id,invitation.role),db.prepare("UPDATE invitations SET accepted_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND email=? AND accepted_at IS NULL").bind(invitation.workspace_id,user.email)]);
   member={workspace_id:invitation.workspace_id,role:invitation.role};
  }else{
  if(user.email!==String(env.FINANCE_BOOTSTRAP_EMAIL||"").toLowerCase())return json({error:"No workspace membership; request an invitation from the owner"},403);
  const id=crypto.randomUUID();
  await db.batch([
   db.prepare("INSERT OR IGNORE INTO users(id,email,display_name) VALUES(?,?,?)").bind(user.id,user.email,user.email),
   db.prepare("INSERT OR IGNORE INTO workspaces(id,name) VALUES(?,?)").bind(id,"Finance Hub"),
   db.prepare("INSERT OR IGNORE INTO memberships(workspace_id,user_id,role) VALUES(?,?,?)").bind(id,user.id,"owner")
  ]);
  member={workspace_id:id,role:"owner"};
  }
 }
 const ws=member.workspace_id,write=["owner","admin","member"].includes(member.role);
 if(method==="GET"&&url.searchParams.get("resource")==="snapshot-meta"){
  const row=await db.prepare("SELECT revision,updated_at FROM finance_snapshots WHERE workspace_id=? AND user_id=?").bind(ws,user.id).first();
  return json(row?{revision:row.revision,updated_at:row.updated_at}:{revision:0,updated_at:null});
 }
 if(url.searchParams.get("resource")==="snapshot"){
  // Snapshot access is always restricted to the authenticated member's own user ID.
  if(method==="GET"){
   const row=await db.prepare("SELECT revision,payload,updated_at FROM finance_snapshots WHERE workspace_id=? AND user_id=?").bind(ws,user.id).first();
   return json(row?{revision:row.revision,updated_at:row.updated_at,data:JSON.parse(row.payload)}:{revision:0,data:null});
  }
  if(method==="PUT"){
   if(!write)return json({error:"Read-only membership"},403);
   const len=Number(request.headers.get("content-length")||0);
   if(len>1024*1024)return json({error:"Snapshot exceeds 1 MB"},413);
   let raw;try{raw=await request.text()}catch{return json({error:"Invalid body"},400)}
   if(raw.length>1024*1024)return json({error:"Snapshot exceeds 1 MB"},413);
   let body;try{body=JSON.parse(raw)}catch{return json({error:"Invalid JSON"},400)}
   if(!body||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||!body.data||typeof body.data!=="object"||Array.isArray(body.data))return json({error:"Invalid snapshot"},400);
   const required=["transactions","propAccounts","propEvents","propAudit","subscriptions","invoices"];
   if(!required.every(k=>Array.isArray(body.data[k]))||body.data.format!=="finance-hub-backup"||body.data.version!==2)return json({error:"Unsupported snapshot format"},400);
   const payload=JSON.stringify(body.data);
   if(payload.length>1024*1024)return json({error:"Snapshot exceeds 1 MB"},413);
   if(body.expectedRevision===0){
    const inserted=await db.prepare("INSERT OR IGNORE INTO finance_snapshots(workspace_id,user_id,revision,payload) VALUES(?,?,1,?)").bind(ws,user.id,payload).run();
    if(inserted.meta?.changes===1)return json({revision:1});
   }else{
    const updated=await db.prepare("UPDATE finance_snapshots SET payload=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND user_id=? AND revision=?").bind(payload,ws,user.id,body.expectedRevision).run();
    if(updated.meta?.changes===1)return json({revision:body.expectedRevision+1});
   }
   return json({error:"Cloud snapshot changed. Refresh before saving to avoid overwriting another device."},409);
  }
  return json({error:"Method not allowed"},405);
 }
 if(method==="GET"&&url.searchParams.get("resource")==="me")return json({user:{email:user.email,id:user.id},workspace_id:ws,role:member.role});
 if(method==="GET"&&url.searchParams.get("resource")==="connections"){
  const rows=await db.prepare("SELECT a.id,a.account_label,a.account_type,a.currency,a.owner_user_id,p.name AS provider_name FROM financial_accounts a LEFT JOIN providers p ON p.id=a.provider_id WHERE a.workspace_id=? AND (? IN ('owner','admin') OR a.owner_user_id=?) ORDER BY a.created_at DESC LIMIT 500").bind(ws,member.role,user.id).all();
  return json({connections:rows.results});
 }
 if(method==="GET"&&url.searchParams.get("resource")==="transactions"){
  const rows=await db.prepare("SELECT id,occurred_on,category,transaction_type,amount_minor,currency,notes,account_id,user_id FROM transactions WHERE workspace_id=? AND (? IN ('owner','admin') OR user_id=?) ORDER BY occurred_on DESC LIMIT 1000").bind(ws,member.role,user.id).all();
  return json({transactions:rows.results});
 }
 if(method==="POST"&&url.searchParams.get("resource")==="connections"&&write){
  let data;try{data=await request.json()}catch{return json({error:"Invalid JSON"},400)}
  const provider=String(data.provider||"").trim().slice(0,80),label=String(data.label||"").trim().slice(0,120),owner=String(data.owner_user_id||user.id);
  if(!['owner','admin'].includes(member.role)&&owner!==user.id)return json({error:'Cannot create an account for another user'},403);
  if(!provider||!label||!["USD","EUR","AED","GBP"].includes(data.currency))return json({error:"Invalid connection"},400);
  const permitted=await db.prepare("SELECT 1 FROM memberships WHERE workspace_id=? AND user_id=?").bind(ws,owner).first();if(!permitted)return json({error:"Account owner must belong to workspace"},403);
  let p=await db.prepare("SELECT id FROM providers WHERE workspace_id=? AND name=?").bind(ws,provider).first();
  if(!p){const pid=crypto.randomUUID();await db.prepare("INSERT INTO providers(id,workspace_id,name,provider_type) VALUES(?,?,?,?)").bind(pid,ws,provider,"trading").run();p={id:pid}}
  const id=crypto.randomUUID();await db.prepare("INSERT INTO financial_accounts(id,workspace_id,provider_id,owner_user_id,account_label,account_type,currency) VALUES(?,?,?,?,?,?,?)").bind(id,ws,p.id,owner,label,"manual",data.currency).run();
  return json({id,status:"manual_record_only"},201);
 }
 if(method==="POST"&&url.searchParams.get("resource")==="invitations"&&["owner","admin"].includes(member.role)){
  let data;try{data=await request.json()}catch{return json({error:"Invalid JSON"},400)}
  const email=String(data.email||"").trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||data.role!=="member")return json({error:"A valid member email is required"},400);
  const id=crypto.randomUUID();await db.prepare("INSERT INTO invitations(id,workspace_id,email,role,expires_at) VALUES(?,?,?,?,datetime(\'now\',\'+7 days\')) ON CONFLICT(workspace_id,email) DO UPDATE SET role=excluded.role,expires_at=excluded.expires_at,accepted_at=NULL").bind(id,ws,email,"member").run();return json({status:"invitation_registered",email,role:"member"},201);
 }
 if(method==="GET"&&url.searchParams.get("resource")==="members"){
  if(!["owner","admin"].includes(member.role))return json({error:"Forbidden"},403);
  const rows=await db.prepare("SELECT u.id,u.email,u.display_name,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=?").bind(ws).all();
  return json({members:rows.results});
 }
 return json({error:"Unknown route or insufficient permissions"},404);
}
export const onRequest=handler;
