-- Finance Hub cloud database foundation (Cloudflare D1 / SQLite)
-- Run only after access-controlled API endpoints are implemented.
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS workspaces (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS memberships (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('owner','admin','member','viewer')),
 PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS providers (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 name TEXT NOT NULL,
 provider_type TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS financial_accounts (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 provider_id TEXT REFERENCES providers(id),
 owner_user_id TEXT REFERENCES users(id),
 account_label TEXT NOT NULL,
 account_type TEXT NOT NULL,
 currency TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS transactions (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 account_id TEXT REFERENCES financial_accounts(id),
 user_id TEXT REFERENCES users(id),
 occurred_on TEXT NOT NULL,
 category TEXT NOT NULL,
 transaction_type TEXT NOT NULL CHECK(transaction_type IN ('expense','income','investment','transfer','trade_pnl','fee','payout')),
 amount_minor INTEGER NOT NULL,
 currency TEXT NOT NULL,
 notes TEXT,
 source TEXT NOT NULL DEFAULT 'manual',
 external_id TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(workspace_id,source,external_id)
);
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date ON transactions(workspace_id,occurred_on);
CREATE TABLE IF NOT EXISTS integrations (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 provider_id TEXT REFERENCES providers(id),
 status TEXT NOT NULL DEFAULT 'disconnected',
 last_sync_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_events (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 actor_user_id TEXT REFERENCES users(id),
 action TEXT NOT NULL,
 object_type TEXT NOT NULL,
 object_id TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
