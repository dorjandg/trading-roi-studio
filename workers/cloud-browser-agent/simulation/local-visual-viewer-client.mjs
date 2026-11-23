// Local test viewer only: no arbitrary URLs, no real website controls.
const $=id=>document.getElementById(id);
let latest=-1,busy=false,commandQueue=Promise.resolve();
async function request(path,options){const r=await fetch(path,{cache:"no-store",...options});if(!r.ok)throw Error("Local viewer request failed");return r;}
function command(value){commandQueue=commandQueue.then(async()=>{busy=true;try{const r=await request("/command",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value)});await draw(await r.json());}catch(e){$("status").textContent=e.message;}finally{busy=false;}});return commandQueue;}
function button(label,selected,handler){const b=document.createElement("button");b.type="button";b.textContent=label;if(selected!==null)b.setAttribute("aria-selected",String(selected));b.addEventListener("click",handler);return b;}
async function draw(s){
 $("tabs").replaceChildren(...s.tabs.map(name=>button(name,name===s.activeTab,()=>command({type:"switch",tab:name}))));
 $("address").textContent=s.events.at(-1)?.simulatedUrl||"offline";
 const pages={google:["Home","Search results","About"],youtube:["Home","Channels","Videos"],github:["Home","Repositories","Issues"],staging:["Home","Properties","Contact"]}[s.activeTab];
 $("pages").replaceChildren(...pages.map((name,index)=>button(name,name===s.page,()=>command({type:"navigate",index}))));
 $("status").textContent="Frame "+s.sequence+" · "+s.activeTab+" · "+s.page+" · network requests "+s.externalRequests;
 if(s.sequence!==latest){
  const r=await request("/frame");const seq=Number(r.headers.get("x-frame-sequence"));const blob=await r.blob();
  if(seq>=latest){const old=$("frame").dataset.objectUrl;const url=URL.createObjectURL(blob);$("frame").src=url;$("frame").dataset.objectUrl=url;if(old)URL.revokeObjectURL(old);latest=seq;}
 }
}
$("back").addEventListener("click",()=>command({type:"history",delta:-1}));
$("forward").addEventListener("click",()=>command({type:"history",delta:1}));
async function refresh(){if(busy)return;try{await draw(await(await request("/state")).json());}catch(e){$("status").textContent=e.message;}}
await refresh();setInterval(refresh,700);
