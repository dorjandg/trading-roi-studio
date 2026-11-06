/* JJ study-only decision tree. Deterministic educational matching, not a trade signal. */
const jjTreeSlug='strategy-decision-tree';
const jjTreeChapter={
 slug:jjTreeSlug,group:'Strategy',title:'Strategy Decision Tree — Explore JJ Setups',
 intro:'Select account stage, session, fair-price context and entry evidence. The tool shows which historical JJ methods are worth studying, what rules conflict and what is not verified. It never issues a live entry recommendation.',
 status:'Transcript-based logic · not chart verified or live provider checked',
 sections:[{title:'How to interpret the decision tree',points:[
 'This is a study classifier based on JJ\'s recorded examples, not an executable trading strategy or risk recommendation.',
 'The result may list a method to study, but it never confirms a live entry, acceptable leverage, prop-firm compliance or mathematical edge.',
 'Missing confirmation, insufficient fair-price room, conflicting session conditions and unknown data should produce an exclusion or a needs-verification explanation.',
 'Review original source recordings, account terms, drawdown limits and real trade execution before treating a method as implementable.'
 ],src:[['How To Trade Funded Accounts','01:24–03:03','17fchw1QnO1uG_FxO5QDL-p6-2fB35R49'],['How To Trade Fundeds For 50 Points','00:00–05:59','13vOa_M7FBB3KK9L0wSP206x3I9eDwaBR']]}]
};
if(!chapters.some(c=>c.slug===jjTreeSlug)){chapters.push(jjTreeChapter);curriculum.push({slug:jjTreeSlug,title:'00 · Interactive Strategy Decision Tree',status:'review',reason:'Explore documented JJ methods with evidence limitations.'})}
jjCategoryOverrides[jjTreeSlug]='Learn Strategies';
curriculum.sort((a,b)=>jjGroupOrder[jjGroupFor(a)]-jjGroupOrder[jjGroupFor(b)]);
const jjTreeSources={
 funded:['Funded accounts — 100-point', '17fchw1QnO1uG_FxO5QDL-p6-2fB35R49','01:24–03:03'],
 fifty:['Funded accounts — two 50-point trades','13vOa_M7FBB3KK9L0wSP206x3I9eDwaBR','00:00–05:59'],
 overnight:['Overnight trades','1Ye5f_tmATyBYcAhwSWdMtZTzdvVh1Igg','00:00–05:29'],
 winning:['Winning-day execution','19DLGJ-t74Q0AOhVpKgtuE4P2uhVp1TPp','00:00–05:40'],
 volume:['Volume changing fair price','1miR0iSYdOTWrShLV9UfT-uDJUVmY8qeG','00:28–03:01'],
 multi:['Multi-account execution','1VNt39wTnRGpkGLalH-iBi3GHk75hIIUC','09:02–13:55'],
 risk:['Account correlation and risk','1Gr90n0aSePquj1jp9nCkvx29BiUyJj2c','00:27–02:19']
};
const jjTreeLabels={
 stage:[['unknown','Not sure'],['evaluation','Evaluation'],['new','Newly funded'],['winning','Profitable funded / winning-day'],['after','After payout']],
 session:[['unknown','Not sure'],['nyam','NY morning (before 11)'],['nylate','NY after 11'],['overnight','Overnight / Asian'],['other','Other session']],
 price:[['unknown','Not sure'],['reversion','Price is away from a credible fair-price level'],['continuation','New volume continues away / anchor shifting'],['choppy','Choppy / contradictory price references']],
 distance:[['unknown','Not measured'],['75plus','75+ index points'],['50to74','50–74 index points'],['under50','Under 50 index points']],
 trigger:[['unknown','Not sure'],['bosclose','BOS with close beyond level'],['boswick','Wick-only break'],['displacement','Displacement, no confirmed BOS'],['none','No clear structure']]
};
const jjTreeDefaults={stage:'unknown',session:'unknown',price:'unknown',distance:'unknown',trigger:'unknown'};
let jjTreeState={...jjTreeDefaults};
function jjTreeChoice(key,value){jjTreeState[key]=value;jjTreeUpdate()}
function jjTreeAdd(result,title,type,description,source,reason){
 result.push({title,type,description,source,reason});
}
function jjTreeAssess(){
 const v=jjTreeState,r=[],unknown=Object.values(v).filter(x=>x==='unknown').length;
 const confirmed=v.trigger==='bosclose';
 const weak=v.trigger==='boswick'||v.trigger==='displacement';
 if(v.price==='choppy'||v.trigger==='none'){
  jjTreeAdd(r,'No established entry','excluded','The provided structure or fair-price context does not support a confirmed setup. Waiting or reassessing is the transcript-consistent educational interpretation.','multi','No verified BOS and/or ambiguous fair-price reference');
  return {r,unknown};
 }
 if(v.price==='continuation'){
  jjTreeAdd(r,'Reassess the fair-price anchor','verify','JJ sometimes replaces the older 6 p.m. or 9:30 a.m. reference when fresh session participation continues away from it. That judgment requires the actual candles.','volume','Original price/volume reaction not verified');
  if((v.session==='nyam'||v.session==='nylate')&&v.stage==='winning'&&v.trigger!=='none'){
   jjTreeAdd(r,'Fast winning-day continuation','study','JJ describes quick NY continuation examples with preset exits. The classroom example of one NQ and a 10-point move is not a recommendation for this case.','winning','Momentum quality, slippage and eligibility not measured');
  }
 }
 if(v.price==='reversion'){
  if(v.stage==='new'&&v.session==='nyam'&&v.distance==='75plus'&&confirmed){
   jjTreeAdd(r,'New-funded 100-point mean-reversion model','study','JJ describes an approximately 25-point stop and 100-point target with two NQ in one historical 50K-funded example. A spoken 75-point opportunity threshold does NOT prove the 100-point exit reaches the fair-price anchor.','funded','Chart entry, stop, target and current firm terms unverified');
  }else if(v.stage==='new'){
   const reason=v.session==='nylate'?'JJ generally avoids the initial funded mean-reversion setup after 11 a.m.':v.distance==='under50'?'Insufficient available movement for the narrated 100-point example':!confirmed?'This example needs a recognized BOS, not just a wick or unconfirmed displacement':v.distance==='unknown'?'Fair-price distance not measured':'Historical first-funded 100-point conditions are incomplete';
   jjTreeAdd(r,'100-point funded model — not established','excluded','The inputs do not reproduce JJ\'s specific morning newly-funded example. Do not assume a 100-point trade qualifies.', 'funded',reason);
  }
  if(v.stage==='new'&&(v.session==='nyam'||v.session==='overnight')&&(v.distance==='50to74'||v.distance==='75plus')&&confirmed){
   jjTreeAdd(r,'Two-stage 50-point funded model','study','First leg in the lesson: 25-point stop and 50-point target with two NQ. A first win and first loss lead to different second-attempt branches; the sequence is not a single guaranteed +$4K outcome.','fifty','Second-attempt account constraints, time left and fill costs not checked');
  }else if(v.stage==='new'&&v.distance==='under50'){
   jjTreeAdd(r,'50-point funded pathway — room insufficient','excluded','The narrated 50-point destination is not supported by a smaller measured distance to the reference.','fifty','Recalculate the actual destination before studying a possible setup');
  }
  if(v.session==='overnight'&&confirmed&&(v.stage==='new'||v.stage==='winning'||v.stage==='evaluation')){
   jjTreeAdd(r,'Overnight structure-break case','verify','JJ discusses 50-point stops in general and a 30-point-stop exception. His overnight examples are conditional on bias, wick quality and the fair-price destination.','overnight','Original wick, session clock and chart target missing');
  }
  if(v.stage==='winning'&&confirmed){
   jjTreeAdd(r,'Winning-day fair-price reversion','study','JJ illustrates smaller structure-confirmed session reversions after an initial funded cushion. Actual winning-day qualification depends on the specific account agreement.','winning','Minimum qualifying amount, daily reset and account buffer unknown');
  }
  if(v.stage==='evaluation'&&confirmed){
   jjTreeAdd(r,'Evaluation-stage reversion','verify','JJ treats evaluation signals and position objectives separately from new-funded accounts. The reported lesson does not establish a universal contract size or stop for your account.','multi','Evaluation risk and available drawdown unspecified');
  }
  if(weak)jjTreeAdd(r,'Entry confirmation is incomplete','verify','JJ differentiates displacement-only or wick-only entries from A+ structure confirmation. His acceptance varies by account stage and trade type.','multi','Needs candle-level visual review');
 }
 if(v.stage==='after')jjTreeAdd(r,'Post-payout risk requires a fresh account-state check','verify','A post-payout funded account has different remaining loss buffer and payout economics. Do not reuse the newly-funded dollar-risk model without recalculation.','risk','Balance, trailing floor and actual provider terms missing');
 if(v.session==='nylate'&&v.stage==='new')jjTreeAdd(r,'After-11 exception needs context','verify','Live Q&A sometimes discusses later trend-following funded ideas, which are not interchangeable with the morning 100-point mean-reversion model.','multi','Direction, original chart and session quality not established');
 if(!r.some(x=>x.type==='study'))jjTreeAdd(r,'No confirmed strategy match','excluded','The combination does not reproduce a well-defined JJ case from the lessons reviewed. This is an information result, not a prediction.','multi','Missing evidence and/or an unstudied combination');
 if(unknown)jjTreeAdd(r,'Missing inputs','verify',unknown+' of 5 selectors remain unknown. An unknown input is never automatically treated as an approved trading condition.','risk','Record price references, account stage and structural evidence');
 return {r,unknown};
}
function jjTreeElement(tag,className,textValue){const e=document.createElement(tag);if(className)e.className=className;if(textValue!==undefined)e.textContent=textValue;return e}
function jjTreeCard(entry){
 const card=jjTreeElement('div','jj-tree-result '+entry.type);
 const head=jjTreeElement('div','jj-tree-result-head');
 head.append(jjTreeElement('strong','',entry.title),jjTreeElement('span','jj-tree-status',entry.type==='study'?'Study this method':entry.type==='verify'?'Requires verification':'Not established'));
 card.append(head,jjTreeElement('p','',entry.description),jjTreeElement('p','jj-tree-reason','Evidence gap: '+entry.reason));
 const s=jjTreeSources[entry.source];
 if(s){const a=jjTreeElement('a','jj-tree-source',s[0]+' · '+s[2]);a.href='https://drive.google.com/file/d/'+s[1]+'/view';a.target='_blank';a.rel='noopener noreferrer';card.append(a)}
 return card;
}
function jjTreeUpdate(){
 const root=document.querySelector('#jj-decision-tree');if(!root)return;
 const out=root.querySelector('#jj-tree-output');out.replaceChildren();
 const assessment=jjTreeAssess();
 const count=assessment.r.filter(x=>x.type==='study').length;
 out.append(jjTreeElement('div','jj-tree-outcome',count?count+' documented method'+(count===1?'':'s')+' to study':'No established strategy match'));
 for(const result of assessment.r)out.append(jjTreeCard(result));
}
function jjTreeMount(){
 const chapter=document.getElementById(jjTreeSlug);if(!chapter)return;
 if(chapter.querySelector('#jj-decision-tree'))return;
 const root=jjTreeElement('section','jj-tree');root.id='jj-decision-tree';
 root.append(jjTreeElement('h3','', 'Explore JJ’s decision logic'));
 root.append(jjTreeElement('p','jj-tree-intro','This tool compares your selections with narrated course examples. It does not recommend entering a trade or confirm prop-firm rule compliance.'));
 const fields=jjTreeElement('div','jj-tree-fields');
 const titles={stage:'1. Account stage',session:'2. Session',price:'3. Fair-price behavior',distance:'4. Available distance to reference',trigger:'5. Entry confirmation'};
 for(const [key,title] of Object.entries(titles)){
  const label=jjTreeElement('label','jj-tree-field');
  label.append(jjTreeElement('span','',title));
  const select=jjTreeElement('select');select.name=key;
  for(const [value,caption] of jjTreeLabels[key]){const option=jjTreeElement('option','',caption);option.value=value;select.append(option)}
  select.value=jjTreeState[key];select.addEventListener('change',()=>jjTreeChoice(key,select.value));label.append(select);fields.append(label);
 }
 root.append(fields);
 const button=jjTreeElement('button','jj-tree-reset','Reset selections');button.type='button';
 button.onclick=()=>{jjTreeState={...jjTreeDefaults};for(const field of fields.querySelectorAll('select'))field.value=jjTreeState[field.name];jjTreeUpdate()};
 root.append(button);
 const output=jjTreeElement('div','jj-tree-results');output.id='jj-tree-output';output.setAttribute('aria-live','polite');root.append(output);
 root.append(jjTreeElement('p','jj-tree-footnote','All price distances refer to index points in the cited NQ examples. Contract multipliers, trading costs, eligible payouts and current firm rules must be checked separately. Original video charts remain unverified.'));
 const toc=chapter.querySelector('.chapter-toc');if(toc)toc.before(root);else chapter.append(root);
 jjTreeUpdate();
}
const jjBeforeTreeRender=render;
render=function(){jjBeforeTreeRender();if(active===jjTreeSlug)jjTreeMount()};
jjRebuildMobileSelector();renderNav();render();
