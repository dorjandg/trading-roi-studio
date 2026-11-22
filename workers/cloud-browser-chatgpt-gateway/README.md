# Cloud Browser Agent — ChatGPT OAuth gateway (staging, NOT DEPLOYED)

This is an **isolated, fail-closed prototype**. It does not replace the existing
Finance Hub gateway or the Cloud Browser Agent Worker.

## Existing verified infrastructure
- `cloud-browser-agent-stage.dorjan-gjoni-dg.workers.dev/mcp` responds to
  service-token authentication plus a separate Worker bearer token.
- Two read-only actions: `browser_agent_status` and `browser_inspect`.
- Secret names already exist in GitHub environment `browser-agent-staging`:
  `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, `BROWSER_AGENT_API_TOKEN`.
- Do not disclose or commit credential values.

## Scope
`src/forward.mjs` validates an allowlist of JSON-RPC method/tool combinations,
forwards to a **hard-coded** staging origin, refuses upstream redirects, and never
returns upstream credentials. It **requires a verified OAuth user identity
provided by a trusted server-side OAuth integration**. It does not itself
authenticate a user.

`src/index.mjs` deliberately returns HTTP 503 for all requests. It is a
security placeholder, **not a finished OAuth authorization server**.

## Requirements before enabling any public endpoint
1. Use an established provider, e.g. Cloudflare's maintained
   `@cloudflare/workers-oauth-provider` library (OAuth 2.1, PKCE, CIMD/DCR,
   state and consent, RFC 9728 discovery, token rotation/refresh).
2. Configure dedicated staging hostname and KV namespace. Do not reuse Finance
   Hub production application, its D1 database, Access policies, or OAuth secrets.
3. Require Google/GitHub sign-in, verify identity and allowlist specific account,
   present per-client consent, and bind audience/scope `mcp:read`.
4. Only call `forwardAuthorizedMcp` **after** verifying OAuth token issuer,
   audience, expiration, subject, consent and `mcp:read` scope.
5. Test: unauthenticated 401 with resource metadata, OAuth discovery,
   authorization code + PKCE, redirect URI allowlist, consent and deny,
   refresh, revocation, scope and audience checks, and two tool calls.
6. Add separate deployment workflow with opt-in and GitHub environment
   restrictions. Keep it disabled until every authentication test passes.
7. ChatGPT custom MCP connection availability depends on the user's plan and
   workspace policy; verify that `Add custom MCP server` is available before
   final connection.

Never publish this placeholder as a functioning ChatGPT integration or
weaken Cloudflare Access to bypass authentication.
