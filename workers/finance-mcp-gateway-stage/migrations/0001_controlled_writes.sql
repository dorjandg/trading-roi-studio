-- STAGING CONTROLLED WRITES: schema proposal only.
-- This file is NOT applied automatically and must not be executed on production D1
-- before backup/restore and approval-flow tests pass.
-- Separate tables avoid changes to existing finance_snapshots, users, memberships.

CREATE TABLE IF NOT EXISTS finance_mcp_change_approvals (
  approval_id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  field_name TEXT NOT NULL CHECK (field_name IN ('category','provider','description')),
  expected_revision INTEGER NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  approval_digest TEXT NOT NULL UNIQUE,
  CHECK (length(new_value) BETWEEN 1 AND 300)
);

CREATE TABLE IF NOT EXISTS finance_mcp_snapshot_backups (
  backup_id TEXT PRIMARY KEY NOT NULL,
  approval_id TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  snapshot_payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (approval_id) REFERENCES finance_mcp_change_approvals(approval_id)
);

CREATE TABLE IF NOT EXISTS finance_mcp_write_audit (
  audit_id TEXT PRIMARY KEY NOT NULL,
  approval_id TEXT NOT NULL UNIQUE,
  backup_id TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  old_revision INTEGER NOT NULL,
  new_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (approval_id) REFERENCES finance_mcp_change_approvals(approval_id),
  FOREIGN KEY (backup_id) REFERENCES finance_mcp_snapshot_backups(backup_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_mcp_approvals_user
  ON finance_mcp_change_approvals(workspace_id,user_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_finance_mcp_audit_user
  ON finance_mcp_write_audit(workspace_id,user_id,created_at);
