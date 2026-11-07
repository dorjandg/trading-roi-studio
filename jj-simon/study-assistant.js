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
 if(typeof jjApprovedAnswers!=='undefined')for(const item of jjApprovedAnswers){
  const refs=(item.evidence_ids||[]).map(id=>jjEvidenceRecords.find(e=>e.id===id)).filter(Boolean);
  corpus.push({id:'approved:'+item.id,type:'Reviewed course answer',title:item.title,
   searchText:[item.title,item.answer,...refs.map(e=>e.title+' '+e.quote)].join(' '),
   text:item.answer,quoted:null,footnote:'Reviewed Academy explanation. Original transcripts remain machine-generated and chart verification may still be pending.',
   sourceLabel:refs.length+' indexed source references',
   sourceUrl:refs[0]?'https://drive.google.com/file/d/'+encodeURIComponent(refs[0].source)+'/view':null,
   chapter:refs[0]?.related||'source-evidence-explorer'});
 }

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
function jjHelperStem(token){
 const t=String(token).toLowerCase();
 if(t==='copied'||t==='copying')return 'copy';
 if(t==='accounts')return 'account';
 if(t==='trades'||t==='trading')return 'trade';
 if(t==='points')return 'point';
 if(t==='fundeds')return 'funded';
 if(t==='profits')return 'profit';
 if(t==='payouts')return 'payout';
 if(t==='evaluations')return 'evaluation';
 if(t==='stops')return 'stop';
 return t;
}
function jjHelperSearch(question){
 const query=String(question||'').trim();
 const core=[...new Set((query.toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/)).filter(t=>t&&!jjHelperStop.has(t)).map(jjHelperStem))];
 if(!core.length)return [];
 const expanded=[...new Set(core.flatMap(x=>jjHelperSynonyms[x]||[]))].filter(t=>!core.includes(t));
 return jjHelperDocuments().map(doc=>{
  const title=doc.title.toLowerCase(),content=doc.searchText.toLowerCase();
  let score=0,match=0;
  const normalTitle=title.replace(/[^a-z0-9]+/g,' ').split(/\s+/).map(jjHelperStem);
  const normalContent=content.replace(/[^a-z0-9]+/g,' ').split(/\s+/).map(jjHelperStem);
  for(const t of core){
   if(normalTitle.includes(t)){score+=16;match++}
   else if(normalContent.includes(t)){score+=5;match++}
  }
  if(!match)return null;
  const required=core.length>=3?Math.ceil(core.length*0.6):core.length;
  if(match<required)return null;
  for(const t of expanded){
   if(normalTitle.includes(t))score+=2;
   else if(normalContent.includes(t))score+=0.5;
  }
  score+=match/core.length*12;
  if(normalContent.join(' ').includes(core.join(' ')))score+=14;
  if(doc.type==='Transcript evidence')score+=2;
  if(doc.type==='Reviewed course answer')score+=10;
  if(doc.type==='Trading Dictionary'&&core.every(t=>normalTitle.includes(t)))score+=7;
  if(doc.type==='Student Q&A')score+=1;
  return {...doc,score,match};
 }).filter(Boolean).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,8);
}
function jjHelperNode(tag,css,text){const el=document.createElement(tag);if(css)el.className=css;if(text!==undefined)el.textContent=text;return el}
let jjHelperQuestion='';

