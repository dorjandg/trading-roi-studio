// API 1: SYNTHETIC JWT verifier for isolated OAuth security tests only.
// No signing, real identity-provider discovery, JWKS fetching or production imports.
// Every test key is created in CI memory; never use this module for real tokens.
import {createPublicKey,verify as verifySignature} from "node:crypto";
export const TEST_SCOPE="browser:wikipedia.read";
const decoder=new TextDecoder("utf-8",{fatal:true});
const plain=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const nonempty=x=>typeof x==="string"&&x.length>0&&x.length<=512;
const b64pattern=/^[A-Za-z0-9_-]+$/;
function part(raw){
 if(!raw||raw.length>4096||!b64pattern.test(raw)||raw.length%4===1)throw Error("Malformed token");
 const decoded=Buffer.from(raw,"base64url");
 if(decoded.toString("base64url")!==raw)throw Error("Malformed token");
 return decoded;
}
function parse(raw){
 const item=JSON.parse(decoder.decode(part(raw)));
 if(!plain(item))throw Error("Invalid token claims");
 return item;
}
export function createMockJwtVerifier({issuer,resource,publicJwk,kid,allowedSubjects,scope=TEST_SCOPE,maxAgeSeconds=3600,nowSeconds=()=>Math.floor(Date.now()/1000)}={}){
 if(!nonempty(issuer)||!issuer.startsWith("https://")||!nonempty(resource)||!resource.startsWith("https://")||
    issuer===resource||scope!==TEST_SCOPE||!nonempty(kid)||kid.length>80||
    !Array.isArray(allowedSubjects)||allowedSubjects.length===0||
    allowedSubjects.some(s=>!nonempty(s))||!Number.isSafeInteger(maxAgeSeconds)||maxAgeSeconds<60||maxAgeSeconds>3600||
    typeof nowSeconds!=="function")throw Error("Invalid synthetic verifier configuration");
 if(!plain(publicJwk)||publicJwk.kty!=="OKP"||publicJwk.crv!=="Ed25519"||!nonempty(publicJwk.x)||
    "d" in publicJwk||publicJwk.alg&&publicJwk.alg!=="EdDSA")
    throw Error("Only an Ed25519 public test JWK is accepted");
 const key=createPublicKey({key:{kty:"OKP",crv:"Ed25519",x:publicJwk.x},format:"jwk"});
 const subjects=new Set(allowedSubjects);
 return Object.freeze({
  verify(bearer){
   try{
    if(typeof bearer!=="string"||!bearer.startsWith("Bearer ")||bearer.length>10000)throw Error("Bearer required");
    const jwt=bearer.slice(7);
    if(jwt.includes(" ")||jwt.includes("\t")||jwt.includes("\n"))throw Error("Malformed bearer");
    const chunks=jwt.split(".");
    if(chunks.length!==3)throw Error("Wrong JWT segment count");
    const [header64,payload64,signature64]=chunks;
    const header=parse(header64),claims=parse(payload64),signature=part(signature64);
    if(Object.keys(header).sort().join(",")!=="alg,kid,typ"||
       header.alg!=="EdDSA"||header.typ!=="at+jwt"||header.kid!==kid||signature.length!==64)
       throw Error("Unsupported JWT signing header");
    if(!verifySignature(null,Buffer.from(header64+"."+payload64,"ascii"),key,signature))
       throw Error("Invalid JWT signature");
    const clock=nowSeconds();
    if(!Number.isSafeInteger(clock)||!Number.isSafeInteger(claims.iat)||
       !Number.isSafeInteger(claims.exp)||!Number.isSafeInteger(claims.nbf)||
       claims.exp<=clock||claims.nbf>clock||claims.iat>clock||claims.iat>claims.nbf||
       claims.exp<=claims.iat||claims.exp-claims.iat>maxAgeSeconds)
       throw Error("Expired, early or overlong token");
    if(claims.iss!==issuer||claims.aud!==resource||!nonempty(claims.sub)||
       !subjects.has(claims.sub)||typeof claims.scope!=="string"||claims.scope.length>1024)
       throw Error("JWT claims are outside test policy");
    const scopes=claims.scope.split(" ");
    if(scopes.some(x=>x.length===0)||new Set(scopes).size!==scopes.length)
       throw Error("Invalid scope encoding");
    if(!scopes.includes(scope))return Object.freeze({ok:false,error:"insufficient_scope"});
    return Object.freeze({ok:true,subject:claims.sub,scope});
   }catch{return Object.freeze({ok:false,error:"invalid_token"});}
  }
 });
}
