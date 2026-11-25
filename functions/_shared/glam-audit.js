// GLAM catalog activity: authenticated account identity only, no image bytes, names or credentials.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const OWNER='dorjan.gjoni.dg@gmail.com';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ACTIONS=new Set(['upload','product','publication','delete','directory','catalog']);
const CLIENT_PHASES=new Set(['client_started','client_failed','client_completed']);
const CLIENT_REASONS=new Set(['missing_fields','unsupported_format','too_large','empty_file','compression_failed','network_or_session','upload_rejected','save_failed','selection_changed','busy','validation','http_error']);
const text=(v,max)=>typeof v==='string'?v.slice(0,max):null;
const entity=v=>typeof v==='string'&&/^[-a-zA-Z0-9_/]{1,200}$/.test(v)?v:null;
const bytes=v=>Number.isSafeInteger(v)&&v>=0?v:null;
const mime=v=>typeof v==='string'&&/^[a-zA-Z0-9.+/-]{1,80}$/.test(v)?v:null;
const number=v=>v!==null&&v!==''&&Number.isSafeInteger(Number(v))?Number(v):null;
const op=v=>typeof v==='string'&&UUID.test(v)?v:crypto.randomUUID();
async function write(env,row){
 try{
  if(!env.GLAM_DB)throw Error('missing D1');
  await env.GLAM_DB.prepare('INSERT OR IGNORE INTO glam_staff_activity(event_id,operation_id,at,actor,action,phase,entity_id,http_status,file_bytes,mime,reason,client_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(row.event_id||crypto.randomUUID(),row.operation_id,new Date().toISOString(),row.actor,row.action,row.phase,entity(row.entity_id),row.http_status??null,bytes(row.file_bytes),mime(row.mime),text(row.reason,180),row.client_at||null).run();
  return true;
 }catch{console.error('GLAM_ACTIVITY_WRITE_FAILED',row.action,row.phase,row.operation_id);return false}
}
export async function auditStaff(context,actor,action,handler){
 const {request,env}=context;
 if(!ACTIONS.has(action))return handler();
 const row={operation_id:op(request.headers.get('x-glam-operation')),actor,action,entity_id:request.headers.get('x-glam-entity'),file_bytes:action==='upload'?number(request.headers.get('content-length')):null,mime:action==='upload'?request.headers.get('content-type')?.split(';')[0]:null};
 await write(env,{...row,phase:'server_started'});
 let response;
 try{response=await handler()}catch{response=json({error:'Staff operation unavailable'},503)}
 let detail={};try{if((!response.ok||action==='upload')&&response.headers.get('content-type')?.includes('application/json'))detail=await response.clone().json()}catch{}
 await write(env,{...row,entity_id:entity(row.entity_id)||entity(detail.id),file_bytes:action==='upload'?bytes(detail.bytes)??row.file_bytes:null,phase:response.ok?'server_succeeded':'server_failed',http_status:response.status,reason:response.ok?null:text(detail.error,180)||'HTTP '+response.status});
 return response;
}
export async function activity(context,actor){
 const {request,env}=context,url=new URL(request.url);
 if(request.method==='GET'&&url.searchParams.get('view')==='identity')return json({actor,canView:actor===OWNER});
 if(request.method==='GET'){
  if(actor!==OWNER)return json({error:'Management access required'},403);
  try{
   const days=Math.min(90,Math.max(1,Number(url.searchParams.get('days'))||7));
   const offset=Math.min(100000,Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0)));
   const since=new Date(Date.now()-days*86400000).toISOString();
   const rows=(await env.GLAM_DB.prepare('SELECT * FROM glam_staff_activity WHERE at>=? ORDER BY at DESC,event_id DESC LIMIT 100 OFFSET ?').bind(since,offset).all()).results;
   const summary=(await env.GLAM_DB.prepare('SELECT action,phase,COUNT(DISTINCT operation_id) AS count FROM glam_staff_activity WHERE at>=? GROUP BY action,phase ORDER BY action,phase').bind(since).all()).results;
   const upload=(await env.GLAM_DB.prepare("SELECT COUNT(*) AS attempts,SUM(CASE WHEN saved=1 THEN 1 ELSE 0 END) AS completed,SUM(CASE WHEN failed=1 AND saved=0 THEN 1 ELSE 0 END) AS failed,SUM(CASE WHEN failed=0 AND saved=0 THEN 1 ELSE 0 END) AS unresolved FROM (SELECT operation_id,MAX(phase IN ('client_completed')) AS saved,MAX(phase IN ('client_failed','server_failed')) AS failed FROM glam_staff_activity WHERE at>=? AND action='upload' GROUP BY operation_id)").bind(since).first());
   return json({rows,summary,upload,offset,days});
  }catch{return json({error:'Activity history unavailable'},503)}
 }
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(Number(request.headers.get('content-length')||0)>16000)return json({error:'Event batch too large'},413);
 let events;try{const raw=await request.text();if(raw.length>16000)return json({error:'Event batch too large'},413);events=JSON.parse(raw).events}catch{return json({error:'Invalid activity events'},400)}
 if(!Array.isArray(events)||events.length<1||events.length>30)return json({error:'Invalid activity batch'},400);
 if(events.some(e=>!e||!UUID.test(e.event_id||'')||!UUID.test(e.operation_id||'')||!ACTIONS.has(e.action)||!CLIENT_PHASES.has(e.phase)||e.reason&&!CLIENT_REASONS.has(e.reason)))return json({error:'Invalid activity event'},400);
 const results=await Promise.all(events.map(e=>write(env,{event_id:e.event_id,operation_id:e.operation_id,actor,action:e.action,phase:e.phase,entity_id:e.entity_id,file_bytes:bytes(e.file_bytes),mime:mime(e.mime),reason:e.reason,client_at:typeof e.client_at==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(e.client_at)?e.client_at:null})));
 return results.every(Boolean)?json({ok:true}):json({error:'Could not store activity'},503);
}
