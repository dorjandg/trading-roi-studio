// Validates a confirmation made inside the authenticated Finance Hub UI.
// It is not an authorization token; the API must independently verify the
// current Cloudflare Access session, revision, and old transaction value.
export function validateDirectConfirmation(preview,confirmation) {
 if(!preview?.ok||preview.previewOnly!==true||!Number.isSafeInteger(preview.revision)||
    !["category","provider","description"].includes(preview.field))
   return {ok:false,code:"VALID_PREVIEW_REQUIRED"};
 if(!confirmation||confirmation.confirmed!==true||
    confirmation.transaction_id!==preview.transaction_id||
    confirmation.field!==preview.field||
    confirmation.expected_revision!==preview.revision||
    confirmation.expected_value!==preview.before||
    confirmation.new_value!==preview.after)
   return {ok:false,code:"EXACT_CONFIRMATION_REQUIRED"};
 return {ok:true,transaction_id:preview.transaction_id,field:preview.field,
         expected_revision:preview.revision,expected_value:preview.before,new_value:preview.after};
}
