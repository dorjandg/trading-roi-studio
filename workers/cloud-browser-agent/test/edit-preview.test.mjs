import test from "node:test";
import assert from "node:assert/strict";
import {validateEditPreviewRequest,buildEditPreview} from "../src/edit-preview.mjs";
const origins="https://trading-roi-studio.pages.dev";
const valid={url:"https://trading-roi-studio.pages.dev/labs",formIndex:1,fieldLabel:"Description",proposedText:"New property description"};
const inventory=[{method:"POST",fields:[{type:"textarea",label:"Description",name:"description",required:false,disabled:false,readonly:false},{type:"password",label:"Password",name:"password"}]}];
test("creates preview with no execution, approval or current value access",()=>{
 const args=validateEditPreviewRequest(valid,origins);
 const v=buildEditPreview(args,inventory);
 assert.equal(v.previewOnly,true);assert.equal(v.executionAllowed,false);
 assert.equal(v.approvalRequired,true);assert.equal(v.approvalState,"NOT_REQUESTED");
 assert.equal(v.currentValue,"NOT_READ");assert.equal(v.persisted,false);
 assert.equal(v.proposedText,valid.proposedText);
});
test("rejects unexpected actions, sensitive data and external origins",()=>{
 for(const delta of [{click:true},{approved:true},{save:true},{submit:true},{file:"test.png"}]){
  assert.throws(()=>validateEditPreviewRequest({...valid,...delta},origins));
 }
 for(const bad of [
  {...valid,url:"https://evil.test"},
  {...valid,url:"https://trading-roi-studio.pages.dev/edit?publish=true"},
  {...valid,fieldLabel:"Password"},
  {...valid,proposedText:"new api token"},
  {...valid,proposedText:""},
  {...valid,proposedText:"A".repeat(1201)},
  {...valid,formIndex:0}
 ])assert.throws(()=>validateEditPreviewRequest(bad,origins));
});
test("rejects ambiguous, invisible, readonly, and non-text fields",()=>{
 const args=validateEditPreviewRequest(valid,origins);
 assert.throws(()=>buildEditPreview(args,[]));
 assert.throws(()=>buildEditPreview(args,[{method:"POST",fields:[...inventory[0].fields,inventory[0].fields[0]]}]));
 assert.throws(()=>buildEditPreview(args,[{method:"POST",fields:[{...inventory[0].fields[0],readonly:true}]}]));
 assert.throws(()=>buildEditPreview(args,[{method:"POST",fields:[{...inventory[0].fields[0],type:"select-one"}]}]));
});
