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
| `simulation/access-keyset-lifecycle.mjs` | In-memory key freshness, generations, rotation overlap, revocation and tombstones; no key-source authentication or durable rollback state. |
| `simulation/isolated-browser-controller.mjs` | Bounded immutable queue, dispatch-time grant recheck, pending cancellation and uncertain outcomes after dispatch; not browser termination or durable fencing. |
| Private browser gateway and mock viewer ingress | Development-only loopback transport, bounded concurrent cleanup, synchronous failure-stop and validated uncertainty metadata across both hops. Mock login is not real user authentication. |
| `simulation/omnipilot-generic-browser.mjs` | Generic transport-free primitives over a trusted injected context, opaque owner capability and externally installed egress lease. Not registered as an MCP tool or wired to an active browser. |
| Mock OAuth upstream routing | Preserves validated MCP routing headers with a separate gateway-owned bearer; no caller identity headers cross. This does not replace real OAuth/Access verification. |
| Existing isolated MCP and screenshot adapters | Reusable protocol and bounded image/evidence handling. Existing exposed real-browser workflows remain restricted to Wikipedia or owned fixtures. |
| P3 ownership/coordinator/fencing modules | Advisory synthetic contracts. Do not treat structure validation as a live lease or execution grant. |

A test using a fake session proves the tested contract, not real browser/network
behavior. A source commit does not prove an active runtime or connector was
updated.

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

Keep key publication and lifecycle management private to the trusted owner.
Before runtime use, authenticate the issuer/key-fetch path and persist the
generation floor plus revocation/material history across restarts. Never use a
timeless startup key snapshot as the finished lifecycle.

Use protected, isolated Chromium profiles and a friendly-name account registry.
Credentials, MFA/recovery codes and session tokens stay outside chat, model
inputs and ordinary logs. Browser login handover and output redaction need
controlled acceptance tests. Masking form controls in a screenshot is not
complete secret redaction. The current generic adapter does not create or load
persistent authenticated profiles.

## ChatGPT integration

Use the existing Streamable HTTP/MCP work where compatible. Preserve protocol
routing metadata through intermediaries, bind authenticated identity to the
request, and expose accurately annotated tools. Generic browser writes cannot
inherit a Wikipedia demo's read-only classification.

Current workspace entitlement, OAuth discovery/linking/refresh, tool discovery,
image responses and a controlled action must be verified in a new normal ChatGPT
web conversation. Availability of the old restricted tool is not acceptance of
the universal controller. No new tool is enabled merely by adding source files.

## Shortest runtime integration path

1. Finish trusted key-source integration and durable lifecycle state.
2. Implement a real context-wide public-network boundary and operational owner.
3. Wire the generic primitives behind that owner with bounded outcome handling.
4. Test on disposable controlled fixtures, then an authorized isolated staging
   runtime; prove redirects/subresources and shutdown failures fail closed.
5. Register/refresh the custom MCP connection and run controlled acceptance.
6. Add protected persistent profiles and account switching, then uploads,
   downloads and bounded multi-step workflows.

## Standing development scope

The user authorizes ongoing isolated OmniPilot implementation, synthetic tests
and development-branch commits without asking for each small patch. Preserve
the separate boundaries for production, Finance, real credential changes,
tunnels, active service restarts, merges and deployments. Do not interpret
development approval as authorization to change those systems.

Use exact current-HEAD checks and atomic commits. Six repository-linked
Cloudflare Pages projects currently preview all branches, so development commits
must retain the verified `[skip ci]` prefix and receive post-commit checks.
Cloudflare can create skipped metadata records; require explicit skip flags and
unstarted stages rather than assuming that a record means a deployment ran.

OmniPilot must not place live trades or transfer funds. Keep API2 Finance and API3
Master Control separate. Authorized inspection, reporting and simulation do not
authorize financial execution.
