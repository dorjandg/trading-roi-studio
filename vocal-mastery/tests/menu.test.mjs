import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderPage} from '../src/site.js';
const content=JSON.parse(await readFile(new URL('../src/content.json',import.meta.url),'utf8'));
test('compact bilingual navigation keeps eight destinations and a dedicated application action',()=>{
 for(const lang of ['en','sq']){
  const html=renderPage('/programs',content,lang);
  const menu=html.match(/<nav class="site-menu"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(menu);
  assert.equal((menu.match(/class="menu-item(?: menu-apply)?"/g)||[]).length,9);
  assert.match(menu,/class="menu-item menu-apply"/);
  assert.match(menu,lang==='sq'?/<span>Programet<\/span>/:/<span>Programs<\/span>/);
  assert.match(menu,lang==='sq'?/<span>Apliko<\/span>/:/<span>Apply<\/span>/);
  assert.equal((menu.match(/aria-current="page"/g)||[]).length,1);
  assert.match(menu,/href="tel:\+355692085923"/);
  assert.match(menu,/href="https:\/\/wa.me\/355692085923"/);
  assert.ok(!menu.includes('menu-contact"><a href="https://wa.me/355692085923"'));
  assert.match(html,/site\.css\?v=form-3/);
 }
});
