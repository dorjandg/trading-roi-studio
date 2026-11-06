/* Offline source-grounded question helper: searches ONLY loaded Academy data. No external AI calls. */
const jjHelperSlug='academy-study-assistant';
const jjHelperChapter={
 slug:jjHelperSlug,group:'Research',title:'Study Assistant — Ask the Academy',
 intro:'Ask a question in plain language and get relevant course excerpts, calculations, dictionary definitions and original transcript links. This local helper searches indexed material: it does not generate an AI answer or verify the original video.',
 status:'Course source lookup · no model connected; machine transcripts need verification',
 sections:[{title:'How this question helper works',points:[
 'Questions are searched locally against existing Academy definitions, transcript evidence, live Q&A and lesson sections. No question is sent to an external AI model.',
 'The helper ranks relevant material and displays exact indexed wording or existing research interpretation. It does not generate original trading advice or make new claims.',
 'If the sources do not clearly answer a question, results are marked as possible matches rather than guaranteed answers.',
 'For genuine conversational AI synthesis, connect a securely hosted backend with source retrieval and keep API credentials on the server, never in public browser JavaScript.'
 ],src:[['Risk of Ruin Bankroll Management','00:00–05:20','1VOJtRPDpy9LB4UakPYfZChROyAtPLQfv']]}]
};
if(!chapters.some(c=>c.slug===jjHelperSlug)){
 chapters.push(jjHelperChapter);
 curriculum.push({slug:jjHelperSlug,title:'00 · Study Assistant',status:'review',reason:'Search indexed course evidence with original source links.'});
}
const jjHelperSynonyms={
 bos:['structure','break','pivot','displacement'],
 'break':['bos','structure','confirmation'],
 'sl':['stop','loss','risk'],
 'tp':['target','profit','reward'],
 'be':['breakeven','break even'],
 'ev':['expected','value','expectancy'],
 'fair':['price','anchor','reversion'],
 'overnight':['asian','session'],
 'ftmo':['funded','account','prop'],
 'topstep':['funded','evaluation','payout'],
 'payout':['withdraw','withdrawal','cash','winning'],
 'drawdown':['loss','account','trailing'],
 'risk':['ruin','drawdown','bankroll'],
 'copy':['copied','correlation','portfolio'],
 '11':['session','morning','funded','trend'],
 '50':['funded','points','stop'],
 '100':['funded','points','target'],
 'account':['funded','evaluation','challenge'],
 'win':['winning','probability','rate'],
 'when':['timing','session']
};
const jjHelperStop=new Set('what why how who where when is are was were the this that from into with for can could should would does do did i me my you your a an of on at to in and or if by about there here jj simon tell explain please know want need which they them their'.split(' '));
function jjHelperTokens(query){
 const tokens=(String(query||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/)).filter(x=>x&&!jjHelperStop.has(x));
 const expanded=new Set(tokens);
 for(const token of tokens)for(const extra of jjHelperSynonyms[token]||[])expanded.add(extra);
 return [...expanded];
}
function jjHelperDocuments(){
 const corpus=[];
 for(const record of jjEvidenceRecords){
  corpus.push({id:'ev:'+record.id,type:'Transcript evidence',title:record.title,
   searchText:[record.title,record.topic,record.type,record.quote,record.interpretation,record.caveat].join(' '),
   text:record.interpretation,quoted:record.quote,footnote:record.caveat,
   sourceLabel:'Source recording · '+record.time,
   sourceUrl:'https://drive.google.com/file/d/'+encodeURIComponent(record.source)+'/view',
   chapter:record.related});
 }
 for(const term of jjTerms){
  corpus.push({id:'term:'+term.id,type:'Trading Dictionary',title:term.term,
   searchText:[term.term,term.category,term.subcategory||'',term.meaning,term.not,term.exception].join(' '),
   text:term.meaning,quoted:null,footnote:term.exception,
   sourceLabel:'Dictionary definition · '+term.id,sourceUrl:null,chapter:'terminology-consistency-audit'});
 }
 for(const record of jjUnifiedQAData){
  corpus.push({id:'qa:'+record.id,type:record.kind==='Statistical claim'?'Claim review':'Student Q&A',title:record.question,
   searchText:[record.question,record.topic,...record.answer].join(' '),
   text:record.answer.join(' '),quoted:null,footnote:'Original audio and speaker attribution have not been independently verified.',
   sourceLabel:'Live Q&A · '+record.time,sourceUrl:'https://drive.google.com/file/d/'+encodeURIComponent(record.src)+'/view',chapter:'student-qa-library'});
 }
 for(const chapter of chapters){
  if(chapter.slug===jjHelperSlug||chapter.slug==='terminology-consistency-audit')continue;
  for(let i=0;i<chapter.sections.length;i++){
   const section=chapter.sections[i];
   corpus.push({id:'lesson:'+chapter.slug+':'+i,type:'Course lesson',title:section.title,
    searchText:[chapter.title,section.title,section.points.join(' ')].join(' '),
    text:section.points.slice(0,3).join(' '),quoted:null,
    footnote:'Study interpretation, not confirmed chart execution.',
    sourceLabel:'Academy · '+chapter.title,
    sourceUrl:section.src?.[0]?.[2]?'https://drive.google.com/file/d/'+encodeURIComponent(section.src[0][2])+'/view':null,
    chapter:chapter.slug});
  }
 }
 return corpus;
}
function jjHelperSearch(question){
 const query=String(question||'').trim();const tokens=jjHelperTokens(query);
 if(!query||!tokens.length)return [];
 const plain=query.toLowerCase();
 return jjHelperDocuments().map(doc=>{
  const title=doc.title.toLowerCase(),content=doc.searchText.toLowerCase();
  let score=0,match=0;
  for(const t of tokens){
   if(title.includes(t)){score+=6;match++}
   else if(content.includes(t)){score+=2;match++}
  }
  const original=jjHelperTokens(query).filter(t=>!Object.values(jjHelperSynonyms).some(s=>s.includes(t)&&!plain.includes(t)));
  if(original.length&&original.every(t=>content.includes(t)))score+=4;
  if(content.includes(plain))score+=8;
  if(doc.type==='Transcript evidence')score+=score?2:0;
  if(doc.type==='Trading Dictionary'&&query.toLowerCase().includes(title))score+=7;
  if(doc.type==='Student Q&A'&&score)score+=1;
  return {...doc,score,match};
 }).filter(d=>d.score>=4&&d.match>=1).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,8);
}
function jjHelperNode(tag,css,text){const el=document.createElement(tag);if(css)el.className=css;if(text!==undefined)el.textContent=text;return el}
let jjHelperQuestion='';
function jjHelperAnswer(){
 const root=document.getElementById('jj-helper-app');if(!root)return;
 const output=root.querySelector('#jj-helper-results');output.replaceChildren();
 const hits=jjHelperSearch(jjHelperQuestion);
 if(!jjHelperQuestion.trim()){
  output.append(jjHelperNode('p','jj-helper-hint','Ask a question to find the most relevant course passages.'));
  return;
 }
 const title=jjHelperNode('div','jj-helper-answer-header');
 title.append(jjHelperNode('strong','',hits.length?'Relevant course findings':'No supported answer found'));
 title.append(jjHelperNode('span','',hits.length+' source matches'));output.append(title);
 if(!hits.length){
  output.append(jjHelperNode('p','jj-helper-hint','The currently indexed Academy material does not establish an answer. Try a shorter question, a specific trading term, or the Trading Dictionary.'));
  return;
 }
 const note=jjHelperNode('p','jj-helper-hint','These are retrieved course findings, not a generated AI answer. Verify original transcripts and distinguish historical examples from current prop-firm rules.');
 output.append(note);
 for(const r of hits){
  const card=jjHelperNode('details','jj-helper-hit');
  const summary=jjHelperNode('summary');
  const left=jjHelperNode('span','jj-helper-hit-title');
  left.append(jjHelperNode('strong','',r.title),jjHelperNode('small','',r.type+' · '+r.sourceLabel));
  summary.append(left);card.append(summary);
  const body=jjHelperNode('div','jj-helper-hit-body');
  if(r.quoted){body.append(jjHelperNode('strong','jj-helper-label','Machine-transcribed excerpt'),jjHelperNode('blockquote','',r.quoted))}
  body.append(jjHelperNode('strong','jj-helper-label',r.type==='Trading Dictionary'?'Definition':'Research explanation'),jjHelperNode('p','',r.text));
  if(r.footnote){body.append(jjHelperNode('strong','jj-helper-label','Limitation / exception'),jjHelperNode('p','jj-helper-caution',r.footnote))}
  const links=jjHelperNode('div','jj-helper-links');
  if(r.sourceUrl){const a=jjHelperNode('a','','Open original transcript');a.href=r.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';links.append(a)}
  if(r.chapter&&curriculum.some(m=>m.slug===r.chapter)){const b=jjHelperNode('button','','Open Academy chapter');b.type='button';b.onclick=()=>pick(r.chapter);links.append(b)}
  body.append(links);card.append(body);output.append(card);
 }
 output.querySelector('.jj-helper-hit')?.setAttribute('open','');
}
function jjHelperMount(){
 const article=document.getElementById(jjHelperSlug);if(!article||article.querySelector('#jj-helper-app'))return;
 const root=jjHelperNode('section','jj-helper-app');root.id='jj-helper-app';
 root.append(jjHelperNode('h3','','Ask about JJ’s trading course'));
 root.append(jjHelperNode('p','jj-helper-hint','Source-based help using indexed Academy content. Your questions stay in the browser; no external model connection is active.'));
 const form=jjHelperNode('form','jj-helper-form');
 const input=jjHelperNode('textarea');input.rows=2;input.placeholder='Example: When does JJ use BOS instead of displacement on funded accounts?';input.value=jjHelperQuestion;input.setAttribute('aria-label','Question about JJ Academy');
 form.append(input);
 const action=jjHelperNode('div','jj-helper-form-actions');
 const ask=jjHelperNode('button','','Find course answers');ask.type='submit';action.append(ask);
 const clear=jjHelperNode('button','','Clear');clear.type='button';clear.onclick=()=>{input.value='';jjHelperQuestion='';jjHelperAnswer();input.focus()};action.append(clear);form.append(action);
 form.addEventListener('submit',e=>{e.preventDefault();jjHelperQuestion=input.value.trim();jjHelperAnswer()});
 root.append(form);
 const examples=jjHelperNode('div','jj-helper-examples');
 for(const query of ['What is fair price?','When does JJ trade after 11?','How does the 50-point funded setup work?','What is risk of ruin?','When should accounts be copied?']){
  const button=jjHelperNode('button','',query);button.type='button';
  button.onclick=()=>{input.value=query;jjHelperQuestion=query;jjHelperAnswer()};examples.append(button);
 }
 root.append(examples);
 const results=jjHelperNode('div','jj-helper-results');results.id='jj-helper-results';results.setAttribute('aria-live','polite');root.append(results);
 const toc=article.querySelector(':scope > .chapter-toc');if(toc)toc.before(root);else article.append(root);
 jjHelperAnswer();
}
const jjHelperBeforeRender=render;
render=function(){jjHelperBeforeRender();if(active===jjHelperSlug)jjHelperMount()};
if(new URLSearchParams(location.search).get('topic')===jjHelperSlug)active=jjHelperSlug;
jjRebuildMobileSelector();renderNav();render();
