-- Gmail financial evidence is separate from bookkeeping transactions and user snapshots.
-- Apply once to the Finance Hub D1 database before enabling the ingest endpoint.
CREATE TABLE IF NOT EXISTS gmail_financial_evidence (
  user_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  provider TEXT NOT NULL,
  description TEXT NOT NULL,
  amount TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Unclassified',
  status TEXT NOT NULL DEFAULT 'needs_review',
  reference TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,source_id)
);
CREATE INDEX IF NOT EXISTS idx_gmail_evidence_owner_date ON gmail_financial_evidence(user_id,occurred_on DESC);
