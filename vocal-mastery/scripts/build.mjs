import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/worker/', root), { recursive: true });
await mkdir(new URL('dist/public/', root), { recursive: true });
const source = new URL('src/', root);
for (const file of await readdir(source)) {
  if (file.endsWith('.js')) await cp(new URL(file, source), new URL(`dist/worker/${file}`, root));
}
const content = JSON.parse(await readFile(new URL('src/content.json', root), 'utf8'));
await writeFile(new URL('dist/worker/content.js', root), `export default ${JSON.stringify(content)};\n`);
await cp(new URL('public/', root), new URL('dist/public/', root), { recursive: true });
const manifest = {};
async function walk(dir, prefix = '') {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, e.name), relative = `${prefix}/${e.name}`;
    if (e.isDirectory()) await walk(path, relative);
    else {
      const data = await readFile(path);
      const hash = createHash('sha256').update(data.toString('base64') + extname(path).slice(1)).digest('hex').slice(0, 32);
      manifest[relative] = { hash, size: data.byteLength };
    }
  }
}
await walk(fileURLToPath(new URL('dist/public/', root)));
await writeFile(new URL('dist/manifest.json', root), JSON.stringify(manifest, null, 2));
console.log(`Built Vocal Mastery with ${Object.keys(manifest).length} static assets.`);
