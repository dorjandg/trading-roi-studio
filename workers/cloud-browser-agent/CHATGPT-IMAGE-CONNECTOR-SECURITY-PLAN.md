# API 1 — ChatGPT image connector registration and security review (PLAN ONLY)

Status: **NOT APPROVED FOR REGISTRATION OR DEPLOYMENT**. Applies only to `api1-browser-interaction-phase1`.

## Verified implementation
- `src/mcp.mjs` registers six text-only read-only tools. It has no image tool and uses bearer authorization, a strict RPC request-size limit, and approved HTTPS target validation.
- `src/handler.mjs` has a `/screenshot` PNG route, but that route uses approved HTTPS URLs; it is **not** suitable for the synthetic-only preview and must not be exposed for this milestone.
- `simulation/persistent-visual-session.mjs` creates offline synthetic Chromium tabs and blocks all external requests.
- `simulation/chatgpt-mcp-image-preview.mjs` generates MCP-style image content offline, with up to three fixture actions and four frames. This is not registered or remotely reachable.
- `simulation/authenticated-frame-bridge.mjs` binds loopback only with a session-scoped bearer capability; it must not be proxied or exposed publicly.

## Proposed registration design (future, separate approval)
1. Create a **separate isolated MCP test entrypoint** rather than editing or importing into deployed `src/mcp.mjs`. It must not inherit the real website allowlist, real browser bindings, production tokens or financial capabilities.
2. Advertise a single `synthetic_frame_preview` tool, with a closed schema: `actions` (0–3 commands, only fixture tab switches, index navigation or +/-1 history) and `maxFrames` (1–4). No URL, script, HTML, credentials, or arbitrary file inputs.
3. Launch a disposable browser for each invocation; return at most four `{type:"image",mimeType:"image/png",data:"<base64>"}` blocks plus a text metadata block explicitly declaring `live:false`. Enforce aggregate response-byte and execution-time ceilings.
4. Do not retain sessions or frame data between calls in this first connector milestone. A future persistent viewer would require separate authenticated session ownership, expiration, concurrency, cancellation, cleanup and replay controls.
5. Before any remote deployment, independently review identity and OAuth scopes, tenant isolation, origin and CSRF rules, frame redaction, denial-of-service controls, audit metadata (without image contents), rate limits, data retention, and plugin permissions. Require explicit user approval for deployment and connector registration.
6. Verify a private test connector with image-capable MCP tool results; confirm ChatGPT actually renders image blocks. Do not claim live browser control until a supported persistent tool transport exists.

## Security gates / stop conditions
- No production changes, merges, deployments, public URLs, real websites, credential exposure, financial calls, or write permissions.
- Fail closed on arbitrary destinations, redirects, external network requests, nonfixture commands, oversized images, invalid PNGs, unauthenticated requests, and malformed tool input.
- Confirm the six existing production tools remain unchanged in any isolated integration test.
- Keep synthetic preview capability separate from the deployed `/screenshot` route, which can fetch approved websites.
- An MCP response containing image blocks does **not** itself establish an accessible or live ChatGPT browser. The plugin needs an explicitly approved and reachable endpoint before ChatGPT can invoke it.

## Acceptance checklist
- [x] Existing connector and image prototype inspected.
- [x] Security review and registration sequence documented.
- [x] Dedicated test-only MCP entrypoint implemented with CI test coverage.
- [ ] Image response and isolation tests pass in CI (pending latest run).
- [ ] User explicitly approves any future connector registration or deployment.
- [ ] Authenticated ChatGPT image rendering verified after that approval.

No existing tool registration or deployed configuration is changed by this document.

## Implemented test-only entrypoint

`simulation/synthetic-image-mcp-entrypoint.mjs` exports an in-memory Request-to-Response JSON-RPC handler requiring a caller-supplied test bearer secret (minimum 32 characters). It advertises only `synthetic_frame_preview`; all browser actions use fixture identifiers and bounded integer indices. Requests with Origin headers, missing authorization, unknown tools, real URLs or oversized JSON are refused. It returns MCP image blocks generated in a new disposable Chromium session per call. No listener, production import, connector registration, deployment, or remote access is created. Test suite: `test/synthetic-image-mcp-entrypoint.test.mjs`.
