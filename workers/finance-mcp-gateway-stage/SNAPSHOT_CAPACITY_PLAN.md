# Finance Hub snapshot capacity plan — design only, not deployed

## Verified baseline (2026-11-22)
Production D1 `finance-hub-db` contains one `finance_snapshots` row at revision 19: `finance-hub-backup` version 2, valid JSON, 1,608 transactions, **991,822 UTF-8 bytes**. Existing API snapshot PUT, Gmail import and correction-save code enforce an **application-level** 1 MiB (1,048,576-byte) payload limit. Remaining headroom: **56,754 bytes**. This is not evidence that D1 itself imposes a 1 MiB row limit.

The entire snapshot is currently rewritten on edits and imports. Increasing a numeric limit without examining Cloudflare D1 binding limits, Worker request/response memory, audit backup size and multi-device concurrency is not an acceptable migration plan.

## Near-term behavior (no schema change)
1. Keep the current 1 MiB guard until the replacement is proven in isolation. Check UTF-8 **bytes**, not JavaScript string length, at every write path.
2. Return 413 with clear capacity diagnostics when a write cannot fit; do not truncate, silently drop transactions, or partially import.
3. Read-only monitor `revision`, transaction count, serialized bytes, and percent of current application cap; do not log raw transaction content.
4. Never compact descriptions, discard fields, or delete old entries automatically to gain space.

## Proposed durable architecture
- **Canonical rows:** Store financial transactions as individual workspace/user-scoped D1 rows, with immutable stable transaction IDs, amount/currency/date/type, source identifiers, provenance, and reporting-hold flags. Preserve unknown source fields losslessly in versioned JSON metadata.
- **Revision ledger:** A workspace/user-scoped revision row controls compare-and-swap updates. Transaction-level changes are transactional and append audit records.
- **Read model:** Maintain existing `finance-hub-backup` v2 JSON as a *compatibility export* for current dashboard consumers during migration; do not remove the existing snapshot or its endpoints yet.
- **Chunking/pagination:** Introduce cursor-based read APIs for transactions and a manifest with revision, count, per-chunk checksum, and a deterministic whole-export digest. Avoid loading or rewriting the entire ledger for each single-record correction.
- **Idempotent import:** Source-scoped stable IDs and a unique key per source event, with explicit handling for same-event duplicates versus internal transfers. Reject ambiguous financial classification rather than guessing.
- **Backup:** Produce a private, encrypted independent export containing manifest, full rows, revision, counts and checksums. Test restore into an isolated D1 and compare every ID and protected financial field. Time Travel alone does not satisfy this requirement.
- **Access:** Keep Cloudflare Access principal/workspace scoping on every query; preserve per-user snapshot ownership semantics. Never place financial data in public GitHub, CI logs or browser console.
- **Concurrency:** Atomic CAS revision plus per-row audit/backup; prevent a legacy whole-snapshot PUT from overwriting newer row-level changes. Introduce an explicit cutover flag and reject incompatible writes rather than silently reconciling them.

## Isolated migration acceptance tests
1. Seed an isolated database with synthetic data matching 1,608 records and near-1 MiB payload, then scale above the legacy cap.
2. Verify every original ID, amount, currency, date, type, hold and unknown metadata field round-trips identically; check counts and canonical hash.
3. Verify owner/member access, no cross-user leakage, stale-revision rejection, concurrent writes, replay protection, duplicate imports and failed-batch rollback.
4. Verify actual deployed Worker + D1 bindings in an isolated environment, including paginated reads and writes, not just mocked `db.batch`.
5. Verify complete backup and restore into a *second* isolated database, with field-by-field reconciliation and no production writes.
6. Run old and new read paths in parallel; compare reports, pivot totals and dashboard results before any cutover.
7. Obtain explicit owner approval for production migration, deploy behind disabled feature flags, and retain rollback compatibility.

## Current decision
**Do not raise the 1 MiB limit or migrate production yet.** The safer long-term solution is a normalized ledger plus compatibility export and independently verified backups. This document does not authorize a schema change, data export, production write or activation of ChatGPT correction tools.
