# JJ Academy — Cloudflare Workers AI (free-tier pilot)

Status: UI and Pages Function committed. **Live deployment and binding are not verified.** No paid service was enabled.

## Architecture
- Public Academy URL: `https://jj-simon-knowledge.pages.dev/?topic=academy-study-assistant`
- Browser: `cloudflare-ai.js` adds an opt-in **Ask Cloudflare AI** button next to local **Find course answers**.
- Retrieval: the existing local indexed search selects up to 5 relevant Academy research summaries. The user question and those summaries are sent to `POST /api/ask`. Original full private transcripts and raw quoted excerpts are not sent.
- Server: `functions/api/ask.js` invokes `env.AI.run('@cf/meta/llama-3.1-8b-instruct', ...)` with bounded input and output; no external API key.
- Fallback: if binding or free-tier inference is unavailable, the local source search still works.

## One-time Cloudflare setup (requires account owner)
1. Open Cloudflare dashboard → **Workers & Pages** → the **JJ Academy Pages project** (not the main Trading Studio project).
2. Confirm Pages project build settings. The project should use the `jj-simon` directory as its build/output root, and the `functions/` directory must be included in the Pages Functions deployment. **Cloudflare Pages functions discovery can depend on project root and build configuration**; verify `GET /api/ask` after deployment. If `/api/ask` returns the site's HTML or 404, the Functions directory was not deployed; relocate or configure the Functions directory in the correct project root rather than exposing a client-side API key.
3. In **Settings → Bindings**, add a **Workers AI** binding named exactly `AI` (case-sensitive). Configure production and preview as appropriate. Deploy again.
4. Verify `GET https://jj-simon-knowledge.pages.dev/api/ask` returns JSON with `ready: true`. If `ready: false`, the AI binding is not connected. If 404, the Function is not deployed.
5. Open Study Assistant, enter a question with matching course material, click **Ask Cloudflare AI**. Confirm an answer and numbered source links. Test a question with no indexed matches: it must not call the AI.

## Budget/privacy
- Keep on the free Workers AI plan and confirm Cloudflare's current free allowance and billing settings in the account before enabling.
- No Vectorize, D1, paid AI Gateway or other paid infrastructure is required for this pilot.
- The service sends selected **already published** Academy research summaries and the question to Cloudflare's inference service. Never enter passwords, private financial information or unapproved private course transcripts.
- The backend does not intentionally persist questions or responses. Provider-side retention and processing follow Cloudflare's terms; review them for any private course materials.
- This endpoint is publicly callable by visitors to the website. It has request-size/output limits and same-origin browser checks, **but no durable per-user rate limit**. Before broad public release, add Cloudflare WAF/rate limiting or Turnstile, and keep usage within the free plan.
- If the AI service is not enabled, the button displays a clear error and local search remains available.

## Scope and verification
- This is grounded synthesis over the Academy's existing local index, not automatic crawling of the whole internet or private Drive.
- No existing trading rules, prop-firm risk settings, or calculator formulas were changed.
- GitHub syntax checks passed; live Cloudflare inference and deployment have **not** been verified.
