# Finance Hub MCP controlled-write specification (staging only)

Status: DESIGN ONLY. No financial writes enabled. Read-only gateway and preview action remain the only deployed behavior.

## Safety prerequisites
1. Authorize the user via signed Cloudflare Access JWT; resolve exactly one existing user and workspace. Never accept workspace or user IDs from callers.
2. Only permit an allowlisted metadata field on one existing transaction ID. No amounts, currency, dates, type, transfer flags, evidence status, reporting holds, credit notes, or account ownership changes in the first write release.
3. Require expected revision and expected old value, and reject ambiguous transaction IDs. Re-check all invariants in the same transaction as the write.
4. A preview does not grant write permission. An explicit user approval of a complete before/after change must be captured separately and be short-lived, single-use, and bound to authenticated principal, snapshot revision, transaction ID, field and values. No silent execution.
5. Require immutable backup of the entire original snapshot and a separate append-only audit event (principal, timestamp, revision, change, approval reference), before or atomically with any mutation. Backups must be restorable and tested.
6. Use a single D1 transaction or equivalent atomic batch with a conditional revision check; update only when revision matches and bump exactly once. If any backup, audit or update fails, abort all writes.
7. Preserve every transaction ID, ordering, other fields and all unrelated snapshot collections. Verify before/after counts and unchanged-record hashes.
8. Implement a dedicated FINANCE_MCP_WRITE_ENABLED flag default false, plus a separate admin-approved release process. Never enable it merely because code is deployed.
9. Do not rely on an MCP tool call as evidence of user approval. Require a verifiable approval token created by the Finance Hub application or equivalent trusted confirmation workflow.
10. Return safe error codes without private snapshot data. Include idempotency protection and audit access for administrators.

## Mandatory tests before enablement
- Missing/expired/mismatched JWT; unauthorized email; zero or multiple memberships.
- Cross-user and cross-workspace IDs; malformed ID; duplicate transaction ID.
- Revision conflict; old-value conflict; simultaneous approvals; repeated submission.
- Missing/expired/forged/replayed approval; wrong field, record, user, or revision.
- Backup failure; audit failure; update failure; database rollback.
- Reporting-hold, credit-note and transfer-exclusion preservation.
- All original transaction IDs and amounts/currencies/dates/types unchanged.
- Restore a backup in an isolated test database, never the live production D1.
- Read-only and disabled-write flags block every mutation.

Do not enable real writes until these checks pass and the user explicitly approves the write workflow.
