# Finance Hub — proposed ChatGPT correction actions (NOT DEPLOYED)

Status: **design only**. The connected Finance Hub MCP gateway currently reports `writeAccess:false` and exposes no mutation action. This document is not an authorization to enable writes.

## Required read-only tools

### finance_correction_preview
Input: `{transaction_id,field,expected_revision,expected_value,new_value}`.
- Accept only a canonical existing UUID, one field from `category`, `provider`, `description`, and a nonempty new string up to 300 characters.
- Authenticate the calling principal and resolve exactly one workspace membership. Bind the transaction to that principal's own snapshot; never accept workspace/user IDs from the caller.
- Verify the transaction occurs exactly once, expected revision and old value match; return exact before/after, revision, expiry and opaque signed approval ticket.
- Preview never writes and must not imply authorization to save.

### finance_correction_save
Input: `{transaction_id,field,expected_revision,expected_value,new_value,approval_ticket,confirmed:true}`.
- Expose only after owner explicitly approves enabling controlled writes and isolated deployment tests pass.
- Require a fresh, explicit user confirmation **for that exact before/after**. The model must not synthesize confirmation from a generic “go,” previous consent or preview alone.
- Enforce owner/admin membership, enabled feature flag, ticket HMAC, expiration, user/workspace binding, exact values, current revision and original field value.
- Perform backup + compare-and-swap snapshot update + audit in one D1 transaction. If any step fails, no writes may remain.
- Return only `{saved:true,transaction_id,field,revision,backup_id}` after verifying committed result; do not return raw snapshot or secret material.
- A repeated approval ticket must not apply twice: revision mismatch rejects replay.

## Deployment isolation

- Do **not** use `finance-mcp-gateway-stage` as a safe write sandbox: its `FINANCE_DB` was observed bound to production `finance-hub-db`.
- Use a new isolated Worker and the separate `finance-correction-isolated-test` D1 database for end-to-end `db.batch` tests. Use dummy workspace, principal and transactions only.
- Do not expose the production signing secret to ChatGPT, logs, GitHub, or browser JavaScript. Tickets are opaque, short-lived, and tied to the authenticated caller.
- Only deploy a production action after a complete verified production backup, migration review, passing CI, owner approval and rollback plan.
- Never alter transaction amount, currency, date, type, reporting holds, IDs or unrelated snapshot arrays. Two FTMO credit notes remain on hold.
- For errors, fail closed. Do not retry a write blindly. Fetch revision and reconcile.

## Open implementation questions

1. Determine whether the connected Finance Hub MCP provider supports adding tools dynamically or requires publishing a new gateway/plugin version.
2. Verify Cloudflare Access JWT validation end-to-end in an isolated Worker. Never trust caller-supplied identity.
3. Verify actual Worker `db.batch` semantics and transaction audit/backup read-back, not only a mocked handler or D1 SQL Console.
4. Ensure user-visible confirmation is enforced by the host/tool authorization process, not only an LLM-generated boolean.
5. Verify the `description` field maps to a real snapshot field and does not silently create unused metadata.
