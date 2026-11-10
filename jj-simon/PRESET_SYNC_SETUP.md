# JJ Simon preset sync setup

The risk calculator now supports opt-in cloud preset sync. Existing browser presets remain available offline.

Cloudflare Pages project: jj-simon-knowledge. Configure a KV namespace binding named exactly `PRESET_KV` for both Production and Preview (or the relevant environments), then redeploy the site. The Pages build output must be the `jj-simon` directory so `jj-simon/functions/api/presets.js` is deployed as the `/api/presets` endpoint.

On the calculator select **Sync**, enter the same private random key (24–128 characters, letters, numbers, hyphen or underscore) on each device, and save a preset to upload it. Other devices retrieve it when the page opens. Do not share the key: anyone possessing it can read and replace the associated presets. A password manager is recommended.

Note: Cloudflare KV is eventually consistent; changes can take time to appear on other devices. This is not multi-user transactional sync. Keep local backups. The endpoint returns HTTP 503 until the KV binding is configured. No browser preset is deleted if the endpoint is unavailable.
