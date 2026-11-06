# 4Ds Trading Studio — Project Context for Future Chats

Updated: 2026-11-06. Read this together with AGENTS.md. Repository code is authoritative; this is a handoff, not a deployment verification.

## Project
- Repository: dorjandg/trading-roi-studio
- Main website: https://trading-roi-studio.pages.dev/
- Simulator: https://trading-roi-studio.pages.dev/portfolio-simulator.html
- Four independent workspace labels: Doen, Dori, Dona, Dion.
- User expects direct GitHub edits, tests and commits, not standalone mockups. "go" means execute the agreed next change.
- Keep the website compact, aligned, responsive and uncluttered. Do not add a visible technical guide.

## File ownership
- index.html: Overview, Firms, other main Studio pages and navigation.
- portfolio-simulator.html: section markup, input/controller wiring, account plan overrides, Run Simulation.
- portfolio-engine.js: Monte Carlo phase lifecycle, distinct signal-to-account routing, trading risk, drawdown, payouts.
- portfolio-discovery.js: risk discovery / Find Better Models.
- portfolio-payout-optimizer.js: Calculate Investment risk/investment search and result metrics.
- portfolio-payout-ui.js: injected 3A reverse payout panel, seven input fields, state and save callback.
- portfolio-history.js: local and Google cloud-backed Section 8 records, export and reload.
- portfolio-journey.js: whole-account day-by-day paths versus aggregate averages.
- portfolio-charts.js: charts and separate Daily Spending Ledger.
- portfolio-to-firms.js: explicit movement of experiment risk settings to Firms.
- cloud-sync.js, cloud-bootstrap.js, cloud-config.js: per-user cloud profile settings.
- studio-header.js, studio-nav.css: shared navigation and header.

## Simulator sections
1. Investment and simulation inputs.
2. Prop-firm accounts and saved phase settings.
3. Find Better Models.
3A. Reverse Engineer Payouts; the panel is injected by portfolio-payout-ui.js.
4. Results across firms.
5. Charts.
6. Account Journey.
7. Detailed account simulations and R1/R2/R3 risk testing.
8. Simulation History for both simulation and investment optimizer outputs.
9. Daily Spending Ledger.

## Model behavior to preserve
- Primary modeled programs: FTMO 2-Step, Hola Prime 2-Step, and Topstep Trading Combine to Express Funded.
- Each daily trade signal should go to a *different eligible purchased account*. Existing accounts are reused and rotated before new challenges are purchased in dynamic mode. A purchased account keeps its identity through phase progression.
- Account phases advance Challenge -> Verification if applicable -> Funded -> payout eligibility/request -> first paid. Stage progression is one way. The model does not yet simulate repeat payouts from the same account.
- Risk-blocked/exhausted is distinct from a prop-firm failed/breached account. Preserve both counters.
- Phase risk parameters: R1, R2, R3, RR, sequence policy, max winning trades/day; distinct settings per phase. Saved Firms risks are not overwritten by a simulator experiment unless explicitly sent.
- Current Topstep model handles EOD trailing maximum loss, funded activation limits, and a simplified Standard XFA first payout. Do not present assumptions as live rule verification.
- Qualification/admin minimum-size trades are illustrative placeholders, not real zero-risk trading.
- Payout waits are approximated in trading days. Spread, fees, margin, unofficial rules and actual trading outcomes may vary.
- Monte Carlo output is a model of random outcomes, not an investment forecast or a guarantee. Sample whole-account timelines differ from cross-trial averages; keep that distinction clear.

## Reverse Engineer Payouts
Seven editable fields:
1. Total payout cash ($).
2. Minimum payout per distinct account ($).
3. Selected account type.
4. Maximum starting investment ($).
5. Minimum ROI on fees (%).
6. Minimum net ROI on investment (%).
7. Target net P&L (USD); zero disables this additional constraint.

