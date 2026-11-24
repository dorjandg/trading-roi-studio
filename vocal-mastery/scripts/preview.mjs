import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(new URL('../', import.meta.url).pathname);
const mime = { '.css':'text/css', '.js':'application/javascript', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/__mobile') {
      res.setHeader('Content-Type','text/html;charset=utf-8');
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mobile layout review</title><style>body{margin:0;background:#242428;display:flex;justify-content:center;padding:12px}iframe{width:390px;height:844px;border:1px solid #555;border-radius:10px;background:#09090b}</style></head><body><iframe src="/?lang=sq" title="Mobile preview at 390 pixels"></iframe></body></html>');return;
    }
    if (url.pathname.startsWith('/assets/')) {
      const path = resolve(root, 'public', '.' + url.pathname);
      if (!path.startsWith(resolve(root, 'public') + '/')) { res.writeHead(403).end(); return; }
      res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)); return;
    }
    if (url.pathname.startsWith('/api/')) { res.writeHead(503, {'Content-Type':'application/json'});res.end(JSON.stringify({error:'AI is available on the published website.'}));return; }
    const content = JSON.parse(await readFile(resolve(root, 'src/content.json'), 'utf8'));
    const { renderPage } = await import(pathToFileURL(resolve(root,'src/site.js')).href + `?t=${Date.now()}`);
    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.end(renderPage(url.pathname, content, url.searchParams.get('lang') === 'sq' ? 'sq' : 'en'));
  } catch (e) { res.writeHead(500, {'Content-Type':'text/plain'}); res.end(e.message); }
});
const portArgument = process.argv.indexOf('--port');
const hostArgument = process.argv.indexOf('--host');
const port = portArgument >= 0 ? Number(process.argv[portArgument + 1]) : Number(process.env.PORT || 3000);
const host = hostArgument >= 0 ? process.argv[hostArgument + 1] : '0.0.0.0';
server.listen(port, host, () => console.log(`Preview ready on ${server.address().port}`));
