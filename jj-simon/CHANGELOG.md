# JJ Simon Calculator — Change Register

Permanent audit log for the calculator in `jj-simon/calculator-hub.js` on branch `jj-simon-knowledge-hub`.

## Rules for future changes
- Assign a sequential FIX ID; never reuse an ID.
- Record date, user discussion/request, observed problem, intended target, exact formula or code change, assumptions, tests, limitations, and Git commit SHA.
- Preserve named presets and parameter values unless the user explicitly requests changes.
- Explain expected effect on results; distinguish verified behavior from unverified deployment.
- To revert, use the GitHub commit before the relevant fix; don't delete the historical entry.
- Use actual *spent* evaluation/activation costs for ROI: (payout cash − spending) / spending × 100.
- Maintain a clear separation of completed, failed, and unresolved paths; probabilities must not silently classify unresolved as failed.

## Baseline — T1 WR20 (2026-11-12)
User supplied Chapter 09 JSON preset `t1 wr20`. P1/P2 manual risks 500,700,800,100; RR 3,2.9,3.4,(default). P3 manual risks 700,800,500,100; RR 5,5.25,6,(default). Evaluation target 3000; $2000 trailing drawdown; consistency enabled at 50%; depth 12; MGC stop $5; evaluation fee $50. Funded target $3500; funded drawdown $2000; activation fee $150; split 75%; payout goal 5. WR initially 20% for evaluation and funded. User explicitly forbids changing R1/R2/R3 or other preset parameters when comparing win rates.

## FIX-001 — 2026-11-12 — Financial ROI evaluation probability
- **Discussion:** User questioned dramatically different 20% WR ROI estimates; chose path-based modeling instead of simplified 3-attempt probability.
- **Problem:** `probability` was `threeAttemptPass * threeAttemptPass` for Topstep, even though the code enumerated carried-state evaluation paths.
- **Target:** Align financial purchase and ROI math with actual evaluation outcomes.
- **Change:** Set `probability=actualEvaluationProbability` for all firms.
- **Reason:** Independent checkpoint assumption ignores carried drawdown, contract sizing, stage transitions and consistency.
- **Impact:** May lower modeled Topstep ROI; no strategy/preset values modified.
- **Commit:** `18fbf16a7f5949d4ed1999db733c54e9fa7e98d1`.
- **Limitations:** The 12-trade cap and unresolved probability require a separate audit. Cloudflare deployment not independently verified.

## FIX-002 — 2026-11-12 — Stage metrics and visible change history
- **Discussion:** User requested a recoverable, numbered explanation of every fix: problem, why, logic, target, what changed, and ability to return to an earlier version.
- **Problem:** Shared P1 and P2 metrics still used the simplified formula, potentially disagreeing with the financial ROI engine. No in-site fix history.
- **Target:** Make P1 × conditional P2 equal the actual enumerated evaluation success rate, and add a navigable Calculator Fix History chapter.
- **Change:** P1 = enumerated checkpoint pass probability; P2 = completed evaluation probability / P1 (zero when P1 is zero). Added FIX-001/FIX-002 and baseline explanations to calculator navigation.
- **Reason:** Consistency between displayed funnel metrics and ROI; auditable decision history.
- **Impact:** Stage rates may differ from old simplified values. No T1 or other saved preset changed.
- **Commit:** `b6a1ec6a165eea78af6adfd6481bf17425b0d6d0`.
- **Tests:** JS syntax checked with `new Function`. Browser integration, live deployment and full simulation audit **not yet verified**.
- **Open issues:** Verify full probability mass, censored/unresolved outcomes, 50% consistency with carried EOD trailing drawdown, funded reset behavior, and financial presentation; ensure cloud preset API remains intact.

## Existing history
GitHub commit history on `jj-simon-knowledge-hub` contains earlier edits. This register begins at FIX-001; prior commits are not retroactively assigned invented fix numbers.

## FIX-003 — 2026-11-12 — Unify Section 07 funnel
- **Discussion:** User showed screenshot: 26.86 funded and 16.09 P4 target successes in table, but 8.34 funded and 5.00 payout successes in top summary; requested fix.
- **Problem:** Section 07 still used simplified three-attempt rates (65.7% in screenshot) despite financial cohort using actual evaluation paths (13.4% combined in screenshot).
- **Target:** One consistent path-based cohort across funded counts, payout-target counts, spending, and ROI.
- **Change:** P1 pass now uses enumerated first-checkpoint pass probability; conditional P2 = actual complete evaluation pass probability / P1. Removed old text claiming simplified probabilities drive financial results. Added runtime reconciliation warning for P3/P4 against financial cohort.
- **Reason:** P1 purchases × P1 pass × conditional P2 = expected funded accounts, which × funded target success = expected P4 target successes.
- **Protected:** T1 preset and risk parameters untouched; simplified benchmark remains only for comparison.
- **Commit:** `0e0e063872743c717e2cbf0a9d2c4a89b67960cd`.
- **Verification:** JavaScript syntax validated. Live Cloudflare deployment and full probability-mass / unresolved-path audit not yet verified. This is a modeled payout-target count, not proof of withdrawal or received payout.

