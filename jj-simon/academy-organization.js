/* Academy navigation and dashboard organization — preserve original slugs/study state. */
const jjGroups=['Learn Strategies','Account Management','Calculators & Simulations','Math & Research','Student Q&A'];
const jjGeneralChapters=['terminology-consistency-audit','academy-study-assistant'];
function jjIsGeneral(slug){return jjGeneralChapters.includes(slug)}
function jjGeneralTitle(slug){return slug==='terminology-consistency-audit'?'Trading Dictionary':'Study Assistant'}
function jjGeneralButton(slug){const m=curriculum.find(x=>x.slug===slug);if(!m)return null;const b=document.createElement('button');b.type='button';b.className='jj-general-button'+(active===slug?' active':'');b.textContent=(slug==='terminology-consistency-audit'?'▤ ':'✧ ')+jjGeneralTitle(slug);b.onclick=()=>pick(slug);return b;}

const jjCategoryOverrides={
'master-strategy-encyclopedia':'Learn Strategies','fair-price':'Learn Strategies','bos-entry':'Learn Strategies','winning-days':'Learn Strategies','trading-rules-playbook':'Learn Strategies',
'funded-plan':'Account Management','account-management':'Account Management','evaluation':'Account Management','scaling':'Account Management','portfolio-risk':'Account Management','prop-firm-reference':'Account Management',
'youtube-transcript-research':'Math & Research','public-web-research':'Math & Research','kpi-library':'Math & Research','kpi-workbench':'Calculators & Simulations','calc-acquisition':'Calculators & Simulations','risk-math':'Math & Research','source-coverage':'Math & Research','critical-rules':'Math & Research',
'examples':'Student Q&A','live-qa-extract':'Student Q&A','live-qa-deep-dive':'Student Q&A','live-claim-verification':'Student Q&A','qa-contradictions':'Student Q&A'
};
function jjGroupFor(m){
 if(jjCategoryOverrides[m.slug])return jjCategoryOverrides[m.slug];
 const t=(m.slug+' '+m.title).toLowerCase();
 if(t.includes('qa')||t.includes('student')||t.includes('question')||t.includes('casebook'))return 'Student Q&A';
 if(t.includes('account')||t.includes('funded')||t.includes('portfolio')||t.includes('scaling')||t.includes('payout')||t.includes('firm'))return 'Account Management';
 if(t.includes('bos')||t.includes('entry')||t.includes('strategy')||t.includes('fair-price')||t.includes('winning-day')||t.includes('overnight'))return 'Learn Strategies';
 return 'Math & Research';
}
const jjGroupOrder=Object.fromEntries(jjGroups.map((x,i)=>[x,i]));
curriculum.sort((a,b)=>jjGroupOrder[jjGroupFor(a)]-jjGroupOrder[jjGroupFor(b)]);
const jjOpenGroups={};
const jjDashboardOpenGroups={};
function jjDisplayChapterTitle(m,position){
 const raw=String(m.title||'').replace(/^\s*(?:(?:\d{1,3})\s*[·.:-]\s*|[★☆]\s*)/u,'').trim();
 return String(position+1).padStart(2,'0')+' · '+raw;
}
const jjPreferredChapterOrder={
 'Learn Strategies':['master-strategy-encyclopedia','strategy-decision-tree','fair-price','bos-entry','winning-days','trading-rules-playbook'],
 'Account Management':['funded-plan','evaluation','account-management','scaling','portfolio-risk','prop-firm-reference'],
 'Calculators & Simulations':['kpi-workbench','calc-acquisition'],
 'Math & Research':['youtube-transcript-research','public-web-research','research-completion-dashboard','source-evidence-explorer','risk-math','kpi-library','kpi-workbench','source-coverage','critical-rules','research-verification-tracker','visual-evidence-worklist','course-conflict-register'],
 'Student Q&A':['student-qa-library','examples','live-qa-extract','live-qa-deep-dive','live-claim-verification']
};
function jjCurrentOrderedMembers(group){
 const rank=jjPreferredChapterOrder[group]||[];
 return curriculum.filter(m=>jjGroupFor(m)===group).sort((a,b)=>{
  const ia=rank.indexOf(a.slug),ib=rank.indexOf(b.slug);
  if(ia<0&&ib<0)return 0;
  if(ia<0)return 1;if(ib<0)return -1;
  return ia-ib;
 });
}

