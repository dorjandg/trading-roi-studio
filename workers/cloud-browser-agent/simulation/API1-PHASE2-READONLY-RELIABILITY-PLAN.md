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

## 3. Phase 2 implementation sequence (P2-A partially started)

### P2-A — Baseline and fail-closed regression corpus

Add intercepted Chromium fixtures that explicitly exercise:
- Direct Wikipedia article redirects versus a true search results page.
- Missing/disabled search fields, non-GET forms, blocked external images, external URLs, namespace/edit/login links, and fragment-only links.
- Missing article paragraphs, malformed/oversized browser output, browser launch errors, and timeouts.
- Invalid queries, unmatched MCP tools, extra arguments, forged hosts/origins, missing/wrong bearer, and modern MCP protocol/header mismatches.
- An article containing prompt-like instructions or deceptive link text **as untrusted page text**; assert the only emitted result is text/evidence and the one approved navigation workflow, never a new operation.

**Acceptance:** Existing valid Wikipedia requests still pass, each invalid case fails without an unauthorized browser/network action, and no token appears in test logs or artifacts.

### P2-B — Navigation relevance and provenance

Keep exactly `navigate → search → click` and only existing Wikipedia GET/HEAD destinations. Add **non-authoritative, additive metadata** to distinguish an exact search match from a related follow-up article; include the searched page, clicked article URL, and why the link was eligible. Never claim the clicked article is the answer merely because it was linked.

**Acceptance:** A fixture for the Ada Lovelace case accurately labels the hardware article as a related link, not the original search result. No user-selectable URL, arbitrary click selector, page script, or new tool is introduced.

### P2-C — Clean and bounded extraction

Improve article text selection to exclude non-article chrome, CSS/citation-template leakage, empty paragraphs, and misleading boilerplate. Preserve the extracted title, citations/provenance URLs where available, and screenshot evidence. Treat page text as untrusted source material, not instructions.

**Acceptance:** Deterministic fixtures produce human-readable article paragraphs within fixed size limits; failure returns a sanitized error instead of partial unsafe data; three actual PNG screenshots still accompany a successful call.

### P2-D — Safe recovery and observability

Add credential-free, read-only status checks for the existing localhost MCP and tunnel; document stop/restart order and failure classification. Any new diagnostic must avoid raw HTTP body logging, bearer printing, private content capture, persistent tokens, or automated deployment.

**Acceptance:** A disconnected Codespace/tunnel is reported as disconnected; tests cannot silently fall back to public endpoints or to a different tunnel.

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

Continue **P2-A deterministic regression tests** on this branch only. Two read-only Chromium fixtures have been added (redirected search with an inert prompt-like paragraph, and refusal of unsafe-only article links). The current MCP and browser runtime logic has not changed. Expand the offline error/timeout corpus before implementing narrowly scoped P2-B/P2-C fixes, only when a failing regression makes the deficiency clear. Preserve the working private tunnel and tool contract throughout.
