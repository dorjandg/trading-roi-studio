import test from "node:test";
import assert from "node:assert/strict";
import {buildAtomicWriteStatements} from "../src/write-plan.js";
const args=()=>({approval:{approval_id:"a1"},identity:{workspace_id:"w1",user_id:"u1"},change:{ok:true,transaction_id:"t1",field:"category",before:"A",after:"B",revision:19},backupId:"b1",auditId:"log1",oldPayload:"old",newPayload:"new",nowISO:"2026-11-22T10:00:00Z"});
test("all four operations are scoped and conditional",()=>{
 const p=buildAtomicWriteStatements(args());
 assert.deepEqual(p.map(x=>x.kind),["consume_approval","backup","update_snapshot","audit"]);
 assert.ok(p.every(x=>x.expectedChanges===1));
 assert.match(p[0].sql,/consumed_at IS NULL/);
 assert.match(p[0].sql,/expires_at>/);
 assert.match(p[2].sql,/revision=\?/);
 assert.match(p[2].sql,/payload=\?/);
 assert.ok(p.every(x=>x.binds.includes("w1")&&x.binds.includes("u1")));
});
test("invalid or unchanged payload rejected",()=>{
 assert.throws(()=>buildAtomicWriteStatements({...args(),newPayload:"old"}));
 assert.throws(()=>buildAtomicWriteStatements({...args(),approval:null}));
});
