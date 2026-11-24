import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderPage} from '../src/site.js';
const content=JSON.parse(await readFile(new URL('../src/content.json',import.meta.url),'utf8'));
test('premium bilingual footer retains all verified links and accessible disclosures',()=>{
 for(const lang of ['en','sq']){
  const html=renderPage('/',content,lang);
  const footer=html.match(/<footer class="site-footer"[^>]*>[\s\S]*?<\/footer>/)?.[0];
  assert.ok(footer);
  for(const name of ['footer-identity','footer-explore','footer-contact','footer-assessment','footer-legal','footer-bottom'])assert.ok(footer.includes('class="'+name+'"'));
  for(const path of ['/academy','/programs','/landi','/stories','/media','/voice','/contact','/apply','/privacy'])assert.ok(footer.includes('href="'+path+'?lang='+lang+'"'));
  assert.match(footer,/href="tel:\+355692085923"/);
  assert.match(footer,/href="https:\/\/wa.me\/355692085923"/);
  assert.match(footer,/href="https:\/\/www.instagram.com\/landikademi\//);
  assert.doesNotMatch(html,/href="(?:https:\/\/vocalmastery\.net)?\/manage(?:[\/"?]|$)/);
  assert.doesNotMatch(footer,/>Website studio</i);
  assert.match(footer,/<details><summary>/);
  assert.match(footer,/id="footer-chat-open"[^>]*aria-controls="chat-panel"/);
  assert.match(footer,/With Landi Kademi|Me Landi Kademin/);
  assert.doesNotMatch(footer,/Kadeli/);
 }
 const preview=renderPage('/',content,'en',{preview:true,draftId:'preview'});
 assert.match(preview,/id="footer-chat-open"[^>]* hidden/);
});
