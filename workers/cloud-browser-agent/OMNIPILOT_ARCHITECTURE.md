# OmniPilot — Universal Remote Controller

Internal engineering identifier: API1. This is the existing browser project in
`dorjandg/trading-roi-studio`, developed on `api1-browser-interaction-phase1`.

## Product direction

Provide one general-purpose browser controller for normal ChatGPT conversations.
Use generic navigation, tab, pointer, keyboard, form, snapshot and screenshot
primitives rather than a new integration for every public website. Persistent
accounts, file handling and multi-step execution follow the first usable browser
slice. Remote desktop control is a later milestone.

Public destinations must not require a fixed website allowlist. They do require
a real network boundary that blocks unauthorized private, loopback, link-local,
metadata and infrastructure destinations across DNS resolution, redirects and all
browser network channels. Removing the current Wikipedia allowlist does not
provide that boundary.

## Development status and reusable foundations

| Component | Implementation and limit |
| --- | --- |
| Access assertion, Managed OAuth policy, trusted ingress and identity boundary | Synthetic review boundaries; all admission/execution authorization flags remain false. |
| `simulation/access-keyset-lifecycle.mjs` | Key freshness, generations, rotation overlap, revocation and tombstones; canonical complete checkpoints and private forks. Restored state remains on hold until a fresh advancing publication. No I/O or authenticated key source. |
| `simulation/signing-key-checkpoint-store.mjs` | Isolated local SQLite storage with complete-checkpoint compare-and-swap, explicit create/open, exact byte digests and acknowledged commits. Requires trusted private storage and a separately retained rollback floor. |
| `simulation/durable-access-keyset-owner.mjs` | Stages each operation in a private fork, saves the complete checkpoint, then activates only an exactly acknowledged result. Persists clock-only observations and halts on conflicts or uncertain writes. Review-only; no runtime admission. |
| `simulation/isolated-browser-controller.mjs` | Bounded immutable queue, dispatch-time grant recheck, pending cancellation and uncertain outcomes after dispatch; not browser termination or durable fencing. |
| Private browser gateway and mock viewer ingress | Development-only loopback transport, bounded concurrent cleanup, synchronous failure-stop and validated uncertainty metadata across both hops. Mock login is not real user authentication. |
| `simulation/omnipilot-generic-browser.mjs` | Generic transport-free primitives over a trusted injected context, opaque owner capability and externally installed egress lease. Its immutable command normalizer is shared with the private MCP transport. The explicit native composition supplies its disposable browser context; no general tools are installed in the active plugin. |
| `simulation/omnipilot-tunnel-mcp.mjs` | Private loopback transport exposing `omnipilot_browser` and `omnipilot_stop` to one fixed owner, with exact backend bearer validation, bounded commands/results, modern and legacy MCP envelopes, and synchronous stop initiation on uncertain execution or local delivery. This source is not installed in the active plugin. |
| `simulation/omnipilot-public-connect-proxy.mjs` | Host-side Unix-socket CONNECT broker. Validates every DNS answer, refuses special/private/local destinations, pins one numeric TCP/443 destination and checks the actual peer. The browser still needs independent namespace confinement and an owned bridge; this broker alone cannot enforce all browser traffic. |
| `simulation/omnipilot-native-runtime.mjs`, `omnipilot-native-child.mjs` and `omnipilot-native-channel.mjs` | Explicit version-gated Linux composition with fresh namespaces, a narrow read-only filesystem, clean environment, Chromium pipe/sandbox, private CONNECT bridge, bounded control frames and verified owned-process shutdown. The original MCP admission expiry crosses the process boundary without renewal. Real host acceptance and audience verification remain required before exposure. |
| Mock OAuth upstream routing | Preserves validated MCP routing headers with a separate gateway-owned bearer; no caller identity headers cross. This does not replace real OAuth/Access verification. |
| Existing isolated MCP and screenshot adapters | Reusable protocol and bounded image/evidence handling. Existing exposed real-browser workflows remain restricted to Wikipedia or owned fixtures. |
| P3 ownership/coordinator/fencing modules | Advisory synthetic contracts. Do not treat structure validation as a live lease or execution grant. |

Tests use synthetic assertions, fake browser sessions, disposable local SQLite
files, test-owned TCP loopback listeners and fake destination sockets. They do
not establish public browser/network behavior, production Unix-socket operation,
physical power-loss resilience or real account authentication. A source commit
does not prove an active runtime or connector was updated. The restricted local
Wikipedia workflow passed with live Chromium on 2026-11-24; that evidence does
not establish the new native general controller or a ChatGPT tunnel round trip.

## Ownership, dispatch and failure semantics

The runtime must have one trusted owner per browser context. Commands must be
bounded, copied before queueing, authorized at dispatch and tied to that owner.
Page text is untrusted evidence and cannot create grants, choose credentials,
override user scope or authorize subsequent actions.

A timeout or error after possible dispatch has an unknown outcome. Stop further
effects, preserve that uncertainty through every transport hop, and do not retry
automatically. Closing a queue cancels waiting work; it cannot prove a browser
operation was rolled back. Real isolation, bounded process/session termination
and crash-consistent resource-side fencing are separate integration requirements.

The gateway retains ownership of each controller entry until it has classified
the bounded result. It invalidates uncertain work before releasing that entry,
so the next queued action cannot race the gateway's timeout decision.

