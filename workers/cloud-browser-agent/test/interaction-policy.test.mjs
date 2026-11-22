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

test("camelCase and sensitive selector names are rejected",()=>{
 for(const testId of ["deleteAccount","submitOrder","payNow","passwordInput","authToken","loginButton","uploadFile","confirmPayment","approveTransfer","saveChanges"]){
  assert.throws(()=>validateInteractionProposal({kind:"click",testId}),testId);
  assert.throws(()=>validateInteractionProposal({kind:"fill",testId,value:"test"}),testId);
 }
});
test("rejects invalid identifier syntax and overlong values",()=>{
 for(const testId of ["","a b","[data-testid]","a".repeat(65),"a/b","_hidden"]){
  assert.throws(()=>validateInteractionProposal({kind:"click",testId}));
 }
 for(const value of [null,42,"x".repeat(257)]){
  assert.throws(()=>validateInteractionProposal({kind:"fill",testId:"search-input",value}));
 }
});
test("rejects prototype-bearing proposals and unsupported methods",()=>{
 for(const p of [Object.create(null),Object.create({kind:"click",testId:"open-menu"}),["click"],{kind:"click",testId:"open-menu",method:"POST"},{kind:"fill",testId:"search-input",value:"ok",submit:true}]){
  assert.throws(()=>validateInteractionProposal(p));
 }
});
test("proposals are immutable and never authorize browser execution",()=>{
 for(const proposal of [{kind:"click",testId:"open-menu"},{kind:"fill",testId:"search-input",value:"hello"}]){
  const result=validateInteractionProposal(proposal);
  assert.equal(Object.isFrozen(result),true);
  assert.equal(result.requiresApproval,true);
  assert.equal(result.executionAllowed,false);
  assert.equal("url" in result,false);
 }
});
