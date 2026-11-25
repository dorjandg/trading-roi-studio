/**
 * Stage 4.5: ephemeral website served ONLY to 127.0.0.1 for automated tests.
 * Not part of the deployed Worker. No external listening interface or persistence.
 * Actor headers are TEST FIXTURES, not an authentication mechanism.
 */
import {createServer} from "node:http";
import {IsolatedEditLab} from "./isolated-edit-lab.mjs";

const html=`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Disposable Browser Edit Lab</title></head><body>
<h1>Disposable Browser Edit Lab</h1>
<p id="safety">Localhost-only test fixture. No real websites are connected.</p>
<form id="proposal-form"><label for="next-value">Replacement title</label>
<input id="next-value" value="Updated test title" maxlength="1200" required>
<button type="submit">Create proposal</button></form>
<section id="proposal" aria-live="polite"></section>
<button id="approve" type="button" disabled>Approve as independent reviewer</button>
<button id="execute" type="button" disabled>Apply approved fixture edit</button>
<button id="rollback" type="button" disabled>Rollback fixture edit</button>
<output id="current-title">Original test title</output><output id="revision">1</output>
<output id="status">READY</output>
<script>
let proposal=null;
const status=document.querySelector("#status");
async function call(path,body,actor){
 const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json","X-Test-Actor":actor},body:JSON.stringify(body)});
 const data=await r.json();
 if(!r.ok)throw Error(data.code||"REQUEST_FAILED");
 return data;
}
document.querySelector("#proposal-form").addEventListener("submit",async e=>{
 e.preventDefault();
 try{
  proposal=await call("/api/propose",{nextValue:document.querySelector("#next-value").value},"creator-01");
  document.querySelector("#proposal").textContent="Proposal "+proposal.proposalId.slice(0,10);
  document.querySelector("#approve").disabled=false;
  status.value="PROPOSED";status.textContent="PROPOSED";
 }catch(err){status.textContent=err.message;}
});
document.querySelector("#approve").addEventListener("click",async()=>{
 try{await call("/api/approve",{proposalId:proposal.proposalId,digest:proposal.digest},"reviewer-02");
 document.querySelector("#approve").disabled=true;document.querySelector("#execute").disabled=false;status.textContent="APPROVED";}
 catch(err){status.textContent=err.message;}
});
document.querySelector("#execute").addEventListener("click",async()=>{
 try{const result=await call("/api/execute",{proposalId:proposal.proposalId,digest:proposal.digest,requestId:"request-01",expectedRevision:proposal.baseRevision},"creator-01");
 document.querySelector("#execute").disabled=true;document.querySelector("#rollback").disabled=false;
 await refresh();status.textContent=result.status;}
 catch(err){status.textContent=err.message;}
});
document.querySelector("#rollback").addEventListener("click",async()=>{
 try{const revision=Number(document.querySelector("#revision").textContent);
 const result=await call("/api/rollback",{proposalId:proposal.proposalId,expectedRevision:revision},"reviewer-02");
 document.querySelector("#rollback").disabled=true;await refresh();status.textContent=result.status;}
 catch(err){status.textContent=err.message;}
});
async function refresh(){
 const state=await (await fetch("/api/state")).json();
 document.querySelector("#current-title").textContent=state.value;
 document.querySelector("#revision").textContent=state.revision;
}
</script></body></html>`;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function startDisposableSite(){
 const lab=new IsolatedEditLab();
 lab.seed("fixture:title","Original test title");
 const server=createServer(async (req,res)=>{
  const finish=async response=>{
   res.writeHead(response.status,Object.fromEntries(response.headers));
   res.end(Buffer.from(await response.arrayBuffer()));
  };
  try{
   if(req.headers.host!==`127.0.0.1:${server.address().port}`){await finish(json({code:"LOCAL_ONLY"},403));return;}
   const path=new URL(req.url,"http://127.0.0.1").pathname;
   if(req.method==="GET"&&path==="/"){await finish(new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'self'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'","x-content-type-options":"nosniff"}}));return;}
   if(req.method==="GET"&&path==="/api/state"){await finish(json(lab.inspect("fixture:title")));return;}
   if(req.method==="GET"&&path==="/api/events"){await finish(json({events:lab.events(),verified:await lab.verifyJournal()}));return;}
   if(req.method!=="POST"||!["/api/propose","/api/approve","/api/execute","/api/rollback"].includes(path)){await finish(json({code:"NOT_FOUND"},404));return;}
   if(req.headers["content-type"]!=="application/json"){await finish(json({code:"JSON_REQUIRED"},415));return;}
   let buffer="";
   for await(const chunk of req){buffer+=chunk;if(buffer.length>4096)throw Error("REQUEST_TOO_LARGE");}
   const body=JSON.parse(buffer),actor=req.headers["x-test-actor"];
   if(typeof body!=="object"||Array.isArray(body)||!body)throw Error("INVALID_BODY");
   let result;
   if(path==="/api/propose"){
    if(actor!=="creator-01"||Object.keys(body).join(",")!=="nextValue")throw Error("ACTOR_OR_ARGS_DENIED");
    result=await lab.propose({fieldId:"fixture:title",nextValue:body.nextValue,creatorId:actor});
   }else if(path==="/api/approve"){
    if(actor!=="reviewer-02"||Object.keys(body).sort().join(",")!=="digest,proposalId")throw Error("ACTOR_OR_ARGS_DENIED");
    result=await lab.approve({proposalId:body.proposalId,digest:body.digest,approverId:actor});
   }else if(path==="/api/execute"){
    if(actor!=="creator-01"||Object.keys(body).sort().join(",")!=="digest,expectedRevision,proposalId,requestId")throw Error("ACTOR_OR_ARGS_DENIED");
    result=await lab.execute(body);
   }else{
    if(actor!=="reviewer-02"||Object.keys(body).sort().join(",")!=="expectedRevision,proposalId")throw Error("ACTOR_OR_ARGS_DENIED");
    result=await lab.rollback({...body,actorId:actor});
   }
   await finish(json(result));
  }catch(err){await finish(json({code:err?.code||"REJECTED"},400));}
 });
 await new Promise((resolve,reject)=>server.once("error",reject).listen(0,"127.0.0.1",resolve));
 return {url:`http://127.0.0.1:${server.address().port}`,lab,close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
