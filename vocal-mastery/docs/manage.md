# Vocal Mastery private studio

The owner’s editing workspace is **https://vocalmastery.net/manage**.

The initial authorized owner is the connected account holder, `dorjan.gjoni.dg@gmail.com`. Cloudflare Access handles sign-in with the existing identity providers or email verification. To authorize Landi’s own email later, add that confirmed email to both this application’s Access allow policy and the Worker `OWNER_EMAILS` environment variable. Never share a password or put a secret in website code. Only verified owner identities can call the management API.

## How to use it

1. Open `/manage` and sign in.
2. Tell the editor what you want to change in English or Albanian. **Ask editor** discusses the change; it does not modify the website.
3. Choose **Create preview**. The AI prepares content updates in both languages. View every affected page and switch the preview language.
4. Choose **Publish changes** and confirm when you approve the preview. This is the only editing action that changes the public pages.
5. Use **Publication history** to restore an earlier revision. Restoration creates a new revision and retains the history.

To change a photograph, upload a JPG, PNG or WebP, then tell the editor where to use the returned image URL. Images up to 5 MB are supported. The uploaded image has an unlisted public asset URL; it appears on pages only after an approved publication. Upload only material intended for the public website.

Supported changes include published copy, English and Albanian translations, program descriptions, prices supplied by the owner, FAQ answers, biography text, image URLs, and official YouTube video IDs. Existing sections and program/media collections can be extended within their existing structure. The manager does not generate or execute website code or change layout. Design changes belong in the Git repository.

## Runtime contract

`src/api.js` exports:

- `SCHEMA_SQL`: the database migration string.
- `apiFetch(request, env, ctx, defaultContent)`: handles `/manage`, `/api/chat`, `/api/manage/*` and `/uploads/*`; returns `null` for unrelated paths.
- `loadContent(env, defaultContent)`: returns published structured content, falling back to the source document.
- `getPreviewContent(request, env, ctx, defaultContent)`: authorizes a `/manage/preview?draft=...` request and returns `{content, revision, draftId}`, or an error `Response`.
- `authenticatedOwner(request, env, ctx)`: independently verifies the Cloudflare Access JWT and owner allowlist.
- `applyContentEdits(original, edits)`: validates and applies a restricted JSON Patch document.

Always pass the original version-controlled `src/content.json` as `defaultContent`, not a previously loaded published document. Drafts pin a SHA-256 hash of that source document and the live revision. A code/content deployment or a competing publication makes older drafts stale.

The root Worker handles `/manage/preview` before rendering public pages. Pass its returned content to `renderPage()` with `options.preview=true`. Use `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `X-Frame-Options: SAMEORIGIN`, and a same-origin frame-ancestors policy. Public responses must not render drafts from URL parameters.

## Bindings and deployment configuration

| Binding | Type | Value / purpose |
| --- | --- | --- |
| `AI` | Workers AI | Genuine model inference; no browser API key |
| `DB` | D1 | Dedicated Vocal Mastery content, drafts, revisions and rate counters |
| `MEDIA` | Workers KV | Owner-uploaded raster image bytes |
| `ACCESS_TEAM_DOMAIN` | Plain text | `https://floral-river-0fbd.cloudflareaccess.com` |
| `ACCESS_AUD` | Plain text | Audience of the Vocal Mastery owner Access application |
| `OWNER_EMAILS` | Plain text | Comma-separated authorized owner emails |

Cloudflare Access must protect `/manage`, `/manage/*` and `/api/manage/*` on the canonical domain. Redirect `www.vocalmastery.net` to the canonical domain. Unprotected alternate Worker domains still fail the independent JWT signature, issuer, audience, expiry and email checks. Do not add bypass policies for management routes.

Initialize D1 once using the exact `SCHEMA_SQL` exported by `src/api.js`. The schema contains only academy-specific tables and never reads or changes other websites’ databases. The Worker needs a compatibility date at least as recent as its tested deployment, with logs and traces enabled.

## Visitor concierge

The public widget posts to `/api/chat` with:

```json
{"message":"How do I apply?","language":"en","history":[]}
```

It returns `{"reply":"...","language":"en"}`. Language accepts `en`, `sq` or `al`; the latter two request Albanian. History contains at most eight previous `{role,content}` messages. The model is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, grounded in published academy content. It has no editing tools. Unpublished drafts, owner emails, authentication claims and other private records are not placed in the visitor model context. Fees, timetables, availability and unsupported facts are referred to Landi’s WhatsApp instead of invented.

Conversation content is not stored by this application. The browser keeps the current conversation in memory. D1 stores only rate counters, using a daily hash of the Cloudflare client IP for visitor keys; expired counters are deleted. Owner changes and publication history are durable so the owner can recover work.

The service enforces 20 visitor questions per IP per hour and 300 visitor questions per day across the site. Owner editor requests have separate per-owner and daily caps (30/hour and 40/day). These conservative ceilings limit model usage. The model receives a maximum 600 output tokens for visitor replies and 4,800 for structured editing. If limits or model availability block a reply, the response says so and points visitors to WhatsApp; it never substitutes canned FAQ text while claiming it is AI.

## Security and publication behavior

- Owner authentication verifies an RS256 Access token against Cloudflare’s signing keys, expected issuer and audience, time bounds, and a separate email allowlist. Headers alone do not authorize requests.
- All mutations require an exact same-origin browser `Origin`; the API sends no cross-origin access headers.
- Public and owner input lengths, request bodies, conversation roles, patches and image formats are bounded and validated.
- AI drafts contain structured data only. The renderer escapes all values. Prototype pollution paths, schema changes, markup, unsafe URLs, non-raster uploads and invalid video IDs are rejected.
- A D1 transaction writes each publication and updates the current revision only if the draft’s base is still current. A stale draft cannot overwrite a newer publication.
- The browser renders AI responses and edit diffs with `textContent`, never arbitrary HTML.
- Source code and default content remain in GitHub. Runtime owner edits are durable D1 content revisions and take effect without rebuilding or uploading a ZIP. A future code deployment preserves those edits and adds missing default fields.

## Relevant Cloudflare documentation

- [Validate Access tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Workers AI model](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)
- [Workers AI JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)
- [D1 Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
