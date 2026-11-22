-- Optional direct Finance Hub correction path. NOT applied automatically.
-- Apply only after testing against isolated D1 and backing up production.
CREATE TABLE IF NOT EXISTS finance_mcp_direct_backups (
 backup_id TEXT PRIMARY KEY NOT NULL,
 workspace_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 snapshot_payload TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS finance_mcp_direct_audit (
 audit_id TEXT PRIMARY KEY NOT NULL,
 backup_id TEXT NOT NULL UNIQUE REFERENCES finance_mcp_direct_backups(backup_id),
 workspace_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 transaction_id TEXT NOT NULL,
 field_name TEXT NOT NULL CHECK(field_name IN ('category','provider','description')),
 old_value TEXT NOT NULL,
 new_value TEXT NOT NULL,
 old_revision INTEGER NOT NULL,
 new_revision INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finance_mcp_direct_backups_user ON finance_mcp_direct_backups(workspace_id,user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_finance_mcp_direct_audit_user ON finance_mcp_direct_audit(workspace_id,user_id,created_at);
