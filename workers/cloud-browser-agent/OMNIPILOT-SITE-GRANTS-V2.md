# OmniPilot site-grant policy v2 — isolated development specification

Status: **development branch only; not enabled in the live OAuth gateway or browser Worker**.
Do not modify existing staging secrets, the Finance application, trading production, or any
Cloudflare Access policy to test this policy.

## Why v2

The deployed v1 site-grant policy is a small, static list of public-reference origins.
It has no per-path expiration. The v2 parser is backward-compatible with v1, but new
permissions should use short-lived v2 records with an exact origin and path prefix.

Each v2 grant must be explicitly reviewed by the operator. A ChatGPT tool request
cannot grant itself another origin. OAuth `mcp:site.read` and
`mcp:site.interact` are **independent** permissions; neither automatically
adds or renews a site-grant record.

### Format (illustrative, not a live configuration)

```json
{
  "version": 2,
  "sites": [
    {
      "origin": "https://en.wikipedia.org",
      "mode": "read",
      "pathPrefix": "/wiki/",
      "expiresAt": "2026-11-26T00:00:00.000Z",
      "maxActions": 0
    }
  ]
}
```

The example expiry may no longer be valid; calculate a fresh future UTC
timestamp during review. Version 2 enforces:

- Exact HTTPS origin only; no wildcards, userinfo, alternate ports, IP hosts,
  internal addresses, or DNS wildcard services.
- Canonical slash-ended `pathPrefix` (e.g. `/wiki/`), verified at initial
  planning, navigations, and runtime results; no query-string requests or
  cross-origin page actions.
- Expiration: read grants at most **30 days** in the future; draft grants at
  most **24 hours** in the future. Expired permissions fail closed.
- Read mode uses `maxActions: 0`; draft mode may authorize **1–3** bounded
  actions per request. No submissions, uploads, payment, authentication
  fields, or persistent-write claims.
- Finance, owned production sites, and private OmniPilot infrastructure
  remain hard-denied independently of operator-entered grants.
- Browser Run starts a fresh hostname-guarded session for each request and
  closes it, including after failures. Unknown results are not auto-retried.
- Returned JPEG screenshots remain capped at **36 KB**, using a smaller
  image if necessary.

## Expansion workflow

1. **Identify the site and permission**. Capture exact origin, the narrowest
   safe path prefix, read versus non-submitting draft mode, intended expiry
   and action budget. Public read sites can be proposed without handling
   private credentials.
2. **Review operator ownership and sensitivity**. Never authorize private,
   Finance, production, financial-action, authentication, email, banking, or
   credential sites merely because they are reachable or a prompt requests
   them. Authenticated browsing needs a separate profile and vault design.
3. **Prepare a reviewed v2 JSON diff**. Reject a request that silently
   replaces an existing grant, extends permission duration, or widens path
   access. The current staging v1 policy must be intentionally migrated;
   never automatically convert it to a broader v2 policy.
4. **Test** with `npm` and the isolated
   `api1-omnipilot-site-boundaries.yml` workflow. Run a real guarded
   public-site acceptance on disposable/browser-safe pages.
5. **Deploy only to isolated staging** through the established protected
   environment and secret-preserving Wrangler procedure, preserving
   `OMNIPILOT_MANAGED_PILOT_ENABLED=true`, OAuth secrets, Access
   restrictions, the audit database, and the existing ChatGPT plugin.
6. **Check and audit** tool discovery, OAuth scope separation, denial of
   unapproved origins, expiry, path scoping, screenshot, session cleanup,
   and rollback behavior before widening any active grant.

## Not yet included

Per-user OAuth-subject-bound grants, dynamic approvals, a secure credential
vault, login sessions, general form submission, persistent website writes,
remote desktop, and automatic grant renewal are **not yet implemented**.
A v2 origin configured in a Worker is an operator-scoped grant, **not**
a per-user delegation. Those capabilities require separate design, security
review, explicit consent, and tests. Do not claim universal authenticated
website control until that work is complete.
