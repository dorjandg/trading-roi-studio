# API1 Phase 3 / P3-B — Coordinator persistence and retirement-witness verification boundaries

**Status:** proposed source-only architecture and synthetic regression suite. **Not committed, deployed, connected, or authorized for runtime use.** Prepared for separate approval against `dorjandg/trading-roi-studio`, branch `api1-browser-interaction-phase1`, baseline commit `65ee9bf546914c541bf48d3d4fee55d2988e84d2`, tree `dd9681b5a8f93ce21f31a8a2d912d16e4f996953`.

## 1. Scope and explicit non-goals

Five new files: two pure advisory boundary modules, two new synthetic `node:test` suites, and this specification. They have no OS, filesystem, network, D1, database, secret, pidfd, cryptographic signing, browser or process capabilities. They never call a real coordinator or witness, perform a CAS, consume a nonce, issue a lease, inspect a live process, or alter startup state. The existing startup planner remains unchanged and returns `HOLD` where retirement is unobservable. Nothing touches Finance or production.

**Terminology:** "trusted" names the *future independently validated boundary*, not these synthetic implementations. No claimed timestamp, coordinator ID, read-consistency label, log digest, witness signature digest, nonce state, key policy or `COMMITTED` ledger entry is authenticated by this patch.

## 2. Coordinator persistence/recovery boundary

`reviewCoordinatorPersistenceBoundary({attempt, readback, nowMs, maxAgeMs})` accepts canonical value-only fixtures:

- `attempt`: exact transaction ID, operation kind (`BEGIN_RETIRE`, `PUBLISH_RETIREMENT`, `ACQUIRE`, `RENEW`), resource ID, expected revision/epoch, **claimed** request digest, and acknowledgement (`ACK_APPLIED`, `ACK_CONFLICT`, `ACK_LOST`, `TIMEOUT`) with optional commit index.
- `readback`: **claimed** linearizable readback from one coordinator identity/term with resource ID, lookup transaction ID, current state/revision/fencing epoch/commit index/head digest, observation timestamp, and per-transaction status (`COMMITTED`, `CONFLICT`, `NOT_SEEN`, `INDETERMINATE`).
- Safe integer limits, exact own data properties, ID/digest formatting and bounded freshness are checked. Accessor/inherited/symbol-extra input fields fail without being invoked on ordinary objects. Hostile JavaScript Proxies are outside this trust boundary: serialize through a controlled JSON parser before use.

A transaction `COMMITTED` with a coherent lookup can only return `STRUCTURE_REVIEWABLE`. **All result flags indicating actual authentication, transaction verification, durable commit, lease grant, retirement or execution remain false.** Readback under a later journal head is structurally permitted if commit index does not regress; the model does not reconstruct or verify the intermediate journal chain. A response after a lost acknowledgement must never cause an automatic retry.

### Required durable adapter (future, separately approved)

1. Pin a single authoritative resource namespace, coordinator trust root and epoch assignment authority. Reads must authenticate the responder and enforce linearizability/quorum guarantees; a caller-supplied `linearizable-asserted` string is not proof.
2. Persist the **transaction ID -> canonical request digest -> result -> commit index** mapping atomically with owner, epoch, revision, retirement anchor and log head. Deduplicate transactions across restarts and leadership changes. Never accept the same tx ID with a different command or request digest.
3. Use real durable write acknowledgement or linearizable transaction lookup, read after uncertainty, and independent storage/journal integrity proofs. An HTTP response, timestamp, hash string, or local fsync flag alone is not enough.
4. `ACK_LOST`, `TIMEOUT`, `NOT_SEEN`, `INDETERMINATE`, stale readback, revision conflict or disagreement across replica terms require **HOLD** and reconciliation. A `NOT_SEEN` lookup cannot by itself authorize a retry. `COMMITTED` readback still requires authenticated commit proof and resource-side fencing; the synthetic boundary supplies neither.
5. Preserve monotonic, non-reusable fencing epochs at the effect sink (forwarding, queues, in-flight deliveries, responses) and check them against the durable lease owner for every effect. Lease expiry alone never establishes vacancy.
6. Handle write acknowledgement lost after durable commit, crash before/after journal publish, quorum loss, leader handoff, partial replication and restart recovery; preserve `UNKNOWN` rather than starting a successor.

| Crash or conflict | Required future safe recovery |
| --- | --- |
| Crash before commit acknowledgement | Lookup exact tx ID from authenticated authoritative coordinator; `UNKNOWN` or `NOT_SEEN` means HOLD |
| Commit persisted but ACK lost | Authenticated commit proof and state reconciliation, then independent fencing and operator review; never launch from synthetic readback |
| Ack says applied but lookup says not found | HOLD as protocol/storage contradiction |
| Same tx ID reused with another digest, revision, epoch, or kind | HOLD; audit possible replay or identifier collision |
| Two acquiring hosts share expected revision | Only real atomic CAS may select one; loser stays fenced; model offers no distributed guarantee |
| Later journal revisions observed | Verify committed transaction against full durable history; structural readback is insufficient |
| Coordinator unavailable, split brain, or state `UNKNOWN` | HOLD; do not treat lease TTL or PID absence as ownership transfer |

