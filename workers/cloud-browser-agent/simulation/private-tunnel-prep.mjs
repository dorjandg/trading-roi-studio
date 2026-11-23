// API1 PRIVATE CONNECTION PREPARATION ONLY.
// Creates a disposable, token-protected loopback MCP listener and a private
// header file for a future APPROVED Secure MCP Tunnel. No tunnel-client, cloud,
// external listeners, OAuth provider, credentials or deployment is started here.
import {mkdtemp,writeFile,readFile,stat,rm,chmod} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createIsolatedBrowserMcpServer} from "./isolated-real-browser-mcp.mjs";

export async function createPrivateTunnelPrep(chromium,{routeFixture,timeoutMs=30000}={}){
 let server,dir;
 try{
  dir=await mkdtemp(join(tmpdir(),"api1-private-mcp-"));
  await chmod(dir,0o700);
  server=await createIsolatedBrowserMcpServer(chromium,{routeFixture,timeoutMs});
  const headerFile=join(dir,"authorization.header");
  await writeFile(headerFile,"Bearer "+server.accessToken,{flag:"wx",mode:0o600});
  await chmod(headerFile,0o600);
  const info=Object.freeze({
   mode:"private-demo-approval-required",
   mcpUrl:server.url,
   headerFile,
   authMode:"tunnel-transport-plus-local-static-bearer",
   oauthImplemented:false,
   tunnelCreated:false,
   chatgptConnected:false,
   deployed:false,
   tool:"browser_automate_wikipedia_demo",
   allowedWebsite:"en.wikipedia.org",
   productionWritesAllowed:false
  });
  const infoFile=join(dir,"local-readiness.json");
  await writeFile(infoFile,JSON.stringify(info,null,2),{flag:"wx",mode:0o600});
  let closed=false;
  return Object.freeze({
   info,infoFile,
   // The credential is never returned through info, stdout, logs or CI artifacts.
   async verifyPrivateHeaderFile(){
    const file=await stat(headerFile);
    const secret=await readFile(headerFile,"utf8");
    return file.isFile()&&(file.mode&0o777)===0o600&&secret==="Bearer "+server.accessToken;
   },
   async close(){
    if(closed)return;closed=true;
    try{await server.close();}finally{await rm(dir,{recursive:true,force:true});}
   }
  });
 }catch(err){
  if(server)await server.close().catch(()=>{});
  if(dir)await rm(dir,{recursive:true,force:true}).catch(()=>{});
  throw err;
 }
}
