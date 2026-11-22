// Stage 4.2: deterministic, non-authorizing approval/audit receipts.
// PREVIEW ONLY. This module does not persist audit records or issue authorization.
// Durable audit storage and approval execution MUST be implemented independently.
const json = value => JSON.stringify(value);
const hex = bytes => Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
async function digest(value) {
  return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
}
export async function buildPreviewAuditReceipt(plan) {
  if(!plan || plan.previewOnly!==true || plan.executionAllowed!==false ||
     plan.approvalState!=="NOT_REQUESTED" || plan.operation!=="set_text" ||
     typeof plan.proposedText!=="string")throw new Error("Only non-executable edit previews qualify");
  // Never put proposed text in an audit event; only a cryptographic digest.
  const descriptor = {
    version:1,operation:"set_text",url:plan.url,
    formIndex:plan.formIndex,fieldLabel:plan.fieldLabel,fieldType:plan.fieldType,
    proposedTextSha256:await digest(plan.proposedText)
  };
  const proposalId = await digest(json(descriptor));
  return {
    proposalId,
    approval:{state:"NOT_REQUESTED",required:true,grantIssued:false,canExecute:false},
    audit:{
      event:"EDIT_PREVIEW_GENERATED",proposalId,
      operation:"set_text",targetOrigin:new URL(plan.url).origin,
      fieldType:plan.fieldType,proposedTextSha256:descriptor.proposedTextSha256,
      valuesLogged:false,credentialsLogged:false,
      durable:false,storage:"NONE",delivery:"RESPONSE_ONLY"
    }
  };
}
export function denyApprovalExecution(request) {
  // Regardless of user input, approvals are never accepted by this staging binary.
  return {
    state:"DENIED",authorized:false,executed:false,
    reason:"Execution is disabled. No approval tokens or write endpoints exist."
  };
}
