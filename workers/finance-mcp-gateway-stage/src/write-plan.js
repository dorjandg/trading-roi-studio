// A database-independent specification for an atomic controlled-write batch.
// DO NOT execute against production without a tested trusted approval issuer,
// schema migration, transactional rollback tests, and explicit write enablement.
export function buildAtomicWriteStatements({approval,identity,change,backupId,auditId,oldPayload,newPayload,nowISO}) {
  if(!approval?.approval_id||!identity?.workspace_id||!identity?.user_id||!change?.ok||
     !backupId||!auditId||typeof oldPayload!=="string"||typeof newPayload!=="string"||
     oldPayload===newPayload||!Number.isFinite(Date.parse(nowISO)))
    throw Error("Invalid atomic write inputs");
  const scope=[identity.workspace_id,identity.user_id];
  // The executor must run all statements in one real transaction, and assert
  // exactly one row changed on approval consumption AND snapshot CAS update.
  // A batch API that returns success despite zero affected rows is insufficient.
  return [
    {kind:"consume_approval",sql:`UPDATE finance_mcp_change_approvals SET consumed_at=?
      WHERE approval_id=? AND workspace_id=? AND user_id=? AND consumed_at IS NULL
      AND approved_at<=? AND expires_at>? AND expected_revision=?
      AND transaction_id=? AND field_name=? AND old_value=? AND new_value=?`,
      binds:[nowISO,approval.approval_id,...scope,nowISO,nowISO,change.revision,change.transaction_id,change.field,change.before,change.after],expectedChanges:1},
    {kind:"backup",sql:`INSERT INTO finance_mcp_snapshot_backups
      (backup_id,approval_id,workspace_id,user_id,revision,snapshot_payload,created_at)
      VALUES (?,?,?,?,?,?,?)`,
      binds:[backupId,approval.approval_id,...scope,change.revision,oldPayload,nowISO],expectedChanges:1},
    {kind:"update_snapshot",sql:`UPDATE finance_snapshots SET payload=?,revision=revision+1,updated_at=?
      WHERE workspace_id=? AND user_id=? AND revision=? AND payload=?`,
      binds:[newPayload,nowISO,...scope,change.revision,oldPayload],expectedChanges:1},
    {kind:"audit",sql:`INSERT INTO finance_mcp_write_audit
      (audit_id,approval_id,backup_id,workspace_id,user_id,transaction_id,field_name,old_value,new_value,old_revision,new_revision,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      binds:[auditId,approval.approval_id,backupId,...scope,change.transaction_id,change.field,change.before,change.after,change.revision,change.revision+1,nowISO],expectedChanges:1}
  ];
}
