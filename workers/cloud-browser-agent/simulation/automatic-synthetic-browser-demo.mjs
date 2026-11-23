// Autonomous offline-only demonstration. No real URLs, HTTP listener or user interaction.
import {exportDisposableFrameSequence} from "./chatgpt-frame-export.mjs";
export const AUTO_BROWSER_TABS=Object.freeze(["google","youtube","github","staging"]);
export const AUTO_BROWSER_LABELS=Object.freeze(["Google","YouTube","GitHub","JP Realty"]);
export async function runAutomaticSyntheticBrowser(chromium){
 const actions=AUTO_BROWSER_TABS.slice(1).map(tab=>({type:"switch",tab}));
 const result=await exportDisposableFrameSequence(chromium,actions);
 if(result.networkRequests!==0||result.live!==false||result.productionWritesAllowed!==false)throw Error("Offline isolation failed");
 if(result.frames.length!==4||result.frames.some((f,i)=>f.tab!==AUTO_BROWSER_TABS[i]||f.mimeType!=="image/png"||f.synthetic!==true))throw Error("Unexpected automatic sequence");
 return Object.freeze({labels:AUTO_BROWSER_LABELS,frames:result.frames,networkRequests:0,live:false,readOnly:true,events:result.events});
}
