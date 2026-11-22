import test from "node:test";
import assert from "node:assert/strict";
import {prepareApprovalRequest} from "../src/approval-request.js";
const actor={workspace_id:"w1",user_id:"u1",authenticated:true,authentication_source:"finance-hub-session"};
const change={ok:true,transaction_id:"t1",field:"category",before:"Old",after:"New",revision:19};
const confirmation={confirmed:true,transaction_id:"t1",field:"category",before:"Old",after:"New",revision:19};
const args=()=>({actor,change,confirmation,nowISO:"2026-11-22T10:00:00Z"});
test("trusted confirmed change produces short-lived scoped approval request",()=>{
 const r=prepareApprovalRequest(args());assert.equal(r.ok,true);
 assert.equal(r.approval.workspace_id,"w1");
 assert.equal(r.approval.expires_at,"2026-11-22T10:05:00.000Z");
});
test("rejects MCP-only or untrusted identity",()=>{
 for(const bad of [null,{...actor,authentication_source:"mcp-jwt"},{...actor,authenticated:false}])
 assert.equal(prepareApprovalRequest({...args(),actor:bad}).code,"TRUSTED_SESSION_REQUIRED");
});
test("rejects absent, false or changed confirmation",()=>{
 for(const bad of [null,{...confirmation,confirmed:false},{...confirmation,after:"Other"},{...confirmation,revision:18}])
 assert.equal(prepareApprovalRequest({...args(),confirmation:bad}).code,"EXPLICIT_CONFIRMATION_REQUIRED");
});
test("rejects unvalidated change and unsafe TTL",()=>{
 assert.equal(prepareApprovalRequest({...args(),change:{...change,ok:false}}).code,"VALIDATED_PREVIEW_REQUIRED");
 assert.equal(prepareApprovalRequest({...args(),ttlSeconds:3600}).code,"INVALID_EXPIRY");
});
