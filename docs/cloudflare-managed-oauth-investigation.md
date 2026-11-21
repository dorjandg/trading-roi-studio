# Verified Cloudflare configuration and MCP OAuth decision

Inspection date: 2026-11-21. Read-only inspection of authenticated Cloudflare dashboard.

## Verified existing configuration

- Cloudflare Access self-hosted app: **Finance Hub**, hostname `fin-kac.pages.dev`.
- Google identity provider: **Finance Hub - google**.
- Instant Authentication: enabled; session: 24 hours.
- Access policy: **Finance Hub - Authorized Users** (Allow).
- MCP Portals screen exists; no portals configured.
- Managed OAuth for MCP **was not visibly available or configured**. This is not proof of a plan-level limitation.

## Security boundary

Cloudflare Access's `Cf-Access-Jwt-Assertion` is a signed assertion intended
for the protected origin. A managed OAuth MCP client's bearer token may be opaque,
so it must **not** be decoded as a JWT, or treated as an Access assertion.

Never trust a client-supplied `Cf-Access-Jwt-Assertion` header unless the
request is actually protected by the intended Cloudflare Access application
and the JWT signature, issuer, app audience, expiration and user identity
are verified. The existing Finance Hub `/api/finance` checks the JWT and
workspace membership, but can create memberships for invitations/owner
bootstrap; this behavior must not be reused for a read-only MCP request.

## Implementation gate before enabling a dedicated MCP app

1. Verify Cloudflare's **Managed OAuth for MCP** product support and the
   exact authorization-server metadata for this account, including authorization
   code, S256 PKCE, client registration and redirect URI registration.
2. Register the **exact ChatGPT redirect URI supplied by the ChatGPT client**.
   Never invent a callback URL.
3. Confirm how the origin receives a verified Access assertion after the
   managed OAuth proxy validates opaque bearer tokens. Do not forward
   untrusted OAuth tokens to the JWT verifier.
4. Create a dedicated Access app on a separate hostname/path with an explicit
   approved-users policy; do not change the existing Finance Hub app.
5. Enforce issuer, app audience, token expiry, subject, and a **read-only**
   D1 membership lookup. No automatic membership creation.
6. Bind each MCP request to the protected resource and restrict initial
   tools to metadata-only; no finance records or writes.
7. Test success, denied users, expired assertions, forged headers, replay,
   missing workspace membership, PKCE downgrade, redirect mismatch, and
   unknown opaque tokens in staging.

## Current code status

`functions/api/ai-control.js` is disabled by default and currently expects
an OAuth issuer's **signed RS256 JWT** with `finance:metadata:read` scope.
It is **not** compatible with opaque Managed OAuth bearer tokens as-is.
Do not enable it behind Managed OAuth without replacing this auth boundary.

The current implementation is a metadata-only MCP prototype, not a verified
Cloudflare Managed OAuth integration. No production configuration changes.
