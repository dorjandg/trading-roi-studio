// Real Cloudflare D1 runtime emulation via local Miniflare; NO Cloudflare account/network/remote D1.
import test from "node:test";
import assert from "node:assert/strict";
import {Miniflare} from "miniflare";
import {createD1ApprovalLedger,D1_APPROVAL_LEDGER_SCHEMA} from "../simulation/d1-approval-ledger.mjs";
import {runDisposableD1Acceptance} from "../simulation/disposable-d1-acceptance.mjs";
const context={principal:"local-user",sessionId:"local-session",actionDigest:"c".repeat(64),origin:"https://example.test"};
const grantId="33333333-3333-4333-8333-333333333333";
async function localD1(fn){
 const mf=new Miniflare({modules:true,script:"export default { fetch() { return new Response('offline only'); } }",d1Databases:["TEST_ONLY_DB"]});
 try{const db=await mf.getD1Database("TEST_ONLY_DB");await fn(db);}
 finally{await mf.dispose();}
}
test("Miniflare disposable D1 executes approval schema, audit and replay rejection",()=>localD1(async db=>{
 const result=await runDisposableD1Acceptance(db);
 assert.equal(result.passed,true);
 assert.equal(result.executionAllowed,false);
 assert.equal(result.productionWritesAllowed,false);
}));
test("Miniflare D1 enforces one grant consumption under concurrent requests",()=>localD1(async db=>{
 await db.exec(D1_APPROVAL_LEDGER_SCHEMA);
 const ledger=createD1ApprovalLedger(db);
 const event={...context,grantId};
 const results=await Promise.allSettled([ledger.reserveAndAudit(event),ledger.reserveAndAudit(event)]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 assert.equal(results.filter(r=>r.status==="rejected").length,1);
 const row=await db.prepare("SELECT COUNT(*) AS n FROM isolated_grant_audit").first();
 assert.equal(row.n,1);
}));
test("Miniflare D1 audit readback matches committed scope and rejects replay",()=>localD1(async db=>{
 await db.exec(D1_APPROVAL_LEDGER_SCHEMA);
 const ledger=createD1ApprovalLedger(db);
 const event={...context,grantId};
 assert.equal((await ledger.reserveAndAudit(event)).executionAllowed,false);
 const row=await db.prepare("SELECT * FROM isolated_grant_audit WHERE grant_id=?").bind(grantId).first();
 assert.equal(row.principal,context.principal);
 assert.equal(row.session_id,context.sessionId);
 assert.equal(row.action_digest,context.actionDigest);
 assert.equal(row.origin,context.origin);
 assert.equal(row.event_type,"GRANT_CONSUMED");
 await assert.rejects(ledger.reserveAndAudit(event),/replay/);
}));
