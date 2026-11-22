# Finance MCP fast-path integration: reuse Finance Hub's existing snapshot save

Verified in `functions/api/finance.js`:
- `PUT /api/finance?resource=snapshot` validates a Cloudflare Access JWT for the Finance Hub Access application.
- The user is resolved from signed identity; snapshot is scoped to `workspace_id` and `user_id`.
- `expectedRevision` is required; a conditional D1 update increments the revision and returns 409 on conflict.
- The payload is a complete `finance-hub-backup` version 2 snapshot, capped at 1 MB.

## Critical distinction

The MCP gateway's Cloudflare Access application and JWT audience are **not the same** as the Finance Hub website's. The MCP gateway must not blindly forward its own JWT to the existing website endpoint, impersonate a browser session, or bypass the Finance Hub identity checks.

## Minimal safe implementation

1. Reuse the **existing conditional snapshot update semantics** inside the MCP gateway, with its independently verified Access identity and exact one-workspace membership.
2. Keep `FINANCE_MCP_WRITE_ENABLED` false until separately enabled after tests.
3. Limit changes to a single transaction's `category`, `provider`, or `description`. Read the current snapshot; verify the exact expected revision, old value, and transaction ID; change only that field in a copy. Never accept a caller-supplied full snapshot.
4. Require an explicit trusted approval bound to the exact user, transaction, revision, old/new values, and expiry. An MCP argument saying `approved:true` is not sufficient. Implement approval via a Finance Hub-authenticated confirmation screen, or another trusted, auditable confirmation path.
5. Before the conditional update, save a restorable backup and an audit event, with atomicity or compensating recovery demonstrated by tests. Never claim existing `PUT snapshot` provides these protections; it currently only provides revision checks.
6. On a stale revision, abort and require re-preview; never silently retry a modified snapshot.
7. After saving, verify the incremented revision and transaction field, while all other transaction IDs, financial fields, holds, and snapshot collections remain identical.

## Avoid duplicated infrastructure

Do not deploy the earlier standalone migration until the above minimal path has been evaluated. The pure guards and rollback tests can be reused, but the separate approval tables are not necessarily required.

## Release gate

Do not turn on financial writes or call the production D1 mutation endpoint until an end-to-end test against an isolated database passes and the exact change has trusted approval.
