# API1 Phase 3 / P3-A — Crash-consistent retirement evidence and atomic ownership lease

**Status:** proposed architecture and **synthetic-only code**, pending independent approval. Nothing here has been committed, merged, deployed, started, stopped, or connected to a tunnel.

**Verified baseline:** `dorjandg/trading-roi-studio`, branch `api1-browser-interaction-phase1`, commit `542722d4d7a3108bb7c9ae0e543165db696e581d` (2026-11-23). The previous approved P3-A code intentionally holds startup on `RETIRED_PROCESS_UNOBSERVABLE`. This proposal **does not** modify that guard.

## 1. Hard safety invariants

1. At most one current authority for a given tunnel identity; no process, localhost file lock, ephemeral PID, observed process disappearance, client clock, or TTL alone can establish distributed ownership.
2. A **single trusted, durable, linearizable coordinator** is the source of truth. CAS checks an exact revision and updates owner identity, lease ID, fencing epoch, and retirement certificate **in one atomic durable mutation**. Local file locks are not a cross-host substitute.
3. Fencing epochs are strictly monotonic per resource, never reused; the tunnel/transport/dispatcher (including old sessions and queued deliveries) must reject older epochs at the point where effects occur. Merely adding an epoch field to a lease record is insufficient.
4. Old ownership becomes *retired* only after a generation-bound, independently verified process-exit witness, completed drain or explicit resolution of in-flight requests, transport fencing, and a durable retirement certificate are reconciled with coordinator state. A read failure, `ESRCH`, expired lease, or absent PID is **not** proof of retirement.
5. All state transitions fail closed when the coordinator is unavailable, evidence is stale, clocks differ, processes are ambiguous, renewal fails, or a crash leaves journal/coordinator views inconsistent. No autonomous restart, failover, or cutover.
6. Existing P3-A modules remain advisory only; `executionAuthorized:false` stays invariant. User/operator authorization for applying any runtime change is separate and fresh, not implied by this design or by CI.

## 2. Trust domains and non-goals

- **Trusted in a future separately approved runtime:** authenticated operator approval; independently authenticated supervisor/witness; strongly consistent durable coordinator implementing CAS and epoch assignment; a resource-side enforcement gate that rejects stale epochs; a bounded, audited local journal implementation (fsync/atomic publish); trusted coordinator-clock source. None is provided by the new modules.
- **Untrusted:** caller-provided process observations, Boolean fields claiming fsync, signed digests without cryptographic verification, local health checks, local file-lock success, timeout/expiry from a user clock, local startup planner results, client-side CAS proposals.
- **Unchanged:** the single read-only Wikipedia MCP tool, localhost-only private interfaces, no arbitrary domains, no uploads/logins/write commands, no browser profile or credential access, no Finance, no public deployment.

## 3. Durable retirement protocol (future design only)

For an established owner tuple `{resourceId, ownerId, hostId, bootId, pid, startTicks, executableFingerprint, generationId, leaseId, fencingEpoch}`:

1. **Freeze target:** operator checks current coordinator owner/revision/epoch, binds generation and authorization; reject if any mismatch. Atomically CAS `HELD -> RETIRING` with old owner still recorded. On crash, `RETIRING` is unresolved, not vacant.
2. **Durable intent:** append versioned intent to a non-secret local journal; write content, `fsync` its file, then atomically publish a manifest and `fsync` the parent directory. The intent alone never releases ownership.
3. **Fence before drain:** block old generation at the actual transport/dispatcher and obtain a verifiable acknowledgement bound to resource/lease/epoch. This may cause intentional unavailability; it does not itself imply process exit.
4. **Drain and resolve:** close admission for the old generation; wait for or explicitly reconcile all in-flight requests and deliveries. Unknown outcomes remain `HOLD`. No replays of unsafe work.
5. **Independently witness exit:** an operator-controlled supervisor uses a generation-bound process identity and a genuinely independent exit mechanism (e.g., pidfd/waitid for a supervised child). `kill(pid,0)`, `/proc` lookup failure, and ambiguous file-read errors are insufficient. Cryptographic attestation and observer trust must be verified externally.
6. **Durable local certificate before release:** write a committed retirement-candidate certificate containing previous journal hash/sequence, exact old owner, lease epoch, witness and fence references, approval and completed-drain result; persist file/manifest and parent directory by `fsync`. The hash chain alone cannot authenticate its signer.
7. **Authoritative release CAS:** coordinator atomically transitions `RETIRING -> VACANT` while storing the exact verified certificate/reference, retaining old epoch and bumping revision. Only the coordinator can authoritatively publish vacancy. Failure or timeout leaves the release outcome `UNKNOWN` pending authoritative reread; it MUST NOT be retried blindly as a new owner.
8. **Acquire separately:** a fresh operator authorization and validated retirement anchor are prerequisites to a **different** generation proposing `VACANT -> HELD` with epoch+1, new lease ID, new owner ID and bounded expiration. Actual CAS success, propagation of fencing to transport, and read-back are required *before* any separately approved start action. The pure module never starts anything.

The synthetic evidence module checks the claimed ordering `intent -> route fence -> drain -> exit -> durable certificate -> parent directory durability -> coordinator release CAS`. Those fields are only structure checks; they are **not** fsync, external attestation, a certificate signature check, or a coordinator implementation.

### Crash/recovery table

