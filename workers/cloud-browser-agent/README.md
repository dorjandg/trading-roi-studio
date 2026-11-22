# Cloud Browser Agent — Phase 1 (staging only)

An independent Cloudflare Browser Run Worker for **read-only** checks of our approved websites. The Finance Hub gateway is not modified.

## Implemented
- Authenticated `GET /health`
- Authenticated `POST /inspect` (title, headings, link count, HTTP status)
- Authenticated `POST /screenshot` (PNG)
- Exact origin allowlist; HTTPS only; blocks **all third-party requests**, including cross-origin redirects\n- Isolated browser context for every request; service workers and downloads disabled
- No logins, clicks, typing, uploads, trading, arbitrary URLs, or external MCP integration yet

## Security and operation
- Set a unique secret: `npx wrangler secret put AGENT_API_TOKEN` (never commit it).
- Update `ALLOWED_ORIGINS` with **only domains owned and approved**.
- Use independent Cloudflare staging credentials and deploy only when explicitly ready.
- Protect the Worker with Cloudflare Access or an equivalent edge policy in addition to the bearer token before enabling production.
- This is not a bot-evasion tool. Browser Run is identifiable as automation.
- Screenshots can contain private information. This phase has no authenticated website sessions; avoid sensitive pages.\n- Strict same-origin requests may remove third-party CSS, fonts and images; visual fidelity is deliberately limited in phase 1.\n- No browser session or public deployment is active. GitHub Actions tests do not start billed browser sessions.\n- The handler has mocked endpoint tests for unauthorized calls, invalid JSON, disallowed URLs, missing bindings, inspection, screenshots, and resource cleanup. Local execution passed 15/15 tests on Node 22 (not an actual Cloudflare runtime test).
- Never use this service to submit financial transactions or trades.

## Local tests
```sh
cd workers/cloud-browser-agent
npm install
npm test\nnode --check src/index.js
```

## Stage deployment (not executed)
```sh
npx wrangler deploy
```

Call with a bearer token:
```sh
curl -X POST "$AGENT_URL/inspect" -H "Authorization: Bearer $AGENT_API_TOKEN" -H "Content-Type: application/json" -d '{"url":"https://fin-kac.pages.dev/"}'
```

## Next phases
1. Validate on one public staging website; capture actual smoke-test evidence.
2. Add durable job IDs, concurrency quotas, spending limits and R2 result storage.
3. Add restricted, approval-gated browser actions for non-sensitive administrative tasks.
4. Register the service behind the existing personal MCP **after** the Finance Hub branch is stabilized.
5. Isolate any trading-specific execution behind separate credentials, explicit approvals and firm-policy checks.

## Staging deployment gate (not yet met)
1. Provide a Cloudflare deployment route with appropriately scoped Worker permissions (do **not** expose full-account admin tokens).
2. Set `AGENT_API_TOKEN` as a **Cloudflare Worker secret** via Wrangler; never paste a secret in ChatGPT or commit it.
3. Protect the staging Worker at the edge using a dedicated Cloudflare Access application and explicit allowlist.
4. Confirm Browser Run is enabled and check plan/runtime charges before launching billed sessions.
5. Perform a single read-only smoke test on a public approved site. Record the HTTP status and screenshot only if no personal data appears.
6. Connect the MCP only after the staging smoke test succeeds and the Finance Hub API branch can be updated without conflict.

## Current development status
- Draft PR #4: https://github.com/dorjandg/trading-roi-studio/pull/4
- Local policy and mocked handler tests: 15 passed; no live browser validation.
- No production deployment, no Cloudflare secrets committed, no trading integrations.

## Alternative to ChatGPT Work: GitHub Actions deployment

Cloudflare's GitHub integration is connected but its setup form does not offer a branch selector before creation. We therefore added `.github/workflows/cloud-browser-deploy-stage.yml` to deploy the development branch through GitHub Actions without changing the repository's default branch.

The deploy job is deliberately **disabled by default** and runs only when:
- GitHub repository variable `BROWSER_AGENT_DEPLOY_ENABLED=true` is configured.
- GitHub environment `browser-agent-staging` contains scoped `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and a newly generated `BROWSER_AGENT_API_TOKEN`.
- Repository variable `BROWSER_AGENT_ACCESS_READY=true` is configured after verifying Cloudflare Access protects the stage Worker.

Security note: an existing GitHub `finance-cloudflare` environment has Cloudflare credentials. **Do not copy or reuse the Finance environment automatically**; scope a separate stage deployment token to the intended Worker/account permissions. The browser staging environment currently has no secrets configured.

No token values are stored in this repo. The deploy workflow cannot start paid browser execution on its own, and no live Browser Run checks occur until a user or MCP explicitly calls the protected Worker.
