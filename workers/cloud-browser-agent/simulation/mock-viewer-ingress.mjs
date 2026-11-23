// API1 CI-only simulated HTTPS edge. NO TLS listener, OAuth, deployment or public ingress.
// The request boundary is HTTP loopback; never expose it beyond local tests.
import {createServer} from "node:http";
import {randomBytes,timingSafeEqual} from "node:crypto";
const eq=(a,b)=>{const x=Buffer.from(a||""),y=Buffer.from(b||"");return x.length===y.length&&timingSafeEqual(x,y);};
const headers={"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff","x-frame-options":"DENY","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
const json=(res,status,obj)=>{res.writeHead(status,{"content-type":"application/json",...headers});res.end(JSON.stringify(obj));};
const page=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>API1 Private Viewer · Mock</title><style>body{margin:0;background:#121923;color:white;font:15px system-ui}main{max-width:1000px;margin:auto;padding:18px}header{padding:16px;background:#253a50}img{display:block;width:100%;background:white}button{padding:10px;border-radius:7px;margin:6px}small{color:#a9c2dd}</style></head><body><main><header><strong>API1 · Private browser viewer</strong><p>CI MOCK · synthetic pages only · read-only</p><small id="status">Loading</small><button id="refresh">Refresh</button><button id="logout">Sign out</button></header><img id="frame" alt="Chromium browser frame"><p id="url"></p></main><script src="/viewer.js" defer></script></body></html>`;
const script=`const $=id=>document.getElementById(id);async function refresh(){try{const r=await fetch('/api/state');if(!r.ok)throw Error('Session expired');const s=await r.json();$('status').textContent='Frame '+s.sequence;$('url').textContent=s.url;const f=await fetch('/api/frame');if(!f.ok)throw Error('Frame unavailable');const blob=await f.blob();const url=URL.createObjectURL(blob);const old=$('frame').dataset.objectUrl;$('frame').src=url;$('frame').dataset.objectUrl=url;if(old)URL.revokeObjectURL(old);}catch(e){$('status').textContent=e.message;}}$('refresh').onclick=refresh;$('logout').onclick=async()=>{await fetch('/logout',{method:'POST',headers:{'x-csrf-token':document.cookie.match(/(?:^|; )api1_csrf=([^;]+)/)?.[1]||''}});location.reload();};refresh();`;
export async function createMockViewerIngress(relay,{ttlMs=60000,now=()=>Date.now()}={}){
 if(!relay||!/^http:\/\/127\.0\.0\.1:\d+$/.test(relay.url)||typeof relay.viewerKey!=="string")throw Error("Local relay required");
 if(!Number.isInteger(ttlMs)||ttlMs<1000||ttlMs>600000)throw Error("Invalid TTL");
 const bootstrap=randomBytes(32).toString("base64url");
 const sessions=new Map();
 let closed=false;
 const server=createServer(async(req,res)=>{
  for(const [k,v] of Object.entries(headers))res.setHeader(k,v);
  const host=req.headers.host||"";
  if(!/^127\.0\.0\.1:\d+$/.test(host))return json(res,403,{error:"Loopback required"});
  if(req.headers.origin&&req.headers.origin!==`http://${host}`)return json(res,403,{error:"Origin denied"});
  const path=new URL(req.url||"/","http://127.0.0.1").pathname;
  const cookies=Object.fromEntries((req.headers.cookie||"").split(";").map(s=>s.trim().split("=")).filter(x=>x.length===2));
  const sid=cookies.api1_session,record=typeof sid==="string"?sessions.get(sid):null;
  const active=record&&record.expires>now();
  if(req.method==="POST"&&path==="/mock-login"){
   // Test harness supplies bootstrap via header. This is NOT real user authentication.
   if(!eq(req.headers["x-mock-bootstrap"],bootstrap))return json(res,401,{error:"Mock identity rejected"});
   const id=randomBytes(24).toString("base64url"),csrf=randomBytes(24).toString("base64url");
   sessions.set(id,{expires:now()+ttlMs,csrf});
   res.setHeader("set-cookie",[`api1_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.ceil(ttlMs/1000)}`,`api1_csrf=${csrf}; SameSite=Strict; Path=/; Max-Age=${Math.ceil(ttlMs/1000)}`]);
   return json(res,200,{mock:true,expires:now()+ttlMs});
  }
  if(!active)return json(res,401,{error:"Session required"});
  if(req.method==="POST"&&path==="/logout"){
   if(!eq(req.headers["x-csrf-token"],record.csrf))return json(res,403,{error:"CSRF denied"});
   sessions.delete(sid);
   res.setHeader("set-cookie",["api1_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0","api1_csrf=; SameSite=Strict; Path=/; Max-Age=0"]);
   return json(res,200,{signedOut:true});
  }
  if(req.method==="GET"&&path==="/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});return res.end(page);}
  if(req.method==="GET"&&path==="/viewer.js"){res.writeHead(200,{"content-type":"text/javascript; charset=utf-8"});return res.end(script);}
  if(req.method!=="GET"||!["/api/state","/api/frame","/api/links"].includes(path))return json(res,404,{error:"Viewer read-only"});
  try{
   const upstream=await fetch(relay.url+path.replace("/api",""),{headers:{authorization:"Bearer "+relay.viewerKey},signal:AbortSignal.timeout(10000)});
   if(!upstream.ok)return json(res,502,{error:"Viewer unavailable"});
   const bytes=Buffer.from(await upstream.arrayBuffer());
   if(bytes.length>3_000_000)return json(res,502,{error:"Response too large"});
   const type=path==="/api/frame"?"image/png":"application/json";
   if(!(upstream.headers.get("content-type")||"").startsWith(type))return json(res,502,{error:"Invalid upstream type"});
   res.writeHead(200,{"content-type":type,...headers});
   return res.end(bytes);
  }catch{return json(res,502,{error:"Viewer unavailable"});}
 });
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 return Object.freeze({url:`http://127.0.0.1:${server.address().port}`,mockBootstrap:bootstrap,async close(){if(closed)return;closed=true;await new Promise(resolve=>server.close(resolve));}});
}
