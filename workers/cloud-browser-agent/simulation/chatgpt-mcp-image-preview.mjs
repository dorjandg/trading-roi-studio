// Offline MCP image-response experiment. Never imported by deployed src/mcp.mjs.
import {exportDisposableFrameSequence} from "./chatgpt-frame-export.mjs";
import {prepareChatFrameResponse} from "./chatgpt-frame-response-adapter.mjs";
export async function simulateChatGptImageToolCall(chromium,args={}){
 if(!args||typeof args!=="object"||Array.isArray(args)||Object.keys(args).some(k=>!["actions","maxFrames"].includes(k)))throw Error("Invalid tool arguments");
 const actions=args.actions??[],maxFrames=args.maxFrames??4;
 if(!Array.isArray(actions)||actions.length>3||!Number.isInteger(maxFrames)||maxFrames<1||maxFrames>4)throw Error("Preview limits exceeded");
 const prepared=prepareChatFrameResponse(await exportDisposableFrameSequence(chromium,actions),{maxFrames});
 return {isError:false,content:[{type:"text",text:JSON.stringify(prepared.text)},...prepared.images.map(f=>({type:"image",data:f.data.toString("base64"),mimeType:f.mimeType}))]};
}
