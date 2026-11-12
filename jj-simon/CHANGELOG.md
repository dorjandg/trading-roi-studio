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
