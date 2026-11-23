// Test-only export of synthetic Chromium frames for a future ChatGPT-facing presentation.
// This is NOT a transport, live streaming service, MCP tool, or production integration.
import {createPersistentVisualSession} from "./persistent-visual-session.mjs";
const allowedTabs=new Set(["google","youtube","github","staging"]);
export async function exportDisposableFrameSequence(chromium,actions=[]){
 if(!Array.isArray(actions)||actions.length>12)throw Error("Invalid frame action sequence");
 const session=await createPersistentVisualSession(chromium);
 const frames=[];
 try{
  async function capture(){
   const frame=await session.frame();
   frames.push(Object.freeze({
    sequence:frame.sequence,
    tab:frame.tab,
    page:frame.page,
    mimeType:"image/png",
    pngBase64:frame.png.toString("base64"),
    readOnly:true,
    synthetic:true
   }));
  }
  await capture();
  for(const action of actions){
   if(!action||typeof action!=="object"||Array.isArray(action))throw Error("Invalid frame action");
   const keys=Object.keys(action).sort().join(",");
   if(action.type==="switch"&&keys==="tab,type"&&allowedTabs.has(action.tab))await session.switchTab(action.tab);
   else if(action.type==="navigate"&&keys==="index,type"&&Number.isInteger(action.index))await session.navigate(action.index);
   else if(action.type==="history"&&keys==="delta,type"&&[-1,1].includes(action.delta))await session.history(action.delta);
   else throw Error("Frame action refused");
   await capture();
  }
  return Object.freeze({
   mode:"DISPOSABLE_OFFLINE_FRAME_SEQUENCE",
   live:false,
   embeddedBrowser:false,
   readOnly:true,
   networkRequests:session.state().externalRequests,
   productionWritesAllowed:false,
   frames:Object.freeze(frames),
   events:session.events()
  });
 }finally{await session.close();}
}
