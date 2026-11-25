# Stage 4.9 — Standalone, write-disabled service scaffold

**Not deployed.** This folder has **no Wrangler configuration, GitHub deployment workflow, service credentials, Cloudflare Access application or MCP discovery**. It cannot be used by the connected ChatGPT Browser Agent.

## Implementation
- `src/index.mjs` exports a Cloudflare Worker-shaped handler for future isolated staging.
- Default response (no explicit test bootstrap) is HTTP 503 `SERVICE_NOT_ACTIVATED`.
- Only `GET /health` and `POST /authorization-check` can respond when a test harness sets `WRITE_SERVICE_BOOTSTRAP_ENABLED=true`.
- `POST /authorization-check` verifies an Access-style RS256 JWT against **server-pinned** issuer, Access app audience, public JWKS and allowlisted identity-to-role mapping. It returns the role only, never token or personal email.
- The exact request must be `{\"purpose\":\"review-identity-only\"}`. There is no approval, execution, upload, rollback, submit, or browser-navigation endpoint.
- It reports `executionAllowed:false` and `approvalAllowed:false` even after successful authentication.
- `npm test` in `../cloud-browser-agent` runs scaffold identity/denylist tests; the deployed read-only agent remains unchanged.

## Release blocks
Do **not** add a deployment configuration, enable write actions or forward MCP calls until:
1. A *distinct* staging hostname and Cloudflare Access application (actual issuer, audience, keys, access policy) are created and verified.
2. The deployed Worker cannot be reached by bypassing Access. Header values must be signed and independently verified; never trust a caller-supplied role or `approved=true`.
3. A dedicated `mcp:write` OAuth service and user consent process are implemented separately from the existing `mcp:read` ChatGPT plugin.
4. A dedicated write-only audit/state database with durable kill switch, single-use approvals and atomic idempotency is available. It must not reuse Finance Hub or read-only browser-audit D1.
5. A user-controlled approval UI and auditable per-action confirmation are ready, including before/after state, legitimate session/CSRF controls and rollback.
6. Only an isolated disposable domain is allowed during integration testing. Production sites and uploads require new, explicit authorization and a separate security review.

The current JWT verification module is imported from the *test-only* browser-agent simulation directory; move it to a dedicated shared versioned library before any real deployment.

## Explicitly out of scope
No writes to JP Realty, Finance Hub, YouTube Academy, or Trading ROI Studio. No upload, login, payment, property alteration or browser navigation occurs.
