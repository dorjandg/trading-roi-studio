// API1 offline profile generator for APPROVED private Secure MCP Tunnel operation.
// Does not start tunnel-client, use network, create a tunnel, or register plugins.
// Requires the existing loopback MCP prep info and a previously approved tunnel ID.
// A profile contains only a reference to the local secret header file, never its bytes.
import {writeFile,chmod,stat,realpath} from "node:fs/promises";
import {dirname,join,isAbsolute} from "node:path";

const validTunnelId=x=>typeof x==="string"&&/^tunnel_[A-Za-z0-9_-]{16,128}$/.test(x);
const validLocalUrl=x=>{
 try{
  const u=new URL(x);
  return u.protocol==="http:"&&u.hostname==="127.0.0.1"&&u.port!==""
   &&u.pathname==="/mcp"&&!u.username&&!u.password&&!u.search&&!u.hash;
 }catch{return false;}
};
const validFilePath=x=>typeof x==="string"&&isAbsolute(x)&&!x.includes("\n")
 &&!x.includes("\r")&&!x.includes("\0")&&x.endsWith("/authorization.header");
export function planPrivateTunnelProfile(info,{tunnelId}={}){
 if(!info||!validLocalUrl(info.mcpUrl)||!validFilePath(info.headerFile)||
    info.deployed!==false||info.tunnelCreated!==false||info.productionWritesAllowed!==false)
  throw Error("Isolated MCP target required");
 if(!validTunnelId(tunnelId))throw Error("Approved tunnel ID required");
 // YAML values are JSON string literals; YAML parsers support JSON quoting.
 // No actual API key or bearer value is embedded in the profile.
 const q=JSON.stringify;
 const yaml=[
  "config_version: 1",
  "control_plane:",
  "  tunnel_id: "+q(tunnelId),
  "  api_key: "+q("env:CONTROL_PLANE_API_KEY"),
  "mcp:",
  "  server_urls:",
  "    - channel: main",
  "      url: "+q(info.mcpUrl),
  "  extra_headers:",
  "    Authorization: "+q("file:"+info.headerFile),
  "  oauth_discovery: disabled",
  "  max_concurrent_requests: 1",
  "health:",
  "  listen_addr: "+q("127.0.0.1:0"),
  "admin_ui:",
  "  open_browser: false"
 ].join("\n")+"\n";
 return Object.freeze({yaml,
  requiresPrivateRuntimeKey:true,requiresInstalledOfficialClient:true,
  tunnelStarted:false,chatgptPluginCreated:false,usesProtectedHeaderFile:true,
  authMode:"static-bearer-private-single-user"});
}
export async function savePrivateTunnelProfile(info,options){
 const plan=planPrivateTunnelProfile(info,options);
 const dir=dirname(info.headerFile);
 const dirInfo=await stat(dir);
 const secretInfo=await stat(info.headerFile);
 if(!dirInfo.isDirectory()||(dirInfo.mode&0o777)!==0o700||
    !secretInfo.isFile()||(secretInfo.mode&0o777)!==0o600)
   throw Error("Private header file permissions required");
 const dirPath=await realpath(dir);
 if(dirPath!==dir)throw Error("Unresolved private profile directory");
 const file=join(dir,"tunnel-client.api1.yaml");
 await writeFile(file,plan.yaml,{flag:"wx",mode:0o600});
 await chmod(file,0o600);
 return Object.freeze({profilePath:file,...Object.fromEntries(
  Object.entries(plan).filter(([key])=>key!=="yaml"))});
}
