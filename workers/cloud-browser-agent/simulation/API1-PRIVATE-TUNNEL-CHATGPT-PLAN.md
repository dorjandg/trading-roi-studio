# API 1 — Private ChatGPT connection, shortest safe path (approval-gated)

**Status:** prepared in isolated branch, **not activated**. No tunnel, live plugin, real OAuth provider, HTTPS staging deployment, production modification or merge occurred.

## Decision: private Secure MCP Tunnel first

For a personal, single-user proof of concept, use OpenAI **Secure MCP Tunnel** from a dedicated test host to our existing localhost Chromium MCP server. A public Cloudflare Worker/Pages deployment is **not required** for this pilot.

This does NOT replace real OAuth 2.1 authorization for public or multi-user service. A tunnel controls transport association and permissions; it is not a guarantee of per-user application authorization. This mode is only for one operator in a tightly restricted personal test workspace. Never set "No authentication" for broad-workspace or public access.

Architecture (future, after approval):
\`\`\`
ChatGPT private custom MCP plugin (restricted test workspace)
    | Connection = Tunnel / No authentication for single-user demo only
    v
OpenAI-hosted Secure MCP Tunnel (requires authorized tunnel_id)
    ^ outbound HTTPS, authenticated with restricted runtime key
tunnel-client on the SAME private test host as our MCP
    | injects local Authorization header from 0600 file reference
    v
http://127.0.0.1:<ephemeral-port>/mcp
    | existing independent bearer authentication
    v
Isolated MCP dispatcher, only browser_automate_wikipedia_demo
    | 127.0.0.1 private API with separate bearer
    v
Fresh isolated Chromium / Wikipedia GET-only automation
\`\`\`

## What was prepared automatically (no activation)

- \`private-tunnel-prep.mjs\`: creates random per-run MCP bearer, writes \`authorization.header\` to a new mode-0700 temporary directory with file mode 0600, starts 127.0.0.1 MCP listener. Readiness JSON contains **only the endpoint and a reference to the credential file**, never the bearer value.
- \`launch-private-tunnel-target.mjs\`: an **opt-in** local launcher. Does not start a tunnel, register anything in ChatGPT, deploy code or launch a browser until a valid tool call reaches its one allowed tool. SIGINT/SIGTERM closes the listener and deletes the temp directory.
- \`test/private-tunnel-prep.test.mjs\`: tests secret-file permissions, auth-required MCP discovery, absence of bearer from readiness output, and deletion on shutdown.

## Security model for the first private test

Use one private ChatGPT workspace with only the authorized tester. Obtain separate Platform tunnel permissions: the tunnel creator needs **Tunnels Read + Manage**; the operator needs **Tunnels Read + Use**, and an appropriate restricted tunnel runtime credential. Do not use an admin key as the polling/runtime key. The ChatGPT workspace must be associated with the correct tunnel/Platform organization.

Keep both processes on the *same host*:
- \`launch-private-tunnel-target.mjs\` exposes MCP **only** on \`127.0.0.1\`.
- \`tunnel-client\` polls OpenAI outbound over HTTPS. Never expose port \`/mcp\`, the local tunnel UI, Playwright debug ports or the bearer secret to the public internet.
- Supply the MCP-side header through the tunnel-client's supported **static extra header secret-file reference** (not a literal token).
- Disable OAuth discovery for this first static-bearer pilot: \`MCP_OAUTH_DISCOVERY=disabled\`. Do not advertise mock OAuth metadata, set a fake issuer, or select OAuth in ChatGPT for this no-auth pilot.
- ChatGPT custom MCP connection **No authentication** is acceptable only for the explicitly isolated, single-user pilot. The MCP itself still demands the bearer injected by the local tunnel-client, and the OpenAI tunnel is restricted by workspace/tunnel permissions.
- Avoid broad access and do not accept interactive arbitrary website URLs, uploads, logins or write tools.

**Important**: the tunnel-client's connector-forwarded headers take precedence over static MCP headers. Use the No Authentication mode with no caller bearer for this pilot, and verify the injected header via a local diagnostic test before plugin creation. Do not treat static local auth as end-user OAuth.

## One-time operator phase — NOT AUTHORIZED OR EXECUTED YET

1. Identify the target ChatGPT workspace, personal Platform organization and approved isolated host. Verify tunnel feature availability and permissions. Reuse an authorized existing private tunnel only if its workspace/organization associations and ownership are verified.
2. On that host, use a dedicated copy of our isolated branch with Node 22 and matching Playwright Chromium runtime. Never run the finance production Worker; do not share Finance secrets or production Cloudflare namespaces.
3. **Only after approval**, start \`node simulation/launch-private-tunnel-target.mjs\` in \`workers/cloud-browser-agent\`. Keep this process running. Copy its local MCP URL and *credential file path only*. Do not copy or paste the credential value.
4. Create or select a private tunnel under OpenAI Platform tunnel settings with the operator's explicit approval. Provision a runtime key with **Tunnels Read + Use** (not an admin key) using a secure local input/credential manager. Keep the actual value out of chat, shell history, source code and artifacts.
5. Install the supported \`tunnel-client\` version from the official release. Configure its main MCP binding with the printed \`MCP_SERVER_URL\`, and:
   - \`CONTROL_PLANE_TUNNEL_ID\` = the approved tunnel ID;
   - \`CONTROL_PLANE_API_KEY\` = a secure local environment reference to the runtime key;
   - \`MCP_OAUTH_DISCOVERY=disabled\`;
   - \`MCP_EXTRA_HEADERS\` = \`Authorization: file:<path-to-the-authorization.header>\` (the path is not secret; **the file content is**).
   The tunnel-client docs support static MCP extra headers backed by \`file:\` or \`env:\` references. Never use a literal bearer in argv or config.
6. Run \`tunnel-client doctor --profile <approved-profile> --explain\`; verify the target is reachable and authenticates, then start \`tunnel-client run\` with its documented profile parameters. Require a healthy \`/readyz\` and active polling; stop on any auth or role error. Do not bypass verification or weaken server authentication.
7. **Only after separate connector-registration approval**, in ChatGPT Plugins click **Add custom MCP server**, choose Connection **Tunnel**, select the approved tunnel and the **No authentication** mode for the single-user pilot, inspect risk warning, then Create. Install it in that same workspace.
8. Verify that ChatGPT discovers exactly one tool \`browser_automate_wikipedia_demo\`; ask it to search Wikipedia for \`James Webb Space Telescope\`. Confirm a real page click, extracted title/paragraphs and three screenshots. Record proof without bearer values. This step has **not** happened.
9. Stop the tunnel-client and local launcher after the test. The launcher deletes its ephemeral bearer file. Revoke the test runtime key and delete the plugin/tunnel if they are no longer required.

Commands in the official documentation must be confirmed against the *actual installed tunnel-client CLI help* after approval; do not assume this document activates any tunnel.

## Precise stop conditions / release gate

Stop immediately before any of the following without explicit user approval:
- creating or associating a tunnel, provisioning its runtime key, or installing/running a tunnel-client daemon;
- adding a ChatGPT custom MCP connector/plugin, selecting No authentication, registering OAuth callbacks or authorizing a real identity;
- deploying to Cloudflare/other HTTPS staging, changing DNS, merging branches, or modifying production or finance systems.

Other blockers requiring operator review: no permissions, no suitable private host, no available personal/workspace tunnel association, inability to forward the bearer header, or an enterprise workspace where anonymous app-level access is inappropriate. In those cases, switch to a separately reviewed real OAuth resource-server design; **never** disable bearer verification or expose MCP publicly to make a test pass.

## Source references (verified for the planning date)

- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://github.com/openai/tunnel-client/blob/master/docs/configuration.md
- https://github.com/openai/tunnel-client/blob/master/docs/connectors.md

This is private-pilot preparation, **not** completed ChatGPT connectivity, production OAuth, or a finished TinyFish replacement.
