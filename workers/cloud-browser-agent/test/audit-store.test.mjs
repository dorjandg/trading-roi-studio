import test from "node:test";
import assert from "node:assert/strict";
import {persistPreviewAudit} from "../src/audit-store.mjs";
import {buildPreviewAuditReceipt} from "../src/approval-audit.mjs";
const preview={operation:"set_text",url:"https://jp-realty.pages.dev/",formIndex:1,fieldLabel:"Description",fieldType:"textarea",proposedText:"Harmless staging preview",previewOnly:true,executionAllowed:false,approvalState:"NOT_REQUESTED"};
function fakeDB(){
 const proposals=new Map(),events=new Map();
 function prepare(query){
  return {bind(...values){
   return {query,values,async first(){
     if(query.startsWith("SELECT proposal_id"))return proposals.get(values[0])||null;
     if(query.startsWith("SELECT event_id"))return events.get(values[0])||null;
     throw Error("Unexpected read query");
   }};
  }};
 }
 return {proposals,events,prepare,async batch(statements){
  for(const s of statements){
   if(s.query.startsWith("INSERT OR IGNORE INTO edit_proposals")){
    const [id,origin,path,operation,idx,label,type,digest,expiry]=s.values;
    if(!proposals.has(id))proposals.set(id,{proposal_id:id,target_origin:origin,target_path:path,operation,form_index:idx,field_label:label,field_type:type,proposed_text_sha256:digest,state:"PREVIEW_ONLY",expires_at:expiry});
   }else if(s.query.startsWith("INSERT OR IGNORE INTO proposal_audit_events")){
    const [id,pid,type,digest]=s.values;
    if(!events.has(id))events.set(id,{event_id:id,proposal_id:pid,event_type:type,payload_digest:digest});
   }else throw Error("Unexpected insert query");
  }
 }};
}
test("isolated D1 saves only hashed metadata, verifies storage and deduplicates retries",async()=>{
 const db=fakeDB(),receipt=await buildPreviewAuditReceipt(preview);
 const a=await persistPreviewAudit(db,preview,receipt,new Date("2026-11-22T12:00:00Z"));
 const b=await persistPreviewAudit(db,preview,receipt,new Date("2026-11-22T12:01:00Z"));
 assert.equal(a.audit.durable,true);
 assert.equal(a.audit.storage,"ISOLATED_D1");
 assert.equal(a.persisted,true);
 assert.equal(a.executionAllowed,false);
 assert.equal(a.approval.grantIssued,false);
 assert.equal(a.proposalId,b.proposalId);
 assert.equal(db.proposals.size,1);assert.equal(db.events.size,1);
 const stored=JSON.stringify([...db.proposals.values(),...db.events.values()]);
 assert.equal(stored.includes(preview.proposedText),false);
 assert.equal(stored.includes("APPROVED"),false);
});
test("storage absence or failure is fail closed",async()=>{
 const receipt=await buildPreviewAuditReceipt(preview);
 await assert.rejects(persistPreviewAudit(null,preview,receipt));
 await assert.rejects(persistPreviewAudit({prepare(){return {bind(){return {}}}},async batch(){throw Error("disk down")}},preview,receipt));
});
test("never stores unapproved or unsafe preview",async()=>{
 const db=fakeDB(),receipt=await buildPreviewAuditReceipt(preview);
 for(const patch of [{executionAllowed:true},{approvalState:"APPROVED"},{previewOnly:false},{url:"https://evil.test/?run=1"}])
   await assert.rejects(persistPreviewAudit(db,{...preview,...patch},receipt));
 assert.equal(db.proposals.size,0);
});
