# Production architecture

The public bilingual website runs on the `vocal-mastery` Cloudflare Worker with its own Static Assets deployment. The canonical deployment source is GitHub repository `dorjandg/trading-roi-studio`, branch `vocal-mastery`, directory `/vocal-mastery`. This isolated branch holds the source and approved media without modifying the repository’s `main` or `personal-hub` branches. The standalone `dorjandg/vocal-mastery` repository retains the earlier source history. Cloudflare Workers Builds runs the repository build, security tests, and authenticated deployment script after source updates.

`src/content.json` supplies default content. Published edits overlay this data from the dedicated `vocal-mastery-content` D1 database. Source deployment never clears owner edits. A source hash pins every draft to the source version it was created against, and revision comparisons reject stale publication. The editor stores historical published content and can restore a selected version without erasing history.

The public `/api/chat` route has access only to the published content and bounded conversation context. It uses the Workers AI binding and cannot invoke editing actions. Server-side global and visitor quotas constrain inference requests.

Cloudflare Access protects the private editor and management API. The Worker independently verifies the Access JWT's RSA signature, issuer, audience, expiry, and authorized email. Server-side structured edit validation rejects executable markup, unsafe URLs, schema changes and prototype pollution. Mutations require same-origin requests and explicit publication confirmation.

Approved owner image uploads are checked by MIME and file signature and stored in a dedicated `vocal-mastery-media` KV namespace. All account credentials stay out of repository source and browser JavaScript. The build token is provided by Cloudflare's build environment.

The custom domains `vocalmastery.net` and `www.vocalmastery.net` point at the Worker; www redirects to the canonical apex. HTTPS, security headers, a sitemap, privacy notice, real contact links, legacy HTML redirects and a proper 404 are included.
