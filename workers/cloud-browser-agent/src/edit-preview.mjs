// Stage 4: preflight ONLY. This module never fills, clicks, uploads, submits or saves.
// All plans are ephemeral, unauthorised for execution, and never create approval tokens.
import { validateTarget } from "./policy.mjs";
import { sanitizeFormInventory } from "./form-inventory.mjs";

const forbidden = /password|passcode|secret|token|api.?key|credential|otp|2fa|auth|card|cvv|cvc|iban|bank|account|routing|ssn|tax|passport|identity|wallet|seed|recovery|payment|transfer|withdraw/i;
const allowedTypes = new Set(["text","textarea"]);
const safeField = (v) => typeof v === "string" && v.length > 0 && v.length <= 80 && !forbidden.test(v);
export function validateEditPreviewRequest(args, allowedOrigins) {
  if (!args || typeof args !== "object" || Array.isArray(args) ||
      Object.keys(args).sort().join(",") !== "fieldLabel,formIndex,proposedText,url") {
    throw new Error("Expected url, formIndex, fieldLabel and proposedText only");
  }
  const url = validateTarget(args.url, allowedOrigins);
  if (new URL(url).search) throw new Error("Query parameters are not permitted for edit previews");
  if (!Number.isSafeInteger(args.formIndex) || args.formIndex < 1 || args.formIndex > 12) {
    throw new Error("Invalid form index");
  }
  if (!safeField(args.fieldLabel)) throw new Error("Sensitive or invalid field label");
  if (typeof args.proposedText !== "string" || args.proposedText.length < 1 ||
      args.proposedText.length > 1200 || forbidden.test(args.proposedText)) {
    throw new Error("Proposed text rejected by data policy");
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(args.proposedText)) {
    throw new Error("Control characters are not permitted");
  }
  return { url, formIndex:args.formIndex, fieldLabel:args.fieldLabel, proposedText:args.proposedText };
}
export function buildEditPreview(input, rawInventory) {
  const inventory = sanitizeFormInventory(rawInventory);
  const form = inventory.forms.find(f => f.index === input.formIndex);
  if (!form) throw new Error("Form not found on page");
  const matches = form.fields.filter(f=>f.label === input.fieldLabel &&
    allowedTypes.has(f.type) && f.editable === true);
  if(matches.length!==1)throw new Error("Editable field label must match exactly once");
  const field=matches[0];
  return {
    operation:"set_text",url:input.url,formIndex:input.formIndex,fieldLabel:field.label,
    fieldType:field.type,proposedText:input.proposedText,
    currentValue:"NOT_READ",
    previewOnly:true,executionAllowed:false,approvalRequired:true,
    approvalState:"NOT_REQUESTED",persisted:false,
    note:"No current field value was read. This is a proposal only; no change has been made."
  };
}
