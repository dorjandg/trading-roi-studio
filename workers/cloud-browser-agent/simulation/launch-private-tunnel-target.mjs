// Future operator-start command. This is NOT invoked by CI, tunnel registration,
// ChatGPT plugin setup, or deployment. It starts only a 127.0.0.1 MCP listener.
// Credentials are written to a 0600 file, never displayed or committed.
import {chromium} from "playwright";
import {createPrivateTunnelPrep} from "./private-tunnel-prep.mjs";
const instance=await createPrivateTunnelPrep(chromium);
console.log("API1_PRIVATE_MCP_LOCAL_READY",JSON.stringify(instance.info));
let stop;
const done=new Promise(resolve=>{stop=resolve;});
process.once("SIGINT",stop);
process.once("SIGTERM",stop);
try{await done;}finally{await instance.close();}
