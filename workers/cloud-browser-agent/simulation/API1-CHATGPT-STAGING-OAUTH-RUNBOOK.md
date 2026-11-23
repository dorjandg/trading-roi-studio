# API 1 — ChatGPT connector staging and OAuth runbook

**Status: DESIGN / ISOLATED CI ONLY. Not deployed, not connected to ChatGPT, not a production authorization implementation.**

## Objective and current baseline

Replace TinyFish with our own browser automation MCP in stages. Existing isolated source:
- \`simulation/real-public-automation.mjs\`: independent Playwright Chromium; public Wikipedia GET navigation/search/click/extraction/PNG.
- \`simulation/real-public-automation-api.mjs\`: short-lived bearer-protected loopback API.
- \`simulation/isolated-real-browser-mcp.mjs\`: short-lived loopback MCP initialize/ping/tools/list/tools/call.
- \`simulation/oauth-staging-readiness.mjs\`: **pure staging/OAuth metadata templates and release checks, NOT token verification**.
- \`simulation/run-oauth-staging-preflight.mjs\`: offline CI evidence with the staging gate deliberately blocked.

No protected resource metadata or OAuth authorization flow is **served by the current loopback MCP**. The current bearer token is generated per local launch and is **not** a replacement for OAuth when ChatGPT connects remotely.

## Target architecture (future, separate approval required)

\`\`\`text
ChatGPT custom MCP connection
    | HTTPS + MCP Streamable HTTP
    | (OpenAI-managed mTLS client identity if supported at chosen edge)
    v
Dedicated STAGING ingress and host (not Finance Hub or production)
    |  GET /.well-known/oauth-protected-resource [public metadata]
    |  POST /mcp [OAuth token required, no anonymous automation]
    v
Resource-server OAuth middleware
    | verify issuer, audience/resource, signature/JWKS (or introspection),
    | exp, nbf, scopes, authorized test user and revocation
    v
Isolated MCP dispatcher: one tool, browser_automate_wikipedia_demo
    | allowlisted read-only input; rate limits; failure isolation
    v
Ephemeral Playwright Chromium runtime
    | GET/HEAD only, en.wikipedia.org/wiki/* + public search
    | service workers/downloads/uploads/account access disabled
    v
Structured result + PNG screenshots (bounded; sensitive logs redacted)

Separate OAuth 2.1 Authorization Server (pre-existing vetted provider)
    | metadata; auth-code + PKCE S256; client identity via CIMD/DCR
    | authorization and token requests receive resource=<canonical staging MCP resource>
    | access tokens minted for staging audience only
\`\`\`

### Stage identity and configuration

- **Resource ID**: \`https://<approved-dedicated-staging-host>\` (exact HTTPS origin, not /mcp).
- **MCP endpoint**: \`https://<approved-dedicated-staging-host>/mcp\`.
- **Protected resource metadata**: \`GET /.well-known/oauth-protected-resource\`.
- **Expected metadata**: \`{resource, authorization_servers:[<exact-OAuth-issuer>], scopes_supported:["browser:wikipedia.read"], bearer_methods_supported:["header"]}\`.
- **Unauthorized request**: HTTP 401 with \`WWW-Authenticate: Bearer resource_metadata="https://<staging-host>/.well-known/oauth-protected-resource", scope="browser:wikipedia.read"\`.
- **Tool authorization declaration**: \`_meta.securitySchemes=[{type:"oauth2",scopes:["browser:wikipedia.read"]}]\`; when triggering the ChatGPT OAuth UI from a tool, return an authentication error with \`_meta["mcp/www_authenticate"]\` after checking token authorization.
- **No production reuse**: separate staging name, Cloudflare environment/Worker, service identity, OAuth audience, secrets, logs, rate limits and storage. Do not reuse Finance Hub Access sessions, API 2 Finance signing keys or production D1 bindings.

### OAuth provider acceptance

Select an established OAuth 2.1 provider **after** a read-only assessment. Do not build a new authorization server from scratch for this milestone. A simple Google/Cloudflare Access session cookie alone does not demonstrate an MCP-compatible OAuth access-token flow.

Verify issuer and exact string matching:
1. Provider publishes \`/.well-known/oauth-authorization-server\` or \`/.well-known/openid-configuration\` over HTTPS, with stable issuer and HTTPS authorization/token endpoints.
2. \`response_types_supported\` includes \`code\`; \`code_challenge_methods_supported\` includes \`S256\`. **No implicit grant or password grant.**
3. Choose one client registration strategy: prefer supported CIMD; otherwise DCR or pre-registered client. Confirm token endpoint auth methods, e.g. \`none\` for PKCE public client or \`private_key_jwt\` with correct JWKS for signed assertions. Do not assume provider supports CIMD merely because it has OAuth.
4. Provider honors RFC 8707 \`resource\` on authorization AND token requests, copies the staging resource ID into the access token audience or equivalent verifiable claim, and refuses production/other resource tokens.
5. Check RFC 9207 issuer identification. Where supported, provider advertises \`authorization_response_iss_parameter_supported: true\` and returns exact \`iss\` on all success/error redirects; use the redirect URI **shown in the ChatGPT MCP connection management UI**. Do not guess or pre-register callback IDs.
6. Resource server validates JWT signatures using a maintained verifier with pinned algorithms and trusted JWKS/issuer, or securely introspects opaque tokens. Enforce \`iss\`, \`aud\`, expiration, not-before, \`browser:wikipedia.read\`, authorized test identity, revocation and key rotation **on every request**. This has **not** been implemented in API 1.
7. Keep scope at \`browser:wikipedia.read\`. Do not expose arbitrary URL, login, form submission with POST, financial access, screenshot uploads, persistent browser sessions or script execution.

### HTTPS staging and private-testing choices (NO ACTION NOW)

**Option A — Dedicated HTTPS staging**: After approval, create a separate isolated staging deployment and OAuth provider tenant. Terminate HTTPS at a dedicated ingress, require verified user access tokens on every MCP request, and keep Chromium execution in an isolated compute environment. Cloudflare Worker environments do **not** automatically provide a suitable Playwright/Chromium runtime; validate browser-runtime compatibility before deciding Worker vs container. Review SSRF/DNS rebind defenses, egress allowlists, TLS/mTLS trust, concurrency, request/response limits and IP throttling.

**Option B — Secure MCP Tunnel for private evaluation**: OpenAI documents an outbound-only private MCP tunnel. This may avoid a public staging ingress for early private ChatGPT trials, **but creating and running a tunnel and registering it with ChatGPT still requires a separate approval**. It is not suitable by itself for public plugin submission. Do not start or configure the tunnel during this phase.

**Both options are future work**. The current code remains bound only to 127.0.0.1 and no DNS, callback, IdP, GitHub environment secret, Cloudflare resource or ChatGPT plugin registration is created.

### Security, operations and rollback acceptance checklist

The staging project is NOT ready until all are independently demonstrated:

- Isolated staging owner, host, runtime, DNS, secrets and data boundaries are verified, with no access to the Finance Hub or production deployment namespace.
- HTTPS certificate and remote MCP protocol negotiation pass real tests.
- Authorization server metadata, PKCE S256, registration strategy, real callback allowlist and resource-parameter roundtrip are tested.
- Every MCP request has cryptographically verified resource-bound access token, required scope, user identity and least-privilege policy. Missing/invalid tokens produce 401 challenge and tool-level auth error.
- Client identification via supported mTLS configuration is reviewed; where used, validate OpenAI's CA chain and appropriate SAN rather than pinning a leaf fingerprint. Client identity never replaces user authorization.
- Egress is restricted and verified; redirect destination checks and hostname/IP safety are tested; only read-only Wikipedia operations are accepted.
- Browser is disposable and isolated: no login/cookies carryover, persisted downloads, service workers, unsafe navigation, or write endpoints.
- Timeouts, per-user quotas, concurrency caps, screenshot/response limits, log redaction, security audit and provider-token revocation tests pass.
- CI includes malformed JSON-RPC, cross-origin/host spoofing, unauthorized requests, missing/wrong issuer/audience/expiry/scope, metadata corruption, key rotation, replay/revocation, cancellation, and kill-switch tests.
- No leaked credentials or live-user data in artifacts, logs, screenshots or Git commits.
- Separate human review records explicit permission for **staging deployment and connector registration**, along with rollback owner, staging teardown procedure and operational budget.

**Rollback plan after a future approved staging launch**: disable staging route and connector, revoke OAuth clients/tokens, rotate affected staging keys, terminate isolated Chromium sessions, disable secrets/egress, inspect redacted logs and remove staging resources. Do not touch production while reverting staging.

### What the current isolated CI can certify

The offline tests exercise metadata construction and provider metadata shape checks. They do not prove live OAuth, identity, TLS, DNS or remote ChatGPT compatibility. The existing live Wikipedia tests prove a narrow browser MCP workflow only and do not prove OAuth.

The output of \`run-oauth-staging-preflight.mjs\` is intentionally \`BLOCKED_PENDING_REAL_STAGING_AND_OAUTH_REVIEW\`. Even when future evidence flags are set, the helper never returns deployment authorization; explicit human approval remains mandatory.

### Official reference documents (verify at actual launch)

- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels

No deployment commands are included or executed by this runbook.


## Synthetic OAuth JWT resource-server simulation (isolated CI only)

This phase adds:
- \`simulation/mock-oauth-jwt.mjs\`: fixed-algorithm Ed25519 ("EdDSA", "at+jwt") JWT signature verifier against an injected **test public JWK**. Enforces exact synthetic issuer, singular resource audience, allowlisted subject, \`iat\`, \`nbf\`, \`exp\`, maximum token lifetime and exact \`browser:wikipedia.read\` scope.
- \`simulation/mock-oauth-mcp-gateway.mjs\`: localhost-only **mock** OAuth resource-server boundary. Serves simulated RFC 9728 metadata and a \`WWW-Authenticate: Bearer\` challenge for unauthorized MCP requests. On unauthorized \`tools/call\`, emits an MCP \`isError\` result containing \`_meta["mcp/www_authenticate"]\`, with distinct \`invalid_token\` and \`insufficient_scope\` codes.
- \`test/mock-oauth-mcp-gateway.test.mjs\`: CI-generated ephemeral Ed25519 key pair (private key never written). Tests valid token, incorrect issuer/audience/subject, expired/not-yet-valid tokens, scope mismatch, wrong signature/algorithm/kid, malformed JWT and invalid requests. Also proves authorized mock calls reach an isolated Chromium fixture, while rejected calls do not start Chromium.

**Critical:** This is a simulation of the *resource server's* token verification and challenge contract, not a working OAuth 2.1 authorization server. No code-exchange or PKCE session is performed, no tokens are issued to a real browser or ChatGPT client, and no real JWKS fetched. Do not accept mock tokens in staging/production. A future live implementation must use a maintained OAuth/JWT verifier, real audience-specific issuer metadata, trusted JWKS rotation or introspection, revocation, and identity policy. The protected resource metadata in local tests references intentionally nonexistent \`.example.invalid\` addresses, not a deployed HTTPS server.

After adding this mock, **the release remains blocked** until the separate staging and security checks above are approved.
