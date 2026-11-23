# API1 Phase 3 / P3-C: Effect-side fencing and retirement release recovery (synthetic only)

Status: **LOCAL PROPOSAL FOR SEPARATE APPROVAL**. This is architecture review and pure simulation only. No GitHub write, merge, deployment, process/tunnel/profile/credential access, Finance change, or runtime integration is authorized.

Repository: `dorjandg/trading-roi-studio`
Branch: `api1-browser-interaction-phase1`
Verified baseline at proposal preparation: `7fa00db08abcf8b836dd4296225cbf1bca44f15f`.
Baseline tree: `53e8a68f7bf3f97481da30a637da7b638af22a0a`.
Existing API1 security and public-browser CI workflows passed on that **baseline**, not on this uncommitted proposal.

## 1. Why P3-C is the next milestone

The P3-A/P3-B contracts model retirement records, proposed CAS/leases, uncertain coordinator persistence and witness-verification metadata. They correctly return only synthetic, non-authorizing outcomes. Two critical boundaries remain missing:

- **The final effect sink must fence stale owners, sessions, queued work and responses.** An epoch field in a coordinator record, a TTL, an operator approval flag, or a browser session claim is not enforcement. Every externally observable operation must check a trusted, durable high-water fence and current owner *at the effect sink*. Local caches may not grant permissions while a coordinator read is stale or unavailable.
- **Crash-recovery release must reconcile the journal, exact transaction lookup, and authoritative coordinator retirement anchor.** Ambiguous ACKs, replayed transaction IDs, unreadable journals or later journal heads do not prove the owner released the tunnel. In particular `NOT_SEEN`, `TIMEOUT`, or an expired lease must not automatically retry, mark the slot vacant, or launch a successor.

This proposal introduces exactly two NEW pure structural-review modules plus tests and this design note. It does NOT modify or connect any previous code. It intentionally does not implement a real coordinator, key store, witness, durable journal, browser, or transport gate.

## 2. Synthetic effect-side fence model

`reviewEffectFenceBoundary({snapshot, sink, delivery, dedupe, nowMs, maxAgeMs})` accepts **caller-provided JSON-style records only**. It checks:

1. Exact resource and owner/generation/lease identity, current `HELD` mode and `ACTIVE` sink claim. Rejects `VACANT`, `RETIRING`, `UNKNOWN`, residual owner conflicts and lapsed claimed expiration.
2. Claimed coordinator revision and commit index match both sink and delivery. Rejects future/stale delivery epochs and a sink ahead/behind the asserted coordinator fence.
3. Claimed sink checkpoint digest binds to the asserted coordinator head. A claimed durable fence/revision/commit high-water mark may **never** regress, including after a simulated crash or restart. This high-water mark is itself **untrusted** until real storage verification exists.
4. Session/delivery/response scope (`OPEN_SESSION`, `DELIVER`, `COMPLETE`) is bound to one owner/generation/lease, epoch, session and request identity. A claimed `SEEN` or `UNKNOWN` dedupe record, mismatched digest, or ledger revision drift blocks the review.
5. Rejects malformed, extra, inherited, accessor, symbol and overlong inputs. No observation data, identifiers, or synthetic secrets are echoed in result reports.

The only non-HOLD decision is `STRUCTURE_REVIEWABLE`. **Even then** `effectAuthorized`, `sessionAuthorized`, `deliveryAuthorized`, `fenceEnforced`, `leaseVerified`, `deduplicationVerified`, `coordinatorAuthenticated`, and `executionAuthorized` are *all false*. No effect is invoked or replayed. Never turn STRUCTURE_REVIEWABLE into a runtime allow decision.

### Future trusted sink requirements (NOT implemented)

- A resource-side admission and effects gate under independent review. Verify a genuinely authenticated, sufficiently fresh coordinator owner/epoch/revision and deny on quorum/clock uncertainty. Enforce the same gate for sends, queued deliveries, session opens, retries, responses, callbacks and future browser actions, including already-open sessions.
- Persist an authoritative per-resource **nondecreasing high-water fencing epoch** and associated revision/commit index in a crash-safe location. Atomicity between applying effects, rejecting stale epochs, and deduplicating request IDs must be designed explicitly. A local filesystem note or client cache is not a distributed fence.
- Deduplicate a versioned composite key `(resourceId, generationId, leaseId, epoch, requestId, canonicalRequestDigest)` with atomic commit-and-effect semantics or a deliberate outbox/inbox protocol. A single caller-reported `FRESH` state is not proof of first delivery. Handle unknown external effect outcomes without unsafe automatic replay.
- Wire no privileged browser capabilities into an advisory module. Preserve domain restrictions and separate user/operator approval, and keep production Finance isolated.

## 3. Synthetic uncertain retirement-release reconciliation

`reviewRetirementReleaseRecovery({journal,attempt,lookup,coordinator,nowMs,maxAgeMs})` structurally compares only a single `PUBLISH_RETIREMENT` transaction:

