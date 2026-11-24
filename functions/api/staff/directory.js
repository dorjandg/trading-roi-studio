const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const roots=['glam','lingerie','bodywear','home','scents','accessories','solutions'];
const builtIn=id=>roots.includes(id.split('/')[0]);
export async function onRequest({request,env}){
 if(!request.headers.get('Cf-Access-Jwt-Assertion'))return json({error:'Staff login required'},401);
 if(!env.GLAM_DB)return json({error:'Database unavailable'},503);
 const db=env.GLAM_DB;
 try{
 await db.prepare('CREATE TABLE IF NOT EXISTS glam_directory (kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(kind,id))').run();
 if(request.method==='GET'){
 const rows=(await db.prepare('SELECT kind,data FROM glam_directory ORDER BY id').all()).results;
 return json({categories:rows.filter(r=>r.kind==='categories').map(r=>JSON.parse(r.data)),brands:rows.filter(r=>r.kind==='brands').map(r=>JSON.parse(r.data))});
 }
 if(!['PUT','DELETE'].includes(request.method))return json({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin'},403);
 const body=await request.json(),kind=body.kind,p=body.record;
 if(!['categories','brands'].includes(kind)||!p||typeof p.id!=='string'||!/^[-a-zA-Z0-9_/]{1,200}$/.test(p.id))return json({error:'Invalid record'},400);
 if(request.method==='DELETE'){
 if(kind==='categories'&&builtIn(p.id))return json({error:'Default collections cannot be deleted'},409);
 const old=await db.prepare('SELECT data FROM glam_directory WHERE kind=? AND id=?').bind(kind,p.id).first();
 if(!old)return json({error:'Record not found online'},404);
 const existing=JSON.parse(old.data);
 if(kind==='categories'){
 const child=await db.prepare("SELECT id FROM glam_directory WHERE kind='categories' AND json_extract(data,'$.parent')=? LIMIT 1").bind(p.id).first();
 if(child)return json({error:'Move subcollections before deleting'},409);
 await db.batch([db.prepare("UPDATE glam_catalog SET data=json_set(data,'$.category','glam','$.category_name','GLAM Collection') WHERE json_extract(data,'$.category')=?").bind(p.id),db.prepare('DELETE FROM glam_directory WHERE kind=? AND id=?').bind(kind,p.id)]);
 }else{
 const used=await db.prepare("SELECT id FROM glam_catalog WHERE json_extract(data,'$.brand')=? LIMIT 1").bind(existing.name).first();
 if(used)return json({error:'Brand is assigned to products. Move them first.'},409);
 await db.prepare('DELETE FROM glam_directory WHERE kind=? AND id=?').bind(kind,p.id).run();
 }
 return json({ok:true});
 }
 const clean={id:p.id};
 for(const key of ['name','description','parent','types','website','image_url'])if(typeof p[key]==='string')clean[key]=p[key].trim();
 if(!clean.name||clean.name.length>300||JSON.stringify(clean).length>20000)return json({error:'Invalid name or record size'},400);
 if(clean.image_url&&!/^\/images\/catalog\/[a-zA-Z0-9._-]+$/.test(clean.image_url))return json({error:'Invalid photo URL'},400);
 if(kind==='categories'){
 if(clean.parent===clean.id||((roots.includes(clean.id))&&clean.parent))return json({error:'Invalid parent'},400);
 if(clean.parent&&!roots.includes(clean.parent)){
 const parent=await db.prepare("SELECT data FROM glam_directory WHERE kind='categories' AND id=?").bind(clean.parent).first();
 if(!parent||JSON.parse(parent.data).parent)return json({error:'Select a saved main collection'},400);
 }
 if(clean.parent&&await db.prepare("SELECT id FROM glam_directory WHERE kind='categories' AND json_extract(data,'$.parent')=? LIMIT 1").bind(clean.id).first())return json({error:'Move subcollections first'},409);
 }
 const old=await db.prepare('SELECT data FROM glam_directory WHERE kind=? AND id=?').bind(kind,p.id).first();
 if(body.createOnly===true){
 await db.prepare('INSERT INTO glam_directory(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO NOTHING').bind(kind,p.id,JSON.stringify(clean)).run();
 const saved=await db.prepare('SELECT data FROM glam_directory WHERE kind=? AND id=?').bind(kind,p.id).first();
 return json({ok:true,record:JSON.parse(saved.data)});
 }
 const statements=[db.prepare('INSERT INTO glam_directory(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data').bind(kind,p.id,JSON.stringify(clean))];
 if(kind==='brands'&&old&&JSON.parse(old.data).name!==clean.name)statements.push(db.prepare("UPDATE glam_catalog SET data=json_set(data,'$.brand',?) WHERE json_extract(data,'$.brand')=?").bind(clean.name,JSON.parse(old.data).name));
 await db.batch(statements);
 return json({ok:true,record:clean});
 }catch(e){return json({error:'Directory operation failed'},503)}
}
