/**
 * Stage 4.8: local-only bridge from verified Cloudflare-style Access JWT to
 * SQLite disposable fixture. NOT deployed, no HTTP/MCP endpoint and no live sites.
 * Real OAuth/Access infrastructure is not configured in this prototype.
 */
import {createHash} from "node:crypto";
import {PersistentWritePrototype} from "./persistent-write-prototype.mjs";
const deny=code=>{const e=new Error(code);e.code=code;throw e};
const exact=(obj,keys)=>obj&&typeof obj==="object"&&!Array.isArray(obj)&&
 Object.keys(obj).sort().join(",")===keys.slice().sort().join(",");
function actorFromVerified(verified){
 if(!verified||verified.authenticated!==true||
    !["creator","reviewer"].includes(verified.role)||
    typeof verified.principalId!=="string"||typeof verified.issuer!=="string"||
    typeof verified.email!=="string")deny("UNVERIFIED_PRINCIPAL");
 // Stable fixture actor name is a hash of the verified issuer + subject.
 // It is never built from user-supplied role or headers.
 const stable=createHash("sha256").update(JSON.stringify([verified.issuer,verified.principalId])).digest("hex").slice(0,16);
 return {id:`fixture-${verified.role}-${stable}`,role:verified.role};
}
export function createAccessAuthenticatedFixture(dbPath,{verifier,now}={}){
 if(!verifier||typeof verifier.verify!=="function")deny("VERIFIER_REQUIRED");
 const db=new PersistentWritePrototype(dbPath,{now});
 async function command(token,action,args){
  const verified=await verifier.verify(token);
  const actor=actorFromVerified(verified);
  if(action==="propose"){
   if(!exact(args,["nextValue"]))deny("INVALID_ARGUMENTS");
   return db.propose(actor,args.nextValue);
  }
  if(action==="approve"){
   if(actor.role!=="reviewer")deny("ROLE_DENIED");
   if(!exact(args,["proposalId","contentDigest"]))deny("INVALID_ARGUMENTS");
   return db.approve(actor,args);
  }
  if(action==="execute"){
   if(actor.role!=="creator")deny("ROLE_DENIED");
   if(!exact(args,["proposalId","contentDigest","expectedRevision","requestId"]))deny("INVALID_ARGUMENTS");
   return db.execute(actor,args);
  }
  if(action==="rollback"){
   if(actor.role!=="reviewer")deny("ROLE_DENIED");
   if(!exact(args,["proposalId","expectedRevision"]))deny("INVALID_ARGUMENTS");
   return db.rollback(actor,args);
  }
  deny("INVALID_ACTION");
 }
 return Object.freeze({
  seed:v=>db.seed(v),state:()=>db.state(),
  command,verifyAudit:()=>db.verifyAudit(),events:()=>db.events(),
  disableWrites:()=>db.disableWrites(),close:()=>db.close()
 });
}
