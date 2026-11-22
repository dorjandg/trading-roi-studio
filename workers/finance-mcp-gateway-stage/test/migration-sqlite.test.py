"""Validate the real proposed migration against an isolated in-memory SQLite database.
Never connects to Cloudflare D1 or any Finance Hub account.
"""
import pathlib
import sqlite3
import unittest

MIGRATION=pathlib.Path(__file__).resolve().parents[1]/"migrations"/"0001_controlled_writes.sql"

class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))
    def test_tables_and_indexes_created(self):
        tables={r[0] for r in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertTrue({"finance_mcp_change_approvals","finance_mcp_snapshot_backups","finance_mcp_write_audit"}.issubset(tables))
        self.assertNotIn("finance_snapshots",tables)
    def test_approval_restricts_fields_and_empty_values(self):
        row=("a1","w1","u1","t1","category",19,"Old","New","2026-11-22T10:00:00Z","2026-11-22T10:05:00Z",None,"digest1")
        self.db.execute("INSERT INTO finance_mcp_change_approvals VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",row)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO finance_mcp_change_approvals VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",("a2",*row[1:4],"amount",*row[5:-1],"digest2"))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO finance_mcp_change_approvals VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",("a3",*row[1:7],"",*row[8:-1],"digest3"))
    def test_backup_and_audit_require_existing_approval(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO finance_mcp_snapshot_backups VALUES (?,?,?,?,?,?,?)",("b1","missing","w1","u1",19,"old","now"))
    def test_reapplying_migration_is_idempotent(self):
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))
        count=self.db.execute("SELECT count(*) FROM sqlite_master WHERE name LIKE 'finance_mcp_%' AND type='table'").fetchone()[0]
        self.assertEqual(count,3)

if __name__=="__main__":unittest.main()
