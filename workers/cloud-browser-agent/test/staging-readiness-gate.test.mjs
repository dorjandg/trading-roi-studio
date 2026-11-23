import test from "node:test";
import assert from "node:assert/strict";
import {assessStagingReadiness,STAGING_REQUIREMENTS} from "../simulation/staging-readiness-gate.mjs";
test("missing staging evidence always fails closed",()=>{
 const result=assessStagingReadiness({});
 assert.equal(result.readyForSecurityReview,false);
 assert.equal(result.executionAllowed,false);
 assert.equal(result.productionWritesAllowed,false);
 assert.deepEqual(result.missing,STAGING_REQUIREMENTS);
 assert.equal(Object.isFrozen(result),true);
 assert.equal(Object.isFrozen(result.missing),true);
});
test("complete claimed evidence is only a review signal, never execution authorization",()=>{
 const evidence=Object.fromEntries(STAGING_REQUIREMENTS.map(k=>[k,true]));
 const result=assessStagingReadiness(evidence);
 assert.equal(result.readyForSecurityReview,true);
 assert.equal(result.executionAllowed,false);
 assert.equal(result.productionWritesAllowed,false);
 assert.deepEqual(result.missing,[]);
});
test("missing independent approval, audit or write isolation blocks readiness",()=>{
 const evidence=Object.fromEntries(STAGING_REQUIREMENTS.map(k=>[k,true]));
 for(const key of ["independentApprovalVerifier","durableAuditBeforeExecution","auditFailureBlocksExecution","productionWritesDisabled"]){
  const result=assessStagingReadiness({...evidence,[key]:false});
  assert.equal(result.readyForSecurityReview,false);
  assert.deepEqual(result.missing,[key]);
 }
});
test("unknown fields, coercion and malformed evidence are rejected",()=>{
 for(const evidence of [null,[],{"authenticatedPrincipal":"true"},{unexpected:true},Object.create(null)]){
  assert.throws(()=>assessStagingReadiness(evidence),/Invalid staging evidence/);
 }
});
