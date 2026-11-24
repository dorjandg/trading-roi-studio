import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderPage} from '../src/site.js';
const content=JSON.parse(await readFile(new URL('../src/content.json',import.meta.url),'utf8'));
test('free assessment is the public entry point with honest WhatsApp appointment request',()=>{
 for(const lang of ['en','sq']){
  const home=renderPage('/',content,lang);
  const page=renderPage('/apply',content,lang);
  assert.match(home,lang==='sq'?/Kërko seancën falas/:/Request a free session/);
  assert.match(page,/class="assessment-overview"/);
  assert.match(page,/class="assessment-duration">20 min/);
  assert.match(page,lang==='sq'?/Seanca e parë falas/:/Free first session/);
  assert.match(page,lang==='sq'?/Kërko seancën në WhatsApp/:/Request session on WhatsApp/);
  assert.match(page,lang==='sq'?/Rezervimi konfirmohet pasi/:/No booking is confirmed/);
  assert.match(page,/id="application-form"/);
  assert.match(page,/data-format-key="academy"/);
  assert.match(page,/data-format-key="online"/);
  assert.match(page,lang==='sq'?/Dëshiroj të kërkoj seancën e parë falas/:/I would like to request my free introductory vocal assessment/);
 }
});
test('assessment duration and explanations are editable through structured content',()=>{
 const updated=structuredClone(content);
 updated.assessment.durationMinutes=15;
 assert.match(renderPage('/apply',updated,'en'),/class="assessment-duration">15 min/);
});
