# Finance Hub Gmail financial evidence — installation

This integration does **not** read trading activity or execute trades. It scans financial-email candidates and sends only minimal evidence metadata (date, provider, email subject, original amount/currency where identifiable, source identifier and status) to Finance Hub.

## 1. Cloudflare setup (one-time, owner only)

1. Create a strong random secret in Cloudflare Pages project `fin` variable `FINANCE_GMAIL_SYNC_SECRET`. Use a random value of at least 32 bytes. Also add `FINANCE_GMAIL_SYNC_EMAIL` containing the *existing authenticated Finance Hub owner's email*.
2. Apply the D1 SQL migration: `finance/migrations/20261120_gmail_evidence.sql` to the existing `finance-hub-db` database. This table is user scoped. No accounting rows are edited.
3. In Cloudflare Zero Trust Access for the Finance Hub app, create a **service token** for Apps Script and an Access policy permitting that token to reach `/api/gmail-ingest`. **Do not bypass protection for other site paths.** Provide the service token Client ID and Client Secret only as Apps Script private properties.
4. Verify that unauthorized calls to `/api/gmail-ingest` fail and the regular Finance Hub pages remain protected. The endpoint additionally verifies HMAC timestamps and binds records exclusively to the configured owner, never a client-supplied user.
5. Deploy the updated Finance Hub Pages project; deploy workflow now includes the ingest function. Set credentials only in Cloudflare, never GitHub.

## 2. Apps Script setup (one-time)

1. Open [script.google.com](https://script.google.com/) while signed in to the Gmail account whose financial emails you want synced, and create a new project.
2. Copy `Code.gs` into the project and enable **Gmail API** under Services > Add a service. Under Project Settings, enable the manifest editor and use the supplied `appsscript.json` manifest (including **gmail.readonly** scope).
3. Project Settings > Script Properties: configure:
   - `FINANCE_INGEST_URL` = `https://fin-kac.pages.dev/api/gmail-ingest`
   - `FINANCE_SYNC_SECRET` = the same random Cloudflare secret
   - `FINANCE_ACCESS_CLIENT_ID` = Cloudflare Access service token client ID
   - `FINANCE_ACCESS_CLIENT_SECRET` = Cloudflare Access service token client secret
4. Run `installGmailFinanceSync` once and approve Google's OAuth prompts. The script needs Gmail **read-only** and trigger/external-request permissions. Confirm the install log indicates non-error 200 responses. The 15-minute trigger runs without your phone being open.

## 3. Operation and privacy

- Each scheduled run inspects recent financial messages plus up to two pages of 10 older Gmail candidates within a time limit. The historical backfill advances once each page is successfully accepted, and stops when it reaches the end. The expanded query automatically restarts the backfill once; duplicates are safely skipped.
- For fully unattended historical catch-up, paste the latest `Code.gs`, save it, choose `startGmailHistoryAutoImport` in the Apps Script function dropdown and click Run **once**. It creates one temporary five-minute catch-up trigger (if not already present), immediately runs a batch, then continues automatically until the search reaches `complete=true` and deletes only that temporary trigger. The ordinary fifteen-minute Gmail sync remains active. You can choose `stopGmailHistoryAutoImport` if you wish to stop just the temporary bulk importer. For manual catch-up, run `importGmailHistoryNow` instead. It processes up to eight 10-message pages or about three minutes, spacing pages to avoid Gmail API quota bursts and logs `complete=true` when the financial search reaches the end. If it reports `complete=false`, run the same function again, or let the existing 15-minute trigger finish the remaining pages. If Gmail reports a per-user quota error, the script preserves the current page cursor, logs a three-minute cooldown and resumes on a later run. Never add a second trigger.
- Finance Hub's Gmail Financial Inbox can now display paginated cloud records beyond the local browser snapshot cap. Click `Check Gmail sync`, use search/category filters, and `Show next 250 records`. Evidence is not posted to accounting totals without reconciliation.
- Every message uses its Gmail ID as a deterministic reference. Rechecks and restarts do not create duplicate D1 records.
- **New HTML amount enrichment:** after the historical capture finishes, the temporary five-minute trigger revisits the same Gmail search from the newest message and extracts amount/currency from HTML receipts. Previously blank Cloudflare evidence amounts are updated in place; existing amounts, categories, descriptions, status, and accounting balances are never overwritten. This second pass has a separate resumable cursor and reports `Gmail enrichment: ... enriched=N complete=true` when finished. It then deletes the temporary catch-up trigger, while the ordinary fifteen-minute sync remains.
- **Existing installations require one Code.gs update:** changes pushed to GitHub do not automatically replace the manually pasted Google Apps Script. Copy the latest `finance/gmail-sync/Code.gs` to the existing Apps Script project, save, and run `startGmailHistoryAutoImport` **once**. This reuses the temporary trigger if one exists, or installs one if historical import finished and the previous trigger was removed. Do not rerun `installGmailFinanceSync` or change any secrets.
- Unclear amounts and emails are stored for review only; they do not change account balances, expense totals or payouts.
- The Finance Hub UI reads the evidence through the **already-authenticated user session**; it cannot read another user's records.
- Gmail Apps Script does not share the OAuth token with Cloudflare. The app never stores full message bodies, OTPs, trade histories, or Gmail credentials.
- If the Gmail account contains historical finance evidence outside the search query, broaden query cautiously and run `resetGmailBackfill` to re-scan.
- Revoke the service token, delete the trigger, or revoke Gmail authorization to disable new synchronization. Existing evidence stays in private D1 unless separately deleted.
- Cloudflare / Apps Script quota limits and Cloudflare Access policies may affect actual scheduling; verify an end-to-end imported record before relying on the system.

## Important limitation

Google Apps Script cannot automatically receive the Gmail connection you authorized inside ChatGPT. The account owner must approve the new script explicitly. Do **not** place token secrets in this repository, public URLs, screenshots or chat messages.
