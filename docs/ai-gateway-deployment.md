# AI Control Gateway — Cloudflare Access authentication plan

**Status: development only. Gateway remains disabled; do not deploy or merge yet.**

## Decision

Reuse the existing Cloudflare Access login as the **human identity and access-policy layer**.
Finance Hub already verifies the `Cf-Access-Jwt-Assertion` JWT with Cloudflare's
`/cdn-cgi/access/certs` signing keys and checks workspace membership in D1.

**Important:** A Cloudflare Access application JWT is **not automatically an OAuth
access token for a ChatGPT MCP client**. The existing Access JWT generally lacks
the required OAuth `scope` claim, and Access login alone does not implement
OAuth authorization-server discovery, authorization-code + PKCE, consent, and
client registration. Do **not** set `AI_GATEWAY_ISSUER` to the Access team domain
and assume ChatGPT OAuth will work.

## Architecture

1. ChatGPT connects to a purpose-built MCP OAuth resource endpoint.
2. An OAuth authorization server performs authorization-code + PKCE with a
   user-facing sign-in that delegates human authentication to Cloudflare Access.
3. The authorization server issues **separate, audience-bound, scoped, short-lived**
   tokens for the MCP resource (scope `finance:metadata:read` initially).
4. The MCP endpoint verifies token signature, issuer, audience, expiry, and scope.
5. Before exposing user-specific Finance Hub data, map the verified OAuth subject
   to an authorized workspace member. Never trust a user-supplied workspace ID.
6. Only after read-only staging validation, consider separately approved writes.

## Current implementation

- `POST /api/ai-control`: JWT-verifying metadata-only MCP prototype, disabled
  unless `AI_GATEWAY_ENABLED=true`.
- `GET /.well-known/oauth-protected-resource`: protected-resource metadata,
  disabled by default and tied to a configured same-origin resource URL.
- `GET /api/finance?resource=control-capabilities`: existing Access-authenticated
  workspace-scoped discovery endpoint; not a public MCP endpoint.
- Automated tests cover JWT signature, issuer, audience, expiry, scope, and
  fail-closed behavior. No financial database mutations.

## Required environment configuration (future staging)

- `AI_GATEWAY_ENABLED`: leave unset until OAuth server and staging tests exist.
- `AI_GATEWAY_ISSUER`: exact OAuth token issuer (not blindly Access team URL).
- `AI_GATEWAY_AUDIENCE`: OAuth resource audience.
- `AI_GATEWAY_JWKS_URL`: OAuth issuer's trusted signing keys.
- `AI_GATEWAY_RESOURCE_URL`: full public HTTPS URL ending in `/api/ai-control`.

Do not paste tokens, client secrets, or signing keys into chat or GitHub.

## Outstanding before any live ChatGPT connection

- Choose or build a standards-compliant OAuth authorization server that
  delegates login to Cloudflare Access.
- Provide authorization-server discovery, PKCE, client registration/consent
  compatible with the ChatGPT MCP client.
- Review MCP HTTP transport and protocol compliance, plus OAuth resource metadata.
- Stage and test real client sign-in, denied access, and token renewal.
- Security review, explicit approval, then deploy metadata-only integration.

**Do not claim ChatGPT is connected until a real client successfully signs in
and calls the gateway.**

## Staging readiness gate (2026-11-21)

The GitHub checks passed at commit `47e8c9e`, but **this is not a production readiness sign-off**. Before staging, configure a separate Cloudflare Access MCP application and confirm Managed OAuth availability and exact ChatGPT OAuth callback URL from the actual client registration flow. The gateway's `AI_GATEWAY_AUTH_MODE=cloudflare-access` validates the signed `Cf-Access-Jwt-Assertion` with `CF_ACCESS_TEAM_DOMAIN` and the **dedicated** `AI_GATEWAY_ACCESS_AUD`; it also requires a pre-existing D1 membership. Never reuse the Finance Hub Access application audience as the MCP audience. Cloudflare must strip any incoming client-supplied Access assertion and inject its own verified assertion at the protected origin. Keep `AI_GATEWAY_ENABLED` unset until those controls and negative tests are verified. Opaque bearer tokens are validated by Cloudflare's Managed OAuth layer, not parsed by the origin. The existing JWT mode is for a separate JWT-issuing OAuth provider only.
