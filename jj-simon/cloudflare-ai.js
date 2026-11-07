/* Optional Cloudflare AI synthesis. Local search stays the default and fallback.
   Only selected indexed research summaries are sent when user clicks AI. */
(() => {
 'use strict';
 const API='/api/ask';
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 let busy=false;
 function renderAnswer(target,value){
  target.replaceChildren();
  const raw=String(value||'').replace(/\r/g,'').replace(/\*\*([^*\n]+)\*\*/g,'\n$1\n');
  const parts=raw.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
  for(const part of parts){
   const lines=part.split('\n').map(x=>x.trim()).filter(Boolean);
   for(const line of lines){
    const isHeading=line.length<90&&(/:$/.test(line)||/^(Risk and|Trade sequence|Loss management|First trade|Second trade|Limitations)/i.test(line));
    target.append(el(isHeading?'h4':'p','',line));
   }
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
  const panel=el('section','jj-ai-panel');panel.id='jj-cloudflare-ai';
  panel.hidden=true;
  const status=el('p','jj-ai-status','');
  const answer=el('div','jj-ai-answer');answer.setAttribute('aria-live','polite');
  const sources=el('div','jj-ai-sources');
  panel.append(el('strong','','Cloudflare AI · grounded answer'),status,answer,sources);
  const result=root.querySelector('#jj-helper-results');
  if(result)result.before(panel);else root.append(panel);
  button.addEventListener('click',async()=>{
   if(busy)return;
   const question=form.querySelector('textarea')?.value.trim()||'';
   if(!question){panel.hidden=false;status.textContent='Please enter a question first.';return}
   jjHelperQuestion=question;
   jjHelperAnswer(true);
   const hits=jjHelperSearch(question);
   panel.hidden=false;answer.replaceChildren();sources.replaceChildren();
   if(!hits.length){status.textContent='No relevant Academy passages found. AI cannot answer reliably without evidence; use the research queue below.';return}
   busy=true;button.disabled=true;button.textContent='Asking AI…';
   status.textContent='Sending your question and '+Math.min(hits.length,5)+' selected Academy summaries to Cloudflare AI. No full private transcripts are sent.';
   try{
    const payload={
     question:question.slice(0,750),
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
    renderAnswer(answer,data.answer||'No answer returned');
    const label=el('strong','','Source passages used:');sources.append(label);
    hits.slice(0,5).forEach((hit,i)=>{
     const item=el('div','jj-ai-source');
     item.append(el('span','', '['+(i+1)+'] '+hit.title+' · '));
     if(hit.sourceUrl){const a=el('a','','Open original');a.href=hit.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';item.append(a)}
     else if(hit.chapter&&typeof pick==='function'){
      const b=el('button','','Open chapter');b.type='button';b.onclick=()=>pick(hit.chapter);item.append(b);
     }else item.append(el('span','','Academy reference'));
     sources.append(item);
    });
   }catch(error){
    const message=String(error?.message||'AI unavailable');
    status.textContent=/abort/i.test(message)?'AI request timed out.':message;
    answer.textContent='Your Cloudflare AI binding is connected, but the model call did not complete. The local source results below are still available. If the error persists, check Cloudflare Pages Functions logs.';
   }finally{busy=false;button.disabled=false;button.textContent='Ask Cloudflare AI'}
  });
  form.addEventListener('submit',()=>{panel.hidden=true});
 }
 const previous=render;
 render=function(){previous();if(active===jjHelperSlug)init()};
 if(active===jjHelperSlug)init();
})();
