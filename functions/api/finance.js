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
// Short-lived, tamper-evident authorization for exactly one reviewed metadata change.
// This is NOT a substitute for the human clicking Confirm in the UI.
async function correctionTicket(secret,claims){
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=enc.encode(JSON.stringify(claims));
 const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,bytes));
 const url64=arr=>btoa(String.fromCharCode(...arr)).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");
 return url64(bytes)+"."+url64(sig);
}
async function verifyCorrectionTicket(secret,ticket,expected){
 if(typeof ticket!=="string"||ticket.length>4096||!ticket.includes("."))return false;
 const parts=ticket.split(".");if(parts.length!==2)return false;
 try{
  const raw=b64(parts[0]);const claims=JSON.parse(new TextDecoder().decode(raw));
  if(!claims||claims.exp<Date.now()||claims.exp>Date.now()+5*60*1000||
     Object.keys(expected).some(k=>claims[k]!==expected[k]))return false;
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  return await crypto.subtle.verify("HMAC",key,b64(parts[1]),raw);
 }catch{return false}
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
 if(method==="GET"&&url.searchParams.get("resource")==="gmail-summary"){
  // Owner-scoped, read-only summary from primary D1 evidence. Never interpret
  // unreviewed email amounts as actual income, bank balances or cash flow.
  try{
   const totals=await db.prepare("SELECT COUNT(*) AS notifications, SUM(CASE WHEN amount IS NOT NULL AND amount<>'' AND currency IS NOT NULL AND currency<>'' THEN 1 ELSE 0 END) AS amounts_identified, SUM(CASE WHEN status='needs_review' THEN 1 ELSE 0 END) AS needs_review FROM gmail_financial_evidence WHERE user_id=?").bind(user.id).first();
   const currencies=await db.prepare("SELECT currency,COUNT(*) AS records FROM gmail_financial_evidence WHERE user_id=? AND amount IS NOT NULL AND amount<>'' AND currency IS NOT NULL AND currency<>'' GROUP BY currency ORDER BY records DESC LIMIT 20").bind(user.id).all();
   const recent=await db.prepare("SELECT source_id,occurred_on AS date,provider,description,amount,currency,category,status,reference FROM gmail_financial_evidence WHERE user_id=? ORDER BY occurred_on DESC,source_id DESC LIMIT 40").bind(user.id).all();
   const amountSamples=await db.prepare("SELECT source_id,occurred_on AS date,provider,description,amount,currency,category,status,reference FROM gmail_financial_evidence WHERE user_id=? AND amount IS NOT NULL AND amount<>'' AND currency IS NOT NULL AND currency<>'' ORDER BY occurred_on DESC,source_id DESC LIMIT 40").bind(user.id).all();
   return json({notifications:Number(totals?.notifications||0),amountsIdentified:Number(totals?.amounts_identified||0),needsReview:Number(totals?.needs_review||0),currencies:currencies.results||[],recent:recent.results||[],amountSamples:amountSamples.results||[],asOf:new Date().toISOString()});
  }catch(e){
   if(/no such table/i.test(String(e)))return json({notifications:0,amountsIdentified:0,needsReview:0,currencies:[],recent:[],setupRequired:true});
   return json({error:"Financial evidence summary unavailable"},503);
  }
 }
 if(method==="GET"&&url.searchParams.get("resource")==="gmail-evidence"){
  const offsetRaw=url.searchParams.get("offset")||"0";
  if(!/^\d{1,6}$/.test(offsetRaw))return json({error:"Invalid offset"},400);
  const offset=Math.min(Number(offsetRaw),50000);
  try{
    const rows=await db.prepare("SELECT source_id,occurred_on AS date,provider,description,amount,currency,category,status,reference FROM gmail_financial_evidence WHERE user_id=? ORDER BY occurred_on DESC,source_id DESC LIMIT 300 OFFSET ?").bind(user.id,offset).all();
    return json({records:rows.results||[],nextOffset:(rows.results||[]).length===300?offset+300:null,syncConfigured:!!(env.FINANCE_GMAIL_SYNC_SECRET&&env.FINANCE_GMAIL_SYNC_EMAIL)});
  }catch(e){
    if(/no such table/i.test(String(e)))return json({records:[],nextOffset:null,setupRequired:true});
    return json({error:"Gmail financial evidence query unavailable"},503);
  }
 }
 // Import only unambiguous settled expense notifications from the owner's
 // private Gmail evidence into the same cloud snapshot used by the dashboard.
 // No CSV, no third-party credentials, no guessed exchange rates or income.
 if(method==="POST"&&url.searchParams.get("resource")==="gmail-post-confirmed"){
  if(!write||user.email!==String(env.FINANCE_BOOTSTRAP_EMAIL||"").toLowerCase())
   return json({error:"Only the verified mailbox owner can synchronize these payments"},403);
  let requested;try{requested=await request.json()}catch{return json({error:"Invalid JSON"},400)}
  if(!Number.isSafeInteger(requested?.expectedRevision)||requested.expectedRevision<0)
   return json({error:"Expected current snapshot revision"},400);
  const existing=await db.prepare("SELECT revision,payload FROM finance_snapshots WHERE workspace_id=? AND user_id=?").bind(ws,user.id).first();
  const revision=Number(existing?.revision||0);
  if(revision!==requested.expectedRevision)return json({error:"Cloud snapshot changed. Refresh before importing."},409);
  const data=existing?JSON.parse(existing.payload):{format:"finance-hub-backup",version:2,transactions:[],propAccounts:[],propEvents:[],propAudit:[],subscriptions:[],invoices:[]};
  if(data.format!=="finance-hub-backup"||data.version!==2||!Array.isArray(data.transactions))
   return json({error:"Existing finance records need review before importing"},409);
  let evidence;
  try{
   evidence=await db.prepare("SELECT source_id,occurred_on AS date,provider,description,amount,currency,category,status FROM gmail_financial_evidence WHERE user_id=? ORDER BY occurred_on DESC,source_id DESC LIMIT 5000").bind(user.id).all();
  }catch{return json({error:"Gmail evidence database unavailable"},503)}
  const existingSources=new Set(data.transactions.flatMap(t=>[...String(t.notes||"").matchAll(/\[Gmail (gmail:[^\]]+)\]/g)].map(m=>m[1])));
  const validDate=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;const t=Date.parse(d+"T00:00:00Z");return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===d};
  let imported=0,reviewNeeded=0,alreadyRecorded=0;
  for(const row of evidence.results||[]){
   if(!row?.source_id||existingSources.has(row.source_id)){alreadyRecorded++;continue}
   const subject=String(row.description||""),provider=String(row.provider||"").trim(),status=String(row.status||"");
   const amount=String(row.amount||""),currency=String(row.currency||"").toUpperCase(),date=String(row.date||"");
   const settled=status==="payment_confirmed"||status==="activation_fee_processed";
   const explicitReceipt=status==="activation_fee_processed"||/\b(?:receipt for your payment to|payment to .+ is complete|payment (?:successful|completed)|activation fee .+ processed|your e-receipt|your receipt from)\b/i.test(subject);
   const excluded=/\b(?:approved|processing|pending|declined|failed|refund|reversal|authorization|giveaway|bonus|win up to|account closed|cash waiting|weekly payout)\b/i.test(subject);
   if(!settled||!explicitReceipt||excluded||!provider||!validDate(date)||!/^\d+(?:\.\d{1,2})?$/.test(amount)||Number(amount)<=0||!["USD","EUR","AED","GBP"].includes(currency)){reviewNeeded++;continue}
   const category=/topstep|hola.?prime|ftmo|lucid|mffu/i.test(provider+" "+subject)?"Prop firm":
    /cloudflare|hosting|domain/i.test(provider+" "+subject)?"Business":
    /google|openai|heygen|duplikium|tradingview/i.test(provider+" "+subject)?"Trading software":"Other";
   const merchant=provider.slice(0,100);
   // A manual entry with the same source-less identity may already represent this receipt.
   const possibleManualDuplicate=data.transactions.some(t=>!String(t.notes||"").includes("[Gmail ")&&t.date===date&&t.type==="Expense"&&t.currency===currency&&Math.abs(Number(t.amount)-Number(amount))<0.005&&String(t.provider||"").toLowerCase()===merchant.toLowerCase());
   if(possibleManualDuplicate){reviewNeeded++;continue}
   data.transactions.push({id:crypto.randomUUID(),date,user:"Dori",category,provider:merchant,type:"Expense",amount:Number(amount),currency,notes:"[Gmail "+row.source_id+"] Confirmed payment email; date is Gmail receipt date, not verified bank settlement date."});
   existingSources.add(row.source_id);imported++;
   if(imported>=200)break;
  }
  if(!imported)return json({imported:0,reviewNeeded,alreadyRecorded,revision});
  const payload=JSON.stringify(data);
  if(payload.length>1024*1024)return json({error:"Snapshot capacity reached; nothing imported"},413);
  let result;
  if(revision===0)result=await db.prepare("INSERT OR IGNORE INTO finance_snapshots(workspace_id,user_id,revision,payload) VALUES(?,?,1,?)").bind(ws,user.id,payload).run();
  else result=await db.prepare("UPDATE finance_snapshots SET payload=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND user_id=? AND revision=?").bind(payload,ws,user.id,revision).run();
  if(result.meta?.changes!==1)return json({error:"Cloud changed while importing; nothing overwritten"},409);
  return json({imported,reviewNeeded,alreadyRecorded,revision:revision+1});
 }
 if(method==="GET"&&url.searchParams.get("resource")==="connections"){
  const rows=await db.prepare("SELECT a.id,a.account_label,a.account_type,a.currency,a.owner_user_id,p.name AS provider_name FROM financial_accounts a LEFT JOIN providers p ON p.id=a.provider_id WHERE a.workspace_id=? AND a.owner_user_id=? ORDER BY a.created_at DESC LIMIT 500").bind(ws,user.id).all();
  return json({connections:rows.results});
 }
 if(method==="GET"&&url.searchParams.get("resource")==="transactions"){
  const rows=await db.prepare("SELECT id,occurred_on,category,transaction_type,amount_minor,currency,notes,account_id,user_id FROM transactions WHERE workspace_id=? AND user_id=? ORDER BY occurred_on DESC LIMIT 1000").bind(ws,user.id).all();
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
 // Finance Hub-authenticated preview for a single metadata correction.
 // Deliberately read-only: it never accepts an entire replacement snapshot.
 if(method==="POST"&&url.searchParams.get("resource")==="transaction-change-preview"){
  if(!write)return json({error:"Read-only membership"},403);
  let a;try{a=await request.json()}catch{return json({error:"Invalid JSON"},400)}
  const fields=["category","provider","description"];
  if(!a||typeof a.transaction_id!=="string"||!/^[a-f0-9-]{36}$/i.test(a.transaction_id)||
     !Number.isSafeInteger(a.expected_revision)||a.expected_revision<1||
     !fields.includes(a.field)||typeof a.expected_value!=="string"||
     typeof a.new_value!=="string"||!a.new_value.trim()||a.new_value.length>300||
     a.expected_value===a.new_value)return json({error:"Invalid correction request"},400);
  const row=await db.prepare("SELECT revision,payload FROM finance_snapshots WHERE workspace_id=? AND user_id=?").bind(ws,user.id).first();
  if(!row||row.revision!==a.expected_revision)return json({error:"Snapshot revision changed; refresh before continuing"},409);
  let data;try{data=JSON.parse(row.payload)}catch{return json({error:"Snapshot unreadable"},409)}
  if(data?.format!=="finance-hub-backup"||data?.version!==2||!Array.isArray(data.transactions))
   return json({error:"Unsupported snapshot"},409);
  const matches=data.transactions.filter(t=>t.id===a.transaction_id);
  if(matches.length!==1)return json({error:"Transaction must match exactly one record"},409);
  const before=matches[0][a.field]??"";
  if(typeof before!=="string"||before!==a.expected_value)return json({error:"Transaction changed; refresh before continuing"},409);
  if(!env.FINANCE_CORRECTION_SIGNING_KEY||String(env.FINANCE_CORRECTION_SIGNING_KEY).length<32)
   return json({error:"Correction approval signing key not configured"},503);
  const approval_ticket=await correctionTicket(env.FINANCE_CORRECTION_SIGNING_KEY,{ws,user_id:user.id,transaction_id:a.transaction_id,field:a.field,expected_revision:row.revision,expected_value:before,new_value:a.new_value,exp:Date.now()+5*60*1000});
  return json({ok:true,previewOnly:true,saved:false,transaction_id:a.transaction_id,field:a.field,
   before,after:a.new_value,revision:row.revision,approval_ticket,requiresExplicitConfirmation:true});
 }
 // Exact, authenticated Finance Hub correction. Disabled by default.
 // A confirmed UI request is not permission to edit any other transaction.
 if(method==="POST"&&url.searchParams.get("resource")==="transaction-change-save"){
  if(!["owner","admin"].includes(member.role))return json({error:"Owner or admin approval required"},403);
  if(env.FINANCE_TRANSACTION_CORRECTIONS_ENABLED!=="true")
   return json({error:"Transaction corrections are not enabled"},503);
  if(!write)return json({error:"Read-only membership"},403);
  let a;try{a=await request.json()}catch{return json({error:"Invalid JSON"},400)}
  const fields=["category","provider","description"];
  if(!a||a.confirmed!==true||typeof a.transaction_id!=="string"||
     !/^[a-f0-9-]{36}$/i.test(a.transaction_id)||
     !Number.isSafeInteger(a.expected_revision)||a.expected_revision<1||
     !fields.includes(a.field)||typeof a.expected_value!=="string"||
     typeof a.new_value!=="string"||!a.new_value.trim()||a.new_value.length>300||
     a.new_value===a.expected_value)return json({error:"Exact transaction confirmation required"},400);
  if(!env.FINANCE_CORRECTION_SIGNING_KEY||String(env.FINANCE_CORRECTION_SIGNING_KEY).length<32)
   return json({error:"Correction approval signing key not configured"},503);
  if(!await verifyCorrectionTicket(env.FINANCE_CORRECTION_SIGNING_KEY,a.approval_ticket,{ws,user_id:user.id,transaction_id:a.transaction_id,field:a.field,expected_revision:a.expected_revision,expected_value:a.expected_value,new_value:a.new_value}))
   return json({error:"Preview expired or does not match exact correction; preview again"},403);
  const old=await db.prepare("SELECT revision,payload FROM finance_snapshots WHERE workspace_id=? AND user_id=?")
   .bind(ws,user.id).first();
  if(!old||old.revision!==a.expected_revision)return json({error:"Snapshot revision changed"},409);
  let data;try{data=JSON.parse(old.payload)}catch{return json({error:"Snapshot unreadable"},409)}
  const required=["transactions","propAccounts","propEvents","propAudit","subscriptions","invoices"];
  if(data?.format!=="finance-hub-backup"||data?.version!==2||
     !required.every(k=>Array.isArray(data[k])))return json({error:"Unsupported snapshot"},409);
  const matches=data.transactions.filter(t=>t.id===a.transaction_id);
  if(matches.length!==1||typeof (matches[0][a.field]??"")!=="string"||
     (matches[0][a.field]??"")!==a.expected_value)
   return json({error:"Transaction changed; preview again"},409);
  const next=structuredClone(data);
  const tx=next.transactions.find(t=>t.id===a.transaction_id);
  tx[a.field]=a.new_value;
  const nextPayload=JSON.stringify(next);
  if(new TextEncoder().encode(nextPayload).length>1024*1024)
   return json({error:"Snapshot exceeds 1 MB"},413);
  const backupId=crypto.randomUUID(),auditId=crypto.randomUUID(),stamp=new Date().toISOString();
  // The audit insert is deliberately dependent on a successful CAS revision update.
  // Its NOT NULL new_revision constraint forces the entire D1 batch to roll back
  // if the snapshot revision changed between read and write.
  try{
   const statements=[
    db.prepare("INSERT INTO finance_mcp_direct_backups(backup_id,workspace_id,user_id,revision,snapshot_payload,created_at) VALUES(?,?,?,?,?,?)")
      .bind(backupId,ws,user.id,old.revision,old.payload,stamp),
    db.prepare("UPDATE finance_snapshots SET payload=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND user_id=? AND revision=?")
      .bind(nextPayload,ws,user.id,old.revision),
    db.prepare("INSERT INTO finance_mcp_direct_audit(audit_id,backup_id,workspace_id,user_id,transaction_id,field_name,old_value,new_value,old_revision,new_revision,created_at) VALUES(?,?,?,?,?,?,?,?,?,(SELECT CASE WHEN changes()=1 THEN revision ELSE NULL END FROM finance_snapshots WHERE workspace_id=? AND user_id=? AND revision=?),?)")
      .bind(auditId,backupId,ws,user.id,a.transaction_id,a.field,a.expected_value,a.new_value,old.revision,ws,user.id,old.revision+1,stamp)
   ];
   const results=await db.batch(statements);
   if(results[1]?.meta?.changes!==1)return json({error:"Revision conflict; refresh before retrying"},409);
  }catch(e){
   if(/no such table/i.test(String(e)))return json({error:"Controlled-write backup and audit schema not configured"},503);
   return json({error:"Correction not saved; refresh and check current revision"},409);
  }
  return json({saved:true,transaction_id:a.transaction_id,field:a.field,revision:old.revision+1,backup_id:backupId});
 }
 if(method==="GET"&&url.searchParams.get("resource")==="members"){
  if(!["owner","admin"].includes(member.role))return json({error:"Forbidden"},403);
  const rows=await db.prepare("SELECT u.id,u.email,u.display_name,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=?").bind(ws).all();
  return json({members:rows.results});
 }
 return json({error:"Unknown route or insufficient permissions"},404);
}
export const onRequest=handler;
