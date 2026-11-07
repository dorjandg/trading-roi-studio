/* JJ Academy Update History: public GitHub commits + public workflow runs,
   with a verified non-sensitive snapshot fallback. Never loads private transcripts. */
(() => {
  'use strict';
  const root = document.getElementById('jj-update-history');
  if (!root) return;
  const repo = 'dorjandg/trading-roi-studio';
  const base = 'https://api.github.com/repos/' + repo;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, value) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (value != null) n.textContent = String(value);
    return n;
  };
  const state = { entries: [], page: 1, size: 10, loaded: false, busy: false, liveCommits: null, liveRuns: null, fallback: [], liveMessage: '' };
  const tz = 'Europe/Tirane';
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const validTime = x => Number.isFinite(Date.parse(x || ''));
  const timestamp = x => validTime(x) ? Date.parse(x) : 0;
  const formatTime = x => validTime(x) ? format.format(new Date(x)) : 'Not recorded';
  const isCommit = c => c && /^[a-f0-9]{40}$/.test(c.sha || '');
  const isRun = r => r && Number.isSafeInteger(r.id) && r.id > 0;
  const safeText = (x, max=400) => typeof x === 'string' ? x.slice(0,max) : '';
  const byNewest = (a,b) => timestamp(b.at)-timestamp(a.at) || a.id.localeCompare(b.id);

  const controls = {
    category: $('jj-history-filter'),
    search: $('jj-history-search'),
    size: $('jj-history-size'),
    reload: $('jj-history-reload'),
    body: $('jj-history-rows'),
    notice: $('jj-history-notice'),
    count: $('jj-history-count'),
    pageLabel: $('jj-history-page-label'),
    pages: $('jj-history-pages'),
    summary: $('jj-history-summary')
  };

  async function json(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' }, credentials: 'omit', signal: ctrl.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  async function allRecentCommits() {
    const collected = [];
    for (let page = 1; page <= 8; page++) {
      try {
        const batch = await json(base + '/commits?sha=jj-simon-knowledge-hub&path=jj-simon&per_page=100&page=' + page);
        if (!Array.isArray(batch)) throw new Error('Invalid GitHub commit page');
        collected.push(...batch);
        if (batch.length < 100) break;
      } catch (error) {
        if (!collected.length) throw error;
        break; // Preserve the pages already retrieved if a later page is unavailable.
      }
    }
    return collected;
  }

  function commitsToRows(items) {
    if (!Array.isArray(items)) throw new Error('GitHub commit list unavailable');
    return items.filter(isCommit).map(c => ({
      id: 'commit:' + c.sha, at: c.commit?.committer?.date || c.commit?.author?.date,
      category: 'academy', summary: safeText(c.commit?.message?.split('\n')[0] || 'Academy code update'),
      detail: 'Change committed to JJ Academy GitHub branch',
      status: 'Committed', url: 'https://github.com/' + repo + '/commit/' + c.sha
    }));
  }

  function runsToRows(items) {
    if (!Array.isArray(items)) throw new Error('GitHub workflow list unavailable');
    return items.filter(isRun).map(r => {
      const final = r.status === 'completed';
      const outcome = final ? ({success:'Completed',failure:'Failed',cancelled:'Cancelled',skipped:'Skipped'}[r.conclusion] || 'Completed') : (r.status || 'Pending');
      const label = r.event === 'schedule' ? 'Scheduled' : r.event === 'workflow_dispatch' ? 'Manual' : 'Automatic';
      return {
        id: 'run:' + r.id, at: r.created_at, category: 'job',
        summary: 'YouTube caption import job #' + (Number.isFinite(r.run_number) ? r.run_number : r.id),
        detail: label + ' GitHub workflow · Job completion does not confirm how many transcripts were imported',
        status: outcome,
        url: 'https://github.com/' + repo + '/actions/runs/' + r.id
      };
    });
  }

  function merge() {
    const found = new Map();
    // Public commit messages and public run metadata only; no private transcripts.
    for (const item of [...state.fallback, ...(state.liveCommits || []), ...(state.liveRuns || [])]) {
      if (!item || !item.id || !validTime(item.at)) continue;
      if (!['academy','job','transcript'].includes(item.category)) continue;
      found.set(item.id, item);
    }
    state.entries = Array.from(found.values()).sort(byNewest);
    if (state.entries.length) {
      controls.summary.textContent = 'Latest: ' + formatTime(state.entries[0].at) + ' · ' + state.entries.length + ' records';
    }
    render();
  }

  function displayed() {
    const type = controls.category.value, query = controls.search.value.toLocaleLowerCase().trim();
    return state.entries.filter(row =>
      (type === 'all' || row.category === type) &&
      (!query || [row.summary, row.detail, row.status].join(' ').toLocaleLowerCase().includes(query))
    );
  }

  function linkCell(row) {
    const cell = el('td');
    if (row.url && /^https:\/\/github\.com\/dorjandg\/trading-roi-studio\/(commit\/|actions\/runs\/)/.test(row.url)) {
      const a = el('a', '', row.category === 'job' ? 'Run' : 'Commit');
      a.href = row.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      cell.appendChild(a);
    } else {
      cell.appendChild(el('span', 'jj-history-kind', 'Verified record'));
    }
    return cell;
  }

  function tdText(s, className='') { return el('td', className, s); }
  function button(label, disabled, fn, current=false) {
    const b=el('button','',label);
    b.type='button'; b.disabled=disabled;
    if (current) b.setAttribute('aria-current','page');
    b.addEventListener('click',fn);
    return b;
  }

  function render() {
    const rows = displayed();
    const pages = Math.max(1, Math.ceil(rows.length/state.size));
    state.page = Math.max(1,Math.min(state.page,pages));
    controls.body.replaceChildren();
    const start = (state.page-1)*state.size;
    rows.slice(start,start+state.size).forEach((row,i) => {
      const tr = el('tr');
      tr.appendChild(tdText(start+i+1));
      tr.appendChild(tdText(formatTime(row.at),'jj-history-time'));
      tr.appendChild(tdText(({academy:'Academy',job:'YouTube job',transcript:'Transcript'}[row.category] || 'Update'),'jj-history-kind'));
      const what = el('td');
      what.appendChild(el('span','jj-history-desc',row.summary));
      if (row.detail) what.appendChild(el('small','jj-history-sub',row.detail));
      tr.appendChild(what);
      const status = tdText(row.status,'jj-history-state');
      status.dataset.state = /fail|cancel|error/i.test(row.status) ? 'failed' : /verified/i.test(row.status) ? 'verified' : 'normal';
      tr.appendChild(status);
      tr.appendChild(linkCell(row));
      controls.body.appendChild(tr);
    });
    if (!rows.length) {
      const tr = el('tr'), td=el('td','jj-history-empty',state.busy?'Loading history…':'No matching updates.');
      td.colSpan=6;tr.appendChild(td);controls.body.appendChild(tr);
    }
    controls.count.textContent = rows.length + ' row'+(rows.length===1?'':'s')+' · showing '+(rows.length?start+1:0)+'–'+Math.min(rows.length,start+state.size);
    controls.pageLabel.textContent='Page '+state.page+' of '+pages;
    controls.pages.replaceChildren();
    controls.pages.appendChild(button('Previous',state.page<=1,()=>{state.page--;render();}));
    const numbers = new Set([1,pages,state.page-1,state.page,state.page+1]);
    let prev=0;
    for (const n of [...numbers].filter(n=>n>=1&&n<=pages).sort((a,b)=>a-b)) {
      if (n>prev+1) controls.pages.appendChild(el('span','','…'));
      controls.pages.appendChild(button(String(n),false,()=>{state.page=n;render();},n===state.page));
      prev=n;
    }
    controls.pages.appendChild(button('Next',state.page>=pages,()=>{state.page++;render();}));
    controls.notice.textContent=state.liveMessage || 'GitHub history, with a verified local fallback.';
  }

  async function load(force=false) {
    if (state.busy || (state.loaded && !force)) return;
    state.busy=true;
    controls.reload.disabled=true;
    state.liveMessage='Loading saved and current GitHub history…';
    render();
    try {
      if (!state.fallback.length) {
        try {
          const backup=await json('./update-history-snapshot.json');
          if (Array.isArray(backup.entries)) {
            state.fallback=backup.entries.filter(x=>x&&typeof x.id==='string'&&validTime(x.at));
            merge();
          }
        } catch(e) { state.liveMessage='Saved snapshot unavailable; trying GitHub live history.'; }
      }
      const [commits,runs]=await Promise.allSettled([
        allRecentCommits(),
        json(base+'/actions/workflows/jj-youtube-ingest.yml/runs?per_page=50')
      ]);
      const issues=[];
      if (commits.status==='fulfilled') {
        state.liveCommits=commitsToRows(commits.value);
      } else { issues.push('Academy commit feed'); }
      if (runs.status==='fulfilled') {
        state.liveRuns=runsToRows(runs.value.workflow_runs || []);
      } else { issues.push('YouTube job feed'); }
      state.liveMessage=issues.length ?
        'Some live history unavailable ('+issues.join(', ')+'). Showing available records and saved history.' :
        'Live GitHub history loaded. Times are commit/job times, not guaranteed Cloudflare deployment times.';
      state.loaded=true;
    } catch (error) {
      state.liveMessage='Live update history could not be fully refreshed. Displaying saved history instead.';
      state.loaded=true;
    } finally {
      state.busy=false;
      controls.reload.disabled=false;
      merge();
    }
  }

  root.addEventListener('toggle', () => { if (root.open) load(); });
  controls.category.addEventListener('change', () => {state.page=1;render();});
  controls.search.addEventListener('input', () => {state.page=1;render();});
  controls.size.addEventListener('change', () => {state.size=Number(controls.size.value)||10;state.page=1;render();});
  controls.reload.addEventListener('click',()=>load(true));
  render();
})();
