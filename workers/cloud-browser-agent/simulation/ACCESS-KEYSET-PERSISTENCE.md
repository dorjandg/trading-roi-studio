# Isolated signing-key checkpoint persistence

This development slice preserves the review-only Access signing-key lifecycle
across a local restart. It does not authorize admission or execution, fetch keys,
open a browser, register an MCP tool, discover live storage or start a service.
All admission, execution, trusted-ingress and runtime-verification flags remain
false. The complete system still needs authenticated key provenance, protected
runtime storage, an independent rollback anchor and operational ownership fencing.

## Responsibilities

| Module | Responsibility |
| --- | --- |
| `access-keyset-lifecycle.mjs` | Validates lifecycle transitions; exports canonical complete checkpoints; restores with policy and floor checks; creates private in-process forks. |
| `signing-key-checkpoint-store.mjs` | Saves opaque bounded UTF-8 bytes and a revision/digest in a local SQLite transaction; supplies explicit synchronous read/CAS/close capabilities. |
| `durable-access-keyset-owner.mjs` | Privately owns one store handle and one lifecycle; stages operations, verifies exact commit acknowledgment and swaps state only afterward. |

### Checkpoint codec

`createAccessKeysetLifecycle(config).exportCheckpoint()` returns exactly
`{checkpoint, sha256}` without reading the clock or changing lifecycle state.
`fork()` creates an isolated in-process copy and preserves any recovery hold.
Neither method performs I/O.

The canonical `api1-access-keyset-checkpoint-v1` value contains, in order,
`schema`, `policySha256`, `generation`, `observedAt`, `freshUntil`, `lastClock`
and `history`. History is sorted by key ID and includes every retained active,
retiring, expired and revoked public-key identity. Each entry includes the
canonical public JWK, its fingerprint, state and applicable retirement deadline.
Checkpoint bytes are bounded to 128 KiB. Existing P2-A input bounds are unchanged.

`restoreAccessKeysetLifecycle(config, checkpoint, anchor)` checks canonical
representation, complete historical material, policy binding and the supplied
`revision`, `sha256`, `generationFloor` and `lastClockFloorSeconds`. An absent
independent clock floor is expressed as `null`; it is not independent rollback
protection. A digest is an integrity check, not proof of provenance or latestness.
Successful restore always starts at `RESTORED_AWAITING_PUBLICATION`. Only a
subsequent valid, fresh, strictly advancing publication can clear that hold.

### Local SQLite store

`createSigningKeyCheckpointStore(filename, options)` requires an explicit
absolute normalized `.sqlite` path in a caller-owned private directory.
Options include `mode`, `storeId` and `floor`. Create mode additionally takes
`initialPayload` and exclusively reserves a new file; open mode never initializes
missing or corrupt state. Create may use `{revision: 0, sha256: null}`; open
requires a positive revision and its lowercase SHA256 digest. A new store starts
at revision 1. Do not derive an independent trusted floor from the same database
being checked.

The returned synchronous capabilities are:

- `read()` returns exactly `{storeId, revision, sha256, payload}`.
- `compareAndSwap({expectedRevision, expectedSha256, payload})` replaces the
  complete payload only if both expected values match and acknowledges revision
  plus one with its exact digest and bytes.
- `close()` closes the handle and returns `undefined`.

WAL, synchronous FULL, a 100 ms busy timeout and trusted-schema disabling are
set and checked. CAS uses an immediate transaction and acknowledges only after
COMMIT and exact readback. Payloads remain byte-exact, including valid Unicode,
leading BOM and NUL. The owner separately requires canonical checkpoint JSON.
The store accepts exactly its expected STRICT table and singleton row; it
refuses extra user objects, damaged digests and revision rollback below its floor.

This POSIX implementation checks ownership, private permissions, symlink and
hard-link aliases, sidecars and stable parent/database identity. It assumes a
trusted directory owner, administrator and local SQLite-compatible filesystem.
It cannot atomically fence a hostile same-owner path swap between filename
checks and SQLite open. Do not use these checks as an external ownership lease.

### Durable owner

`createDurableAccessKeysetOwner(config, {store, minimumGeneration,
minimumClockSeconds})` claims a trusted store handle once, validates its receipt
and restores a lifecycle on hold. It exposes `publish`, `assess`, `status`,
`diagnostics` and `close`; it never exposes the private lifecycle or store.

Each `publish`, `assess` or `status` call runs this sequence synchronously:

1. Refuse closed, halted, busy or revision-exhausted owners.
2. Stage the operation in a private lifecycle fork.
3. Export and independently hash the complete resulting checkpoint.
4. CAS against the last acknowledged revision and digest.
5. Check store identity, exact next revision, payload and digest; recheck that
   the same owner epoch remains live.
6. Replace the private current instance and return the review verdict.

Even a denied publication, assessment or status check can advance the clock
high-water mark, so these calls persist a complete checkpoint. Diagnostics do not
observe the clock or perform I/O. A successful acknowledgment remains review-only;
it supplies no browser or ingress authority. Reentrant close invalidates the epoch
so an outer operation cannot reactivate a closed owner.

## Failure and recovery

| Observation | Required behavior |
| --- | --- |
| Stale expected revision or digest | Store reports `STATE_CAS_CONFLICT`; owner halts without promoting the candidate or retrying. |
| Failure before COMMIT | Store rolls back when possible; owner still halts and preserves its last acknowledged head. |
| COMMIT/readback or acknowledgment uncertainty | Store reports `STATE_WRITE_OUTCOME_UNKNOWN` and disables further writes on that handle; owner halts. The new row may already exist. |
| Malformed, mismatched or asynchronous acknowledgment | Owner halts and does not activate the candidate. No automatic retry follows. |
| Missing, corrupt, incompatible or rolled-back startup state | Recovery is refused. Do not erase the database, recreate a default state or infer an acceptable floor from damaged data. |

After a halt, trusted runtime code must close the old owner, reconcile the
database against independently retained evidence and open a new handle explicitly.
The new owner again starts on hold; mere database presence or a successful
diagnostic read cannot resume it. If both the database and its purported external
floor are rolled back together, these local checks cannot detect that rollback.

The store's construction-only `testOnlyFaultAt` setting supports `beforeCommit`
and `afterCommit` fault injection in disposable tests. It is not a live runtime
control. Tests exercise local SQLite transactions and synthetic checkpoint data;
they do not certify physical power loss, storage hardware, multiple live owners,
real key fetching, active service recovery or authenticated browser sessions.

## Remaining runtime integration

Keep publication private to a trusted owner. A future source must authenticate a
pinned issuer and fetch path, bound freshness and failures, and establish the
authority for generation changes and revocations. A valid-looking JWK response
alone cannot supply those properties. Bind that source to protected storage,
independent floors and operational ownership before claiming live authentication.
Network isolation, MCP registration and controlled browser acceptance remain
separate gates documented in `../OMNIPILOT_ARCHITECTURE.md`.
