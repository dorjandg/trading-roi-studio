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
