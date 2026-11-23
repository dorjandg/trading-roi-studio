# API1 Phase 3 / P3-D — Multi-sink fencing and uncertain effect settlement

**Status:** local read-only development proposal; **NOT approved for GitHub, runtime integration or deployment**. Pure synthetic input-shape models only. No process, browser, network, storage, credential, tunnel or Finance access. These modules MUST NOT be interpreted as startup or effect-admission policy.

**Repository:** `dorjandg/trading-roi-studio`
**Development branch:** `api1-browser-interaction-phase1`
**Verified baseline:** `4cd61bd6db084069528b4feb2f86a1277175fc13` (existing P3-C modules, both API1 CI workflows passed).
**Scope:** exactly two new `.mjs` modules, two new synthetic test files, and this architecture note. No existing sources, deployment files, runtime configuration or workflow changes.

## 1. Motivating security gaps

P3-C has only a **single effect sink** fence-shape comparison and single retirement-release reconciliation. Even a correct owner epoch and a fenced sink cannot prevent stale effects if *another* sink, browser session, queue, or delayed callback remains reachable. Accepting two out of three sink acknowledgements would create a stale-effect bypass. Similarly, a timeout after dispatch does not prove failure; replaying a request can cause duplicate, irreversible external effects.

The P3-D proposal models two additional **non-authoritative evidence envelopes**:

- `reviewMultiSinkFenceBarrier(input)`: claims that **every** sink in an exact, immutable, coordinator-committed resource membership acknowledged an epoch barrier, fully drained its old sessions and queues, and retained a nondecreasing durable fence/revision/commit high-water mark.
- `reviewEffectSettlementReconciliation(input)`: claims that a single uncertain outbox dispatch was matched to one durable inbox/dedupe ledger record and one downstream receipt, with exact owner, generation, request identity, fencing epoch, coordinator revision/head and intent digest.

Every successful comparison returns `STRUCTURE_REVIEWABLE`, **never** `VERIFIED` or `ALLOW`. No real cryptography, persistence, coordinator, trusted clock or effect admission is implemented.

## 2. Multi-sink barrier protocol — proposed future trusted architecture

1. At a single, authenticated, linearizable coordinator read, pin the resource ID, term, revision, commit index, fencing epoch, owner tuple, and **membership revision/digest**. Every effect-bearing surface (browser worker, active or pooled session, queue consumer, callback runner, response sender, and plugin/tool dispatcher) must belong to the authoritative inventory. If membership is incomplete or discovery cannot prove it is complete: **HOLD**.
2. Atomically publish a coordinator-scoped fence barrier bound to the exact membership snapshot and owner/epoch. Any topology change after that snapshot must invalidate the barrier, forcing a fresh CAS and fresh all-member acknowledgements. Fail closed on partitioned coordinators, an inconsistent term, lost quorum, client-clock ambiguity and revision drift.
3. Each sink must durably advance a per-resource high-water **epoch, revision and commit index** before acknowledging. The ack must bind the sink ID, owner/generation/lease, barrier ID, membership digest, term/revision/commit, drain result and independent non-replayable authenticated receipt. A plain hash-shaped string is not proof of a signature or durable flush.
4. Deny new sessions and stop old queued work at the **actual effect point**. Drain or explicitly resolve outstanding deliveries and responses, including already-open connections and asynchronous callbacks. An unknown outcome must block, not be treated as safely completed. Old generations cannot be revived by restored snapshots or delayed events.
5. The future trusted coordinator must verify **all** sinks, not a quorum, using authenticated receipts and a durable completeness proof before ever considering a cutover. New/removed sinks require a fresh membership commit. A sink failure intentionally halts progress, potentially causing temporary unavailability.
6. Even an authenticated barrier is not itself a startup grant. A separate, explicit operator approval, verified retirement witness, real CAS lease and resource-side fence enforcement remain required. No such operations are implemented or authorized here.

### Structural checks in this proposal

The barrier module accepts exact plain-data records (`snapshot`, `membership`, `barrier`, bounded array of `acks`, `nowMs`, `maxAgeMs`). It checks complete distinct membership, no missing/extra/duplicate sinks, no duplicated receipt digests, exact revision/term/epoch/owner/digest scope, claimed fence-floor monotonicity, zero queued effects or open sessions, ordered ack windows and bounded freshness. `PUBLISHED` is a **caller assertion**, not an authenticated commit. Timestamps come from the caller, not a trusted time source.

All decisions include `barrierVerified:false`, `allSinksFenced:false`, `quorumVerified:false`, `admissionAuthorized:false`, `effectAuthorized:false`, `sessionAuthorized:false`, `deliveryAuthorized:false`, `executionAuthorized:false`, and `startupAuthorized:false`.

## 3. Effect settlement — proposed future trusted architecture

**Do not promise exactly-once downstream effects** if the sink cannot atomically commit its side effect with the dedupe/inbox state. A dispatcher timeout could mean “nothing executed,” “executed but receipt lost,” or “still executing.” No automatic retry, redelivery, downstream acknowledgement, or compensation follows from this ambiguity.

