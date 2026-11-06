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

## Reverse Engineer Payouts (net P&L-only, Nov 6 update)

Main visible inputs: **Target net P&L (USD)** (required, positive); minimum first payout per account (USD); account type; maximum starting investment (USD). The old **Total payout cash** input was removed because a separate gross cash goal conflicted with the desired net profit goal.

One collapsed **Simulation Assumptions** area now contains both **Min RR / Max RR** and optional **Min fee ROI / Min investment ROI** (0% disables these additional constraints), alongside trading days, signals/day, win rate, account allocation, phase minimum days, payout waits and other isolated controls. There is no separate RR accordion.

Key calculations:
- Minimum distinct first payouts before expenses = `ceil(targetNetPnL/perAccountPayout)`; e.g. $5,000 net target / $1,000 per payout = **minimum 5 first payouts**. Incurred fees can require more.
- Each scenario displays **estimated payouts including fees** = `ceil((targetNetPnL + scenarioExpectedFees)/perAccountPayout)`. This is an indicative planning count, not a guaranteed exact number because realized per-account payouts may overshoot the minimum or include challenge fee refunds.
- A Monte Carlo trial achieves the main goal only if its **net cash after fees >= targetNetPnL** and its first-payout count meets the minimum baseline. Gross cash receipts are *outputs*, not a separate entered target.
- The funded profit target per account is computed using the modeled profit split: $1,000 / 0.8 = $1,250 for an 80% split, excluding refunded fees.
- Fee ROI = mean net / mean actual incurred fees; investment ROI = mean net / tested starting budget. Both are optional filters, not the primary goal.
- Time to complete payout goal is measured against *net cash* and payout count, not gross receipts. Target labels and new history entries use `targetBasis:'net-pnl'` and `targets.totalCash:null`. Old gross-cash history records remain readable with their old meaning.
- Per-tier R1/R2/R3 reward/risk is bounded by Min RR and Max RR. The engine supports optional `riskProfiles[phase].rrByTier`; ordinary saved Firms profiles remain unchanged.
- Search is approximate, one selected account type at a time, validating a shortlist on separate Monte Carlo trials. Never treat a 0% goal probability as a good recommendation or present model frequency as a real-world certainty.

Independent 3A assumptions are stored per selected account in the existing per-user payout optimizer preferences and do not modify Section 1 or saved Firms settings. The compact editor begins with inherited values and offers Reset to Section 1 / Firms. Risk limits and reserves are read-only.

## Scenario diagnosis and improvement ideas (Nov 6 update)
- After calculating investment, `portfolio-payout-optimizer.js` runs `diagnoseScenario(candidate,out)` against each validated candidate's actual average payouts, phase progress, risk-blocked count, fee drag, ROI filters, time horizon, and main net-P&L target.
- Each scenario card keeps its compact KPIs visible while closed and adds a single **Suggestion: ...** summary line. Expanded cards show a compact diagnostic table with the observed evidence and a concrete parameter change to **test**, with at most four prioritized issues.
- Diagnostics distinguish risk-blocked accounts from actual breached accounts, an unrealistic payout horizon from poor funded conversion, and net-dollar profit deficits from optional ROI percentages.
- Never recommend reducing firm-required minimum trading days or mandated payout waiting periods merely to make simulations pass; review legitimate terms and extend the planning horizon if necessary. Do not claim suggestions are causal improvements or optimize win rate by inflating it; use real trading history to validate assumptions.
- Keep the suggestions concise and evidence-based. The output is a hypothesis-generating aid, not a backtested or guaranteed trading recommendation.

