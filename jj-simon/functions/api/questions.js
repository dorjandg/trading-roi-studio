/* Cloudflare Pages Function: persistent questions. Bind JJ_QUESTIONS (D1), JJ_HASH_SECRET, JJ_REVIEW_TOKEN.
   POST is public same-origin and rate-limited; review reads/updates require bearer token.
   Never expose secrets or publicize the question text. */
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const tokenOK=(request,env)=>Boolean(env.JJ_REVIEW_TOKEN&&request.headers.get('authorization')==='Bearer '+env.JJ_REVIEW_TOKEN);
const normalized=q=>q.toLowerCase().replace(/\s+/g,' ').trim();
const hex=array=>Array.from(new Uint8Array(array),b=>b.toString(16).padStart(2,'0')).join('');
async function digest(value){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}
function validOrigin(request){
 const origin=request.headers.get('Origin');
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(request.url).origin}catch(_){return false}
}
export async function onRequestPost({request,env}){
 if(!env.JJ_QUESTIONS||!env.JJ_HASH_SECRET)return json({ok:false,error:'Shared queue not configured'},503);
 if(!validOrigin(request))return json({ok:false,error:'Origin not allowed'},403);
 if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))return json({ok:false,error:'JSON required'},415);
 const length=Number(request.headers.get('content-length')||'0');if(length>4096)return json({ok:false,error:'Too large'},413);
 let data;try{data=await request.json()}catch(_){return json({ok:false,error:'Invalid JSON'},400)}
 const question=String(data.question||'').trim();
 const reason=String(data.reason||'Unanswered source question').slice(0,120);
 const count=Number.isFinite(data.matchCount)?Math.max(0,Math.min(999,Math.round(data.matchCount))):0;
 if(question.length<8||question.length>1000||!/[\p{L}\p{N}]/u.test(question))return json({ok:false,error:'Question must be 8–1000 characters'},400);
 const visitor=(request.headers.get('CF-Connecting-IP')||'anonymous').slice(0,90);
 const visitorHash=await digest(env.JJ_HASH_SECRET+':'+visitor);
 const database=env.JJ_QUESTIONS;
 try{
  const recent=await database.prepare("SELECT count(*) AS n FROM jj_question_submissions WHERE visitor_hash=? AND submitted_at >= datetime('now','-1 hour')").bind(visitorHash).first();
  if((recent?.n||0)>=12)return json({ok:false,error:'Hourly question limit reached'},429);
  const key=normalized(question);const id='uq_'+(await digest(key)).slice(0,22);
  await database.batch([
   database.prepare("INSERT INTO jj_unanswered_questions (id, question, normalized, reason, match_count) VALUES (?, ?, ?, ?, ?) ON CONFLICT(normalized) DO UPDATE SET occurrences=occurrences+1, updated_at=datetime('now'), reason=excluded.reason").bind(id,question,key,reason,count),
   database.prepare("INSERT INTO jj_question_submissions (visitor_hash, question_id) VALUES (?, ?)").bind(visitorHash,id)
  ]);
  return json({ok:true,id,status:'queued'},201);
 }catch(error){return json({ok:false,error:'Question storage unavailable'},503)}
}
export async function onRequestGet({request,env}){
 if(!tokenOK(request,env))return json({ok:false,error:'Unauthorized'},401);
 if(!env.JJ_QUESTIONS)return json({ok:false,error:'Database not bound'},503);
 const url=new URL(request.url);const status=url.searchParams.get('status')||'';
 const allowed=['new','researching','needs_review','approved','resolved','rejected'];
 if(status&&!allowed.includes(status))return json({ok:false,error:'Invalid status'},400);
 const sql=status?"SELECT id,question,reason,match_count,status,research_notes,proposed_commit,occurrences,created_at,updated_at FROM jj_unanswered_questions WHERE status=? ORDER BY updated_at DESC LIMIT 200":"SELECT id,question,reason,match_count,status,research_notes,proposed_commit,occurrences,created_at,updated_at FROM jj_unanswered_questions ORDER BY updated_at DESC LIMIT 200";
 try{
  const stmt=env.JJ_QUESTIONS.prepare(sql);
  const rows=await (status?stmt.bind(status):stmt).all();
  return json({ok:true,questions:rows.results||[]});
 }catch(_){return json({ok:false,error:'Review queue unavailable'},503)}
}
export async function onRequestPatch({request,env}){
 if(!tokenOK(request,env))return json({ok:false,error:'Unauthorized'},401);
 if(!env.JJ_QUESTIONS)return json({ok:false,error:'Database not bound'},503);
 let input;try{input=await request.json()}catch(_){return json({ok:false,error:'Invalid JSON'},400)}
 const id=String(input.id||'');
 const status=String(input.status||'');
 if(!/^uq_[a-f0-9]{22}$/.test(id)||!['new','researching','needs_review','approved','resolved','rejected'].includes(status))return json({ok:false,error:'Invalid ID/status'},400);
 const notes=String(input.research_notes||'').slice(0,10000);
 const commit=String(input.proposed_commit||'').slice(0,200);
 try{
  const result=await env.JJ_QUESTIONS.prepare("UPDATE jj_unanswered_questions SET status=?, research_notes=?, proposed_commit=?, updated_at=datetime('now') WHERE id=?").bind(status,notes,commit,id).run();
  return json({ok:result.meta?.changes>0,id,status},result.meta?.changes>0?200:404);
 }catch(_){return json({ok:false,error:'Unable to update queue'},503)}
}
