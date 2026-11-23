# API 1 — P2-D credential-free read-only health and safe recovery runbook

**Scope:** the existing single-operator private Codespace browser and OpenAI Secure MCP Tunnel. This runbook does **not** deploy, merge, enable writes, create tunnels, rotate credentials, change Cloudflare, or touch Finance. Both running services remain unchanged until the operator explicitly elects to do otherwise.

## What this tool can and cannot verify

New independent diagnostic: \`simulation/check-private-runtime-readonly.mjs\`.

The diagnostic reads only these endpoints on a **caller-specified loopback health port**:

- \`GET /healthz\`: tunnel-client process liveness (HTTP 200)
- \`GET /readyz\`: tunnel-client readiness (HTTP 200; 503 means not ready)
- \`GET /health\`: compact snapshot, including \`ready\`, \`live\`, \`schema_version\`, and fresh \`snapshot_at\` (maximum age 120 seconds)
- \`GET /health/control-plane\`: poller status; only \`status: ok, state: polling\` is considered healthy
- \`GET /health/queue\`, \`/health/dispatcher\`, \`/health/response-delivery\`: additional non-critical component evidence
- \`GET /health/mcp\`: limited transport evidence. The tunnel-client may explicitly report \`unsupported_transport\` for HTTP even while ordinary forwarding works.

On the **caller-specified loopback MCP port**, it performs **one unauthenticated \`GET /mcp\`**, expecting HTTP **401**. This proves only that the local port is reachable and rejects a request lacking authorization. It is **not** an MCP initialize, \`server/discover\`, \`tools/list\`, \`tools/call\`, authenticated access test, or browser execution.

All requests are fixed-path \`GET\` to \`127.0.0.1\` only. Redirect following is disabled. Response bodies are size-limited and never printed. The diagnostic does not read a key file, profile file, environment credential, raw HTTP logs, or any app data, and does not write files. Its output is a bounded classification of the observed responses.

**Important:** A ready health snapshot cannot prove ChatGPT workspace association, correct tunnel ID, end-to-end response delivery, or ongoing availability. To test those, a separately approved, normal read-only ChatGPT browser invocation is required.

## Operator invocation — only when needed

Keep Terminal 1 (browser) and Terminal 2 (tunnel-client) running. In an independent Codespace terminal, obtain the **current** ports from their already visible startup output:

- MCP port: number in \`API1_PRIVATE_MCP_LOCAL_READY.mcpUrl\` (example form \`http://127.0.0.1:PORT/mcp\`)
- Health port: number in tunnel-client's printed \`health_url\` (\`http://127.0.0.1:PORT\`)

From \`/workspaces/trading-roi-studio/workers/cloud-browser-agent\`, run:

\`\`\`sh
node simulation/check-private-runtime-readonly.mjs --health-port HEALTH_PORT --mcp-port MCP_PORT
\`\`\`

Replace \`HEALTH_PORT\` and \`MCP_PORT\` with those two current **numeric** ports; the command has **no defaults**. Do **not** paste actual credentials or a bearer header. Any invalid/ambiguous port is refused before network access.

A successful local snapshot prints \`API1_READONLY_HEALTH\` with \`overall: "ready_snapshot"\` and exits 0. \`overall: "limited"\` means the extended health snapshot is not supported; it is not proof of a working full connection. \`overall: "attention"\` exits 2 and requires review; the script will not attempt recovery.

## Decision guide (manual only)

| Evidence | Meaning | Safest next operator action |
| --- | --- | --- |
| \`mcpBearerBoundary: authorization_required\` | Expected unauthenticated HTTP 401 on this private port | No change needed based on this fact alone |
| \`mcpBearerBoundary: unreachable\` | The **specified** MCP loopback port could not be reached | Check Terminal 1 and whether its displayed port changed; do not restart other processes |
| \`mcpBearerBoundary: unexpected_mcp_response\` | This port did not require the expected bearer | Stop before continuing; investigate which process owns the port; do not send credentials |
| \`tunnelLiveness: unreachable\` | The **specified** health listener cannot be reached | Check Terminal 2 and its new/ephemeral health port |
| \`tunnelReadiness: not_ready\` | Tunnel is alive but startup/readiness requirements are unmet | Inspect health components; readiness alone is not a reason to restart the MCP process |
| \`controlPlane: degraded\` | Local poller reported a problem, perhaps backoff | Inspect control-plane state and retry behavior; do not change the key automatically |
| \`tunnelSnapshot: stale\` | Timestamp older than 120 seconds or too far in the future | Check local clock/snapshot source and avoid treating stale data as live |
| \`mcpHealth: http_transport_evidence_limited\` | Expected information gap for HTTP MCP transport | Do not mistake this for tool-list failure; use the actual registered tool only in a separately approved test |
| \`overall: ready_snapshot\` | Local tunnel reported ready/polling and MCP port enforced auth | Good local evidence **only**; does not establish an end-to-end ChatGPT call |

## Safe stop/recovery order (manual and approval-gated)

1. Prefer inspecting the last already-printed Terminal 1/2 startup logs, not regenerating credentials, running raw HTTP capture, or changing tunnel config.
2. Confirm the correct current ephemeral MCP and tunnel health ports; rerun the read-only diagnostic only if justified.
3. If a process genuinely exited, request the operator's action before restarting it. Do not kill unknown PIDs, run multiple tunnel-client instances, or replace profile/keys based only on a readiness failure.
4. To apply newer GitHub development code, **separately approve** a local fast-forward checkout and a controlled stop/restart of the two private processes. GitHub commits do not update running Node processes.
5. If the connected plugin becomes unavailable, treat it as unresolved; never silently fall back to another tunnel or public endpoint.

## Regression coverage and CI gates

\`test/private-runtime-readonly-health.test.mjs\` uses disposable in-process loopback HTTP fixtures only. Tests cover: healthy status, read-only requests without Authorization, strict explicit-port validation, missing MCP target, unexpected unauthenticated MCP success, readiness and poller backoff/recovery, stale snapshots, redirect refusal and secret-bearing response redaction. No tests use real credentials, real tunnel configuration, a Codespace runtime, or the Finance service.

Both existing branch CI workflows must pass on the final commit; the browser workflow still includes the unrelated real Wikipedia smoke to guard against regressions. No new deployment workflow is added.
