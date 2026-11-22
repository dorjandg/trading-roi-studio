import test from "node:test";
import assert from "node:assert/strict";
import {validateDirectConfirmation} from "../src/direct-confirmation.js";
const preview={ok:true,previewOnly:true,revision:19,transaction_id:"11111111-1111-4111-8111-111111111111",field:"description",before:"Old",after:"New"};
const confirmation={confirmed:true,transaction_id:preview.transaction_id,field:preview.field,expected_revision:19,expected_value:"Old",new_value:"New"};
test("accepts an exact explicit confirmation",()=>assert.equal(validateDirectConfirmation(preview,confirmation).ok,true));
test("rejects a generic approval boolean and unconfirmed request",()=>{
 assert.equal(validateDirectConfirmation(preview,{confirmed:true}).code,"EXACT_CONFIRMATION_REQUIRED");
 assert.equal(validateDirectConfirmation(preview,{...confirmation,confirmed:false}).ok,false);
});
test("rejects altered value, transaction, field, and stale revision",()=>{
 for(const patch of [{new_value:"Different"},{expected_value:"Wrong"},{expected_revision:18},{field:"amount"},{transaction_id:"other"}])
  assert.equal(validateDirectConfirmation(preview,{...confirmation,...patch}).ok,false);
});
test("rejects missing or untrusted preview",()=>{
 assert.equal(validateDirectConfirmation({...preview,previewOnly:false},confirmation).ok,false);
 assert.equal(validateDirectConfirmation(null,confirmation).ok,false);
});
