/**
 * Stage 4.8: strict Cloudflare Access JWT verifier, isolated from deployed MCP.
 *
 * Accepts real RS256 JWTs after cryptographic verification against a caller-
 * provided, trusted, pre-fetched JWKS. Never fetches a URL from JWT headers.
 * Requires EXACT issuer + audience + Access email allowlist mapping.
 * No automatic role from token claims. Never authorizes website execution.
 *
 * Use of this library in a live service still requires reviewed, secure JWKS
 * retrieval/caching, key rotation, Cloudflare Access policy and mcp:write consent.
 */
const encoder=new TextEncoder();
const fail=code=>{throw Object.assign(new Error(code),{code})};
const b64url=/^[a-zA-Z0-9_-]+$/;
const isObj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const exact=(v,keys)=>isObj(v)&&Object.keys(v).sort().join(",")===keys.slice().sort().join(",");
function decode(segment,max){
 if(typeof segment!=="string"||segment.length===0||segment.length>max||!b64url.test(segment))fail("INVALID_JWT");
 try {
  const normalized=segment.replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(normalized+"=".repeat((4-normalized.length%4)%4));
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  return bytes;
 }catch{fail("INVALID_JWT")}
}
const parse=(bytes)=>{
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes))}
 catch{fail("INVALID_JWT")}
};
const keyID=s=>typeof s==="string"&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(s);
const validEmail=s=>typeof s==="string"&&s.length<255&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const validRole=s=>s==="creator"||s==="reviewer";
export function createAccessJwtVerifier({
 issuer,audience,jwks,roleAssignments,now=()=>Date.now(),
 maximumLifetimeSeconds=3600,allowedClockSkewSeconds=30
}={}){
 if(typeof issuer!=="string"||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer))fail("INVALID_CONFIGURATION");
 if(typeof audience!=="string"||audience.length<16||audience.length>128||!b64url.test(audience))fail("INVALID_CONFIGURATION");
 if(!isObj(jwks)||!Array.isArray(jwks.keys)||jwks.keys.length<1||jwks.keys.length>12)fail("INVALID_CONFIGURATION");
 if(!isObj(roleAssignments)||Object.keys(roleAssignments).length===0)fail("INVALID_CONFIGURATION");
 const roles=new Map();
 for(const [email,role] of Object.entries(roleAssignments)){
  if(!validEmail(email)||email!==email.toLowerCase()||!validRole(role))fail("INVALID_CONFIGURATION");
  roles.set(email,role);
 }
 const keys=new Map();
 for(const k of jwks.keys){
  if(!isObj(k)||k.kty!=="RSA"||k.alg!=="RS256"||k.use!=="sig"||!keyID(k.kid)||
     typeof k.n!=="string"||typeof k.e!=="string"||!b64url.test(k.n)||!b64url.test(k.e)||
     k.n.length<300||keys.has(k.kid))fail("INVALID_CONFIGURATION");
  keys.set(k.kid,{kty:"RSA",n:k.n,e:k.e,alg:"RS256",ext:true,key_ops:["verify"]});
 }
 if(!Number.isSafeInteger(maximumLifetimeSeconds)||maximumLifetimeSeconds>3600||maximumLifetimeSeconds<60 ||
    !Number.isSafeInteger(allowedClockSkewSeconds)||allowedClockSkewSeconds<0||allowedClockSkewSeconds>60)
  fail("INVALID_CONFIGURATION");
 return Object.freeze({
  async verify(token){
   if(typeof token!=="string"||token.length>12000)fail("INVALID_JWT");
   const parts=token.split(".");
   if(parts.length!==3)fail("INVALID_JWT");
   const header=parse(decode(parts[0],1000));
   if(!exact(header,["alg","typ","kid"])||header.alg!=="RS256"||header.typ!=="JWT"||
      !keyID(header.kid)||!keys.has(header.kid))fail("INVALID_JWT");
   const claims=parse(decode(parts[1],7000));
   if(!isObj(claims)||typeof claims.iss!=="string"||claims.iss!==issuer||
      !Array.isArray(claims.aud)||claims.aud.length!==1||claims.aud[0]!==audience||
      typeof claims.sub!=="string"||claims.sub.length<1||claims.sub.length>255||
      !validEmail(claims.email)||!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||
      !Number.isSafeInteger(claims.nbf)||claims.exp<=claims.iat||
      claims.exp-claims.iat>maximumLifetimeSeconds)fail("INVALID_CLAIMS");
   const nowSeconds=Math.floor(now()/1000);
   if(!Number.isSafeInteger(nowSeconds)||nowSeconds<claims.nbf-allowedClockSkewSeconds||
      nowSeconds<claims.iat-allowedClockSkewSeconds||nowSeconds>=claims.exp+allowedClockSkewSeconds)
     fail("EXPIRED_OR_NOT_ACTIVE");
   const email=claims.email.toLowerCase();
   // Role comes ONLY from trusted server config, never from client or token.
   const role=roles.get(email);
   if(!role)fail("PRINCIPAL_NOT_ALLOWED");
   const key=await crypto.subtle.importKey("jwk",keys.get(header.kid),
     {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
   const signature=decode(parts[2],1500);
   const verified=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,signature,
     encoder.encode(parts[0]+"."+parts[1]));
   if(!verified)fail("INVALID_SIGNATURE");
   return Object.freeze({principalId:claims.sub,email,role,issuer,authenticated:true});
  }
 });
}
