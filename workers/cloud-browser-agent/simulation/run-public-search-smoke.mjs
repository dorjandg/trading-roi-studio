// Explicit public read-only smoke run; development CI only, never production.
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {runPublicSearchPrototype} from "./public-search-browser-prototype.mjs";
const output=process.env.API1_SCREENSHOT_DIR||"/tmp/api1-public-browser-smoke";
await mkdir(output,{recursive:true});
try{
 const result=await runPublicSearchPrototype(chromium,{timeoutMs:15000});
 for(let i=0;i<result.screenshots.length;i++){
  const shot=result.screenshots[i];
  await writeFile(`${output}/frame-${i+1}.png`,Buffer.from(shot.pngBase64,"base64"));
 }
 await writeFile(`${output}/manifest.json`,JSON.stringify({status:"passed",steps:result.steps,readOnly:true,productionWritesAllowed:false},null,2));
 console.log("API1_PUBLIC_BROWSER_SMOKE_PASS",result.steps.map(x=>x.label).join(" -> "));
}catch(e){
 await writeFile(`${output}/manifest.json`,JSON.stringify({status:"failed",reason:String(e?.message||e).slice(0,250)},null,2));
 console.error("API1_PUBLIC_BROWSER_SMOKE_FAILED",String(e?.message||e).slice(0,250));
 process.exitCode=1;
}
