# JJ Academy unanswered-question review system

This feature has two levels, with different deployment requirements.

## Immediately available: browser queue
- Study Assistant saves exact questions with no source matches automatically in local browser storage (`jj-unanswered-questions-v1`).
- For results that appear irrelevant, a user can explicitly select **No — register for research**.
- Open questions can be retried, locally marked as resolved, copied, or exported to JSON.
- Deduplication uses normalized question text; it does not log all ordinary answered questions.
- Browser storage does **not** notify ChatGPT, other devices, or a website operator.

## Optional shared Cloudflare D1 queue
Deployment requirements:
1. Create a Cloudflare D1 database for this Academy, and execute `cloudflare/questions-schema.sql`.
2. Bind it to the Pages project as `JJ_QUESTIONS` under D1 bindings.
3. Set secure Cloudflare environment secrets `JJ_HASH_SECRET` (random high-entropy salt) and `JJ_REVIEW_TOKEN` (private admin bearer token). Never put either in browser JavaScript or GitHub.
4. Ensure the Cloudflare Pages root directory is configured so that `functions/api/questions.js` is recognized. Current source lives at `jj-simon/functions/api/questions.js` on the `jj-simon-knowledge-hub` branch. If the Cloudflare project builds from repository root with `jj-simon` as output directory rather than as root directory, move the `functions` folder to the repository root.
5. Deploy the function and verify with browser Developer Tools that `POST /api/questions` returns `201` after an unanswered question. In a browser without the backend the entry remains local and shows "shared submission unconfirmed".
6. In Cloudflare, protect `/api/questions` with WAF/bot controls appropriate to an anonymous public POST endpoint. A salted hourly rate limit is also implemented in D1; it is not a full CAPTCHA substitute.

Review API:
- `GET /api/questions`, `GET /api/questions?status=new`: admin Bearer `JJ_REVIEW_TOKEN`; list up to 200 records.
- `PATCH /api/questions`: admin Bearer token; `{"id":"uq_...","status":"researching|needs_review|approved|resolved|rejected","research_notes":"...","proposed_commit":"..."}`.
- The POST endpoint accepts only same-origin JSON (8–1000 character question), hashes a client IP with a private salt for throttling, and does not expose full queue contents without admin credentials.

## Future automated GPT research + code updates (not yet enabled)
The optional D1 queue is *only* persistent storage and an authenticated review workflow. It does not itself start a ChatGPT conversation, schedule a GPT job, open a pull request, or push code.

To enable full automatic work safely:
1. Connect a trusted scheduled worker/agent to the authenticated question queue. It should process only `new` entries and avoid repeated research of duplicate questions.
2. Retrieve authoritative **connected course transcripts** and timestamped evidence using properly scoped source access (Google Drive/API), separating original language from interpretation and current prop-firm policy.
3. Produce a proposed answer and evidence references, and flag unsupported claims or contradictions.
4. Create a GitHub **pull request**, not an uncontrolled direct commit to the production branch, with the new Q&A/lesson/dictionary content.
5. Run schema, reference-integrity, syntax and browser tests; only merge and deploy under an explicit approval rule.
6. Record proposed commit/PR in the queue, and mark resolved only after deployment and verification. Notify the owner when a new review item or approved PR appears.

Never send user-submitted question text to public GitHub issues or PRs without explicit consent. This repository is public. Avoid logging medical, personal, financial-account, authentication or other private details in public code.

The existing hourly JJ Simon research automation is separate and cannot observe browser localStorage. A direct ChatGPT alert requires a supported connected event source or a scheduled, authenticated bridge that can actually read the shared queue; this has **not yet been configured**.

## Automated research reviewer and approved-answer PRs (code implemented; activation pending)

**GitHub workflow entries are present on the default `main` branch**:
- `.github/workflows/jj-questions-review.yml` — runs at minute 17 every 3 hours (UTC), checks out `jj-simon-knowledge-hub`, tests evidence parsing, and processes at most three new questions if configured.
- `.github/workflows/jj-answers-propose.yml` — manually triggered only; creates an unmerged PR for separately approved, public-safe answer text.

**Required configuration in GitHub repository Settings → Secrets and variables → Actions**:
- Secret `JJ_QUESTIONS_ENDPOINT`: exact HTTPS URL of the deployed private queue endpoint, normally `https://jj-simon-knowledge.pages.dev/api/questions`.
- Secret `JJ_REVIEW_TOKEN`: must equal the Cloudflare Pages `JJ_REVIEW_TOKEN` secret.
- Secret `OPENAI_API_KEY`: an OpenAI Platform API key with a suitable usage budget. The current code selects `gpt-6-luna`; set the model in the workflow to an authorized model if needed.
- Variable `JJ_ENABLE_PUBLIC_PROPOSALS`: initially absent/false. Set to `true` only when the organization has a public-content privacy review policy and a trusted reviewer who explicitly approves public answers.

**Required Cloudflare configuration**:
- Create D1 database, run `cloudflare/questions-schema.sql`, bind `JJ_QUESTIONS`, set `JJ_HASH_SECRET` and `JJ_REVIEW_TOKEN` as server-side secrets, and verify Cloudflare Pages recognizes `jj-simon/functions/api/questions.js`. Do not assume the `functions` directory is picked up when the Pages root is the repository root.
- If the database was created with the prior schema, add its new review columns once:
  ```sql
  ALTER TABLE jj_unanswered_questions ADD COLUMN approved_public_title TEXT;
  ALTER TABLE jj_unanswered_questions ADD COLUMN approved_public_answer TEXT;
  ALTER TABLE jj_unanswered_questions ADD COLUMN approved_evidence_ids TEXT;
  ```
  Do not apply these ALTER statements when creating a fresh database from the updated schema.

**Privacy and consent**:
- A student must opt in to shared review submission via the Study Assistant checkbox. Without consent, questions are kept in that browser's local storage and cannot trigger the researcher.
- With consent and working Cloudflare D1, unanswered questions sync to a private queue. The GPT research reviewer sends that question and selected machine-transcript excerpts to the configured OpenAI API with `store:false`, then stores a source-linked draft privately as `needs_review`.
- Private question text and GPT draft notes must never be automatically copied into public GitHub PRs. The admin must explicitly set `approved` and supply separately curated `approved_public_title`, `approved_public_answer`, and `approved_evidence_ids` via authenticated PATCH.
- Only after that approval, an authorized admin can manually run the **JJ Academy propose approved answers** workflow. It writes `jj-simon/approved-answers.js` on a review branch and opens a PR targeting `jj-simon-knowledge-hub`; it never merges the PR automatically.
- Merging a reviewed PR updates the public site's source-answer catalog when the Pages site is deployed from the target branch. The Study Assistant prioritizes these reviewed answers.

**Pending work / not yet live**:
- D1 database, secret bindings, and deployment verification have **not** been performed. No end-to-end cloud submission or OpenAI request has been tested.
- No actual ChatGPT-native alert is wired to the private D1 queue. GitHub Actions notices are visible to repository administrators in GitHub Actions, but they are not ChatGPT app notifications. A ChatGPT automation or other event bridge is required for that part.
- Schedule execution is a GitHub Actions trigger, not a guarantee of exact execution time. No automatic PR merge or direct production edit is enabled.
- Current-source citations are machine transcripts; independent original video and chart verification remains pending.
