/* Unified JJ terminology and consistency audit — editorial scope, original evidence remains intact. */
const jjTermsSlug='terminology-consistency-audit';
const jjTermsChapter={slug:jjTermsSlug,group:'Research',title:'Trading Dictionary & Terminology',intro:'A categorized reference of trading concepts defined consistently across the Academy, with separate contextual exceptions, source evidence IDs, and verification needs. Definitions are research aids, not live prop-firm rules.',status:jjTerms.length+' categorized definitions · source evidence and qualifications retained',sections:[{title:'How to use the terminology audit',points:['Each definition describes the meaning used in this Academy. Original JJ transcript wording and any contradictory lesson examples are preserved separately.','Use the named account stage, probability horizon and instrument units whenever interpreting a figure. Identical words can mean different things in evaluation, newly-funded, winning-day and payout contexts.','A terminology standard does not resolve missing chart marks, original audio ambiguities or current provider rules. Evidence citations and verification status remain visible.'],src:[['Risk of Ruin Bankroll Management','00:00–05:20','1VOJtRPDpy9LB4UakPYfZChROyAtPLQfv']]}]};
if(!chapters.some(x=>x.slug===jjTermsSlug)){chapters.push(jjTermsChapter);curriculum.push({slug:jjTermsSlug,title:'00 · Trading Dictionary',status:'review',reason:'Categorized trading definitions with sources and exceptions.'})}
jjCategoryOverrides[jjTermsSlug]='Math & Research';
curriculum.sort((a,b)=>jjGroupOrder[jjGroupFor(a)]-jjGroupOrder[jjGroupFor(b)]);
const jjTermsState={query:'',category:'All categories',subcategory:'All subcategories',onlyUnresolved:false};
const jjTermGroupOrder=['Structure & Strategy','Sessions & Timing','Trades & Instruments','Statistics & EV','Accounts & Prop Firms','Portfolio & Scaling','Accounting & Payouts','Research & Evidence'];
const jjTermGroupDescriptions={
 'Structure & Strategy':'Fair price, swing structure, BOS, entry conditions and liquidity',
 'Sessions & Timing':'Trading sessions, news and time-based market context',
 'Trades & Instruments':'Trade execution, stops, targets, contracts and instruments',
 'Statistics & EV':'Win rates, conditional probabilities, expectancy and survival math',
 'Accounts & Prop Firms':'Evaluation stages, funding rules, drawdown and qualifications',
 'Portfolio & Scaling':'Positioning multiple accounts, copying, risk and account growth',
 'Accounting & Payouts':'Actual cash, fees, payout approvals and financial performance',
 'Research & Evidence':'Evidence, backtesting, review quality and unresolved questions'
};
const jjTermsOpenCategories=new Set();
const jjTermsOpenSubcategories=new Set();
const jjTermCategories=['All categories',...new Set(jjTerms.map(x=>x.category))].sort((a,b)=>{
 if(a==='All categories')return -1;
 if(b==='All categories')return 1;
 const ia=jjTermGroupOrder.indexOf(a),ib=jjTermGroupOrder.indexOf(b);
 return (ia<0?999:ia)-(ib<0?999:ib)||a.localeCompare(b);
});
const jjTermSubcategories=['All subcategories',...new Set(jjTerms.map(x=>x.subcategory||x.category))].sort((a,b)=>a==='All subcategories'?-1:b==='All subcategories'?1:a.localeCompare(b));
function jjTermEl(tag,cls,content){const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e}
function jjTermFilter(){
 const q=jjTermsState.query.toLocaleLowerCase().trim();
 return jjTerms.filter(t=>(jjTermsState.category==='All categories'||jjTermsState.category===t.category)&&(jjTermsState.subcategory==='All subcategories'||jjTermsState.subcategory===(t.subcategory||t.category))&&(!jjTermsState.onlyUnresolved||['conflict','video','firm'].includes(t.verification))&&(!q||[t.id,t.term,t.category,t.subcategory,t.meaning,t.not,t.exception].join(' ').toLocaleLowerCase().includes(q)));
}
function jjTermsRenderResults(){
 const root=document.getElementById('jj-terms-app');if(!root)return;
 const matches=jjTermFilter();
 root.querySelector('#jj-terms-count').textContent=matches.length+' of '+jjTerms.length+' definitions';
 const list=root.querySelector('#jj-terms-results');list.replaceChildren();
 const summary=root.querySelector('#jj-terms-group-summary');
 if(summary)summary.textContent=matches.length+' terms across '+new Set(matches.map(t=>t.category)).size+' topic groups';
 if(!matches.length){
  list.append(jjTermEl('p','jj-terms-empty','No matches. Clear filters or search for a different trading concept.'));
  return;
 }
 // Group first by concept family, then by its original, precise subtype.
 // IDs, detailed definitions, contradictions and source references stay intact.
 const categories=new Map();
 for(const t of matches){
  if(!categories.has(t.category))categories.set(t.category,new Map());
  const children=categories.get(t.category),sub=t.subcategory||t.category;
  if(!children.has(sub))children.set(sub,[]);
  children.get(sub).push(t);
 }
 const hasFilter=Boolean(jjTermsState.query.trim()||
  jjTermsState.category!=='All categories'||
  jjTermsState.subcategory!=='All subcategories'||jjTermsState.onlyUnresolved);
 const ordered=[...categories.keys()].sort((a,b)=>{
  const ia=jjTermGroupOrder.indexOf(a),ib=jjTermGroupOrder.indexOf(b);
  return (ia<0?999:ia)-(ib<0?999:ib)||a.localeCompare(b);
 });
 for(const category of ordered){
  const subcategories=categories.get(category);
  const total=[...subcategories.values()].reduce((n,rows)=>n+rows.length,0);
  const group=jjTermEl('details','jj-term-group');
  group.dataset.category=category;
  group.open=hasFilter||jjTermsOpenCategories.has(category);
  const heading=jjTermEl('summary','jj-term-group-heading');
  const label=jjTermEl('span','jj-term-group-label');
  label.append(jjTermEl('strong','',category),jjTermEl('small','',jjTermGroupDescriptions[category]||'Trading definitions and educational references'));
  heading.append(label,jjTermEl('span','jj-term-group-count',total+' terms'));
  group.append(heading);
  const contents=jjTermEl('div','jj-term-group-contents');
  for(const sub of [...subcategories.keys()].sort((a,b)=>a.localeCompare(b))){
   const terms=subcategories.get(sub).slice().sort((a,b)=>a.term.localeCompare(b.term));
   const subgroup=jjTermEl('details','jj-term-subgroup');
   const key=category+'|'+sub;
   subgroup.dataset.key=key;
   subgroup.open=hasFilter||jjTermsOpenSubcategories.has(key);
   const subheading=jjTermEl('summary','jj-term-subgroup-heading');
   subheading.append(jjTermEl('strong','',sub),jjTermEl('span','jj-term-group-count',terms.length+' terms'));
   subgroup.append(subheading);
   const cards=jjTermEl('div','jj-term-subgroup-cards');
   for(const t of terms){
    const item=jjTermEl('details','jj-term-item');
    const sum=jjTermEl('summary');
    const left=jjTermEl('span','jj-term-left');
    left.append(jjTermEl('span','jj-term-id',t.id),jjTermEl('strong','',t.term));
    const right=jjTermEl('span','jj-term-category',t.subcategory||t.category);sum.append(left,right);item.append(sum);
    const inner=jjTermEl('div','jj-term-body');
    const add=(label,text,cls)=>{inner.append(jjTermEl('strong','jj-term-field',label));inner.append(jjTermEl('p',cls||'',text))};
    add('Canonical research meaning',t.meaning);
    add('Do not confuse with',t.not);
    add('Context and exception',t.exception,'jj-term-warning');
    const evidence=jjTermEl('div','jj-term-evidence');
    evidence.append(jjTermEl('strong','jj-term-field','Supporting timestamped evidence'));
    for(const id of t.evidence){
     const record=jjEvidenceRecords.find(r=>r.id===id);
     if(!record)continue;
     const row=jjTermEl('div','jj-term-evidence-row');
     row.append(jjTermEl('strong','',id+' · '+record.title),jjTermEl('blockquote','',record.quote));
     const a=jjTermEl('a','','Transcript · '+record.time);
     a.href='https://drive.google.com/file/d/'+encodeURIComponent(record.source)+'/view';
     a.target='_blank';a.rel='noopener noreferrer';
     row.append(a);evidence.append(row);
    }
    inner.append(evidence);
    const actions=jjTermEl('div','jj-term-actions');
    const related=jjTermEl('button','','Open related chapter');related.type='button';related.onclick=()=>pick(t.related);actions.append(related);
    const source=jjTermEl('button','','Open Source Explorer');source.type='button';source.onclick=()=>pick('source-evidence-explorer');actions.append(source);
    inner.append(actions,jjTermEl('p','jj-term-footer','Verification: '+({conflict:'Conflicting interpretation remains unresolved',video:'Original chart/video review needed',firm:'Current provider rules require independent verification',math:'Conceptual math reviewed; assumptions remain',transcript:'Machine transcript available; audio unverified',general:'General educational definition; not claimed to be a direct JJ quotation',public:'Public website description only; cross-check original JJ lesson and source context'}[t.verification]||'Further review needed')));
    item.append(inner);
  
    cards.append(item);
   }
   subgroup.append(cards);
   subgroup.addEventListener('toggle',()=>{
    if(hasFilter)return;
    if(subgroup.open)jjTermsOpenSubcategories.add(key);
    else jjTermsOpenSubcategories.delete(key);
   });
   contents.append(subgroup);
  }
  group.append(contents);
  group.addEventListener('toggle',()=>{
   if(hasFilter)return;
   if(group.open)jjTermsOpenCategories.add(category);
   else jjTermsOpenCategories.delete(category);
  });
  list.append(group);
 }
}

