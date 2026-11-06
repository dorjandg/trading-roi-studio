-- JJ Academy question-review queue. Apply to a Cloudflare D1 database before binding JJ_QUESTIONS.
CREATE TABLE IF NOT EXISTS jj_unanswered_questions (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  normalized TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  match_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','researching','needs_review','approved','resolved','rejected')),
  research_notes TEXT,
  proposed_commit TEXT,
  approved_public_title TEXT,
  approved_public_answer TEXT,
  approved_evidence_ids TEXT,
  occurrences INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS jj_questions_status_idx ON jj_unanswered_questions(status, updated_at);
CREATE TABLE IF NOT EXISTS jj_question_submissions (
  visitor_hash TEXT NOT NULL,
  question_id TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS jj_question_submissions_rate_idx ON jj_question_submissions(visitor_hash, submitted_at);
