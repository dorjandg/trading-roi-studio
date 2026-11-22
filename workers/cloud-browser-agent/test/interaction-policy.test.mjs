import test from "node:test";
import assert from "node:assert/strict";
import {validateInteractionProposal} from "../src/interaction-policy.mjs";
test("safe click proposal remains non-executable",()=>{
 const r=validateInteractionProposal({kind:"click",testId:"open-menu"});
 assert.equal(r.executionAllowed,false);assert.equal(r.requiresApproval,true);
});
test("safe fill proposal remains non-executable",()=>{
 const r=validateInteractionProposal({kind:"fill",testId:"search-input",value:"example"});
 assert.equal(r.executionAllowed,false);assert.equal(r.value,"example");
});
test("unsafe actions and unexpected fields fail closed",()=>{
 for(const p of [{kind:"submit",testId:"go"},{kind:"click",testId:"delete-account"},{kind:"click",testId:"save"},{kind:"fill",testId:"password",value:"x",extra:true},{kind:"fill",testId:"x",value:3},{kind:"click",testId:"a",url:"https://example.com"}])
  assert.throws(()=>validateInteractionProposal(p));
});