## 3. Independent retirement-witness verification boundary

`reviewWitnessVerifierBoundary({envelope, trustPolicy, nonceRecord})` composes the existing **synthetic-only** `reviewRetirementWitnessEnvelope` structural checks with additional simulated registry and ledger boundaries.

- A pinned monitor/key/resource policy includes key ID, signing-algorithm label, reported revocation status, reported activation/expiry window, policy revision and trust-anchor digest.
- A claimed one-time challenge ledger record binds nonce, resource, generation, lease, fencing epoch, coordinator revision, journal digest, availability and observation timestamp.
- Invalid envelope structure, owner/monitor/key mismatch, revoked/unknown key, out-of-window signature, stale ledger read, spent/unknown nonce, cross-generation scope or process identity mismatch all return `HOLD` (or throw sanitized invalid-input errors).
- When everything is structurally consistent, the result is **`VERIFICATION_PENDING`**, not `VERIFIED`. All authentication, signature validation, true process exit, nonce consumption, retirement authorization and execution flags remain false. A `signatureDigest` is not a signature verification.

### Required trusted witness interface (future, separately approved)

1. Enforce authenticated monitor and machine identity with pinned, rotated and revocable verifier keys. Canonicalize versioned signed bytes (not free-form fields), verify Ed25519 on the bytes using an independently protected trust root, and bind signature to exact challenge and owner process descriptor.
2. Prove the process descriptor was acquired before exit and tracks the exact generation/host/boot/PID/start-ticks/lease/epoch. Validate a **real** pidfd/waitid or supervised-child termination, not a failed `/proc` read, `kill(pid,0)`, `ESRCH`, missing PID, signature metadata or self-reported Boolean.
3. Source challenge freshness and expiry from a trusted coordinator clock; handle clock skew/rollback and signer revocation. A caller-supplied timestamp or policy record is not authoritative.
4. Consume each nonce with a durable, linearizable, **single-use** coordinator CAS atomically bound to verified witness identity, key policy revision, owner identity, lease epoch, resource, journal revision and canonical report digest. On lost ACK, authoritative replay-ledger lookup is required; do not re-consume blindly.
5. Produce an authenticated, replay-resistant verification receipt only after cryptographic checks, independent descriptor proof, and durable nonce consumption. Still do not release an owner without full drain, fence, durable retirement certificate and coordinator release CAS.

| Witness ambiguity | Required future safe recovery |
| --- | --- |
| Key revoked, unknown, expired or not yet active | HOLD; no grandfathered default trust |
| Signed bytes absent or mismatched, or trust root unavailable | HOLD; metadata does not substitute for verification |
| Nonce spent, unknown or readback stale | HOLD; no replay and no automatic retry |
| Two claimants race on the same nonce | Exactly one trusted coordinator CAS may consume it; loser rejected |
| Monitor crashes after exit but before receipt durable | HOLD; reconstruct from authenticated supervisor/wait evidence and durable nonce journal only |
| Witness is valid but retirement/fencing/drain is incomplete | HOLD; never publish release or startup authority |

## 4. Security risks and implementation gates

- **Critical, intentionally unresolved:** Neither new module implements a durable/linearizable datastore, real CAS, storage fsync, data authenticity, cryptographic verification, kernel process exit proof, actual trusted time, distributed nonce ledger, or sink-side fencing. These cannot be inferred from synthetic fixtures or test passes.
- **Stale reader and split-brain:** Caller-supplied coordinator term and `linearizable-asserted` are not validated. A malicious actor can construct a coherent fake `STRUCTURE_REVIEWABLE` outcome, which must **never** be consumed as a permission check.
- **Replay/nonce:** The mock nonce record is not a durable single-use ledger, and an apparently `AVAILABLE` nonce never signals authorization. Real inter-host nonce races need verified CAS and durable recovery.
- **Integrity:** SHA-256-shaped digest claims are not recomputed or authenticated; real journal proofs must be canonical, collision-resistant and signed/MACed as appropriate without leaking keys.
- **Input model:** Canonical own enumerable value-only data records are expected. Any future runtime adapter must parse bounded untrusted bytes into isolated plain records, prevent Proxy/callback side effects and cap resource consumption.
- **Operator approval:** Separate, fresh, scoped human authorization and a reviewable recovery/cutover plan remain required before any actual process or tunnel action.

## 5. Local synthetic verification and approval

Target tests: the 2 new suites (`36` synthetic cases) plus the immediately preceding 2 contract suites (`32` synthetic cases), total `68`, with `node --test`. An expanded pure-only nine-suite run covering selected existing P3-A modules also passed `132 / 132`. The prior baseline CI for commit `65ee9bf546914c541bf48d3d4fee55d2988e84d2` passed both API1 workflows. The **new uncommitted patch has no GitHub CI result**.

Prior to any future GitHub write: reverify the baseline HEAD and tree, ensure all five proposed paths remain absent, verify patch and manifest hashes, obtain explicit separate user approval, and atomically add only the five files. No runtime integration, process, profile, tunnel, credential, Finance or production change is within this approval request.
