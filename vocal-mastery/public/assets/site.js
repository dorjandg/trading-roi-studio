(() => {
 'use strict';
 const configElement=document.getElementById('site-config');
 let config={};try{config=JSON.parse(configElement?.textContent||'{}')}catch{}
 const lang=config.language||document.documentElement.lang||'en';
 const url=new URL(location.href);
 try{
  const stored=localStorage.getItem('vm-lang');
  if(!url.searchParams.has('lang')&&!url.pathname.startsWith('/manage')&&(stored==='en'||stored==='sq')&&stored!==lang){url.searchParams.set('lang',stored);location.replace(url.href);return;}
  localStorage.setItem('vm-lang',lang);
 }catch{}
 document.querySelectorAll('[data-language]').forEach(link=>link.addEventListener('click',()=>{try{localStorage.setItem('vm-lang',link.dataset.language)}catch{}}));
 const menuToggle=document.querySelector('.menu-toggle'), menu=document.getElementById('site-menu');
 const setMenu=open=>{if(!menu||!menuToggle)return;menu.hidden=!open;menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?(lang==='sq'?'Mbyll menunë':'Close menu'):(lang==='sq'?'Hap menunë':'Open menu'));document.body.classList.toggle('menu-open',open);document.querySelectorAll('#main,.site-footer').forEach(el=>{el.inert=open;});menuToggle.innerHTML=open?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';if(open)menu.querySelector('a')?.focus();};
 menuToggle?.addEventListener('click',()=>setMenu(menu.hidden));
 menu?.addEventListener('click',event=>{if(event.target===menu){setMenu(false);menuToggle?.focus();}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu&&!menu.hidden){setMenu(false);menuToggle?.focus();}});
 document.querySelectorAll('[data-video]').forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.video;if(!/^[\w-]{11}$/.test(id||''))return;
  const frame=document.createElement('iframe');frame.className='video-frame';frame.src=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;frame.title=button.dataset.videoTitle||'Video';frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';button.replaceWith(frame);
 }));
 const appForm=document.getElementById('application-form');
 if(appForm){const format=url.searchParams.get('format');if(['academy','online'].includes(format)){appForm.querySelectorAll('input[name="format"]').forEach(input=>{input.checked=input.dataset.formatKey===format;});}}
 appForm?.addEventListener('submit',event=>{
  event.preventDefault();if(!appForm.reportValidity())return;
  if(config.preview)return;
  const values=new FormData(appForm),labels=config.labels||{};
  const message=[config.applicationHeading,'',...['name','experience','program','format','goals'].map(key=>`${labels[key]||key}: ${String(values.get(key)||'').trim()}`)].join('\n');
  const phone=String(appForm.dataset.whatsapp||'355692085923').replace(/\D/g,'');
  location.assign(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
 });
 const panel=document.getElementById('chat-panel'),open=document.getElementById('chat-open'),close=document.getElementById('chat-close'),question=document.getElementById('chat-question'),chatForm=document.getElementById('chat-form'),messages=document.getElementById('chat-messages');
 const reset=document.getElementById('chat-reset'),greeting=document.getElementById('chat-greeting'),suggestions=panel?.querySelector('.chat-suggestions'),submit=chatForm?.querySelector('button[type="submit"]');
 let history=[],busy=false,frame=0,lockedX=0,lockedY=0,previousGeometry='',blocked=[];
 const root=document.documentElement;
 const mobile=()=>window.matchMedia('(pointer: coarse)').matches;
 const nearTail=()=>!messages||messages.scrollHeight-messages.clientHeight-messages.scrollTop<64;
 const tail=()=>{if(messages)messages.scrollTop=messages.scrollHeight;};
 const resizeQuestion=()=>{if(!question)return;question.style.height='auto';question.style.height=Math.min(question.scrollHeight, panel?.classList.contains('chat-compact')?64:112)+'px';};
 // Layout follows the actual visible browser area, not the full screen behind Android/iOS keyboards.
 function syncChatViewport(){
  frame=0;if(!panel||panel.hidden)return;
  const vv=window.visualViewport;
  const geometry=[Math.max(0,Math.round(vv?.offsetLeft||0)),Math.max(0,Math.round(vv?.offsetTop||0)),Math.max(1,Math.round(vv?.width||root.clientWidth)),Math.max(1,Math.round(vv?.height||window.innerHeight))];
  const key=geometry.join(':');if(key===previousGeometry)return;
  const follow=nearTail();previousGeometry=key;
  ['left','top','width','height'].forEach((name,i)=>panel.style.setProperty('--chat-vv-'+name,geometry[i]+'px'));
  panel.classList.toggle('chat-compact',geometry[3]<500);
  resizeQuestion();
  if(follow)tail();
 }
 const queueViewport=()=>{if(panel&&!panel.hidden&&!frame)frame=window.requestAnimationFrame(syncChatViewport);};
 function setChat(isOpen){
  if(!panel||config.preview||panel.hidden===!isOpen)return;
  if(isOpen){
   setMenu(false);lockedX=window.scrollX;lockedY=window.scrollY;previousGeometry='';
   document.body.style.setProperty('--chat-page-top',(-lockedY)+'px');
   root.classList.add('chat-locked');document.body.classList.add('chat-open');
   blocked=[...document.querySelectorAll('.site-header,#site-menu,#main,.site-footer,#chat-open')].map(el=>[el,el.inert]);
   blocked.forEach(([el])=>{el.inert=true;});
   panel.hidden=false;open?.setAttribute('aria-expanded','true');syncChatViewport();
   // Opening the conversation must not open the keyboard or scroll the page.
   close?.focus({preventScroll:true});
  }else{
   question?.blur();panel.hidden=true;open?.setAttribute('aria-expanded','false');
   if(frame)window.cancelAnimationFrame(frame);frame=0;previousGeometry='';
   blocked.forEach(([el,wasInert])=>{el.inert=wasInert;});blocked=[];
   document.body.classList.remove('chat-open');document.body.style.removeProperty('--chat-page-top');
   window.scrollTo(lockedX,lockedY);root.classList.remove('chat-locked');
   open?.focus({preventScroll:true});
  }
 }
 window.visualViewport?.addEventListener('resize',queueViewport);
 window.visualViewport?.addEventListener('scroll',queueViewport);
 window.addEventListener('resize',queueViewport);
 question?.addEventListener('input',resizeQuestion);
 open?.addEventListener('click',()=>setChat(true));close?.addEventListener('click',()=>setChat(false));
 panel?.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();setChat(false);return;}
  if(event.key==='Tab'){
   const nodes=[...panel.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled])')].filter(n=>!n.closest('[hidden]')&&n.getClientRects().length);
   const first=nodes[0],last=nodes.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus({preventScroll:true});}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus({preventScroll:true});}
  }
 });
 function addMessage(text,role,extra=''){
  const node=document.createElement('p');node.className=['chat-message',role,extra].filter(Boolean).join(' ');node.textContent=text;messages?.appendChild(node);return node;
 }
 reset?.addEventListener('click',()=>{
  if(busy)return;history=[];question.value='';resizeQuestion();
  messages?.querySelectorAll('.chat-message:not(#chat-greeting)').forEach(node=>node.remove());
  if(suggestions)suggestions.hidden=false;
  if(messages)messages.scrollTop=0;close?.focus({preventScroll:true});
 });
 function showReply(pending,text,extra=''){
  const follow=nearTail();pending.remove();
  const reply=addMessage(text,'assistant',extra);
  // If the user is reading an older message, don't pull them away.
  // Otherwise show the start of a long answer instead of its final line.
  if(follow&&messages&&!panel.hidden){
   const top=messages.scrollTop+reply.getBoundingClientRect().top-messages.getBoundingClientRect().top-12;
   messages.scrollTop=Math.max(0,Math.min(top,messages.scrollHeight-messages.clientHeight));
  }
 }
 async function ask(message){
  if(busy||!message.trim()||config.preview||panel.hidden)return;
  message=message.trim().slice(0,1000);busy=true;question.value='';resizeQuestion();
  submit.disabled=true;if(reset)reset.disabled=true;
  if(suggestions)suggestions.hidden=true;
  // On touch devices dismiss the keyboard after sending to maximize reading space.
  if(mobile()&&document.activeElement===question)question.blur();
  addMessage(message,'user');const pending=addMessage(config.thinking||'Thinking…','assistant','pending');tail();
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
  try{
   const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,language:lang,history:history.slice(-8)}),signal:controller.signal});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||typeof data.reply!=='string'||!data.reply.trim())throw new Error('No response');
   showReply(pending,data.reply);history.push({role:'user',content:message},{role:'assistant',content:data.reply});
  }catch{showReply(pending,config.error||'Please try again or contact the academy.','error');}
  finally{clearTimeout(timeout);busy=false;submit.disabled=false;if(reset)reset.disabled=false;}
 }
 chatForm?.addEventListener('submit',event=>{event.preventDefault();ask(question.value);});
 question?.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();ask(question.value);}});
 document.querySelectorAll('[data-chat-question]').forEach(button=>button.addEventListener('click',()=>ask(button.dataset.chatQuestion)));
 if(config.preview){document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a=>a.addEventListener('click',e=>e.preventDefault()));}
})();
