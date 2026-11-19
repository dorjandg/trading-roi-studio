# Finance Hub — integration implementation plan

## Verified live status (November 19, 2026)

**Production site:** https://fin-kac.pages.dev/ (Cloudflare Pages project `fin`, deployed independently from Trading ROI Studio).

The core authenticated cloud-sync implementation has been configured and user-tested: Cloudflare Access with Google sign-in, Cloudflare D1 database `finance-hub-db`, binding `FINANCE_DB`, validated JWT audience/team, owner bootstrap, private per-user snapshots, automatic saving and loading. An observed currency preference change synchronized from one authenticated browser to another. Owner identity is visible under Settings. Cloud revision checks prevent silent stale overwrites; concurrent divergent edits are **not merged**.

**Still to verify before marking multi-user security complete:** Dona and Doen need an actual sign-in and private-record isolation test. The Settings owner-only **Authorized Finance Hub users** panel (new change awaiting deployment) registers seven-day backend invitations; it does not send emails or automatically change the Cloudflare Access allow list. Existing account policy must explicitly include each invited email. Automatic service connections to external banks and trading providers are not implemented.

**Operations:** Manual GitHub workflow `finance-hub-deploy.yml` deploys the dedicated site. `finance-hub-checks.yml` runs UI/financial regression tests and the authenticated API isolation fixture. The old Trading ROI Studio `/finance/` page should not be treated as the protected production service. Reduce D1 API token write permissions after completing database setup. Maintain periodic JSON exports for recovery.

---

## Historical initial scope
The original website was a browser-local prototype; the verified live deployment and remaining limitations are recorded above.

## Deployment architecture
- Cloudflare Pages for static dashboard.
- Cloudflare Pages Functions or Workers for authenticated API routes.
- Cloudflare D1 for transactional records and workspace membership.
- Cloudflare R2 for receipts and screenshots, with private access.
- An identity provider using server-side validated sessions and enforced workspace membership on every request.
- Cloudflare Cron Triggers for permitted read-only scheduled sync.

## Required safeguards
1. Every query must derive workspace permissions from the authenticated session, not a caller-supplied workspace ID.
2. Use read-only credentials where available. Never store trading passwords or API secrets in browser localStorage or public GitHub.
3. Encrypt integration secrets with managed secrets/KMS; rotate and revoke credentials.
4. Import idempotently using provider external IDs and reconciliation.
5. Track expenses, deposits, trade P&L, funded payouts and transfers as distinct financial events; do not count internal transfers as income.
6. Preserve source currency and original transaction amounts. Apply dated FX rates only when reporting in a base currency.
7. Never claim API connectivity before authentication, account permissions, provider terms and test sync have been verified.

## FTMO
Investigate permitted cTrader/MetaTrader history access for each account. Platform trades do not automatically provide challenge purchases, reset fees or payouts. These require separate invoices or approved financial data sources.

## Topstep
Verify current TopstepX/ProjectX API eligibility, terms, read-only capability, subscription cost and token scopes before implementation. Treat broad-scope API credentials as highly sensitive.

## Import fallback
CSV/Excel import and email receipt reconciliation. Screenshots require a separate extraction/review flow before committing financial entries.

## Deployment checklist
- Provision private D1 database and bind to Worker.
- Configure auth provider and workspace memberships.
- Deploy authenticated API endpoints and run permission tests.
- Migrate locally stored records with explicit owner confirmation.
- Implement and test one provider adapter at a time.
- Validate Cloudflare production deployment and backups.

## Cloud save and restore rollout (completed for owner; onboarding guidance below)

The Finance Hub Settings page has **Check cloud access**, **Save to cloud**, **Restore from cloud**, and **Check for updates**. The API lives at `/api/finance?resource=snapshot` and requires the Cloudflare Pages Function to be deployed with a D1 binding and a validated Cloudflare Access JWT. No automatic two-way merge is implemented.

