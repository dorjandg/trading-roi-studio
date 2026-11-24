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
  assert.match(html,/site\.css\?v=hero-balance-1/);
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

test('one accessible language switch toggles directly to the other language on the same page',()=>{
 for(const page of ['/','/academy','/programs','/landi','/stories','/media','/voice','/apply','/contact','/privacy']){
  for(const lang of ['en','sq']){
   const html=renderPage(page,content,lang);
   const header=html.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
   assert.ok(header);
   const toggles=header.match(/<a class="language-toggle"[^>]*>[\s\S]*?<\/a>/g)||[];
   assert.equal(toggles.length,1);
   const target=lang==='en'?'sq':'en';
   assert.ok(toggles[0].includes('data-language="'+target+'"'));
   assert.ok(toggles[0].includes('href="'+page+'?lang='+target+'"'));
   assert.ok(toggles[0].endsWith((target==='sq'?'AL':'EN')+'</a>'));
   assert.match(toggles[0],/aria-label="[^"]+"/);
   assert.doesNotMatch(header,/class="language-switch"/);
  }
 }
 const preview=renderPage('/academy',content,'en',{preview:true,draftId:'test'});
 assert.match(preview,/class="language-toggle" data-language="sq" href="\/manage\/preview\?draft=test&page=%2Facademy&lang=sq"/);
});

test('bilingual welcome preserves approved title, image and equal CTA structure',()=>{
 for(const lang of ['en','sq']){
  const html=renderPage('/',content,lang);
  const hero=html.match(/<section class="hero">[\s\S]*?<\/section>/)?.[0];
  assert.ok(hero);
  assert.equal((hero.match(/<h1>/g)||[]).length,1);
  assert.ok(hero.includes(content.hero.title[lang].replace('\n','<br>')));
  assert.ok(hero.includes('src="'+content.site.heroImage+'"'));
  assert.match(hero,/class="button button-primary"/);
  assert.ok(hero.includes('href="/apply?lang='+lang+'"'));
  assert.ok(hero.includes('href="/programs?lang='+lang+'"'));
  assert.match(html,/site\.css\?v=hero-balance-1/);
 }
});
test('mobile portrait is in normal flow and both languages use one shared type and CTA size',async()=>{
 const css=await readFile(new URL('../public/assets/site.css',import.meta.url),'utf8');
 const rules=css.slice(css.indexOf('/* Equal bilingual hero geometry'));
 assert.match(rules,/\.hero-copy\{position:relative;container-type:inline-size/);
 assert.match(rules,/\.hero\{display:flex;flex-direction:column;min-height:0;height:auto/);
 assert.match(rules,/\.hero-portrait\{position:relative;top:auto;bottom:auto/);
 assert.match(rules,/\.hero-signature\{position:static/);
 assert.match(rules,/\.hero-actions \.button\{width:min\(100%,270px\);min-width:0;min-height:50px/);
 assert.doesNotMatch(rules,/\[lang=/);
});
