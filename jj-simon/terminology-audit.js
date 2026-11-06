/* Unified JJ terminology and consistency audit — editorial scope, original evidence remains intact. */
const jjTermsSlug='terminology-consistency-audit';
const jjTermsChapter={slug:jjTermsSlug,group:'Research',title:'Terminology & Rule Consistency Audit',intro:'Fourteen core concepts defined consistently across the Academy, with separate contextual exceptions, source evidence IDs, and verification needs. Definitions are research aids, not live prop-firm rules.',status:'14 source-linked definitions · conflicting claims still explicitly flagged',sections:[{title:'How to use the terminology audit',points:['Each definition describes the meaning used in this Academy. Original JJ transcript wording and any contradictory lesson examples are preserved separately.','Use the named account stage, probability horizon and instrument units whenever interpreting a figure. Identical words can mean different things in evaluation, newly-funded, winning-day and payout contexts.','A terminology standard does not resolve missing chart marks, original audio ambiguities or current provider rules. Evidence citations and verification status remain visible.'],src:[['Risk of Ruin Bankroll Management','00:00–05:20','1VOJtRPDpy9LB4UakPYfZChROyAtPLQfv']]}]};
if(!chapters.some(x=>x.slug===jjTermsSlug)){chapters.push(jjTermsChapter);curriculum.push({slug:jjTermsSlug,title:'00 · Terminology & Consistency Audit',status:'review',reason:'Fourteen canonical definitions with sources and exceptions.'})}
jjCategoryOverrides[jjTermsSlug]='Math & Research';
curriculum.sort((a,b)=>jjGroupOrder[jjGroupFor(a)]-jjGroupOrder[jjGroupFor(b)]);
const jjTermsState={query:'',category:'All categories',onlyUnresolved:false};
const jjTermCategories=['All categories',...new Set(jjTerms.map(x=>x.category))].sort((a,b)=>a==='All categories'?-1:b==='All categories'?1:a.localeCompare(b));
function jjTermEl(tag,cls,content){const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e}
function jjTermFilter(){
 const q=jjTermsState.query.toLocaleLowerCase().trim();
 return jjTerms.filter(t=>(jjTermsState.category==='All categories'||jjTermsState.category===t.category)&&(!jjTermsState.onlyUnresolved||['conflict','video','firm'].includes(t.verification))&&(!q||[t.term,t.category,t.meaning,t.not,t.exception].join(' ').toLocaleLowerCase().includes(q)));
}
function jjTermsRenderResults(){
 const root=document.getElementById('jj-terms-app');if(!root)return;
 const matches=jjTermFilter();
 root.querySelector('#jj-terms-count').textContent=matches.length+' of '+jjTerms.length+' definitions';
 const list=root.querySelector('#jj-terms-results');list.replaceChildren();
 if(!matches.length){list.append(jjTermEl('p','jj-terms-empty','No matches. Clear the filters or try another term.'));return}
 for(const t of matches){
  const item=jjTermEl('details','jj-term-item');
  const sum=jjTermEl('summary');
  const left=jjTermEl('span','jj-term-left');
  left.append(jjTermEl('span','jj-term-id',t.id),jjTermEl('strong','',t.term));
  const right=jjTermEl('span','jj-term-category',t.category);sum.append(left,right);item.append(sum);
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
  inner.append(actions,jjTermEl('p','jj-term-footer','Verification: '+({conflict:'Conflicting interpretation remains unresolved',video:'Original chart/video review needed',firm:'Current provider rules require independent verification',math:'Conceptual math reviewed; assumptions remain',transcript:'Machine transcript available; audio unverified'}[t.verification]||'Further review needed')));
  item.append(inner);list.append(item);
 }
}
function jjTermsMount(){
 const article=document.getElementById(jjTermsSlug);if(!article||article.querySelector('#jj-terms-app'))return;
 const root=jjTermEl('section','jj-terms-app');root.id='jj-terms-app';
 root.append(jjTermEl('h3','', 'Academy terminology — meanings, exceptions and evidence'));
 root.append(jjTermEl('p','jj-terms-intro','A consistent glossary helps compare JJ’s lessons without erasing genuine differences in account stages, strategy conditions or probabilities.'));
 const filters=jjTermEl('div','jj-terms-filters');
 const lab=jjTermEl('label');lab.append(jjTermEl('span','','Search definitions'));
 const search=jjTermEl('input');search.type='search';search.placeholder='Try risk of ruin, fair price, payout, BOS';search.value=jjTermsState.query;search.oninput=()=>{jjTermsState.query=search.value;jjTermsRenderResults()};lab.append(search);filters.append(lab);
 const cat=jjTermEl('label');cat.append(jjTermEl('span','','Category'));
 const select=jjTermEl('select');for(const v of jjTermCategories){const o=jjTermEl('option','',v);o.value=v;select.append(o)}
 select.value=jjTermsState.category;select.onchange=()=>{jjTermsState.category=select.value;jjTermsRenderResults()};cat.append(select);filters.append(cat);root.append(filters);
 const row=jjTermEl('div','jj-terms-bar');
 const checklabel=jjTermEl('label','jj-terms-check');const check=jjTermEl('input');check.type='checkbox';check.checked=jjTermsState.onlyUnresolved;check.onchange=()=>{jjTermsState.onlyUnresolved=check.checked;jjTermsRenderResults()};checklabel.append(check,jjTermEl('span','','Needs external verification / conflict'));row.append(checklabel);
 const reset=jjTermEl('button','','Clear filters');reset.type='button';reset.onclick=()=>{jjTermsState.query='';jjTermsState.category='All categories';jjTermsState.onlyUnresolved=false;search.value='';select.value='All categories';check.checked=false;jjTermsRenderResults()};row.append(reset);
 const count=jjTermEl('span','jj-terms-count');count.id='jj-terms-count';row.append(count);root.append(row);
 const results=jjTermEl('div','jj-terms-results');results.id='jj-terms-results';root.append(results);
 root.append(jjTermEl('p','jj-terms-intro','The evidence quotations are from unverified machine transcripts; no firm rules or original chart locations have been certified.'));
 const toc=article.querySelector('.chapter-toc');if(toc)toc.before(root);else article.append(root);
 jjTermsRenderResults();
}
const jjTermsBeforeRender=render;
render=function(){jjTermsBeforeRender();if(active===jjTermsSlug)jjTermsMount()};
if(new URLSearchParams(location.search).get('topic')===jjTermsSlug)active=jjTermsSlug;
jjRebuildMobileSelector();renderNav();render();