function jjTermsMount(){
 const article=document.getElementById(jjTermsSlug);if(!article||article.querySelector('#jj-terms-app'))return;
 const root=jjTermEl('section','jj-terms-app');root.id='jj-terms-app';
 root.append(jjTermEl('h3','', 'Academy terminology — meanings, exceptions and evidence'));
 root.append(jjTermEl('p','jj-terms-intro','Browse definitions by trading logic: open a main topic group, then a subtopic, then a term. All groups start collapsed. Search expands matching groups automatically; original JJ references and exceptions remain under each term.'));
 const filters=jjTermEl('div','jj-terms-filters');
 const lab=jjTermEl('label');lab.append(jjTermEl('span','','Search definitions'));
 const search=jjTermEl('input');search.type='search';search.placeholder='Try risk of ruin, fair price, payout, BOS';search.value=jjTermsState.query;search.oninput=()=>{jjTermsState.query=search.value;jjTermsRenderResults()};lab.append(search);filters.append(lab);
 const cat=jjTermEl('label');cat.append(jjTermEl('span','','Category'));
 const select=jjTermEl('select');for(const v of jjTermCategories){const n=v==='All categories'?jjTerms.length:jjTerms.filter(t=>t.category===v).length;const o=jjTermEl('option','',v+' ('+n+')');o.value=v;select.append(o)}
 select.value=jjTermsState.category;
 const subcat=jjTermEl('label');subcat.append(jjTermEl('span','','Subcategory'));
 const subselect=jjTermEl('select');
 function refreshSubcategories(){
  const available=jjTermSubcategories.filter(x=>x==='All subcategories'||jjTerms.some(t=>(jjTermsState.category==='All categories'||t.category===jjTermsState.category)&&(t.subcategory||t.category)===x));
  const previous=jjTermsState.subcategory;
  subselect.replaceChildren();
  for(const x of available){const n=jjTerms.filter(t=>(jjTermsState.category==='All categories'||t.category===jjTermsState.category)&&(x==='All subcategories'||(t.subcategory||t.category)===x)).length;const option=jjTermEl('option','',x+' ('+n+')');option.value=x;subselect.append(option)}
  if(!available.includes(previous))jjTermsState.subcategory='All subcategories';
  subselect.value=jjTermsState.subcategory;
 }
 select.onchange=()=>{jjTermsState.category=select.value;refreshSubcategories();jjTermsRenderResults()};
 refreshSubcategories();
 subselect.onchange=()=>{jjTermsState.subcategory=subselect.value;jjTermsRenderResults()};
 cat.append(select);filters.append(cat);subcat.append(subselect);filters.append(subcat);root.append(filters);
 const row=jjTermEl('div','jj-terms-bar');
 const checklabel=jjTermEl('label','jj-terms-check');const check=jjTermEl('input');check.type='checkbox';check.checked=jjTermsState.onlyUnresolved;check.onchange=()=>{jjTermsState.onlyUnresolved=check.checked;jjTermsRenderResults()};checklabel.append(check,jjTermEl('span','','Needs external verification / conflict'));row.append(checklabel);
 const expand=jjTermEl('button','','Expand groups');expand.type='button';
 expand.onclick=()=>{
  root.querySelectorAll('.jj-term-group,.jj-term-subgroup').forEach(panel=>{
   panel.open=true;
   if(panel.classList.contains('jj-term-group'))jjTermsOpenCategories.add(panel.dataset.category);
   else jjTermsOpenSubcategories.add(panel.dataset.key);
  });
 };
 row.append(expand);
 const collapse=jjTermEl('button','','Collapse groups');collapse.type='button';
 collapse.onclick=()=>{
  jjTermsOpenCategories.clear();jjTermsOpenSubcategories.clear();
  root.querySelectorAll('.jj-term-group,.jj-term-subgroup').forEach(panel=>{panel.open=false});
 };
 row.append(collapse);
 const reset=jjTermEl('button','','Clear filters');reset.type='button';reset.onclick=()=>{jjTermsState.query='';jjTermsState.category='All categories';jjTermsState.subcategory='All subcategories';jjTermsState.onlyUnresolved=false;search.value='';select.value='All categories';refreshSubcategories();check.checked=false;jjTermsRenderResults()};row.append(reset);
 const count=jjTermEl('span','jj-terms-count');count.id='jj-terms-count';row.append(count);root.append(row);
 const summary=jjTermEl('p','jj-terms-group-summary');summary.id='jj-terms-group-summary';root.append(summary);
 const results=jjTermEl('div','jj-terms-results');results.id='jj-terms-results';root.append(results);
 root.append(jjTermEl('p','jj-terms-intro','The evidence quotations are from unverified machine transcripts; no firm rules or original chart locations have been certified.'));
 const toc=article.querySelector('.chapter-toc');if(toc)toc.before(root);else article.append(root);
 jjTermsRenderResults();
}
const jjTermsBeforeRender=render;
render=function(){jjTermsBeforeRender();if(active===jjTermsSlug)jjTermsMount()};
if(new URLSearchParams(location.search).get('topic')===jjTermsSlug)active=jjTermsSlug;
jjRebuildMobileSelector();renderNav();render();
