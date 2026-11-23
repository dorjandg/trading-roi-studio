# API1 Phase 3 / P3-A — Durable coordinator and independent retirement witness interface

**Status:** LOCAL DESIGN PROPOSAL ONLY. No repository writes, merge, deployment, running-process inspection, credential or profile access, tunnel operation, production change, or Finance interaction is included.

**Read-only source baseline:** `dorjandg/trading-roi-studio`, branch `api1-browser-interaction-phase1`, SHA `e10c80ceaebf27264823dd7b8e835d2f3989b6c5` (verified 2026-11-23). This design builds beside, and does **not** change, the earlier pure retirement evidence and atomic lease modules. Their results and the existing startup HOLD are unchanged.

## 1. Scope and hard guarantees

The two new modules are **pure structural validators**, not live interfaces. They import no OS modules or network libraries, perform no I/O, issue no CAS, open no process handles, verify no signature, and always return `executionAuthorized:false`. `STRUCTURE_REVIEWABLE` is never an authoritative conclusion; it means only that *untrusted* data has a self-consistent shape.

A real integration must independently guarantee:

1. Exactly one durable, linearizable coordinator is authoritative for each resource and assigns monotonically increasing, non-reusable **fencing epochs**. An in-memory lock, PID, local journal, client clock, expiry or Boolean proof does not guarantee cross-host exclusivity.
2. Actual coordinator CAS is atomic across resource owner, mode, revision, epoch, committed retirement anchor, transaction record and nonce/replay ledger. Persist before acknowledging; recover from quorum loss or crash by authoritative read. Do not treat an HTTP 200 or a provider flag as proof of durable storage.
3. **Resource-side fencing** rejects old epochs at the actual effect sink, including tunnel forwarding, dispatch, deliveries and queued results. Fencing must be enforced even when an older process is still alive, and must survive crashes and reconnects.
4. Retirement requires a previously bound process descriptor, independently authenticated exit observation, durable intent and certificate, explicit in-flight resolution, and an authoritative coordinator release. An absent PID, failed read, `ESRCH`, lease expiry or stale certificate alone is not exit proof.
5. Operator approval is separate, fresh and scoped to the exact generation, old/new identity and intended transition. All unknown, conflicting, stale, replayed and cross-host ambiguous states remain `HOLD`. No automatic replacement launch or recovery is authorized.

## 2. Contract A: coordinator CAS transcript (synthetic)

`reviewDurableCoordinatorTranscript(input)` accepts canonical value-only objects with a `before` and `after` snapshot, a requested operation, an asserted receipt, a caller-clock timestamp and a freshness bound. Each snapshot includes:

`schemaVersion, resourceId, revision, fencingEpoch, mode, holder, retired, commitIndex, headDigest`.

The operation includes a transaction ID, kind, expected revision/epoch, resource/owner/generation/lease IDs, and optional successor expiry and retirement digest. The receipt includes the same transaction and revision/epoch, a coordinator identity, `result` (`APPLIED`, `CONFLICT` or `UNKNOWN`), commit index, previous/record digests, timestamp and a **caller-asserted** durability label.

The source reviews only four conceptual transitions:

| Transition | Structural conditions | Runtime authority |
| --- | --- | --- |
| `BEGIN_RETIRE` | `HELD -> RETIRING`; old holder, epoch and expiry stay bound | None |
| `PUBLISH_RETIREMENT` | `RETIRING -> VACANT`; previous holder matches retired certificate digest and epoch | None; independent cryptographic and process verification are missing |
| `ACQUIRE` | `VACANT -> HELD`; predecessor anchor retained, new owner identity, epoch + 1, bounded non-expired lease | None; durable CAS and sink fencing are missing |
| `RENEW` | `HELD -> HELD`; exact owner/lease/generation/epoch and strictly increasing expiry | None |

Every valid-looking transition also requires sequential revision and commit index increments, a consistent linked journal-digest claim, matching transaction ID and fresh receipt. `CONFLICT`, `UNKNOWN`, unknown coordinator mode, stale revisions, stale receipts, epoch mismatch, oversized lease expiry, or invalid transitions produce `HOLD` or reject malformed input.

A digest claim is **not** a verified digest or signed receipt. The validator does not compute canonical hashes, authenticate the coordinator, perform a CAS, or verify write durability. A malicious source can produce a consistent-looking transcript. Downstream code MUST NOT interpret its return value as a lease or use it to move the existing startup HOLD.

## 3. Contract B: independent exit witness (synthetic)

`reviewRetirementWitnessEnvelope(input)` accepts an expected owner descriptor, a one-time challenge, a claimed witness report, a **caller-asserted** spent-nonce list and a freshness window. The descriptor binds resource, owner, host, boot ID, PID, start ticks, executable fingerprint, generation, lease and fencing epoch. The challenge additionally binds nonce, coordinator revision, journal digest and validity interval. The report claims a pre-opened, generation-bound descriptor, method `pidfd-waitid` or `supervisor-wait`, independent monitor/key ID, signature metadata, exit event and timestamp.

