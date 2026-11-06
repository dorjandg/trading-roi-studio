/* JJ Academy research completion — metrics are evidence-level counts, not proof of trading outcomes. */
const jjProgressSlug='research-completion-dashboard';
const jjProgressChapter={
 slug:jjProgressSlug,group:'Research',title:'Research Completion Dashboard',
 intro:'Transparent coverage of what is in the JJ research corpus, what was studied from transcripts, and what still requires primary video/audio or official provider verification.',
 status:'Evidence levels separated · no original chart videos verified',
 sections:[{title:'How these evidence counts should be read',points:[
  '31/31 means the indexed original recordings have machine-readable transcripts, not that every video has been checked frame by frame.',
  '24/24 means priority lessons in modules 7, 15, 17 and 18 have themed transcript-based research. It is not exhaustive word-by-word or video verification.',
  'A completed arithmetic identity does not validate source probability estimates, current funded-account regulations or actual historical performance.',
  'Q&A extraction identifies candidate exchanges in a live transcript with uncertain speaker labels; duplicated statistical claim reviews are tracked separately.',
  'The number of research chapters may grow without reducing outstanding original-video verification. Completion metrics intentionally do not blend distinct evidence levels.'
 ],src:[['10/14 Live Q&A','Full transcript','11rROXafmTYxPGdFvNhfo6ddsTFL2Xhi6']]}]
};
if(!chapters.some(c=>c.slug===jjProgressSlug)){
 chapters.push(jjProgressChapter);
 curriculum.push({slug:jjProgressSlug,title:'00 · Research Completion Dashboard',status:'review',reason:'Track coverage, conflicts and source-verification gaps separately.'});
}
jjCategoryOverrides[jjProgressSlug]='Math & Research';
curriculum.sort((a,b)=>jjGroupOrder[jjGroupFor(a)]-jjGroupOrder[jjGroupFor(b)]);
function jjProgEl(tag,cls,value){const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e}
function jjProgLink(label,slug){
 const b=jjProgEl('button','jj-progress-link',label);b.type='button';
 b.addEventListener('click',()=>pick(slug));return b;
}
function jjProgMetric(value,label,description){
 const c=jjProgEl('div','jj-progress-metric');
 c.append(jjProgEl('strong','',value),jjProgEl('span','',label),jjProgEl('small','',description));return c;
}
function jjProgModules(){
 const a=typeof jjVerification!=='undefined'?jjVerification.sections.slice(0,4):[];
 return a.map(s=>{
  const n=s.src.length;
  return {name:s.title.replace(/\s*[—-]\s*\d+ lessons.*/,''),n,records:s.points,sourceIds:s.src.map(x=>x[2])};
 });
}
function jjProgCounts(){
 const modules=jjProgModules();
 return {
  transcribed:31,total:31,priority:modules.reduce((a,b)=>a+b.n,0),
  contradictions:typeof jjConflictChapter!=='undefined'?jjConflictChapter.sections.length:null,
  chartCases:typeof jjVisualWorklist!=='undefined'?jjVisualWorklist.sections.length:null,
  questions:typeof jjUnifiedQAData!=='undefined'?jjUnifiedQAData.filter(x=>x.kind==='Student Q&A').length:null,
  claimReviews:typeof jjUnifiedQAData!=='undefined'?jjUnifiedQAData.filter(x=>x.kind==='Statistical claim').length:null,
  visualConfirmed:0,modules
 };
}
function jjProgSection(root,heading,description){
 const area=jjProgEl('section','jj-progress-section');
 area.append(jjProgEl('h4','',heading));
 if(description)area.append(jjProgEl('p','jj-progress-muted',description));
 root.append(area);return area;
}
function jjProgRender(){
 const root=document.getElementById('jj-progress-dashboard');if(!root)return;
 const body=root.querySelector('#jj-progress-body');body.replaceChildren();
 const c=jjProgCounts();
 const kpis=jjProgEl('div','jj-progress-kpis');
 kpis.append(
 jjProgMetric(c.transcribed+'/'+c.total,'Recordings transcribed','Machine transcripts exist'),
 jjProgMetric(c.priority+'/24','Priority lessons audited','Transcript-based thematic reviews'),
 jjProgMetric('0','Chart videos verified','Original frames not yet available'),
 jjProgMetric(String(c.contradictions??'—'),'Conflicts indexed','Open or conditional explanations'),
 jjProgMetric(String(c.questions??'—'),'Student Q&A candidates','Audio/speaker verification pending'),
 jjProgMetric(String(c.chartCases??'—'),'Chart cases in queue','Original candle evidence required')
 );
 body.append(kpis);
 const modules=jjProgSection(body,'Priority course coverage','Thematic transcript review is recorded for all four priority modules, but it does not complete their video evidence.');
 const cards=jjProgEl('div','jj-progress-module-grid');
 for(const m of c.modules){
  const item=jjProgEl('div','jj-progress-module');
  const top=jjProgEl('div','jj-progress-module-head');
  top.append(jjProgEl('strong','',m.name),jjProgEl('span','',m.n+'/'+m.n+' transcript audits'));item.append(top);
  const bar=jjProgEl('div','jj-progress-track');const fill=jjProgEl('div','jj-progress-fill');fill.style.width='100%';bar.append(fill);item.append(bar);
  item.append(jjProgEl('small','',m.n+' source lessons · original chart frames unverified'));cards.append(item);
 }
 modules.append(cards,jjProgLink('Open all 24 lesson verification gaps','research-verification-tracker'));
 const evidence=jjProgSection(body,'Verification levels','A transcript count must never be displayed as proof that a strategy, chart, brokerage rule or outcome has been verified.');
 const levels=jjProgEl('div','jj-progress-levels');
 const arr=[
  ['Available','31/31','Machine-readable transcript corpus'],
  ['Reviewed',c.priority+'/24','Priority lessons organized into thematic audits'],
  ['Partially checked','Selected examples','Some arithmetic independently recalculated; no complete formula census'],
  ['Not verified','0/'+(c.chartCases??12),'Original video charts among cases currently queued'],
  ['Not verified','Uncounted','Current firm-policy claims and exact provider permissions']
 ];
 for(const [status,value,caption] of arr){
  const el=jjProgEl('div','jj-progress-level');
  el.append(jjProgEl('span','jj-progress-level-status',status),jjProgEl('strong','',value),jjProgEl('span','',caption));levels.append(el);
 }
 evidence.append(levels);
 const research=jjProgSection(body,'Outstanding research queues','Open the original timestamped evidence and see which claims remain unconfirmed.');
 const queue=jjProgEl('div','jj-progress-queue');
 const items=[
  ['Original chart frames',String(c.chartCases??'—')+' cases','BOS levels, fair-price anchors, stop distances and actual fills','visual-evidence-worklist'],
  ['Contradictions',String(c.contradictions??'—')+' issues','Threshold differences, payout math and account-stage exceptions','course-conflict-register'],
  ['Per-lesson checks','24 priority sources','Individual clip and firm-rule verification tasks','research-verification-tracker'],
  ['Live Q&A',(c.questions??'—')+' questions + '+(c.claimReviews??'—')+' claims','Speaker attribution, unanswered questions and unsupported statistics','student-qa-library'],
  ['Mechanical rule gaps','9 decision gates','Missing pivot, BOS, invalidation and timing definitions','trading-rules-playbook']
 ];
 for(const item of items){
  const row=jjProgEl('div','jj-progress-queue-row');const text=jjProgEl('div','jj-progress-queue-text');
  text.append(jjProgEl('strong','',item[0]+' · '+item[1]),jjProgEl('span','',item[2]));row.append(text,jjProgLink('Open',item[3]));queue.append(row);
 }
 research.append(queue);
 const footer=jjProgSection(body,'Methodology and source integrity','Counts are generated from the existing Academy lesson tracker, conflict records, Q&A library and chart queue at page load. The 31-recording corpus total and zero verified video cases are research-stage facts, not completion targets inferred from chapter counts.');
 footer.append(jjProgEl('p','jj-progress-muted','The dashboard does not claim independent source-audio certification, frame-level video review, trading profitability or current prop-firm eligibility.'));
}
function jjProgMount(){
 const chapter=document.getElementById(jjProgressSlug);if(!chapter)return;
 if(chapter.querySelector('#jj-progress-dashboard'))return;
 const section=jjProgEl('section','jj-progress-dashboard');section.id='jj-progress-dashboard';
 section.append(jjProgEl('h3','', 'Research status at a glance'));
 section.append(jjProgEl('p','jj-progress-muted','See exactly what is documented, what has been mathematically checked and what still needs original footage or official-source review.'));
 const body=jjProgEl('div');body.id='jj-progress-body';section.append(body);
 const toc=chapter.querySelector('.chapter-toc');if(toc)toc.before(section);else chapter.append(section);
 jjProgRender();
}
const jjProgPreviousRender=render;
render=function(){jjProgPreviousRender();if(active===jjProgressSlug)jjProgMount()};
if(new URLSearchParams(location.search).get('topic')===jjProgressSlug)active=jjProgressSlug;
jjRebuildMobileSelector();renderNav();render();
