// Authorized GitHub -> Cloudflare deployment. Credentials stay in runtime memory.
import { readFile, readdir } from 'node:fs/promises';
import { extname } from 'node:path';
const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('deployment.json', root), 'utf8'));
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error('Cloudflare build token is not available. Configure it in the Worker build settings.');
const base = `https://api.cloudflare.com/client/v4/accounts/${config.account_id}`;
async function request(path, method = 'GET', body, authorization = token) {
  const headers = { Authorization: `Bearer ${authorization}` };
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const response = await fetch(base + path, { method, headers, body });
  const json = await response.json();
  if (!response.ok || json.success === false) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(json.errors || [])}`);
  return json.result;
}
const manifest = JSON.parse(await readFile(new URL('dist/manifest.json', root), 'utf8'));
const session = await request(`/workers/scripts/${config.name}/assets-upload-session`, 'POST', { manifest });
const byHash = Object.fromEntries(Object.entries(manifest).map(([path, data]) => [data.hash, path]));
const mime = { '.css':'text/css', '.js':'application/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.ico':'image/x-icon', '.txt':'text/plain', '.xml':'application/xml', '.json':'application/json', '.woff2':'font/woff2' };
let completion = session.jwt;
for (const bucket of session.buckets || []) {
  const form = new FormData();
  for (const hash of bucket) {
    const path = byHash[hash];
    const bytes = await readFile(new URL(`dist/public${path}`, root));
    form.append(hash, new Blob([bytes.toString('base64')], { type: mime[extname(path)] || 'application/octet-stream' }), hash);
  }
  const uploaded = await request('/workers/assets/upload?base64=true', 'POST', form, session.jwt);
  if (uploaded?.jwt) completion = uploaded.jwt;
}
const metadata = {
  main_module: config.main_module,
  compatibility_date: config.compatibility_date,
  bindings: config.bindings,
  keep_bindings: ['secret_text'],
  assets: { jwt: completion, config: { html_handling: 'none', not_found_handling: 'none', run_worker_first: true } },
  observability: { enabled: true, head_sampling_rate: 0.1 }
};
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
for (const file of await readdir(new URL('dist/worker/', root))) {
  if (!file.endsWith('.js')) continue;
  form.append(file, new Blob([await readFile(new URL(`dist/worker/${file}`, root))], { type: 'application/javascript+module' }), file);
}
const result = await request(`/workers/scripts/${config.name}`, 'PUT', form);
console.log(JSON.stringify({ deployed: true, worker: config.name, version: result.version_id || result.id, url: 'https://vocalmastery.net' }));
