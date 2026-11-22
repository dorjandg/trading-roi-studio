"""Isolated SQLite transaction tests. Never connects to Cloudflare D1."""
import sqlite3
import unittest

SCHEMA = """
CREATE TABLE finance_snapshots(workspace_id TEXT,user_id TEXT,revision INTEGER,payload TEXT,updated_at TEXT,PRIMARY KEY(workspace_id,user_id));
CREATE TABLE finance_mcp_change_approvals(approval_id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,transaction_id TEXT,field_name TEXT,expected_revision INTEGER,old_value TEXT,new_value TEXT,approved_at TEXT,expires_at TEXT,consumed_at TEXT);
CREATE TABLE finance_mcp_snapshot_backups(backup_id TEXT PRIMARY KEY,approval_id TEXT UNIQUE,workspace_id TEXT,user_id TEXT,revision INTEGER,snapshot_payload TEXT,created_at TEXT);
CREATE TABLE finance_mcp_write_audit(audit_id TEXT PRIMARY KEY,approval_id TEXT UNIQUE,backup_id TEXT UNIQUE,workspace_id TEXT,user_id TEXT,transaction_id TEXT,field_name TEXT,old_value TEXT,new_value TEXT,old_revision INTEGER,new_revision INTEGER,created_at TEXT);
"""
NOW="2026-11-22T10:01:00Z"

def setup():
    db=sqlite3.connect(":memory:")
    db.executescript(SCHEMA)
    db.execute("INSERT INTO finance_snapshots VALUES ('w1','u1',19,'old','before')")
    db.execute("INSERT INTO finance_mcp_change_approvals VALUES ('a1','w1','u1','t1','category',19,'A','B','2026-11-22T10:00:00Z','2026-11-22T10:05:00Z',NULL)")
    db.commit()
    return db

def atomic_write(db, *, approval="a1", old="old", backup="b1", audit="log1", fail_after=None):
    try:
        db.execute("BEGIN IMMEDIATE")
        cur=db.execute("""UPDATE finance_mcp_change_approvals SET consumed_at=? WHERE approval_id=?
          AND workspace_id='w1' AND user_id='u1' AND consumed_at IS NULL
          AND approved_at<=? AND expires_at>? AND expected_revision=19
          AND transaction_id='t1' AND field_name='category' AND old_value='A' AND new_value='B'""",
          (NOW,approval,NOW,NOW))
        if cur.rowcount!=1: raise ValueError("approval rejected")
        if fail_after=="approval": raise ValueError("injected failure")
        db.execute("INSERT INTO finance_mcp_snapshot_backups VALUES (?,?,?,?,?,?,?)",
                   (backup,approval,"w1","u1",19,old,NOW))
        if fail_after=="backup": raise ValueError("injected failure")
        cur=db.execute("""UPDATE finance_snapshots SET payload='new',revision=revision+1,updated_at=?
           WHERE workspace_id='w1' AND user_id='u1' AND revision=19 AND payload=?""",(NOW,old))
        if cur.rowcount!=1: raise ValueError("revision conflict")
        if fail_after=="snapshot": raise ValueError("injected failure")
        db.execute("INSERT INTO finance_mcp_write_audit VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                   (audit,approval,backup,"w1","u1","t1","category","A","B",19,20,NOW))
        if fail_after=="audit": raise ValueError("injected failure")
        db.commit()
    except Exception:
        db.rollback()
        raise

class AtomicWriteTests(unittest.TestCase):
    def assert_unchanged(self,db):
        self.assertEqual(db.execute("SELECT revision,payload FROM finance_snapshots").fetchone(),(19,"old"))
        self.assertIsNone(db.execute("SELECT consumed_at FROM finance_mcp_change_approvals").fetchone()[0])
        self.assertEqual(db.execute("SELECT count(*) FROM finance_mcp_snapshot_backups").fetchone()[0],0)
        self.assertEqual(db.execute("SELECT count(*) FROM finance_mcp_write_audit").fetchone()[0],0)
    def test_success_and_replay(self):
        db=setup();atomic_write(db)
        self.assertEqual(db.execute("SELECT revision,payload FROM finance_snapshots").fetchone(),(20,"new"))
        self.assertEqual(db.execute("SELECT snapshot_payload FROM finance_mcp_snapshot_backups").fetchone()[0],"old")
        self.assertEqual(db.execute("SELECT count(*) FROM finance_mcp_write_audit").fetchone()[0],1)
        with self.assertRaises(ValueError): atomic_write(db,backup="b2",audit="log2")
        self.assertEqual(db.execute("SELECT count(*) FROM finance_mcp_write_audit").fetchone()[0],1)
    def test_rollback_at_every_stage(self):
        for stage in ["approval","backup","snapshot","audit"]:
            with self.subTest(stage=stage):
                db=setup()
                with self.assertRaises(ValueError):atomic_write(db,fail_after=stage)
                self.assert_unchanged(db)
    def test_payload_conflict_rolls_back(self):
        db=setup()
        with self.assertRaises(ValueError):atomic_write(db,old="stale")
        self.assert_unchanged(db)
    def test_duplicate_backup_rolls_back(self):
        db=setup()
        db.execute("INSERT INTO finance_mcp_snapshot_backups VALUES ('b1','other','w1','u1',1,'old','before')")
        db.commit()
        with self.assertRaises(sqlite3.IntegrityError):atomic_write(db)
        self.assertEqual(db.execute("SELECT revision,payload FROM finance_snapshots").fetchone(),(19,"old"))
        self.assertIsNone(db.execute("SELECT consumed_at FROM finance_mcp_change_approvals").fetchone()[0])
        self.assertEqual(db.execute("SELECT count(*) FROM finance_mcp_write_audit").fetchone()[0],0)

if __name__=="__main__":unittest.main()