## Portfolio Sim Run Simulation advisor (Nov 6 update)
- Section 4 result cards now show a one-line **Scenario advisor** diagnosis with the compact metrics; a separate collapsed **Why this result?** detail lists up to four prioritized evidence-based hypotheses and parameter tests.
- Uses the *actual Run Simulation Monte Carlo aggregates* and stage funnel: challenge purchases, phase conversions, funded activations, first payout counts, risk-blocked versus failed accounts, incurred costs, net target chance and the average daily unused signal slots.
- No automatic parameter edits or new simulation assumptions. Avoid interpreting in-progress stage conversion as actual failures. Risk-blocked is distinct from breached accounts, and unused signals are not unsuccessful trades.
- Suggestions may involve safer tier sizing, checking signal capacity and account availability, reviewing payouts/costs, or testing a longer horizon. Never shorten mandatory firm delays or claim a causal improvement from a single result.
- This is distinct from the existing Section 3A Calculate Investment diagnostics. It does not change either calculation engine.

## Simplified Calculate Investment results appearance (Nov 6)
- The previous heavily shaded 01/02/03 section bars, repeated result-validation explanation, redundant scenario suggestion lines, six closed-card KPI chips and dense borders made the desktop results confusing.
- The new renderer shows a simple **Simulation result** heading, single result status and main gap, collapsed target/timing explanations; then **Scenarios (N)** with a compact sorter and four headline KPIs (net P&L, budget ROI, investment, goal chance). Extra KPIs, diagnostics, risks, trade paths and fee ROI remain available inside each expanded scenario.
- Excluded risks/methodology are grouped under a collapsed **References & methodology** details section. Visual CSS scoped to `#payoutOptResults` removes noisy dark header fills and excessive borders while keeping subtle open-state highlighting and light/dark compatibility.
- No mathematical changes to Monte Carlo, sorting, account allocation, Firms settings or saved history. Basic JS syntax and generated markup details-balance checked; live browser not verified.

## Mobile Portfolio Sim accordion reset and compact headers (Nov 6)
- On viewport width <=650px, all **top-level Portfolio Sim sections** (1/2/3/3A/4/5/6/7/8/9) begin collapsed on each page load, even if desktop-local saved `numberedOpen`, `chartsOpen`, `journeyOpen`, or payout optimizer `prior.open` were true. User taps still open/close normally. Existing non-mobile saved state and simulation input settings remain intact.
- The earlier always-visible `Model assumptions & limits` section is a top-level collapsed details panel now; its original explanatory detail and footer remain inside it.
- On mobile, top-level section summaries have a one-line or naturally wrapped title with chevron, no repeated Show/hide or long subtitle. Sections with Run Simulation / Find Better Models / Calculate Investment place the action as a compact full-width second row, removing the old squeezed multiple-line side-by-side layout. Action button IDs and event handlers are unchanged.
- Section 3A is injected from `portfolio-payout-ui.js` and needs its own mobile style override and closed-on-mobile default. The injected script cache key is refreshed in `portfolio-simulator.html`.
- Scope limited to markup, responsive CSS and mobile open state. No changes to trading calculations, Firms data, history records, or user input values. JS syntax and section structure checked; live mobile browser verification remains unconfirmed.

## Reverse payout visual hierarchy redesign (Nov 6)
- Section 3A Calculate Investment results now display three visually separated regions: `01 · RESULT OVERVIEW`, `02 · SCENARIO OPTIONS`, `03 · REFERENCES`. Sort scenarios is placed inside region 02, immediately before the option cards.
- Scenario cards have an emphasized header band and stronger open-state border, with KPI chips remaining compact. Each opened card clearly contains `SCENARIO DETAILS`, numbered nested panels (1 Trading rules, 1A R3 route when applicable, 2 Assumptions, 3 Firms comparison, 4 Diagnostics, 5 detailed performance KPIs), plus trade path details.
- Diagnostics are collapsed by default to reduce vertical clutter. No data is removed; all explanations and KPIs remain available. Global status and main gap remain visible. CSS uses existing theme palette and low-saturation hierarchy, responsive on mobile.
- Implementation changes are renderer markup and scoped payout UI CSS only. Risk, returns, optimizer ranking, saved presets, cloud storage, and Firms transfer rules are unchanged. Markup smoke test confirmed ordered regions and balanced HTML details tags; JavaScript syntax passed. Live browser rendering not verified.

