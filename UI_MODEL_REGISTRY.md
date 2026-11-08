# 4Ds Trading Studio — Canonical UI Model Registry

> **READ FIRST BEFORE ANY WEBSITE CHANGE.** This is the permanent, versioned design and interaction memory for every AI collaborator, including in a new chat. The source code of every HTML entry page links here in its opening comment. Follow this registry and its referenced examples before writing code. If a new design pattern is approved, register it here immediately with its canonical source, interaction rules, and migration status. Never silently replace an approved model with an invented alternative.

## Model lookup workflow (mandatory)
1. Open the HTML page's opening `4DS UI CONTRACT` comment; read `AGENTS.md`, this registry, and the linked model spec.
2. Identify which approved model applies (table, section, card, filter, chat, form, etc.). Open its **actual working reference code** and inspect how it handles mouse, touch, mobile, state, local/cloud persistence, rerenders and accessibility.
3. Reuse the approved model. Do not copy only the appearance while inventing different interactions. If model is missing or inconsistent, document the gap and propose a canonical implementation rather than introducing a parallel style.
4. Preserve data logic, formulas, account identity, risk settings, user preferences and prior saved state. Verify interactions before reporting a migration as complete.
5. After the user approves a new pattern, add a new model section or version here, identify the canonical reference, and update the affected pages' implementations.

## MODEL-001 — Portfolio Simulator tables (APPROVED REFERENCE)
**Canonical page:** `portfolio-simulator.html`, under **Accounts → Portfolio SIM**.
**Detailed contract:** `TABLE_UI_STANDARD.md`.
**Exact source landmarks:** `enableDirectTableHeaderDrag` (touch/mouse pointer-based header dragging), `enableColumnPointerReorder` (filter-list drag handles), `addJourneyColumnFilters` (small upper-right ☷ filter popup), `phaseColumnDescriptions` (header help), `cash-table-shell` / `cash-table-columns-trigger` / `cashColumnsPanel` (compact filter positioning), `cashColumnOrder` / `saveCashTablePrefs` (persistent preferences).
**Default behavior:** small top-right filter icon, same Portfolio SIM filter workflow and position; pointer-drag the column header left/right on mouse AND touch; compact headers with hover/tap definitions; ascending/descending sorting where applicable; compact paging; persist order, visibility, sorting and page size per table; stable selections across pages.
**Do not substitute:** HTML5-only drag/drop, permanently visible oversized filter panels, or a new set of drag arrows when the canonical pointer drag works. Preserve any existing table-specific user preferences and schema.
**Migration status:** Portfolio SIM is the reference, not necessarily unified internally. Scenario Optimizer now uses the Portfolio SIM pointer-based header drag implementation and compact upper-right ☷ Category/Manual filter popup (commit ed765c2); live browser verification remains outstanding. Other pages are not audited. A header comment is a design contract, not proof that a page's widgets are migrated.

## MODEL-002 — Sections, icons and collapsible panels (REFERENCE TO BE VERIFIED)
**Reference page:** `portfolio-simulator.html` for compact, numbered/collapsible results sections, and `index.html` for Firms sections. Inspect actual current DOM/CSS before changing.
**Rule:** reuse existing section title hierarchy, compact spacing, collapse/expand placement, icons and persistence instead of introducing new emojis, button styles or full-width panels. Preserve collapsed state when supported. No universal section-icon design has yet been audited and approved; register a concrete source before asserting one.

## MODEL-003 — Page-level navigation and saved workspace state (EXISTING)
**Reference:** `index.html` plus `studio-last-position.js` for same-tab refresh scroll and open-details restoration. Respect URL navigation, existing app-specific state, and user-selected view. Do not confuse same-tab session state with cross-device persistence.

## MODEL-004 — Compact header labels (EXISTING)
**Reference:** `studio-compact-table-headers.js` plus `portfolio-simulator.html` `phaseColumnDescriptions`.
**Rule:** compact visible text (target <=12 chars), full metric explanation on hover and tap, accurate units and formulas. Never abbreviate away meaning; preserve explicit help independently of sort and drag actions.

