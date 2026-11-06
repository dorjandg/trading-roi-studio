import {test} from 'node:test';
import assert from 'node:assert/strict';
import {corpus,rankQuestion,answerSchema,responseText} from './review-questions.mjs';
import {validatedPublic,getList} from './propose-approved.mjs';

test('course evidence corpus includes directly indexed sources',async()=>{
 const all=await corpus();
 assert.ok(all.length>=100);
 assert.ok(all.some(x=>x.id==='EV04'));
 assert.ok(all.some(x=>x.kind==='glossary'));
 assert.ok(all.some(x=>x.kind==='qa_review'));
});
test('source retrieval matches funded 50-point question',async()=>{
 const ranked=rankQuestion('How does the 50 point funded two trade strategy work?',await corpus());
 assert.ok(ranked.length>0);
 assert.ok(ranked.some(x=>x.id==='EV04'||x.title.toLowerCase().includes('50 point')));
});
test('unrelated question has no false evidentiary support',async()=>{
 const ranked=rankQuestion('Explain quantum photolithography calibration optics',await corpus());
 assert.equal(ranked.length,0);
});
test('schema requires explicit references and confidence',()=>{
 const schema=answerSchema();
 for(const key of ['answer','confidence','evidence_ids','uncertainties','needs_video_review','publishable'])assert.ok(schema.required.includes(key));
});
test('response parser accepts output text content',()=>{
 assert.equal(responseText({output:[{content:[{type:'output_text',text:'{"x":1}'}]}]}),'{"x":1}');
});
test('only manually approved public content can enter a PR',()=>{
 const evidence=new Set(['EV04','EV10']);
 const common={id:'uq_0123456789abcdef012345',approved_public_title:'Two-part funded method',
  approved_public_answer:'JJ outlines a conditional second leg after the first winner.',approved_evidence_ids:JSON.stringify(['EV04'])};
 assert.ok(validatedPublic(common,evidence));
 assert.equal(validatedPublic({...common,approved_evidence_ids:'["EV99"]'},evidence),null);
 assert.equal(validatedPublic({...common,approved_public_answer:'Email me at student@example.com'},evidence),null);
 assert.equal(validatedPublic({...common,approved_public_title:''},evidence),null);
});
test('approved-answer catalog parser preserves empty list',()=>{
 assert.deepEqual(getList('const jjApprovedAnswers=[];'),[]);
});
