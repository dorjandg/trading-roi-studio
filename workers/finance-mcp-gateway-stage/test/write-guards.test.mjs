import test from "node:test";
import assert from "node:assert/strict";
import {validateChange,applyChangeToCopy} from "../src/write-guards.js";

const id="11111111-1111-4111-8111-111111111111";
const original=()=>({revision:19,data:{transactions:[{id,category:"Trading",provider:"FTMO",description:"Receipt",type:"Expense",amount:100,currency:"EUR",date:"2026-11-01",reportingHold:true},{id:"22222222-2222-4222-8222-222222222222",amount:50,type:"Transfer"}],propEvents:[{id:"keep"}]}});
const args=()=>({transaction_id:id,expected_revision:19,field:"category",expected_value:"Trading",new_value:"Trading fees"});
test("valid change copies without mutating source or unrelated records",()=>{
 const before=original(),v=validateChange(before,args()),next=applyChangeToCopy(before,v);
 assert.equal(v.ok,true);assert.equal(next.revision,20);assert.equal(next.data.transactions[0].category,"Trading fees");
 assert.equal(next.data.transactions[0].reportingHold,true);assert.equal(next.data.transactions[0].amount,100);
 assert.deepEqual(next.data.transactions[1],before.data.transactions[1]);assert.deepEqual(next.data.propEvents,before.data.propEvents);
 assert.equal(before.revision,19);assert.equal(before.data.transactions[0].category,"Trading");
});
test("rejects stale revision",()=>assert.equal(validateChange(original(),{...args(),expected_revision:18}).code,"REVISION_CONFLICT"));
test("rejects old-value mismatch",()=>assert.equal(validateChange(original(),{...args(),expected_value:"Wrong"}).code,"VALUE_CONFLICT"));
test("rejects money and reporting hold modifications",()=>{
 for(const field of ["amount","currency","date","type","reportingHold","id"])assert.equal(validateChange(original(),{...args(),field}).code,"INVALID_ARGUMENTS");
});
test("rejects unknown or duplicated IDs",()=>{
 assert.equal(validateChange(original(),{...args(),transaction_id:"33333333-3333-4333-8333-333333333333"}).code,"TRANSACTION_NOT_UNIQUE");
 const d=original();d.data.transactions.push({...d.data.transactions[0]});
 assert.equal(validateChange(d,args()).code,"TRANSACTION_NOT_UNIQUE");
});
test("rejects empty or oversized values",()=>{
 for(const value of ["","   ","x".repeat(301)])assert.equal(validateChange(original(),{...args(),new_value:value}).code,"INVALID_ARGUMENTS");
});
test("rejects invalid snapshots and stale previews",()=>{
 assert.equal(validateChange({},args()).code,"INVALID_SNAPSHOT");
 const v=validateChange(original(),args());const changed=original();changed.revision=20;
 assert.throws(()=>applyChangeToCopy(changed,v),/Stale preview/);
});