## Future model template
For every newly approved model add: `MODEL-NNN`, user-approved name, canonical page/component/function, appearance, desktop/touch/mobile behavior, control placement, persistence keys, constraints, tests, migration status and change history. Cross-reference it in `AGENTS.md` if critical.

## Governance
- All eight website entry pages must retain a `4DS UI CONTRACT` comment immediately after the doctype; this comment points to this registry and the reference page.
- This contract applies to any AI working on the repo, including new chats and scheduled automation. It is repository guidance, not a technical guarantee that external AIs will obey it; collaborators must read and follow it.
- A page may implement a different model only when the user explicitly approves an exception and it is registered here.

**Created:** 2026-11-08. **Owner-approved direction:** use the existing Portfolio SIM as the canonical model; record each newly approved model for reuse.

## MODEL-005 — Fast Pass + Reset scenario decision engine (experimental, 2026-11-08)
- Canonical implementation: `studio-scenario-discovery.js` in Firms → Scenario Optimizer. Preserve Portfolio SIM table interaction model (MODEL-001).
- Per-attempt state: profit target, RR, win probability, overall modeled risk cap. Trade 1 attempts the pass; trade 2 attempts the pass after loss; trade 3 targets a breakeven reset (or explicitly labeled alternative pass); trade 4 uses remaining capacity (or half-reserve variant). Stops at pass, reset or exhausted four-trade attempt. A reset is NOT a pass and multi-day restart is NOT modeled.
- Output: probability of pass, reset, risk-cap exhaustion, expected executed trades, and all terminal win/loss paths. The model is illustrative; no firm compliance, fees, execution costs or live trade data are implied.
- Approval status: user requested testing this model; results and parameters remain experimental pending validation. Do not silently change live risk strategies.

### Phase target extension (2026-11-08)
- Scenario Optimizer now distinguishes daily objective, cumulative phase target, and minimum successful daily-objective days. Multi-day pass probability is a seeded 3,000-trial, maximum-12-day approximation, not a verified Topstep consistency evaluation. Losses and modeled drawdown carry forward; successful days are counted only when their daily objective is reached. Expanded path tables remain single-attempt outcomes. Do not conflate these two metrics.

### Scenario input autosave (2026-11-08)
- `studio-scenario-discovery.js` stores the six editable inputs (`goal`, `phase`, `days`, `wr`, `rr`, `cap`) on input/change in browser `localStorage` under `studio:scenario-discovery:inputs:v1:<stage>`; restores separately for p1/p2/funded. A compact Saved ✓ status confirms local write, or an error label reports unavailable storage. Find paths remains an explicit calculation action. Browser-local saving does not sync between devices, modify firm defaults, or apply a scenario to Portfolio SIM.

### Firms R1–R4 / Fast Pass navigation (2026-11-08)
- `index.html` `renderRecoveryPlanners` adds read-only daily objective and successful-day context to `Target & risk values`, with `data-open-fast-reset` button. Clicking opens the stage-matched `studio-scenario-discovery.js` optimizer, copies the stage planning target to the optimizer phase target, persists via input event and runs `Find paths`. The older `risk-route-explorer.js` remains a separate fixed-tier scanner and is NOT replaced by the multi-day model. Do not claim Portfolio SIM adopts this policy.

### Portfolio SIM allocation relocation (2026-11-08)
- In `portfolio-simulator.html`, `placeAllocationWithAccounts()` moves the existing `#capitalAllocationPanel` DOM node from Section 1 into `#accountAllocationHome` in Section 2 above `#accounts`, preserving IDs, current values, event handlers, and persistence. The panel remains collapsed by default. Per-account evaluation/funded caps already exist on each comparison card; shared purchase policies remain shared. No underlying allocation calculations were changed and no Section 1 fields were deleted in this migration.