Collapsed **RR guidance** filters (added Nov 6): Min RR and Max RR (default 1.5R–3R). Investment optimization varies R1/R2/R3 tier-specific RR values within these bounds, for example R1 1.5R then R2 3R after a loss **if the current risk policy selects R2**. This is optional in the engine via `riskProfiles[phase].rrByTier={r1,r2,r3}`; older saved Firms risk profiles without this field continue using the phase-wide `rr`. Optimizer records persist the range, variant and tier values; the collapsed account trade walk-through shows each trade's selected tier and actual RR. Default funded 5R is no longer forced into optimized runs when max RR is 3R. Do not mistake bound values for actual live fills or a guaranteed trade outcome.

Calculation:
- Required distinct first payouts = ceil(total cash / payout per account). $10,000 / $1,000 -> 10 first payouts.
- For a CFD account with 80% modeled payout split, $1,000 withdrawal requires $1,250 funded trading profit, excluding any fee refund.
- Both average payout count and average total cash received must meet their targets; fee ROI, investment ROI and average net P&L must also meet specified minimums.
- Fee ROI = expected net cash / expected fees actually incurred.
- Investment ROI = expected net cash / tested initial budget.
- Net P&L = modeled cash receipts minus incurred expenses.
- Payout goal probability is calculated separately per trial. A strategy can have attractive average ROI but low chance of the required number of distinct payouts.
- Optimizer tries several investment budgets and scaled risk profiles, validates shortlisted options on separate random outcomes and displays the failed target gaps. Search is approximate and currently considers one account type at a time.
- Do not equate gross withdrawals with net after expenses: requesting both $10,000 cash payouts and $10,000 net after fees may require greater gross cash receipts.

## Standalone Calculate Investment assumptions (Nov 6 update)
- Section 3A now contains its own compact, **collapsed** Simulation assumptions editor. Each selected prop-firm account type has separately persisted overrides for trading days, signals/day, win rate, buy mode, signal outcomes, reinvestment, allocation/capacity settings, random seed, Phase 1/2 minimum days, funded payout wait calendar days (CFD), and payout processing calendar days.
- First use for each account copies current Section 1 and saved Firms values into the controls, and a Reset button reloads those defaults. After that, changing Section 1 does not silently overwrite the 3A assumptions. The values are saved under the existing per-user `payout-optimizer:v1` localStorage key in `assumptionsByAccount`.
- Firm risk limits and reserve remain read-only in this section and are displayed for context. Topstep winning-day eligibility is determined by the actual simulation engine rather than an editable CFD-style wait.
- These overrides change only the locally cloned plan used in Calculate Investment; Run Simulation, Section 1, and saved Firms data stay unchanged. Per-run optimizer history `inputs` now includes phase day and payout wait parameters to make subsequent analysis reproducible.
- When editing, keep the section compact/collapsible and prevent clicking Calculate Investment from resetting any input the user has just typed.

## Fastest-payout and target-based risk optimization (Nov 6 update)
- Reverse payout optimizer now tries two risk sizing styles: saved-tier scaling and **target-sized** risk. Target sizing computes R1 from the phase profit target / R1 RR, bounded by modeled daily and overall loss headroom. Scale is capped at 1 for the first risk to avoid deliberate first-win overshoot.
- After an R1 loss, `streak` risk policy selects R2 on a later trading day; its risk target is calculated to cover the first loss and complete the phase profit target on a win, but is capped by remaining overall/daily drawdown. This is a strategy hypothesis, not guaranteed loss recovery. R3 is separate.
- Example FTMO $10k Phase 1 $1k target, 3R, zero cost: R1 about $333.34; after one loss R2 about $444.45, producing net cumulative ~+$1k if R2 wins. Min 4 trading days can still delay phase advancement.
- Engine now supports optional per-tier RR and reports Monte Carlo conditional mean day of **first paid payout**, mean day of **full payout-count/cash goal** in trials that achieved it, and their occurrence rates. These measures include the modeled phase min-days, funded wait, and payment-processing assumptions.
- UI shows compact fastest-payout KPIs and a collapsed sizing explanation; detailed actual simulated account trade paths remain collapsed. A faster result based on rare wins is not preferred for the first-payout KPI without at least 50% modeled chance of receiving some payout. Treat KPI days as conditional, not forecasts.
- Optimizer's phase table now includes the profit target, R1/R2/R3, and tier RR. First payout speed does not override firm drawdown/risk-blocking rules. Results are still finite-grid Monte Carlo estimates, not a guarantee or global optimum.
- History stores the selected sizing mode and payout timing.

