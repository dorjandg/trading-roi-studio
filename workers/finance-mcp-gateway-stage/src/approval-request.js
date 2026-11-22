// Pure approval issuance guards for a trusted Finance Hub UI.
// This module DOES NOT issue tokens or write to a database.
// Caller must verify a fresh Finance Hub authenticated session and explicit
// human confirmation, then atomically persist the returned approval details.
export function prepareApprovalRequest({actor,change,confirmation,nowISO,ttlSeconds=300}) {
  if (!actor?.workspace_id || !actor?.user_id || !actor?.authenticated ||
      actor.authentication_source!=="finance-hub-session")
    return {ok:false,code:"TRUSTED_SESSION_REQUIRED"};
  if (!change?.ok || !Number.isInteger(change.revision) ||
      !change.transaction_id || !["category","provider","description"].includes(change.field))
    return {ok:false,code:"VALIDATED_PREVIEW_REQUIRED"};
  if (!confirmation || confirmation.confirmed!==true ||
      confirmation.transaction_id!==change.transaction_id ||
      confirmation.field!==change.field ||
      confirmation.before!==change.before ||
      confirmation.after!==change.after ||
      confirmation.revision!==change.revision)
    return {ok:false,code:"EXPLICIT_CONFIRMATION_REQUIRED"};
  const ms=Date.parse(nowISO);
  if(!Number.isFinite(ms)||!Number.isInteger(ttlSeconds)||ttlSeconds<30||ttlSeconds>300)
    return {ok:false,code:"INVALID_EXPIRY"};
  return {ok:true,approval:{
    workspace_id:actor.workspace_id,user_id:actor.user_id,
    transaction_id:change.transaction_id,field_name:change.field,
    expected_revision:change.revision,old_value:change.before,
    new_value:change.after,approved_at:new Date(ms).toISOString(),
    expires_at:new Date(ms+ttlSeconds*1000).toISOString()
  },notice:"NOT ISSUED. Trusted application must persist a random single-use approval ID and digest atomically."};
}
