# API 1 — Phase 2 isolated read-only reliability and safety plan

**Prepared:** 2026-11-23
**Repository / branch:** `dorjandg/trading-roi-studio` / `api1-browser-interaction-phase1`
**Scope:** development-only; existing private, operator-controlled Codespace and Secure MCP Tunnel.
**Change approval boundary:** This document authorizes no deployment, merge, domain expansion, write action, OAuth rollout, credential change, or Finance interaction.

## 1. Verified baseline, not a proposed capability

- On 2026-11-23, the ChatGPT Business plugin **API1 Private Browser** was registered and the UI displayed “API1 Private Browser is now connected.”
- The connected MCP action `browser_automate_wikipedia_demo` was actually invoked from ChatGPT, searching Wikipedia with real Chromium. For **James Webb Space Telescope**, its result reported `status: passed`, `source: LIVE_CHROMIUM`, `navigate,search,click`, extracted article text, and three PNG screenshots. A second live **Ada Lovelace** test succeeded and clicked the *Ada Lovelace (microarchitecture)* article after the biography; this shows that the final click can lead to a merely related topic.
- Modern discovery `server/discover` with MCP **2026-07-28** and legacy `initialize` with **2025-06-18** are covered by automated tests; prior CI runs on `539ebfe26be81d4d5844832a27377802b490713d` succeeded.
- The private pilot depends on the running Codespace MCP server, the local tunnel-client, and the user's existing workspace association. It is **not** a Cloudflare or public production deployment.

### Code boundaries verified by inspection

- Exactly one exposed MCP tool, `browser_automate_wikipedia_demo`, with a bounded plain-text `query` argument. No input parameter accepts a domain, destination URL, script, account, or write instruction.
- Local MCP and upstream browser API bind only to `127.0.0.1` and require independent bearer credentials. The tunnel injects the local bearer from a mode-0600 file; the runtime API credential is separate.
- Browser routing allows `GET`/`HEAD` to approved HTTPS `en.wikipedia.org` paths only. JavaScript and service workers are disabled; downloads and permissions are denied; a fresh browser context is discarded after the call.
- The MCP tool is serialized, with sanitized errors and bounded request/response sizes. Annotation `readOnlyHint: true` is backed by actual source-level request restrictions, not relied upon alone.
- ChatGPT-side **No authentication** is scoped solely to this restricted private pilot; it is not per-user OAuth. This cannot be generalized to public/multi-user access.

## 2. Why Phase 2 is reliability-first

The end-to-end connection is now demonstrated. Expanding to other websites, logins, arbitrary browsing, tool writes, or hosted deployment would substantially enlarge the security surface and is **out of scope**. The highest-value next milestone is to make the existing browser's output accurate, predictable, and safe when Wikipedia markup, redirects, timing, or article links change.

The Ada Lovelace test showed a difference between *search intent* and *follow-up link*: the final article may not be the subject the user searched for. Phase 2 must disclose that distinction instead of making users assume the final article answers the original query.

## 3. Phase 2 implementation sequence (P2-A and P2-B implemented on isolated branch)

### P2-A — Baseline and fail-closed regression corpus

Intercepted Chromium, MCP, and synthetic browser fixtures now exercise:
- Direct Wikipedia article redirects versus a true search results page.
- Missing/disabled search fields, non-GET forms, blocked external images, external URLs, namespace/edit/login links, and fragment-only links.
- Missing article paragraphs, malformed/oversized browser output, browser launch errors, and timeouts.
- Invalid queries, unmatched MCP tools, extra arguments, forged hosts/origins, missing/wrong bearer, and modern MCP protocol/header mismatches.
- An article containing prompt-like instructions or deceptive link text **as untrusted page text**; assert the only emitted result is text/evidence and the one approved navigation workflow, never a new operation.

**Acceptance:** Existing valid Wikipedia requests still pass, each invalid case fails without an unauthorized browser/network action, and no token appears in test logs or artifacts.

### P2-B — Navigation relevance and provenance

**Implemented on the isolated development branch, not yet loaded into the live Codespace processes:** The browser still follows exactly `navigate → search → click` over existing Wikipedia GET/HEAD destinations. Candidate links are ranked with exact Wikipedia article titles first, then titles beginning with the query, then looser matches, *after* the existing safety allowlist is applied. The tool returns additive `navigationProvenance.searchPage` and `navigationProvenance.clickedArticle`, reporting the search-page URL/heading/kind, exact title matches, whether the follow-up came from search results or a related article link, and the ranking basis. The original `clickedLink`, screenshot, and extracted-text fields are preserved. This metadata is descriptive, not evidence that a related article answers the original search.

**Acceptance:** A fixture for the Ada Lovelace case accurately labels the hardware article as a related link, not the original search result. No user-selectable URL, arbitrary click selector, page script, or new tool is introduced.

