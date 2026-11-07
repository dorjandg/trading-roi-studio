/* 4Ds Studio Evidence Chat — local, explainable, no third-party AI requests or credential exposure. */
(()=>{'use strict';
if(document.getElementById('studioFloatingAI'))return;
const style=document.createElement('style');style.textContent=`
.studio-ai{position:fixed;z-index:1001;right:14px;bottom:62px;width:min(410px,calc(100vw - 20px));max-height:min(650px,calc(100dvh - 92px));overflow:hidden;display:flex;flex-direction:column;border:1px solid #34485c;border-radius:13px;background:#101b2a;box-shadow:0 10px 40px #0009;padding:11px;font-size:12px;color:#ecf5ff;line-height:1.45}.studio-ai[hidden]{display:none!important}
.studio-ai *{box-sizing:border-box}.studio-ai-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.studio-ai-head strong{font-size:13px}.studio-ai-note{color:#99adc3;font-size:11px;margin:5px 0 8px}
.studio-ai-log{height:310px;min-height:95px;max-height:40dvh;overflow-y:auto;overscroll-behavior:contain;border:1px solid #293b50;border-radius:9px;background:#0b1421;padding:8px;display:flex;flex-direction:column;gap:8px}
.studio-ai-msg{max-width:92%;padding:8px 10px;border-radius:10px;background:#1b2b41;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.studio-ai-msg.user{align-self:flex-end;background:#17463d}.studio-ai-msg.assistant{align-self:flex-start}
.studio-ai-meta{display:block;color:#abc0d2;font-size:10px;margin-top:5px}.studio-ai-actions{display:flex;gap:5px;margin-top:5px;flex-wrap:wrap}
.studio-ai button{min-height:27px;border:1px solid #3b536c;border-radius:7px;background:#1a2a40;color:#e9f1f8;padding:4px 8px;font-size:11px;cursor:pointer}
.studio-ai button:hover{border-color:#7ea4c5}.studio-ai .studio-ai-send{background:#276f59}
.studio-ai-suggestions{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}
.studio-ai-input{display:flex;gap:6px;margin-top:8px}.studio-ai-input textarea{flex:1;min-width:0;resize:vertical;min-height:42px;max-height:100px;background:#0d1827;border:1px solid #3b536c;border-radius:8px;padding:8px;color:#edf5fc;font:inherit}
.studio-ai-open{position:fixed;right:14px;bottom:14px;z-index:1002;border:1px solid #479a83;border-radius:22px;background:#163c38;color:#e7fff6;padding:9px 14px;font:700 12px system-ui;box-shadow:0 6px 22px #0008;cursor:pointer}.studio-ai-open:hover{background:#24574f}.studio-ai-saved{margin-top:8px;overflow-y:auto;max-height:100px}.studio-ai-saved summary{cursor:pointer}.studio-ai-saved p{margin:4px 0;color:#afc2d2}
@media(max-width:600px){.studio-ai{right:6px;bottom:58px;width:calc(100vw - 12px);padding:7px;max-height:calc(100dvh - 74px)}.studio-ai-log{height:180px}.studio-ai-msg{max-width:98%;font-size:11px}.studio-ai button{font-size:10px;padding:4px 6px}.studio-ai-input textarea{font-size:12px}}
`;document.head.appendChild(style);
const panel=document.createElement('section');panel.id='studioFloatingAI';panel.className='studio-ai';panel.setAttribute('aria-label','Trading Studio evidence assistant');
panel.innerHTML='<div class="studio-ai-head"><strong>Studio AI · Website assistant</strong><button type="button" data-act="close">× Close</button><button type="button" data-act="clear">Clear chat</button></div><p class="studio-ai-note">Free local assistant · Explains website parameters, displayed results and saved simulation history. Answers are limited to supported website knowledge. No trading settings changed.</p><div class="studio-ai-log" role="log" aria-live="polite"></div><div class="studio-ai-suggestions"></div><div class="studio-ai-input"><textarea maxlength="900" aria-label="Question about trading simulation" placeholder="Ask about a section, parameter or simulation result…"></textarea><button class="studio-ai-send" type="button" data-act="ask">Ask</button></div><details class="studio-ai-saved"><summary>Saved answers &amp; unanswered questions</summary><div data-saved></div><div data-unanswered></div></details>';
document.body.appendChild(panel);
panel.hidden=true;

const quick=document.createElement('button');
quick.type='button';quick.className='studio-ai-open';quick.textContent='Ask Studio AI';
quick.setAttribute('aria-label','Open Trading Studio assistant');
function toggleAI(force){
 const opening=typeof force==='boolean'?force:panel.hidden;
 panel.hidden=!opening;
 quick.setAttribute('aria-expanded',String(opening));
 quick.textContent=opening?'Close Studio AI':'Ask Studio AI';
 if(opening){ if(key!==storage())load(); el('textarea')?.focus({preventScroll:true});}
}
quick.addEventListener('click',()=>toggleAI());
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)toggleAI(false)});
document.body.appendChild(quick);

