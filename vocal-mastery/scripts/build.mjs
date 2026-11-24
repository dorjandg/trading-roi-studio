import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
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
// Keep the approved PNG originals; generate browser-sized WebP variants at build time.
// Bump the v1 suffix in this script and site.js if the underlying photos change.
const coachingWidths = [480, 768, 1152, 1440];
for (const n of ['01', '02', '03', '04', '05']) {
  const source = new URL(`public/assets/coaching-${n}.png`, root);
  const bytes = await readFile(source);
  for (const width of coachingWidths) {
    const target = new URL(`dist/public/assets/coaching-${n}-v1-${width}.webp`, root);
    const info = await sharp(bytes).resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 }).toFile(fileURLToPath(target));
    if (info.width !== width) throw new Error(`Unexpected coaching image width for ${n}: ${info.width}`);
    console.log(`Coaching ${n} ${width}w: ${Math.round(info.size / 1024)} KiB WebP (original ${Math.round(bytes.length / 1024)} KiB PNG)`);
  }
}
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
