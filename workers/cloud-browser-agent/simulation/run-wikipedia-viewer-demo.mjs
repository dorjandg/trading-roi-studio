// CI-only visual demonstration. All requests are fulfilled locally; no real websites.
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {createWikipediaVisualSession} from "./wikipedia-visual-session.mjs";
const dir=process.env.API1_DEMO_DIR||"/tmp/api1-viewer-demo";
const fixture=route=>{
 const req=route.request(),u=new URL(req.url());
 if(req.method()!=="GET"||u.hostname!=="en.wikipedia.org")return route.abort();
 const search=u.pathname==="/wiki/Special:Search",webb=u.pathname==="/wiki/James_Webb_Space_Telescope";
 const title=search?"Search results":webb?"James Webb Space Telescope":"Wikipedia Home";
 const body=search?'<a href="/wiki/James_Webb_Space_Telescope">James Webb Space Telescope</a>':webb?'<p>Space telescope demonstration page.</p><a href="/wiki/Main_Page">Main Page</a>':'<p>Local disposable demonstration.</p>';
 return route.fulfill({status:200,contentType:"text/html",body:`<!doctype html><html><head><title>${title}</title><style>body{font:24px system-ui;padding:35px;background:#f5f8fc;color:#17253a}a{color:#1766b2}</style></head><body><small>API 1 · OFFLINE TEST PAGE</small><h1>${title}</h1>${body}</body></html>`});
};
await mkdir(dir,{recursive:true});
const session=await createWikipediaVisualSession(chromium,{fixture,timeoutMs:12000});
const frames=[];
async function save(label){
 const {png,sequence}=await session.frame(),state=session.state(),name=`frame-${sequence}-${label}.png`;
 await writeFile(`${dir}/${name}`,png);
 frames.push({name,sequence,url:state.url,title:state.title,bytes:png.length});
}
try{
 await save("home");
 await session.search("James Webb Space Telescope");await save("search");
 await session.click("https://en.wikipedia.org/wiki/James_Webb_Space_Telescope");await save("article");
 await session.back();await save("back");
 await writeFile(`${dir}/manifest.json`,JSON.stringify({mode:"offline-disposable",realWebsite:false,frames},null,2));
 console.log("API1_VIEWER_DEMO_OK",JSON.stringify(frames.map(x=>x.name)));
}finally{await session.close();}
