# Finance Hub — release and verification checklist

Updated: 2026-11-19

Production: https://fin-kac.pages.dev/ (Cloudflare Pages project `fin`).

## Confirmed in user-observed live sessions

- Google / Cloudflare Access login (owner, one invited member).
- Authenticated `GET /api/finance?resource=me` returned the owner role.
- Private Cloudflare D1 database and `FINANCE_DB` Pages binding worked.
- Manual snapshot save and restore succeeded.
- Automatic snapshot revision incremented after a setting change.
- Currency preference loaded on a second device with the **same** authenticated Google identity.
- Settings displayed the verified email, role, and cloud status.

## Added but NOT yet verified on the live deployment

- Workspace hidden until authenticated and cloud identity verified.
- Browser-local record isolation on account switching: clear previous user's current cache after preserving only unsynced records.
- Per-account currency/report filter reset on account switching.
- Browser tests for financial overview, P&L, prop-firm ROI, mobile navigation, account switching, and conflict-safe saves.

## Tests that should run for every relevant commit

- `node finance/test.cjs` — source syntax, structure, accounting fixture checks.
- `node finance/auth-isolation.test.cjs` — signed JWT identity, uninvited-user rejection, per-user snapshot isolation, 409 stale-write rejection.
- `npx playwright test finance/browser.spec.cjs --browser=chromium` — UI, mobile, financial display, account switch, and concurrency behavior.

The GitHub workflow **Finance Hub checks** runs these on finance source changes. The separate deployment workflow requires source and authenticated API checks before publishing.

## Deployment prerequisites and follow-up

1. Inspect GitHub **Finance Hub checks** for a green result; a source commit by itself is not a production test.
2. Deploy through **Deploy Finance Hub (separate site)** on `main`; verify the production domain.
3. On the owner's device, open Settings; confirm the current account, `Up to date`, and expected cloud revision. Export a JSON backup before testing recovery.
4. Test the new account-switch guard in a non-sensitive browser with two approved logins. Verify the former user's records are not visible under the new identity.
5. Verify an existing member can see only their own cloud records. Verify the remaining invited member when they are ready.
6. Check mobile menu, reports, prop-firm fees and payouts with test data. Remove test data afterward.
7. Redeploy/verify the older Trading ROI Studio site separately before claiming the old `/finance/` path redirects; the standalone Finance Hub deployment cannot prove that.
8. Change the GitHub Cloudflare API token's D1 permission from **Edit** to **Read** after schema migrations (if no further D1 writes are planned through the token). Cloudflare Access and Pages binding remain independent of this token.
9. Keep periodic offline JSON backups for recovery. Cloud snapshots are per-account latest-version backups, not immutable version history.

## Boundaries

- No automatic merge of concurrent conflicting edits; the app pauses and preserves local changes.
- The app is not a bank feed or accounting system of record. CSV imports and prop-firm entries remain manually curated.
- A shared computer/browser is not equivalent to a separate browser profile. Local unsynced recovery copies may remain in the browser. Prefer separate OS/browser profiles for different people.
- Do not publish or commit account credentials, Access JWTs, OAuth secrets, or financial records.
