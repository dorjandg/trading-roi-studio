// Offline security simulation ONLY. No production imports, website actions or grants.
// A caller-supplied authenticated identity is test evidence, NOT authentication.
import {createHmac,randomUUID,timingSafeEqual} from "node:crypto";
const canonical=x=>JSON.stringify(x);
const mac=(key,payload)=>createHmac("sha256",key).update(canonical(payload)).digest("hex");
const validId=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
const validDigest=x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
const isPlain=x=>!!x&&Object.getPrototypeOf(x)===Object.prototype;
export function createIsolatedGrantIssuer(signingKey){
 if(typeof signingKey!=="string"||signingKey.length<32)throw Error("Invalid isolated signing key");
 return Object.freeze({
  issue({principal,sessionId,actionDigest,origin,expiresAt},now=Date.now()){
   if(!validId(principal)||!validId(sessionId)||!validDigest(actionDigest)||
      typeof origin!=="string"||!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/.test(origin)||
      !Number.isSafeInteger(now)||!Number.isSafeInteger(expiresAt)||expiresAt<=now||expiresAt-now>60000)
     throw Error("Invalid authenticated approval evidence");
   const payload=Object.freeze({version:1,grantId:randomUUID(),principal,sessionId,actionDigest,origin,expiresAt});
   return Object.freeze({payload,signature:mac(signingKey,payload)});
  }
 });
}
export function createIsolatedGrantVerifier(signingKey,store){
 if(typeof signingKey!=="string"||signingKey.length<32)throw Error("Invalid isolated signing key");
 if(!store||typeof store.reserveAndAudit!=="function")throw Error("Durable audit store required");
 return Object.freeze({
  async verifyAndRecord(grant,context,now=Date.now()){
   if(!isPlain(grant)||Object.keys(grant).sort().join(",")!=="payload,signature"||
      !isPlain(grant.payload)||Object.keys(grant.payload).sort().join(",")!=="actionDigest,expiresAt,grantId,origin,principal,sessionId,version"||
      typeof grant.signature!=="string"||!/^[a-f0-9]{64}$/.test(grant.signature)||
      !isPlain(context)||Object.keys(context).sort().join(",")!=="actionDigest,origin,principal,sessionId"||
      !Number.isSafeInteger(now))throw Error("Malformed approval");
   const p=grant.payload;
   if(p.version!==1||!validId(p.principal)||!validId(p.sessionId)||!validDigest(p.actionDigest)||
      typeof p.origin!=="string"||!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/.test(p.origin)||
      typeof p.grantId!=="string"||!/^[0-9a-f-]{36}$/.test(p.grantId)||
      !Number.isSafeInteger(p.expiresAt)||p.expiresAt<=now||
      p.principal!==context.principal||p.sessionId!==context.sessionId||
      p.actionDigest!==context.actionDigest||p.origin!==context.origin)
      throw Error("Approval scope or expiry rejected");
   const expected=Buffer.from(mac(signingKey,p),"hex");
   if(!timingSafeEqual(expected,Buffer.from(grant.signature,"hex")))throw Error("Invalid approval signature");
   // Atomic durable reserve+audit MUST be implemented by a trusted external store.
   // Never return execution authorization, even when the simulation succeeds.
   await store.reserveAndAudit(Object.freeze({grantId:p.grantId,principal:p.principal,sessionId:p.sessionId,actionDigest:p.actionDigest,origin:p.origin}));
   return Object.freeze({auditRecorded:true,grantConsumed:true,executionAllowed:false,productionWritesAllowed:false});
  }
 });
}
export function createSimulatedAtomicAuditStore(){
 const consumed=new Set();
 const records=[];
 let failing=false;
 return Object.freeze({
  setFailure(value){failing=value===true;},
  async reserveAndAudit(event){
   if(failing)throw Error("Simulated durable audit unavailable");
   if(consumed.has(event.grantId))throw Error("Approval replay rejected");
   // Synchronous commit before any await: test-only atomicity simulation.
   consumed.add(event.grantId);
   records.push(Object.freeze({...event}));
  },
  records(){return Object.freeze([...records]);}
 });
}