It structurally checks scope, identity, nonce, revision, journal digest, independence labels and event ordering; it rejects replay in the supplied fixture, sparse/accessor arrays, unexpected properties, getters and malformed data. It **does not** verify Ed25519 signatures, process descriptors, monitor independence, kernel wait results, clock origin, certificate chain, revocation, or durable single-use nonce consumption. Even a well-formed forged report remains `signatureVerified:false`, `exitVerified:false` and `retirementAuthorized:false`.

A future trusted verifier requires: pinned trusted signing keys with rotation/revocation, canonical versioned signed bytes, machine/monitor authentication, real pidfd/supervisor process-descriptor provenance established before the child exits, a coordinator-clock-bounded challenge, and a **single durable nonce-consumption CAS** tied to coordinator revision and lease epoch. Signing metadata alone is not a signature.

## 4. Required real-world crash and concurrency behavior (future work)

| Interrupted or conflicting point | Mandatory safe state / recovery |
| --- | --- |
| Before `BEGIN_RETIRE` is durably acknowledged | Reread coordinator; old authority must not be declared vacant |
| `BEGIN_RETIRE` acknowledged; local intent unavailable or incomplete | Preserve `RETIRING`; do not start successor |
| Fencing initiated but drain/old deliveries unresolved | Keep owner `RETIRING`, disable new admission, review in-flight outcomes |
| Exit observed but attestation or certificate not durably published | No retirement release; reconstruct from trusted monitor evidence or stop for operator |
| Certificate available but coordinator release response lost | Outcome `UNKNOWN`; locate transaction ID via authoritative read, never blindly advance |
| Two hosts submit acquire at the same expected revision | Exactly one durable CAS may win; loser receives conflict and remains fenced |
| Holder expires or coordinator becomes unavailable | Remain `HELD`/`UNKNOWN`, do not infer vacancy, never renew from untrusted clocks |
| Coordinator announces higher epoch while old client is connected | Sink must fence old epoch for **all** effects, queued deliveries and retries |
| Witness challenge reused or monitor key revoked | Reject via trusted durable nonce ledger and key revocation state |
| Crash after acquisition CAS but before fencing propagation | New process must NOT launch; reconcile coordinator and sink epoch, then seek fresh approval |

**Idempotency and crash semantics:** A future coordinator needs durable transaction IDs and a read-only transaction-lookup endpoint that can distinguish `NOT_SEEN`, `COMMITTED`, `ABORTED` and `INDETERMINATE`. `NOT_SEEN` is not sufficient to resubmit a non-idempotent transition without confirming the durable state. Recovery decisions require a fresh linearizable state read, log reconciliation and possibly operator review. A timeout does not prove failure.

**Clock semantics:** The current synthetic `nowMs`, lease expiry, and witness timestamps are caller values only. Real decisions require a coordinator-owned trusted clock/monotonic logical deadline and bounded-drift design, with fail-closed handling on clock uncertainty. Avoid node-local TTL checks granting authority.

## 5. Evidence and tests

The two new test suites use `node:test` with in-memory fixture data only. They exercise all four transition shapes; conflicting/stale CAS receipts; revision, epoch, transaction and journal consistency; an in-memory two-contender CAS race; lost acknowledgements; retirement certificate mismatches; expired owners; bounded lease expiry; replayed challenges, forged monitor metadata, PID/boot/start-time substitution; stale or future exit timestamps; and getter/prototype/symbol/sparse-array rejection.

Tests are **synthetic**, not demonstrations of real fsync, independent witnesses, cross-host split-brain prevention, signer authenticity, true coordinator durability, or live MCP availability. The production controller, active tunnel, workers, Finance code, current credentials and browser profiles were not inspected.

## 6. Separately gated future implementation work

1. Independently review the coordinator's actual durability and linearizability guarantees, data model, CAS transaction, key management and storage recovery semantics before selecting or deploying any product.
2. Implement a **separately authorized**, authenticated read-only coordinator snapshot and transaction-proof adapter. First verify schemas and authenticated journal proofs with disposable mocks; do not wire it to active runtime.
3. Design/verify the trusted process-witness producer and cryptographic verifier using mock keys and disposable child processes, including descriptor provenance, nonce CAS and certificate revocation.
4. Design actual sink-side epoch enforcement and queue/response-delivery fencing; prove old sessions cannot perform effects after a successor epoch is durably assigned.
5. Review crash recovery and operator approval as a complete independent protocol before proposing integration; only then seek separate approval for any service writes, credentials, tunnel process changes or deployment.

**Explicit non-goals:** no new MCP tool, no new website access, no browser execution, no process inspection, no terminal stop/restart, no secrets, no real signer, no coordinator storage writes, no Cloudflare change, no Finance modification, no production sync, no merge or deployment.
