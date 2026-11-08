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
