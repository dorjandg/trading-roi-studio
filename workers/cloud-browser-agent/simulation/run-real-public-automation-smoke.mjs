// API 1 REAL-PUBLIC-WEBSITE smoke, CI isolated only. Fails if the public
// website, form, click, extraction or screenshot pipeline cannot be verified.
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {createRealPublicAutomationApi} from "./real-public-automation-api.mjs";
const dir=process.env.API1_REAL_AUTOMATION_DIR||"/tmp/api1-real-public-automation";
const query="James Webb Space Telescope";
await mkdir(dir,{recursive:true});
let api;
try{
 api=await createRealPublicAutomationApi(chromium,{timeoutMs:30000});
 const response=await fetch(api.url+"/run",{
  method:"POST",headers:{authorization:"Bearer "+api.apiKey,"content-type":"application/json"},
  body:JSON.stringify({task:"wikipedia-demo",query}),signal:AbortSignal.timeout(120000)
 });
 if(!response.ok)throw Error("Isolated automation API returned "+response.status+": "+(await response.text()).slice(0,100));
 const result=await response.json();
 if(result.status!=="passed"||!result.searchedWithVisibleInput||!result.clickedLink||
   result.steps?.length!==3||result.screenshots?.length!==3||
   !result.extracted?.heading||!result.extracted?.paragraphs?.length||result.productionWritesAllowed!==false||
   result.thirdPartyAutomationUsed!==false)throw Error("Real-public automation acceptance failed");
 const shots=result.screenshots;
 for(let i=0;i<shots.length;i++)await writeFile(dir+"/frame-"+(i+1)+"-"+result.steps[i].action+".png",Buffer.from(shots[i].base64,"base64"));
 const {screenshots,...manifest}=result;
 await writeFile(dir+"/result.json",JSON.stringify({...manifest,realWebsite:true,mode:"live-public-site",screenshotFiles:result.steps.map((s,i)=>"frame-"+(i+1)+"-"+s.action+".png")},null,2));
 console.log("API1_REAL_WEBSITE_AUTOMATION_PASS",JSON.stringify({steps:result.steps.map(s=>s.action),heading:result.extracted.heading,clicked:result.clickedLink.href,approvedRequests:result.approvedRequests,blockedRequests:result.blockedRequests}));
}catch(e){
 const reason=String(e?.message||e).slice(0,220);
 await writeFile(dir+"/result.json",JSON.stringify({status:"failed",realWebsiteVerified:false,reason},null,2));
 console.error("API1_REAL_WEBSITE_AUTOMATION_FAILED",reason);
 process.exitCode=1;
}finally{if(api)await api.close();}