1. Record a canonical request key `(resourceId, ownerId, generationId, leaseId, fencingEpoch, requestId, canonicalRequestDigest)` and dispatch ID. The real system must calculate the key/digest using canonical bytes, not trust a caller-reported 64-character hex string.
2. Prior to dispatch, persist a versioned outbox intent with content-verified journal hash/sequence and `fsync` of the file and containing directory. Bind it to an authenticated coordinator term/epoch/revision/commit/head. The simulated boolean `fileSyncedClaim` or `directorySyncedClaim` is not a durable proof.
3. At the effect sink, enforce the current fence/ownership and atomically reserve the dedupe key with the effect where possible. If the external effect is not transactional with the inbox, design a separate, auditable reconciliation procedure and explicitly document the residual uncertainty and need for manual review.
4. On an ambiguous dispatch ACK, do **not** issue a second effect. Read from an authoritative durable ledger and independently authenticate a downstream receipt bound to the original dispatch, request, owner, epoch, outcome digest and ledger record. Lost/no lookup access is `HOLD`; `NOT_FOUND` is not automatically safe-to-retry.
5. Reject rolled-back ledger sequence/epoch, missing intent digest binding, inconsistent coordinator head, out-of-order timestamps, reissued dispatch IDs, mixed owner/generation records or conflicting outcome digests. A matching record is only structurally compatible until independently proven.
6. Operator decision and actual effect recovery are a separate, explicitly approved future design. Never automatically acknowledge a user command based on this pure module.

The settlement module's non-HOLD state is **only** `STRUCTURE_REVIEWABLE` for a claimed `ACK_UNKNOWN` outbox with a matching `COMMITTED` ledger and sink receipt. Output flags **always** keep `safeToRetry`, `retryAuthorized`, `deliveryAuthorized`, `acknowledgementAuthorized`, `executionAuthorized`, `outcomeVerified`, `durabilityVerified`, `dedupeVerified`, `reconciliationComplete` and `exactlyOnceGuaranteed` false.

## 4. Failure / crash matrix

| Failure or attack | Synthetic review | Required separately approved real safety mechanism |
| --- | --- | --- |
| Two of three sinks report barrier receipt; one offline | `HOLD` missing ack | Verify *all* known sinks; no quorum shortcut |
| Old queue, old session, queued response after fence | `HOLD` nonzero work or unresolved drain | Deny at effect point; durable drain and session revocation |
| Topology adds a new sink after membership snapshot | `HOLD` if membership/receipt mismatch | Membership CAS invalidates old barrier and re-fences every sink |
| Duplicate ack / reused digest, wrong owner or epoch | `HOLD` | Authenticate distinct sink identity and anti-replay nonces |
| Sink restarts below committed high-water fence | `HOLD` rollback | Crash-safe storage, independently audited monotonic fence |
| Coordinator term/revision/head changes | `HOLD` scope conflict | Fresh authenticated linearizable read; restart barrier planning |
| Outbox persisted but send never began | `HOLD` incomplete lifecycle | Reconcile durable intent, never presume safe replay |
| Downstream effect executed, ACK lost | structural review *only* if claimed ledger+receipt agree | Authenticated receipt and atomic sink effect ledger if possible |
| Dedupe ledger says `NOT_FOUND` or `UNKNOWN` | `HOLD` | Authoritative resolution; no blind retry |
| Ledger rolled back after crash | `HOLD` floor conflict | Recovery from trusted durable log, with monotonic epoch/sequence |
| Rebound request/digest/dispatch ID or altered outcome | `HOLD` replay/conflict | Canonical key and verifiable downstream result |
| Unavailable coordinator, inconsistent clocks, compromised signer | No grant in any state | Fence all effects and require operator-led recovery |

## 5. Boundaries, non-goals and risk acceptance

- **No operational imports:** no `fs`, `child_process`, `net`, browser, Workers, Cloudflare, Finance, credential, profile or process modules. No implicit time reading, timers, global mutable state, background work or write flags.
- **Untrusted synthetic claims:** all objects are injected by tests/callers. JavaScript accessors, symbols, inherited fields, extra keys and sparse/holey arrays are rejected. Hostile Proxy traps must be rejected/normalized by a separate trusted byte parser before invoking these pure functions. No cryptographic signatures are verified. Data-shape validity is *not* evidence authenticity.
- **Availability consequence:** all-sink acknowledgement may halt during a partition or failure. That is intentional; operating safely takes priority over automatic availability.
- **Semantic exactly-once:** not guaranteed. Exactly-once across an external side effect requires atomic commit semantics or an application-specific idempotency contract; synthetic event logs alone cannot prove it.
- **No existing runtime behavior changed:** `private-runtime-startup-plan.mjs` keeps the P3-A `RETIRED_PROCESS_UNOBSERVABLE` `HOLD` behavior. These modules are not wired to the existing browser runtime or CI workflows except that a future approved commit would include the `.test.mjs` files in the existing wildcard Node test command.

## 6. Development and approval gates

1. Review this **five-file local proposal** and its SHA-256/Git-blob manifest. No GitHub write has been made. Run syntax checks and `node --test test/private-runtime-*.test.mjs` locally against the verified baseline. Tests are synthetic and do not open a browser or network connection.
2. If explicitly approved, reverify the branch HEAD `4cd61bd6db084069528b4feb2f86a1277175fc13`, all five paths absent, patch compatibility and exact blob hashes. Apply a single scoped development commit only, then verify both API1 CI workflows. CI is **not yet run on this uncommitted patch**.
3. Before any actual integration, independently design a robust coordinator with linearizable topology CAS, authenticated per-sink receipts, durable high-water writes, drain protocol, authentic dedupe ledger, real cryptographic trust and a safe operator recovery workflow. Isolate all privileged capabilities and test deterministic crashes/failures in a **separately approved** non-production environment.
4. **A different approval** is required before touching processes, browser profiles, local/private tunnels, credentials, runtime, production or Finance. None is in scope.
