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
