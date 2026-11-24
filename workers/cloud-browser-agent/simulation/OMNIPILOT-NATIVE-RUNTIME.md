# OmniPilot native runtime integration

Status: development implementation; general-controller live acceptance and
ChatGPT exposure remain separate gates. The restricted Wikipedia browser passed
a real local Chromium navigation/search/click/text/PNG check on 2026-11-24. Its
loopback MCP target is running, but a runtime credential is still required to
start the tunnel client. The general tools are not installed in the ChatGPT
plugin. A successful local check is not a ChatGPT round trip.

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

At command admission, the transport creates a frozen owner-only absolute
monotonic expiry and passes it as the second `adapter.execute` argument. This
context is never read from caller JSON. The native adapter can shorten that
expiry but cannot restart the budget across process boundaries. The host verifies
that the child shares its Linux time namespace before using this clock contract.

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

## Native composition

`createNativeOmniPilotRuntime({installation, bearerToken})` in
`omnipilot-native-runtime.mjs` is an explicit trusted Linux/x64 composition root.
`installation` contains canonical `node`, `chromium` and `playwrightCore` paths.
It validates Node 24, bubblewrap 0.9.0, Playwright 1.56.1 and Chromium build 1194;
these version checks are intentional compatibility gates. The returned object
contains `url`, `close` and `diagnostics`. Importing the modules starts no service.
No request can select installations, environment variables, launch arguments,
broker test seams or a different browser owner.

The host creates fresh private source, metadata, broker and control directories.
The sandbox receives only fixed read-only runtime/system paths, the required
source files and the two socket leaf mounts. Host home/workspace directories,
the host root, tunnel credentials and the MCP bearer are not mounted or inherited.
Fresh user, PID, mount, network, IPC and UTS namespaces separate the child; the
host checks the actual namespace-init PID/start identity and namespace links.
The child verifies a clean environment, a fresh home and loopback-only interfaces
before the host authorizes browser startup. No unconfined fallback is provided.

`omnipilot-native-child.mjs` owns a loopback CONNECT bridge to the sole mounted
host broker socket. Chromium uses Playwright's private pipe, its sandbox and
normal certificate verification. It creates a disposable browser context with
service workers and downloads blocked. The generic adapter continues to reject
credential/file inputs. The control channel is established before Chromium
launch; channel loss, startup revocation, uncertain results and boundary failure
initiate containment. The host revokes the broker before releasing pending work
and signals only its verified owned namespace/wrapper.

`omnipilot-native-channel.mjs` uses bounded canonical JSON frames, one in-flight
command, exact message/result bindings and the original monotonic expiry.
Encoding and write completion are checked against the remaining deadline.
Shutdown receipts report observed process/namespace disappearance, broker close
and directory cleanup separately. They do not assert rollback, durable fencing,
complete live confinement acceptance or remote result receipt.

## Required live acceptance

The implemented boundary must pass on the actual target host before the general
tools are exposed. A caller flag, URL predicate or synthetic test cannot supply
that evidence. `run-omnipilot-native-acceptance.mjs` exercises the production
composition on a blank browser and records its exact limited scope. It does not
establish public HTTPS, direct TCP/UDP refusal or forced-parent-death behavior.

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
4. Run the owned launcher/bridge and test on disposable controlled pages.
   Verify redirects, subresources, DNS rebinding/mixed answers, direct networking,
   UDP/WebRTC, service workers and shutdown/error paths against the real boundary.
5. Connect the accepted owner to the new MCP transport. Refresh the authorized
   development plugin, verify both tools, run one controlled action and inspect
   bounded screenshot/text evidence in a normal ChatGPT conversation.

Protected persistent accounts, login handover, file uploads/downloads and
multi-user access remain later work. Do not enable them by widening this MVP.

## Evidence limits

The focused tests use real test-owned loopback TCP listeners, fake browser
adapters, synthetic DNS answers, fake upstream Duplexes, synthetic process
messages and disposable local files. They do not dial public or unrelated private
destinations and do not prove production UDS or browser confinement. They are
separate from earlier fake-browser and disposable SQLite test evidence.

The current chat execution host can create an empty network namespace and a TCP
loopback listener. It denies namespace loopback NETLINK_ROUTE setup, Unix-socket
binding, Chromium's singleton socket and Node interface enumeration. Full browser
acceptance cannot run there, and no weaker public-network fallback is permitted.
After the user trusted the development workspace, actual Codespace terminal
checks confirmed Unix-socket binding, host-interface inventory and a working
bubblewrap namespace probe. The official tunnel client was installed with its
release checksum verified, and the restricted browser passed its local live
workflow. The original checkout and its untracked files were preserved; further
source testing uses a separate detached worktree. Automatic port forwards were
removed. These observations do not establish general-controller isolation or
an active ChatGPT tunnel connection.

## Primary references

- [OpenAI Secure MCP Tunnels](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [Official tunnel-client configuration](https://github.com/openai/tunnel-client/blob/master/docs/configuration.md)
- [Official tunnel-client architecture](https://github.com/openai/tunnel-client/blob/master/docs/architecture.md)
- [MCP TypeScript SDK protocol versions](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions)
- [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry/)
- [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry/)
- [Azure platform virtual address](https://learn.microsoft.com/azure/virtual-network/what-is-ip-address-168-63-129-16)
- [Bubblewrap options and namespace behavior](https://github.com/containers/bubblewrap/blob/main/bwrap.xml)
