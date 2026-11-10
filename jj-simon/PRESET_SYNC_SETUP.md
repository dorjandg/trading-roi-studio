# JJ Simon Google preset sync — deployment requirements

The calculator now uses Google sign-in instead of private sync keys. The UI automatically shows the Google sign-in control once configured. Saved presets stay in localStorage if the cloud is not ready.

Required Cloudflare Pages project settings (Production, and Preview if needed):
1. Create a Cloudflare KV namespace and bind it as `PRESET_KV`.
2. Create a Google Cloud OAuth 2.0 **Web application** client, add `https://jj-simon-knowledge.pages.dev` to **Authorized JavaScript origins**, and configure the OAuth consent screen appropriately.
3. Add the public Google OAuth web **Client ID** as the Cloudflare Pages environment variable `GOOGLE_CLIENT_ID` (not a client secret).
4. Redeploy the Pages project. Confirm build output directory is `jj-simon` and Pages Functions in `jj-simon/functions` are included in deployment.
5. Verify `/api/preset-config` reports `storageReady:true` and a client ID, and `/api/presets` rejects unauthenticated requests with HTTP 401.
6. Sign in using the same Google account on each device; save a named preset and verify it appears on a second device after opening the page.

The API verifies Google ID tokens server-side against Google's tokeninfo endpoint and checks token audience, issuer, expiry, and subject. Presets are stored under Google subject, not email. Google client secrets must not be committed to GitHub. Cloudflare KV is eventually consistent; cross-device changes can take time to appear. The implementation does not yet provide robust simultaneous-edit conflict resolution.

**Status:** GitHub implementation prepared; live activation requires the Cloudflare binding and Google OAuth configuration. Do not claim production sync verified until a real cross-device test passes.
