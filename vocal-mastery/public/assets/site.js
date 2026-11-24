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
 let history=[],busy=false;
 const setChat=isOpen=>{if(!panel)return;panel.hidden=!isOpen;open?.setAttribute('aria-expanded',String(isOpen));if(isOpen){setMenu(false);question?.focus();}else open?.focus();};
 open?.addEventListener('click',()=>setChat(true));close?.addEventListener('click',()=>setChat(false));
 panel?.addEventListener('keydown',event=>{
  if(event.key==='Escape'){setChat(false);return;}
  if(event.key==='Tab'){
   const nodes=[...panel.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled])')].filter(n=>!n.hidden);
   const first=nodes[0],last=nodes.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
 });
 function addMessage(text,role,extra=''){const node=document.createElement('p');node.className=`chat-message ${role} ${extra}`.trim();node.textContent=text;messages?.appendChild(node);if(messages)messages.scrollTop=messages.scrollHeight;return node;}
 async function ask(message){
  if(busy||!message.trim()||config.preview)return;
  message=message.trim().slice(0,1000);busy=true;question.value='';question.disabled=true;
  const submit=chatForm.querySelector('button[type="submit"]');submit.disabled=true;
  document.querySelector('.chat-suggestions')?.setAttribute('hidden','');
  addMessage(message,'user');const pending=addMessage(config.thinking||'Thinking…','assistant','pending');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
  try{
   const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,language:lang,history:history.slice(-8)}),signal:controller.signal});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||typeof data.reply!=='string'||!data.reply.trim())throw new Error('No response');
   pending.remove();addMessage(data.reply,'assistant');history.push({role:'user',content:message},{role:'assistant',content:data.reply});
  }catch{pending.remove();addMessage(config.error||'Please try again or contact the academy.','assistant','error');}
  finally{clearTimeout(timeout);busy=false;question.disabled=false;submit.disabled=false;question.focus();}
 }
 chatForm?.addEventListener('submit',event=>{event.preventDefault();ask(question.value);});
 question?.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();ask(question.value);}});
 document.querySelectorAll('[data-chat-question]').forEach(button=>button.addEventListener('click',()=>ask(button.dataset.chatQuestion)));
 if(config.preview){document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a=>a.addEventListener('click',e=>e.preventDefault()));}
})();
