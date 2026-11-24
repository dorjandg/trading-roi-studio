import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderPage} from '../src/site.js';
const content=JSON.parse(await readFile(new URL('../src/content.json',import.meta.url),'utf8'));
test('contact buttons retain confirmed destinations; email only appears when configured',()=>{
 for(const lang of ['en','sq']){
  for(const path of ['/','/contact']){
   const html=renderPage(path,content,lang);
   assert.match(html,/class="contact-action-grid"/);
   assert.match(html,/href="tel:\+355692085923"/);
   assert.match(html,/href="https:\/\/wa.me\/355692085923"/);
   assert.match(html,/href="https:\/\/www.instagram.com\/landikademi\//);
   assert.doesNotMatch(html,/href="mailto:/);
  }
  const configured=structuredClone(content);configured.site.email='hello@example.test';
  assert.match(renderPage('/',configured,lang),/href="mailto:hello@example.test"/);
  configured.site.email='bad@example.test?body=invalid';
  assert.doesNotMatch(renderPage('/',configured,lang),/href="mailto:/);
 }
});
test('online and academy formats are explicit and link to applications',()=>{
 for(const lang of ['en','sq']){
  for(const path of ['/','/programs']){
   const html=renderPage(path,content,lang);
   assert.match(html,/class="training-grid"/);
   assert.match(html,/format=academy#application/);
   assert.match(html,/format=online#application/);
  }
  const form=renderPage('/apply',content,lang);
  assert.match(form,/name="format"[^>]*data-format-key="academy"/);
  assert.match(form,/name="format"[^>]*data-format-key="online"/);
  assert.match(form,lang==='sq'?/Në akademi/:/At the academy/);
 }
});
