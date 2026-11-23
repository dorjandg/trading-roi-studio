// Isolated API1 controller capability: HMAC bearer tokens for local dev only.
// Does not expose a network listener, execute commands or grant production access.
import {createHmac,timingSafeEqual,randomBytes} from "node:crypto";
const MAX_TTL=15*60*1000;
export function createLocalControllerAuth({secret=randomBytes(32),now=()=>Date.now()}={}){
 if(!Buffer.isBuffer(secret)||secret.length<32)throw Error("32-byte secret required");
 const consumed=new Set();
 const sign=payload=>createHmac("sha256",secret).update(payload).digest("base64url");
 function issue({scope="viewer:read",ttlMs=60000}={}){
  if(!["viewer:read","viewer:control"].includes(scope)||!Number.isInteger(ttlMs)||ttlMs<1000||ttlMs>MAX_TTL)throw Error("Invalid scope or TTL");
  const payload=Buffer.from(JSON.stringify({scope,expires:now()+ttlMs,nonce:randomBytes(16).toString("hex")})).toString("base64url");
  return payload+"."+sign(payload);
 }
 function verify(token,scope,{consume=false}={}){
  if(typeof token!=="string"||token.length>1024)return false;
  const parts=token.split(".");
  if(parts.length!==2)return false;
  const [payload,mac]=parts;
  if(!/^[a-zA-Z0-9_-]+$/.test(payload)||!/^[a-zA-Z0-9_-]+$/.test(mac))return false;
  const expected=Buffer.from(sign(payload)),actual=Buffer.from(mac);
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return false;
  let claim;try{claim=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));}catch{return false;}
  if(!claim||!["viewer:read","viewer:control"].includes(claim.scope)||!Number.isSafeInteger(claim.expires)||claim.expires<=now()||claim.expires>now()+MAX_TTL||typeof claim.nonce!=="string"||!/^[a-f0-9]{32}$/.test(claim.nonce))return false;
  if(scope==="viewer:control"&&claim.scope!=="viewer:control")return false;
  if(consume){if(consumed.has(claim.nonce))return false;consumed.add(claim.nonce);}
  return true;
 }
 return Object.freeze({issue,verify});
}
