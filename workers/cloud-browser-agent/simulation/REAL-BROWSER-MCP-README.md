# API 1 — Isolated ChatGPT-compatible browser MCP proof of concept

**Status:** development-only, no deployment, no production changes, no TinyFish automation engine.

## Objective

Expose our own Playwright/Chromium public-website workflow through an authenticated
MCP Streamable HTTP interface, so a standards-compliant MCP client can discover
and invoke the workflow and receive structured results plus actual PNG screenshots.

This implementation is **not** registered as a ChatGPT connector. ChatGPT cannot
reach a service bound only to 127.0.0.1 from its cloud environment. Connecting it
for real would require a separately approved, publicly reachable HTTPS gateway
with proper user OAuth/Access authorization and production security review.
Do **not** interpret local MCP compatibility as completed ChatGPT installation.

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
- JSON-RPC `initialize`, `notifications/initialized`, `ping`,
  `tools/list`, `tools/call`.
- Declares MCP protocol version `2025-06-18` (stateless HTTP JSON responses).
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

## Next milestone (not authorized here)

An externally reachable authenticated MCP connector for ChatGPT, including OAuth
client setup, verified identity-to-tool authorization, remote transport hardening,
consent review and explicit staging deployment approval. This current project
intentionally does not create or activate any of those resources.
