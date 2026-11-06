# JJ Academy — Google Apps Script question sync (recommended)

This is the simplified **Trading Studio–style** solution for the JJ Simon Study Academy. It does not require Cloudflare D1, a new OpenAI Platform API key, or a second ChatGPT automation. **The existing hourly "JJ Simon Advanced Course Research" automation has been updated** to check a private Google Sheet for unanswered questions.

## How to activate (owner action, once)

1. Open [Google Apps Script](https://script.google.com/home/projects/create) while signed into the Google account whose Drive is connected to the JJ research automation.
2. Create a *new* Apps Script project, named `JJ Academy Questions`. **Do not edit or redeploy Trading Studio's Apps Script project.**
3. Open `jj-simon/google-apps-script/Code.gs` in this GitHub branch. Copy its complete content into the new Apps Script project's `Code.gs`, replacing its sample function. Save.
4. In Apps Script's function selector, choose `setupJjAcademy`, click **Run** once, approve the Google authorization prompts. The function creates a spreadsheet named exactly **JJ Academy — Private Unanswered Questions** in the script owner's Drive. The spreadsheet has a private tab `Unanswered Questions` and stays unshared. Confirm the sheet exists and the first row contains the headers.
5. Apps Script **Deploy → New deployment → Select type: Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy and copy the URL ending in `/exec`.
6. In GitHub repository `dorjandg/trading-roi-studio`, branch `jj-simon-knowledge-hub`, edit `jj-simon/question-cloud-config.js` and put the new URL between the quotes:
   ```js
   window.JJ_ACADEMY_QUESTIONS_ENDPOINT='https://script.google.com/macros/s/YOUR_NEW_DEPLOYMENT_ID/exec';
   ```
   Commit that one-line change. Do not use the existing `FOUR_DS_CLOUD_ENDPOINT` from Trading Studio.
7. Make sure the Academy site's Cloudflare deployment includes the updated `jj-simon` branch; use the same website: `https://jj-simon-knowledge.pages.dev/?topic=academy-study-assistant`.
8. Open **Study Assistant**, check **Allow unanswered questions to be sent to the private review queue**, and ask an intentionally unsupported, non-sensitive test question. The queue first says **Saved locally**, then should say **Google Drive verified** after the signed, read-back-verified Apps Script write. If not, click **Sync unanswered questions**. Confirm the same question appears as a row in the private Google Sheet.
9. The existing JJ hourly ChatGPT automation searches this exact sheet on subsequent runs and processes up to five `new` questions, writing research notes, proposed answers, evidence IDs, and marking them `needs_review`. It does not mark them resolved without approval. The automation also continues its normal course-transcript research when the sheet is absent or empty.

## Data and permissions

- The web app POST endpoint is publicly reachable, but it **only appends** unanswered questions; it does **not** publicly expose the private Sheet or its questions.
- The public GET endpoint only verifies whether a random per-submission receipt was accepted and returns an opaque question ID. It does not list or disclose stored questions.
- A student must explicitly opt in before the browser syncs questions. Search itself remains browser-local.
- The Apps Script uses total-submission caps (15/minute, 300/day) and short-lived receipt tracking. This is **best-effort rate limiting**, not equivalent to authentication, CAPTCHA, or a dedicated server-side WAF. Monitor the sheet for abuse; consider restricting participation to trusted students, adding a CAPTCHA gateway, or migrating to a protected endpoint if publicly exposed to many unknown users.
- Never submit passwords, API keys, personal account details, or other sensitive information as course questions. Keep the spreadsheet private.
- Google Apps Script deployment uses the script owner's authority to write to the sheet. Do not share the editable script with students.
- To keep the Google Sheet in the right Drive, the script owner should be the same Google identity that is connected to ChatGPT for JJ course research. Access through another Google account cannot be assumed.

## Sync behavior and failure handling

The browser uses the same robust pattern as Trading Studio: store locally → send form POST in `no-cors` mode → perform a separate JSONP receipt check → mark **Google Drive verified** only after the receipt read-back succeeds.

If the endpoint is blank, unreachable or the receipt check fails, the question remains saved locally and is shown as unverified. Repeated submissions of the same normalized question are deduplicated in the private Sheet. The same browser keeps a record until explicitly marked resolved locally.

## Important distinction

There is **no OpenAI API call from the website**. The existing ChatGPT JJ research automation investigates the private Google Sheet through the connected Drive account. Its source-grounded research may update the Knowledge Library and Academy code where appropriate, but no answer should be published without checking course evidence, privacy, and contradictions. No new background agent or paid API subscription has been created.

## Older prototype (inactive)

The earlier Cloudflare D1/Actions code under `jj-simon/cloudflare`, `jj-simon/functions`, and `jj-simon/automation` is not the selected solution and is not wired to the Academy's question-submission UI. Its scheduled GitHub Actions workflows have been retired to avoid duplicate running costs and confusion. Do not configure those legacy credentials for this Google Sheets approach.
