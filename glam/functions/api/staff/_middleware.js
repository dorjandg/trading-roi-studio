// Defense in depth: independently verify Cloudflare Access JWT, audience and staff email.
const issuer='https://floral-river-0fbd.cloudflareaccess.com';
const audience='c95832c1b52ae98da0a2fed0d7d0e8dc4814b70e2f9ad01e4db4829bba022bb3';
const allowed=new Set(['dorjan.gjoni.dg@gmail.com','glamlingerie1@gmail.com']);
const reject=(code,message)=>new Response(JSON.stringify({error:message}),{status:code,headers:{'content-type':'application/json','cache-control':'no-store'}});
function decode(s){const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
export async function onRequest({request,next}){
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
  return next();
 }catch{return reject(401,'Could not verify staff authentication')}
}