## History / latest-run retrieval
- Per-user local history key: 4ds:v1:<user>:portfolio-simulation-history:v1.
- Run Simulation records have schema 4ds-portfolio-simulation-v1.
- Calculate Investment records have schema 4ds-payout-optimizer-v1 and kind calculate-investment.
- A completed Calculate Investment run calls the shared history.saveOptimizer bridge. It saves locally and attempts separate cloud synchronization, with Section 8 offering cloud load, retry, and status. Local save alone does not prove cloud save worked.
- Connected Google Drive contains folder "4Ds Trading Studio Cloud Data" with separate user JSON files such as "4ds-dori.json". Read the current file using the connected Google Drive tool; JSON structure includes snapshot.entries. Parse snapshot.entries["4ds:v1:dori:portfolio-simulation-history:v1"] for history and select the most recent record of the requested kind.
- On 2026-11-06 the connected Dori cloud file was readable and had five saved Run Simulation entries, but no Calculate Investment entry at the time of the last verified check. This is historical, not a claim about future runs.
- The main website and history feature can both write the user's cloud profile. Preserve unrelated entries and investigate competing writes/revision conflicts before changing cloud code.
- If the latest requested run is absent, report this rather than substituting defaults or simulated test data.

## UI guidelines
- Compact grids, short controls and aligned labels. Reverse payout panel fields fit seven columns on wide screens, three on tablet, two on mobile.
- Reverse optimizer scenario cards: six KPI columns desktop, compact ~10px label/~12px value typography, minimal spacing, short phase risk rows, concise target-shortfall lines.
- Keep Run Simulation, Find Better Models and Calculate Investment buttons usable while their sections are collapsed.
- Keep lengthy explanatory text collapsed where possible. Maintain independent pagination for multiple daily account tables.
- Avoid unnecessary visible sections, oversized labels, or decorative formatting.

## Safe development workflow
1. Read AGENTS.md and this guide, then fetch current GitHub files and current SHA.
2. Scope changes to the module owning that behavior; preserve the saved profile format and existing user data.
3. Validate modified JavaScript; parse HTML inline script bodies.
4. For calculator changes, test representative FTMO and Topstep scenarios. Verify payout count, cash receipts, net P&L, both ROIs and account status counters.
5. Test Section 8 history for both types; do not claim actual Google cloud synchronization without reading back the written record.
6. Commit to GitHub; separately verify Cloudflare deployment when possible.
7. Update this guide on major changes. Avoid personal/private account information in repository files.

## Active limitations and next investigations
- Confirm Calculate Investment records arrive in connected Google Drive after real live runs.
- Reverse optimizer supports one firm/account type per search, not a mixed portfolio.
- Search explores a finite budget/risk grid, not an exhaustive global optimum.
- Separate expected-value feasibility from probability of reaching the payout goal.
- Consider additional trade-signal constraints, funded activation limits, risk tier optimization and payout lifecycle realism.
- Preserve dense UI across future iterations.

Suggested new-chat handoff: "Continue 4Ds Trading Studio from GitHub dorjandg/trading-roi-studio. Read AGENTS.md and AI_PROJECT_GUIDE.md, inspect current code, and implement directly. For my latest simulation use connected 4Ds Trading Studio Cloud Data and distinguish Calculate Investment from Run Simulation."
