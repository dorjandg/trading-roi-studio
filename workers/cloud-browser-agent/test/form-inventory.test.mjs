import test from "node:test";
import assert from "node:assert/strict";
import {sanitizeFormInventory,prepareWriteApproval} from "../src/form-inventory.mjs";
test("inventory excludes sensitive form inputs, all values and file uploads",()=>{
 const original=[{method:"POST",action:"https://evil.test",fields:[
  {type:"text",label:"Property title",name:"title",value:"Secret entered value"},
  {type:"password",label:"Password",name:"password",value:"hunter2"},
  {type:"hidden",label:"Session",name:"csrf",value:"csrf-token"},
  {type:"file",label:"Upload",name:"photo",value:"private.jpeg"},
  {type:"text",label:"API key",name:"key",value:"api-secret"},
  {type:"textarea",label:"Description",name:"description",value:"private description"},
  {type:"select-one",label:"Category",name:"category",options:[{value:"hidden"}]},
  {type:"email",label:"Contact",name:"email",autocomplete:"email",value:"user@example.com"}
 ]}];
 const result=sanitizeFormInventory(original);
 assert.equal(result.formCount,1);
 assert.equal(result.forms[0].method,"NON_GET");
 assert.deepEqual(result.forms[0].fields.map(f=>f.label),["Property title","Description","Category","Contact"]);
 for(const secret of ["hunter2","csrf-token","private.jpeg","api-secret","private description","user@example.com","Secret entered value","https://evil.test"])assert.equal(JSON.stringify(result).includes(secret),false);
 assert.equal(result.valuesCollected,false);
 assert.equal(result.submissionsAllowed,false);
 assert.equal(result.uploadsAllowed,false);
});
test("inventory limits field counts and normalizes output",()=>{
 const raw=Array.from({length:20},()=>({method:"GET",fields:Array.from({length:200},()=>({type:"text",label:"A".repeat(500)}))}));
 const result=sanitizeFormInventory(raw);
 assert.equal(result.formCount,12);
 assert.equal(result.forms[0].fields.length,80);
 assert.equal(result.forms[0].fields[0].label.length,80);
});
test("denies writes, including attempts to preapprove them",()=>{
 assert.deepEqual(prepareWriteApproval({approved:true,operation:"upload",url:"https://fin-kac.pages.dev"}),{
  approved:false,enabled:false,reason:"Write operations are disabled in Phase 2 staging"
 });
});
