/* Section topic filters for JJ Academy, without changing study progress or chapter IDs. */
const jjSectionTopicNames=['All sections','Strategy & Entries','Fair Price & Sessions','Risk & Statistics','Accounts & Payouts','Research & Evidence','Other'];
const jjSectionFilterByChapter={};
function jjSectionTopic(s){
 const v=(s.title+' '+s.points.slice(0,2).join(' ')).toLowerCase();
 if(/bos|displacement|entry|swing|stop placement|structure break|continuation|reversion|setups?|trend/.test(v))return 'Strategy & Entries';
 if(/fair.price|volume|session|asian|overnight|11 a.m|9:30|6 p.m|ny am|opening/.test(v))return 'Fair Price & Sessions';
 if(/risk of ruin|expected value|\bev\b|variance|probability|statistics|mathemat|drawdown|win rate|backtest|sample|formula/.test(v))return 'Risk & Statistics';
 if(/account|funded|evaluation|prop firm|payout|scal|fee|bankroll|copy trad|portfolio|withdraw/.test(v))return 'Accounts & Payouts';
 if(/source|claim|conflict|evidence|transcript|audit|verification|research|lesson/.test(v))return 'Research & Evidence';
 return 'Other';
}
function jjSectionFiltersMount(){
 if(active==='dashboard'||active==='terminology-consistency-audit')return;
 const article=document.getElementById(active);
 const chapter=chapters.find(c=>c.slug===active);
 if(!article||!chapter||chapter.sections.length<4)return;
 const details=[...article.querySelectorAll(':scope > details.section')];
 if(!details.length)return;
 const byKey=new Map(chapter.sections.map(s=>[sectionKey(chapter,s),jjSectionTopic(s)]));
 const topics=details.map(d=>{
  const cb=d.querySelector('.study-checkbox');
  return cb&&byKey.get(cb.dataset.key)||'Other';
 });
 let ui=article.querySelector('.jj-topic-bar');
 if(!ui){
  ui=document.createElement('div');ui.className='jj-topic-bar';
  const label=document.createElement('label');
  const title=document.createElement('span');title.textContent='Filter topics';
  const select=document.createElement('select');select.setAttribute('aria-label','Filter chapter topics');
  const options=jjSectionTopicNames.filter(x=>x==='All sections'||topics.includes(x));
  for(const v of options){const o=document.createElement('option');o.value=v;o.textContent=v+(v==='All sections'?'':' ('+topics.filter(t=>t===v).length+')');select.append(o)}
  select.value=jjSectionFilterByChapter[active]||'All sections';
  if(!options.includes(select.value))select.value='All sections';
  select.addEventListener('change',()=>{jjSectionFilterByChapter[active]=select.value;jjSectionFiltersApply(article)});
  label.append(title,select);ui.append(label);
  const total=document.createElement('span');total.className='jj-topic-count';ui.append(total);
  const dictionary=document.createElement('button');dictionary.type='button';dictionary.textContent='Trading Dictionary';dictionary.onclick=()=>pick('terminology-consistency-audit');ui.append(dictionary);
  const toc=article.querySelector(':scope > details.chapter-toc');
  if(toc)toc.before(ui);else details[0].before(ui);
 }
 jjSectionFiltersApply(article);
}
function jjSectionFiltersApply(article){
 const chapter=chapters.find(c=>c.slug===active);if(!chapter)return;
 const byKey=new Map(chapter.sections.map(s=>[sectionKey(chapter,s),jjSectionTopic(s)]));
 const chosen=jjSectionFilterByChapter[active]||'All sections';
 const select=article.querySelector('.jj-topic-bar select');
 if(select)select.value=chosen;
 let shown=0;let all=0;
 for(const details of article.querySelectorAll(':scope > details.section')){
  const cb=details.querySelector('.study-checkbox');
  const topic=cb&&byKey.get(cb.dataset.key)||'Other';
  details.hidden=chosen!=='All sections'&&topic!==chosen;
  all++;if(!details.hidden)shown++;
 }
 const counter=article.querySelector('.jj-topic-count');if(counter)counter.textContent=shown+' / '+all+' topics';
}
const jjSectionBeforeRender=render;
render=function(){jjSectionBeforeRender();jjSectionFiltersMount()};
jjSectionFiltersMount();
