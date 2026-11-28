# Finance Hub controlled corrections — activation runbook

Status: **NOT ENABLED**. This branch is a candidate, not a production authorization.

## Scope
Only a single `description`, `category`, or `provider` metadata field on an existing, uniquely identified transaction. No amount, currency, date, type, reporting hold, import, or bulk modification.

## Preconditions (all mandatory)
1. Obtain the account owner's **explicit approval to enable controlled writes**. Approval to prepare or test does not authorize production writes.
2. Check GitHub correction tests, runtime cryptographic tests, Finance Hub tests and Cloudflare deploy status. No failed or pending checks.
3. Test migration `workers/finance-mcp-gateway-stage/migrations/0002_direct_corrections.sql` against an **isolated D1 database**, including backup, atomic revision conflict rollback, audit and restoration.
4. Independently export and verify the complete production snapshot before schema changes. Verify revision, record count, IDs, amounts, currencies, types and holds; preserve the backup securely.
5. Apply migration to the **actual D1 bound to the Finance Hub Pages project**, not merely to a separate staging MCP database. Verify both audit tables and their constraints.
6. Configure `FINANCE_CORRECTION_SIGNING_KEY` as a Cloudflare secret with at least 32 unpredictable characters. Do not commit or print it. Use distinct keys for staging and production.
7. Deploy and verify the signed preview and confirmation UI before enabling saves. Preview tickets expire after five minutes and bind to authenticated workspace/user, exact transaction, field, before/after values and snapshot revision.
8. Only then set `FINANCE_TRANSACTION_CORRECTIONS_ENABLED=true` after explicit approval. Default is disabled.

## Single correction workflow
1. Identify a transaction from the authenticated user's snapshot, read its current field and revision, and display exact before/after.
2. Request a read-only preview and show it to the owner. The preview returns a short-lived signed ticket.
3. Require a distinct, explicit confirmation of that exact change. No generic standing authorization for all changes.
4. Submit the signed ticket, exact original values and revision. Save requires owner/admin membership and runs a single D1 batch: backup → CAS update → audit. Conflicts must roll back all writes.
5. Read back the transaction, revision, backup and audit entry. If any verification fails, stop and investigate; never silently retry.
6. Report the resulting revision and backup ID.

## Rollback and stop conditions
Disable `FINANCE_TRANSACTION_CORRECTIONS_ENABLED` immediately if audit/backup verification fails, revision unexpectedly changes, or any non-target field changes. Use the verified pre-change backup for a controlled restore after reviewing intervening writes. Do not blindly overwrite a newer snapshot.

## Important limitations
- The existing Finance Hub dashboard's own authenticated snapshot editing remains separate from this controlled-correction path.
- The MCP plugin currently exposes read-only finance methods; this GitHub feature **does not add a ChatGPT-callable write action**. An authenticated, owner-approved write tool or workflow must be separately implemented and tested before claiming ChatGPT can directly save changes.
- The signed preview ticket is tamper-evident and short-lived, but does not by itself prove the user personally clicked Confirm; that UI interaction and an explicit approval process remain necessary.

## Isolated Cloudflare D1 schema verification (2026-11-22)
- Created new empty D1 `finance-correction-isolated-test` (ID `c17bd16f-ff73-4b53-b8a5-5128d9d1b400`) with no production bindings.
- Applied migration's two `CREATE TABLE IF NOT EXISTS` and two index statements to this isolated D1 only.
- Verified both tables and both custom indexes in `sqlite_master`; verified audit foreign key references `finance_mcp_direct_backups(backup_id)` and `new_revision` is NOT NULL.
- **Not yet verified:** actual D1 multi-statement batch rollback/concurrency and restoration against this database; schema verification alone does not authorize enabling writes.
- Never bind this test database to the live Finance Hub site or staging gateway that currently references production D1.

## D1 rollback probe (2026-11-22)
- In `finance-correction-isolated-test` only, created disposable table `finance_correction_rollback_probe(id TEXT PRIMARY KEY,value TEXT NOT NULL)`.
- Executed two INSERTs with the same primary key in a single console submission; second failed `SQLITE_CONSTRAINT_PRIMARYKEY`.
- Follow-up `SELECT COUNT(*)` returned **0**, consistent with atomic rollback of the first insert.
- This proves the observed probe behavior only; the actual Pages `db.batch` correction path still requires isolated end-to-end testing.

## Production-shaped isolated D1 test (2026-11-22)
- Used only `finance-correction-isolated-test` and disposable `finance_correction_test_snapshots`, never real `finance_snapshots`.
- Seeded fake revision 19 / payload BEFORE; single console submission inserted backup, CAS-updated to revision 20 / AFTER, and inserted audit recording 19→20. Read-back confirmed all three records and exact values.
- Submitted a stale expected revision 18 attempt; read-back confirmed revision remained 20 / AFTER and no stale backup or audit rows existed.
- This was a D1 SQL Console test, **not** a deployed Worker `db.batch` integration test; do not equate the two.

## Real isolated D1 restore verification (2026-11-22)
- In dedicated `finance-correction-isolated-test`, read fake snapshot revision 20 / AFTER and backup revision 19 / BEFORE.
- Revision-and-payload-guarded UPDATE restored fake snapshot to revision 19 / BEFORE (one row affected), leaving original audit record intact.
- Simulated an intervening update to revision 21 / NEWER. Repeating guarded restore with expected revision 20 affected zero rows; revision 21 / NEWER remained intact.
- Only fake `finance_correction_test_snapshots` changed. This does **not** verify the complete live production backup, deployed Worker `db.batch` or user-facing recovery endpoint.

## Production read-only backup readiness audit (2026-11-22)
- Inspected Cloudflare D1 `finance-hub-db` (ID `c5c75000-5118-4994-a8fb-1e06756b73a6`) without modifying data or settings.
- D1 Time Travel page showed restore control, current bookmark capability and UI text describing a 30-day recovery period. The displayed available window began 2026-11-19 07:10 and ended 2026-11-22 04:32; **do not assume a full 30 days of actual history**.
- Verified `finance_snapshots` and other application tables exist; no raw financial records were exported. `PRAGMA page_count` was denied by console authorization.
- This is **not** a verified independent export of the complete production snapshot. Mandatory activation precondition 4 remains unmet. Never invoke Time Travel restore without a separate, reviewed authorization because it overwrites current database state.

## Production snapshot size and integrity read-only verification (2026-11-22)
- In actual `finance-hub-db`, read-only JSON metadata showed one `finance_snapshots` row: revision 19, valid JSON, `finance-hub-backup` version 2, 1,608 transactions.
- Snapshot size was 991,199 characters / **991,822 UTF-8 bytes**, leaving **56,754 bytes** before the correction endpoint's 1 MiB payload guard (1,048,576 bytes). **Capacity risk:** bulk imports or added metadata could exceed this guard; do not treat this as ample headroom.
- No raw records, identities or secrets were retrieved, and no writes were made. This verifies live snapshot structure, **not** a separately recoverable full export or the uniqueness/field correctness of all 1,608 records.
