-- OmniPilot isolated OAuth subject/site-grant data model.
-- PLANNING ONLY: do not apply to any live D1 database, OAuth KV, FINANCE_DB,
-- deployed Worker or production resource. Needs separate dedicated isolated D1.
-- Domain paths and grants are operational metadata; NO Google sub, email,
-- OAuth tokens, form values, passwords, browsing history, or credentials.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS omnipilot_subject_grants (
  grant_id TEXT PRIMARY KEY CHECK(length(grant_id)=36),
  subject_key TEXT NOT NULL CHECK(length(subject_key)=64),
  requested_by_key TEXT NOT NULL CHECK(length(requested_by_key)=64),
  approved_by_key TEXT CHECK(approved_by_key IS NULL OR length(approved_by_key)=64),
  origin TEXT NOT NULL CHECK(substr(origin,1,8)='https://' AND length(origin)<=200),
  path_prefix TEXT NOT NULL CHECK(substr(path_prefix,1,1)='/' AND length(path_prefix)<=128),
  mode TEXT NOT NULL CHECK(mode IN ('read','draft')),
  expires_at_ms INTEGER NOT NULL,
  max_actions INTEGER NOT NULL CHECK(max_actions BETWEEN 0 AND 3),
  status TEXT NOT NULL CHECK(status IN ('PENDING','ACTIVE','DENIED','REVOKED')),
  revision INTEGER NOT NULL CHECK(revision>=1),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  audit_head TEXT NOT NULL CHECK(length(audit_head)=64),
  last_event_id TEXT NOT NULL CHECK(length(last_event_id)=36),
  last_event_type TEXT NOT NULL CHECK(last_event_type IN ('REQUESTED','APPROVED','DENIED','REVOKED')),
  last_event_actor_key TEXT NOT NULL CHECK(length(last_event_actor_key)=64),
  last_event_target_digest TEXT NOT NULL CHECK(length(last_event_target_digest)=64),
  last_event_terms_digest TEXT NOT NULL CHECK(length(last_event_terms_digest)=64),
  last_event_previous_hash TEXT NOT NULL CHECK(length(last_event_previous_hash)=64),
  CHECK((mode='read' AND max_actions=0) OR (mode='draft' AND max_actions BETWEEN 1 AND 3)),
  CHECK(created_at_ms>=0 AND updated_at_ms>=created_at_ms AND expires_at_ms>created_at_ms)
);

-- One outstanding grant per subject and origin. After revocation/denial,
-- a new request may be created without reusing an old grant ID.
CREATE UNIQUE INDEX IF NOT EXISTS idx_omnipilot_open_subject_site
  ON omnipilot_subject_grants(subject_key,origin)
  WHERE status IN ('PENDING','ACTIVE');
CREATE INDEX IF NOT EXISTS idx_omnipilot_subject_revocation
  ON omnipilot_subject_grants(subject_key,origin,status,revision);

CREATE TABLE IF NOT EXISTS omnipilot_subject_grant_audit (
  event_id TEXT PRIMARY KEY CHECK(length(event_id)=36),
  grant_id TEXT NOT NULL REFERENCES omnipilot_subject_grants(grant_id),
  revision INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('REQUESTED','APPROVED','DENIED','REVOKED')),
  actor_key TEXT NOT NULL CHECK(length(actor_key)=64),
  subject_key TEXT NOT NULL CHECK(length(subject_key)=64),
  target_digest TEXT NOT NULL CHECK(length(target_digest)=64),
  terms_digest TEXT NOT NULL CHECK(length(terms_digest)=64),
  previous_hash TEXT NOT NULL CHECK(length(previous_hash)=64),
  event_hash TEXT NOT NULL CHECK(length(event_hash)=64),
  occurred_at_ms INTEGER NOT NULL CHECK(occurred_at_ms>=0),
  UNIQUE(grant_id,revision)
);
CREATE INDEX IF NOT EXISTS idx_omnipilot_audit_grant_revision
  ON omnipilot_subject_grant_audit(grant_id,revision);

-- All events must correspond to the CURRENT grant state, and are written
-- automatically by the grant-table triggers. Direct log injection is denied.
CREATE TRIGGER IF NOT EXISTS omnipilot_reject_direct_audit_event
BEFORE INSERT ON omnipilot_subject_grant_audit
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM omnipilot_subject_grants g
    WHERE g.grant_id=NEW.grant_id AND g.revision=NEW.revision
      AND g.subject_key=NEW.subject_key
      AND g.audit_head=NEW.event_hash
      AND g.last_event_id=NEW.event_id
      AND g.last_event_type=NEW.event_type
      AND g.last_event_actor_key=NEW.actor_key
      AND g.last_event_target_digest=NEW.target_digest
      AND g.last_event_terms_digest=NEW.terms_digest
      AND g.last_event_previous_hash=NEW.previous_hash
      AND g.updated_at_ms=NEW.occurred_at_ms
  ) THEN RAISE(ABORT,'AUDIT_EVENT_NOT_BOUND_TO_GRANT') END;
END;

