# Finance Hub AI Control API — Phase 1

Status: development branch only; no production rollout.

## Existing endpoint

`GET /api/finance?resource=control-capabilities`

Returns HTTP 200 only after the existing Cloudflare Access JWT validation and workspace membership lookup. Response:

```json
{
  "service": "finance-hub",
  "apiVersion": 1,
  "authenticated": true,
  "workspaceScoped": true,
  "role": "owner",
  "capabilities": {
    "read": ["me", "snapshot-meta", "gmail-summary", "gmail-evidence", "connections", "transactions"],
    "write": ["snapshot", "connections"],
    "admin": ["members", "invitations"]
  },
  "asOf": "ISO-8601 UTC timestamp"
}
```

Capabilities are descriptive, not permissions or a new authorization layer. Each underlying endpoint continues to enforce its own access checks. The response does not include transaction records or secrets.

## Important security boundary

This endpoint is **not yet a ChatGPT connector**. The existing API expects a Cloudflare Access-signed JWT from the authenticated user. A generic ChatGPT MCP server cannot simply use the owner's browser session or call these endpoints without an explicit, supported authentication integration.

A future MCP gateway must:
1. Authenticate the ChatGPT user via a supported OAuth flow, without copying browser cookies or Access JWTs into chat.
2. Bind each invocation to a verified user/workspace identity and enforce least-privilege scopes.
3. Call the existing Finance API using a supported identity propagation/service authentication scheme; never impersonate a user by injecting an unverified email header.
4. Log action name, principal, scope, and outcome without sensitive payloads.
5. Expose read-only tools first; add mutation tools only with explicit authorization, revision checks, and audit logs.
6. Avoid any production database modification during connector development.

## Verification

GitHub Actions runs on PR #2:
- Finance Control API checks: passed
- Finance Hub checks: passed
- Studio financial-model invariant checks: passed

Pending: deployment preview, real authenticated endpoint smoke test, OAuth/MCP connector registration, and end-to-end ChatGPT tool call.
