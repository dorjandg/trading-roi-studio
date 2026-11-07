/* Optional Cloudflare AI synthesis. Local search stays the default and fallback.
   Only selected indexed research summaries are sent when user clicks AI. */
(() => {
 'use strict';
 const API='/api/ask';
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 let busy=false;
 const storeKey='jj-ai-saved-chats-v1';
 const oldKey='jj-ai-conversation-v2';
 const makeChat=(messages=[])=>({id:String(Date.now())+'-'+Math.random().toString(36).slice(2,8),title:messages.find(x=>x.role==='user')?.content?.slice(0,65)||'New chat',messages,updated:Date.now()});
 let chats=[],currentId='',conversation=[];
 try{const data=JSON.parse(localStorage.getItem(storeKey)||'{}');if(Array.isArray(data.chats)){chats=data.chats.filter(x=>Array.isArray(x.messages)).slice(0,40);currentId=data.currentId||''}}catch(_){}
 if(!chats.length){let previous=[];try{previous=JSON.parse(sessionStorage.getItem(oldKey)||'[]')}catch(_){};const first=makeChat(Array.isArray(previous)?previous:[]);chats=[first];currentId=first.id}
 const current=()=>chats.find(x=>x.id===currentId);
 if(!current())currentId=chats[0].id;
 conversation=current().messages;
 const save=()=>{const chat=current();if(chat){chat.messages=conversation;chat.updated=Date.now();if(chat.title==='New chat'&&conversation.length)chat.title=conversation.find(x=>x.role==='user')?.content?.slice(0,65)||chat.title}try{localStorage.setItem(storeKey,JSON.stringify({chats:chats.slice(0,40),currentId}))}catch(_){}};
 save();

 const usageKey='jj-ai-daily-requests-v1';
 const utcDay=()=>new Date().toISOString().slice(0,10);
 const readUsage=()=>{try{const x=JSON.parse(localStorage.getItem(usageKey)||'{}');return x.day===utcDay()?x:{day:utcDay(),success:0,attempts:0,limited:false}}catch(_){return {day:utcDay(),success:0,attempts:0,limited:false}}};
 const recordUsage=(kind)=>{const x=readUsage();if(kind==='attempt')x.attempts++;if(kind==='success')x.success++;if(kind==='limited')x.limited=true;try{localStorage.setItem(usageKey,JSON.stringify(x))}catch(_){}};
 const studyKey='jj-ai-study-v1';
 let study={bookmarks:[],queue:[]};
 try{const v=JSON.parse(localStorage.getItem(studyKey)||'{}');if(Array.isArray(v.bookmarks))study.bookmarks=v.bookmarks;if(Array.isArray(v.queue))study.queue=v.queue}catch(_){}
 const saveStudy=()=>{try{localStorage.setItem(studyKey,JSON.stringify(study))}catch(_){}};
 const prompts=['Which original lessons support this answer?','Compare JJ explanations across lessons and identify contradictions.','What information is still unverified?'];
 // Only public Academy chapter metadata enters page context; never send browser state or private notes.
 const pageSlug=new URLSearchParams(location.search).get('jj_context')||'';
 const pageChapter=typeof chapters!=='undefined'?chapters.find(x=>x.slug===pageSlug):null;
 const pageTitle=pageChapter?.title||(pageSlug==='youtube-library'?'YouTube Research Library':'');
 const pageQuestions=pageChapter?[
  'Explain the core rules in '+pageTitle+'.',
  'Which original lessons support '+pageTitle+'?',
  'What is unverified or contradictory in '+pageTitle+'?'
 ]:pageSlug==='youtube-library'?[
  'Which JJ YouTube lessons have verified transcript evidence?',
  'Compare public YouTube explanations with the Academy lessons.'
 ]:[];

 function tradeArithmetic(q){const amounts=q.split('$').slice(1).map(x=>Number((x.match(/^[0-9,]+/)||[''])[0].replaceAll(',',''))).filter(x=>x>0);if(amounts.length!==2||!q.toLowerCase().includes('loss')||!q.toLowerCase().includes('win'))return '';const net=amounts[1]-amounts[0];return 'Independent scenario check, assuming loss then gross win: -$'+amounts[0]+' + $'+amounts[1]+' = '+(net<0?'-$':'$')+Math.abs(net)+' net before fees. Not a full audit.';}
 function renderAnswer(target,value,sourceList=[]){
  target.replaceChildren();
  let text=String(value||'').replace(/\r/g,'').replace(/\*\*([^*\n]+)\*\*/g,'\n$1\n');
  const headings=['STRATEGY FOR NEW FUNDED ACCOUNTS','ACCOUNT MANAGEMENT AND CORRELATION','TRADE CAPACITY AND ASSIGNMENT','RISK MANAGEMENT','FIRST TRADE','SECOND TRADE','SUMMARY','LIMITATIONS'];
  for(const title of headings){
   text=text.split(title).join('\n'+title+'\n');
  }
  const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  for(const line of lines){
   const isHeading=headings.includes(line.toUpperCase())||
    (/^[A-Z][A-Za-z0-9 /&–—:'-]{5,75}$/.test(line)&&line.length<76&&
     !/[.!?;]$/.test(line)&&line.split(/\\s+/).length<=9);
   const node=el(isHeading?'h4':'p','');
   const parts=line.replace(/^[-*]\s+/,'• ').split(/(\[\d+\])/g);
   for(const part of parts){
    const number=/^\[(\d+)\]$/.exec(part);
    const source=number&&sourceList[Number(number[1])-1];
    if(source&&(source.url||source.chapter)){
     const link=el('a','jj-ai-citation',part);
     link.title=source.title||'Academy source';
     if(source.url){link.href=source.url;link.target='_blank';link.rel='noopener noreferrer'}
     else link.href='?topic='+encodeURIComponent(source.chapter);
     node.append(link);
    }else node.append(document.createTextNode(part));
   }
   target.append(node);
  }
 }
 const privateExcerpts=[];
 // IndexedDB retains imported transcript excerpts on this device without publishing
 // course text to GitHub or making it publicly accessible through Cloudflare Pages.
 const transcriptDB='jj-academy-private-transcripts-v1';
 function transcriptStore(mode,fn){
  return new Promise((resolve,reject)=>{
   if(!('indexedDB' in window)){reject(Error('IndexedDB unavailable'));return}
   const request=indexedDB.open(transcriptDB,1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('excerpts'))request.result.createObjectStore('excerpts',{keyPath:'id'})};
   request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{
    const db=request.result,tx=db.transaction('excerpts',mode),store=tx.objectStore('excerpts');
    let result;
    try{result=fn(store)}catch(e){db.close();reject(e);return}
    tx.oncomplete=()=>{db.close();resolve(result)};
    tx.onerror=()=>{db.close();reject(tx.error)};
   };
  });
 }
 async function loadPrivateExcerpts(){
  const entries=[];
  await transcriptStore('readonly',store=>{const cursor=store.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){entries.push(c.value);c.continue()}}});
  privateExcerpts.splice(0,privateExcerpts.length,...entries);
  return entries.length;
 }
 async function persistPrivateExcerpts(entries){
  await transcriptStore('readwrite',store=>{for(const entry of entries)store.put(entry)});
 }

 function archiveHits(question,limit=12){
  const base=jjHelperSearch(question);
  const extra=typeof jjHelperDocuments==='function'?jjHelperDocuments():[];
  const words=[...new Set(String(question).toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>3&&!['what','when','where','which','about','could','would','does','have','across','every','explain','compare','lessons','sources'].includes(x)))];
  const ranked=extra.map(d=>{
   const title=String(d.title||'').toLowerCase(),content=String(d.searchText||'').toLowerCase();
   const count=words.filter(w=>title.includes(w)||content.includes(w)).length;
   return {...d,score:count*4+words.filter(w=>title.includes(w)).length*7+(d.quoted?3:0),match:count};
  }).filter(d=>d.match>=Math.min(2,words.length)&&d.match>0).sort((a,b)=>b.score-a.score);
  const local=privateExcerpts.map(d=>{const t=(d.title+' '+d.text).toLowerCase();const count=words.filter(w=>t.includes(w)).length;return {...d,score:count*6,match:count}}).filter(d=>d.match>0).sort((a,b)=>b.score-a.score);
  const combined=[...local,...base,...ranked],seen=new Set();
  return combined.filter(d=>{if(seen.has(d.id))return false;seen.add(d.id);return true}).slice(0,limit);
 }
 function selectHits(question){
  const hits=archiveHits(question,12);
  if(!/funded|first two trades|second trade|after a loss|50.point/i.test(question))return hits.slice(0,12);
  const filtered=hits.filter(hit=>!/opening candle|opening range|continuation window/i.test(hit.title+' '+hit.text));
  return (filtered.length?filtered:hits).slice(0,12);
 }

 function init(){
  const root=document.getElementById('jj-helper-app');
  if(!root||root.querySelector('#jj-cloudflare-ai'))return;
  const form=root.querySelector('.jj-helper-form');
  if(!form)return;
  const actions=form.querySelector('.jj-helper-form-actions');
  const button=el('button','jj-ai-button','Ask Cloudflare AI');button.type='button';button.disabled=false;
  button.title='Optional AI synthesis from the top indexed Academy summaries. No full private transcripts are sent.';
  actions.insertBefore(button,actions.firstChild);
  const reset=el('button','jj-ai-reset','New chat');reset.type='button';reset.title='Create a new chat without deleting previous conversations';actions.append(reset);
  const panel=el('section','jj-ai-panel');panel.id='jj-cloudflare-ai';
  panel.hidden=true;
  const status=el('p','jj-ai-status','');
  const usage=el('div','jj-ai-usage');const usageLabel=el('span','','');const usageDetails=el('details','jj-ai-usage-details');usageDetails.append(el('summary','','ⓘ'),el('p','','Browser-only count since this feature was added. Cloudflare account Neurons and remaining quota are not available. Resets at 00:00 UTC.'));usageDetails.title='How AI usage is counted';usage.append(usageLabel,usageDetails);
  const refreshUsage=()=>{const x=readUsage();usageLabel.textContent=(x.limited?'Free limit reached · ':'AI today · ')+x.success+' answers / '+x.attempts+' attempts';};
  refreshUsage();
  const answer=el('div','jj-ai-answer');answer.setAttribute('aria-live','polite');
  const sources=el('div','jj-ai-sources');
  const thread=el('div','jj-ai-thread');
  const history=el('details','jj-ai-history');const historyTitle=el('summary','','Earlier conversation');history.append(historyTitle);
  const library=el('details','jj-ai-chat-library');const libraryTitle=el('summary','','Saved chats');const chatList=el('div','jj-ai-chat-list');library.append(libraryTitle,chatList);

  const studyPanel=el('details','jj-ai-tools'),studyBody=el('div','jj-ai-tools-body');
  studyPanel.append(el('summary','','Study tools · saved answers & research queue'),studyBody);
  const setQuestion=q=>{const input=form.querySelector('textarea');if(input){input.value=q;input.focus()}};
  const drawStudy=()=>{
   studyBody.replaceChildren();
   studyBody.append(el('strong','','Saved answers · '+study.bookmarks.length));
   for(const b of [...study.bookmarks].reverse()){
    const row=el('div','jj-ai-tool-row');row.append(el('span','',b.category+' · '+b.question));
    const open=el('button','','Open');open.type='button';open.onclick=()=>{const c=chats.find(x=>x.id===b.chatId);if(c){currentId=c.id;conversation=c.messages;save();drawChats();drawThread();studyPanel.open=false}else setQuestion(b.question)};
    const remove=el('button','','Remove');remove.type='button';remove.onclick=()=>{study.bookmarks=study.bookmarks.filter(x=>x.id!==b.id);saveStudy();drawStudy()};
    row.append(open,remove);studyBody.append(row);
   }
   studyBody.append(el('strong','','Unanswered questions · '+study.queue.length));
   for(const q of [...study.queue].reverse()){
    const row=el('div','jj-ai-tool-row');row.append(el('span','',q.question+' · pending'));
    const revisit=el('button','','Revisit');revisit.type='button';revisit.onclick=()=>setQuestion(q.question);
    const remove=el('button','','Remove');remove.type='button';remove.onclick=()=>{study.queue=study.queue.filter(x=>x!==q);saveStudy();drawStudy()};
    row.append(revisit,remove);studyBody.append(row);
   }
   studyBody.append(el('small','','Saved locally. When the Academy private review opt-in is enabled and its endpoint is configured, questions are submitted through the existing verified research queue.'));
  };
  const queueQuestion=(question,reason)=>{
   if(!question)return;
   if(!study.queue.some(x=>x.question===question)){study.queue.push({question,reason});study.queue=study.queue.slice(-100);saveStudy();drawStudy()}
   // Reuse the Academy's existing opt-in, receipt-verified private research queue.
   // jjQueueAdd itself checks consent and whether a private endpoint is configured.
   if(typeof jjQueueAdd==='function')jjQueueAdd(question,reason,0);
  };
  const archive=el('details','jj-ai-archive');
  const archiveTitle=el('summary','','Archive search · indexed excerpts');
  const archiveResults=el('div','jj-ai-archive-results');
  const archiveSearch=el('button','','Search all indexed entries');archiveSearch.type='button';
  archiveSearch.onclick=()=>{
   const q=form.querySelector('textarea')?.value.trim()||[...conversation].reverse().find(x=>x.role==='user')?.content||'';
   archiveResults.replaceChildren();
   if(!q){archiveResults.append(el('p','','Enter a question to search the indexed archive.'));return}
   const results=archiveHits(q,30);
   archiveTitle.textContent='Archive search · '+results.length+' indexed matches';
   if(!results.length)archiveResults.append(el('p','','No indexed matches. Raw Drive transcripts are not searched by this feature.'));
   for(const d of results){
    const item=el('details','jj-ai-archive-item');item.append(el('summary','',d.title+' · '+d.type));
    item.append(el('p','',d.quoted||d.text||''));
    if(d.footnote)item.append(el('small','',d.footnote));
    if(d.sourceUrl){const link=el('a','','Original source');link.href=d.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';item.append(link)}
    archiveResults.append(item);
   }
  };
  const importLabel=el('label','jj-ai-import-label','Import private .txt/.vtt/.srt transcript (saved on this device)');
  const importInput=el('input','jj-ai-import-input');importInput.type='file';importInput.accept='.txt,.vtt,.srt,text/plain';importInput.multiple=true;
  const importStatus=el('small','','Private transcripts are stored in this browser, not GitHub. Archive search stays local; asking AI may send selected excerpts to Cloudflare.');
  importInput.onchange=async()=>{
   let added=0;const newEntries=[];
   for(const file of [...importInput.files].slice(0,20)){
    if(file.size>3000000){importStatus.textContent='Skipped '+file.name+': file exceeds 3 MB';continue}
    const raw=await file.text();
    const clean=raw.replace(/^WEBVTT[^\\n]*$/gm,'').replace(/^\\d+$/gm,'').replace(/^\\d\\d:\\d\\d:\\d\\d[.,]\\d+\\s*-->.*$/gm,'').replace(/<[^>]+>/g,'').trim();
    for(let offset=0;offset<clean.length;offset+=1800){
     const chunk=clean.slice(offset,offset+2100).trim();
     if(chunk.length<35)continue;
     newEntries.push({id:'local:'+file.name+':'+offset,type:'Private transcript · browser private',title:file.name+' · excerpt '+(Math.floor(offset/1800)+1),text:chunk,quoted:chunk,searchText:chunk,sourceUrl:'',footnote:'Local import; source timestamp not verified'});
     added++;
    }
   }
   try{await persistPrivateExcerpts(newEntries);await loadPrivateExcerpts();importStatus.textContent=added+' excerpts indexed and saved privately on this device. AI may transmit matching excerpts to Cloudflare when asked.'}catch(e){privateExcerpts.push(...newEntries);importStatus.textContent=added+' excerpts indexed for this tab only; private storage failed: '+e.message}
   importInput.value='';
  };
  loadPrivateExcerpts().then(n=>{importStatus.textContent=n+' private excerpts available on this device. Search locally, or ask AI (selected excerpts may be sent to Cloudflare).'}).catch(()=>{importStatus.textContent='Private browser storage unavailable; imports last for this tab only.'});
  const coverage=el('small','jj-ai-coverage','Knowledge coverage · checking local index…');
  const updateCoverage=()=>{
   const names=new Set(privateExcerpts.map(x=>x.title.replace(/ · excerpt .*$/,'')));
   const queue=typeof jjQueueRead==='function'?jjQueueRead().filter(x=>x.status!=='resolved'):[];
   coverage.textContent='Knowledge coverage · '+names.size+' imported transcripts · '+privateExcerpts.length+' searchable excerpts · '+queue.length+' open research questions · private Drive sync not connected';
  };
  loadPrivateExcerpts().then(updateCoverage).catch(updateCoverage);
  const originalImport=importInput.onchange;
  importInput.onchange=async()=>{await originalImport();updateCoverage()};
  importLabel.append(importInput);
  archive.append(archiveTitle,coverage,archiveSearch,importLabel,importStatus,archiveResults);
  // One compact collapsible tools drawer, with the conversation always visible.
  const drawer=el('details','jj-ai-unified-tools');
  const drawerTitle=el('summary','','Chat tools · history, saved answers & archive');
  const drawerBody=el('div','jj-ai-unified-body');
  const recent=document.getElementById('jj-recent-questions');
  if(recent)drawerBody.append(recent);
  drawerBody.append(library,studyPanel,archive);
  drawer.append(drawerTitle,drawerBody);
  panel.append(drawer,el('strong','','JJ Academy AI · conversation'),usage,status,thread,answer,sources,history);
  if(pageQuestions.length){
   const contextPanel=el('details','jj-ai-page-context');
   contextPanel.open=true;
   contextPanel.append(el('summary','','This page · '+pageTitle));
   const options=el('div','jj-ai-page-questions');
   for(const q of pageQuestions){
    const suggestion=el('button','',q);suggestion.type='button';
    suggestion.onclick=()=>setQuestion(q);
    options.append(suggestion);
   }
   contextPanel.append(options);
   panel.insertBefore(contextPanel,thread);
   const pageCss=el('style');pageCss.textContent='.jj-ai-page-context{border:1px solid var(--stroke);border-radius:7px;padding:6px 9px;margin:5px 0;font-size:11px}.jj-ai-page-context summary{cursor:pointer;color:var(--accent);font-weight:650}.jj-ai-page-questions{display:flex;flex-wrap:wrap;gap:5px;padding-top:6px}.jj-ai-page-questions button{font:inherit;font-size:10px;background:var(--panel);color:var(--text);border:1px solid var(--stroke);border-radius:6px;padding:6px 8px;cursor:pointer}';
   document.head.append(pageCss);
  }
  const showLatest=()=>{
   answer.replaceChildren();sources.replaceChildren();drawThread();
   const latest=conversation[conversation.length-1];
   if(latest?.role==='assistant'){status.textContent='Saved conversation · Ask a follow-up below.'}
   else status.textContent='Select a saved conversation or ask a question below.';
  };
  const drawChats=()=>{
   chatList.replaceChildren();libraryTitle.textContent='Saved chats · '+chats.length;
   for(const chat of [...chats].sort((a,b)=>b.updated-a.updated)){
    const item=el('div','jj-ai-chat-item');
    const open=el('button','jj-ai-chat-open',chat.title||'New chat');open.type='button';if(chat.id===currentId)open.classList.add('active');
    open.onclick=()=>{if(busy)return;save();currentId=chat.id;conversation=chat.messages;save();drawChats();showLatest();library.open=false};
    const rename=el('button','jj-ai-chat-action','Rename');rename.type='button';rename.onclick=()=>{if(busy)return;const title=prompt('Chat title',chat.title);if(title?.trim()){chat.title=title.trim().slice(0,90);save();drawChats()}};
    const remove=el('button','jj-ai-chat-action','Delete');remove.type='button';remove.onclick=()=>{if(busy||!confirm('Delete this saved chat?'))return;chats=chats.filter(x=>x.id!==chat.id);if(!chats.length)chats=[makeChat()];if(currentId===chat.id){currentId=chats[0].id;conversation=chats[0].messages;showLatest()}save();drawChats()};
    item.append(open,rename,remove);chatList.append(item);
   }
  };
  drawChats();
  drawStudy();
  const drawThread=()=>{
   thread.replaceChildren();
   history.hidden=true;
   for(let i=0;i<conversation.length;i++){
    const turn=conversation[i];
    const item=el('article','jj-ai-turn jj-ai-'+turn.role);
    item.append(el('strong','',turn.role==='user'?'You':'JJ Academy AI'));
    if(turn.role==='assistant'){
     const body=el('div','jj-ai-answer');renderAnswer(body,turn.content,turn.sources||[]);item.append(body);

     const evidence=el('div','jj-ai-evidence',turn.sources?.length?'Source passages available · AI synthesis, not independently verified':'No saved source passages · verify original lessons');
     item.append(evidence);
     if(turn.mathNote)item.append(el('div','jj-ai-math',turn.mathNote));
     const actions=el('div','jj-ai-message-actions');
     const saveButton=el('button','','☆ Save');saveButton.type='button';saveButton.onclick=()=>{
      const question=conversation.slice(0,i).reverse().find(x=>x.role==='user')?.content||'Untitled';
      const category=prompt('Category:', 'General');
      if(category===null)return;
      study.bookmarks.push({id:Date.now()+'-'+Math.random(),chatId:currentId,question,category:(category.trim()||'General').slice(0,50)});
      study.bookmarks=study.bookmarks.slice(-100);saveStudy();drawStudy();saveButton.textContent='✓ Saved';
     };
     const compare=el('button','','Compare lessons');compare.type='button';compare.onclick=()=>{const q=conversation.slice(0,i).reverse().find(x=>x.role==='user')?.content||'this topic';setQuestion('Compare JJ explanations across lessons about '+q+'. Show differences and contradictions with citations.')};
     const flag=el('button','','Needs research');flag.type='button';flag.onclick=()=>{const q=conversation.slice(0,i).reverse().find(x=>x.role==='user')?.content||'Unknown question';queueQuestion(q,'Manually flagged');flag.textContent='✓ Queued'};
     actions.append(saveButton,compare,flag);item.append(actions);
     if(turn.sources?.length){
      const details=el('details','jj-ai-message-sources');
      details.append(el('summary','','Sources · '+turn.sources.length));
      for(let i=0;i<turn.sources.length;i++){
       const source=turn.sources[i],line=el('div','');
       const link=el('a','', '['+(i+1)+'] '+(source.title||'Academy source'));
       if(source.url){link.href=source.url;link.target='_blank';link.rel='noopener noreferrer'}
       else if(source.chapter)link.href='?topic='+encodeURIComponent(source.chapter);
       else{line.textContent=link.textContent;details.append(line);continue}
       line.append(link);details.append(line);
      }
      item.append(details);
     }
    }else item.append(el('p','',turn.content));
    thread.append(item);
   }
   if(conversation[conversation.length-1]?.role==='assistant'){
    const follow=el('div','jj-ai-followups');follow.append(el('strong','','Explore further'));
    for(const p of prompts){const b=el('button','',p);b.type='button';b.onclick=()=>setQuestion(p);follow.append(b)}
    thread.append(follow);
   }
   panel.hidden=false;
   // Only the conversation pane scrolls; do not move the whole website.
   const toLatest=()=>{thread.scrollTop=thread.scrollHeight};
   toLatest();
   requestAnimationFrame(()=>{toLatest();requestAnimationFrame(toLatest)});

   status.textContent=conversation.length?'Conversation saved locally · Ask a follow-up below.':'Ask a question to start a conversation.';
  };
  drawThread();
  if(conversation.length){panel.hidden=false;drawThread()}
  reset.addEventListener('click',()=>{if(busy)return;save();const chat=makeChat();chats.unshift(chat);currentId=chat.id;conversation=chat.messages;save();drawChats();showLatest();const input=form.querySelector('textarea');input.value='';input.placeholder='Ask a question about JJ’s trading course…';input.focus()});
  const result=root.querySelector('#jj-helper-results');
  if(result)result.before(panel);else root.append(panel);
  panel.after(form);
  button.addEventListener('click',async()=>{
   if(busy)return;
   const question=form.querySelector('textarea')?.value.trim()||'';
   if(!question){panel.hidden=false;status.textContent='Please enter a question first.';return}
   jjHelperQuestion=question;
   const previousQuestion=[...conversation].reverse().find(m=>m.role==='user');
   const contextQuery=previousQuestion?previousQuestion.content+' '+question:question;
   const contextualQuestion=pageTitle&&!question.toLowerCase().includes(pageTitle.toLowerCase())?pageTitle+' '+question:question;
   const primaryHits=selectHits(question);
   const contextHits=previousQuestion?selectHits(contextQuery):[];
   const pageHits=pageTitle?selectHits(contextualQuestion).filter(x=>x.chapter===pageSlug||x.searchText?.toLowerCase().includes(pageTitle.toLowerCase())):[];
   const previousHits=previousQuestion?selectHits(previousQuestion.content):[];
   const hits=[...pageHits,...primaryHits,...contextHits,...previousHits].filter((hit,index,all)=>all.findIndex(x=>x.id===hit.id)===index).slice(0,8);
   panel.hidden=false;sources.replaceChildren();
   if(!hits.length){queueQuestion(question,'No source matches');status.textContent='No source matches. Saved to local research queue; no AI request made.';return}
   busy=true;button.disabled=true;reset.disabled=true;button.textContent='Asking AI…';
   recordUsage('attempt');refreshUsage();
   conversation.push({role:'user',content:question.slice(0,750)});save();drawThread();drawChats();
   status.textContent='Thinking… · '+Math.min(hits.length,8)+' Academy sources';
   try{
    const payload={
     question:(pageTitle?'Current Academy page: '+pageTitle+'. User question: ':'')+question.slice(0,650),history:conversation.slice(0,-1).slice(-6),
     sources:hits.slice(0,8).map(hit=>({
      title:hit.title,type:hit.type,summary:[hit.quoted?'Transcript excerpt: '+hit.quoted:'',hit.text].filter(Boolean).join(' | '),
      limitation:hit.footnote||''
     }))
    };
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),20000);
    let response;
    try{response=await fetch(API,{
     method:'POST',headers:{'content-type':'application/json'},
     credentials:'same-origin',body:JSON.stringify(payload),signal:controller.signal
    })}finally{clearTimeout(timeout)}
    let data={};
    try{data=await response.json()}catch(_){}
    if(!response.ok)throw Error([data.message||data.error||'AI endpoint unavailable',data.code?'Code: '+data.code:'',data.detail||''].filter(Boolean).join(' · '));
    status.textContent='AI synthesis of indexed Academy research. Verify original lesson evidence; assumptions are not actual JJ performance.';
    const citedSources=hits.slice(0,8).map(hit=>({title:hit.title,url:hit.sourceUrl||'',chapter:hit.chapter||''}));
    recordUsage('success');refreshUsage();
    const responseText=String(data.answer||'').slice(0,6500);
    conversation.push({role:'assistant',content:responseText,sources:citedSources,mathNote:tradeArithmetic(question)});
    if(/not documented|insufficient evidence|cannot verify|not specified|unknown from/i.test(responseText))queueQuestion(question,'Evidence gap');
    save();drawThread();drawChats();
    answer.replaceChildren();sources.replaceChildren();
    const questionBox=form.querySelector('textarea');if(questionBox){questionBox.value='';questionBox.placeholder='Ask a follow-up about this conversation…'}

   }catch(error){
    const message=String(error?.message||'AI unavailable');
    status.textContent=/abort/i.test(message)?'AI request timed out.':message;
    const code=/FREE_TIER_LIMIT|quota|neurons|429/i.test(message);if(code){recordUsage('limited');refreshUsage()}status.textContent=code?'Daily free AI allowance reached. Try again after 00:00 UTC. Academy course search remains available.':status.textContent;const notice=el('div','jj-ai-error',code?'Daily free AI allowance reached. Your chats remain saved; try again after the daily reset.':'AI could not answer this time. '+message);thread.append(notice);
   }finally{busy=false;button.disabled=false;reset.disabled=false;button.textContent='Ask Cloudflare AI'}
  });
  form.addEventListener('submit',()=>{panel.hidden=false});
  const input=form.querySelector('textarea');if(input)input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();button.click()}});
 }

 // One shared AI experience on every Academy chapter. The floating view uses
 // this same page and same-origin storage; it never starts an AI call merely by opening.
 const jjRoute=new URLSearchParams(location.search);
 const floatMode=jjRoute.get('jj_ai_float')==='1';
 const mobileChatMode=jjRoute.get('jj_ai_mobile')==='1';
 const compactMode=floatMode||mobileChatMode;
 const mobileDevice=()=>window.matchMedia('(max-width:600px) and (pointer:coarse)').matches;
 if(compactMode){
  const compact=el('style');compact.textContent=`
   html,body{height:100%;overflow:hidden!important;background:var(--bg)!important}
   header,aside,.jj-helper-app > :not(.jj-ai-panel):not(.jj-helper-form){display:none!important}
   .layout,main,#chapters{display:block!important;min-height:0!important;width:100%!important;margin:0!important;padding:0!important;max-width:none!important}
   .jj-helper-app,.chapter{border:0!important;border-radius:0!important;box-shadow:none!important;margin:0!important;padding:0!important;background:var(--bg)!important}
   .jj-helper-app{display:flex!important;flex-direction:column!important;height:100dvh!important;min-height:0!important}
   #jj-cloudflare-ai{display:flex!important;flex:1 1 auto!important;flex-direction:column!important;min-height:0!important;overflow:auto!important;padding:9px!important;margin:0!important;border:0!important}
   #jj-cloudflare-ai .jj-ai-thread{flex:1 1 auto!important;min-height:100px!important;max-height:none!important;overflow:auto!important}
   #jj-cloudflare-ai .jj-ai-answer,#jj-cloudflare-ai .jj-ai-sources{max-height:25vh;overflow:auto}
   .jj-helper-form{flex:0 0 auto!important;padding:8px!important;background:var(--panel)!important;border-top:1px solid var(--stroke)!important;margin:0!important}
   .jj-helper-form textarea{min-height:54px!important;height:54px!important;font-size:12px!important}
   .jj-helper-form-actions > :not(.jj-ai-button):not(.jj-ai-reset){display:none!important}
   .jj-helper-form-actions{gap:6px!important}
   .jj-helper-form-actions button{min-height:32px!important;padding:6px 9px!important;font-size:11px!important}
   @media(max-width:1024px), (pointer:coarse){
    #jj-helper-app{height:var(--jj-chat-vh,100dvh)!important;max-height:var(--jj-chat-vh,100dvh)!important}
    #jj-cloudflare-ai{overflow:hidden!important;padding:6px!important}
    #jj-cloudflare-ai>.jj-ai-thread{flex:1 1 auto!important;height:auto!important;min-height:0!important;max-height:none!important;overflow-y:auto!important}
    #jj-helper-app>.jj-helper-form{flex:0 0 auto!important;min-height:0!important;padding:7px 9px calc(7px + env(safe-area-inset-bottom))!important;margin:0!important;gap:6px!important}
    #jj-helper-app>.jj-helper-form textarea{font-size:16px!important;line-height:1.4!important;height:60px!important;min-height:60px!important;max-height:90px!important;resize:none!important;touch-action:auto!important;pointer-events:auto!important}
    #jj-helper-app>.jj-helper-form .jj-helper-form-actions{display:flex!important;flex-direction:row!important;gap:7px!important}
    #jj-helper-app>.jj-helper-form .jj-helper-form-actions>.jj-ai-button{flex:1 1 auto!important;width:auto!important;min-width:0!important;grid-column:auto!important;font-size:12px!important;min-height:40px!important}
    #jj-helper-app>.jj-helper-form .jj-helper-form-actions>.jj-ai-reset{flex:0 0 auto!important;width:auto!important;grid-column:auto!important;min-height:40px!important}
    #jj-helper-app>.jj-helper-form .jj-helper-form-actions>button[type=submit]{display:none!important}
    #jj-cloudflare-ai>.jj-ai-unified-tools{flex:0 0 auto!important}
   }
  `;document.head.append(compact);
  if(mobileChatMode){
   document.documentElement.dataset.jjMobileChat='true';
   const updateViewport=()=>{
    const viewport=window.visualViewport;
    const height=viewport?viewport.height:window.innerHeight;
    document.documentElement.style.setProperty('--jj-chat-vh',Math.max(200,Math.floor(height))+'px');
   };
   updateViewport();
   window.visualViewport?.addEventListener('resize',updateViewport);
   window.addEventListener('resize',updateViewport);
   const bar=el('div','jj-mobile-chat-bar');
   const back=el('button','','‹ Back');back.type='button';
   back.onclick=()=>{if(history.length>1)history.back();else location.href='./'};
   bar.append(back,el('strong','','✦ JJ Academy AI'));
   document.body.append(bar);
   const barStyle=el('style');barStyle.textContent=`
    body{padding-top:43px!important}
    .jj-mobile-chat-bar{position:fixed;top:0;left:0;right:0;height:43px;z-index:9999;display:flex;align-items:center;gap:10px;padding:5px 10px;background:var(--panel);border-bottom:1px solid var(--stroke);color:var(--text)}
    .jj-mobile-chat-bar button{background:transparent;border:1px solid var(--stroke);color:var(--text);border-radius:7px;padding:6px 10px;font-size:12px}
    .jj-mobile-chat-bar strong{font-size:13px}
    #jj-helper-app{height:calc(var(--jj-chat-vh,100dvh) - 43px)!important;max-height:calc(var(--jj-chat-vh,100dvh) - 43px)!important}
    #jj-cloudflare-ai>.jj-ai-page-context{flex:0 0 auto!important;max-height:110px;overflow:auto}
   `;document.head.append(barStyle);
  }
  // Detach chat from chapter/section layout. The chapter's grid and overflow
  // rules previously pushed the composer below the visible viewport on touch devices.
  init();
  const chatRoot=document.getElementById('jj-helper-app');
  if(chatRoot){
   document.body.append(chatRoot);
   const panel=chatRoot.querySelector('#jj-cloudflare-ai');
   if(panel)panel.hidden=false;
  }
  const isolated=el('style');isolated.textContent=`
    body>#jj-helper-app{position:fixed!important;inset:0!important;z-index:9998!important;
      width:100vw!important;max-width:100vw!important;height:var(--jj-chat-vh,100dvh)!important;
      min-height:0!important;margin:0!important;padding:0!important;border:0!important;
      display:flex!important;flex-direction:column!important;overflow:hidden!important;background:var(--bg)!important}
    body>#jj-helper-app>#jj-cloudflare-ai{flex:1 1 0!important;min-height:0!important;max-height:none!important;
      overflow-y:auto!important;overscroll-behavior:contain!important}
    body>#jj-helper-app>.jj-helper-form{display:flex!important;position:relative!important;bottom:auto!important;
      flex:0 0 auto!important;z-index:2!important;margin:0!important;border:0!important;
      border-top:1px solid var(--stroke)!important;border-radius:0!important;background:var(--panel)!important}
    body>#jj-helper-app>.jj-helper-form textarea{display:block!important;visibility:visible!important;opacity:1!important;
      position:relative!important;pointer-events:auto!important;touch-action:auto!important;z-index:3!important}
    body>#jj-helper-app #jj-cloudflare-ai>.jj-ai-thread{flex:1 1 auto!important;min-height:0!important;max-height:none!important;
      overflow-y:auto!important;overscroll-behavior:contain!important}
    html[data-jj-mobile-chat=true] body>#jj-helper-app{top:43px!important;bottom:auto!important;
      height:calc(var(--jj-chat-vh,100dvh) - 43px)!important}
    @media(max-width:1024px),(pointer:coarse){
      body>#jj-helper-app>.jj-helper-form textarea{font-size:16px!important;min-height:56px!important;height:56px!important}
      body>#jj-helper-app>.jj-helper-form .jj-helper-form-actions{display:flex!important;grid-template-columns:none!important}
      body>#jj-helper-app>.jj-helper-form .jj-helper-form-actions>button{grid-column:auto!important}
      body>#jj-helper-app>.jj-helper-form .jj-helper-form-actions>.jj-ai-button{flex:1!important;min-width:0!important}
    }
  `;document.head.append(isolated);
 }else{
  const open=el('button','jj-ai-float-launch','✦ Ask JJ AI');
  open.type='button';open.setAttribute('aria-label','Open JJ Academy AI consultant');
  open.title='Ask JJ Academy AI on any chapter';
  const shell=el('section','jj-ai-float-shell');shell.hidden=true;
  shell.setAttribute('role','dialog');shell.setAttribute('aria-label','JJ Academy AI consultant');
  const bar=el('div','jj-ai-float-bar');
  const heading=el('strong','','✦ JJ Academy AI');
  const full=el('button','','Full page');full.type='button';full.title='Open the full Study Assistant';
  full.onclick=()=>{location.href='?topic='+encodeURIComponent(jjHelperSlug)};
  const close=el('button','','✕');close.type='button';close.title='Close AI consultant';close.setAttribute('aria-label','Close AI consultant');
  bar.append(heading,full,close);
  const frame=el('iframe','jj-ai-float-frame');
  frame.title='JJ Academy AI conversation';frame.setAttribute('loading','lazy');
  shell.append(bar,frame);document.body.append(open,shell);
  const show=(value)=>{
   shell.hidden=!value;open.setAttribute('aria-expanded',String(value));
   if(value){
    const chapter=typeof active==='string'&&active!==jjHelperSlug?active:'';
    const wanted='?topic='+encodeURIComponent(jjHelperSlug)+'&jj_ai_float=1'+(chapter?'&jj_context='+encodeURIComponent(chapter):'');
    if(mobileDevice()){
     const url='?topic='+encodeURIComponent(jjHelperSlug)+'&jj_ai_mobile=1'+(chapter?'&jj_context='+encodeURIComponent(chapter):'');
     location.assign(url);
     return;
    }
    if(frame.getAttribute('src')!==wanted)frame.src=wanted;
    close.focus();
   }else open.focus();
  };
  open.onclick=()=>show(shell.hidden);
  close.onclick=()=>show(false);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!shell.hidden)show(false)});
  const css=el('style');css.textContent=`
   .jj-ai-float-launch{position:fixed!important;bottom:18px!important;right:18px!important;z-index:10010!important;border:1px solid var(--accent)!important;border-radius:28px!important;background:var(--panel)!important;color:var(--accent)!important;font:700 12px system-ui,sans-serif!important;padding:11px 15px!important;box-shadow:0 6px 24px #0005!important;cursor:pointer!important}
   .jj-ai-float-shell[hidden]{display:none!important}
   .jj-ai-float-shell{position:fixed!important;bottom:70px!important;right:18px!important;z-index:10011!important;display:flex!important;flex-direction:column!important;width:min(420px,calc(100vw - 20px))!important;height:min(650px,calc(100dvh - 92px))!important;background:var(--bg)!important;border:1px solid var(--stroke)!important;border-radius:13px!important;box-shadow:0 14px 55px #0009!important;overflow:hidden!important}
   .jj-ai-float-bar{display:flex!important;align-items:center!important;gap:9px!important;flex:0 0 43px!important;padding:7px 10px!important;background:var(--panel)!important;border-bottom:1px solid var(--stroke)!important}
   .jj-ai-float-bar strong{flex:1!important;font-size:12px!important}
   .jj-ai-float-bar button{background:transparent!important;border:1px solid var(--stroke)!important;color:var(--text)!important;border-radius:6px!important;padding:6px 8px!important;font-size:11px!important;cursor:pointer!important}
   .jj-ai-float-frame{border:0!important;width:100%!important;flex:1 1 auto!important;min-height:0!important;background:var(--bg)!important}
   @media(min-width:601px) and (max-width:1180px){.jj-ai-float-shell{width:min(500px,calc(100vw - 24px))!important;height:min(720px,calc(100dvh - 90px))!important}}
   @media(max-width:600px){.jj-ai-float-launch{bottom:calc(10px + env(safe-area-inset-bottom))!important;right:10px!important;padding:9px 12px!important;font-size:11px!important}.jj-ai-float-shell{right:5px!important;bottom:calc(52px + env(safe-area-inset-bottom))!important;width:calc(100vw - 10px)!important;height:min(650px,calc(100dvh - 68px - env(safe-area-inset-bottom)))!important;border-radius:10px!important}}
   @media(prefers-reduced-motion:reduce){.jj-ai-float-shell,.jj-ai-float-launch{transition:none!important}}
  `;document.head.append(css);
 }

 const previous=render;
 render=function(){previous();if(active===jjHelperSlug)init()};
 if(active===jjHelperSlug)init();
})();