| Crash/ambiguity point | Durable/coordinator interpretation | Fail-closed recovery requirement |
| --- | --- | --- |
| Before or after intent fsync; no fence | Old ownership remains or becomes `RETIRING` | Reread coordinator and journal; do not start replacement |
| After fence, before drain or exit | Old process may still exist; queued work unresolved | Keep transport fenced and owner `RETIRING`; review in-flight work |
| Exit observed, certificate not durably published | No crash-persistent evidence of identity-bound exit | Obtain new independent witness or operator-assisted reconciliation; `HOLD` |
| Certificate durable, release CAS not known successful | Coordinator may still say `RETIRING` | Compare exact revision, epoch and certificate against authoritative coordinator; never assume vacancy |
| Release CAS acknowledged but response lost | CAS outcome unknown to client | Read back *authoritative* coordinator state and exact receipt, no blind retry |
| Coordinator `VACANT`, local journal missing/mismatched | Partial recovery / possible corruption | `HOLD` until independently authenticated durable certificate and local journal are reconciled |
| New owner acquired, old epoch still accepted by gateway | Split-brain risk despite correct CAS | Do not start/serve; transport-side fencing must be enforced and verified |
| Lease TTL expired, old owner still visible or unknown | Expiration is not retirement | `HOLD`; never release/take over based on time alone |

## 4. Proposed synthetic module contracts

### `private-runtime-retirement-evidence.mjs`

`reviewRetirementEvidence({expected, receipt, nowMs, maxAgeMs})` checks own-data-only, bounded fields; identity and generation matching; monotonic journal sequence/hash-link *syntax*; exact lease/epoch; witness identity scope; ordered durability/exclusivity claims; stale/future witness timestamps; and rejects incomplete/incorrect checkpoints.

Output is **only** `HOLD` or `STRUCTURE_REVIEWABLE`, always with `retirementVerified:false`, `attestationVerified:false`, `executionAuthorized:false`, `requiresIndependentVerification:true`, and `requiresDurableCoordinatorCAS:true`. The module never validates a signature, fsync, child-exit event or digest hash against bytes. Passing its checks **cannot** authorize transition or be used by the startup planner as an exit witness.

### `private-runtime-atomic-lease.mjs`

`planAtomicOwnershipLease({snapshot, request, coordinatorClockMs})` receives a synthetic globally authoritative snapshot and proposes `ACQUIRE` or `RENEW`:

- `ACQUIRE` requires `VACANT`, `holder:null`, a committed predecessor retirement anchor matching the epoch/digest, a new lease/generation/owner distinct from the immediate predecessor, expected coordinator revision and epoch, bounded TTL, and nonoverflowing epoch; expired `HELD` does not qualify.
- `RENEW` requires `HELD`, exact owner/generation/lease/epoch match, lease not expired, new expiry later than existing expiry, exact revision, bounded TTL; it **does not** rotate epoch.
- `UNKNOWN`, `RETIRING`, stale revisions/epochs, certificate mismatch, record overflow, malformed fields or unsafe clock values **HOLD**.

Result is only `HOLD` or `CAS_PROPOSAL` (`expectedRevision`, immutable `nextSnapshot`). It always states `leaseGranted:false`, `executionAuthorized:false`, and that external verification, a durable linearizable coordinator CAS, trusted coordinator time, fresh operator approval and transport-side fencing are required. Both clients can derive a proposal from the same old snapshot; only the future coordinator may durably accept one. This module is NOT the coordinator.

## 5. Synthetic acceptance and known limits

Tests do not read live `/proc`, launch processes, use credentials, read profiles, contact a tunnel, connect to a database, touch Finance, or mutate GitHub. They simulate interrupted checkpoints, missing directory fsync, stale witness, PID/gen/epoch changes, inherited/getter-bearing objects, repeated receipt/digest, two CAS contenders, stale revisions, expired owner, epoch overflow, lease-renewal identity mismatch, and no-authority outputs. The two-competitor test is a model, not proof of database linearizability. Lifetime non-reuse of owner/lease/generation identifiers across ALL prior epochs must be enforced by an authoritative coordinator; comparison with the immediate predecessor in a pure snapshot does not establish global uniqueness.

**Acceptance to consider future integration:** independent cryptographic verifier; global coordinator selection and durability proof; fenced resource-side acceptance tests (including queued and in-flight requests); fault injection at each fsync/CAS crash boundary; reboot and cross-host split-brain tests; idempotent recovery from unknown outcomes; operator approval audit binding; security review of any real read adapter, credentials and process manager. These are **not** implemented or approved here. There is intentionally NO `RELEASE` / `COMMIT_RETIRE` mutation planner: exposing one without a genuine independent signature verifier and durable-coordinator integration would risk turning untrusted structural evidence into operational authority.

## 6. Proposed patch scope and approval boundary

This package contains **five new files only**: two simulation modules, two synthetic test modules, and this design note. It does not modify the existing `private-runtime-startup-plan.mjs` or otherwise remove the intentional `RETIRED_PROCESS_UNOBSERVABLE` hold.

Before any future GitHub write: reverify branch `api1-browser-interaction-phase1` HEAD and base file hashes; check all five destinations remain new; obtain separate explicit approval for the exact proposed patch; then apply only the five paths and run relevant checks/CI. No merge, deployment, restart, tunnel/config/secret/profile change, production, or Finance action is included.
