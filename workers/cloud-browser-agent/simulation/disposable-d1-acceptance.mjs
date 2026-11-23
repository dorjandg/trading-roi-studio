// OFFLINE acceptance plan ONLY. Does not connect to Cloudflare, execute Wrangler,
// create databases, or import deployed Worker/MCP code.
import {D1_APPROVAL_LEDGER_SCHEMA,createD1ApprovalLedger} from "./d1-approval-ledger.mjs";
const testEvent=Object.freeze({grantId:"11111111-1111-4111-8111-111111111111",principal:"fixture-user",sessionId:"fixture-session",actionDigest:"a".repeat(64),origin:"https://example.test"});
export const DISPOSABLE_D1_PLAN=Object.freeze({
 scope:"disposable-local-only",productionDatabaseAllowed:false,remoteD1Allowed:false,
 websiteInteractionsAllowed:false,executionAllowed:false,
 schema:D1_APPROVAL_LEDGER_SCHEMA,
 checks:Object.freeze(["schema-primary-key","first-commit","replay-rejected","audit-readback","fail-closed"]),
});
export async function runDisposableD1Acceptance(db){
 if(!db||typeof db.prepare!=="function"||typeof db.batch!=="function"||
    typeof db.exec!=="function")throw Error("Disposable D1-compatible binding required");
 // Caller must provide a newly created disposable local database. No remote fallback.
 await db.exec(D1_APPROVAL_LEDGER_SCHEMA.replace(/\s*\n\s*/g,' '));
 const ledger=createD1ApprovalLedger(db);
 const receipt=await ledger.reserveAndAudit(testEvent);
 if(receipt.executionAllowed!==false||receipt.productionWritesAllowed!==false)throw Error("Unsafe acceptance receipt");
 let replayRejected=false;
 try{await ledger.reserveAndAudit(testEvent);}catch(e){replayRejected=/replay/.test(e.message);}
 if(!replayRejected)throw Error("Disposable D1 replay protection failed");
 return Object.freeze({passed:true,localOnly:true,productionWritesAllowed:false,executionAllowed:false});
}
