# Portfolio simulation runner (read-only)

This is an offline test harness for `portfolio-engine.js`. It never connects to brokerage accounts, writes to Trading Studio cloud storage, or edits user strategies.

## Automated tests
GitHub Actions workflow `Portfolio engine regression` runs on engine/test changes and can be started manually using **Actions → Portfolio engine regression → Run workflow**. It executes:
- `node tests/portfolio-engine.test.cjs`
- `node tests/run-portfolio-simulation.cjs --fixture --assert-payout --output portfolio-test-report.json`

The workflow uploads a JSON report artifact. This is a **synthetic fixture**, not the user's private simulation.

## Authorized offline input
To reproduce a specific saved configuration, prepare a private JSON file with:
```json
{
  "schema": "4ds-offline-simulation-v1",
  "label": "Private authorized test",
  "plan": {"id": "topstep", "stageList": ["p1", "funded"], "riskProfiles": {"funded": {}}},
  "config": {"count": 5, "days": 90, "tradesPerDay": 7, "trials": 300, "seed": 24717}
}
```
The plan must be a **complete normalized engine plan** (the example above only shows the envelope). All needed fee, risk, loss, and payout fields must be supplied. Use:
`node tests/run-portfolio-simulation.cjs --input /private/path/plan.json --output /private/path/result.json`

Do not commit personal saved configurations or raw cloud profiles to the public repository. Cloud data is not automatically available to GitHub Actions. An authorized private configuration transport is a separate task. Do not claim a fixture run proves the user's latest live run.

## Interpreting output
`averages` includes funded, targetHit, payoutRequested, paid, receipts, spent, net, strategyStopped and exhausted. `firstTrial` contains counts and bounded payout-related traces. The harness runs the actual `oneTrial` engine, not a replacement mathematical model.

A GitHub commit is not proof of a passing workflow or a deployed Cloudflare site; inspect the Actions run and deployed site separately.

## Export exact inputs from the website
After **Run Simulation**, select **Export test input** in Section 2. This downloads `4ds-private-simulation-input.json` containing all currently reported firms as a `4ds-offline-simulation-bundle-v1` envelope. The export is local to the browser and never uploaded to GitHub. Each plan contains the normalized engine configuration; `__INFINITY__` represents an unbounded numeric limit.

Run privately: `node tests/run-portfolio-simulation.cjs --input /private/4ds-private-simulation-input.json --output /private/result.json`.

**Privacy limitation:** GitHub Actions uses only synthetic fixtures. It cannot access private browser data or Google Drive profiles automatically. An actual private run requires supplying the exported file to an authorized execution environment. Do not commit it to GitHub. Reports are reproducible only if the same engine revision and input snapshot are used.

## Connected-assistant independent execution (verified 2026-11-08)

An authorized assistant with connected GitHub and Google Drive tools can fetch the current `portfolio-engine.js` source and the private 4Ds profile, evaluate the engine in its isolated JavaScript tool runtime, and call `StudioPortfolioEngine.simulatePortfolio(plan,config)` directly. **No browser action, public API, GitHub Actions secret, or cloud mutation is needed.** The private profile is read-only; never publish its raw JSON, settings, or account data.

The history record `4ds:v1:<user>:portfolio-simulation-history:v1` contains `inputs`, `firms[].risk`, `firms[].caps`, and `firms[].budget`, but does **not** preserve all original normalized plan fields. Reconstructing plans from history is a **historical approximation**, not a bit-for-bit reproduction. For exact reproduction use the browser's private normalized plan export or an explicitly authorized source of all normalized plan fields. Never call an approximate run exact.

Verified example: 300-trial reconstructed Topstep run from the November 8 saved history using the current engine: mean funded 39.4467, target hit 13.64, payout requested 13.64, paid 12.35, receipts $24,700. A sample account requested on day 6 and was marked paid on day 16. These are **synthetic model outputs**, not actual firm payments or a fresh website run. The historical source run was from 2026-11-08T13:49:29.936Z. Do not copy these figures as current results after later updates.

For every independent run report the engine revision, source timestamp, trial count, plan reconstruction assumptions, and whether target/request/paid invariants passed. A run in an assistant's isolated tool runtime does not automatically publish to the website or GitHub Actions.
