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
  assert.match(menu,lang==='sq'?/<span>Vlerësim<\/span>/:/<span>Assessment<\/span>/);
  assert.equal((menu.match(/aria-current="page"/g)||[]).length,1);
  assert.match(menu,/href="tel:\+355692085923"/);
  assert.match(menu,/href="https:\/\/wa.me\/355692085923"/);
  assert.ok(!menu.includes('menu-contact"><a href="https://wa.me/355692085923"'));
  assert.match(html,/site\.css\?v=coaching-scenes-1/);
 }
});

test('each approved coaching scene is available on its intended public page in both languages', async()=>{
 const scenes=[['/','01'],['/academy','02'],['/apply','03'],['/voice','04'],['/programs','05']];
 const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
 for(const [page,n] of scenes){
  const asset='/assets/coaching-'+n+'.png';
  const bytes=await readFile(new URL('../public'+asset,import.meta.url));
  assert.ok(bytes.length>1024,asset+' is not an empty placeholder');
  assert.deepEqual(bytes.subarray(0,8),pngSignature,asset+' is a PNG');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  assert.ok(width>=1200&&height>=675&&Math.abs(width/height-16/9)<0.04,asset+' is a landscape scene');
  for(const lang of ['en','sq']){
   const html=renderPage(page,content,lang);
   const scene=html.match(/<div class="coaching-scene [^"]*" aria-hidden="true"><img[^>]*>/g)||[];
   assert.equal(scene.length,1,page+' has exactly one coaching scene');
   assert.ok(scene[0].includes('src="'+asset+'"'),page+' uses its assigned scene');
   assert.match(scene[0],/alt=""[^>]*loading="lazy"[^>]*decoding="async"/);
   if(page==='/')assert.ok(html.includes('src="'+content.site.heroImage+'"'));
  }
 }
});
