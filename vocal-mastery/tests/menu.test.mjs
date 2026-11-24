import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
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

test('every approved coaching scene uses early responsive WebP loading in both languages',async()=>{
 const scenes=[['/','01'],['/academy','02'],['/apply','03'],['/voice','04'],['/programs','05']];
 const widths=[480,768,1152,1440];
 for(const [page,n] of scenes){
  const original=await readFile(new URL('../public/assets/coaching-'+n+'.png',import.meta.url));
  const base='/assets/coaching-'+n+'-v1-';
  const srcset=widths.map(w=>base+w+'.webp '+w+'w').join(', ');
  const sizes='(max-width: 1320px) 100vw, 1320px';
  for(const width of widths){
   const asset=base+width+'.webp';
   const bytes=await readFile(new URL('../dist/public'+asset,import.meta.url));
   const meta=await sharp(bytes).metadata();
   assert.equal(meta.format,'webp');
   assert.equal(meta.width,width);
   assert.ok(Math.abs(meta.width/meta.height-16/9)<0.04);
   assert.ok(bytes.length<original.length,asset+' is smaller than the approved original');
   assert.ok(bytes.length<=(width<=768?120:250)*1024,asset+' meets the transfer size budget');
  }
  for(const lang of ['en','sq']){
   const html=renderPage(page,content,lang);
   const scene=html.match(/<div class="coaching-scene [^"]*" aria-hidden="true"><img[^>]*>/g)||[];
   assert.equal(scene.length,1,page+' has exactly one coaching scene');
   const priority=page==='/'?'auto':'high';
   assert.ok(scene[0].includes('src="'+base+'1152.webp"'));
   assert.ok(scene[0].includes('srcset="'+srcset+'"'));
   assert.ok(scene[0].includes('sizes="'+sizes+'"'));
   assert.ok(scene[0].includes('loading="eager" fetchpriority="'+priority+'"'));
   const preload='<link rel="preload" as="image" type="image/webp" imagesrcset="'+srcset+'" imagesizes="'+sizes+'" fetchpriority="'+priority+'">';
   assert.ok(html.includes(preload),page+' preloads the correct responsive image');
   assert.ok(html.indexOf(preload)<html.indexOf('rel="stylesheet"'));
   if(page==='/')assert.ok(html.includes('src="'+content.site.heroImage+'"'));
  }
 }
 assert.ok(!renderPage('/landi',content,'en').includes('imagesrcset="/assets/coaching-'));
});
