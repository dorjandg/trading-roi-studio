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

## JJ Academy calculator navigation regression rule (2026-11-09)
- Chapters 08, 09 and 10 are permanent: `calc-prop-vs-live`, `calc-risk-scenarios`, `calc-math-bankroll`. Never remove or rename their slugs.
- Maintain their membership and order in `jj-simon/academy-organization.js` under `Calculators & Simulations`. Registration in calculator scripts alone is insufficient.
- Keep the early registration in `jj-simon/index.html` and the end-of-page `jj-calculator-navigation-guard` invariant/recovery check.
- Before every JJ Academy deployment or index/navigation edit, verify the three slugs are present in curriculum, chapters, desktop navigation and mobile picker. Syntax-check edited JavaScript and verify `index.html` script URLs exist.
- Never report a GitHub commit as proof that Cloudflare Pages deployed successfully; verify the live site independently when available.
