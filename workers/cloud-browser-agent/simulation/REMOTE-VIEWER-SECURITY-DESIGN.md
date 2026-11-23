# API 1 — Private remote viewer design (isolated, not deployed)

## Trust boundaries
1. Chromium browser worker: Playwright process, disposable profile, approved read-only Wikipedia navigation. Browser traffic must never receive application credentials or arbitrary network permissions.
2. Private controller gateway: loopback-only `private-browser-gateway.mjs`, separate random bearer key. Commands restricted to search, approved click, back. No arbitrary code, uploads or login.
3. Viewer relay: loopback-only `read-only-viewer-relay.mjs`, independent random viewer key. Forwards only GET /health, /state, /links and /frame; never forwards POST or browser commands. Frame response PNG validated and capped at 3 MB.
4. **Future HTTPS ingress, NOT IMPLEMENTED:** authenticated user identity via managed OAuth/Access, origin checks, session authorization, short-lived server-side viewer grants, TLS, rate limits, audit and revocation. No public port forwarding or credentials in URL. Browser UI should use secure session cookies, not expose bearer keys in JavaScript.
5. ChatGPT integration, NOT IMPLEMENTED: requires an approved connector that can retrieve frames and invoke narrowly scoped commands. The local relay does not create a ChatGPT viewer automatically.

## Demonstration and CI
- All end-to-end tests use locally fulfilled synthetic Wikipedia HTML in real Chromium. They do not prove live Wikipedia connectivity.
- Verify unauthorized GET/POST denied, separate viewer/controller keys, forged Host and Origin denied, PNG signature and frame sequence, control blocked through relay, authorized gateway command changes subsequent viewer state.
- The external Google/NASA smoke tests remain non-blocking and may fail independently.
- GitHub Actions uploads an offline four-frame demo artifact; no deployed viewer URL exists.

## Before any remote deployment (explicit approval required)
- Threat model reverse proxy trust and forwarded headers; authenticate the user before any viewer response.
- Design multi-session isolation and cleanup, idle timeout, quotas and abuse protection.
- Validate DNS rebinding and SSRF defense for any additional allowed destinations; keep navigation allowlisted.
- Protect bearer tokens from logs, query strings, browser scripts and artifacts; rotate secrets.
- Add authenticated browser UI with secure session cookies and CSRF protection; independent read and control roles.
- Exercise remote access in a private staging environment after explicit authorization; then review before production.

**Do not deploy, merge, open public tunnels, or touch production as part of this design.**