## FIX-004 — 2026-11-12 — P2 discrepancy audit
- **Discussion:** User expects P1 and P2 rates to be similar and questioned 60.7% vs 22.1%; requested investigation rather than an assumption.
- **Problem:** A single P2 pass rate hid how many paths breached drawdown, remained unfinished, or encountered 50% consistency.
- **Target:** Show auditable probabilities for P1 reached, P2 completed, P2 closed, P2 unresolved/blocked, and paths encountering consistency.
- **Change:** Added a visible FIX-004 diagnostic breakdown in Section 07, derived from the same enumerated path leaves. Consistency-touched overlaps other categories and is explicitly labeled non-additive.
- **Reason:** Distinguish genuine carried-state differences from simulation implementation errors before changing probability formulas.
- **Commit:** `581dfe50371f1851b49c54fece7d4c5870d67ed7`.
- **Protected:** T1 preset, risk sequence, win rate, and ROI formula unchanged.
- **Validation:** JavaScript syntax checked; live deployment, exact numerical probability-mass audit, and independent rule validation are pending. The diagnostic is not proof the engine is correct.

## FIX-005 — 2026-11-12 — Consistency repair-day limitation (warning, not full engine repair)
- **Discussion:** User rejected a 60.7% P1 versus 22.1% P2 gap and requested a proper audit.
- **Finding:** With a 50% best-day consistency limit, exactly two profitable trading days must have equal profit. T1 checkpoint winners can earn $1500, $1520 or $1530, so mismatched profits may require an additional day to satisfy consistency. The current evaluation engine uses two checkpoint days and has no third-day continuation.
- **Problem:** Model can understate eventual evaluation completion, making P2 and ROI provisional. Carrying the EOD trailing drawdown is still necessary.
- **Change:** Added explicit FIX-005 limitation warning in the calculator's funnel diagnostics and history. No forced equality or fabricated corrected percentage.
- **Target for next implementation:** Support extra consistency-repair days, carry EOD drawdown correctly, enforce per-day limits, separate failed/unresolved paths, and regression-test probabilities and ROI against independent enumeration.
- **Protected:** User's T1 preset and financial formulas unchanged.
- **Commit:** `2ad84702e1e74676be47591f67c80e298da959e2`.
- **Verification:** JS syntax checked; full engine fix and live deployment not yet verified.

## FIX-006 — 2026-11-12 — Two equal $1,500 strategy targets
- **Discussion:** User clarified that the $3,000 evaluation target is split into two $1,500 winning trading-day targets, with the same risk sequence each day. No variable catch-up target is intended.
- **Problem:** Previous second-day required-profit logic used max($3000, first-day profit / consistency ratio) minus current total, silently making the second-day strategy target different.
- **Change:** Both checkpoint days use `checkpointTarget-stagePnl`; second-day winning paths stop when daily P&L reaches $1,500. Only mark account as fully passed if total ≥$3,000 and 50% best-day consistency is met; otherwise classify as `daily-blocked` (unresolved, not a pass or loss). Updated the next-trade stop test similarly.
- **Reason:** Preserve the user's daily strategy without claiming that an overshoot automatically satisfies Topstep's consistency requirement.
- **Target:** Equal strategy targets, with explicit separation of daily target and actual evaluation qualification.
- **Protected:** Original T1 risk/RR/stop/fee/win-rate inputs unchanged.
- **Commit:** `7eae6d857f79b59231b98c23c751609b9582c986`.
- **Verification:** JS syntax passed; no independent browser or probability-mass validation yet. Extra consistency-repair days remain unsupported, so ROI and P2 conditional pass rate are provisional.

## FIX-007 — 2026-11-12 — Daily P2 target vs fully qualified evaluation
- **Discussion:** User correctly questioned P1 daily 57.8% vs P2 qualification 20.3%, given identical $1,500 day targets and risks.
- **Problem:** UI presented a daily target pass rate and a stricter full evaluation pass rate as comparable metrics, obscuring why they differed.
- **Change:** Added P2 $1,500 daily target probability conditional on P1, separate from P2 fully qualified probability and probability mass reaching P2 daily target without satisfying qualification. Existing funnel and ROI still use actual fully qualified evaluation probability.
- **Reason:** Do not mislabel a strategy checkpoint success as a funded account; preserve true broker constraints.
- **Commit:** `2a2e66fdbb70d4f7b4592bee37a70097a18fe092`.
- **Verification:** JavaScript syntax checked; numeric regression, live deployment and additional consistency-repair days still outstanding. T1 preset untouched.
