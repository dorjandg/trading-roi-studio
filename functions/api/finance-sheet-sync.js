// Private signed bridge: APPROVED Google Sheet rows -> user's Finance Hub snapshot.
// Requires Cloudflare Access service-token at edge plus same HMAC used for Gmail ingest.
// No Gmail candidate, pending payout or non-approved row may enter cashflow.
const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const enc=new TextEncoder();
async function signed_(message,signature,secret){
 if(!/^[0-9a-f]{64}$/i.test(signature||""))return false;
 const signatureBytes=Uint8Array.from(signature.match(/../g),v=>parseInt(v,16));
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 return crypto.subtle.verify("HMAC",key,signatureBytes,enc.encode(message));
}
function sourceDate_(v){
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(v))return false;
 const d=Date.parse(v+"T00:00:00Z");
 return Number.isFinite(d)&&new Date(d).toISOString().slice(0,10)===v;
}
const categories=new Set(["Prop firm","Broker","Trading software","Education","Investment","Personal","Business","Housing","Food","Transport","Subscriptions","Healthcare","Other"]);
const settledExpense=/^(?:payment_confirmed|activation_fee_processed|receipt|confirmed payment|activation fee processed|paid receipt|charged receipt|payment received by merchant|crypto payment completed)$/i;
const settledIncome=/^(?:deposit_confirmed|payout_received|payout_paid|income received|funds credited)$/i;
export async function onRequestPost({request,env}){
 if(!env.FINANCE_DB||!env.FINANCE_GMAIL_SYNC_SECRET||!env.FINANCE_GMAIL_SYNC_EMAIL)return reply({error:"Finance bridge not configured"},503);
 const stamp=request.headers.get("x-finance-timestamp")||"";
 if(!/^\d{13}$/.test(stamp)||Math.abs(Date.now()-Number(stamp))>300000)return reply({error:"Invalid timestamp"},401);
 const body=await request.text();
 if(body.length>95000)return reply({error:"Batch too large"},413);
 if(!await signed_(stamp+"\n"+body,request.headers.get("x-finance-signature")||"",env.FINANCE_GMAIL_SYNC_SECRET))return reply({error:"Unauthorized"},401);
 let parsed;try{parsed=JSON.parse(body)}catch{return reply({error:"Invalid JSON"},400)}
 if(!Array.isArray(parsed?.records)||parsed.records.length>60)return reply({error:"Maximum 60 approved rows per batch"},400);
 const ownerEmail=String(env.FINANCE_GMAIL_SYNC_EMAIL).toLowerCase().trim();
 const person=await env.FINANCE_DB.prepare("SELECT u.id,m.workspace_id,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE lower(u.email)=? LIMIT 1").bind(ownerEmail).first();
 if(!person||!["owner","admin","member"].includes(person.role))return reply({error:"Mailbox owner has no writable Finance Hub workspace"},403);
 const db=env.FINANCE_DB;
 const current=await db.prepare("SELECT revision,payload FROM finance_snapshots WHERE workspace_id=? AND user_id=?").bind(person.workspace_id,person.id).first();
 const revision=Number(current?.revision||0);
 let snapshot;
 try{snapshot=current?JSON.parse(current.payload):{format:"finance-hub-backup",version:2,transactions:[],propAccounts:[],propEvents:[],propAudit:[],subscriptions:[],invoices:[]}}catch{return reply({error:"Existing snapshot unreadable"},409)}
 if(snapshot.format!=="finance-hub-backup"||snapshot.version!==2||!Array.isArray(snapshot.transactions))return reply({error:"Unsupported snapshot"},409);
 const existing=new Set(snapshot.transactions.flatMap(t=>[...String(t.notes||"").matchAll(/\[Gmail (gmail:[^\]]+)\]/g)].map(x=>x[1])));
 let imported=0,duplicates=0,held=0;
 for(const raw of parsed.records){
  if(!raw||typeof raw!=="object"){held++;continue}
  const source=String(raw.source_id||"").toLowerCase().trim();
  const date=String(raw.date||"").trim();
  const provider=String(raw.provider||"").trim(),description=String(raw.description||"");
  const direction=String(raw.direction||"").trim();
  const paymentStatus=String(raw.payment_status||"").trim(),currency=String(raw.currency||"").toUpperCase();
  const amount=Number(raw.amount);
  if(!["FTMO","Topstep"].includes(provider)){held++;continue}
  if(String(raw.review_state)!=="Approved"||!/^gmail:[a-z0-9]{10,32}$/.test(source)||!sourceDate_(date)||
     !provider||provider.length>120||description.length>250||!["Expense","Income"].includes(direction)||
     !["USD","EUR","AED","GBP"].includes(currency)||!Number.isFinite(amount)||amount<=0||amount>100000000||
     Math.round(amount*100)!==amount*100&&Math.abs(Math.round(amount*100)-amount*100)>1e-6||
     /\b(?:approved|pending|processing|declined|failed|authorization|giveaway|promotion)\b/i.test(paymentStatus)||
     !(direction==="Expense"?settledExpense.test(paymentStatus):settledIncome.test(paymentStatus))){held++;continue}
  if(existing.has(source)){duplicates++;continue}
  const category=categories.has(raw.category)?raw.category:"Other";
  // A matching manually entered transaction should be reconciled, not doubled.
  if(snapshot.transactions.some(t=>!String(t.notes||"").includes("[Gmail ")&&String(t.date)===date&&
    String(t.provider||"").toLowerCase()===provider.toLowerCase()&&String(t.currency)===currency&&
    String(t.type)===direction&&Math.abs(Number(t.amount)-amount)<0.005)){held++;continue}
  const notes="[Gmail "+source+"] Google Sheet reviewed: "+description.slice(0,100)+"; "+String(raw.notes||"").slice(0,120);
  snapshot.transactions.push({id:crypto.randomUUID(),date,user:"Dori",provider,category,type:direction,amount,currency,notes});
  existing.add(source);imported++;
 }
 if(!imported)return reply({imported,duplicates,held,revision});
 const payload=JSON.stringify(snapshot);
 if(payload.length>1024*1024)return reply({error:"Snapshot capacity reached; no changes made"},413);
 const result=revision===0?
  await db.prepare("INSERT OR IGNORE INTO finance_snapshots(workspace_id,user_id,revision,payload) VALUES(?,?,1,?)").bind(person.workspace_id,person.id,payload).run():
  await db.prepare("UPDATE finance_snapshots SET payload=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND user_id=? AND revision=?").bind(payload,person.workspace_id,person.id,revision).run();
 if(Number(result.meta?.changes||0)!==1)return reply({error:"Finance Hub snapshot changed; retry on next scheduled run"},409);
 return reply({imported,duplicates,held,revision:revision+1});
}
