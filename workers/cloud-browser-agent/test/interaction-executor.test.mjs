import test from "node:test";
import assert from "node:assert/strict";
import {createDisposableInteractionPage,executeDisposableInteraction} from "../simulation/interaction-executor.mjs";
const fixture=()=>createDisposableInteractionPage({"open-menu":{type:"button",value:""},"search-input":{type:"input",value:""}});
const approval={approved:true,scope:"disposable-fixture"};
test("disposable click changes only fixture state",()=>{
 const page=fixture();const result=executeDisposableInteraction(page,{kind:"click",testId:"open-menu"},approval);
 assert.equal(result.simulated,true);assert.equal(result.productionWritesAllowed,false);
 assert.equal(page.snapshot().find(x=>x.testId==="open-menu").clicks,1);
});
test("disposable fill changes only fixture state",()=>{
 const page=fixture();executeDisposableInteraction(page,{kind:"fill",testId:"search-input",value:"gold"},approval);
 assert.equal(page.snapshot().find(x=>x.testId==="search-input").value,"gold");
});
test("approval is mandatory and cannot be broadened",()=>{
 for(const a of [undefined,{}, {approved:false,scope:"disposable-fixture"},{approved:true,scope:"production"},{approved:true,scope:"disposable-fixture",extra:true}]){
  const page=fixture();
  assert.throws(()=>executeDisposableInteraction(page,{kind:"click",testId:"open-menu"},a));
  assert.equal(page.snapshot().find(x=>x.testId==="open-menu").clicks,0);
 }
});
test("arbitrary real browser-like adapter is rejected",()=>{
 const fake={apply(){throw new Error("must never execute")}};
 assert.throws(()=>executeDisposableInteraction(fake,{kind:"click",testId:"open-menu"},approval),/Disposable simulation required/);
});
test("missing or wrong element type fails without changes",()=>{
 const page=fixture();
 for(const p of [{kind:"click",testId:"search-input"},{kind:"fill",testId:"open-menu",value:"x"},{kind:"click",testId:"unknown"}])
  assert.throws(()=>executeDisposableInteraction(page,p,approval));
 assert.equal(page.snapshot().find(x=>x.testId==="open-menu").clicks,0);
});
test("unsafe proposals cannot affect disposable state",()=>{
 const page=fixture();
 for(const p of [{kind:"click",testId:"deleteAccount"},{kind:"submit",testId:"open-menu"},{kind:"fill",testId:"password",value:"secret"}])
  assert.throws(()=>executeDisposableInteraction(page,p,approval));
 assert.equal(page.snapshot().find(x=>x.testId==="open-menu").clicks,0);
});
