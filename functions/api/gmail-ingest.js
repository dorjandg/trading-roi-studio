// Finance Hub Gmail intake. This endpoint requires Cloudflare Access service-token
// authorization at the edge AND a body HMAC signed using FINANCE_GMAIL_SYNC_SECRET.
// It never accepts an owner identity from the request, and never changes accounting records.
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const te=new TextEncoder();
function decodeHex(hex){if(!/^[a-f0-9]{64}$/i.test(hex))return null;return Uint8Array.from(hex.match(/../g),x=>parseInt(x,16))}
async function verifyHmac(message,signature,secret){
 const provided=decodeHex(signature);if(!provided)return false;
 const key=await crypto.subtle.importKey("raw",te.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 return crypto.subtle.verify("HMAC",key,provided,te.encode(message));
}
const categories=new Set(["Prop firms","Broker investments","Banking","Crypto & transfers","Housing & utilities","Food & delivery","Travel","Business","Software","Health & family","Other","Unclassified"]);
const statuses=new Set(["payment_confirmed","receipt","deposit_confirmed","transfer_confirmed","withdrawal_confirmed","refund_issued","payout_approved","payout_processing","order_confirmed","authorization_only","needs_review"]);
export async function onRequestPost({request,env}){
 if(!env.FINANCE_DB||!env.FINANCE_GMAIL_SYNC_SECRET||!env.FINANCE_GMAIL_SYNC_EMAIL)return reply({error:"Gmail sync is not configured"},503);
 const len=Number(request.headers.get("content-length")||0);if(len>95000)return reply({error:"Batch too large"},413);
 const stamp=request.headers.get("x-finance-timestamp")||"";
 if(!/^\d{10,13}$/.test(stamp)||Math.abs(Date.now()-Number(stamp))>300000)return reply({error:"Invalid timestamp"},401);
 let body;try{body=await request.text()}catch{return reply({error:"Bad request"},400)}
 if(body.length>95000)return reply({error:"Batch too large"},413);
 const signature=request.headers.get("x-finance-signature")||"";
 if(!await verifyHmac(stamp+"\n"+body,signature,env.FINANCE_GMAIL_SYNC_SECRET))return reply({error:"Unauthorized"},401);
 let data;try{data=JSON.parse(body)}catch{return reply({error:"Invalid JSON"},400)}
 if(!Array.isArray(data?.records)||data.records.length>60)return reply({error:"Maximum 60 records per batch"},400);
 const email=String(env.FINANCE_GMAIL_SYNC_EMAIL).toLowerCase().trim();
 const person=await env.FINANCE_DB.prepare("SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id WHERE lower(u.email)=? LIMIT 1").bind(email).first();
 if(!person)return reply({error:"Configured Finance Hub user must first sign in"},403);
 const pending=[];for(const rec of data.records){
  if(!rec||typeof rec!=="object"||Array.isArray(rec))return reply({error:"Invalid record"},400);
  const source=String(rec.source_id||""),date=String(rec.date||""),provider=String(rec.provider||"").trim(),description=String(rec.description||"").trim(),amount=String(rec.amount??""),currency=String(rec.currency||"").toUpperCase(),reference=String(rec.reference||"").trim();
  const category=categories.has(rec.category)?rec.category:"Unclassified",status=statuses.has(rec.status)?rec.status:"needs_review";
  if(!/^[a-zA-Z0-9._:-]{3,120}$/.test(source)||!/^(?:20|19)\d{2}-\d{2}-\d{2}$/.test(date)||!provider||provider.length>120||description.length>250||reference.length>130||amount.length>35||currency.length>10||!(/^-?\d+(\.\d{1,8})?$/.test(amount)||amount==="")||!(/^[A-Z0-9]{0,10}$/.test(currency)))return reply({error:"Invalid record fields"},400);
  pending.push({source,date,provider,description,amount,currency,category,status,reference});
 }
 let inserted=0;
 for(const r of pending){
  const result=await env.FINANCE_DB.prepare("INSERT OR IGNORE INTO gmail_financial_evidence(user_id,source_id,occurred_on,provider,description,amount,currency,category,status,reference) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(person.id,r.source,r.date,r.provider,r.description,r.amount,r.currency,r.category,r.status,r.reference).run();
  inserted+=result.meta?.changes||0;
 }
 return reply({accepted:pending.length,inserted,duplicates:pending.length-inserted});
}
