// Isolated, pure approval verification helpers. No database calls or mutation.
// Production must issue approvals from a separate authenticated Finance Hub UI.
export function validateApproval(approval, change, identity, nowISO) {
  if (!approval || !change?.ok || !identity?.workspace_id || !identity?.user_id)
    return {ok:false,code:"INVALID_APPROVAL"};
  if (typeof nowISO!=="string" || !Number.isFinite(Date.parse(nowISO)))
    return {ok:false,code:"INVALID_TIME"};
  if (approval.consumed_at) return {ok:false,code:"APPROVAL_REPLAY"};
  if (!approval.approval_id || !approval.approval_digest || !approval.approved_at ||
      !approval.expires_at || !Number.isFinite(Date.parse(approval.approved_at)) ||
      !Number.isFinite(Date.parse(approval.expires_at)) ||
      approval.approved_at>nowISO || approval.expires_at<=nowISO ||
      approval.expires_at<=approval.approved_at)
    return {ok:false,code:"APPROVAL_EXPIRED_OR_INVALID"};
  const expected={
    workspace_id:identity.workspace_id,user_id:identity.user_id,
    transaction_id:change.transaction_id,field_name:change.field,
    expected_revision:change.revision,old_value:change.before,new_value:change.after
  };
  for(const [key,value] of Object.entries(expected))
    if(approval[key]!==value)return {ok:false,code:"APPROVAL_MISMATCH"};
  return {ok:true,approval_id:approval.approval_id};
}
export function verifyBackupAndAudit({backup,audit,approval,change,oldPayload,newPayload}) {
  if (!backup || !audit || !approval || !change?.ok ||
      typeof oldPayload!=="string" || typeof newPayload!=="string")
    return {ok:false,code:"INCOMPLETE_WRITE_EVIDENCE"};
  if(backup.approval_id!==approval.approval_id ||
     audit.approval_id!==approval.approval_id ||
     audit.backup_id!==backup.backup_id ||
     backup.snapshot_payload!==oldPayload ||
     audit.old_revision!==change.revision ||
     audit.new_revision!==change.revision+1 ||
     audit.transaction_id!==change.transaction_id ||
     audit.field_name!==change.field ||
     audit.old_value!==change.before ||
     audit.new_value!==change.after ||
     oldPayload===newPayload)
    return {ok:false,code:"WRITE_EVIDENCE_MISMATCH"};
  return {ok:true};
}
