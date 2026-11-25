-- PLANNING ONLY. OmniPilot operator nonce table for the dedicated, isolated
-- grant D1 database. DO NOT run on Finance, production, OAuth KV or browser audit D1.
-- Stores only HMAC digests and already-pseudonymous operator/session identifiers.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS omnipilot_operator_nonces (
  nonce_digest TEXT PRIMARY KEY CHECK(length(nonce_digest)=64),
  operator_key TEXT NOT NULL CHECK(length(operator_key)=64),
  session_key TEXT NOT NULL CHECK(length(session_key)=64),
  issued_at_ms INTEGER NOT NULL CHECK(issued_at_ms>0),
  expires_at_ms INTEGER NOT NULL,
  consumed_at_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK(status IN ('ISSUED','USED')),
  CHECK(expires_at_ms=issued_at_ms+300000),
  CHECK((status='ISSUED' AND consumed_at_ms IS NULL) OR
        (status='USED' AND consumed_at_ms>=issued_at_ms
         AND consumed_at_ms<expires_at_ms))
);
CREATE INDEX IF NOT EXISTS idx_omnipilot_operator_nonce_expiry
  ON omnipilot_operator_nonces(expires_at_ms,status);

CREATE TRIGGER IF NOT EXISTS omnipilot_operator_nonce_update_guard
BEFORE UPDATE ON omnipilot_operator_nonces
BEGIN
  SELECT CASE WHEN
    OLD.status!='ISSUED' OR NEW.status!='USED'
    OR NEW.nonce_digest!=OLD.nonce_digest
    OR NEW.operator_key!=OLD.operator_key
    OR NEW.session_key!=OLD.session_key
    OR NEW.issued_at_ms!=OLD.issued_at_ms
    OR NEW.expires_at_ms!=OLD.expires_at_ms
    OR NEW.consumed_at_ms IS NULL
    OR NEW.consumed_at_ms<OLD.issued_at_ms
    OR NEW.consumed_at_ms>=OLD.expires_at_ms
    THEN RAISE(ABORT,'NONCE_MAY_ONLY_BE_CONSUMED_ONCE') END;
END;

-- Records may be pruned only after expiry via a separately audited, restricted
-- maintenance job. No delete operation is available in any MCP/browser tool.
-- No plaintext nonce, Google subject, email, ID token or OAuth credential.
