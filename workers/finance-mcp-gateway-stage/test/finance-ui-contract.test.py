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
 def test_owner_admin_required_for_save(self):
  save=API.split('resource")==="transaction-change-save"',1)[1]
  self.assertIn('["owner","admin"].includes(member.role)',save)
  self.assertIn('Owner or admin approval required',save)
 def test_confirm_and_revision_are_required(self):
  self.assertIn("a.confirmed!==true",API)
  self.assertIn("a.expected_revision",API)
  self.assertIn('revision=revision+1',API)
  self.assertIn('finance_mcp_direct_backups',API)
  self.assertIn('finance_mcp_direct_audit',API)
 def test_signed_short_lived_exact_change_ticket(self):
  self.assertIn("FINANCE_CORRECTION_SIGNING_KEY",API)
  self.assertIn("crypto.subtle.sign",API)
  self.assertIn("crypto.subtle.verify",API)
  self.assertIn("Date.now()+5*60*1000",API)
  self.assertIn("verifyCorrectionTicket(env.FINANCE_CORRECTION_SIGNING_KEY,a.approval_ticket",API)
  self.assertIn("approval_ticket:result.approval_ticket",PAGE)
  self.assertIn("preview again",API)
 def test_snapshot_put_utf8_byte_guard(self):
  self.assertIn('enc.encode(raw).length>1024*1024',API)
  self.assertIn('enc.encode(payload).length>1024*1024',API)
  self.assertIn('new TextEncoder().encode(nextPayload).length>1024*1024',API)
  self.assertNotIn('if(raw.length>1024*1024)',API)
  self.assertNotIn('if(payload.length>1024*1024)',API)
 def test_page_never_offers_financial_fields(self):
  for field in ("amount","currency","date","type","reportingHold"):
   self.assertNotIn('<option value="'+field+'">',PAGE)
 def test_save_requires_ui_confirmation(self):
  self.assertIn("if(!confirmBox.checked||!proposal)return",PAGE)
  self.assertIn("confirmed:true",PAGE)
if __name__=="__main__":unittest.main()
