"""Isolated in-memory SQLite tests for OmniPilot's planned D1 grant ledger.

No Cloudflare connections, no files written, no Finance/production databases.
"""
import sqlite3
import pathlib
import unittest

SCHEMA = pathlib.Path(__file__).resolve().parents[1] / "migrations" / "0001_omnipilot_subject_grants.sql"
NOW = 1764000000000
SUBJECT = "a" * 64
OTHER = "b" * 64
OPERATOR = "c" * 64
ZERO = "0" * 64
URL = "https://en.wikipedia.org"


def uuid(n):
    return f"00000000-0000-4000-8000-{n:012x}"


class SubjectGrantsSqliteTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript(SCHEMA.read_text())
        self.cols = (
            "grant_id", "subject_key", "requested_by_key", "approved_by_key",
            "origin", "path_prefix", "mode", "expires_at_ms", "max_actions",
            "status", "revision", "created_at_ms", "updated_at_ms", "audit_head",
            "last_event_id", "last_event_type", "last_event_actor_key",
            "last_event_target_digest", "last_event_terms_digest",
            "last_event_previous_hash"
        )

    def tearDown(self):
        self.db.close()

    def insert(self, grant_number=1, subject=SUBJECT, origin=URL):
        values = [
            uuid(grant_number), subject, subject, None, origin, "/wiki/", "read",
            NOW + 3600000, 0, "PENDING", 1, NOW, NOW,
            "1" * 64, uuid(grant_number + 1000), "REQUESTED", subject,
            "d" * 64, "e" * 64, ZERO
        ]
        self.db.execute(
            f"INSERT INTO omnipilot_subject_grants ({','.join(self.cols)}) "
            f"VALUES ({','.join('?' for _ in values)})", values
        )

    def transition(self, grant=1, *,
                   status="ACTIVE", revision=2, previous="1" * 64,
                   head="2" * 64, event=1101, actor=OPERATOR,
                   approved=OPERATOR, at=NOW+1000, expected=1):
        return self.db.execute(
            """UPDATE omnipilot_subject_grants SET
              status=?,revision=?,updated_at_ms=?,audit_head=?,
              last_event_id=?,last_event_type=?,last_event_actor_key=?,
              last_event_previous_hash=?,approved_by_key=?
              WHERE grant_id=? AND revision=? AND audit_head=? RETURNING revision""",
            (status, revision, at, head, uuid(event),
             {"ACTIVE":"APPROVED","REVOKED":"REVOKED","DENIED":"DENIED"}[status],
             actor, previous, approved, uuid(grant), expected, previous)
        ).fetchone()

    def counts(self):
        return (
            self.db.execute("SELECT COUNT(*) FROM omnipilot_subject_grants").fetchone()[0],
            self.db.execute("SELECT COUNT(*) FROM omnipilot_subject_grant_audit").fetchone()[0],
        )

    def test_initial_audit_is_automatic_and_does_not_store_email_or_tokens(self):
        self.insert()
        self.assertEqual(self.counts(), (1,1))
        rows = self.db.execute("SELECT event_type,actor_key,revision,target_digest,"
                               "terms_digest,previous_hash FROM omnipilot_subject_grant_audit").fetchall()
        self.assertEqual(rows, [("REQUESTED", SUBJECT, 1, "d"*64, "e"*64, ZERO)])
        names = {x[0] for x in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertTrue(all(n.startswith("omnipilot_") for n in names))
        for name in names:
            if name != "omnipilot_subject_grants" and name != "omnipilot_subject_grant_audit":
                self.fail(f"unexpected unrelated table: {name}")
        for name in names:
            columns = [row[1] for row in self.db.execute(
                "PRAGMA table_info(" + name + ")")]
            for forbidden in ("email","password","token","raw_subject","form_value"):
                self.assertFalse(any(forbidden in col.lower() for col in columns))

    def test_approval_and_revocation_are_audited_at_revision_cas_boundaries(self):
        self.insert()
        self.assertEqual(self.transition(), (2,))
        self.assertEqual(self.counts(), (1, 2))
        self.assertIsNone(self.transition())  # stale compare-and-swap must not rewrite or append
        self.assertEqual(self.counts(), (1, 2))
        self.assertEqual(self.transition(status="REVOKED", revision=3,
            previous="2"*64,head="3"*64,event=1102,actor=SUBJECT,
            approved=OPERATOR,at=NOW+2000,expected=2), (3,))
        self.assertEqual(self.counts(), (1, 3))
        self.assertEqual([x[0] for x in self.db.execute(
            "SELECT event_type FROM omnipilot_subject_grant_audit ORDER BY revision")],
            ["REQUESTED","APPROVED","REVOKED"])
        with self.assertRaises(sqlite3.IntegrityError):
            self.transition(status="ACTIVE", revision=4,
                previous="3"*64,head="4"*64,event=1103,expected=3)
        self.assertEqual(self.counts(), (1, 3))

    def test_untrusted_self_approval_and_grant_mutation_are_rejected(self):
        self.insert()
        with self.assertRaises(sqlite3.IntegrityError):
            self.transition(actor=SUBJECT, approved=SUBJECT)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE omnipilot_subject_grants SET origin=? WHERE grant_id=?",
                            ("https://evil.example", uuid(1)))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM omnipilot_subject_grants WHERE grant_id=?", (uuid(1),))
        self.assertEqual(self.counts(), (1, 1))

    def test_append_only_events_block_rewrites_deletes_and_injection(self):
        self.insert()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE omnipilot_subject_grant_audit SET actor_key=?",
                            (OTHER,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM omnipilot_subject_grant_audit")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO omnipilot_subject_grant_audit "
                "(event_id,grant_id,revision,event_type,actor_key,subject_key,"
                "target_digest,terms_digest,previous_hash,event_hash,occurred_at_ms) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (uuid(5000),uuid(1),2,"APPROVED",OPERATOR,SUBJECT,
                 "d"*64,"e"*64,"1"*64,"2"*64,NOW+1000)
            )
        self.assertEqual(self.counts(), (1, 1))

    def test_duplicate_open_grants_blocked_but_new_grant_allowed_after_revoke(self):
        self.insert()
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert(grant_number=2)
        self.insert(grant_number=3,subject=OTHER)
        self.assertEqual(self.counts(), (2,2))
        self.transition(status="REVOKED",revision=2,previous="1"*64,
            head="4"*64,event=1104,actor=SUBJECT,approved=None)
        self.insert(grant_number=4)
        self.assertEqual(self.counts(), (3, 4))

    def test_no_premature_approval_expired_approval_or_revision_skips(self):
        self.insert()
        with self.assertRaises(sqlite3.IntegrityError):
            self.transition(revision=5)
        with self.assertRaises(sqlite3.IntegrityError):
            self.transition(at=NOW+3600000)
        with self.assertRaises(sqlite3.IntegrityError):
            self.transition(status="DENIED",approved=OPERATOR)
        self.assertEqual(self.counts(), (1,1))

    def test_audit_insertion_failure_rolls_back_grant_revision(self):
        self.insert()
        # Reuse an already used audit event ID; trigger aborts the whole UPDATE.
        with self.assertRaises(sqlite3.IntegrityError):
            self.transition(event=1001)
        self.assertEqual(
            self.db.execute("SELECT status,revision,audit_head FROM omnipilot_subject_grants").fetchone(),
            ("PENDING", 1, "1"*64)
        )
        self.assertEqual(self.counts(), (1,1))


if __name__ == "__main__":
    unittest.main()
