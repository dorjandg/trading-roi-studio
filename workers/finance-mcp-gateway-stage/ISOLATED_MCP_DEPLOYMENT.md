# Isolated MCP gateway deployment — not yet executed

The new `correction-mcp-router.mjs` and `wrangler.isolated.jsonc` are a deployment candidate, **not** an active ChatGPT connector. The configuration intentionally has `workers_dev:false`, `preview_urls:false`, no route, no D1 binding, and `FINANCE_MCP_WRITE_TOOLS_ENABLED:false`.

## Critical identity boundary
The gateway currently forwards the Cloudflare Access assertion JWT to Finance Hub, whose API validates the JWT issuer, signature **and configured audience**. If the gateway and Finance Hub are different Access applications with different AUDs, forwarding the gateway JWT **will fail**. Do not disable audience verification to make this work. Choose an architecture that obtains an independently valid Finance Hub audience assertion while retaining end-user identity and workspace authorization; validate this in an isolated end-to-end test. A service token alone is not proof of end-user authorization.

## Safe staging procedure
1. Provision a dedicated isolated Finance API Worker/Pages environment with synthetic data and the existing dedicated `finance-correction-isolated-test` D1 database. Never reuse production `finance-hub-db` or the existing `finance-mcp-gateway-stage` binding, which was observed to point to production.
2. Apply correction audit/backup migration to isolated D1 only; seed synthetic users, memberships, and snapshots. Set an isolated signing key (at least 32 unpredictable characters) and explicitly isolate Access policies and audience.
3. Deploy the MCP Worker with `wrangler deploy --config workers/finance-mcp-gateway-stage/wrangler.isolated.jsonc` **only after** replacing the placeholder origin and defining a private, Access-protected route. No public workers.dev or preview URL should be enabled.
4. Verify Access authentication at the gateway AND the Finance API independently, including rejection of wrong JWT audience, missing assertion, expired assertion, non-owner saves, other users' transactions and stale revisions.
5. Verify `tools/list` exposes preview only while disabled. Run read-only preview with a synthetic transaction, then run a separately approved synthetic save with `FINANCE_MCP_WRITE_TOOLS_ENABLED=true` and the isolated Finance API write flag enabled. Verify D1 backup, audit, CAS and replay rejection. Disable both write flags afterward.
6. Only after a full production export and restore verification, request explicit owner approval before any production deployment, production migration or production write enablement.

## ChatGPT connector publishing
Deploying a Worker does **not** automatically update the existing ChatGPT Finance Hub plugin. A separately registered MCP connection, correct OAuth/Access authentication flow, and tool-discovery validation are required. Do not claim the connected plugin can edit until its live `tools/list` shows the new actions and a synthetic end-to-end invocation succeeds.

## No-go criteria
Stop if the gateway and Finance API audience tokens cannot be independently verified, the gateway route is public, the Finance API points at production during isolated testing, D1 audit/backup is missing, or any synthetic transaction changes without explicit confirmation.
