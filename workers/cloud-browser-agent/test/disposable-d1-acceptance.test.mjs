import test from "node:test";
import assert from "node:assert/strict";
import {DISPOSABLE_D1_PLAN,runDisposableD1Acceptance} from "../simulation/disposable-d1-acceptance.mjs";
test("acceptance plan never permits remote or production database",()=>{
 assert.equal(DISPOSABLE_D1_PLAN.remoteD1Allowed,false);
 assert.equal(DISPOSABLE_D1_PLAN.productionDatabaseAllowed,false);
 assert.equal(DISPOSABLE_D1_PLAN.websiteInteractionsAllowed,false);
 assert.equal(DISPOSABLE_D1_PLAN.executionAllowed,false);
 assert.match(DISPOSABLE_D1_PLAN.schema,/PRIMARY KEY/);
});
test("missing D1-like binding fails closed",async()=>{
 for(const db of [null,{}, {prepare(){},batch(){}}])
  await assert.rejects(runDisposableD1Acceptance(db),/Disposable D1-compatible binding required/);
});
test("disposable contract verifies insert and rejects replay",async()=>{
 const rows=new Map();
 const db={
  async exec(sql){assert.match(sql,/CREATE TABLE/);},
  prepare(sql){return {bind(...args){return {
   statement:{sql,args},
   async first(){return rows.get(args[0])??null;}
  };}};},
  async batch(statements){
   const args=statements[0].statement.args;
   if(rows.has(args[0]))throw Error("UNIQUE constraint failed");
   rows.set(args[0],{grant_id:args[0],principal:args[1],session_id:args[2],action_digest:args[3],origin:args[4],event_type:"GRANT_CONSUMED"});
  }
 };
 const result=await runDisposableD1Acceptance(db);
 assert.deepEqual(result,{passed:true,localOnly:true,productionWritesAllowed:false,executionAllowed:false});
 assert.equal(rows.size,1);
});
test("disposable contract fails closed on audit readback mismatch",async()=>{
 const db={
  async exec(){},
  prepare(){return {bind(){return {statement:{args:["11111111-1111-4111-8111-111111111111"]},async first(){return null;}};}};},
  async batch(){}
 };
 await assert.rejects(runDisposableD1Acceptance(db),/verification failed/);
});
