# AI Control Gateway — Deployment prerequisites

**Status: prototype only. Do not enable or merge into production until reviewed.**

The endpoint `POST /api/ai-control` implements a limited JSON-RPC/MCP surface:
`initialize`, `notifications/initialized`, `tools/list`, and `tools/call` for
`finance_api_contract` only. It does not access Finance Hub D1 or financial data.

## Required configuration

- `AI_GATEWAY_ENABLED`: `true` only after the identity provider is configured and tested.
- `AI_GATEWAY_ISSUER`: exact HTTPS issuer string in access-token `iss`.
- `AI_GATEWAY_AUDIENCE`: expected token `aud` value.
- `AI_GATEWAY_JWKS_URL`: trusted HTTPS JWKS URL for issuer's signing keys.

The access token must be a signed RS256 JWT with a `sub`, valid `exp`,
matching issuer and audience, and `finance:metadata:read` in `scope`.
All configuration must be set as trusted deployment environment variables,
not supplied by callers. No tokens or secrets should be pasted into chat.

## Not yet supported

- OAuth discovery and interactive consent/authorization flow for ChatGPT
- RFC 9728 protected resource metadata, OAuth client registration
- MCP session negotiation and complete transport compatibility
- Authenticated finance data retrieval, workspace authorization propagation
- Writes, deployments, or background jobs
- Production smoke test and security review

**Do not claim that ChatGPT is connected until a real client successfully
authenticates and calls the gateway.**

## Proposed rollout

1. Review identity provider and OAuth client registration options.
2. Add OAuth protected resource metadata and enforce issuer binding.
3. Validate MCP transport compatibility using a real client in staging.
4. Deploy with gateway disabled, test 503 fail-closed behavior.
5. Enable metadata-only access in staging and test valid/invalid tokens.
6. Obtain explicit approval before exposing finance data or write operations.