### P2-C — Clean and bounded extraction

**Implemented in the isolated branch; verification requires both CI workflows on the final commit.** Article extraction clones each candidate paragraph and removes nested style/script/template/hidden and edit/navigation widgets before retrieving text; non-article navigation, sidebars, reference lists, boilerplate and infoboxes are excluded by their DOM containers. The extractor normalizes whitespace, omits short/duplicate paragraphs, preserves visible inline citation markers (such as `[1]`), and still returns the original `extracted: {heading, paragraphs}` shape. The existing clicked article and search-step URLs remain the provenance evidence, accompanied by three actual PNG screenshots.

Bounds: **180 heading characters, 4 distinct paragraphs, 4,500 characters per paragraph, 12,000 total paragraph characters**. Exceeding a selected text limit raises a fail-closed extraction error; the authenticated MCP layer converts upstream failure into a sanitized generic error without revealing page text. The allowed domain, HTTP methods, MCP tool count and input schema, credentials, and runtime processes remain unchanged.

**Regression evidence:** deterministic fixtures cover styled citation markup, hidden snippets, duplicate paragraphs, non-article sidebars, oversized prose and boilerplate-only pages; modern authenticated MCP fixtures verify cleaned text and sanitized overflow behavior. Actual CI outcomes must be checked separately on the final commit.

### P2-D — Safe recovery and observability

**Implemented on this development branch, not installed or run in the connected Codespace:** \`simulation/check-private-runtime-readonly.mjs\` accepts two explicit numeric localhost ports for tunnel-client health and private MCP, with no port scanning, default addresses, or credential inputs. It only issues fixed-path loopback GETs for tunnel liveness/readiness, bounded health snapshots, component states, and expected unauthenticated HTTP 401 at \`/mcp\`. It never sends any MCP RPC, reads credentials, starts a browser, logs raw bodies, changes runtime state, retries indefinitely, restarts a process, or follows redirects.

Reports distinguish \`ready_snapshot\`, \`limited\`, and \`attention\`, with sanitized classifications for unreachable/stale/non-ready/degraded services, expected MCP auth rejection, and unsupported HTTP-MCP health evidence. A ready snapshot **does not prove** ChatGPT association, authenticated tools/list, or end-to-end delivery.

\`test/private-runtime-readonly-health.test.mjs\` covers explicit-port safety, normal loopback health, read-only no-bearer requests, disconnected MCP, unexpectedly unguarded MCP, backoff-to-recovery classification, stale data, redirect refusal, and non-disclosure of untrusted response text. Both CI workflows include the new tests; see \`API1-P2D-READONLY-RECOVERY-RUNBOOK.md\` for operator-safe interpretation and manual recovery gates. CI success must be checked on the final commit.

## 4. Mandatory test and release gates

1. `node --check` on changed isolated files; deterministic `node --test` for unit/security cases.
2. Both existing API 1 GitHub Actions workflows green on the *final* changed commit, including real public Wikipedia Chromium validation. Do not substitute a fixture for the live test.
3. Assert exactly one read-only MCP tool, the allowed domain `en.wikipedia.org`, GET/HEAD-only network behavior, localhost-only server listeners, fresh contexts, no account operations, and no Finance imports.
4. Verify backwards compatibility with MCP `2025-06-18` and modern `2026-07-28`, including discovery, listing, and tool-call results.
5. Run a private ChatGPT invocation only **after** code/tests are ready and the operator deliberately restarts the existing ephemeral Codespace processes. A GitHub commit by itself does not update an already running Node process.
6. Never merge, deploy, enable writes, associate additional workspaces, rotate keys, change Cloudflare, register new plugins, or touch Finance without fresh explicit approval.

## 5. Explicit non-goals

No multi-site browser, arbitrary URLs, OAuth rollout, autonomous web actions, payment, login, scraping of accounts, form submission, upload, filesystem operations, public host, production workers, secret changes, or higher concurrency. Any future change to these boundaries requires a separate architecture, security review, and permission request.

## 6. Immediate next development task

**Next safe work:** verify both CI workflows on the final P2-D branch commit, then stop. Any local Codespace source sync, private process restart, deployment, or permission change remains a separate operator-controlled approval gate. Do not update the running private browser without deliberate operator-controlled synchronization and restart. P2-A now includes redirected searches, unsafe-only links, missing/disabled/external search actions, missing article text, malformed or oversized PNGs, simulated navigation timeouts with cleanup assertions, malformed JSON-RPC messages, mismatched 2026 protocol headers, and bounded MCP result validation. P2-B adds exact-result ranking and search-versus-related article provenance tests. These changes must not be used by the running Codespace processes until an operator deliberately updates/restarts the private local server and tunnel after final CI verification. No new website access or write tools have been added.
