/* JJ Academy: show only this browser's own queued questions and answer updates.
   No private question or transcript is ever committed to the public repository. */
(() => {
  'use strict';
  const root=document.getElementById('jj-updated-answers');
  if(!root) return;
  const $=id=>document.getElementById(id);
  const storeKey='jj-updated-answer-cache-v1';
  const sourceUrl='https://docs.google.com/spreadsheets/d/1kdDaTIsElKKI8l3SwDZGCkCwhoo4b-lqk6SlUVUhk_U/edit?gid=27471300#gid=27471300';
  const state={data:{},page:1,size:10,loading:false,loaded:false,notice:''};
  const nativeRows=()=>{
    try {
      if(typeof jjQueueRead==='function')return jjQueueRead();
      const v=JSON.parse(localStorage.getItem('jj-unanswered-questions-v1')||'[]');
      return Array.isArray(v)?v:[];
    } catch(_){return []}
  };
  const node=(tag,text,cls)=>{
    const x=document.createElement(tag);
    if(cls)x.className=cls;
    if(text!==undefined&&text!==null)x.textContent=String(text);
    return x;
  };
  const statusLabel={new:'Queued',researching:'Researching',needs_review:'New research draft',approved:'Reviewed',published:'Published',resolved:'Resolved',rejected:'Not supported'};
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Tirane',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const time=x=>x&&Number.isFinite(Date.parse(x))?formatter.format(new Date(x)):'—';
  try{const cache=JSON.parse(localStorage.getItem(storeKey)||'{}');if(cache&&typeof cache==='object'&&!Array.isArray(cache))state.data=cache}catch(_){}
  function save(){try{localStorage.setItem(storeKey,JSON.stringify(state.data))}catch(_){}}
  const endpoint=()=>typeof jjCloudEndpoint==='function'?jjCloudEndpoint():'';
  const optedIn=()=>typeof jjQuestionShareEnabled==='function'&&jjQuestionShareEnabled();
  const caption=$('jj-answers-summary'),body=$('jj-answers-rows'),search=$('jj-answers-search'),
    filter=$('jj-answers-filter'),size=$('jj-answers-size'),pages=$('jj-answers-pages'),
    total=$('jj-answers-total'),message=$('jj-answers-message'),refreshButton=$('jj-answers-refresh');

  function readStatus(secret,action='status'){
    return new Promise((resolve,reject)=>{
      const url=endpoint();
      if(!url||(action==='status'&&!secret))return reject(new Error('Not connected'));
      const callback='jjAnsCb'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      let timer;
      const finish=(error,data)=>{
        clearTimeout(timer);
        script.remove();
        try{delete window[callback]}catch(_){}
        error?reject(error):resolve(data);
      };
      window[callback]=res=>finish(null,res);
      script.onerror=()=>finish(new Error('Answer connection unavailable'));
      timer=setTimeout(()=>finish(new Error('Answer request timed out')),14000);
      script.referrerPolicy='no-referrer';
      script.src=url+(url.includes('?')?'&':'?')+new URLSearchParams({
        action,receipt:secret||'',callback,t:Date.now()
      });
      document.head.append(script);
    });
  }

  function eligible(){
    const q=search.value.trim().toLocaleLowerCase();
    return nativeRows().filter(row=>{
      const d=state.data[row.key]||{};
      const s=String(d.status||'queued');
      return (filter.value==='all'||filter.value===s||(filter.value==='updated'&&!!d.answer))&&
        (!q||(row.question+' '+s+' '+(d.answer||'')).toLocaleLowerCase().includes(q));
    }).sort((a,b)=>{
      const at=x=>Date.parse((state.data[x.key]||{}).updatedAt||x.lastSeen||x.createdAt||'')||0;
      return at(b)-at(a);
    });
  }

  function answerHistory(td,d){
    const history=Array.isArray(d.history)?d.history:[];
    if(!history.length)return;
    const wrap=node('details',null,'jj-answers-history');
    wrap.append(node('summary','Previous answer updates ('+history.length+')'));
    for(const version of history){
      const item=node('div',null,'jj-answers-version');
      item.append(node('time',time(version.at)+' · '+(statusLabel[version.status]||version.status||'Review')));
      if(version.answer)item.append(node('div',version.answer,'jj-answers-preview'));
      if(version.note)item.append(node('small',version.note));
      if(version.evidence)item.append(node('small','Evidence IDs: '+version.evidence));
      wrap.append(item);
    }
    td.append(wrap);
  }

  function render(){
    const list=eligible(),count=list.length,max=Math.max(1,Math.ceil(count/state.size));
    state.page=Math.max(1,Math.min(state.page,max));
    const start=(state.page-1)*state.size;
    body.replaceChildren();
    list.slice(start,start+state.size).forEach((row,i)=>{
      const d=state.data[row.key]||{},tr=node('tr');
      tr.append(node('td',start+i+1));
      const q=node('td',row.question,'jj-answers-question');tr.append(q);
      tr.append(node('td',time(d.updatedAt||row.lastSeen||row.createdAt),'jj-answers-time'));
      const status=d.status||(!row.synced?'local':'queued');
      const statusCell=node('td',statusLabel[status]||status,'jj-answers-status');
      statusCell.dataset.status=status;tr.append(statusCell);
      const answer=node('td');
      if(d.answer){
        answer.append(node('div',d.answer,'jj-answers-preview'));
        if(status==='needs_review')answer.append(node('small','Research draft — not yet verified or published.'));
        if(d.evidence)answer.append(node('small','Evidence: '+d.evidence));
      }else{
        answer.append(node('span',row.synced?'Awaiting reviewed answer or secure readback':'Saved on this device; cloud sync not verified.','jj-answers-note'));
      }
      answerHistory(answer,d);
      tr.append(answer);
      body.append(tr);
    });
    if(!count){
      const tr=node('tr'),cell=node('td','No questions match. Ask in Study Assistant, or open the private review sheet.','jj-answers-empty');
      cell.colSpan=5;tr.append(cell);body.append(tr);
    }
    pages.replaceChildren();
    const addBtn=(text,disabled,page)=>{
      const b=node('button',text);b.type='button';b.disabled=disabled;
      if(page===state.page&&text!=='Previous'&&text!=='Next')b.setAttribute('aria-current','page');
      b.addEventListener('click',()=>{state.page=page;render()});pages.append(b);
    };
    addBtn('Previous',state.page<=1,state.page-1);
    const choices=[...new Set([1,max,state.page-1,state.page,state.page+1])].filter(x=>x>=1&&x<=max).sort((a,b)=>a-b);
    choices.forEach(x=>addBtn(String(x),false,x));
    addBtn('Next',state.page>=max,state.page+1);
    total.textContent=count+' question'+(count===1?'':'s')+' · page '+state.page+' of '+max;
    caption.textContent=(nativeRows().length||0)+' saved question(s) · '+Object.values(state.data).filter(x=>x.answer).length+' with answer updates';
    message.textContent=state.notice||'Open to refresh this device’s question answers; dates are shown in Albania time.';
  }

  async function refresh(){
    if(state.loading)return;
    state.loading=true;refreshButton.disabled=true;
    state.notice='Checking private question updates…';render();
    try{
      if(!optedIn()){
        state.notice='Private sync is off. Enable it in Study Assistant to retrieve updates; local questions remain visible.';
        return;
      }
      if(!endpoint()){
        state.notice='Question review service is not configured. See the private Google Sheet for current research.';
        return;
      }
      let health;
      try{health=await readStatus('', 'health')}catch(_){health=null}
      if(health?.ok!==true||health?.version!=='answers-v2'){
        state.notice='Google Apps Script needs updating: replace Code.gs with the latest JJ Academy version and redeploy the EXISTING web app (New version). Existing answers remain safe in the private Sheet.';
        return;
      }
      if(typeof jjQueueSyncPending==='function')await jjQueueSyncPending();
      const pending=nativeRows().filter(r=>r.accessReceipt&&r.serverId).slice(-25);
      if(!pending.length){
        state.notice='No linked questions on this device yet. Existing private research can be viewed in the Google Sheet.';
        return;
      }
      let ok=0,fail=0,upgrade=false;
      for(const row of pending){
        try{
          let res=await readStatus(row.accessReceipt);
          // Older verified receipts preceded private answer access. Automatically
          // relink only if the upgraded server explicitly reports no capability.
          if(res?.ok===false&&String(res.error||'').includes('Question access unavailable')&&
             typeof jjQueueTrySync==='function'){
            const linked=await jjQueueTrySync(row.question,row.reason||'Previously reviewed question',row.matchCount||0,true);
            const newest=nativeRows().find(x=>x.key===row.key);
            if(linked&&newest?.accessReceipt)res=await readStatus(newest.accessReceipt);
          }
          if(res?.ok===true&&res.id===row.serverId){
            state.data[row.key]={status:String(res.status||'queued'),answer:String(res.answer||''),
              evidence:String(res.evidence||''),updatedAt:res.updatedAt||'',
              history:Array.isArray(res.history)?res.history.slice(0,12):[]};
            ok++;
          }else{
            fail++;
            if(String(res?.error||'').includes('Only receipt verification'))upgrade=true;
          }
        }catch(_){fail++}
      }
      save();
      state.notice=upgrade?'The website is ready; the Google Apps Script answer-readback deployment still needs updating.':
        ok+' question(s) checked'+(fail?' · '+fail+' could not be refreshed':'')+'. Research drafts are labeled separately from published answers.';
    }finally{state.loading=false;refreshButton.disabled=false;render()}
  }

  $('jj-answers-private-sheet').href=sourceUrl;
  root.addEventListener('toggle',()=>{if(root.open&&!state.loaded){state.loaded=true;refresh()}});
  refreshButton.addEventListener('click',refresh);
  search.addEventListener('input',()=>{state.page=1;render()});
  filter.addEventListener('change',()=>{state.page=1;render()});
  size.addEventListener('change',()=>{state.size=Number(size.value)||10;state.page=1;render()});
  render();
})();