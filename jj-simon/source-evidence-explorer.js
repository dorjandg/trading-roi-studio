/* JJ Source Evidence Explorer: directly indexed, timestamped machine-transcript passages. */
const jjEvidenceSlug='source-evidence-explorer';
const jjEvidenceChapter={slug:jjEvidenceSlug,group:'Research',title:'Source Evidence Explorer — What JJ Actually Said',intro:'Search short quoted transcript passages separately from research interpretation. Includes lesson timestamps, related chapters, and outstanding contradictions. The underlying machine transcripts are not audio- or chart-certified.',status:'15 indexed passages · 7 source transcripts · audio and chart verification pending',sections:[{title:'How to read the source evidence',points:['Verbatim excerpts reproduce short spans of the machine transcription. They are not independently audio-verified quotations; automatic transcription can mishear words or merge speakers.','Research interpretation and verification caveats are visually separated from original wording. Do not confuse an example in a chart lesson with a general firm rule.','All sources link to the full timestamped transcript in Google Drive, not directly to a playable video at the cited moment.','Review the original charts before translating these descriptions into a mechanical BOS, fair-price or trading-risk rule.'],src:[['How To Trade Funded Accounts','01:50–03:03','17fchw1QnO1uG_FxO5QDL-p6-2fB35R49']]}]};
if(!chapters.some(x=>x.slug===jjEvidenceSlug)){chapters.push(jjEvidenceChapter);curriculum.push({slug:jjEvidenceSlug,title:'00 · Source Evidence Explorer',status:'review',reason:'Direct transcript excerpts, timestamped interpretations and unresolved evidence gaps.'})}
jjCategoryOverrides[jjEvidenceSlug]='Math & Research';
curriculum.sort((a,b)=>jjGroupOrder[jjGroupFor(a)]-jjGroupOrder[jjGroupFor(b)]);
const jjEvidenceTopicOptions=['All topics',...new Set(jjEvidenceRecords.map(x=>x.topic))].sort((a,b)=>a==='All topics'?-1:b==='All topics'?1:a.localeCompare(b));
const jjEvidenceTypeOptions=['All evidence types',...new Set(jjEvidenceRecords.map(x=>x.type))].sort((a,b)=>a==='All evidence types'?-1:b==='All evidence types'?1:a.localeCompare(b));
const jjEvidenceState={query:'',topic:'All topics',type:'All evidence types',onlyGaps:false};
function jjEvEl(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
function jjEvFilter(){
 const q=jjEvidenceState.query.trim().toLocaleLowerCase();
 return jjEvidenceRecords.filter(r=>(jjEvidenceState.topic==='All topics'||r.topic===jjEvidenceState.topic)&&(jjEvidenceState.type==='All evidence types'||r.type===jjEvidenceState.type)&&(!jjEvidenceState.onlyGaps||r.evidence==='conflict')&&(!q||[r.id,r.title,r.topic,r.type,r.time,r.quote,r.interpretation,r.caveat].join(' ').toLocaleLowerCase().includes(q)));
}
function jjEvSourceName(id){
 const names={'17fchw1QnO1uG_FxO5QDL-p6-2fB35R49':'How To Trade Funded Accounts','13vOa_M7FBB3KK9L0wSP206x3I9eDwaBR':'Fundeds for 50 Points','1miR0iSYdOTWrShLV9UfT-uDJUVmY8qeG':'Volume Changes Fair Price','1VNt39wTnRGpkGLalH-iBi3GHk75hIIUC':'Multi-Account Management','19DLGJ-t74Q0AOhVpKgtuE4P2uhVp1TPp':'Winning Days','1Ye5f_tmATyBYcAhwSWdMtZTzdvVh1Igg':'Overnight Trades','11rROXafmTYxPGdFvNhfo6ddsTFL2Xhi6':'10/14 Live Q&A'};
 return names[id]||'Course transcript';
}
function jjEvRenderResults(){
 const root=document.getElementById('jj-evidence-ui');if(!root)return;
 const list=root.querySelector('#jj-evidence-results');const count=root.querySelector('#jj-evidence-count');
 const hits=jjEvFilter();count.textContent=hits.length+' / '+jjEvidenceRecords.length+' passages';
 list.replaceChildren();
 if(!hits.length){list.append(jjEvEl('p','jj-ev-empty','No passages match. Clear the filters or try another keyword.'));return}
 for(const r of hits){
  const details=jjEvEl('details','jj-ev-card');
  const summary=jjEvEl('summary','jj-ev-summary');
  const head=jjEvEl('span','jj-ev-head');
  head.append(jjEvEl('span','jj-ev-id',r.id),jjEvEl('strong','',r.title));
  const meta=jjEvEl('span','jj-ev-meta');
  meta.append(jjEvEl('span','',r.topic),jjEvEl('span','',r.time));
  summary.append(head,meta);details.append(summary);
  const body=jjEvEl('div','jj-ev-content');
  body.append(jjEvEl('div','jj-ev-source-name',jjEvSourceName(r.source)+' · '+r.time));
  const quote=jjEvEl('blockquote','jj-ev-quote',r.quote);
  body.append(jjEvEl('div','jj-ev-field-label','Machine transcript excerpt'),quote);
  body.append(jjEvEl('div','jj-ev-field-label','Research interpretation'),jjEvEl('p','',r.interpretation));
  body.append(jjEvEl('div','jj-ev-field-label','Unverified / exception'),jjEvEl('p','jj-ev-caveat',r.caveat));
  if(r.evidence==='conflict')body.append(jjEvEl('p','jj-ev-warning','Flagged: contextual conflict or unsupported inference.'));
  const links=jjEvEl('div','jj-ev-links');
  const source=jjEvEl('a','','Open full transcript');source.href='https://drive.google.com/file/d/'+encodeURIComponent(r.source)+'/view';source.target='_blank';source.rel='noopener noreferrer';
  const related=jjEvEl('button','','Open related Academy chapter');related.type='button';related.addEventListener('click',()=>pick(r.related));
  links.append(source,related);body.append(links);
  details.append(body);list.append(details);
 }
}
function jjEvSelect(values,cb,selected){
 const el=jjEvEl('select');for(const value of values){const opt=jjEvEl('option','',value);opt.value=value;el.append(opt)}
 el.value=selected;el.addEventListener('change',()=>cb(el.value));return el;
}
function jjEvMount(){
 const chapter=document.getElementById(jjEvidenceSlug);if(!chapter)return;
 if(chapter.querySelector('#jj-evidence-ui'))return;
 const root=jjEvEl('section','jj-evidence-ui');root.id='jj-evidence-ui';
 root.append(jjEvEl('h3','', 'Find the source behind a trading rule'));
 root.append(jjEvEl('p','jj-ev-intro','Short transcript passages are separated from interpretation and limitations. Open the original timestamped file to verify the full context.'));
 const controls=jjEvEl('div','jj-ev-controls');
 const searchLabel=jjEvEl('label');searchLabel.append(jjEvEl('span','', 'Search source and research'));
 const search=jjEvEl('input');search.type='search';search.placeholder='BOS, fair price, after 11, stop...';search.value=jjEvidenceState.query;search.addEventListener('input',()=>{jjEvidenceState.query=search.value;jjEvRenderResults()});searchLabel.append(search);controls.append(searchLabel);
 const topicLabel=jjEvEl('label');topicLabel.append(jjEvEl('span','', 'Topic'));
 const topic=jjEvSelect(jjEvidenceTopicOptions,v=>{jjEvidenceState.topic=v;jjEvRenderResults()},jjEvidenceState.topic);topicLabel.append(topic);controls.append(topicLabel);
 const typeLabel=jjEvEl('label');typeLabel.append(jjEvEl('span','', 'Evidence'));
 const type=jjEvSelect(jjEvidenceTypeOptions,v=>{jjEvidenceState.type=v;jjEvRenderResults()},jjEvidenceState.type);typeLabel.append(type);controls.append(typeLabel);
 root.append(controls);
 const actions=jjEvEl('div','jj-ev-actions');
 const gapLabel=jjEvEl('label','jj-ev-check');
 const gap=jjEvEl('input');gap.type='checkbox';gap.checked=jjEvidenceState.onlyGaps;gap.addEventListener('change',()=>{jjEvidenceState.onlyGaps=gap.checked;jjEvRenderResults()});
 gapLabel.append(gap,jjEvEl('span','', 'Conflicts / exceptions only'));actions.append(gapLabel);
 const reset=jjEvEl('button','','Clear filters');reset.type='button';
 reset.addEventListener('click',()=>{jjEvidenceState.query='';jjEvidenceState.topic='All topics';jjEvidenceState.type='All evidence types';jjEvidenceState.onlyGaps=false;search.value='';topic.value='All topics';type.value='All evidence types';gap.checked=false;jjEvRenderResults()});actions.append(reset);
 const count=jjEvEl('span','jj-ev-count');count.id='jj-evidence-count';actions.append(count);root.append(actions);
 const results=jjEvEl('div','jj-ev-results');results.id='jj-evidence-results';root.append(results);
 root.append(jjEvEl('p','jj-ev-intro','Coverage is an intentionally selected evidence index, not every statement from the 31 transcripts. The quoted snippets are machine-produced and do not certify JJ’s exact spoken wording.'));
 const toc=chapter.querySelector('.chapter-toc');if(toc)toc.before(root);else chapter.append(root);
 jjEvRenderResults();
}
const jjEvPreviousRender=render;
render=function(){jjEvPreviousRender();if(active===jjEvidenceSlug)jjEvMount()};
if(new URLSearchParams(location.search).get('topic')===jjEvidenceSlug)active=jjEvidenceSlug;
jjRebuildMobileSelector();renderNav();render();
