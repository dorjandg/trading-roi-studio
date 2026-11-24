import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderPage} from '../src/site.js';
const content=JSON.parse(await readFile(new URL('../src/content.json',import.meta.url),'utf8'));
test('application uses compact accessible single-choice groups with localized values',()=>{
 for(const lang of ['en','sq']){
  const html=renderPage('/apply',content,lang);
  const form=html.match(/<form class="application-form"[\s\S]*?<\/form>/)?.[0];
  assert.ok(form);
  assert.ok(!form.includes('<select'));
  for(const [name,count] of [['experience',4],['program',8],['format',3]]){
   const inputs=form.match(new RegExp('<input type="radio" name="'+name+'"[^>]*>','g'))||[];
   assert.equal(inputs.length,count);
   assert.equal(inputs.filter(x=>x.includes('checked')).length,name==='experience'?0:1);
   if(name==='experience')assert.ok(inputs.every(x=>x.includes('required')));
  }
  assert.match(form,lang==='sq'?/Konkurse &amp; festivale/:/Competitions &amp; festivals/);
  assert.match(form,lang==='sq'?/Regjistrim në studio/:/Studio recording/);
  assert.match(form,/type="submit"/);
  assert.match(html,/<button class="concierge-launch"[^>]*aria-label="[^"]+"[^>]*>AI<\/button>/);
 }
});
test('customized program names remain visible and included in the enquiry',()=>{
 const modified=structuredClone(content);
 modified.programs[0].title.en='Custom vocal program';
 const html=renderPage('/apply',modified,'en');
 assert.match(html,/name="program" value="Custom vocal program"[^>]*><span>Custom vocal program<\/span>/);
});
test('private previews keep applications disabled and AI launcher hidden',()=>{
 const html=renderPage('/apply',content,'sq',{preview:true,draftId:'test'});
 assert.match(html,/<button class="button button-primary" type="submit" disabled>/);
 assert.match(html,/<button class="concierge-launch"[^>]* hidden[^>]*>AI<\/button>/);
});
