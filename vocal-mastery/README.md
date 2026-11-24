# Vocal Mastery

Professional bilingual vocal academy website for Landi Kademi.

Public website: https://vocalmastery.net

Private Website Studio: https://vocalmastery.net/manage

## Editing the website

Sign in to Website Studio using an authorized email. Describe a change in English or Albanian, prepare a private preview, review the pages, and select **Publish changes**. The live website does not change until publication is confirmed. History can restore an earlier content revision. Uploads accept JPG, PNG, or WebP; videos use a verified YouTube ID. The source code remains in GitHub; approved content revisions are stored separately in the site's own Cloudflare D1 database.

## Development and deployment

Node.js 22 or later; no npm dependencies are required.

```
npm run build
npm test
npm run dev
```

The canonical deployment source is repository `dorjandg/trading-roi-studio`, branch `vocal-mastery`, directory `/vocal-mastery`. Production code is deployed from that isolated branch and project directory through Cloudflare Workers Builds. The repository’s `main` and `personal-hub` branches are separate and are not changed by this website’s publishing workflow. Build: `npm run build && npm test`. Deploy: `npm run deploy`. The dedicated Cloudflare build token is supplied by the build environment; it is never committed. `scripts/deploy.mjs` uploads static assets using Cloudflare's documented direct-upload API, then deploys ES modules with the configuration in `deployment.json`.

The initial deployment can also be made through the authenticated Cloudflare connector using the same multipart upload and metadata. Domains and access policies are separate infrastructure and are preserved on subsequent deployments.

## Runtime

- Worker routes server-rendered English and Albanian pages.
- `ASSETS` serves optimized images, styles and browser JavaScript.
- `AI` powers public enquiries and private content drafting.
- `DB` stores published content, drafts, version history and request limits.
- `MEDIA` stores images uploaded by authorized editors.
- Cloudflare Access protects `/manage`, `/manage/*`, and `/api/manage/*`. The Worker additionally validates signed Access JWTs against the configured audience, issuer and allowed owner emails.
- Visitor AI cannot edit content or access private drafts.
- Applications prepare a WhatsApp message; the visitor reviews and sends it. There is no misleading form submission or automatic booking.

See `docs/manage.md` for operation details and `docs/research.md` for biography/media sources. No student testimonials, fees, address or appointment availability are invented. The portrait is an approved AI artwork.
