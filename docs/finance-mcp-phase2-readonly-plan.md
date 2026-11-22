# Finance Hub MCP — Phase 2 read-only integration gate

## Verified November 22, 2026

- ChatGPT custom plugin `Finance Hub MCP` registered and Cloudflare Managed OAuth authorized successfully.
- Live `finance_api_contract` tool returned `{ "service": "finance-hub", "gateway": "metadata-only", "financialDataAccess": false, "writeAccess": false, "principalAuthenticated": true }`.
- The staging Worker remains isolated from production Finance Hub and has no FINANCE_DB binding.
- Cloudflare Access staging app has Managed OAuth enabled and an allowed ChatGPT redirect pattern `https://chatgpt.com/connector/oauth/*`.

## Implementation requirements before enabling financial reads

1. Inspect production D1 schema and existing finance API's authenticated read routes. Never infer column names or workspace membership from email alone.
2. Introduce a **read-only** data source binding to the staging gateway. Use prepared SELECT statements only; no DDL, inserts, updates, deletes, or migrations.
3. Bind the verified Cloudflare Access principal to an **existing** Finance Hub user and workspace membership, using the exact identity mapping used by Finance Hub. Reject missing or ambiguous membership; never auto-create membership.
4. Scope every query by workspace and apply strict result limits, date filters, and a deterministic sort. Do not allow arbitrary SQL, table names, workspace IDs, or financial mutations from MCP arguments.
5. Start with three explicitly read-only MCP tools: `finance_report_summary`, `finance_transactions_list`, `finance_category_summary`. Keep `finance_api_contract` available.
6. Respect Finance Hub classification, reporting holds, transfer exclusions, deduplication, original amounts, dates, currencies, and user/workspace ownership. Never reinterpret or release held transactions in the gateway.
7. Return minimal fields, redact external account identifiers and raw evidence, and log only request IDs, tool names, counts, and error codes (no financial values or tokens).
8. Test unauthorized users, no membership, cross-workspace access, token expiry, invalid JWT, pagination, reporting holds, and unchanged production records. Confirm staging deploy and live tool results before declaring Phase 2 operational.

## Release boundary

This document authorizes no production changes. Phase 2 is **not yet deployed**. The connected ChatGPT plugin remains metadata-only until the data contract and membership enforcement are implemented and verified.

## Verified source-code findings (2026-11-22)

Inspected `functions/api/finance.js` and `finance/schema.sql` on the feature branch:

- The canonical website cloud snapshot is `finance_snapshots(workspace_id,user_id,revision,payload,updated_at)`. The snapshot payload is JSON `finance-hub-backup` version 2 and contains `transactions`, `propAccounts`, `propEvents`, `propAudit`, `subscriptions`, `invoices`.
- Finance API `GET ?resource=snapshot` enforces both `workspace_id` and `user_id`, and returns revision and JSON payload. `GET ?resource=snapshot-meta` returns only revision and updated timestamp.
- Finance API also has a normalized `transactions` D1 table with columns `id,workspace_id,account_id,user_id,occurred_on,category,transaction_type,amount_minor,currency,notes,source,external_id`. Its `GET ?resource=transactions` is user-scoped, limited to 1000 rows. **Do not assume this normalized table contains the same complete records as the dashboard snapshot.**
- Finance API currently automatically provisions invited or bootstrap users on first request. The MCP gateway must **not** use that provisioning path; it needs an existing `users.id` + `memberships` read-only lookup. Cloudflare Access `sub` from the staging Access application may differ from the production app's `sub`; verify the identity mapping before binding data.
- The snapshot payload includes reporting-specific classifications and holds. The MCP should return existing dashboard-calculated results or implement independently verified matching calculations, never silently aggregate raw transaction amounts as spendable cash or P&L.
- User-scoped snapshots must not be combined across Dori, Dona, or Doen by default, even if they share a workspace. Do not rely solely on the staging email allowlist for data authorization.

### Revised implementation order

1. Confirm the Access identity mapping against existing `users` and `memberships` **without creating any records**.
2. Confirm canonical snapshot structure and reporting calculation semantics with a read-only test fixture or approved, scoped query. Check whether D1 Worker binding can be configured with read-only credentials or isolate all access behind an authenticated, read-only API. D1 bindings themselves are not SQL read-only by default.
3. Implement `finance_snapshot_meta` first (revision, update time, available record counts only), then a narrowly scoped `finance_transactions_list` that preserves original snapshot fields and excludes sensitive evidence by default.
4. Add `finance_report_summary` only after comparing output with website dashboard for the same snapshot revision and user.
5. Keep staging metadata-only if any identity, workspace, snapshot, or report reconciliation check fails.
