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
