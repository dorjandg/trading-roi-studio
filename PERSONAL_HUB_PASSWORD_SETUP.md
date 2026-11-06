# Password protection — safe activation checklist

The protected version is staged on branch `personal-hub-password-protection`, **not** the live production branch `personal-hub`.

## Security architecture

- Cloudflare Pages Functions middleware in repo root: `functions/_middleware.js`.
- Every route and static asset is checked through `personal-hub/_routes.json`.
- Password is saved only as **encrypted Cloudflare Pages secret** `HUB_PASSWORD`; it must **never** be placed in GitHub or the chatbot conversation.
- An authenticated browser receives a signed, HTTP-only, Secure, SameSite=Lax cookie (expires after 7 days).
- Logout button in header clears the session on that browser.
- Missing password secret = a **503 setup screen**, not an unprotected site.
- It protects both `hub.immamarketing.com` and `personal-hub-4ds.pages.dev` after the deployment.
- Password authentication takes place over HTTPS. Use a unique, long password (16+ characters).
- Enable Cloudflare Pages **Settings → Runtime → Fail open / closed → Fail closed** so static assets never bypass authentication if Pages Functions' free-tier limit is exceeded.

## How to activate, in order

1. In Cloudflare Dashboard → Workers & Pages → **personal-hub-4ds** → **Settings** → **Variables and Secrets** → **Add**.
2. Set variable name exactly `HUB_PASSWORD`.
3. Choose a strong password that has **not** been used elsewhere. Enter it into the Cloudflare secret field, **not chat/GitHub**.
4. Select **Encrypt** to store as a secret and **Save** for **Production**. Also set the Preview environment secret if preview deployments should be usable.
5. After this is saved, merge this feature branch into `personal-hub` (the production branch). That triggers a Cloudflare deployment including the protection middleware.
6. Once that deployment completes, open both the custom URL and `*.pages.dev` URL in a private/incognito tab. Both should show the password prompt before any link content or static asset is served.
7. Enter your password to unlock; use the header lock button to log out.

To change the password, update the Cloudflare `HUB_PASSWORD` secret and redeploy. Existing signed sessions will cease working.

## Security and privacy limitations

**IMPORTANT**: The repository `dorjandg/trading-roi-studio` is currently public. Protecting the Cloudflare website does **not** make the underlying GitHub source files or link descriptions private. Private URLs/titles should not be stored in `personal-hub/links.js` until that content has been moved to a genuinely private repository or private data store.

Password sharing grants the same access to everyone who knows it, with no individual audit or easy per-person revoke. For personal data, prefer Cloudflare Access with per-user identity login.

The authentication function handles all routes. Keep `_routes.json` set to `include: ["/*"]` and `exclude: []`. Excluding public assets can expose their contents.

Make sure the production branch, Cloudflare deployment settings and runtime secrets are all configured before assuming the website is private.
