# OmniPilot native runtime integration

Status: development components with offline and local-loopback verification.
The general controller is not yet installed in the ChatGPT plugin. The existing
restricted Wikipedia tool reported `tunnel_client_not_seen` during the
2026-11-24 check, including after its development Codespace was reopened.

## Chosen connection path

The existing launch chain is `launch-private-tunnel-target.mjs` →
`private-tunnel-prep.mjs` → `private-tunnel-profile.mjs`, with the restricted
`isolated-real-browser-mcp.mjs` backend. It prepares a private loopback target,
local bearer file and tunnel profile. It does not start `tunnel-client`.
The profile sets one concurrent request and disables OAuth discovery.

OpenAI's runtime API key authenticates the tunnel client to its control plane;
the key is not an end-user identity assertion delivered to this backend.
The configured file-backed Authorization header authenticates the local hop.
Connector-forwarded headers apply after static extra headers and may replace
Authorization, so exact local bearer validation must remain fail closed.
Never read credential values into chat, ordinary logs or source control.

Before expanding this connection, verify current plugin sharing and every
tunnel-associated organization/workspace, Tunnels Use grant, service principal
and API/connector route. All accepted callers share one fixed operator browser
owner. Private plugin visibility alone does not prove that no other caller can
reach the tunnel. Use real per-user OAuth and isolated state if that boundary
cannot be established. Caller metadata cannot declare its own identity.

Cloudflare Access assertion/JWKS lifecycle modules are a separate optional
authentication path. Their persistence, issuer verification and rollback-floor
requirements remain valid for that path, but are not prerequisites of a native
static-bearer pilot. Mock OAuth/login modules must remain test-only.

## Private MCP transport

`createOmniPilotMcpServer` in `omnipilot-tunnel-mcp.mjs` receives a trusted fixed
`adapter.execute`, owner `stop` capability and `bearerToken`. These are composition
inputs, never request fields. It creates only a loopback listener and exposes
two accurately annotated tools:

| Tool | Input | Behavior |
| --- | --- | --- |
| `omnipilot_browser` | `{command: ...}` using the existing generic command schema | Runs one bounded primitive in the fixed owner context. Website actions may write. |
| `omnipilot_stop` | `{}` | Permanently stops command admission and initiates owner containment. Does not claim rollback or verified browser termination. |

The shared generic normalizer remains the authoritative command validator.
No script execution, file handling, account/profile selection or credentials are
accepted. Modern MCP `2026-07-28` routing and the existing legacy `2025-06-18`
envelope are supported. The listener validates Host, Origin, exact bearer,
duplicate security headers, strict JSON and bounded request/response sizes.

There is one active command. Uncertain execution, timeout, malformed/unbounded
results or incomplete local response delivery after submission stop the owner
before admission can reopen. Errors preserve `dispatched`, `outcomeUnknown` and
`retrySafe:false` without raw exception details. A local HTTP `finish` event
does not prove remote receipt; the tunnel/client must preserve outcome uncertainty
and must not automatically repeat an action after a lost response.

PNG screenshots are bounded and returned once as an MCP image block, with
separate structured metadata. Page text and image evidence remain untrusted.
Control masking does not guarantee that visible page content contains no secret.

## Public destination broker

`createPublicConnectProxy({socketPath, limits})` in
`omnipilot-public-connect-proxy.mjs` creates a host-side Unix-socket broker.
It requires a fresh empty owned mode-0700 directory, a canonical short absolute
socket path and usable host-interface inventory. It refuses stale sockets and
untrusted directory ancestry rather than deleting or reusing them. The socket is
private to the owner. Test-only resolver/dial/listener/clock/interface inputs are
trusted test seams and must never come from MCP data or deployed configuration.

Only one strict HTTP/1.1 CONNECT request to port 443 is admitted. The exact Host
must match its authority; credentials, cookies, unknown or duplicate headers,
body framing and bytes sent before acknowledgment are refused. All A and AAAA
answers must pass the conservative public-address policy. Mixed public/private
answers fail closed. Local host interface addresses are excluded even when they
are globally numbered. One numeric address is dialed, with no resolver fallback
or alternate-address retry, and the actual connected peer must match before 200.

