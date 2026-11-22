# Stage 4.6 — Local durable write-service prototype

**Security boundary:** This prototype is a **test-only Node.js component**, not a Cloudflare Worker, deployed MCP tool, browser action, or connected website editor. Do not deploy it as an API or expose it to the internet.

## What it demonstrates
- Dedicated SQLite file with durable test proposal, approval, fixture-content and audit rows
- Synthetic creator and reviewer roles, distinct identities, one-use approvals
- Strict proposed-text digest binding, 5-minute maximum approval lifetime, revision matching, request ID uniqueness
- Atomic transactional execution of an edit against a **single disposable fixture field** only
- Transactional rollback, audit event hash chain, and a kill switch
- Restart tests demonstrate proposals and approvals survive closing/reopening the database
- No production URLs, real identities, browser navigation, Cloudflare secrets, financial data or image uploads

## Important limitations
- Synthetic `{id, role}` identities are fixtures, **not verified OAuth principals**; never accept those objects from a live request.
- The SQLite file stores the fixture's proposed text to support restarts and rollback; this is safe only for artificial test content. Actual sensitive content must not be stored this way.
- The event hash chain proves internal consistency but is **not tamper-proof against a database administrator**; external anchoring and append-only storage are required.
- There is no cross-system transaction with an actual website, and no HTTP API, token validation, independent audit service, or manual approval UI.
- The emergency stop is process-local; a real service needs a durable, centrally enforced stop.
- The prototype is not suited to concurrent distributed Worker execution or production website editing.
- The existing `cloud-browser-agent-stage` Worker and `cloud-browser-chatgpt-stage` gateway remain read-only.

## Tests
`npm test` runs all Node fixture and isolation tests; the Chromium CI workflow separately exercises an ephemeral localhost website.

## Next release gate
Create a wholly separate staging-only write Worker with a real OAuth/write scope, per-site authorizations, independently controlled approver identity, database-enforced idempotency, durable kill switch, external audit anchoring, and recovery checks. Test against a disposable, authenticated, **non-production** website before any user-authorized production pilot.
