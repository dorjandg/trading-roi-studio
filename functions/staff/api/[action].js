// Defense in depth: independently verify Cloudflare Access JWT, audience and staff email.
const issuer='https://floral-river-0fbd.cloudflareaccess.com';
const audience='004a4fe7bf430d588b117469d3d8dfa225cf2105c7b2e49828c4250a89d25492';
const allowed=new Set(['dorjan.gjoni.dg@gmail.com','glamlingerie1@gmail.com']);
const reject=(code,message)=>new Response(JSON.stringify({error:message}),{status:code,headers:{'content-type':'application/json','cache-control':'no-store'}});
function decode(s){const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function verifyStaff({request,next}){
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!token)return reject(401,'Staff authentication required');
 const parts=token.split('.');if(parts.length!==3)return reject(401,'Invalid staff authentication');
 try{
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  const now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||!header.kid||claims.iss!==issuer||!(Array.isArray(claims.aud)?claims.aud.includes(audience):claims.aud===audience)||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||!allowed.has(String(claims.email||'').toLowerCase()))return reject(403,'Staff access denied');
  const response=await fetch(issuer+'/cdn-cgi/access/certs',{cf:{cacheTtl:300,cacheEverything:true}});
  if(!response.ok)return reject(503,'Authentication verification unavailable');
  const keys=(await response.json()).keys||[];
  const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA');
  if(!jwk)return reject(401,'Unknown authentication key');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const signed=new TextEncoder().encode(parts[0]+'.'+parts[1]);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),signed))return reject(401,'Invalid authentication signature');
  if(!['GET','HEAD','OPTIONS'].includes(request.method)){
   const origin=request.headers.get('origin');
   if(origin!==new URL(request.url).origin)return reject(403,'Cross-origin changes are not permitted');
  }
  return next(String(claims.email).toLowerCase());
 }catch{return reject(401,'Could not verify staff authentication')}
}

// Staff dashboard and API share the existing /staff/* Access application.
// The legacy /api/staff/* routes remain protected by their original audience.
import {activity,auditStaff} from '../../_shared/glam-audit.js';
import {onRequestGet as catalog} from '../../api/staff/catalog.js';
import {onRequestPut as product} from '../../api/staff/product.js';
import {onRequestPost as upload} from '../../api/staff/upload.js';
import {onRequestPut as publication} from '../../api/staff/publication.js';
import {onRequestDelete as remove} from '../../api/staff/delete.js';
import {onRequest as directory} from '../../api/staff/directory.js';
const handlers=new Map([['GET catalog',catalog],['PUT product',product],['POST upload',upload],['PUT publication',publication],['DELETE delete',remove],['GET directory',directory],['PUT directory',directory],['DELETE directory',directory]]);
export async function onRequest(context){
 const {request}=context;
 return verifyStaff({request,next:(actor)=>{
  const action=new URL(request.url).pathname.match(/^\/staff\/api\/(catalog|product|upload|publication|delete|directory|activity)\/?$/)?.[1];
  if(!action)return reject(404,'Unknown staff operation');
  if(action==='activity')return activity(context,actor);
  const handler=handlers.get(request.method+' '+action);
  return handler?auditStaff(context,actor,action,()=>handler(context)):reject(405,'Method not allowed');
 }});
}
