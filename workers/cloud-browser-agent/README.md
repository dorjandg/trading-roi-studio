# Cloud Browser Agent — Phase 1 (staging only)

An independent Cloudflare Browser Run Worker for **read-only** checks of our approved websites. The Finance Hub gateway is not modified.

## Implemented
- Authenticated `GET /health`
- Authenticated `POST /inspect` (title, headings, link count, HTTP status)
- Authenticated `POST /screenshot` (PNG)
- Exact origin allowlist; HTTPS only; blocks main-frame cross-origin redirects
- No logins, clicks, typing, uploads, trading, arbitrary URLs, or external MCP integration yet

## Security and operation
- Set a unique secret: `npx wrangler secret put AGENT_API_TOKEN` (never commit it).
- Update `ALLOWED_ORIGINS` with **only domains owned and approved**.
- Use independent Cloudflare staging credentials and deploy only when explicitly ready.
- Protect the Worker with Cloudflare Access or an equivalent edge policy in addition to the bearer token before enabling production.
- This is not a bot-evasion tool. Browser Run is identifiable as automation.
- Screenshots can contain private information. This phase has no authenticated website sessions; avoid sensitive pages.
- Never use this service to submit financial transactions or trades.

## Local tests
```sh
cd workers/cloud-browser-agent
npm install
npm test
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
