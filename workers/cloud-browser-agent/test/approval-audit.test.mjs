import test from "node:test";
import assert from "node:assert/strict";
import {buildPreviewAuditReceipt,denyApprovalExecution} from "../src/approval-audit.mjs";
const preview={operation:"set_text",url:"https://jp-realty.pages.dev/",formIndex:3,fieldLabel:"Description",fieldType:"textarea",proposedText:"A harmless draft description",previewOnly:true,executionAllowed:false,approvalState:"NOT_REQUESTED"};
test("audit receipt is deterministic, contains hashes but no text or credentials",async()=>{
 const a=await buildPreviewAuditReceipt(preview),b=await buildPreviewAuditReceipt(preview);
 assert.equal(a.proposalId,b.proposalId);
 assert.match(a.proposalId,/^[0-9a-f]{64}$/);
 assert.match(a.audit.proposedTextSha256,/^[0-9a-f]{64}$/);
 assert.equal(JSON.stringify(a).includes(preview.proposedText),false);
 assert.equal(a.audit.durable,false);
 assert.equal(a.audit.storage,"NONE");
 assert.equal(a.approval.grantIssued,false);
 assert.equal(a.approval.canExecute,false);
});
test("changing one character changes the proposal ID",async()=>{
 const a=await buildPreviewAuditReceipt(preview);
 const b=await buildPreviewAuditReceipt({...preview,proposedText:preview.proposedText+"!"});
 assert.notEqual(a.proposalId,b.proposalId);
});
test("refuses nonpreview or already approved execution proposals",async()=>{
 for(const patch of [{previewOnly:false},{executionAllowed:true},{approvalState:"APPROVED"},{operation:"upload_file"}])
   await assert.rejects(buildPreviewAuditReceipt({...preview,...patch}));
});
test("all requests to execute or approve are denied",()=>{
 for(const action of ["fill","click","submit","upload","save","approve"]){
  const r=denyApprovalExecution({action,approved:true,token:"fake"});
  assert.equal(r.authorized,false);assert.equal(r.executed,false);
 }
});
