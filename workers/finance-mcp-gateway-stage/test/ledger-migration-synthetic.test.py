"""Synthetic-only ledger migration proof. Never connects to production D1."""
import hashlib
import json
import sqlite3
import unittest
import uuid

COUNT = 1608
WORKSPACE = "isolated-workspace"
USER = "isolated-user"


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def fixture():
    transactions = []
    for i in range(COUNT):
        transactions.append({
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "isolated-transaction-" + str(i))),
            "amount": round((i % 123) + 0.17, 2),
            "currency": ("EUR", "USD", "AED")[i % 3],
            "date": "2026-11-%02d" % (1 + i % 22),
            "type": ("Expense", "Income", "Transfer")[i % 3],
            "category": "Synthetic category",
            "provider": "Synthetic provider",
            "description": "Synthetic entry %04d " % i + "x" * 610,
            "reportingHold": bool(i % 7 == 0),
            "source": {"provider": "synthetic", "event_id": "event-%04d" % i},
            "unknown_metadata": {"nested": [i, "keep", {"value": None}]},
        })
    return {"format": "finance-hub-backup", "version": 2, "transactions": transactions,
            "propAccounts": [], "propEvents": [], "propAudit": [],
            "subscriptions": [], "invoices": []}


class SyntheticLedgerTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript("""
            CREATE TABLE ledger_revision(
                workspace_id TEXT NOT NULL, user_id TEXT NOT NULL,
                revision INTEGER NOT NULL, PRIMARY KEY(workspace_id,user_id));
            CREATE TABLE ledger_transactions(
                workspace_id TEXT NOT NULL, user_id TEXT NOT NULL,
                transaction_id TEXT NOT NULL, payload TEXT NOT NULL,
                PRIMARY KEY(workspace_id,user_id,transaction_id));
            CREATE TABLE ledger_events(
                workspace_id TEXT NOT NULL, user_id TEXT NOT NULL,
                source_provider TEXT NOT NULL, source_event_id TEXT NOT NULL,
                transaction_id TEXT NOT NULL,
                UNIQUE(workspace_id,user_id,source_provider,source_event_id));
            CREATE TABLE ledger_audit(
                audit_id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL, transaction_id TEXT NOT NULL,
                old_revision INTEGER NOT NULL, new_revision INTEGER NOT NULL);
        """)
        self.original = fixture()
        self.assertGreater(len(canonical(self.original).encode("utf-8")), 1048576)

    def migrate(self):
        self.db.execute("INSERT INTO ledger_revision VALUES(?,?,?)", (WORKSPACE, USER, 19))
        with self.db:
            for t in self.original["transactions"]:
                self.db.execute("INSERT INTO ledger_transactions VALUES(?,?,?,?)",
                                (WORKSPACE, USER, t["id"], canonical(t)))
                self.db.execute("INSERT INTO ledger_events VALUES(?,?,?,?,?)",
                                (WORKSPACE, USER, t["source"]["provider"],
                                 t["source"]["event_id"], t["id"]))

    def exported(self):
        rows = self.db.execute(
            "SELECT payload FROM ledger_transactions WHERE workspace_id=? AND user_id=? ORDER BY transaction_id",
            (WORKSPACE, USER)).fetchall()
        result = {**self.original, "transactions": [json.loads(row[0]) for row in rows]}
        return result

    def test_lossless_round_trip_over_one_mib(self):
        self.migrate()
        result = self.exported()
        self.assertEqual(len(result["transactions"]), COUNT)
        self.assertEqual(
            digest(sorted(self.original["transactions"], key=lambda x: x["id"])),
            digest(result["transactions"]))
        self.assertEqual(set(result), set(self.original))

    def test_stale_revision_rolls_back_without_audit(self):
        self.migrate()
        before = digest(self.exported())
        target = self.original["transactions"][0]
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                updated = self.db.execute(
                    "UPDATE ledger_revision SET revision=revision+1 WHERE workspace_id=? AND user_id=? AND revision=?",
                    (WORKSPACE, USER, 18))
                if updated.rowcount != 1:
                    raise sqlite3.IntegrityError("stale revision")
                self.db.execute("UPDATE ledger_transactions SET payload=? WHERE workspace_id=? AND user_id=? AND transaction_id=?",
                                ('{}', WORKSPACE, USER, target["id"]))
        self.assertEqual(digest(self.exported()), before)
        self.assertEqual(self.db.execute("SELECT revision FROM ledger_revision").fetchone()[0], 19)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM ledger_audit").fetchone()[0], 0)

    def test_duplicate_source_event_rejected_without_data_loss(self):
        self.migrate()
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                self.db.execute("INSERT INTO ledger_events VALUES(?,?,?,?,?)",
                                (WORKSPACE, USER, "synthetic", "event-0000", "different-id"))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM ledger_events").fetchone()[0], COUNT)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM ledger_transactions").fetchone()[0], COUNT)

    def test_owner_scope_isolation(self):
        self.migrate()
        other = self.db.execute(
            "SELECT COUNT(*) FROM ledger_transactions WHERE workspace_id=? AND user_id=?",
            (WORKSPACE, "another-user")).fetchone()[0]
        self.assertEqual(other, 0)


if __name__ == "__main__":
    unittest.main()