const el=s=>panel.querySelector(s), storage=()=>{let u='dori';try{u=localStorage.getItem('4ds:active-user:v1')||'dori'}catch{}return '4ds:v1:'+u+':studio-evidence-chat:v1'};
const initial=()=>({messages:[],saved:[],unanswered:[]});
let data=initial(),key='';
function load(){key=storage();try{let v=JSON.parse(localStorage.getItem(key)||'null');data=v&&Array.isArray(v.messages)&&Array.isArray(v.saved)&&Array.isArray(v.unanswered)?v:initial()}catch{data=initial()}render()}
function persist(){try{localStorage.setItem(key,JSON.stringify(data))}catch{}}
function n(id){let x=Number(document.getElementById(id)?.value);return Number.isFinite(x)?x:null}
function money(v){return '$'+Math.round(v).toLocaleString('en-US')}
function source(){let label=document.querySelector('#reportSourceLabel')?.textContent?.trim()||'';return !document.getElementById('results')?.hidden&&label?label:'Current form inputs (no displayed run verified)'}
/* Read rendered result cells, not invented simulator values. Never inspect hidden account or cloud data. */
function displayedResults(){
 const root=document.getElementById('results'),table=document.getElementById('comparisonRows');
 if(!root||root.hidden||!table)return [];
 return Array.from(table.querySelectorAll('tr')).map(tr=>{
  const c=Array.from(tr.querySelectorAll('td')).map(td=>td.textContent.trim().replace(/\s+/g,' '));
  if(c.length<12)return null;
  return {firm:c[0],budget:c[1],bought:c[2],spent:c[3],phase1:c[4],phase2:c[5],funded:c[6],paid:c[7],receipts:c[8],net:c[9],roi:c[10],chance:c[11]};
 }).filter(Boolean);
}
function numeric(s){const x=Number(String(s||'').replace(/[^0-9.-]/g,''));return Number.isFinite(x)?x:null}
function reportAnswer(q){
 const rows=displayedResults();
 if(!rows.length)return null;
 const matches=rows.filter(x=>['ftmo','topstep','hola'].some(k=>q.includes(k)&&x.firm.toLowerCase().includes(k)));
 const chosen=matches.length?matches:rows;
 const wants=/roi|return|profit|cost|fees|spent|payout|funded|phase|pass|account|result|simulation|funnel|compare|why|analysis|summary|number|expensive|bought|purchase|chance|probability/.test(q);
 if(!wants)return null;
 const label=source();
 const line=r=>r.firm+': purchased '+r.bought+', phase 1 '+r.phase1+', phase 2 '+r.phase2+', funded '+r.funded+', first-paid '+r.paid+'; spend '+r.spent+', receipts '+r.receipts+', net '+r.net+', ROI '+r.roi+', chance of ≥1 payout '+r.chance+'.';
 let answer='Displayed Section 5 results ('+label+'):\n'+chosen.map(line).join('\n');
 if(/why|low|negative|bad|cost|fees|funnel|funded|payout|phase|account/.test(q)){
  const observations=chosen.map(r=>{
   let spent=numeric(r.spent),receipts=numeric(r.receipts),bought=numeric(r.bought),funded=numeric(r.funded),paid=numeric(r.paid);
   const notes=[];
   if(spent!==null&&receipts!==null)notes.push(receipts<spent?'receipts are below modeled spend':'receipts cover modeled spend');
   if(bought>0&&funded!==null)notes.push('funded / purchased ≈ '+(100*funded/bought).toFixed(1)+'%');
   if(funded>0&&paid!==null)notes.push('first-paid / funded ≈ '+(100*paid/funded).toFixed(1)+'%');
   return r.firm+': '+notes.join('; ')+'.';
  });
  answer+='\nReadout: '+observations.join(' ')+' These are descriptive ratios of trial averages, not a causal diagnosis or true account-level pass probabilities.';
 }
 answer+='\nSource: currently displayed Section 5 Monte Carlo report; averages and modeled assumptions, not realized trading payouts. Changing settings after running can make these numbers stale—rerun the simulation to update.';
 return [answer,'Displayed report · High for copied values; Medium for interpretation',false];
}
function pageContext(question){
 const q=question.toLowerCase();
 if(!/(this (page|tab|section)|current (page|tab)|what (am i|is this)|explain (overview|firms|labs|presets|profile|help)|where am i)/.test(q))return null;
 const active=document.querySelector('main .page.active')||document.querySelector('.page.active');
 const title=active?.querySelector('h1,h2')?.textContent?.trim()||document.querySelector('main h1')?.textContent?.trim()||document.title;
 const tab=active?.id?.replace(/^page-/,'')||'standalone page';
 return ['Current Trading Studio view: '+title+' ('+tab+'). This assistant explains visible website inputs and its documented calculations. In Portfolio Simulator it can also explain displayed Monte Carlo results and saved simulation history. If the requested metric is not exposed here, I will not invent a value.','Current website view · High',false];
}
const suggestions=['Analyze saved simulations','Suggest parameter tests','Explain my results','Why is ROI low?','What does win rate mean?','Explain Section 7 journey','How does account capacity work?','Explain trading-day horizon'];
function reply(question){
 const q=question.toLowerCase(),wr=n('winRate'),budget=n('budget'),goal=n('netGoal'),days=n('days'),trials=n('trials');
 const currentPage=pageContext(question);if(currentPage)return currentPage;
 const historical=window.StudioHistoryAdvisor?.answer(question);if(historical)return historical;
 const guideQuery=/^(how|what|where|which|define|meaning)/.test(q)||/explain (section|parameter|setting|input)|how .* work/.test(q);
 if(guideQuery){const guide=window.StudioKnowledge?.answer(question);if(guide)return guide;}
 const report=reportAnswer(q);if(report)return report;
 const website=window.StudioKnowledge?.answer(question);if(website)return website;
 const s='Source: '+source()+'. Inputs are assumptions, not realized outcomes.';
 const context='Current inputs: '+(wr===null?'unknown':wr+'%')+' trade win rate, '+(days??'?')+' trading days, '+(trials??'?')+' trials, '+(budget===null?'unknown':money(budget))+' budget, '+(goal===null?'unknown':money(goal))+' net goal.';
 if(/^(?:hi|hello|hey)\b/.test(q))return ['Ask me about ROI, probabilities, funded-account funnel, cash costs or risk. I can explain the model and check arithmetic.','Model explanation · High',false];
 if(/(target|budget|math|check|roi formula|calculate)/.test(q)){
  if(budget===null||budget<=0||goal===null)return ['Enter a positive starting budget and net-profit target to calculate the required return. '+context,'Live-input arithmetic · High',false];
  const pct=goal/budget*100;return ['Net target / starting budget = '+money(goal)+' / '+money(budget)+' = '+pct.toFixed(1)+'% required gain on starting capital. This is NOT modeled ROI (which uses total expenses and receipts). '+s,'Live-input arithmetic · High',false];
 }
 if(/(win rate|winrate|probability|expectancy|\brr\b|risk reward)/.test(q)){
  return ['A trade win rate is the probability assigned to each trade signal; it is not the probability of passing a phase. With R:R = r, trade expectancy in R is (winRate × r) − (1 − winRate), before fees and slippage. At '+(wr??'?')+'% WR and 3R, illustrative expectancy is '+(wr===null?'unknown':((wr/100)*3-(1-wr/100)).toFixed(2)+'R')+'. 3R is an EXAMPLE, not a readout of your saved stage strategy. Shared signals may make account results correlated. '+s,'Formula + live WR · High',false];
 }
 if(/(roi|profit|return|bad result|los|negative|improv)/.test(q)){
  return ['ROI depends on expected payouts received minus all modeled costs, divided by modeled costs. A lower win rate, fees for failed evaluations, delayed funded payouts, daily loss limits and too-short trading horizon can reduce modeled return. '+context+' Check the Section 5 account-level cost and first-payout funnel before changing risk. This diagnosis is a hypothesis, not a finding about your latest run.','Model rules · Medium',false];
 }
 if(/(funded|funnel|phase|evaluation|pass|account)/.test(q)){
  return ['Accounts move through purchased evaluation → Phase 1 → Phase 2 when applicable → funded → funded target → eligible first payout. Different firms have different paths. More trade signals do not automatically mean more accounts are bought: the selected capacity, budget, allocation and replacement rules constrain purchases. Inspect Section 7 Account Journey and Section 5 funnel to locate the bottleneck. '+s,'Model structure · High',false];
 }
 if(/(compare|difference|jj|topstep|ftmo|hola)/.test(q)){
  return ['Compare firms using the same horizon and trade-win-rate assumption, then inspect stage count, loss policy, acquisition/activation fees, funded payout rules and eligibility delay separately. An FTMO two-step path and a Topstep evaluation-to-funded path do not have identical transition rules. Do not treat JJ illustrative course success figures as measured win rates.','Documented model differences · High',false];
 }
 if(/(missing|source|evidence|confidence|data|save)/.test(q)){
  return ['This assistant reads the currently displayed Section 5 comparison table, current form inputs and documented simulation mechanics. It cannot independently inspect your private cloud runs, infer the latest simulated outcome from a hidden dashboard, verify live prop-firm rules, or prove causal effects. Section 10 stores history and Section 11 publishes reviewed research. Saved answers and unanswered questions in this chat remain in this browser workspace.','Capability disclosure · High',false];
 }
 return ['I cannot verify an answer to that question from the available model rules and visible inputs. I saved it to the unanswered tracker. Use “Queue GPT Review” below for research or “Live GPT Review” to continue in ChatGPT without sending private data in a URL.','Unanswered · Low',true];
}
function render(){
 const log=el('.studio-ai-log');log.replaceChildren();
 if(!data.messages.length){const p=document.createElement('p');p.className='studio-ai-note';p.textContent='Ask a question or tap a suggestion. Answers state their evidence and confidence.';log.append(p)}
 data.messages.forEach((m,i)=>{const d=document.createElement('div');d.className='studio-ai-msg '+(m.role==='user'?'user':'assistant');d.append(document.createTextNode(m.text));if(m.role==='assistant'){let meta=document.createElement('span');meta.className='studio-ai-meta';meta.textContent=m.meta;d.append(meta);let actions=document.createElement('div');actions.className='studio-ai-actions';const b=document.createElement('button');b.textContent='Save answer';b.dataset.save=i;actions.append(b);d.append(actions)}log.append(d)});log.scrollTop=log.scrollHeight;
 const sug=el('.studio-ai-suggestions');sug.replaceChildren();suggestions.forEach(t=>{let b=document.createElement('button');b.textContent=t;b.dataset.question=t;sug.append(b)});
 const saved=el('[data-saved]'),un=el('[data-unanswered]');saved.replaceChildren();un.replaceChildren();
 let h=document.createElement('p');h.textContent='Saved answers: '+data.saved.length;saved.append(h);data.saved.slice(-15).reverse().forEach(x=>{const p=document.createElement('p');p.textContent=x;saved.append(p)});
 h=document.createElement('p');h.textContent='Unanswered: '+data.unanswered.length;un.append(h);data.unanswered.slice(-15).reverse().forEach(x=>{const p=document.createElement('p');p.textContent=x;un.append(p)});
}
function ask(t){let question=String(t||'').trim().slice(0,900);if(!question)return;if(key!==storage())load();const [answer,meta,missing]=reply(question);data.messages.push({role:'user',text:question},{role:'assistant',text:answer,meta});if(missing&&!data.unanswered.includes(question))data.unanswered.push(question);data.messages=data.messages.slice(-100);persist();render();el('textarea').value=''}
panel.addEventListener('click',e=>{let b=e.target.closest('button');if(!b)return;if(b.dataset.question)ask(b.dataset.question);else if(b.dataset.act==='ask')ask(el('textarea').value);else if(b.dataset.act==='close'){toggleAI(false)}else if(b.dataset.act==='clear'){data.messages=[];persist();render()}else if(b.dataset.save!==undefined){let i=Number(b.dataset.save),m=data.messages[i];if(m?.role==='assistant'){let q=data.messages[i-1]?.text||'Question';let v=q+' — '+m.text;if(!data.saved.includes(v))data.saved.push(v);data.saved=data.saved.slice(-50);persist();render()}}});
el('textarea').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask(el('textarea').value)}});
window.addEventListener('storage',e=>{if(e.key==='4ds:active-user:v1'||e.key===key)load()});window.addEventListener('focus',()=>{if(key!==storage())load()});
load();
})();