-- Cloud Browser Agent isolated Stage 4.3 audit database.
-- This schema must never be applied to FINANCE_DB or any production database.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS edit_proposals (
  proposal_id TEXT PRIMARY KEY CHECK(length(proposal_id) = 64),
  target_origin TEXT NOT NULL,
  target_path TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation = 'set_text'),
  form_index INTEGER NOT NULL CHECK(form_index BETWEEN 1 AND 12),
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK(field_type IN ('text', 'textarea')),
  proposed_text_sha256 TEXT NOT NULL CHECK(length(proposed_text_sha256) = 64),
  state TEXT NOT NULL DEFAULT 'PREVIEW_ONLY' CHECK(state = 'PREVIEW_ONLY'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  CHECK(instr(target_origin, '?') = 0)
);

CREATE TABLE IF NOT EXISTS proposal_audit_events (
  event_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES edit_proposals(proposal_id),
  event_type TEXT NOT NULL CHECK(event_type IN ('PREVIEW_RECORDED','PREVIEW_REPLAYED')),
  payload_digest TEXT NOT NULL CHECK(length(payload_digest) = 64),
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor_type TEXT NOT NULL DEFAULT 'oauth_gateway' CHECK(actor_type = 'oauth_gateway'),
  CHECK(length(event_id) = 64)
);

CREATE INDEX IF NOT EXISTS idx_proposals_created ON edit_proposals(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_proposal ON proposal_audit_events(proposal_id, occurred_at);

-- No approval or execution tables, no write-enabled website permissions.
-- Audit entries intentionally contain only hashes and non-sensitive metadata.