## Adaptive risk strategy implementation and regression (Nov 6)
- The earlier proposed adaptive logic was not in the engine. The current code now supports *three additional optimizer-only state-aware policies*: `target-now` (daily risk recalculated for the remaining phase target, capped by real headroom), `repair-r2` (R1 loss → R2; R2 loss → R3 to restore the R2 starting P&L; successful R3 repair returns to R2), and `buffered-target` (target-now with 70% of available headroom before the normal per-trade cap).
- Engine computes actual risk from remaining stage P&L, daily limit, overall loss floor, trade costs, reserve and per-tier cap, once per account/day in the optimizer. The existing saved fixed-risk policies remain unchanged. Stage completion resets repair state. The firm equity rule is approximated through the same pretrade realized-P&L headroom enforcement as the previous engine; intratrade equity excursions, spreads and broker margin are NOT modeled.
- Optimizer includes these three adaptive modes as distinct risk routes with independent validation and ensures they are present in the candidate shortlist (if simulated), not discarded by the initial fixed-risk shortlist. Their R1/R2/R3 table amounts represent *risk caps*, not executed amounts, and the trade-by-trade trace shows the actual selected risk. Unlike fixed modes, adaptive modes are not transferable to Firms, since its current saved profile cannot encode them correctly.
- Isolated deterministic FTMO 10k regression confirmed L-L-W-W sequence R1 333.34 loss, R2 444.45 loss, R3 148.15 win restoring R2 anchor, R2 444.45 win reaching +1000.01 by day 4; 10-trial Monte Carlo smoke tests for all three dynamic routes completed. Small optimizer integration test examined 62 combinations and retained repair-r2, target-now and buffered-target as displayed candidates. These are illustrative test fixtures, not user simulation results.
- The script asset query version was updated on `portfolio-simulator.html`; live Cloudflare deployment/browser verification not confirmed. Previous cloud history is untouched and a new Calculate Investment run is required.
- Performance comparisons should use the same trading-day horizon, win rate, RR, funded eligibility and account count; the current coarse and validation stages use the same deterministic seed strategy. Success is not proof of faster real payouts.

## Blocked R3 and duplicated-option UI correction (Nov 6)
- Connected cloud history confirmed the user's 12:49:24 UTC Calculate Investment run used the new algorithm (339 tested), but included duplicate identical headroom options and retained the original Phase 1 $333.34/$444.45/$449 blocked R3 as a sixth normal scenario.
- Optimizer display now deduplicates by all phase risk-tier amounts, tier RR, sequence mode and winning-day caps, not by candidate object identity or budget. Only routes passing the explicit 3-loss headroom check are presented as normal selectable/transferable options.
- The blocked original is shown in a separate collapsed **Excluded reference · blocked R3** explanation, with Phase 1 numbers, not as a normal option or exportable risk recommendation. It is still included in tested combinations for comparison, not removed from source calculations.
- The first normal option remains the best ranked executable distinct setup; 5 options is an upper bound. Other sort choices reorder only these valid options.
- A fresh Calculate Investment run is needed to see the corrected cards; prior Section 8 history is unchanged. JavaScript syntax verified; live browser deployment not verified.

