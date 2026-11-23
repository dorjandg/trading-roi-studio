import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {runNasaClickNavigation} from "./nasa-click-navigation.mjs";
const output="/tmp/api1-nasa-click-smoke";
await mkdir(output,{recursive:true});
try{
 const result=await runNasaClickNavigation(chromium,{timeoutMs:15000});
 await writeFile(output+"/clicked-page.png",Buffer.from(result.screenshot,"base64"));
 await writeFile(output+"/manifest.json",JSON.stringify({status:"passed",before:result.before,after:result.after,linkText:result.linkText},null,2));
 console.log("API1_NASA_CLICK_PASS",result.before,"=>",result.after);
}catch(e){
 await writeFile(output+"/manifest.json",JSON.stringify({status:"failed",reason:String(e?.message||e).slice(0,200)}));
 console.error("API1_NASA_CLICK_FAILED",String(e?.message||e).slice(0,200));
 process.exitCode=1;
}
