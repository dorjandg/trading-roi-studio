import test from "node:test";
import assert from "node:assert/strict";
import {validateApproval,verifyBackupAndAudit} from "../src/write-approval.js";
const change={ok:true,transaction_id:"t1",field:"category",revision:19,before:"Trading",after:"Fees"};
const identity={workspace_id:"w1",user_id:"u1"};
const approval=()=>({approval_id:"a1",approval_digest:"digest",workspace_id:"w1",user_id:"u1",transaction_id:"t1",field_name:"category",expected_revision:19,old_value:"Trading",new_value:"Fees",approved_at:"2026-11-22T10:00:00Z",expires_at:"2026-11-22T10:05:00Z",consumed_at:null});
const now="2026-11-22T10:01:00Z";
test("accepts only matching, unconsumed approval",()=>assert.equal(validateApproval(approval(),change,identity,now).ok,true));
test("rejects expired and future approval",()=>{
 assert.equal(validateApproval(approval(),change,identity,"2026-11-22T10:05:00Z").code,"APPROVAL_EXPIRED_OR_INVALID");
 assert.equal(validateApproval(approval(),change,identity,"2026-11-22T09:59:00Z").code,"APPROVAL_EXPIRED_OR_INVALID");
});
test("rejects replay",()=>assert.equal(validateApproval({...approval(),consumed_at:now},change,identity,now).code,"APPROVAL_REPLAY"));
test("rejects cross-user, cross-workspace and changed details",()=>{
 for(const key of ["workspace_id","user_id","transaction_id","field_name","expected_revision","old_value","new_value"]){
  assert.equal(validateApproval({...approval(),[key]:"tampered"},change,identity,now).code,"APPROVAL_MISMATCH");
 }
});
test("rejects missing approval",()=>assert.equal(validateApproval(null,change,identity,now).code,"INVALID_APPROVAL"));
test("requires matching backup and audit evidence",()=>{
 const backup={backup_id:"b1",approval_id:"a1",snapshot_payload:"old"};
 const audit={approval_id:"a1",backup_id:"b1",old_revision:19,new_revision:20,transaction_id:"t1",field_name:"category",old_value:"Trading",new_value:"Fees"};
 const args={backup,audit,approval:approval(),change,oldPayload:"old",newPayload:"new"};
 assert.equal(verifyBackupAndAudit(args).ok,true);
 assert.equal(verifyBackupAndAudit({...args,backup:{...backup,snapshot_payload:"wrong"}}).code,"WRITE_EVIDENCE_MISMATCH");
 assert.equal(verifyBackupAndAudit({...args,audit:{...audit,new_revision:21}}).code,"WRITE_EVIDENCE_MISMATCH");
});

test("rejects approvals with overlong TTL and accepts equivalent timezone offsets",()=>{
 const long={...approval(),expires_at:"2026-11-22T10:06:00Z"};
 assert.equal(validateApproval(long,change,identity,now).code,"APPROVAL_EXPIRED_OR_INVALID");
 const offset={...approval(),approved_at:"2026-11-22T11:00:00+01:00",expires_at:"2026-11-22T11:05:00+01:00"};
 assert.equal(validateApproval(offset,change,identity,now).ok,true);
});
