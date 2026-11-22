/**
 * Stage 4.7: test-only authenticated command boundary around the durable fixture.
 * This is NOT Google OAuth or Cloudflare Access, and is never deployed.
 * The mock identity authority is available only to test code; there is no login/API.
 */
import {createHmac,timingSafeEqual,randomBytes} from "node:crypto";
import {PersistentWritePrototype} from "./persistent-write-prototype.mjs";

const deny=code=>{const e=new Error(code);e.code=code;throw e};
const hash64=/^[a-f0-9]{64}$/;
const roles=new Set(["creator","reviewer"]);
const audience="isolated-browser-write-fixture";
const issuer="fixture-test-identity-authority";
function mac(key,data){return createHmac("sha256",key).update(data).digest("base64url")}
function encode(v){return Buffer.from(JSON.stringify(v)).toString("base64url")}
function decode(v){
 if(typeof v!=="string"||v.length>1000||!/^[A-Za-z0-9_-]+$/.test(v))deny("INVALID_AUTH");
 try{return JSON.parse(Buffer.from(v,"base64url").toString("utf8"))}catch{deny("INVALID_AUTH")}
}
const sealedFields=(claims)=>claims&&typeof claims==="object"&&!Array.isArray(claims)&&
 Object.keys(claims).sort().join(",")==="aud,exp,iat,iss,jti,role,sub" &&
 claims.aud===audience && claims.iss===issuer && roles.has(claims.role) &&
 typeof claims.sub==="string" && claims.sub===`fixture-${claims.role}-${claims.sub.split("-").at(-1)}` &&
 /^fixture-(creator|reviewer)-[a-z0-9]{2,16}$/.test(claims.sub) &&
 typeof claims.jti==="string"&&/^[a-f0-9]{32}$/.test(claims.jti) &&
 Number.isSafeInteger(claims.iat)&&Number.isSafeInteger(claims.exp);
function exact(obj,names){
 return obj&&typeof obj==="object"&&!Array.isArray(obj)&&Object.keys(obj).sort().join(",")===names.split(",").sort().join(",");
}
export function makeFixtureIdentityAuthority({key=randomBytes(32),now=()=>Date.now()}={}){
 if(!Buffer.isBuffer(key)||key.length<32)deny("WEAK_TEST_KEY");
 const secret=Buffer.from(key);
 function issue({subject,role,ttlMs=60000}){
  if(!roles.has(role)||typeof subject!=="string"|| !/^fixture-(creator|reviewer)-[a-z0-9]{2,16}$/.test(subject)||
    !subject.startsWith(`fixture-${role}-`))deny("INVALID_PRINCIPAL");
  if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>120000)deny("INVALID_TTL");
  const claims={iss:issuer,aud:audience,sub:subject,role,iat:now(),exp:now()+ttlMs,jti:randomBytes(16).toString("hex")};
  const payload=encode(claims);
  return `${payload}.${mac(secret,payload)}`;
 }
 function verify(token){
  if(typeof token!=="string"||token.length>1200)deny("INVALID_AUTH");
  const parts=token.split(".");
  if(parts.length!==2||parts[1].length!==43)deny("INVALID_AUTH");
  const expected=Buffer.from(mac(secret,parts[0]));
  const received=Buffer.from(parts[1]);
  if(expected.length!==received.length||!timingSafeEqual(expected,received))deny("INVALID_AUTH");
  const claims=decode(parts[0]);
  if(!sealedFields(claims)||now()<claims.iat-1000||now()>=claims.exp||claims.exp-claims.iat>120000)deny("INVALID_AUTH");
  return Object.freeze({id:claims.sub,role:claims.role,session:claims.jti});
 }
 return Object.freeze({issue,verify});
}
/**
 * Actor objects are generated from verified HMAC identity. The client can never
 * supply an actor object or pick its role. Request payloads must be exact.
 */
export function makeAuthenticatedFixtureController(databasePath,{authority,now}={}){
 if(!authority||typeof authority.verify!=="function")deny("AUTHORITY_REQUIRED");
 const db=new PersistentWritePrototype(databasePath,{now});
 function requireRole(token,role){
  const p=authority.verify(token);
  if(p.role!==role)deny("ROLE_DENIED");
  return {id:p.id,role:p.role};
 }
 function command(token,action,args){
  if(typeof action!=="string")deny("INVALID_ACTION");
  const role=action==="propose"||action==="execute"?"creator":
             action==="approve"||action==="rollback"?"reviewer":null;
  if(!role)deny("INVALID_ACTION");
  const actor=requireRole(token,role);
  if(action==="propose"){
   if(!exact(args,"nextValue"))deny("INVALID_ARGUMENTS");
   return db.propose(actor,args.nextValue);
  }
  if(action==="approve"){
   if(!exact(args,"proposalId,contentDigest")||!hash64.test(args.contentDigest))deny("INVALID_ARGUMENTS");
   return db.approve(actor,args);
  }
  if(action==="execute"){
   if(!exact(args,"proposalId,contentDigest,expectedRevision,requestId")||!hash64.test(args.contentDigest))deny("INVALID_ARGUMENTS");
   return db.execute(actor,args);
  }
  if(!exact(args,"proposalId,expectedRevision"))deny("INVALID_ARGUMENTS");
  return db.rollback(actor,args);
 }
 return Object.freeze({
  seed:(v)=>db.seed(v),
  state:()=>db.state(),
  events:()=>db.events(),
  verifyAudit:()=>db.verifyAudit(),
  disableWrites:()=>db.disableWrites(),
  command,
  close:()=>db.close()
 });
}
