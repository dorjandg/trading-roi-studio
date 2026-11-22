import test from "node:test";
import assert from "node:assert/strict";
import {prepareExistingSave} from "../src/existing-save-adapter.js";
const id="11111111-1111-4111-8111-111111111111";
const snapshot=()=>({revision:19,data:{format:"finance-hub-backup",version:2,transactions:[{id,category:"Trading",amount:100,currency:"EUR",type:"Expense",date:"2026-11-21",reportingHold:true},{id:"22222222-2222-4222-8222-222222222222",type:"Transfer",amount:200}],propAccounts:[{id:"p1"}],propEvents:[{id:"e1"}],propAudit:[],subscriptions:[],invoices:[]}});
const args=()=>({transaction_id:id,expected_revision:19,field:"category",expected_value:"Trading",new_value:"Trading fees"});
test("generates compatible full snapshot body preserving every unrelated field",()=>{
 const original=snapshot(),r=prepareExistingSave(original,args());
 assert.equal(r.ok,true);assert.equal(r.body.expectedRevision,19);
 assert.equal(r.body.data.transactions[0].category,"Trading fees");
 assert.equal(r.body.data.transactions[0].reportingHold,true);
 assert.deepEqual(r.body.data.transactions[1],original.data.transactions[1]);
 for(const key of ["propAccounts","propEvents","propAudit","subscriptions","invoices"])
   assert.deepEqual(r.body.data[key],original.data[key]);
 assert.equal(original.data.transactions[0].category,"Trading");
});
test("rejects incomplete snapshot and revision conflict",()=>{
 const bad=snapshot();delete bad.data.propAudit;
 assert.equal(prepareExistingSave(bad,args()).code,"UNSUPPORTED_SNAPSHOT");
 assert.equal(prepareExistingSave(snapshot(),{...args(),expected_revision:18}).code,"REVISION_CONFLICT");
});
test("rejects changes to amount, date, currency and reporting holds",()=>{
 for(const field of ["amount","date","currency","reportingHold","type"])
   assert.equal(prepareExistingSave(snapshot(),{...args(),field}).code,"INVALID_ARGUMENTS");
});
test("rejects payload exceeding existing 1 MB API limit",()=>{
 const big=snapshot();big.data.propAccounts.push({data:"x".repeat(1024*1024)});
 assert.equal(prepareExistingSave(big,args()).code,"SNAPSHOT_TOO_LARGE");
});
