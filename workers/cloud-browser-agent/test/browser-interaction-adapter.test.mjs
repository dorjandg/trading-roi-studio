import test from "node:test";
import assert from "node:assert/strict";
import {prepareBrowserInteraction,REAL_BROWSER_EXECUTION_ENABLED} from "../simulation/browser-interaction-adapter.mjs";
const approval={approved:true,scope:"isolated-browser-test"};
function page(meta, count=1) {
 const calls={click:0,fill:0};
 return {calls,getByTestId(){return {count:async()=>count,evaluate:async()=>meta,click:async()=>{calls.click++},fill:async()=>{calls.fill++}}}};
}
const button={tag:"button",type:"button",formAssociated:false,disabled:false,editable:true,contentEditable:false,sensitive:false,action:""};
const input={...button,tag:"input",type:"search"};
test("browser execution is hard-disabled",()=>assert.equal(REAL_BROWSER_EXECUTION_ENABLED,false));
test("approved inert button is inspected but never clicked",async()=>{
 const p=page(button);const result=await prepareBrowserInteraction(p,{kind:"click",testId:"open-menu"},approval);
 assert.equal(result.readyForReview,true);assert.equal(result.executed,false);assert.equal(result.executionAllowed,false);
 assert.deepEqual(p.calls,{click:0,fill:0});
});
test("approved search field is inspected but never filled",async()=>{
 const p=page(input);await prepareBrowserInteraction(p,{kind:"fill",testId:"search-input",value:"gold"},approval);
 assert.deepEqual(p.calls,{click:0,fill:0});
});
test("rejects missing approval, ambiguous elements, and form-associated controls",async()=>{
 for(const a of [null,{}, {approved:false,scope:"isolated-browser-test"},{approved:true,scope:"production"}])
  await assert.rejects(prepareBrowserInteraction(page(button),{kind:"click",testId:"open-menu"},a));
 await assert.rejects(prepareBrowserInteraction(page(button,2),{kind:"click",testId:"open-menu"},approval));
 await assert.rejects(prepareBrowserInteraction(page({...button,formAssociated:true}),{kind:"click",testId:"open-menu"},approval));
});
test("rejects submit buttons, sensitive, disabled, readonly and hidden controls",async()=>{
 for(const meta of [{...button,type:"submit"},{...button,sensitive:true},{...button,disabled:true},{...input,editable:false},{...input,contentEditable:true},{...button,action:"/submit"}]){
  const p=page(meta);await assert.rejects(prepareBrowserInteraction(p,{kind:meta.tag==="input"?"fill":"click",testId:meta.tag==="input"?"search-input":"open-menu",...(meta.tag==="input"?{value:"x"}:{})},approval));
  assert.deepEqual(p.calls,{click:0,fill:0});
 }
});
test("rejects invalid locator and unsupported input types",async()=>{
 await assert.rejects(prepareBrowserInteraction({}, {kind:"click",testId:"open-menu"},approval));
 await assert.rejects(prepareBrowserInteraction(page({...input,type:"password"}),{kind:"fill",testId:"search-input",value:"x"},approval));
 await assert.rejects(prepareBrowserInteraction(page(button),{kind:"click",testId:"deleteAccount"},approval));
});
