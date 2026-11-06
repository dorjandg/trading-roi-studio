/* Unified searchable course Q&A, source-grounded; no duplication of study progress IDs. */
const jjQAHubSlug='student-qa-library';
const jjQAHubChapter={slug:jjQAHubSlug,group:'Student Q&A',title:'Student Q&A Library — Search All Answers',intro:'One searchable library of 20 candidate live student exchanges and six statistical-claim reviews. Retains original source timestamps, qualifications, contradictions and links to related Academy chapters.',status:'26 indexed records · Transcript research only; audio and speaker verification pending',sections:[{title:'Scope and evidence quality',points:['These records come from a machine transcript of the 10/14 live session, not separately authenticated speaker-labelled interviews.','The 20 candidate exchanges and six claim-check records are shown separately to avoid counting repeated claims as additional questions.','Original lessons and previous Q&A chapters remain available. Use the source timestamps to compare original wording; current prop-firm terms and chart placements are not verified.'],src:[['10/14 Live Q&A','Full source transcript','11rROXafmTYxPGdFvNhfo6ddsTFL2Xhi6']]}]};
if(!chapters.some(x=>x.slug===jjQAHubSlug)){chapters.push(jjQAHubChapter);curriculum.push({slug:jjQAHubSlug,title:'00 · Search Student Q&A',status:'review',reason:'20 candidate questions and 6 statistical claim reviews, original transcript cited.'})}
jjCategoryOverrides[jjQAHubSlug]='Student Q&A';
curriculum.sort((a,b)=>jjGroupOrder[jjGroupFor(a)]-jjGroupOrder[jjGroupFor(b)]);
const jjQATopics=['All topics',...new Set(jjUnifiedQAData.map(x=>x.topic))].sort((a,b)=>a==='All topics'?-1:b==='All topics'?1:a.localeCompare(b));
const jjQAState={query:'',topic:'All topics',kind:'All records'};
function jjQAElem(tag,className,content){
 const el=document.createElement(tag);if(className)el.className=className;if(content!==undefined)el.textContent=content;return el;
}
function jjQAFilter(){
 const text=jjQAState.query.toLocaleLowerCase().trim();
 return jjUnifiedQAData.filter(item=>(jjQAState.topic==='All topics'||item.topic===jjQAState.topic)&&(jjQAState.kind==='All records'||item.kind===jjQAState.kind)&&(!text||[item.id,item.question,item.topic,item.time,item.kind,...item.answer].join(' ').toLocaleLowerCase().includes(text)));
}
function jjQARenderRecords(){
 const root=document.querySelector('#jj-qa-hub');if(!root)return;
 const list=root.querySelector('#jj-qa-results'),count=root.querySelector('#jj-qa-count');
 const matches=jjQAFilter();count.textContent=matches.length+' of '+jjUnifiedQAData.length+' indexed records';
 list.replaceChildren();
 if(!matches.length){list.append(jjQAElem('p','jj-qa-none','No matching records. Try another keyword or clear the filters.'));return}
 for(const item of matches){
  const details=jjQAElem('details','jj-qa-item');
  const summary=jjQAElem('summary');
  const head=jjQAElem('span','jj-qa-head');
  head.append(jjQAElem('span','jj-qa-id',item.id),jjQAElem('strong','',item.question));
  const sub=jjQAElem('span','jj-qa-sub');
  sub.append(jjQAElem('span','',item.topic),jjQAElem('span','',item.kind==='Statistical claim'?'Claim check':item.status));
  summary.append(head,sub);details.append(summary);
  const body=jjQAElem('div','jj-qa-body');
  body.append(jjQAElem('div','jj-qa-evidence','Source time: '+item.time+' · Original audio and speaker attribution not independently checked.'));
  for(const paragraph of item.answer)body.append(jjQAElem('p','',paragraph));
  const links=jjQAElem('div','jj-qa-links');
  const source=jjQAElem('a','', 'Original timestamped transcript');
  source.href='https://drive.google.com/file/d/'+encodeURIComponent(item.src)+'/view';source.target='_blank';source.rel='noopener noreferrer';links.append(source);
  const related=jjQAElem('button','', 'Related Academy chapter');
  related.type='button';related.addEventListener('click',()=>pick(item.related));links.append(related);
  body.append(links);details.append(body);list.append(details);
 }
}
function jjQASelect(name,values){
 const select=jjQAElem('select');select.name=name;
 for(const value of values){const opt=jjQAElem('option','',value);opt.value=value;select.append(opt)}
 return select;
}
function jjQAMount(){
 const chapter=document.getElementById(jjQAHubSlug);if(!chapter)return;
 if(chapter.querySelector('#jj-qa-hub'))return;
 const root=jjQAElem('section','jj-qa-hub');root.id='jj-qa-hub';
 root.append(jjQAElem('h3','', 'Find JJ’s explanations by topic or keyword'));
 root.append(jjQAElem('p','jj-qa-intro','Search source-linked exchanges without losing the original caveats. All records are from the 10/14 transcript; none are independently audio-certified.'));
 const fields=jjQAElem('div','jj-qa-filters');
 const queryLabel=jjQAElem('label');queryLabel.append(jjQAElem('span','', 'Search questions and answers'));
 const query=jjQAElem('input');query.type='search';query.placeholder='Example: breakeven, 11 a.m., payouts';query.value=jjQAState.query;
 query.addEventListener('input',()=>{jjQAState.query=query.value;jjQARenderRecords()});queryLabel.append(query);fields.append(queryLabel);
 const topicLabel=jjQAElem('label');topicLabel.append(jjQAElem('span','', 'Topic'));
 const topics=jjQASelect('topic',jjQATopics);topics.value=jjQAState.topic;topics.addEventListener('change',()=>{jjQAState.topic=topics.value;jjQARenderRecords()});topicLabel.append(topics);fields.append(topicLabel);
 const kindLabel=jjQAElem('label');kindLabel.append(jjQAElem('span','', 'Content'));
 const kinds=jjQASelect('kind',['All records','Student Q&A','Statistical claim']);kinds.value=jjQAState.kind;
 kinds.addEventListener('change',()=>{jjQAState.kind=kinds.value;jjQARenderRecords()});kindLabel.append(kinds);fields.append(kindLabel);
 root.append(fields);
 const controls=jjQAElem('div','jj-qa-actions');
 const count=jjQAElem('strong','');count.id='jj-qa-count';controls.append(count);
 const reset=jjQAElem('button','', 'Clear filters');reset.type='button';
 reset.addEventListener('click',()=>{jjQAState.query='';jjQAState.topic='All topics';jjQAState.kind='All records';query.value='';topics.value='All topics';kinds.value='All records';jjQARenderRecords()});
 controls.append(reset);root.append(controls);
 const list=jjQAElem('div','jj-qa-results');list.id='jj-qa-results';root.append(list);
 const toc=chapter.querySelector('.chapter-toc');if(toc)toc.before(root);else chapter.append(root);
 jjQARenderRecords();
}
const jjQAPreviousRender=render;
render=function(){jjQAPreviousRender();if(active===jjQAHubSlug)jjQAMount()};
if(new URLSearchParams(location.search).get('topic')===jjQAHubSlug)active=jjQAHubSlug;
jjRebuildMobileSelector();renderNav();render();
