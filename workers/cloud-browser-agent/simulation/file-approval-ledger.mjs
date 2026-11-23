// OFFLINE TEST-ONLY file-backed approval ledger. Never imported into production.
// A durable filesystem simulation is NOT a production transactional database.
import {mkdir,open,readFile,readdir,stat} from "node:fs/promises";
import {join} from "node:path";
const validGrantId=id=>typeof id==="string"&&/^[0-9a-f-]{36}$/.test(id);
export function createFileApprovalLedger(root,{failAt=null}={}){
 if(typeof root!=="string"||!root.startsWith("/")||root.includes("\0"))throw Error("Invalid ledger root");
 if(failAt!==null&&!["afterReserve","afterAuditWrite","afterCommit"].includes(failAt))throw Error("Invalid failure stage");
 const entries=join(root,"grants");
 return Object.freeze({
  async reserveAndAudit(event){
   if(!event||!validGrantId(event.grantId))throw Error("Invalid ledger event");
   await mkdir(entries,{recursive:true});
   const dir=join(entries,event.grantId);
   // Atomic mkdir is a single-use reservation across independent processes.
   try{await mkdir(dir);}catch(e){if(e?.code==="EEXIST")throw Error("Approval replay or uncertain prior commit rejected");throw e;}
   // A crash after reservation leaves a quarantined grant; NEVER auto-replay it.
   if(failAt==="afterReserve")throw Error("Simulated crash after reservation");
   const data=JSON.stringify({version:1,grantId:event.grantId,principal:event.principal,sessionId:event.sessionId,actionDigest:event.actionDigest,origin:event.origin});
   const file=await open(join(dir,"audit.json"),"wx",0o600);
   try{await file.writeFile(data);await file.sync();}finally{await file.close();}
   if(failAt==="afterAuditWrite")throw Error("Simulated crash after audit write");
   const marker=await open(join(dir,"committed"),"wx",0o600);
   try{await marker.writeFile("COMMITTED");await marker.sync();}finally{await marker.close();}
   if(failAt==="afterCommit")throw Error("Simulated acknowledgement lost after commit");
   return Object.freeze({recorded:true,executionAllowed:false});
  },
  async inspect(grantId){
   if(!validGrantId(grantId))throw Error("Invalid grant ID");
   const dir=join(entries,grantId);
   try{
    const audit=JSON.parse(await readFile(join(dir,"audit.json"),"utf8"));
    const marker=await readFile(join(dir,"committed"),"utf8").catch(()=>null);
    return Object.freeze({state:marker==="COMMITTED"?"COMMITTED":"QUARANTINED",audit:Object.freeze(audit),executionAllowed:false});
   }catch(e){
    if(e?.code!=="ENOENT"&&!(e instanceof SyntaxError))throw e;
    try{await stat(dir);return Object.freeze({state:"QUARANTINED",audit:null,executionAllowed:false});}
    catch(err){if(err?.code==="ENOENT")return Object.freeze({state:"ABSENT",audit:null,executionAllowed:false});throw err;}
   }
  },
  async listIds(){try{return Object.freeze((await readdir(entries)).sort());}catch(e){if(e?.code==="ENOENT")return Object.freeze([]);throw e;}}
 });
}
