# API1 browser interaction phase 1 (isolated)

This branch contains **proposal validation only** for click and fill operations.
The proposed operations are **never executed**, never wired into the worker handler or MCP tools, and never deployed.

## Security boundaries
- Existing read-only API, origin allowlist, GET/HEAD network interception, and authentication remain unchanged.
- No login automation, secret extraction, upload, submit, approval, payment, or production write operation.
- Each proposal returns requiresApproval=true and executionAllowed=false.
- Future execution requires separate reviewed implementation, authenticated per-action consent, target origin restrictions, one-use confirmation, safe element matching, and audit logs.
- Existing isolated CI exercises the proposal validator tests.

No production deployment is authorized by this document.


## Staging-readiness security review (2026-11-23)

Source-reviewed production `src/handler.mjs` and `src/mcp.mjs`: the HTTP and MCP surfaces expose read-only inspection, links, form inventory, and preview functionality; no click/fill/submit/upload tool is wired into the deployed entry points. `src/handler.mjs` has a separately gated preview-audit persistence option, which is not permission to write to websites.

**Not staging-ready for website interaction.** The local harness `approve()` is self-issued by test code, not independently authenticated user authorization. Audit receipts are in-memory and recorded after fixture actions, not durable pre-execution evidence. Its 100 ms event observation window and network aborts are not proof against delayed or local browser side effects. Cancellation after dispatch cannot undo the event. No approved staging identity/authorization integration, external approval verifier, durable audit transaction, or real-site rollback guarantee has been established.

`simulation/staging-readiness-gate.mjs` is an isolated design-only checklist. It fails closed when evidence is missing and **never** returns execution permission even when every boolean is supplied. It does not verify the truth of supplied evidence and must not be treated as a production authorization mechanism.

**Release boundary:** Do not import simulation modules into production handler/MCP, expose interaction tools, enable website writes, merge or deploy until independent authentication, origin-scoped single-use approvals, auditable fail-closed persistence, and a separate authorized staging review are implemented and verified.


## Isolated signed-grant simulation (2026-11-23)

`simulation/isolated-approval-grants.mjs` models HMAC-SHA256 signed, 60-second maximum, principal/session/action-digest/origin-scoped grants with one-time consumption through an injected atomic reserve-and-audit interface. Tests simulate replay races, tampering, scope changes, expiry, and audit failure. This is **not** an authentication service: the issuer accepts caller-supplied principal evidence, its signing key is supplied by tests, and the included audit store is in-memory rather than durable. Real deployment would require an independent identity provider, external trusted approval service, key lifecycle management, atomic durable storage, and separate security authorization. Even successful simulated verification returns `executionAllowed:false` and cannot operate a browser or website.


## Offline file-backed ledger durability simulation (2026-11-23)

`simulation/file-approval-ledger.mjs` uses a disposable local filesystem root, atomic per-grant directory creation, a synced audit file and a commit marker. A reserved grant is never automatically retried: interrupted transactions remain quarantined and replay attempts are rejected. Tests cover competing ledger instances, restart/reopen, and failures after reservation, audit write and commit acknowledgement. The simulator returns no execution authorization and has no browser integration.

**Not a production durable ledger:** directory metadata is not explicitly fsynced, filesystem durability and distributed consistency vary, a local directory is not a shared database, there is no authenticated operator recovery protocol, and the caller controls the test root. A real design needs transactional shared storage with uniqueness constraints, verified atomic audit+reservation, disaster recovery, and independent security review. Never connect this file-backed simulator to deployed Workers, MCP or website actions.


## Offline SQLite transactional ledger prototype (2026-11-23)

`simulation/sqlite-approval-ledger.mjs` is Node 22 `node:sqlite` test-only code. It uses WAL, FULL synchronous mode, BEGIN IMMEDIATE, a UNIQUE primary-key grant ID, and atomic insertion of a consumed-grant audit row. Tests cover concurrent independent connections, rollback before commit, reopening after commit, and acknowledgement loss after commit (must reject replay). All verifier responses still set `executionAllowed:false`.

**Security review:** SQLite transactions are a stronger local consistency demonstration than the prior directory ledger, but the prototype is not a production shared datastore, distributed approval service, identity provider, or externally verified audit authority. It assumes trusted local filesystem access, does not protect against compromised host or key, and does not prove physical power-loss durability or multi-region behavior. Node's `node:sqlite` API is experimental in Node 22. Never import simulation modules into Worker/MCP or connect them to website actions. No deployment or production writes are authorized.


