/* Inline source evidence for eight Master Strategy encyclopedia sections. */
const jjMasterEvidenceBySection=[
 ['EV06','EV07'],
 ['EV05','EV08','EV09'],
 ['EV07','EV08','EV12'],
 ['EV01','EV02','EV03','EV12'],
 ['EV04','EV05','EV22'],
 ['EV10','EV11'],
 ['EV15'],
 ['EV13','EV14','EV26','EV29','EV30']
];
function jjMasterEvidenceElement(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
const jjAdditionalChapterEvidence={
 'risk-math':[['EV16','EV17','EV18','EV19','EV20','EV24']],
 'portfolio-risk':[['EV17','EV18','EV26','EV30']],
 'account-management':[['EV26','EV29','EV30']],
 'scaling':[['EV25','EV27','EV28']],
 'evaluation':[['EV16','EV22']],
 'kpi-library':[['EV19','EV20','EV21','EV24']]
};
function jjMasterEvidenceMount(){
 const mapping=active==='master-strategy-encyclopedia'?jjMasterEvidenceBySection:jjAdditionalChapterEvidence[active];
 if(!mapping)return;
 const chapter=document.getElementById(active);if(!chapter)return;
 const sections=[...chapter.querySelectorAll(':scope > details.section')];
 for(let i=0;i<Math.min(sections.length,mapping.length);i++){
  const content=sections[i].querySelector('.content');
  if(!content||content.querySelector('.jj-inline-evidence'))continue;
  const refs=mapping[i].map(id=>jjEvidenceRecords.find(x=>x.id===id)).filter(Boolean);
  if(!refs.length)continue;
  const box=jjMasterEvidenceElement('details','jj-inline-evidence');
  const summary=jjMasterEvidenceElement('summary','', 'Primary transcript evidence · '+refs.length+' passages');
  box.append(summary);
  const intro=jjMasterEvidenceElement('p','jj-inline-disclaimer','Machine-transcribed snippets, not audio or chart verified. Interpretations are research notes, not trading instructions.');
  box.append(intro);
  for(const r of refs){
   const record=jjMasterEvidenceElement('article','jj-inline-record');
   const head=jjMasterEvidenceElement('div','jj-inline-head');
   head.append(jjMasterEvidenceElement('strong','',r.id+' · '+r.title),jjMasterEvidenceElement('span','',r.time));
   record.append(head,jjMasterEvidenceElement('blockquote','jj-inline-quote',r.quote));
   record.append(jjMasterEvidenceElement('div','jj-inline-sub','Interpretation'),jjMasterEvidenceElement('p','',r.interpretation));
   record.append(jjMasterEvidenceElement('div','jj-inline-sub','Unverified / exception'),jjMasterEvidenceElement('p','jj-inline-caveat',r.caveat));
   const links=jjMasterEvidenceElement('div','jj-inline-links');
   const source=jjMasterEvidenceElement('a','', 'Full timestamped transcript');
   source.href='https://drive.google.com/file/d/'+encodeURIComponent(r.source)+'/view';
   source.target='_blank';source.rel='noopener noreferrer';
   const explorer=jjMasterEvidenceElement('button','', 'Evidence explorer');
   explorer.type='button';explorer.addEventListener('click',()=>pick('source-evidence-explorer'));
   links.append(source,explorer);record.append(links);
   box.append(record);
  }
  content.append(box);
 }
}
const jjMasterEvidencePreviousRender=render;
render=function(){jjMasterEvidencePreviousRender();jjMasterEvidenceMount()};
jjMasterEvidenceMount();
