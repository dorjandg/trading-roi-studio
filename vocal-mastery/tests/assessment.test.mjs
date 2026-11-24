import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderPage} from '../src/site.js';
const content=JSON.parse(await readFile(new URL('../src/content.json',import.meta.url),'utf8'));
test('professional assessment is the public entry point with honest WhatsApp appointment request',()=>{
 for(const lang of ['en','sq']){
  const home=renderPage('/',content,lang);
  const page=renderPage('/apply',content,lang);
  assert.match(home,lang==='sq'?/Kërko një vlerësim/:/Request an assessment/);
  assert.match(page,/class="assessment-overview"/);
  assert.match(page,/class="assessment-duration">20 min/);
  assert.match(page,lang==='sq'?/Vlerësim individual/:/Individual assessment/);
  assert.match(page,lang==='sq'?/Kërko seancën në WhatsApp/:/Request session on WhatsApp/);
  assert.match(page,lang==='sq'?/Rezervimi konfirmohet pasi/:/No booking is confirmed/);
  assert.match(page,/id="application-form"/);
  assert.match(page,/data-format-key="academy"/);
  assert.match(page,/data-format-key="online"/);
  assert.match(page,lang==='sq'?/Dëshiroj të caktoj një takim për vlerësimin fillestar/:/I would like to arrange an initial vocal assessment/);
 }
});
test('assessment duration and explanations are editable through structured content',()=>{
 const updated=structuredClone(content);
 updated.assessment.durationMinutes=15;
 assert.match(renderPage('/apply',updated,'en'),/class="assessment-duration">15 min/);
});

test('assessment is not promoted as a free offer',()=>{
 for(const lang of ['en','sq']){
  const html=renderPage('/apply',content,lang);
  const headline=html.match(/<section class="page-hero"[^>]*>[\s\S]*?<\/section>/)?.[0]||'';
  const overview=html.match(/<section class="assessment-overview"[^>]*>[\s\S]*?<\/section>/)?.[0]||'';
  assert.ok(overview);
  assert.doesNotMatch(headline+overview,/\b(free|falas)\b/i);
  assert.match(overview,lang==='sq'?/Vlerësojmë nëse akademia mund të të ndihmojë/:/whether the academy can support your goals/);
 }
});
