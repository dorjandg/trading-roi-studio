# Finance Hub — integration implementation plan

## Current status
The website is a browser-local prototype. No credentials are collected. No live APIs, multi-user login, server database, or background sync are active.

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