The policy excludes all IPv4 special-purpose ranges, multicast/reserved space
and Azure's platform virtual address. IPv6 permits ordinary `2000::/3` global
unicast while excluding its special-purpose blocks. The explicit tables must be
reviewed against the IANA registries when allocations change.

CONNECT forwards opaque bytes. This module permits bounded public TCP/443;
it does not terminate TLS or prove that a peer speaks HTTPS. Normal browser TLS
verification remains required. Public services that proxy other networks and
privileged host routing changes are outside this module's guarantees.

Default bounds are 16 clients, four in-progress resolution/dial operations,
eight tunnels, 8 KiB headers and 32 MiB combined bytes per tunnel. Header,
connect, idle, tunnel-life and close deadlines are bounded. There is no queued
destination work. `close()` immediately revokes admission, aborts pending work
and requests socket destruction; its bounded receipt reports remaining resources.
It does not assert browser isolation or termination.

## Required composition and live acceptance

The browser launcher and namespace bridge are not implemented by these modules.
A trusted composition root must create and verify the complete boundary before
issuing the generic owner's egress lease. A caller flag or URL predicate cannot
substitute for it. The intended host boundary uses a fresh network namespace,
private filesystem/environment and a narrow proxy bridge to this broker. The
owner must control browser processes, pipes and shutdown, including failure.

1. Inspect the existing development host, actual branch/HEAD and dirty filenames.
   Identify the owned browser/MCP/tunnel processes using sanitized metadata.
   Preserve local work and credential files; do not guess a service name or PID.
2. Restore the already configured restricted tunnel using its installed client's
   observed configuration and supported command. Restarting the target generates
   a new ephemeral port/profile/header path; coordinate both ends rather than
   assuming the old tunnel profile remains valid. Verify the restricted tool.
3. Verify the audience described above and host support for namespaces, private
   Unix sockets, interface inventory, Chromium and the runtime bridge. Refuse
   generic launch if any required capability is absent.
4. Implement the owned launcher/bridge and test on disposable controlled pages.
   Verify redirects, subresources, DNS rebinding/mixed answers, direct networking,
   UDP/WebRTC, service workers and shutdown/error paths against the real boundary.
5. Connect the accepted owner to the new MCP transport. Refresh the authorized
   development plugin, verify both tools, run one controlled action and inspect
   bounded screenshot/text evidence in a normal ChatGPT conversation.

Protected persistent accounts, login handover, file uploads/downloads and
multi-user access remain later work. Do not enable them by widening this MVP.

## Evidence limits

The focused tests use real test-owned loopback TCP listeners, fake browser
adapters, synthetic DNS answers and fake upstream Duplexes. They do not dial
public or unrelated private destinations and do not prove production UDS or
browser confinement. They are separate from earlier fake-browser and disposable
SQLite test evidence.

The current chat execution host can create an empty network namespace and a TCP
loopback listener. It denies namespace loopback NETLINK_ROUTE setup, Unix-socket
binding, Chromium's singleton socket and Node interface enumeration. Full browser
acceptance cannot run there, and no weaker public-network fallback is permitted.
Codespace UI opening alone is not shell or process evidence; terminal checks
were blocked by Workspace Trust. Runtime availability must be observed after
access is resolved, not inferred from source/test success.

## Primary references

- [OpenAI Secure MCP Tunnels](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [Official tunnel-client configuration](https://github.com/openai/tunnel-client/blob/master/docs/configuration.md)
- [Official tunnel-client architecture](https://github.com/openai/tunnel-client/blob/master/docs/architecture.md)
- [MCP TypeScript SDK protocol versions](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions)
- [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry/)
- [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry/)
- [Azure platform virtual address](https://learn.microsoft.com/azure/virtual-network/what-is-ip-address-168-63-129-16)
- [Bubblewrap options and namespace behavior](https://github.com/containers/bubblewrap/blob/main/bwrap.xml)