/* Unanswered-question queue. Browser storage is the fallback when no shared backend exists. */
const jjQuestionQueueKey='jj-unanswered-questions-v1';
const jjQuestionShareKey='jj-question-sharing-consent-v1';
function jjQuestionShareEnabled(){try{return localStorage.getItem(jjQuestionShareKey)==='yes'}catch(_){return false}}
function jjQueueRead(){
 try{const data=JSON.parse(localStorage.getItem(jjQuestionQueueKey)||'[]');return Array.isArray(data)?data:[]}
 catch(_){return []}
}
function jjQueueWrite(items){
 try{localStorage.setItem(jjQuestionQueueKey,JSON.stringify(items.slice(-200)));return true}
 catch(_){return false}
}
function jjQuestionId(q){return q.toLowerCase().replace(/\s+/g,' ').trim()}
function jjQueueAdd(question,reason,matchCount){
 const q=String(question||'').trim().slice(0,1000);if(q.length<8)return {ok:false,reason:'Question needs at least 8 characters'};
 const now=new Date().toISOString();const rows=jjQueueRead();const key=jjQuestionId(q);
 const found=rows.find(x=>x.key===key&&x.status!=='resolved');
 if(found){found.lastSeen=now;found.occurrences=(found.occurrences||1)+1;found.reasons=[...new Set([...(found.reasons||[]),reason])]}
 else rows.push({id:'UQ-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*100000).toString(36),key,question:q,status:'unanswered',reason,reasons:[reason],matchCount,createdAt:now,lastSeen:now,occurrences:1});
 const saved=jjQueueWrite(rows);jjQueueRender();
 if(saved&&jjQuestionShareEnabled())jjQueueTrySync(q,reason,matchCount).catch(()=>{});
 return {ok:saved,alreadyKnown:!!found};
}
const jjQaSyncBusy=new Set();
function jjCloudEndpoint(){
 const endpoint=String(window.JJ_ACADEMY_QUESTIONS_ENDPOINT||'').trim();
 return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(endpoint)?endpoint:'';
}
function jjRandomReceipt(){
 if(!window.crypto?.getRandomValues)throw Error('Secure random generator unavailable');
 const bytes=window.crypto.getRandomValues(new Uint8Array(32));
 return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function jjVerifyReceipt(endpoint,receipt){
 return new Promise((resolve,reject)=>{
  const id='jjReceipt'+Math.random().toString(36).slice(2);
  const script=document.createElement('script');let timer;
  const clear=()=>{clearTimeout(timer);script.remove();try{delete window[id]}catch(_){}};
  window[id]=data=>{clear();data?.ok===true?resolve(data):reject(Error(data?.error||'Cloud readback unverified'))};
  script.onerror=()=>{clear();reject(Error('Cloud readback unavailable'))};
  timer=setTimeout(()=>{clear();reject(Error('Cloud readback timeout'))},14000);
  script.src=endpoint+(endpoint.includes('?')?'&':'?')+new URLSearchParams({action:'verify',receipt,callback:id,t:Date.now()});
  document.head.appendChild(script);
 });
}
async function jjQueueTrySync(question,reason,matchCount){
 const key=jjQuestionId(question),endpoint=jjCloudEndpoint();
 if(!jjQuestionShareEnabled()||!endpoint||jjQaSyncBusy.has(key))return false;
 const rows=jjQueueRead(),entry=rows.find(r=>r.key===key&&r.status!=='resolved');
 if(!entry||(entry.synced&&entry.accessReceipt))return !!entry?.synced;
 jjQaSyncBusy.add(key);
 const receipt=jjRandomReceipt();
 try{
  const body=new URLSearchParams({action:'submit',question,reason,matchCount:String(Math.max(0,Math.min(Number(matchCount)||0,1000))),receipt});
  // Like Trading Studio: Apps Script POST has opaque response; trust only verified GET readback.
  await fetch(endpoint,{method:'POST',mode:'no-cors',body,cache:'no-store',signal:AbortSignal.timeout(16000)});
  const verified=await jjVerifyReceipt(endpoint,receipt);
  if(!verified.id||!verified.id.startsWith('uq_'))throw Error('Invalid verified question receipt');
  const fresh=jjQueueRead();
  for(const row of fresh)if(row.key===key){row.synced=true;row.serverId=verified.id;row.accessReceipt=receipt;row.syncedAt=new Date().toISOString();delete row.syncError}
  jjQueueWrite(fresh);jjQueueRender();return true;
 }catch(error){
  const fresh=jjQueueRead();
  for(const row of fresh)if(row.key===key){row.synced=false;row.syncError='Not verified · retry sync'}
  jjQueueWrite(fresh);jjQueueRender();return false;
 }finally{jjQaSyncBusy.delete(key)}
}
async function jjQueueSyncPending(){
 if(!jjQuestionShareEnabled()||!jjCloudEndpoint())return false;
 const rows=jjQueueRead().filter(r=>r.status!=='resolved'&&(!r.synced||!r.accessReceipt)).slice(0,15);
 for(const row of rows)await jjQueueTrySync(row.question,row.reason||'Question not answered',row.matchCount||0);
 return true;
}
function jjQueueRender(){
 const root=document.getElementById('jj-helper-app');if(!root)return;
 const container=root.querySelector('#jj-question-queue');if(!container)return;
 const rows=jjQueueRead(),open=rows.filter(x=>x.status!=='resolved');
 container.replaceChildren();
 const heading=jjHelperNode('div','jj-queue-heading');
 heading.append(jjHelperNode('strong','','Unanswered-question register'),jjHelperNode('span','',open.length+' open'));
 container.append(heading);
 const helper=jjHelperNode('p','jj-helper-hint','Questions are saved in this browser. With your opt-in, unanswered questions can be sent to a private research queue when configured, where the existing JJ research automation can process them. Local-only entries do not notify ChatGPT.');
 container.append(helper);
 if(!open.length){container.append(jjHelperNode('p','jj-helper-hint','No unanswered questions recorded yet.'));return}
 const list=jjHelperNode('div','jj-queue-list');
 for(const row of open.slice(-25).reverse()){
  const item=jjHelperNode('div','jj-queue-item');
  item.append(jjHelperNode('strong','',row.question));
  const sub=jjHelperNode('small','',row.reasons?.join(' · ')||row.reason);
  item.append(sub);
  const meta=jjHelperNode('small','',row.synced?'Google Drive verified':jjCloudEndpoint()?'Saved locally · Google sync not verified':'Saved locally · Google sync not configured');
  item.append(meta);
  const actions=jjHelperNode('div','jj-queue-actions');
  const retry=jjHelperNode('button','','Search again');retry.type='button';retry.onclick=()=>{
   jjHelperQuestion=row.question;const input=root.querySelector('.jj-helper-form textarea');if(input)input.value=row.question;jjHelperAnswer();
  };
  const resolved=jjHelperNode('button','','Mark resolved locally');resolved.type='button';resolved.onclick=()=>{
   const current=jjQueueRead();const target=current.find(x=>x.id===row.id);if(target){target.status='resolved';target.resolvedAt=new Date().toISOString();jjQueueWrite(current);jjQueueRender()}
  };
  actions.append(retry,resolved);item.append(actions);list.append(item);
 }
 container.append(list);
 const options=jjHelperNode('div','jj-queue-actions');
 const copy=jjHelperNode('button','','Copy review queue');copy.type='button';
 copy.onclick=()=>{
  const content=open.map(x=>'- '+x.question+' | '+(x.reasons?.join('; ')||x.reason)+' | '+x.createdAt).join('\n');
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(content).catch(()=>{});
  else {const temp=document.createElement('textarea');temp.value=content;document.body.append(temp);temp.select();document.execCommand('copy');temp.remove()}
 };
 const exportButton=jjHelperNode('button','','Export JSON');exportButton.type='button';
 exportButton.onclick=()=>{
  const blob=new Blob([JSON.stringify(open,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='jj-unanswered-questions.json';a.click();URL.revokeObjectURL(url);
 };
 options.append(copy,exportButton);
 const sync=jjHelperNode('button','','Sync unanswered questions');sync.type='button';
 const endpoint=jjCloudEndpoint();
 sync.disabled=!endpoint||!jjQuestionShareEnabled();
 sync.title=!endpoint?'Google Apps Script endpoint needs activation':!jjQuestionShareEnabled()?'Enable private queue sharing first':'Send unsynced questions to Google Drive and verify receipts';
 sync.onclick=async()=>{sync.disabled=true;sync.textContent='Syncing…';await jjQueueSyncPending();sync.textContent='Sync unanswered questions';sync.disabled=!jjCloudEndpoint()||!jjQuestionShareEnabled();jjQueueRender()};
 options.append(sync);
 container.append(options);
 if(!endpoint)container.append(jjHelperNode('p','jj-helper-hint','Google Apps Script review queue not connected yet; all questions remain saved in this browser.'));
}
function jjQueueFeedback(question,hits){
 const root=document.getElementById('jj-helper-app');if(!root)return;
 const place=root.querySelector('#jj-helper-feedback');if(!place)return;
 place.replaceChildren();
 if(!question.trim())return;
 if(!hits.length){
  const already=jjQueueRead().some(x=>x.key===jjQuestionId(question)&&x.status!=='resolved');
  place.append(jjHelperNode('p','jj-queue-warning',already?'No relevant matches. This question is registered for research.':'No relevant matches. Registering this question for research.'));
  if(!already)jjQueueAdd(question,'No source match',0);
 }else{
  place.append(jjHelperNode('span','','Did these sources answer your question?'));
  const no=jjHelperNode('button','','No — register for research');no.type='button';
  no.onclick=()=>{const res=jjQueueAdd(question,'Sources do not answer question',hits.length);no.textContent=res.ok?'Registered locally':'Could not save locally';no.disabled=!!res.ok};
  place.append(no);
 }
}

function jjHelperAnswer(){
 const root=document.getElementById('jj-helper-app');if(!root)return;
 const output=root.querySelector('#jj-helper-results');output.replaceChildren();
 const hits=jjHelperSearch(jjHelperQuestion);
 if(!jjHelperQuestion.trim()){
  jjQueueFeedback('',[]);
  output.append(jjHelperNode('p','jj-helper-hint','Ask a question to find the most relevant course passages.'));
  return;
 }
 const title=jjHelperNode('div','jj-helper-answer-header');
 title.append(jjHelperNode('strong','',hits.length?'Relevant course findings':'No supported answer found'));
 title.append(jjHelperNode('span','',hits.length+' source matches'));output.append(title);
 jjQueueFeedback(jjHelperQuestion,hits);
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
 root.append(jjHelperNode('p','jj-helper-hint','Searches use Academy material in this browser. Unanswered questions remain local unless you opt into private research submissions. Do not enter passwords or sensitive personal information. An existing hourly research automation checks the private sheet after questions are successfully synced.'));
 const shareLabel=jjHelperNode('label','jj-helper-share');
 const share=jjHelperNode('input');share.type='checkbox';share.checked=jjQuestionShareEnabled();
 share.addEventListener('change',()=>{try{localStorage.setItem(jjQuestionShareKey,share.checked?'yes':'no')}catch(_){};jjQueueRender();if(share.checked)jjQueueSyncPending().catch(()=>{})});
 shareLabel.append(share,jjHelperNode('span','','Allow unanswered questions to be sent to the private review queue when connected'));root.append(shareLabel);
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
 const feedback=jjHelperNode('div','jj-helper-feedback');feedback.id='jj-helper-feedback';root.append(feedback);
 const queue=jjHelperNode('section','jj-question-queue');queue.id='jj-question-queue';root.append(queue);
 const toc=article.querySelector(':scope > .chapter-toc');if(toc)toc.before(root);else article.append(root);
 jjHelperAnswer();
 jjQueueRender();
 if(jjQuestionShareEnabled()&&jjCloudEndpoint())jjQueueSyncPending().catch(()=>{});
}
const jjHelperBeforeRender=render;
render=function(){jjHelperBeforeRender();if(active===jjHelperSlug)jjHelperMount()};
if(new URLSearchParams(location.search).get('topic')===jjHelperSlug)active=jjHelperSlug;
jjRebuildMobileSelector();renderNav();render();
