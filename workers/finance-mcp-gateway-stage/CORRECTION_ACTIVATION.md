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