## Corrected latest-run R3 sizing and ranking (Nov 6)
- User's actual latest connected Dori Calculate Investment run at 2026-11-06 12:38:39 UTC evaluated 286 scenarios, but the first two options were still legacy target-sized Phase 1 risks R1 333.34 / R2 444.45 / R3 449, with an R3 blocked after two losses. The new headroom/defensive/balanced options existed but earned lower Monte Carlo net and were ranked later. This was a selection problem, not proof that alternatives were absent.
- Added **ladder** R3 mode: start with allowed safe R3 capacity (respecting margin reserve, daily and overall losses), then size R1/R2 together to permit the L-L-W outcome to reach each phase's trading profit target when mathematically feasible; scale varies the earlier risk budget. Example FTMO 10K, 3R, reserve $50, zero costs, Phase 1 target $1,000 yields R1 $173.50 / R2 $173.50 / R3 $449, and L-L-W = +$1,000.
- The optimizer now prioritizes two-loss-path-executable tier setups ahead of blocked ones during coarse shortlist and validation ranking. It reports modeled target feasibility and fastest eligible payouts only for executable ranked candidates. A legacy blocked comparison remains visible and is labeled **R3 blocked after LL**; user-selected alternative KPI sorting can still show it first with warning.
- A candidate's executable test checks configured three tier losses plus three trade costs and reserve against overall headroom and individual tier costs plus reserve against the daily limit, ignoring Topstep's R1-only evaluation stage. This is an initial L-L route check, NOT comprehensive intratrade or all-history safety certification.
- Search includes five policies: legacy, headroom, balanced, defensive, ladder. The displayed validated shortlist includes route representatives but is not every tested combination. R3 descriptions and summary identify the route.
- Fixed the earlier headroom calculation to reserve **three** trading costs across L-L and the next R3 potential loss, and use actual modified R1 in downstream sizing, not the pre-ladder initial risk. FTMO and Topstep isolated size/syntax checks passed. A full live deployment, cloud writeback, and full Monte Carlo regression were not verified.
- No saved account Firms risk profile, official firm loss limits, or trade execution is changed by rerunning the optimizer.

## R3 recovery-route alternatives (Nov 6 update)
- The Reverse Engineer Payouts search now tests four R3 policies for target-sized risk: `legacy` (previous sizing), `headroom` (cap configured R3 at static idealized two-loss remaining overall/daily headroom), `balanced` (reduce R2 to 65% of its previous level then cap R3 to remaining headroom), and `defensive` (half of remaining headroom).
- R3 analysis per phase shows configured R1/R2/R3, idealized available R3 after two consecutive losing trades, whether that proposed R3 fits, and stage P&L following R1-loss/R2-loss/R3-win. Each option remains a Monte Carlo hypothesis, not proof of recovery; minimum-day requirements and the engine's real-time headroom checks still apply.
- The shortlist includes route representatives alongside the optimizer's highest-ranked candidates, so visible scenarios may not be the literal top five by one scalar metric; preserve optimizer order among the selected display set and allow user sorting of displayed options.
- Search work increases with added routes. Save `r3Route` in new Calculate Investment history entries, with old records remaining readable. No change to engine drawdown enforcement, saved Firms settings or order execution.
- If R3 fits after two losses but fails to recover phase profit target, this should be presented as a continuation possibility, never as full loss recovery. If it is blocked after a different actual trade history, the engine still blocks it.

## Review or adopt a Calculate Investment scenario (Nov 6 update)
- Each expanded validated scenario now contains independent collapsed **Trading rules & risks** and **Account & simulation assumptions** panels. Phase review shows R1/R2/R3 USD risk, RR per tier, phase profit targets, risk sequence, max winning trades/day and minimum days, with a changed/same comparison against an existing saved Firms account profile. An additional collapsed before/after comparison lists only changed risk settings.
- The scenario has an explicit **Send this risk setup to Firms** action. It uses the pre-existing confirmed `sendPlanToFirms` + `StudioFirmsTransfer` workflow, including per-user account match verification, local backup and Restore previous support. Opening/reviewing a scenario never changes Firms.
- Prevent transfer where per-tier RR differs from the RR value that the existing Firms transfer can preserve; otherwise an import would silently change the tested risk configuration. Missing saved Firms profiles must first be created in Firms.
- A transfer copies trade risk sizing/sequence/win caps/reserve only. Account fees, loss limits, mandatory minimum days, payout terms, search budget, horizon, target net P&L and assumptions are not default Firms configuration and are deliberately not imported.
- No extra simulation run is required to inspect the scenario: shortlisted models have already undergone separate validation trials. Recalculate only after changing assumptions. Tested performance remains hypothetical.

