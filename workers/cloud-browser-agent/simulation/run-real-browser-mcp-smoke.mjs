// API1 CI-only live MCP acceptance: actual public site through our own Chromium.
// No TinyFish, proxy, cloud deployment, real accounts or production access.
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {createIsolatedBrowserMcpServer} from "./isolated-real-browser-mcp.mjs";
const dir=process.env.API1_REAL_MCP_EVIDENCE_DIR||"/tmp/api1-real-mcp-evidence";
await mkdir(dir,{recursive:true});
let server;
try{
 server=await createIsolatedBrowserMcpServer(chromium,{timeoutMs:30000});
 const call=async (id,method,params)=>{
  const response=await fetch(server.url,{method:"POST",
   headers:{"content-type":"application/json","accept":"application/json, text/event-stream",
    "authorization":"Bearer "+server.accessToken},
   body:JSON.stringify({jsonrpc:"2.0",id,method,...(params?{params}:{})}),
   signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error("MCP transport rejected request "+response.status);
  const body=await response.json();
  if(body.error)throw Error("MCP method failed: "+body.error.message);
  return body.result;
 };
 const init=await call(1,"initialize",{protocolVersion:"2025-06-18",capabilities:{},
  clientInfo:{name:"api1-live-ci",version:"0.1.0"}});
 if(init.protocolVersion!=="2025-06-18")throw Error("MCP initialize incompatible");
 const tools=await call(2,"tools/list",{});
 if(tools.tools?.length!==1||tools.tools[0].name!=="browser_automate_wikipedia_demo")
  throw Error("Unexpected MCP tool discovery");
 // Exercise stateless 2026-07-28 discovery used by ChatGPT registration.
 const modernMeta={
  "io.modelcontextprotocol/protocolVersion":"2026-07-28",
  "io.modelcontextprotocol/clientInfo":{name:"api1-live-ci",version:"0.1.0"},
  "io.modelcontextprotocol/clientCapabilities":{}
 };
 const modernCall=async(id,method,args={})=>{
  const response=await fetch(server.url,{method:"POST",headers:{
   "content-type":"application/json","accept":"application/json, text/event-stream",
   "authorization":"Bearer "+server.accessToken,
   "mcp-protocol-version":"2026-07-28","mcp-method":method,
   ...(method==="tools/call"?{"mcp-name":args.name}:{})
  },body:JSON.stringify({jsonrpc:"2.0",id,method,params:{...args,_meta:modernMeta}}),
   signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error("Modern MCP transport rejected "+method+": "+response.status);
  const body=await response.json();
  if(body.error)throw Error("Modern MCP error "+method+": "+body.error.code);
  return body.result;
 };
 const discovered=await modernCall(40,"server/discover");
 if(discovered.resultType!=="complete"||
    !discovered.supportedVersions.includes("2026-07-28")||
    discovered.capabilities?.tools===undefined)
  throw Error("Modern server/discover incompatible");
 const modernTools=await modernCall(41,"tools/list");
 if(modernTools.resultType!=="complete"||modernTools.cacheScope!=="private"||
    modernTools.tools?.length!==1||modernTools.tools[0].name!==tools.tools[0].name)
  throw Error("Modern tools/list incompatible");
 const result=await modernCall(42,"tools/call",{name:"browser_automate_wikipedia_demo",
  arguments:{query:"James Webb Space Telescope"}});
 if(result.resultType!=="complete")throw Error("Modern tools/call missing resultType");
 const summary=result.structuredContent;
 if(result.isError!==false||!summary||summary.status!=="passed"||
  summary.steps?.map(s=>s.action).join(",")!=="navigate,search,click"||
  !summary.clickedLink||!summary.extracted?.heading||!summary.extracted?.paragraphs?.length||
  summary.readOnly!==true||summary.productionWritesAllowed!==false||
  summary.thirdPartyAutomationUsed!==false||
  new URL(summary.steps[1].url).pathname===new URL(summary.steps[2].url).pathname)
  throw Error("Real MCP tool acceptance failed");
 const imageBlocks=result.content.filter(x=>x.type==="image");
 if(imageBlocks.length!==3||imageBlocks[1].data===imageBlocks[2].data)
  throw Error("MCP images missing or identical");
 for(let i=0;i<imageBlocks.length;i++){
  const frame=imageBlocks[i];
  if(frame.mimeType!=="image/png")throw Error("Invalid frame type");
  const bytes=Buffer.from(frame.data,"base64");
  if(bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a")throw Error("Invalid PNG");
  await writeFile(dir+"/frame-"+(i+1)+".png",bytes);
 }
 await writeFile(dir+"/result.json",JSON.stringify({
  ...summary,mode:"real-wikipedia-mcp-tool",authenticated:true,
  screenshotFiles:["frame-1.png","frame-2.png","frame-3.png"],
  protocolVersion:init.protocolVersion,modernProtocolVersion:"2026-07-28",discoveredTool:tools.tools[0].name
 },null,2));
 console.log("API1_REAL_BROWSER_MCP_PASS",JSON.stringify({
  steps:summary.steps.map(x=>x.action),clicked:summary.clickedLink.href,
  heading:summary.extracted.heading,images:imageBlocks.length
 }));
}catch(e){
 const reason=String(e?.message||e).slice(0,220);
 await writeFile(dir+"/result.json",JSON.stringify({status:"failed",liveMcpVerified:false,reason},null,2));
 console.error("API1_REAL_BROWSER_MCP_FAILED",reason);
 process.exitCode=1;
}finally{
 if(server)await server.close();
}