const jjRenderOriginal=render;
render=function(){
 jjRenderOriginal();
 if(active!=='dashboard'){
  if(jjIsGeneral(active)){
   const article=document.getElementById(active);
   const heading=article?article.querySelector(':scope > h2'):null;
   if(heading)heading.textContent=jjGeneralTitle(active);
   const crumb=$('chapter-crumb');if(crumb)crumb.textContent='Dashboard / '+jjGeneralTitle(active);
   return;
  }
  const m=curriculum.find(item=>item.slug===active);
  if(m){
   const members=jjCurrentOrderedMembers(jjGroupFor(m));
   const title=jjDisplayChapterTitle(m,members.findIndex(item=>item.slug===m.slug));
   const article=document.getElementById(active);
   const heading=article?article.querySelector(':scope > h2'):null;
   if(heading)heading.textContent=title;
   const crumb=$('chapter-crumb');if(crumb)crumb.textContent='Dashboard / '+jjGroupFor(m)+' / '+title;
  }
  return;
 }
 const root=document.querySelector('#chapters .dash-overview');
 if(!root)return;
 const cards=[...root.querySelectorAll(':scope > .dash-module')];
 const byId=new Map(cards.map(node=>[node.dataset.go,node]));
 root.textContent='';
 const general=document.createElement('section');general.className='jj-general-dashboard';
 for(const slug of jjGeneralChapters){
  const m=curriculum.find(x=>x.slug===slug);
  if(!m)continue;
  const tile=byId.get(slug);
  if(tile){tile.classList.add('jj-general-tile');const name=tile.querySelector('.dash-module-left > span:not(.statusdot)');if(name)name.textContent=jjGeneralTitle(slug);general.appendChild(tile)}
  else {const button=jjGeneralButton(slug);if(button)general.appendChild(button)}
 }
 if(general.children.length)root.appendChild(general);
 for(const group of jjGroups){
  const members=jjCurrentOrderedMembers(group).filter(m=>!jjIsGeneral(m.slug)&&byId.has(m.slug));
  if(!members.length)continue;
  const section=document.createElement('details');section.className='jj-dashboard-group';
  section.open=jjDashboardOpenGroups[group]===true;
  const heading=document.createElement('summary');heading.className='jj-dashboard-heading';
  const caption=document.createElement('strong');caption.textContent=group;
  const count=document.createElement('span');count.textContent=members.length+' chapters';
  heading.append(caption,count);section.appendChild(heading);
  const rows=document.createElement('div');rows.className='jj-dashboard-rows';
  members.forEach((m,i)=>{
   const card=byId.get(m.slug);
   const name=card.querySelector('.dash-module-left > span:not(.statusdot)');
   if(name)name.textContent=jjDisplayChapterTitle(m,i);
   rows.appendChild(card);
  });
  section.appendChild(rows);
  section.addEventListener('toggle',()=>{jjDashboardOpenGroups[group]=section.open});
  root.appendChild(section);
 }
};
renderNav=function(){
 const nav=$('nav');nav.textContent='';
 const dash=document.createElement('button');dash.type='button';dash.textContent='◫ Dashboard';
 dash.className=active==='dashboard'?'active':'';dash.onclick=()=>pick('dashboard');nav.appendChild(dash);
 for(const slug of jjGeneralChapters){const b=jjGeneralButton(slug);if(b)nav.appendChild(b)}
 for(const group of jjGroups){
  const members=jjCurrentOrderedMembers(group).filter(m=>!jjIsGeneral(m.slug));
  if(!members.length)continue;
  const section=document.createElement('details');section.className='jj-nav-group';
  section.open=jjOpenGroups[group]===true || members.some(m=>m.slug===active);
  const title=document.createElement('summary');title.textContent=group;
  const count=document.createElement('span');count.textContent=members.length;title.appendChild(count);
  section.appendChild(title);
  members.forEach((m,i)=>{
   const b=document.createElement('button');b.type='button';
   b.className=active===m.slug?'active':'';
   b.dataset.id=m.slug;
   b.innerHTML='<span class="module-line">'+symbol(m.status)+'<span class="module-name">'+E(jjDisplayChapterTitle(m,i))+'</span></span>';
   b.onclick=()=>pick(m.slug);
   section.appendChild(b);
  });
  section.addEventListener('toggle',()=>{jjOpenGroups[group]=section.open});
  nav.appendChild(section);
 }
};
function jjRebuildMobileSelector(){
 const select=$('mobile');select.textContent='';
 const home=document.createElement('option');home.value='dashboard';home.textContent='◫ Dashboard';select.appendChild(home);
 for(const slug of jjGeneralChapters){if(!curriculum.some(m=>m.slug===slug))continue;const option=document.createElement('option');option.value=slug;option.textContent=jjGeneralTitle(slug);select.appendChild(option)}
 for(const group of jjGroups){
  const optgroup=document.createElement('optgroup');optgroup.label=group;
  jjCurrentOrderedMembers(group).filter(m=>!jjIsGeneral(m.slug)).forEach((m,i)=>{
   const option=document.createElement('option');option.value=m.slug;option.textContent=jjDisplayChapterTitle(m,i);optgroup.appendChild(option);
  });
  select.appendChild(optgroup);
 }
 select.value=active;
}
jjRebuildMobileSelector();
renderNav();render();
