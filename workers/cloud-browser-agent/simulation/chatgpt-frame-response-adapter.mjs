// Offline-only presentation adapter for a ChatGPT tool response. No network or MCP registration.
// Consumes only a trusted in-memory frame export. Deliberately omits tokens and raw PNG bytes
// from JSON; callers may attach image blocks through a separately approved transport.
export function prepareChatFrameResponse(exported,{maxFrames=4}={}){
 if(!exported||exported.mode!=="DISPOSABLE_OFFLINE_FRAME_SEQUENCE"||exported.live!==false||exported.networkRequests!==0||exported.productionWritesAllowed!==false||!Array.isArray(exported.frames))throw Error("Untrusted frame export");
 if(!Number.isInteger(maxFrames)||maxFrames<1||maxFrames>12)throw Error("Invalid frame limit");
 const selected=exported.frames.slice(0,maxFrames);
 let previous=0;
 const images=selected.map(frame=>{
  if(!Number.isSafeInteger(frame.sequence)||frame.sequence<=previous||frame.mimeType!=="image/png"||frame.synthetic!==true||frame.readOnly!==true||typeof frame.pngBase64!=="string")throw Error("Invalid frame metadata");
  previous=frame.sequence;
  const png=Buffer.from(frame.pngBase64,"base64");
  if(png.length<8||png.length>2_000_000||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error("Invalid PNG frame");
  if(!["google","youtube","github","staging"].includes(frame.tab)||typeof frame.page!=="string"||frame.page.length>64)throw Error("Invalid synthetic tab");
  return Object.freeze({sequence:frame.sequence,tab:frame.tab,page:frame.page,mimeType:"image/png",data:png});
 });
 return Object.freeze({
  text:Object.freeze({mode:"offline-frame-preview",live:false,embeddedBrowser:false,readOnly:true,frameCount:images.length,networkRequests:0,warning:"Synthetic disposable pages only; no live ChatGPT browser connection"}),
  images:Object.freeze(images)
 });
}
