// Operator-start only: launches local MCP, creates an optional *secret-free*
// official tunnel-client profile if CONTROL_PLANE_TUNNEL_ID has been approved.
// NO tunnel-client execution, network exposure, OAuth, registration or deployment.
import {chromium} from "playwright";
import {createPrivateTunnelPrep} from "./private-tunnel-prep.mjs";
import {savePrivateTunnelProfile} from "./private-tunnel-profile.mjs";
const instance=await createPrivateTunnelPrep(chromium);
let stop;
const done=new Promise(resolve=>{stop=resolve;});
process.once("SIGINT",stop);
process.once("SIGTERM",stop);
try{
 let profilePath=null;
 if(process.env.CONTROL_PLANE_TUNNEL_ID){
  const profile=await savePrivateTunnelProfile(instance.info,{
   tunnelId:process.env.CONTROL_PLANE_TUNNEL_ID
  });
  profilePath=profile.profilePath;
 }
 console.log("API1_PRIVATE_MCP_LOCAL_READY",JSON.stringify({
  ...instance.info,
  ...(profilePath?{profilePath}:{}),
  tunnelStarted:false,
  awaitingOperatorApprovalForRuntime:true
 }));
 await done;
}finally{
 await instance.close();
}
