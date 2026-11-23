# API 1 — Isolated ChatGPT-compatible browser MCP proof of concept

**Status (2026-11-23):** a single-operator private ChatGPT Business plugin was registered and connected through an existing OpenAI Secure MCP Tunnel. Real read-only Chromium Wikipedia calls succeeded from ChatGPT. **Development-only**, no public deployment or production changes, no TinyFish automation engine.

## Objective

Expose our own Playwright/Chromium public-website workflow through an authenticated
MCP Streamable HTTP interface, so a standards-compliant MCP client can discover
and invoke the workflow and receive structured results plus actual PNG screenshots.

This implementation is registered as the **API1 Private Browser** custom plugin in the
approved private pilot workspace, using a pre-existing Secure MCP Tunnel and a local
tunnel-client on the same Codespace host. The MCP service itself remains bound only
to 127.0.0.1, with a bearer injected by the private tunnel-client from a protected
local file. The private pilot is available **only while those local processes run**.

This is **not** a publicly reachable production MCP server, a deployed Cloudflare Worker,
or a multi-user OAuth system. The ChatGPT-side "No authentication" setting is allowed
only for the approved restricted pilot and must not be used for general workspace access.
See `API1-PHASE2-READONLY-RELIABILITY-PLAN.md` for the evidence and remaining gates.

## Read-only boundaries

- Isolated branch and simulation/ directory only. Production Worker/MCP files
  under src/ are not modified or imported by the new interface.
- Loopback only: both MCP and browser API bind to 127.0.0.1 on ephemeral ports.
- Random bearer authorization at both independent boundaries; never expose
  keys in logs, CI artifacts, example code, documentation or responses.
- Only one narrowly scoped tool: `browser_automate_wikipedia_demo`.
- Input: `{"query":"James Webb Space Telescope"}` (plain-text only; 3–80 chars).
- No caller-selected URL, script, path, selector, login, cookie, upload, credential,
  approval or write operation.
- Browser requests are restricted to read-only GET/HEAD for approved Wikipedia
  HTTPS paths. Service workers, JavaScript, downloads, and permissions disabled.
- An isolated Chromium context is created and discarded per tool call.
- Requests are serialized; the server rejects simultaneous tool executions.
- Sanitized runtime error messages and bounded request/response sizes.

## MCP HTTP interface

- `POST /mcp` with `Authorization: Bearer <ephemeral-test-token>`.
- JSON-RPC modern `server/discover`, `ping`, `tools/list`, `tools/call`.
  Supports `2026-07-28` with per-request metadata and MCP protocol/method headers.
- Retains legacy `initialize`, `notifications/initialized`, `ping`,
  `tools/list`, `tools/call` for `2025-06-18`. Uses stateless HTTP JSON responses.
- `tools/call` returns `structuredContent` with step URLs, extracted article
  paragraphs, and click provenance, plus 3 `image/png` content blocks from
  real Chromium screenshots.

Example tool call body (no credentials):

```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"browser_automate_wikipedia_demo","arguments":{"query":"James Webb Space Telescope"}}}
```

## CI acceptance

Workflow: `.github/workflows/api1-real-public-automation.yml`

The first job runs deterministic, fully intercepted Chromium fixtures to confirm
MCP initialize/discovery/tool-call, PNG output, authentication rejection, URL
allowlisting and write refusal. The next job runs real public Wikipedia through
**both** the isolated existing API and the new MCP layer. Screenshots and a
credential-free `result.json` are uploaded only when the corresponding run occurs.

All live-site tests must be judged by their recorded CI run outcome, not by the
presence of source files. Public site availability can cause genuine live test
failures. Never bypass a failing live test by substituting a fixture.

## Next milestone — isolated reliability only

See `API1-PHASE2-READONLY-RELIABILITY-PLAN.md`. Next tasks are deterministic
security regression tests, navigation relevance/provenance and bounded clean article
extraction, while preserving exactly one read-only Wikipedia tool.

Do **not** merge, deploy, widen website access, enable writes, rotate credentials,
change tunnel configuration, or touch Finance or production without fresh approval.
