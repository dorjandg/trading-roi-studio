# Cloud Browser Agent — ChatGPT OAuth gateway (staging deployed)

## Current status (2026-11-22)

- Verified Browser Agent worker: `cloud-browser-agent-stage.dorjan-gjoni-dg.workers.dev`.
- Its protected MCP endpoint passed end-to-end tests using separate
  Cloudflare Access service credentials and Worker bearer authentication.
- A new, isolated OAuth gateway has been coded on the feature branch.
- Current package: `@cloudflare/workers-oauth-provider@1.2.4` with Google
  OpenID Connect, consent and PKCE, token validation and `mcp:read` restriction.
- **STAGING DEPLOYED.** GitHub Actions run 45027754761 passed; a subsequent gateway redeployment passed in run 45028341970. OAuth metadata and unauthenticated MCP 401 smoke checks passed. Full interactive ChatGPT Google OAuth consent/token flow still needs a real connection test.

## Isolated Cloudflare OAuth storage

- KV namespace: `cloud-browser-chatgpt-oauth-stage-kv`
- KV ID: `3e4203c6a00545df9ba0202343afb8d7`
- Account ID: `e21cd8776c9beef277b3eb6f27ce5c58`
- This is new and empty, not reused from Finance Hub.
- Active staging-only Wrangler configuration and a separate GitHub Actions deployment workflow now exist; do not merge to main.

## Proposed staging URL

`https://cloud-browser-chatgpt-stage.dorjan-gjoni-dg.workers.dev/mcp`

Dedicated Google OAuth client settings:
- Client type: Web application
- Authorized redirect URI:
  `https://cloud-browser-chatgpt-stage.dorjan-gjoni-dg.workers.dev/callback`
- Authorized origin:
  `https://cloud-browser-chatgpt-stage.dorjan-gjoni-dg.workers.dev`
- Never reuse or change existing Finance Hub Google OAuth clients.
- GitHub **browser-agent-staging** secrets `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured, and `GOOGLE_ALLOWED_EMAIL` is an environment variable.
- Existing forwarding secrets must stay in `browser-agent-staging`:
  `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`,
  `BROWSER_AGENT_API_TOKEN`.

## Security gates before deployment

1. **Done:** dedicated Google OAuth Web client and restricted Testing-mode Google account allowlist. Never paste the Client Secret into ChatGPT.
2. Validate initial sign-in, consent denial, provider errors, allowlisted
   Google ID token signature, issuer, audience, nonce, account identity,
   token expiry, refresh and revoke.
3. Confirm provider metadata advertises the exact MCP resource, supports CIMD,
   PKCE S256, and refresh-token behavior expected by ChatGPT.
4. **Done:** restricted staging deployment workflow, Wrangler config, and Google credentials securely stored in GitHub environment.
5. **Pending interactive authorization:** run OAuth consent, authorization-code exchange and access-token tests from ChatGPT; validate `initialize`, `tools/list`, `browser_agent_status`, `browser_inspect`, `browser_page_links` and rejected write-action tests. Prior unauthenticated gateway check passed.
6. Connect and test a ChatGPT custom MCP plugin if the account/workspace permits creating custom MCP connections. Never present staging as fully connected until tested.

The gateway's `forwardAuthorizedMcp` function permits only those two
read-only actions. All other tool calls are rejected before forwarding.
Cloudflare OAuthProvider is responsible for verifying issued bearer tokens;
the forwarding code requires the verified user ID and `mcp:read` scope.

## Preserve the working systems

Do not modify, merge or redeploy Finance Hub, its OAuth settings, its D1
database, or the existing Browser Agent stage worker in this process.
