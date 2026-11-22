# Multi-website ChatGPT Control Plane — Phase 1 design

Status: DEVELOPMENT / staging only. No production deployment or gateway activation authorized by this document.

## Goal
One secure MCP interface through which ChatGPT can inspect and, after explicit user approval, update Finance Hub, JP Realty, GLAM, Trading ROI Studio, YouTube Academy, and Personal Hub. GitHub, Cloudflare and Google integrations remain separate provider connectors behind an orchestrator, not shared credentials exposed to websites.

## Architecture
ChatGPT MCP client -> Cloudflare Access Managed OAuth -> isolated MCP gateway -> service registry -> per-site adapters -> authenticated site APIs and provider connectors.

Each adapter publishes discoverable capabilities, input/output JSON Schemas, permission scopes, source timestamps, tenant/workspace ownership, idempotency behavior, and audit event type. Initial rollout: metadata only, then Finance Hub read-only reporting. No generic arbitrary URL fetch, arbitrary SQL, code execution or cross-site admin tool.

## Security invariants
- Verify Cloudflare Managed OAuth bearer token at the Access edge; verify origin-supplied signed Access assertion with exact staging AUD and trusted JWKS. Test that spoofed client-supplied Cf-Access-Jwt-Assertion is stripped.
- Explicit workspace membership for every data operation; deny by default; derive workspace from authenticated identity, never client input.
- Bind staging to finance-mcp-stage-db ONLY, never finance-hub-db.
- Separate per-site service identities, narrow scopes, short-lived credentials, secret storage, rate limits, request size caps and redacted logs.
- Reads first. Writes require explicit approval, preview/diff, optimistic concurrency/version checks, audit trail, and rollback strategy. Financial classification/amount changes need stronger review.
- No token, personal finance data, secrets, or full email contents in tool logs.
- Fail closed on invalid auth, missing membership, unavailable provider, unexpected OAuth metadata, or malformed MCP request.
- Protect production from deployment: isolated branch and Pages project; do not enable AI_GATEWAY_ENABLED until tests pass.

## Initial capability registry (proposed, NOT live)
- system.list_sites (read): list authorized site IDs, environments and supported tools.
- system.health (read): fetch bounded deployment/API health summaries; no credentials in response.
- finance.report_summary (read): workspace-scoped totals with date range and currency; derived from validated Finance Hub API.
- finance.transaction_list (read): paginated, scoped and redacted; source lineage and reporting holds preserved.
- github.deployment_status (read): via connected GitHub app.
- cloudflare.deployment_status (read): via separately authorized Cloudflare integration.
- site.update_* (write, later): site-specific, previewed and approved, never generic arbitrary mutations.

## Required checks before gateway activation
1. Confirm actual Cloudflare Access AUD is a2529c2b459fcb47158adcac9e5eafec26f6c6076a7cc217d36bf063eb50bebf; UUID is not AUD.
2. Verify Access Managed OAuth discovery, dynamic registration, S256 PKCE and ChatGPT exact redirect URI via real client setup. Do not assume UI toggle guarantees protocol compatibility.
3. Inspect existing production D1 schema in READ-ONLY fashion before creating any staging membership schema; ensure Access claims.sub matches user IDs or implement a verified identity mapping. No copied financial records.
4. Confirm Pages function routing and origin assertions, including forbidden unauthenticated paths and OAuth token forwarding.
5. Execute automated negative tests, real sign-in, tool discovery and read-only tool call, token expiry/refresh, wrong user, wrong workspace, spoofed assertion and denied client.
6. Only after successful checks and explicit approval, set AI_GATEWAY_ENABLED=true for metadata-only staging; production remains untouched.

## Current environment
Staging: https://finance-mcp-stage.pages.dev
Access app: Finance Hub ChatGPT MCP - Staging; Google IdP and Authorized Users policy.
Managed OAuth toggle: enabled, protocol endpoints not yet verified.
Staging D1: finance-mcp-stage-db, FINANCE_DB binding.
Gateway: disabled (AI_GATEWAY_ENABLED unset).
Current code: /api/ai-control metadata-only prototype; not yet multi-site.

## Delivery sequence
A. Verify auth and staging schema without financial data.
B. Complete standards-compliant MCP transport and registry with safe read-only tools.
C. Connect Finance Hub read-only reporting, validate totals and reporting holds.
D. Add site health and GitHub/Cloudflare deployment status using scoped connectors.
E. Add JP Realty/GLAM/Academy adapters; per-site permission and integration tests.
F. Add approved write operations with previews, audit and rollback; only then evaluate production rollout.
