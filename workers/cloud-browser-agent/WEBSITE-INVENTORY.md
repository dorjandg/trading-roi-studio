# Website and application inventory — Cloud Browser Agent

Updated: 2026-11-22
Source: known cross-project ChatGPT work and verified Browser Agent config. Personal-context cross-chat search was not available for exhaustive verification. Entries are candidates, not claims that every site has a working authenticated session.

## Connection modes
- **Live allowed, read-only** = present in deployed Worker `ALLOWED_ORIGINS` (only inspection; no login/actions).
- **Candidate, not approved** = relevant service/domain known from project history, not in Worker allowlist.
- **Connector/API first** = prefer existing Google/GitHub/other official APIs over browser clicks.
- **Sensitive/financial** = separate scoped credentials and explicit user approval for writes, no trading or fund transfers.

| System | Known website(s) | Status | Preferred future method | Management scope |
|---|---|---|---|---|
| Finance Hub | https://fin-kac.pages.dev | Live allowed, read-only | Existing Finance Hub MCP/API first | Financial dashboard and transaction reports; preserve approval gates |
| JP Realty staging | https://jp-realty.pages.dev | Live allowed, read-only | Browser + GitHub/Cloudflare | Website QA and property publishing with approval |
| JP Realty public | https://realty-jp.com | Candidate, not approved | Browser + CMS/app API | Public site checks and editorial work |
| YouTube AI Academy | https://youtube-ai-academy.pages.dev | Live allowed, read-only | Site API + GitHub/Cloudflare | Channels, lessons and translations |
| Trading ROI Studio | https://trading-roi-studio.pages.dev | Live allowed, read-only | GitHub/Cloudflare; browser QA | Calculators and site fixes |
| Google Cloud Console | https://console.cloud.google.com | Candidate, not approved | Google Cloud API; browser only for unsupported tasks | Cloud projects and OAuth; sensitive approvals |
| Google Auth | https://accounts.google.com | Authentication provider only — do not browser automate | OAuth login | Account consent/sign-in; no credential extraction |
| Gmail | https://mail.google.com | Candidate, not approved | Existing Gmail connector | Mail search, drafting and user-approved sending |
| Google Drive | https://drive.google.com | Candidate, not approved | Existing Google Drive connector | Find and manage files |
| Google Docs | https://docs.google.com | Candidate, not approved | Existing Google Docs/Sheets connectors | Documents and spreadsheets |
| Google Calendar | https://calendar.google.com | Candidate, not approved | Google Calendar API/connector when authorized | Scheduling |
| GitHub | https://github.com | Candidate, not approved | Existing GitHub connector | Code, PRs, Actions |
| Cloudflare dashboard | https://dash.cloudflare.com | Candidate, not approved | Scoped Cloudflare API; browser for unsupported configuration | Workers, Pages, KV, D1, Access |
| Glam Lingerie preview | https://studio-preview.glam-lingerie.com | Candidate, not approved | Site application controls/API | Catalog and editorial work |
| Glam Lingerie site | https://glam-lingerie.com | Candidate, verify exact use | Site application controls/API | Public site and catalog |
| JP Realty hub | https://hub.immamarketing.com | Candidate, not approved | Hub API / browser | Central project link directory |
| YouTube Studio | https://studio.youtube.com | Candidate, not approved | YouTube official API | Channel metadata/content |
| TradingView | https://www.tradingview.com | Candidate, not approved | User-facing platform/API where supported | Charts/indicators; no trades |
| Topstep | https://www.topstep.com | Sensitive candidate, not approved | Account exports/official integration where supported | Read-only account/report data |
| FTMO | https://ftmo.com | Sensitive candidate, not approved | Official integration / reporting exports | Read-only payments/expenses |
| Lucid Trading | Exact account portal URL not verified | Sensitive candidate, not approved | Official integration / exports | Read-only reports |

## Deployment constraints
1. Do not equate a website's inclusion here with access authorization.
2. Do **not** append this whole inventory to `ALLOWED_ORIGINS`. The deployed Worker currently approves **only four origins**.
3. Never automate passwords, MFA approvals, Google Account security settings, trading execution, payouts, bank transfers, payments or account deletion.
4. Prioritize APIs/connectors; use browser automation only where it adds real value.
5. For future interactive browsing, separate anonymous site checks from authenticated sessions. Encrypt credentials/session storage; least privilege, domain-specific allowlists, approval-gated writes, audit logs, and kill switch required.
6. Keep Finance Hub production, its existing MCP and Google sign-in separate from this new staging gateway.

## Implementation phases
- **Current**: read-only inspection `browser_agent_status`, `browser_inspect` on four exact approved HTTPS origins. Protected MCP stage previously passed end-to-end tests. ChatGPT OAuth gateway connection is pending full verification/deployment.
- **Next**: safe browser navigation and screenshots, per-domain permission model, user-approved click/type workflows for non-sensitive administrative tasks, rate limits and auditing.
- **Later**: authenticated sessions and Google Cloud management via official APIs, followed by carefully scoped site editing workflows.
