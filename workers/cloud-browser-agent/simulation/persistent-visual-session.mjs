// Disposable, persistent multi-tab Chromium session. NO URLs, network, credentials or production integration.
import {randomUUID} from "node:crypto";
const sites=Object.freeze({
 google:["Home","Search results","About"],
 youtube:["Home","Channels","Videos"],
 github:["Home","Repositories","Issues"],
 staging:["Home","Properties","Contact"]
});
const encode=s=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
export async function createPersistentVisualSession(chromium){
 if(!chromium||typeof chromium.launch!=="function")throw Error("Chromium required");
 const browser=await chromium.launch({headless:true});
 let context,closed=false,active="google",sequence=0,externalRequests=0;
 const tabs=new Map(),events=[];
 try{
  context=await browser.newContext({viewport:{width:960,height:620},serviceWorkers:"block",acceptDownloads:false});
  await context.route("**/*",route=>{externalRequests++;return route.abort();});
  for(const [name,pages] of Object.entries(sites)){
   const page=await context.newPage();
   await page.goto("about:blank");
   tabs.set(name,{page,pages,history:[0],cursor:0});
  }
  function requireOpen(){if(closed)throw Error("Session closed");}
  function current(tab){return tab.pages[tab.history[tab.cursor]];}
  async function render(name){
   const tab=tabs.get(name),label=current(tab);
   const html=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font:22px system-ui;background:#f6f8fc;color:#142b45;margin:0}.header{background:#173c5a;color:white;padding:20px}.content{padding:45px}h1{font-size:40px}.notice{background:#e3f0e9;border-radius:9px;padding:15px}</style></head><body><div class="header">API 1 — OFFLINE BROWSER VIEW</div><div class="content"><p class="notice">SIMULATED ${encode(name.toUpperCase())} · NO REAL WEBSITE</p><h1>${encode(label)}</h1><p>This is a disposable local page rendered by a persistent Chromium tab.</p><p>Network and website actions are disabled.</p></div></body></html>`;
   await tab.page.setContent(html,{waitUntil:"domcontentloaded"});
  }
  for(const name of tabs.keys())await render(name);
  function emit(type,name){const tab=tabs.get(name);events.push(Object.freeze({sequence:++sequence,type,tab:name,page:current(tab),simulatedUrl:`https://${name}.example.invalid/${current(tab).toLowerCase().replaceAll(" ","-")}`}));}
  emit("session-start",active);
  return Object.freeze({
   sessionId:randomUUID(),
   tabs:()=>Object.freeze([...tabs.keys()]),
   state(){requireOpen();const tab=tabs.get(active);return Object.freeze({activeTab:active,page:current(tab),sequence,externalRequests,readOnly:true,productionWritesAllowed:false});},
   async switchTab(name){requireOpen();if(!tabs.has(name))throw Error("Unknown tab");active=name;emit("tab-switch",name);return this.state();},
   async navigate(index){requireOpen();const tab=tabs.get(active);if(!Number.isInteger(index)||index<0||index>=tab.pages.length)throw Error("Unknown fixture page");tab.history=tab.history.slice(0,tab.cursor+1);tab.history.push(index);tab.cursor++;await render(active);emit("navigate",active);return this.state();},
   async history(delta){requireOpen();if(delta!==-1&&delta!==1)throw Error("Invalid history movement");const tab=tabs.get(active),next=tab.cursor+delta;if(next<0||next>=tab.history.length)throw Error("No history entry");tab.cursor=next;await render(active);emit("history",active);return this.state();},
   async frame(){requireOpen();const tab=tabs.get(active);const png=await tab.page.screenshot({type:"png",animations:"disabled"});return Object.freeze({sequence,tab:active,page:current(tab),png,readOnly:true});},
   events(){requireOpen();return Object.freeze([...events]);},
   async close(){if(closed)return;closed=true;await context.close();await browser.close();}
  });
 }catch(e){if(context)await context.close().catch(()=>{});await browser.close().catch(()=>{});throw e;}
}
