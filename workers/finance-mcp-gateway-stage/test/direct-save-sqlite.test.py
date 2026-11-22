"""Exercise the direct correction SQL transaction without any production database."""
import pathlib,sqlite3,unittest
SCHEMA=pathlib.Path(__file__).resolve().parents[1]/"migrations"/"0002_direct_corrections.sql"
class DirectSaveTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(":memory:")
  self.db.execute("PRAGMA foreign_keys=ON")
  self.db.executescript("CREATE TABLE finance_snapshots(workspace_id TEXT,user_id TEXT,revision INTEGER,payload TEXT,PRIMARY KEY(workspace_id,user_id));")
  self.db.executescript(SCHEMA.read_text())
  self.db.execute("INSERT INTO finance_snapshots VALUES('w','u',19,'old')")
  self.db.commit()
 def save(self,expected=19,fail_audit=False):
  with self.db:
   self.db.execute("INSERT INTO finance_mcp_direct_backups VALUES('b','w','u',?, 'old','now')",(expected,))
   self.db.execute("UPDATE finance_snapshots SET payload='new',revision=revision+1 WHERE workspace_id='w' AND user_id='u' AND revision=?",(expected,))
   self.db.execute("""INSERT INTO finance_mcp_direct_audit VALUES('a','b','w','u','tx','description','old','new',?,
    (SELECT CASE WHEN changes()=1 THEN revision ELSE NULL END FROM finance_snapshots WHERE workspace_id=? AND user_id=? AND revision=?),?)""",
    (expected,'w','u',expected+1,'now' if not fail_audit else None))
 def test_success(self):
  self.save()
  self.assertEqual(self.db.execute("SELECT revision,payload FROM finance_snapshots").fetchone(),(20,"new"))
  self.assertEqual(self.db.execute("SELECT count(*) FROM finance_mcp_direct_backups").fetchone()[0],1)
  self.assertEqual(self.db.execute("SELECT count(*) FROM finance_mcp_direct_audit").fetchone()[0],1)
 def test_stale_revision_rolls_back_backup_and_audit(self):
  with self.assertRaises(sqlite3.IntegrityError):self.save(18)
  self.assertEqual(self.db.execute("SELECT revision,payload FROM finance_snapshots").fetchone(),(19,"old"))
  for t in ("finance_mcp_direct_backups","finance_mcp_direct_audit"):
   self.assertEqual(self.db.execute("SELECT count(*) FROM "+t).fetchone()[0],0)
 def test_audit_failure_rolls_back_snapshot_and_backup(self):
  with self.assertRaises(sqlite3.IntegrityError):self.save(19,True)
  self.assertEqual(self.db.execute("SELECT revision,payload FROM finance_snapshots").fetchone(),(19,"old"))
  self.assertEqual(self.db.execute("SELECT count(*) FROM finance_mcp_direct_backups").fetchone()[0],0)
 def test_migration_replay(self):
  self.db.executescript(SCHEMA.read_text())
if __name__=="__main__":unittest.main()
