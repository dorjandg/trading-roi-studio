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

-- Invitation-based onboarding: administrator invites member by verified email.
CREATE TABLE IF NOT EXISTS invitations (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 email TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('member')),
 expires_at TEXT NOT NULL,
 accepted_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(workspace_id,email)
);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email,expires_at);

-- Private, per-user snapshot storage for opt-in Finance Hub synchronization.
-- A workspace administrator does not automatically gain read access to another user's snapshot.
CREATE TABLE IF NOT EXISTS finance_snapshots (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
 payload TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(workspace_id,user_id)
);
