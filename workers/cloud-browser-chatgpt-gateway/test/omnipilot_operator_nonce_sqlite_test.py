"""In-memory SQLite validation of isolated operator nonce replay protection."""
import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "migrations" / "0002_omnipilot_operator_nonces.sql"
NOW = 1764000000000
DIGEST = "d" * 64
OPERATOR = "a" * 64
SESSION = "b" * 64
OTHER = "c" * 64

INSERT = (
    "INSERT INTO omnipilot_operator_nonces"
    "(nonce_digest,operator_key,session_key,issued_at_ms,expires_at_ms,status)"
    " VALUES (?,?,?,?,?,?)"
)
CONSUME = (
    "UPDATE omnipilot_operator_nonces SET status='USED',consumed_at_ms=?"
    " WHERE nonce_digest=? AND operator_key=? AND session_key=?"
    " AND status='ISSUED' AND issued_at_ms<=? AND expires_at_ms>?"
    " RETURNING nonce_digest"
)


class IsolatedOperatorNonceDatabaseTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript(SCHEMA.read_text())

    def tearDown(self):
        self.db.close()

    def issue(self, digest=DIGEST, operator=OPERATOR, session=SESSION):
        self.db.execute(INSERT,
                        (digest, operator, session, NOW, NOW + 300000, "ISSUED"))

    def consume(self, now=NOW + 60000, digest=DIGEST,
                operator=OPERATOR, session=SESSION):
        return self.db.execute(CONSUME,
                               (now, digest, operator, session, now, now)).fetchone()

    def test_atomic_consumption_is_single_use(self):
        self.issue()
        self.assertEqual(self.consume(), (DIGEST,))
        self.assertIsNone(self.consume())
        self.assertEqual(self.db.execute(
            "SELECT status,consumed_at_ms FROM omnipilot_operator_nonces"
        ).fetchone(), ("USED", NOW + 60000))

    def test_wrong_subject_or_session_or_nonce_cannot_consume(self):
        self.issue()
        self.assertIsNone(self.consume(operator=OTHER))
        self.assertIsNone(self.consume(session=OTHER))
        self.assertIsNone(self.consume(digest=OTHER))
        self.assertEqual(self.consume(), (DIGEST,))

    def test_expiry_is_strict_and_future_issuance_is_refused(self):
        self.issue()
        self.assertIsNone(self.consume(now=NOW - 1))
        self.assertIsNone(self.consume(now=NOW + 300000))
        self.assertEqual(self.consume(now=NOW + 299999), (DIGEST,))

    def test_no_reuse_of_nonce_digest(self):
        self.issue()
        with self.assertRaises(sqlite3.IntegrityError):
            self.issue()
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM omnipilot_operator_nonces").fetchone()[0], 1)

    def test_immutable_fields_and_used_state_cannot_be_rewritten(self):
        self.issue()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE omnipilot_operator_nonces SET operator_key=?",
                            (OTHER,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE omnipilot_operator_nonces SET status='USED',"
                            "consumed_at_ms=?", (NOW + 400000,))
        self.assertEqual(self.consume(), (DIGEST,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE omnipilot_operator_nonces SET status='ISSUED',"
                            "consumed_at_ms=NULL")
        self.assertIsNone(self.consume())

    def test_no_plaintext_nonce_or_google_identity_columns(self):
        cols = [row[1] for row in self.db.execute(
            "PRAGMA table_info(omnipilot_operator_nonces)"
        )]
        self.assertEqual(cols, [
            "nonce_digest", "operator_key", "session_key",
            "issued_at_ms", "expires_at_ms", "consumed_at_ms", "status"
        ])
        for forbidden in ["nonce_value", "email", "password", "oauth_token",
                          "google_subject", "id_token"]:
            self.assertNotIn(forbidden, cols)


if __name__ == "__main__":
    unittest.main()
