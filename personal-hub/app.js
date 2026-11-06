(() => {
  "use strict";
  const library = window.PERSONAL_HUB_DATA;
  if (!library || !Array.isArray(library.categories) || !Array.isArray(library.links)) {
    document.getElementById("mainContent").textContent = "Link library could not be loaded.";
    return;
  }
  const $ = (selector) => document.querySelector(selector);
  const store = {
    get(key, fallback) { try { const raw = localStorage.getItem("personal-hub:"+key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem("personal-hub:"+key, JSON.stringify(value)); } catch {} }
  };
  const categories = [...library.categories].sort((a,b) => a.order - b.order);
  const links = library.links.filter(x => /^https:\/\//i.test(x.url));
  const byId = new Map(links.map(link => [link.id,link]));
  const byCategory = new Map(categories.map(cat => [cat.id,cat]));
  const persistedFavorites = store.get("favorites", []);
  const persistedRecents = store.get("recent", []);
  const state = {
    view:"overview", category:null, query:"",
    favorites:new Set((Array.isArray(persistedFavorites)?persistedFavorites:[]).filter(id => byId.has(id))),
    recents:(Array.isArray(persistedRecents)?persistedRecents:[]).filter(id => byId.has(id)).slice(0,12),
    theme:store.get("theme","dark")==="light"?"light":"dark"
  };
  const iconPaths = {
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    star:'<path d="m12 2 3.1 6.4 7 1-5 4.9 1.2 7-6.3-3.3-6.3 3.3 1.2-7-5-4.9 7-1z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    book:'<path d="M4 4.5C8 3 11 4 12 5v15c-2-1.5-5-2.2-8-1.5zM20 4.5c-4-1.5-7-.5-8 .5v15c2-1.5 5-2.2 8-1.5z"/>',
    chart:'<path d="M3 20h18M5 17l5-6 4 3 5-8"/>',
    play:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m10 8 6 4-6 4z"/>',
    file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 12h6M9 16h6"/>',
    heart:'<path d="M20 8c0 5-8 11-8 11S4 13 4 8a4 4 0 0 1 8-1 4 4 0 0 1 8 1z"/>',
    layers:'<path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
    external:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5H5V5h6"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:'<path d="M20.5 14.5A9 9 0 0 1 9.5 3.5a9 9 0 1 0 11 11z"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>'
  };
  function svg(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(iconPaths[name]||iconPaths.grid)+'</svg>'; }
  function escapeHTML(x) { return String(x==null?"":x).replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function categoryName(id) { return byCategory.get(id)?.name || "Other"; }
  function categoryCount(id) { return links.filter(l => l.category===id).length; }
  function safeColor(color) { return /^(blue|purple|green|emerald|red)$/.test(color) ? color : "blue"; }
  function catButton(cat) {
    return '<button class="collection-card" type="button" data-category="'+escapeHTML(cat.id)+'">'+
      '<div class="collection-head"><span class="collection-icon">'+svg(cat.icon)+'</span><span class="collection-count">'+categoryCount(cat.id)+' links</span></div>'+
      '<div><h3>'+escapeHTML(cat.name)+'</h3><p>'+escapeHTML(cat.description)+'</p></div></button>';
  }
  function card(link, featured=false) {
    const favorite = state.favorites.has(link.id);
    const url = escapeHTML(link.url);
    return '<article class="'+(featured?"featured-card":"link-card")+' accent-'+safeColor(link.accent)+'">'+
      '<a class="card-main-link" href="'+url+'" target="_blank" rel="noopener noreferrer" data-open-id="'+escapeHTML(link.id)+'" aria-label="Open '+escapeHTML(link.title)+' in a new tab"></a>'+
      '<div class="card-header"><span class="card-logo" aria-hidden="true">'+escapeHTML(link.symbol||link.title[0])+'</span>'+
      '<div class="card-actions"><button type="button" class="card-action '+(favorite?"favorite":"")+'" data-fav="'+escapeHTML(link.id)+'" aria-label="'+(favorite?"Remove ":"Add ")+escapeHTML(link.title)+(favorite?" from":" to")+' favorites" title="'+(favorite?"Remove favorite":"Add to favorites")+'">'+svg("star")+'</button></div></div>'+
      '<div class="card-title">'+escapeHTML(link.title)+'</div><p class="card-desc">'+escapeHTML(link.description)+'</p>'+
      '<div class="card-foot"><span class="type-pill">'+escapeHTML(link.type||categoryName(link.category))+'</span>'+
      '<span class="card-open">Open website '+svg("external")+'</span></div></article>';
  }
  function empty(title, description) {
    return '<div class="empty-state"><span class="empty-illustration">'+svg("plus")+'</span><h3>'+escapeHTML(title)+'</h3><p>'+escapeHTML(description)+'</p><button class="add-button" data-request type="button">+ Request a link</button></div>';
  }
  function navButton(type,label,icon,count) {
    const active=state.view===type;
    return '<button type="button" class="side-link '+(active?"active":"")+'" data-nav="'+type+'" aria-current="'+(active?"page":"false")+'">'+svg(icon)+'<span>'+escapeHTML(label)+'</span>'+(count==null?"":'<span class="nav-count">'+count+'</span>')+'</button>';
  }
  function renderNav() {
    $("#topNavigation").innerHTML =
      navButton("overview","Overview","home")+
      navButton("all","All links","grid",links.length)+
      navButton("favorites","Favorites","star",state.favorites.size)+
      navButton("recent","Recently opened","clock",state.recents.length);
    $("#categoryNavigation").innerHTML = categories.map(cat => {
      const active=state.view==="category" && state.category===cat.id;
      return '<button type="button" class="side-link '+(active?"active":"")+'" data-category="'+escapeHTML(cat.id)+'" aria-current="'+(active?"page":"false")+'">'+svg(cat.icon)+'<span>'+escapeHTML(cat.name)+'</span><span class="nav-count">'+categoryCount(cat.id)+'</span></button>';
    }).join("");
    $("#collectionCount").textContent=categories.length;
  }
  function scores(link,q) {
    const name=link.title.toLowerCase(), tags=(link.tags||[]).join(" ").toLowerCase();
    const body=[link.description,categoryName(link.category),link.type,link.url].join(" ").toLowerCase();
    if (name===q) return 100;
    if (name.startsWith(q)) return 90;
    if (name.includes(q)) return 80;
    if (tags.includes(q)) return 65;
    if (body.includes(q)) return 35;
    const words=q.split(/\s+/).filter(Boolean);
    return words.length>1 && words.every(w=>(name+" "+tags+" "+body).includes(w)) ? 20 : 0;
  }
  function searchResults(query) {
    const q=query.trim().toLowerCase();
    if (!q) return [...links];
    return links.map(link=>({link,score:scores(link,q)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.link.title.localeCompare(b.link.title)).map(x=>x.link);
  }
  function renderSuggestions() {
    const q=state.query.trim(), pane=$("#searchSuggestions");
    if(!q || document.activeElement!==$("#globalSearch")){pane.hidden=true;pane.innerHTML="";return;}
    const matched=searchResults(q).slice(0,5);
    const matchedCats=categories.filter(cat=>cat.name.toLowerCase().includes(q.toLowerCase())).slice(0,2);
    let html='<div class="suggest-label">'+(matched.length?"MATCHING LINKS":"NO MATCHING LINKS")+'</div>';
    html+=matched.map(l=>'<button class="suggestion" type="button" data-suggest="'+escapeHTML(l.id)+'"><span class="suggestion-icon">'+escapeHTML(l.symbol||"•")+'</span><span><strong>'+escapeHTML(l.title)+'</strong><small>'+escapeHTML(categoryName(l.category))+'</small></span></button>').join("");
    if(matchedCats.length){
      html+='<div class="suggest-label">COLLECTIONS</div>'+matchedCats.map(c=>'<button class="suggestion" type="button" data-category="'+escapeHTML(c.id)+'"><span class="suggestion-icon">'+svg(c.icon)+'</span><span><strong>'+escapeHTML(c.name)+'</strong><small>Browse this collection</small></span></button>').join("");
    }
    if (!matched.length && !matchedCats.length) html+='<div class="suggest-label">Try trading, study, WHOOP or sheets</div>';
    pane.innerHTML=html;pane.hidden=false;
  }
  function renderOverview() {
    const featured=links.filter(l=>l.featured);
    const quick=links.filter(l=>!l.featured);
    const recents=state.recents.map(id=>byId.get(id)).filter(Boolean).slice(0,3);
    return '<section class="hero"><div><div class="eyebrow">WELCOME TO YOUR WORKSPACE</div><h1 class="hero-title">Everything in <span>one place.</span></h1>'+
      '<p class="hero-subtitle">Your websites, study material, dashboards and everyday resources — organized, searchable and always easy to reach.</p></div>'+
      '<div class="hero-stats"><div class="stat"><b>'+links.length+'</b><small>Saved links</small></div><div class="stat"><b>'+categories.length+'</b><small>Collections</small></div><div class="stat"><b>'+state.favorites.size+'</b><small>Favorites</small></div></div></section>'+
      '<section class="section"><div class="section-heading"><div><h2>My websites</h2><p class="section-subtitle">Your projects — one click away</p></div><button type="button" class="section-action" data-category="workspaces">View all →</button></div>'+
      '<div class="featured-grid">'+featured.map(l=>card(l,true)).join("")+'</div></section>'+
      '<section class="section"><div class="section-heading"><div><h2>Browse collections</h2><p class="section-subtitle">Everything has a place</p></div></div><div class="collection-grid">'+categories.map(catButton).join("")+'</div></section>'+
      (recents.length?'<section class="section"><div class="section-heading"><div><h2>Recently opened</h2></div><button type="button" class="section-action" data-nav="recent">See all →</button></div><div class="link-grid">'+recents.map(l=>card(l)).join("")+'</div></section>':"")+
      '<section class="section"><div class="section-heading"><div><h2>Quick access</h2><p class="section-subtitle">Useful places beyond your projects</p></div><button type="button" class="section-action" data-nav="all">All links →</button></div>'+
      '<div class="link-grid">'+quick.map(l=>card(l)).join("")+'</div></section>'+
      '<div class="notice-card"><span class="notice-symbol">✦</span><div><b>Your library can grow without limits</b><span>Add a website, a Google Sheet, a YouTube video or a new category whenever you need it.</span></div><button type="button" data-request>Add a link →</button></div>';
  }
  function renderListing(title,subtitle,items,emptyHeading,emptyText,showFilters=false) {
    return '<div class="section-top"><div><div class="eyebrow">YOUR LIBRARY</div><h1>'+escapeHTML(title)+'</h1><p>'+escapeHTML(subtitle)+'</p></div>'+
      '<div class="section-top-right"><span class="count-pill">'+items.length+' '+(items.length===1?"link":"links")+'</span><button class="add-button" type="button" data-request>+ Add</button></div></div>'+
      (showFilters?'<div class="filter-row"><button type="button" class="filter-chip active" data-nav="all">All</button>'+categories.map(cat=>'<button type="button" class="filter-chip" data-category="'+escapeHTML(cat.id)+'">'+escapeHTML(cat.name)+'</button>').join("")+'</div>':"")+
      (items.length?'<div class="link-grid">'+items.map(l=>card(l)).join("")+'</div>':empty(emptyHeading,emptyText));
  }
  function renderMain() {
    let current="Overview", html="";
    if (state.query.trim()) {
      current="Search";
      const result=searchResults(state.query);
      html=renderListing('Search results','Results matching “'+state.query+'”',result,'Nothing found','Try a different word, or request a new link to add to this library.');
    } else if(state.view==="all") {
      current="All links";
      html=renderListing("All links","Every saved destination in your workspace",links,"No links yet","Add your first link.",true);
    } else if(state.view==="favorites") {
      current="Favorites";
      html=renderListing("Favorites","Your starred links, saved on this device",links.filter(l=>state.favorites.has(l.id)),"No favorites yet","Tap the star on any website card to keep it here.");
    } else if(state.view==="recent") {
      current="Recently opened";
      html=renderListing("Recently opened","A short history stored on this device",state.recents.map(id=>byId.get(id)).filter(Boolean),"Nothing opened yet","Open any website from this hub and it will appear here.");
    } else if(state.view==="category") {
      const cat=byCategory.get(state.category);
      if(cat){current=cat.name;html=renderListing(cat.name,cat.description,links.filter(l=>l.category===cat.id),"This collection is ready","Send a link to ChatGPT to add it to this category.");}
      else{state.view="overview";html=renderOverview();}
    } else {state.view="overview";html=renderOverview();}
    $("#mainContent").innerHTML=html;
    $("#breadcrumbCurrent").textContent=current;
    renderNav();
  }
  function navigate(view,category=null) {
    state.view=view;state.category=category;state.query="";$("#globalSearch").value="";
    $("#searchSuggestions").hidden=true;closeMenu();renderMain();window.scrollTo({top:0,behavior:"instant"});
  }
  function toggleFavorite(id) {
    if(!byId.has(id))return;
    if(state.favorites.has(id))state.favorites.delete(id);else state.favorites.add(id);
    store.set("favorites",[...state.favorites]);renderMain();
    if(state.query)renderSuggestions();
  }
  function trackRecent(id) {
    if(!byId.has(id))return;
    state.recents=[id,...state.recents.filter(x=>x!==id)].slice(0,12);
    store.set("recent",state.recents);
    renderNav();
  }
  function applyTheme() {
    document.body.classList.toggle("light",state.theme==="light");
    document.querySelector('meta[name="theme-color"]').content=state.theme==="light"?"#f5f7fb":"#0b1020";
    $("#themeButton").innerHTML=svg(state.theme==="light"?"moon":"sun");
    $("#themeButton").title=state.theme==="light"?"Switch to dark mode":"Switch to light mode";
  }
  function closeMenu() { $("#sidebar").classList.remove("open");$("#mobileScrim").hidden=true;$("#menuButton").setAttribute("aria-expanded","false"); }
  function openDialog() {
    $("#requestForm").reset();$("#requestError").textContent="";
    $("#copyRequestButton").textContent="Copy update request";
    $("#dialogNote").textContent="Your new link will appear after a GitHub update and deployment.";
    $("#requestCategory").value=state.view==="category"?state.category:"workspaces";
    $("#requestDialog").showModal();$("#requestName").focus();
    closeMenu();
  }
  function validURL(raw) {try {const url=new URL(raw);return url.protocol==="https:" || url.protocol==="http:";}catch{return false;}}
  async function copyText(text) {
    if(navigator.clipboard && window.isSecureContext) {await navigator.clipboard.writeText(text);return;}
    const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";document.body.append(area);area.select();
    const ok=document.execCommand("copy");area.remove();if(!ok)throw new Error("Clipboard unavailable");
  }
  document.addEventListener("click",(event)=>{
    const open=event.target.closest("[data-open-id]");if(open){trackRecent(open.dataset.openId);return;}
    const fav=event.target.closest("[data-fav]");if(fav){toggleFavorite(fav.dataset.fav);return;}
    const request=event.target.closest("[data-request]");if(request){openDialog();return;}
    const nav=event.target.closest("[data-nav]");if(nav){navigate(nav.dataset.nav);return;}
    const cat=event.target.closest("[data-category]");if(cat){navigate("category",cat.dataset.category);return;}
    const suggest=event.target.closest("[data-suggest]");
    if(suggest){const l=byId.get(suggest.dataset.suggest);if(l){state.query=l.title;$("#globalSearch").value=state.query;renderMain();$("#searchSuggestions").hidden=true;$("#globalSearch").blur();}return;}
    if(!event.target.closest("#searchShell"))$("#searchSuggestions").hidden=true;
  });
  $("#globalSearch").addEventListener("input",(event)=>{
    state.query=event.target.value.trimStart();
    if(state.query){state.view="search";state.category=null;}
    else{state.view="overview";}
    renderMain();renderSuggestions();
  });
  $("#globalSearch").addEventListener("focus",renderSuggestions);
  $("#globalSearch").addEventListener("keydown",(event)=>{
    if(event.key==="Escape"){$("#searchSuggestions").hidden=true;event.currentTarget.blur();return;}
    if(event.key==="Enter"){event.preventDefault();$("#searchSuggestions").hidden=true;event.currentTarget.blur();renderMain();}
  });
  document.addEventListener("keydown",(event)=>{
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();$("#globalSearch").focus();$("#globalSearch").select();}
    if(event.key==="Escape")closeMenu();
  });
  $("#themeButton").addEventListener("click",()=>{state.theme=state.theme==="light"?"dark":"light";store.set("theme",state.theme);applyTheme();});
  $("#menuButton").addEventListener("click",()=>{
    const isOpen=$("#sidebar").classList.toggle("open");
    $("#mobileScrim").hidden=!isOpen;$("#menuButton").setAttribute("aria-expanded",String(isOpen));
  });
  $("#mobileScrim").addEventListener("click",closeMenu);
  $("#closeDialog").addEventListener("click",()=>$("#requestDialog").close());
  $("#requestDialog").addEventListener("click",(e)=>{if(e.target===$("#requestDialog"))$("#requestDialog").close();});
  $("#requestForm").addEventListener("submit",async(event)=>{
    event.preventDefault();
    const name=$("#requestName").value.trim(),url=$("#requestUrl").value.trim(),
          category=$("#requestCategory").value, description=$("#requestDescription").value.trim();
    if(!name){$("#requestError").textContent="Please enter the name of the link or category.";return;}
    if(url && !validURL(url)){$("#requestError").textContent="Use a full website address beginning with https:// or http://.";return;}
    $("#requestError").textContent="";
    const label=category==="new"?"New category":categoryName(category);
    const request="Please update my Personal Hub website on GitHub (branch: personal-hub, folder: personal-hub).\n"+
      (url?"Add or update this link:":"Add this new category or item:")+"\nName: "+name+"\nURL: "+(url||"(none)")+
      "\nCollection: "+label+"\nDescription / tags: "+(description||"(not provided)")+
      "\nKeep the current layout and all other links unchanged. Please publish the update.";
    try{await copyText(request);$("#copyRequestButton").textContent="Copied! Paste into ChatGPT";$("#dialogNote").textContent="Ready — paste the message into our chat and I can update the website.";}
    catch{$("#requestError").textContent="Clipboard permission was blocked. Please copy the details manually into ChatGPT.";}
  });
  $("#requestCategory").innerHTML=categories.map(c=>'<option value="'+escapeHTML(c.id)+'">'+escapeHTML(c.name)+'</option>').join("")+'<option value="new">+ New collection</option>';
  $("#searchHint").textContent=/Mac|iPhone|iPad/.test(navigator.platform)?"⌘ K":"Ctrl K";
  applyTheme();renderMain();
})();