# Cloud Browser Agent — ChatGPT OAuth gateway (staging, NOT DEPLOYED)

## Current status (2026-11-22)

- Verified Browser Agent worker: `cloud-browser-agent-stage.dorjan-gjoni-dg.workers.dev`.
- Its protected MCP endpoint passed end-to-end tests using separate
  Cloudflare Access service credentials and Worker bearer authentication.
- A new, isolated OAuth gateway has been coded on the feature branch.
- Current package: `@cloudflare/workers-oauth-provider@1.2.4` with Google
  OpenID Connect, consent and PKCE, token validation and `mcp:read` restriction.
- **NOT DEPLOYED.** A dedicated Google OAuth client, authorized account,
  gateway credentials and final end-to-end tests are still required.

## Isolated Cloudflare OAuth storage

- KV namespace: `cloud-browser-chatgpt-oauth-stage-kv`
- KV ID: `3e4203c6a00545df9ba0202343afb8d7`
- Account ID: `e21cd8776c9beef277b3eb6f27ce5c58`
- This is new and empty, not reused from Finance Hub.
- An *example* Wrangler configuration exists; no active deployment config or
  deployment workflow exists for this gateway.

## Proposed staging URL

`https://cloud-browser-chatgpt-stage.dorjan-gjoni-dg.workers.dev/mcp`

Dedicated Google OAuth client settings:
- Client type: Web application
- Authorized redirect URI:
  `https://cloud-browser-chatgpt-stage.dorjan-gjoni-dg.workers.dev/callback`
- Authorized origin:
  `https://cloud-browser-chatgpt-stage.dorjan-gjoni-dg.workers.dev`
- Never reuse or change existing Finance Hub Google OAuth clients.
- Required GitHub **browser-agent-staging** environment secrets when ready:
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ALLOWED_EMAIL`.
- Existing forwarding secrets must stay in `browser-agent-staging`:
  `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`,
  `BROWSER_AGENT_API_TOKEN`.

## Security gates before deployment

1. Create a dedicated Google OAuth Web client, and allowlist the authorized
   Google account. Never paste the Client Secret into ChatGPT.
2. Validate initial sign-in, consent denial, provider errors, allowlisted
   Google ID token signature, issuer, audience, nonce, account identity,
   token expiry, refresh and revoke.
3. Confirm provider metadata advertises the exact MCP resource, supports CIMD,
   PKCE S256, and refresh-token behavior expected by ChatGPT.
4. Create a restricted staging deployment workflow and active Wrangler config
   after the Google credentials are securely saved; do not deploy before that.
5. Run protected MCP `initialize`, `tools/list`,
   `browser_agent_status`, `browser_inspect` and rejected write-action tests.
6. Connect the ChatGPT custom MCP plugin only after successful browser OAuth
   authorization and end-to-end testing.

The gateway's `forwardAuthorizedMcp` function permits only those two
read-only actions. All other tool calls are rejected before forwarding.
Cloudflare OAuthProvider is responsible for verifying issued bearer tokens;
the forwarding code requires the verified user ID and `mcp:read` scope.

## Preserve the working systems

Do not modify, merge or redeploy Finance Hub, its OAuth settings, its D1
database, or the existing Browser Agent stage worker in this process.
