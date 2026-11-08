# AI collaborator instructions — 4Ds Trading Studio

**Read [AI_PROJECT_GUIDE.md](AI_PROJECT_GUIDE.md) before changing this repository.** The guide contains the product intent, simulation semantics, module map, history/cloud details, unresolved issues, and user-approved UI patterns. Keep it current whenever changing important functionality.

## Workflow across new chats
- This is an existing, actively used project. Inspect GitHub files first; do not rebuild as a new app.
- Website: https://trading-roi-studio.pages.dev/ ; main simulator: `portfolio-simulator.html`.
- Repository: `dorjandg/trading-roi-studio`.
- Make requested edits directly with GitHub connector; read current file and SHA, make the smallest targeted patch, validate, commit, and report the commit. Never claim live Cloudflare deployment is verified just because GitHub committed.
- User shorthand `go` means implement the last agreed change without another confirmation.
- Prioritize functional correctness. Preserve Monte Carlo assumptions, stage transitions, account identities, risk limits, formulas, and existing localStorage/Google Cloud user data.
- User strongly prefers dense, aligned, responsive controls and collapsed explanations. Keep the site compact; **do not show this entire AI documentation on the website**.
- Verify script syntax and, for calculation changes, run deterministic test scenarios including FTMO and Topstep. Do not call an illustrative fixture a live user simulation.
- If reading the user's last run, prefer connected Google Drive `4Ds Trading Studio Cloud Data` / `4ds-dori.json`, checking `snapshot.entries['4ds:v1:dori:portfolio-simulation-history:v1']`. Confirm timestamps and run kind. Browser-only data is not remotely accessible.
- Never confuse `Calculate Investment` with `Run Simulation`: they produce different outputs. They share Section 8 history and cloud-saving logic when deployed.
- New changes can be documented here and in `AI_PROJECT_GUIDE.md`, but avoid putting non-public personal data, API secrets, or sensitive financial account details in repository docs.

## Mandatory table-header contract — every future update
- Every table, including dynamically generated tables and column-filter menus on all pages, MUST show concise visible column names (12 characters maximum). Never introduce a long visible heading in a new feature.
- Each heading MUST retain a clear, precise full description in a hover tooltip/title (and accessible label when appropriate); describe whether it is a current count, cumulative milestone, amount, percentage, or subset. On touch devices provide an accessible tap-to-view explanation where supported.
- Standard active stages: P1 = Challenge, P2 = Verification, P3 = Funded (includes payout-pending), P4 = payout-pending subset of P3; do not double-count P4. P1 pass/P2 pass are cumulative milestones, not active counts.
- Keep stable underlying data keys, sort/filter behavior, persisted column preferences, and drag ordering unchanged. Update the shared dictionary in `studio-compact-table-headers.js` and any dynamically generated header/filter source together. Check for duplicate dictionary keys overriding mappings.
- Before committing UI changes, audit visible headers and filter labels for length and descriptions; verify dynamic rerenders and mobile/tablet presentation. Do not claim live verification without testing the deployed site.

## Mandatory table preference persistence
- Treat each table's last user-selected visible/hidden columns, column order, filters, and page size as durable user preferences. Persist changes immediately and restore them after refresh, rerender, and simulation runs; never silently reset preferences when changing a header label.
- Store by stable table/column IDs, not human-readable display labels. Migrate legacy saved keys when renaming labels, retaining old preferences. Keep tables independent, and avoid overwriting saved preferences with defaults during initialization.
- Browser localStorage persistence is per browser/device/profile; do not promise cross-device synchronization unless the connected cloud profile explicitly saves and restores these preferences.

## Compact table headings (strict)
- Every displayed table column heading is limited to 12 characters, preferably shorter. Use clear semantic abbreviations, e.g. Failed (failed accounts), Bought, Executed, Qual., Signals, P1 pass, P2 pass, P3 ready, P4 paid. Preserve the full explanation in a tooltip/title and accessible description.
- Apply this to dynamic tables and filter menus too; keep stable underlying data/column identifiers and migrate saved column presets and order when labels change. Do not change simulation calculations to shorten display labels.

## Shared UI component consistency
- Treat column-filter popovers, saved column presets, outside-tap dismissal, table headers, and compact pagination as shared UI patterns across the whole site. When modifying one, audit and update every existing instance that uses the same pattern, not just the screenshot's table.
- Column popovers should be compact, anchored to the table's upper corner, use consistent category/manual tabs, named Save/Load/Delete views, persist visibility and order, close on outside pointer/tap and Escape, and retain accessible labels. Do not silently replace saved user preferences.
- Verify each affected instance after patching; do not claim every table has been migrated unless the audit and changes are complete.
