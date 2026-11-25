# OmniPilot OAuth-subject grant isolation — development handover

Status: **isolated source and synthetic tests only. Not deployed.**

The new modules are deliberately NOT imported by the live gateway entrypoint
or MCP forwarding handler. They do not add tools, expose endpoints, access OAuth
credentials, update storage, authorize websites, or affect the current nine-tool
OmniPilot staging connection.

## Trust boundaries

1. The existing OAuthProvider validates the access token, scopes and audience.
   Google OIDC verifies issuer, nonce, Google client, and the allowed login.
   Identity for future grants may come ONLY from the verified OAuthProvider
   ctx.props.userId, never HTTP headers, MCP tool arguments or browser content.
2. A separate server-managed HMAC key converts the verified Google subject
   and canonical issuer into a pseudonymous subject key. Never log raw IDs,
   email addresses, OAuth tokens, form values, cookies or passwords.
3. The OAuth scopes mcp:read, mcp:site.read and mcp:site.interact are
   necessary but insufficient. Approval also requires a current, subject-bound
   grant narrower than the existing operator-controlled v2 site policy.
4. Operator approval must be independently verified. The approver cannot be
   the same subject as the grant recipient. The existing single-account
   Google login does NOT yet support independent operator approval.
5. Per-user grants may never widen the exact HTTPS origin, slash-terminated
   path prefix, expiration or non-submitting action budget. Protected Finance,
   production and private infrastructure origins remain hard-denied.
6. The backend Cloudflare Access service token is not a user identity.
   Enforce all subject grants at the verified OAuth gateway before forwarding.

## Lifecycle and audit

The pure ledger supports REQUESTED, APPROVED, DENIED and REVOKED transitions.
The requester can only request its own grant. Independent operator approval
requires the exact current revision and a still-active global site policy.
The grant owner or verified operator may revoke; a duplicate revocation does
not create another audit event or reinstate permission.

Audit events are HMAC-linked with an audit key separate from the subject-key
key. They contain only pseudonymous actor/subject keys, opaque grant/event IDs,
revision, event type, time, previous hash, target digest and immutable terms
digest. The chain detects modification, truncation, incorrect ordering, or
attempted grant widening. It never includes raw IDs, emails, credentials,
screenshots or browser text.

Revocation prevents subsequent fresh authorizations. It DOES NOT YET cancel
a browser operation already in flight; an ownership/revocation fence and
session cancellation are required before promising immediate in-flight abort.

## Isolated storage and deployment restrictions

The migration at migrations/0001_omnipilot_subject_grants.sql is a proposal
only and was NEVER applied. It creates new OmniPilot-specific grant and audit
tables with compare-and-swap revision constraints, append-only audit triggers,
and a unique open grant per subject and origin. The separate adapter at
src/omnipilot-subject-store.mjs requires a dedicated isolated D1 binding,
uses parameterized SQL, and reads through withSession('first-primary').
Uncertain commits are never blindly retried.

Do not apply the migration to any Finance, production, existing browser audit
or OAuth KV database. Do not add a binding to existing staging until separately
reviewed. Do not insert a broad grant into existing public site controls.

## Independent operator evidence (new isolated module)

The prototype at `src/omnipilot-operator-proof.mjs` checks an RS256
Google-signed ID token with a pinned/trusted Google verification key, exact
configured OAuth audience, allowed issuer, short-lived issuance/expiry,
verified email, and a server-issued one-time nonce. It derives a pseudonymous
Google subject key using the same dedicated HMAC as the grant recipient.
A server-owned operator allowlist must contain that key, and operator
and recipient must be **different Google subject keys**.

This module is not a second live sign-in flow: the existing gateway allows
one Google account, so a genuinely independent operator still requires a
separate, reviewed login and consent path. An operator cannot self-assign
its own role, supply a verification key or bypass the nonce from browser
content. The isolated nonce module at `src/omnipilot-operator-nonce-store.mjs`
now supplies a **proposed** D1-backed callback: cryptographically random
operator nonces are stored only as HMAC digests, bound to the expected
operator key and authorization session, and consumed by an atomic
single-use UPDATE within five minutes. Its SQLite contract is in
`migrations/0002_omnipilot_operator_nonces.sql`. Both modules have
synthetic tests but **are not wired, applied or deployed**. The eventual
trusted OAuth session owner must issue the nonce and pass a verified,
server-held session key; user-controlled identifiers are never acceptable. Current tests
use generated synthetic RSA key pairs and fake one-time nonce state; no
actual Google credentials or real operator identity were used.

## Browser-session cancellation fence (new synthetic module)

The pure `src/omnipilot-revocation-fence.mjs` models a per-grant serialized
owner with fresh authorization reads and exact session ownership.
Revocation blocks new registrations/actions **before** committing the grant's
revoked state. Once the durable revision update is confirmed, it closes all
known owned sessions. Unknown storage results or incomplete session cleanup
fail closed and never announce success. Any action already running when
revocation begins cannot return a successful result afterward.

The coordinator is **in-memory and synthetic**. It does **not** establish
durable cross-worker serialization, distributed revocation, restart recovery,
or rollback of already executed browser effects. Build a crash-consistent
single-owner coordinator with durable epochs and observed close receipts
before enabling the module in an actual browser execution path. The
revocation guarantee currently remains **no new grants/actions after a
confirmed fresh read**, not instant undo of any in-flight website action.

The isolated GitHub workflow also asserts none of the new modules is imported
from live `index.mjs` or `forward.mjs`, and that the existing gateway
Wrangler configuration has no new grant-database binding.

## Next secure integration gate

1. Provision an independent, isolated OmniPilot grant database and deploy the
   reviewed schema there only. Keep Finance D1 and all existing services intact.
2. Install separate subject-HMAC and audit-HMAC secrets through an authorized,
   non-exfiltrating secret workflow, never source or OAuth KV.
3. Verify a distinct operator identity through a supported trusted OAuth/
   policy channel, not a user-supplied isAdmin flag. Define explicit consent.
4. Connect the pure grant authorization and store to the OAuth gateway with a
   separate disabled-by-default feature flag. Enforce fresh reads for every
   action and preserve original OAuth scopes and tools.
5. Add transactional revocation barriers for in-flight browser actions,
   request-level audit receipts, reliable rollback and append-only off-system
   audit anchoring. Retention and access review remain outstanding.
6. Only after all tests and independent review consider enabling any new
   website grant. Authenticated browser profiles, vaults, form submissions and
   persistent writes remain excluded.

## Tests

The isolated workflow in .github/workflows/api1-omnipilot-subject-grants.yml
runs Node synthetic tests for subject binding, operator approval, revocation,
cross-subject denial, stale revision checks, audit integrity, fresh-primary
reads and storage failure safety. It also runs Python SQLite in-memory
tests for database triggers and atomic update semantics, plus a Wrangler
dry-run build. No deployed service, credential or Finance database is touched.
