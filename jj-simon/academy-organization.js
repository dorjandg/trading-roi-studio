/* Academy navigation and dashboard organization — preserve original slugs/study state. */
const jjGroups=['Learn Strategies','Account Management','Math & Research','Student Q&A'];
const jjCategoryOverrides={
'master-strategy-encyclopedia':'Learn Strategies','fair-price':'Learn Strategies','bos-entry':'Learn Strategies','winning-days':'Learn Strategies','trading-rules-playbook':'Learn Strategies',
'funded-plan':'Account Management','account-management':'Account Management','evaluation':'Account Management','scaling':'Account Management','portfolio-risk':'Account Management','prop-firm-reference':'Account Management',
'kpi-library':'Math & Research','kpi-workbench':'Math & Research','risk-math':'Math & Research','source-coverage':'Math & Research','critical-rules':'Math & Research',
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
function jjCurrentOrderedMembers(group){return curriculum.filter(m=>jjGroupFor(m)===group);}

const jjRenderOriginal=render;
render=function(){
 jjRenderOriginal();
 if(active!=='dashboard')return;
 const root=document.querySelector('#chapters .dash-overview');
 if(!root)return;
 const cards=[...root.querySelectorAll(':scope > .dash-module')];
 const byId=new Map(cards.map(node=>[node.dataset.go,node]));
 root.textContent='';
 for(const group of jjGroups){
  const members=jjCurrentOrderedMembers(group).filter(m=>byId.has(m.slug));
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
 for(const group of jjGroups){
  const members=jjCurrentOrderedMembers(group);
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
 for(const group of jjGroups){
  const optgroup=document.createElement('optgroup');optgroup.label=group;
  jjCurrentOrderedMembers(group).forEach((m,i)=>{
   const option=document.createElement('option');option.value=m.slug;option.textContent=jjDisplayChapterTitle(m,i);optgroup.appendChild(option);
  });
  select.appendChild(optgroup);
 }
 select.value=active;
}
jjRebuildMobileSelector();
renderNav();render();
