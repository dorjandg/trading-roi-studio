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
