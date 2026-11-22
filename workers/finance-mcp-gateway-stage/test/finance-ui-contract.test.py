"""Ensure the Finance Hub confirmation page and API remain wired together safely."""
import pathlib,re,unittest
ROOT=pathlib.Path(__file__).resolve().parents[3]
PAGE=(ROOT/"finance-correction.html").read_text()
API=(ROOT/"functions/api/finance.js").read_text()
class IntegrationContract(unittest.TestCase):
 def test_review_and_save_endpoints_exist(self):
  self.assertIn('resource")==="transaction-change-preview"',API)
  self.assertIn('resource")==="transaction-change-save"',API)
  self.assertIn('api("transaction-change-preview"',PAGE)
  self.assertIn('api("transaction-change-save"',PAGE)
 def test_write_is_off_by_default(self):
  self.assertIn('env.FINANCE_TRANSACTION_CORRECTIONS_ENABLED!=="true"',API)
 def test_confirm_and_revision_are_required(self):
  self.assertIn("a.confirmed!==true",API)
  self.assertIn("a.expected_revision",API)
  self.assertIn('revision=revision+1',API)
  self.assertIn('finance_mcp_direct_backups',API)
  self.assertIn('finance_mcp_direct_audit',API)
 def test_page_never_offers_financial_fields(self):
  for field in ("amount","currency","date","type","reportingHold"):
   self.assertNotIn('<option value="'+field+'">',PAGE)
 def test_save_requires_ui_confirmation(self):
  self.assertIn("if(!confirmBox.checked||!proposal)return",PAGE)
  self.assertIn("confirmed:true",PAGE)
if __name__=="__main__":unittest.main()