## Sortable validated payout scenarios (Nov 6 update)
- Reverse Engineer Payouts has a **Sort scenarios by** selector above the collapsed scenario cards, defaulting to **Optimizer ranking**. User's selection is saved with per-user payout optimizer preferences.
- Available display sorting: highest average net P&L, investment ROI, fee ROI, goal probability, average first payouts; lowest starting investment; earliest conditional first payout day. Null first-payout days sort last. Ties preserve optimizer order.
- This is a display-only sort of the **five validated candidates already retained by the optimizer**, NOT of all coarse combinations explored (e.g. 131). It does not rerun or modify simulations, Firms risks, scenario results, original result identities, history records, or the saved search selection.
- Original optimizer ranking prioritizes feasibility, payout count and net target attainment, then payout timing and ROI; it does **not** always maximize net P&L. Label the first displayed option **Top by [selected sort]** rather than imply it maximizes every KPI.
- Account trade-by-trade select events must use original candidate indices after sorting; preserve this mapping when changing render behavior.

## Compact scenario cards (Nov 6 update)
- Each Calculate Investment tested scenario is rendered as a nested `<details class="reverse-candidate">` **closed by default**. The summary always shows: average net P&L (USD), net ROI on starting investment, ROI on incurred fees, tested investment, mean first payouts, and probability of meeting the net goal (plus a target-status label).
- Expanding a scenario reveals its additional KPIs, target checks, phase risk table, and separately collapsed trade-by-trade example and risk explanation.
- Keep the header compact, responsive, and visible while collapsed. Do not make it a tall statistics card or remove essential KPIs. These are Monte Carlo averages, not guaranteed outcomes.

## Fastest-payout and target-based risk optimization (Nov 6 update)
- Reverse payout optimizer now tries two risk sizing styles: saved-tier scaling and **target-sized** risk. Target sizing computes R1 from the phase profit target / R1 RR, bounded by modeled daily and overall loss headroom. Scale is capped at 1 for the first risk to avoid deliberate first-win overshoot.
- After an R1 loss, `streak` risk policy selects R2 on a later trading day; its risk target is calculated to cover the first loss and complete the phase profit target on a win, but is capped by remaining overall/daily drawdown. This is a strategy hypothesis, not guaranteed loss recovery. R3 is separate.
- Example FTMO $10k Phase 1 $1k target, 3R, zero cost: R1 about $333.34; after one loss R2 about $444.45, producing net cumulative ~+$1k if R2 wins. Min 4 trading days can still delay phase advancement.
- Engine now supports optional per-tier RR and reports Monte Carlo conditional mean day of **first paid payout**, mean day of **full payout-count/cash goal** in trials that achieved it, and their occurrence rates. These measures include the modeled phase min-days, funded wait, and payment-processing assumptions.
- UI shows compact fastest-payout KPIs and a collapsed sizing explanation; detailed actual simulated account trade paths remain collapsed. A faster result based on rare wins is not preferred for the first-payout KPI without at least 50% modeled chance of receiving some payout. Treat KPI days as conditional, not forecasts.
- Optimizer's phase table now includes the profit target, R1/R2/R3, and tier RR. First payout speed does not override firm drawdown/risk-blocking rules. Results are still finite-grid Monte Carlo estimates, not a guarantee or global optimum.
- History stores the selected sizing mode and payout timing.

## Simulation History pagination (Nov 6 update)
- Section 8 now paginates local/merged cloud history in newest-first order, with 5/10/15 rows per page, current range and page selector, Previous/Next buttons. Default page size 5 is stored per user in localStorage under the history key with suffix `:view`.
- Both **Run Simulation** and **Calculate Investment** share this view. New saves return to page 1, and cloud merges clamp the current page to valid bounds.
- Row Export buttons continue to use absolute indices in the full sorted run array, not page-local indices; **Export all** still exports the complete locally retained history.
- Existing storage cap remains 15 local runs / up to 8 cloud runs. Pagination changes presentation only, not data retention or cloud sync semantics.

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
