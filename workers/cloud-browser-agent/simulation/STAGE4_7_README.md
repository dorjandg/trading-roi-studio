# Stage 4.7 — Signed test identity command boundary

**Status: test-only. No Cloudflare OAuth integration, deployed write Worker, or production writes.**

The `sealed-identity-gateway.mjs` module wraps the existing persistent SQLite fixture with a mock identity authority that issues HMAC-SHA256 signed, audience-bound, short-lived bearer tokens. This cryptographically verifies a test principal relative to the local test authority; **it does NOT verify a Google account or Cloudflare Access identity**.

## Validated properties

- Caller cannot supply an arbitrary `actor`, `role`, or `approved:true` value in a write request.
- Only the fixture identity authority can issue a token. API consumers are never given the signing key or issue endpoint.
- Signature checked using timing-safe comparison. Wrong signature, wrong issuer/audience, expired token, malformed claims and role mismatch are rejected.
- Creator and reviewer roles are disjoint; different signed principals must propose and approve.
- Approvals bind to a specific proposal digest; SQLite commits the test field change, approval consumption, idempotency key and audit event in one transaction.
- Restart, replay, expiry, rollback, kill switch, and rejected-request tests run in CI.
- Source stays strictly inside `simulation/`. The deployed Cloud Browser Worker and MCP gateway do not import it.

## Not yet safe for deployment

1. Replace local HMAC fixture identity authority with **actual independently verified Google/Cloudflare Access JWTs**, including issuer/audience/JWKS rotation, nonce/replay rules, trusted principal-to-role mapping, revocation and MFA policy.
2. Implement explicit consent and authorization using a **separate** OAuth `mcp:write` scope, and keep all existing `mcp:read` tools unchanged.
3. Separate write service with unique credentials, production denylist and dedicated disposable staging host; no direct access to Finance Hub or JP Realty.
4. Durable central kill switch, append-only externally anchored audit ledger, rate limits and distributed race protection.
5. Execute only narrowly bound changes after destination reinspection and side-effect analysis; verify current state, anti-CSRF behavior, redirect policy and rollback.
6. User confirmation for every concrete external write; images/uploads require additional vetting.

**Do not expose this local testing code as an HTTP endpoint, deploy it as a Worker or interpret passed tests as permission to edit live sites.**
