# Stage 4.8 — Cloudflare Access JWT verification (isolated integration tests)

## What has been implemented
- `access-jwt-verifier.mjs` verifies RS256 JWT signatures against explicitly configured public JWK keys, never against a URL supplied by a token header.
- It checks issuer, audience, not-before, issued-at, expiration and maximum token lifetime.
- Authenticated subjects map to narrowly allowlisted fixture creator/reviewer roles configured **on the server**, never JWT-supplied roles.
- `access-authenticated-fixture.mjs` bridges a *verified* Access JWT to the disposable SQLite edit-approval fixture, using a stable issuer-and-subject-derived local actor ID.
- Unit tests generate real RSA keys, sign JWTs, test signature forgery/header injection/expiry/role escalation and exercise a complete approved edit and rollback after restarts.
- Tests run within Node in CI. They do **not** authenticate a real Cloudflare Access user or operate on any website.

## Deployment is NOT enabled
The production-shaped `cloud-browser-agent-stage` and its OAuth gateway still have **only** `mcp:read`. Their MCP discovery and forwarding code are unchanged, and this library is not imported by deployed Worker code. There is no write API, no write OAuth client, no live approval flow and no property uploads.

## Real-identity release prerequisites
1. Independently deploy a **new** staging write Worker and gate it behind a distinct Cloudflare Access application and audience. Its API must have no unauthenticated write routes.
2. Obtain Access JWTs only from an authenticated, Cloudflare Access-protected connection. Cloudflare's `Cf-Access-Jwt-Assertion` header must be supplied by Access, not accepted from a public, directly reachable bypass origin.
3. Fetch the public JWKS only from a **configuration-pinned** Cloudflare Access issuer over HTTPS, cache/revalidate keys with bounded lifetimes, support key rotation and fail closed on network/JWKS errors. Never use token-provided `jku`/`x5u` endpoints.
4. Configure the exact expected Access application audience and independently reviewed authorized email-to-role mappings. A single user must not be assigned both creator and reviewer privileges in the same approval workflow.
5. Make user identity, reviewer actions, consent, proposal digest, expiry, one-time execution and idempotency durable in a separate, dedicated staging D1 database. Use a durable central kill switch.
6. Independently restrict `mcp:write` permissions through a **new** OAuth service; keep the existing `mcp:read` gateway as-is.
7. Require per-operation user confirmation with a dedicated approval UI. Do not infer authorization from a tool argument or an LLM instruction.
8. Perform an authenticated end-to-end browser test against a **disposable staging origin only**, with verified rollback and a security review before production access is even considered.

## Assumptions and limitations
- This component validates Access **JWT-shaped credentials**, not Google OAuth ID tokens. JWT issuer format and Access `aud` array are assumptions to verify against the actual dedicated Access application before enabling.
- The verifier receives JWKS as a trusted injected object; it does not implement secure remote JWKS acquisition or user deprovisioning.
- The current local SQLite fixture still stores artificial proposed text and supports no external website writes.
- A short-lived valid token does not by itself authorize an edit: a separate consent/approval operation is required.