1. Create a Cloudflare D1 database for the Finance Hub. Apply `finance/schema.sql` using the Cloudflare dashboard or `wrangler d1 execute <database-name> --remote --file=finance/schema.sql` from an authorized environment.
2. In the **Cloudflare Pages project that serves the Finance Hub**, add a D1 binding named `FINANCE_DB` referencing that database. Confirm that the deployed project actually includes `functions/api/finance.js` and routes `/api/finance` to it; the current repository can be built differently for each Pages project.
3. Configure Cloudflare Zero Trust Access for the Finance Hub and its API, restricting access to approved identities. Add the Pages environment variables `CF_ACCESS_TEAM_DOMAIN` (e.g. `https://your-team.cloudflareaccess.com`), `CF_ACCESS_AUD` (the Access application audience tag), and `FINANCE_BOOTSTRAP_EMAIL` (Dori's verified login email). Do not commit these values or any private keys.
4. Deploy and sign in as the bootstrap administrator. In Settings, select **Check cloud access**. The API must return the verified identity and revision 0. The first **Save to cloud** creates revision 1; another save increments it. Test **Restore from cloud** only after downloading a local JSON backup.
5. Add Dona and Doen only through administrator invitations after their actual login emails are known. Every user's cloud snapshot is scoped to their verified identity, not to the display-name selector. Confirm a member cannot fetch or overwrite another user's snapshot.
6. Test on a second device. **Check for updates** reports a new revision without changing local data. **Restore from cloud** is an explicit replacement, not a merge. A stale save must receive HTTP 409 and must not overwrite the cloud copy.

**Deployment safety:** Do not assume that adding code to GitHub creates a D1 database, Access policy, environment variables, or a successful production deployment. Until those are configured and tested, use local JSON backups.


## GitHub-to-Cloudflare connection (manual opt-in)

The workflow `.github/workflows/finance-cloudflare-connection.yml` verifies a Cloudflare API token and a D1 database through GitHub Actions. It does **not** create the database, configure Pages bindings or Cloudflare Access, or deploy the site. Run it manually from **Actions → Finance Cloudflare connection check → Run workflow**.

1. In GitHub repository **Settings → Environments**, create `finance-cloudflare`. For production, add required reviewers to protect schema changes.
2. In that environment's **Secrets**, add `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_D1_DATABASE_ID`. Keep all values private. Never send tokens through chat or commit them.
3. Create a Cloudflare API token with only the required account D1 read permissions for verification. The optional schema operation requires D1 write permissions; prefer a separate short-lived token when doing migrations.
4. Run with **apply_schema = false** first. Inspect the GitHub Actions result for verification success.
5. Only after inspecting `finance/schema.sql` and confirming the target database is correct, explicitly select **apply_schema = true** to run the remote migration.
6. Configure the Pages D1 binding `FINANCE_DB` and Access JWT settings separately as described above. Verify the production API and two-device synchronization before calling it live.

This workflow is not an always-on ChatGPT connector: it is an auditable, manually triggered GitHub-to-Cloudflare connection.


## Standalone Finance Hub domain: fin.pages.dev

The Finance Hub remains in this repository but deploys independently via `.github/workflows/finance-hub-deploy.yml`. The workflow stages `finance/index.html` as the website root and `functions/api/finance.js` as the Pages Function. It targets a **separate** Cloudflare Pages project named `fin`, leaving Trading ROI Studio unchanged.

To activate:
1. The deployment workflow checks for the `fin` Pages project and attempts to create it as a Direct Upload project if missing. This requires a Cloudflare API token with Pages Edit permission; the project name must be available. It refuses to overwrite an existing Git-connected `fin` project. Do not attach it to Trading ROI Studio.
2. In GitHub's `finance-cloudflare` environment, configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token needs Pages deployment permissions. D1 verification also uses `CLOUDFLARE_D1_DATABASE_ID`.
3. Manually run **Deploy Finance Hub (separate site)** from GitHub Actions. Verify the deployment URL and confirm the API route is deployed. A successful code deployment does not provision the D1 database or authentication.
4. In Cloudflare Pages project `fin`, confirm that Cloudflare assigned `fin.pages.dev` to the new project (the name must be available). Do not switch the Personal Hub link until the new domain serves the expected website.
5. Configure D1 binding `FINANCE_DB`, Access application, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, and `FINANCE_BOOTSTRAP_EMAIL` on the **new project**, and verify authentication and cross-device cloud snapshots.
6. After the new domain is confirmed live, update `personal-hub/links.js` on branch `personal-hub` to point Finance Hub to `https://fin.pages.dev/`.

**Not yet live:** Repository workflow creation alone does not create the Cloudflare Pages project, assign DNS, deploy code, or verify the website.