- Exact resource, old owner/generation/lease, expected revision and fence epoch, transaction ID and canonical request digest. No rebinding of a transaction to a new command or identity.
- Journal checkpoint must indicate a persisted certificate and an actual release attempt (`RELEASE_REQUESTED` or `RELEASE_CONFIRMED`). Intent, fence, drain, exit-observed, uncertain and certificate-only phases are **not sufficient**. Claimed fsync and directory-sync flags are checked for consistency but are not durability proof.
- Lost ACK or timeout followed by a caller-asserted matching `COMMITTED` lookup can be structurally reviewable, but is not authoritative. `NOT_SEEN`, `CONFLICT`, `INDETERMINATE`, ACK contradictions and mismatched commit indexes are `HOLD`; **safeToRetry remains false in every case**.
- The coordinator must claim exact `VACANT` state, no active holder, same retiring epoch, a matching certificate digest and old owner tuple. Its revision must be exactly the expected revision plus one, and its transaction commit index and head digest must match the lookup. A later head requires an independently authenticated history proof, so this narrow model refuses optimistic reconciliation.
- All timestamps are caller-controlled. The real system must bind them to a trusted coordinator clock and authenticated log. A claimed `linearizable-asserted` value does not make a read linearizable.

Every result leaves `recoveryComplete`, `retirementVerified`, `leaseGranted`, `safeToRetry`, `safeToRelease`, `startupAuthorized`, `executionAuthorized`, `coordinatorCASVerified`, `witnessVerified` and `durableJournalVerified` **false**.

## 4. Crash/fencing failure matrix

| Crash/attack window | Model response | Required future trusted action |
| --- | --- | --- |
| Old session or delayed message after epoch advance | HOLD: stale delivery epoch / wrong owner | Reject at effect sink, regardless of cached session |
| Sink or coordinator rolled back below persisted fence high-water | HOLD: rollback | Restore authoritative state; maintain fence; never lower epoch |
| Sink high-water exceeds asserted coordinator snapshot | HOLD: stale snapshot / high-water rollback | Authenticated, linearizable reread; do not admit effects |
| Duplicate request or unknown dedupe ledger | HOLD | Durable atomic dedupe and idempotent resolution; no blind replays |
| Lease expired but coordinator still HELD | HOLD | Expiry is not ownership release; resolve retirement and fence |
| Journal intent/fence/drain/exit observation persisted, release not attempted | HOLD | Independent exit witness, durable certificate and coordinator CAS first |
| Certificate persisted but release request not recorded | HOLD | Reconcile journal; no proof of coordinator release |
| Release CAS applied but response lost | STRUCTURE_REVIEWABLE only if exact synthetic lookup reconciles | Authenticate coordinator, verify durable CAS and witness; no implicit startup |
| Lookup NOT_SEEN/CONFLICT/INDETERMINATE | HOLD | Durable authoritative transaction reconciliation; never automatic retry |
| Committed lookup but later coordinator head | HOLD | Verify complete authenticated transaction history |
| Epoch, owner, resource, digest or transaction identity changed | HOLD | Operator-led security review; never reuse old transaction identity |
| Coordinator unreachable, quorum split, time source unknown | No safe effect/recovery decision | Deny admission and fail closed until trust is restored |

## 5. Trust boundaries and test scope

All observed records are synthetic **claims**. Digest-shaped values are not cryptographically recomputed, checked against signatures, or anchored to authenticated storage. No kernel process descriptor is opened or inspected. No browser, credential, network call, local live process, tunnel or filesystem adapter is used. The models read no real clocks. Real untrusted bytes must be bounded and canonicalized by a separate JSON parser before being represented as plain data; hostile JavaScript Proxy traps are outside the input boundary.

The local verification suite runs both new test files and the nine existing `private-runtime-*.test.mjs` files using Node 22 only. The tests include fail-closed epoch and replay combinations, restart rollback floors, split-owner inconsistencies, transaction ambiguity, fake durability, prototype/getter poisoning, report immutability, exact failure diagnostics and hundreds of deterministic synthetic permutations. No non-synthetic test or CI run is claimed for this uncommitted proposal.

## 6. Implementation and approval gates

1. **Current action:** review this pure P3-C design and five-file patch. No repository writes are authorized by this artifact.
2. **If separately approved:** reverify GitHub branch HEAD, baseline blob hashes and all five new paths; apply only these files to the development branch; run isolated tests and both API1 CI workflows. Never merge or deploy under that approval alone.
3. **Later architectural review:** choose a genuinely durable/linearizable coordinator; authenticate and pin authoritative coordinator and witness identities; specify resource-side atomic fencing, authenticated anti-replay store, server-side clock, failure injection and crash-consistent journal protocol.
4. **Separate operational approval:** only after verified security, isolated integration tests and a fresh operator-controlled cutover plan may anyone discuss connecting trusted adapters to actual processes/tunnels. Nothing in P3-C enables this.

**Compatibility:** Existing `private-runtime-startup-plan.mjs` continues to return `HOLD` for a claimed retired process without trusted independent evidence. This proposal does not modify that behavior or grant a lease.