## Isolated D1-compatible approval ledger design (2026-11-23)

`simulation/d1-approval-ledger.mjs` defines a D1-compatible schema and `prepare().bind()`, `batch()`, `first()` interface for an isolated approval-consumption audit. A single primary-key row records both grant consumption and the audit event; uniqueness conflicts reject replay. After batch commit the adapter reads back and verifies all scope fields. Failed writes, uncertain acknowledgements and failed verification never authorize execution. Unit tests use an in-memory D1-shaped fake to simulate concurrent replay and failure modes; **these tests do not run against actual Cloudflare D1 and do not prove Cloudflare transaction semantics, durability, cross-region consistency, or recovery**. No D1 database, binding, migration, Worker route, or deployment was created. The module remains simulation-only, without any production imports or real website action integration. Independent authentication, authenticated approval issuance, real D1 integration testing and a deployment review are still required.


## D1 API contract review — offline follow-up (2026-11-23)

Added `test/d1-approval-ledger-contract.test.mjs` to exercise the D1-shaped `prepare().bind()`, `batch()` and `first()` contract, including ambiguous commit acknowledgement, failed audit reads, and stored-field mismatches. The schema uses one `grant_id` primary-key row for both consumption and audit to avoid cross-table partial success. The tests run only against a fake binding; they are **not evidence of actual D1 compatibility or durability**. A future isolated real-D1 acceptance run must verify D1's batch rollback/atomicity, primary-key constraint errors, cross-request concurrent insert behavior, read-after-write consistency, and outage/retry semantics using a disposable database and no production bindings. Do not interpret a green local test as permission to enable website interactions.


## Disposable D1 acceptance preparation

Added `simulation/disposable-d1-acceptance.mjs` and its tests. The contract requires an explicitly supplied disposable D1-compatible binding and has no Wrangler command, network connection, remote fallback, production binding or browser execution path. It verifies schema setup, a single grant consumption and audit readback, and duplicate-grant rejection. Current CI exercises this contract against a fake D1-shaped binding only; **no actual Cloudflare D1 test database was created or tested**. A real local D1 test should be separately reviewed and run with an isolated ephemeral database and no `--remote`, account credentials or production bindings. Never use production D1 for acceptance tests.


## Local disposable D1-shaped integration (2026-11-23)

`simulation/local-d1-sqlite-binding.mjs` implements a restricted subset of the D1 `prepare/bind/first`, `batch`, and `exec` API using Node 22 SQLite on a temporary local file. CI tests execute the existing D1-shaped acceptance contract against an actual local SQLite database, verify replay rejection across independent connections and reopen, and reject unrelated SQL. This is **not the Cloudflare D1 runtime**, does not exercise remote or local Wrangler D1, and cannot prove Cloudflare D1 semantics. It is intentionally disconnected from production, real websites and all Cloudflare credentials. Further acceptance requires a separate disposable D1 instance and explicit non-production binding review.


## Cloudflare local D1 integration via Miniflare

CI installs Miniflare 3 and runs `test/miniflare-d1-integration.test.mjs` against an in-memory, disposable local D1 binding (`TEST_ONLY_DB`). No Cloudflare account, Wrangler remote flag, production D1 database, deployment or website interaction is used. Tests cover schema creation, atomic grant replay rejection, audit readback and concurrent attempts. Miniflare exercises Cloudflare's local D1 implementation, but does not prove production remote D1 multi-region behavior, disaster recovery or availability. All test grants are synthetic.


## Visible browser screenshot prototype (offline)

`simulation/visible-browser-preview.mjs` renders a PNG from a disposable `about:blank` HTML fixture using isolated Playwright Chromium. Its network route aborts every external request; it accepts no website URL, credentials, existing page, browser profile, or interaction commands. `test/visible-browser-preview.test.mjs` checks the PNG signature and confirms zero network requests and no execution authorization. This prototype demonstrates screenshot capture only: **it is not a live browser window embedded in ChatGPT, nor a screenshot of an approved staging website**. The connected Browser Agent MCP tools currently expose no screenshot output. Real approved staging screenshots require separate explicit allowlisting, privacy review, and a safe screenshot-return interface. No production Worker or MCP code is changed.