The generic adapter's guard lease is an integration prerequisite from trusted
owner code. Its existence is not evidence that network protection is installed.
A caller-supplied boolean, URL predicate or serialized capability cannot enable
the adapter. Runtime deployment must independently demonstrate complete egress
enforcement before exposing these primitives.

## Authentication and persistent accounts

### Existing native-tunnel route

The existing private pilot connects an OpenAI Secure MCP Tunnel to a loopback
MCP server. Its tunnel profile injects a protected file-backed backend bearer
and disables OAuth discovery. The launcher starts the local target; it does not
start the tunnel client. This route does not receive a Cloudflare Access JWT.

The backend bearer authenticates a fixed capability, not an individual ChatGPT
user. A private single-operator MVP may use this route only after verifying the
actual plugin audience and every organization, workspace, service principal and
Tunnels Use/API route that can invoke the tunnel. Private plugin visibility alone
does not establish sole access. If callers cannot be confined to one authorized
operator boundary, use real per-user OAuth and isolated state before exposure.
Never infer identity from caller headers, tool arguments, client information or
MCP metadata. Connector-forwarded Authorization can override a configured extra
header; the local server must retain exact fail-closed bearer comparison.

These are deployment prerequisites, not grants created by a boolean or test
fixture. The new private transport accepts its adapter and stop capability only
from trusted composition code. See [OMNIPILOT-NATIVE-RUNTIME.md](simulation/OMNIPILOT-NATIVE-RUNTIME.md)
for source contracts, evidence limits and the remaining live acceptance work.

### Optional Access assertion route

Keep key publication and lifecycle management private to the trusted owner.
The isolated durability prototype now saves the complete key history, generation,
policy binding and clock high-water mark in one SQLite transaction. The owner
stages a private copy and activates it only after exact commit acknowledgment.
Reopening always restores a hold; a fresh, strictly advancing publication must
pass the existing policy before the state is reviewable again. Refused requests
and status checks also persist any clock observation.

Before runtime use of this Access assertion route, authenticate the issuer/key-fetch path, provision protected
runtime storage, retain an independent trusted revision/digest and lifecycle
floor, and implement operational ownership fencing. A payload digest detects
byte inconsistency; it does not authenticate provenance or prove that the newest
state survived rollback. Never treat a timeless startup key snapshot or a
caller-supplied generation as a finished lifecycle. See
[ACCESS-KEYSET-PERSISTENCE.md](simulation/ACCESS-KEYSET-PERSISTENCE.md) for the
internal contract and recovery limits.

### Persistent accounts

Use protected, isolated Chromium profiles and a friendly-name account registry.
Credentials, MFA/recovery codes and session tokens stay outside chat, model
inputs and ordinary logs. Browser login handover and output redaction need
controlled acceptance tests. Masking form controls in a screenshot is not
complete secret redaction. The current generic adapter does not create or load
persistent authenticated profiles.

## ChatGPT integration

Use the existing Streamable HTTP/MCP work where compatible. Preserve protocol
routing metadata through intermediaries and expose accurately annotated tools.
The native adapter binds all accepted requests to one fixed operator context;
it makes no per-user identity claim. Generic browser writes cannot inherit a
Wikipedia demo's read-only classification.

Current workspace entitlement, tunnel audience, tool discovery, image responses
and a controlled action must be verified in a new normal ChatGPT web conversation.
OAuth discovery/linking/refresh is additionally required if that authentication
route is chosen. Availability of the old restricted tool is not acceptance of
the universal controller. No new tool is enabled merely by adding source files.

## Shortest runtime integration path

1. Restore and inspect the existing development runtime and native tunnel,
   preserving local work and protected credential files. Verify the actual
   tunnel/plugin audience before expanding its exposed tool surface.
2. On a capable host, implement and verify a real context-wide public-network
   boundary, private proxy bridge and operational browser owner. The CONNECT
   broker is only the host-side component of that boundary.
3. Wire the generic adapter to that owner and the new private MCP transport.
   Test disposable controlled fixtures, redirects, subresources, direct-network
   refusal, stop, uncertain responses and process cleanup without weakening the
   boundary when host capabilities are unavailable.
4. Refresh the authorized development connection and verify discovery, a bounded
   controlled browser action and image evidence through normal ChatGPT.
5. Add protected persistent profiles and account switching, then uploads,
   downloads and bounded multi-step workflows.

## Standing development scope

The user authorizes ongoing isolated OmniPilot implementation, tests and
development-branch commits without asking for each small patch. The current
continuation also authorizes restoring the existing development connection after
checking resource ownership and preserving uncommitted work. It does not grant
new tunnel audiences, real credential changes, production changes, Finance
execution or a merge to the production branch. Honor any concrete access or
security confirmation required by the connected tool at the point of action.

Use exact current-HEAD checks and atomic commits. Six repository-linked
Cloudflare Pages projects currently preview all branches, so development commits
must retain the verified `[skip ci]` prefix and receive post-commit checks.
Cloudflare can create skipped metadata records; require explicit skip flags and
unstarted stages rather than assuming that a record means a deployment ran.

OmniPilot must not place live trades or transfer funds. Keep API2 Finance and API3
Master Control separate. Authorized inspection, reporting and simulation do not
authorize financial execution.