CREATE TRIGGER IF NOT EXISTS omnipilot_reject_audit_rewrite
BEFORE UPDATE ON omnipilot_subject_grant_audit
BEGIN SELECT RAISE(ABORT,'AUDIT_IS_APPEND_ONLY'); END;

CREATE TRIGGER IF NOT EXISTS omnipilot_reject_audit_delete
BEFORE DELETE ON omnipilot_subject_grant_audit
BEGIN SELECT RAISE(ABORT,'AUDIT_IS_APPEND_ONLY'); END;

CREATE TRIGGER IF NOT EXISTS omnipilot_reject_invalid_grant_insert
BEFORE INSERT ON omnipilot_subject_grants
BEGIN
  SELECT CASE WHEN NEW.status!='PENDING' OR NEW.revision!=1
    OR NEW.approved_by_key IS NOT NULL OR NEW.requested_by_key!=NEW.subject_key
    OR NEW.last_event_type!='REQUESTED'
    OR NEW.last_event_actor_key!=NEW.requested_by_key
    OR NEW.last_event_previous_hash!='0000000000000000000000000000000000000000000000000000000000000000'
    OR NEW.updated_at_ms!=NEW.created_at_ms
    THEN RAISE(ABORT,'INVALID_INITIAL_SUBJECT_GRANT') END;
END;

CREATE TRIGGER IF NOT EXISTS omnipilot_audit_insert_grant
AFTER INSERT ON omnipilot_subject_grants
BEGIN
  INSERT INTO omnipilot_subject_grant_audit
    (event_id,grant_id,revision,event_type,actor_key,subject_key,
     target_digest,terms_digest,previous_hash,event_hash,occurred_at_ms)
  VALUES
    (NEW.last_event_id,NEW.grant_id,NEW.revision,NEW.last_event_type,
     NEW.last_event_actor_key,NEW.subject_key,NEW.last_event_target_digest,
     NEW.last_event_terms_digest,NEW.last_event_previous_hash,NEW.audit_head,
     NEW.updated_at_ms);
END;

CREATE TRIGGER IF NOT EXISTS omnipilot_reject_invalid_grant_transition
BEFORE UPDATE ON omnipilot_subject_grants
BEGIN
  SELECT CASE WHEN
    NEW.grant_id!=OLD.grant_id OR NEW.subject_key!=OLD.subject_key
    OR NEW.requested_by_key!=OLD.requested_by_key
    OR NEW.origin!=OLD.origin OR NEW.path_prefix!=OLD.path_prefix
    OR NEW.mode!=OLD.mode OR NEW.expires_at_ms!=OLD.expires_at_ms
    OR NEW.max_actions!=OLD.max_actions OR NEW.created_at_ms!=OLD.created_at_ms
    OR NEW.revision!=OLD.revision+1
    OR NEW.last_event_previous_hash!=OLD.audit_head
    OR NEW.updated_at_ms<OLD.updated_at_ms
    OR (OLD.status='PENDING' AND NEW.status NOT IN ('ACTIVE','DENIED','REVOKED'))
    OR (OLD.status='ACTIVE' AND NEW.status!='REVOKED')
    OR OLD.status IN ('DENIED','REVOKED')
    OR (NEW.status='ACTIVE' AND
        (NEW.updated_at_ms>=NEW.expires_at_ms
         OR NEW.approved_by_key IS NULL
         OR NEW.approved_by_key=NEW.subject_key
         OR NEW.last_event_actor_key!=NEW.approved_by_key
         OR NEW.last_event_type!='APPROVED'))
    OR (NEW.status='DENIED' AND
        (NEW.approved_by_key IS NOT NULL OR NEW.last_event_type!='DENIED'
         OR NEW.last_event_actor_key=NEW.subject_key))
    OR (NEW.status='REVOKED' AND
        (NEW.approved_by_key IS NOT OLD.approved_by_key
         OR NEW.last_event_type!='REVOKED'))
    THEN RAISE(ABORT,'INVALID_GRANT_REVISION_OR_TRANSITION') END;
END;

CREATE TRIGGER IF NOT EXISTS omnipilot_audit_update_grant
AFTER UPDATE ON omnipilot_subject_grants
BEGIN
  INSERT INTO omnipilot_subject_grant_audit
    (event_id,grant_id,revision,event_type,actor_key,subject_key,
     target_digest,terms_digest,previous_hash,event_hash,occurred_at_ms)
  VALUES
    (NEW.last_event_id,NEW.grant_id,NEW.revision,NEW.last_event_type,
     NEW.last_event_actor_key,NEW.subject_key,NEW.last_event_target_digest,
     NEW.last_event_terms_digest,NEW.last_event_previous_hash,NEW.audit_head,
     NEW.updated_at_ms);
END;

CREATE TRIGGER IF NOT EXISTS omnipilot_reject_grant_delete
BEFORE DELETE ON omnipilot_subject_grants
BEGIN SELECT RAISE(ABORT,'GRANTS_CANNOT_BE_DELETED'); END;

-- No existing production or Finance table is altered.
