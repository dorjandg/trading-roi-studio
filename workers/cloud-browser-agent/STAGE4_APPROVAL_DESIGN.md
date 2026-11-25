# Browser Agent Stage 4 approval and audit design

## Current implementation (staging)
- `browser_edit_preview` is **read-only**, operates on one exact labeled text/textarea field, and requires OAuth `mcp:read`.
- Preview runs browser with all network methods except GET/HEAD aborted. It does not call `fill`, `click`, `submit`, or `upload`.
- Each successful preview returns `proposalId`, computed from a SHA-256 digest of the operation descriptor and proposed text. It includes an **ephemeral response-only** audit event with the proposed text replaced by a hash.
- `approval.grantIssued = false`, `approval.canExecute = false`, `audit.durable = false`, and `audit.storage = NONE`.
- There is **no** endpoint or MCP tool to approve or execute edits. The `denyApprovalExecution` helper fails closed.
- Browser session cleanup is mandatory even on error.

## Required for a future write-capable release (NOT IMPLEMENTED)
1. Separate **isolated, non-production target site** and **separate Cloudflare Worker and token**. Never reuse read-only `mcp:read` for write actions.
2. Dedicated identity with role restrictions and per-site / per-field allowlists. Explicit `mcp:write` consent; ensure OAuth authorization and Cloudflare Access identities map to a real accountable actor.
3. Immutable proposal record in an isolated Cloudflare D1 database: proposal_id, canonical URL, field locator and type, proposal hash, approver ID, creator ID, expiry, environment, status, deployment version, and idempotency key. Do not persist passwords, current form values, tokens or credentials.
4. Short-lived approval tied to exact proposal ID and digest, never accepted from an LLM-generated `approved=true` argument. Approval and execution must be separate operations, and require confirmation from the actual account owner.
5. Before execution re-fetch the target form; verify identity, origin, exact field locator and page revision. Abort on mismatch, stale approval, missing audit storage, retries or rate limits.
6. Bounded write sandbox: only approved actions, origin-restricted requests, no financial transfers, no purchases, no login/admin credential changes, no production website writes until a separate authorization milestone.
7. Append-only audit events with actor, timestamp, request ID, hashed payload, previous record hash, before/after *non-sensitive status* and rollback marker. Verify audit persistence before executing.
8. Post-execution verification must compare authorized result with live page; preserve emergency disable flag, rollback plan and replay protection.
9. Image uploads require separate MIME, size, malware and content checks; never enable based on text-edit approval.
10. End-to-end adversarial tests: prompt injection on target pages, hidden fields, approval substitution, race conditions, redirect and cross-origin attempts, duplicate submissions, network failures, and role escalation.

## Release gate
**DO NOT ENABLE WRITES** until every gate above is implemented, documented, integration-tested on an isolated fake website and separately approved for each allowed production site.
