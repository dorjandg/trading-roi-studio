// Loopback-only development viewer. Not a deployed service.
import {createServer} from "node:http";
import {createWikipediaVisualSession} from "./wikipedia-visual-session.mjs";
const json=(res,status,data)=>{res.writeHead(status,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify(data));};
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>API1 Real Browser</title><style>body{font:15px system-ui;background:#121923;color:#fff;margin:0}main{max-width:1100px;margin:auto}header{padding:14px;background:#253a50}button,input{padding:10px;margin:4px;border-radius:6px}img{width:100%;background:white}#url{overflow-wrap:anywhere}#links{max-height:160px;overflow:auto}#links button{font-size:12px}</style></head><body><main><header><strong>API 1 · Real Wikipedia Browser · LOCAL READ ONLY</strong><p id="url">Loading...</p><input id="query" value="James Webb Space Telescope"><button id="search">Search</button><button id="back">Back</button><span id="status"></span></header><img id="frame" alt="Actual Chromium screenshot"><div id="links"></div></main><script type="module">
const $=id=>document.getElementById(id);let seq=-1;
async function api(path,body){const r=await fetch(path,body?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{});const x=await r.json();if(!r.ok)throw Error(x.error);return x;}
async function refresh(){try{const s=await api("/state");$("url").textContent=s.url;$("status").textContent="Frame "+s.sequence;if(seq!==s.sequence){seq=s.sequence;$("frame").src="/frame?v="+seq;const links=await api("/links");$("links").replaceChildren(...links.slice(0,35).map(l=>{const b=document.createElement("button");b.textContent=l.label||l.href;b.onclick=()=>command({type:"click",href:l.href});return b;}));}}catch(e){$("status").textContent=e.message;}}
async function command(x){try{await api("/command",x);await refresh();}catch(e){$("status").textContent=e.message;}}
$("search").onclick=()=>command({type:"search",term:$("query").value});
$("back").onclick=()=>command({type:"back"});
await refresh();setInterval(refresh,1200);
</script></body></html>`;
export async function createWikipediaViewerServer(chromium,options={}){
 const session=await createWikipediaVisualSession(chromium,options);
 let queue=Promise.resolve(),closed=false;
 const server=createServer(async(req,res)=>{
  try{
   const host=req.headers.host||"";
   if(!/^127\.0\.0\.1:\d+$/.test(host))return json(res,403,{error:"Loopback only"});
   if(req.headers.origin&&req.headers.origin!==`http://${host}`)return json(res,403,{error:"Origin denied"});
   res.setHeader("content-security-policy","default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'none'");
   res.setHeader("x-frame-options","DENY");
   res.setHeader("x-content-type-options","nosniff");
   const path=new URL(req.url,"http://127.0.0.1").pathname;
   if(req.method==="GET"&&path==="/"){res.writeHead(200,{"content-type":"text/html"});return res.end(html);}
   if(req.method==="GET"&&path==="/state")return json(res,200,session.state());
   if(req.method==="GET"&&path==="/links")return json(res,200,await session.links());
   if(req.method==="GET"&&path==="/frame"){const f=await session.frame();res.writeHead(200,{"content-type":"image/png","cache-control":"no-store"});return res.end(f.png);}
   if(req.method==="POST"&&path==="/command"){
    if(req.headers["content-type"]!=="application/json")return json(res,415,{error:"JSON required"});
    let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>500)throw Error("Command too large");}
    const c=JSON.parse(raw);
    if(!c||typeof c!=="object"||Array.isArray(c))throw Error("Invalid command");
    const keys=Object.keys(c).sort().join(",");
    const task=async()=>{
     if(c.type==="search"&&keys==="term,type")return session.search(c.term);
     if(c.type==="click"&&keys==="href,type")return session.click(c.href);
     if(c.type==="back"&&keys==="type")return session.back();
     throw Error("Command refused");
    };
    const p=queue.then(task);queue=p.then(()=>{},()=>{});
    return json(res,200,await p);
   }
   return json(res,404,{error:"Not found"});
  }catch(e){return json(res,400,{error:String(e.message).slice(0,120)});}
 });
 try{
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  return {url:`http://127.0.0.1:${server.address().port}`,async close(){if(closed)return;closed=true;await new Promise(resolve=>server.close(resolve));await session.close();}};
 }catch(e){await session.close();throw e;}
}
