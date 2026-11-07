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
 function selectHits(question){
  const hits=jjHelperSearch(question);
  if(!/funded|first two trades|second trade|after a loss|50.point/i.test(question))return hits.slice(0,5);
  const filtered=hits.filter(hit=>!/opening candle|opening range|continuation window/i.test(hit.title+' '+hit.text));
  return (filtered.length?filtered:hits).slice(0,5);
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
  const answer=el('div','jj-ai-answer');answer.setAttribute('aria-live','polite');
  const sources=el('div','jj-ai-sources');
  const thread=el('div','jj-ai-thread');
  const history=el('details','jj-ai-history');const historyTitle=el('summary','','Earlier conversation');history.append(historyTitle,thread);
  const library=el('details','jj-ai-chat-library');const libraryTitle=el('summary','','Saved chats');const chatList=el('div','jj-ai-chat-list');library.append(libraryTitle,chatList);
  panel.append(library,el('strong','','JJ Academy AI · conversation'),status,thread,answer,sources,history);
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
  const drawThread=()=>{
   thread.replaceChildren();
   history.hidden=true;
   for(const turn of conversation){
    const item=el('article','jj-ai-turn jj-ai-'+turn.role);
    item.append(el('strong','',turn.role==='user'?'You':'JJ Academy AI'));
    if(turn.role==='assistant'){
     const body=el('div','jj-ai-answer');renderAnswer(body,turn.content,turn.sources||[]);item.append(body);
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
   panel.hidden=false;
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
   const primaryHits=selectHits(question);
   const contextHits=previousQuestion?selectHits(contextQuery):[];
   const previousHits=previousQuestion?selectHits(previousQuestion.content):[];
   const hits=[...primaryHits,...contextHits,...previousHits].filter((hit,index,all)=>all.findIndex(x=>x.id===hit.id)===index).slice(0,5);
   panel.hidden=false;sources.replaceChildren();
   if(!hits.length){status.textContent='No new source matches found. Rephrase with a course topic to retrieve evidence before asking AI.';return}
   busy=true;button.disabled=true;reset.disabled=true;button.textContent='Asking AI…';
   status.textContent='Thinking… · '+Math.min(hits.length,5)+' Academy sources';
   try{
    const payload={
     question:question.slice(0,750),history:conversation.slice(-6),
     sources:hits.slice(0,5).map(hit=>({
      title:hit.title,type:hit.type,summary:hit.text,
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
    const citedSources=hits.slice(0,5).map(hit=>({title:hit.title,url:hit.sourceUrl||'',chapter:hit.chapter||''}));
    conversation.push({role:'user',content:question.slice(0,750)},{role:'assistant',content:String(data.answer||'').slice(0,6500),sources:citedSources});save();drawThread();drawChats();
    answer.replaceChildren();sources.replaceChildren();
    const questionBox=form.querySelector('textarea');if(questionBox){questionBox.value='';questionBox.placeholder='Ask a follow-up about this conversation…'}

   }catch(error){
    const message=String(error?.message||'AI unavailable');
    status.textContent=/abort/i.test(message)?'AI request timed out.':message;
    const code=/FREE_TIER_LIMIT|quota|neurons|429/i.test(message);status.textContent=code?'Daily free AI allowance reached. Try again after 00:00 UTC. Academy course search remains available.':status.textContent;const notice=el('div','jj-ai-error',code?'Daily free AI allowance reached. Your chats remain saved; try again after the daily reset.':'AI could not answer this time. '+message);thread.append(notice);
   }finally{busy=false;button.disabled=false;reset.disabled=false;button.textContent='Ask Cloudflare AI'}
  });
  form.addEventListener('submit',()=>{panel.hidden=false});
  const input=form.querySelector('textarea');if(input)input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();button.click()}});
 }
 const previous=render;
 render=function(){previous();if(active===jjHelperSlug)init()};
 if(active===jjHelperSlug)init();
})();
