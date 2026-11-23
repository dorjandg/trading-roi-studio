import {timingSafeEqual} from "node:crypto";
// TEST ONLY: isolated JSON-RPC MCP entrypoint, never imported by deployed src/mcp.mjs.
// No HTTP listener, real URLs, Cloudflare bindings, persistent sessions, or credentials.
import {simulateChatGptImageToolCall} from "./chatgpt-mcp-image-preview.mjs";
const MAX_RESPONSE_BYTES=8_000_000;
const tool={name:"synthetic_frame_preview",description:"Offline synthetic Chromium PNG frames only; no real websites or live browser.",inputSchema:{type:"object",additionalProperties:false,properties:{actions:{type:"array",maxItems:3,items:{oneOf:[{type:"object",additionalProperties:false,properties:{type:{const:"switch"},tab:{enum:["google","youtube","github","staging"]}},required:["type","tab"]},{type:"object",additionalProperties:false,properties:{type:{const:"navigate"},index:{type:"integer",minimum:0,maximum:2}},required:["type","index"]},{type:"object",additionalProperties:false,properties:{type:{const:"history"},delta:{enum:[-1,1]}},required:["type","delta"]}]}},maxFrames:{type:"integer",minimum:1,maximum:4}}}};
export function createSyntheticImageMcpHandler(chromium,{secret}={}){
 if(typeof secret!=="string"||secret.length<32)throw Error("Test-only bearer secret required");
 return async function handle(request){
  const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
  const reply=(id,result)=>new Response(JSON.stringify({jsonrpc:"2.0",id,result}),{status:200,headers});
  const error=(id,code,message)=>new Response(JSON.stringify({jsonrpc:"2.0",id,error:{code,message}}),{status:200,headers});
  if(request.method!=="POST")return new Response("Method not allowed",{status:405,headers});
  if(request.headers.get("origin"))return new Response("Origin forbidden",{status:403,headers});
  const supplied=request.headers.get("authorization")||"";
  const expected=`Bearer ${secret}`;
  const a=Buffer.from(supplied),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))return new Response("Unauthorized",{status:401,headers});
  if(request.headers.get("content-type")!=="application/json")return new Response("JSON required",{status:415,headers});
  if(Number(request.headers.get("content-length")||0)>2048)return new Response("Request too large",{status:413,headers});
  let raw;try{raw=await request.text();}catch{return new Response("Invalid request",{status:400,headers});}
  if(raw.length>2048)return new Response("Request too large",{status:413,headers});
  let rpc;try{rpc=JSON.parse(raw);}catch{return new Response("Invalid JSON",{status:400,headers});}
  if(!rpc||typeof rpc!=="object"||Array.isArray(rpc)||Object.keys(rpc).some(k=>!["jsonrpc","id","method","params"].includes(k))||rpc.jsonrpc!=="2.0"||typeof rpc.method!=="string"||!Object.hasOwn(rpc,"id")||!Number.isSafeInteger(rpc.id)||rpc.id<0)return new Response("Invalid JSON-RPC",{status:400,headers});
  const id=rpc.id;
  if(["initialize","ping","tools/list"].includes(rpc.method)&&rpc.params!==undefined&&(!rpc.params||typeof rpc.params!=="object"||Array.isArray(rpc.params)||Object.keys(rpc.params).length!==0))return error(id,-32602,"Unexpected parameters");
  if(rpc.method==="initialize")return reply(id,{protocolVersion:"2025-06-18",capabilities:{tools:{listChanged:false}},serverInfo:{name:"synthetic-frame-test-only",version:"0.0.1"}});
  if(rpc.method==="ping")return reply(id,{});
  if(rpc.method==="tools/list")return reply(id,{tools:[tool]});
  if(rpc.method!=="tools/call")return error(id,-32601,"Method not found");
  if(!rpc.params||typeof rpc.params!=="object"||Array.isArray(rpc.params)||rpc.params.name!=="synthetic_frame_preview"||Object.keys(rpc.params).sort().join(",")!=="arguments,name")return error(id,-32602,"Tool refused");
  const args=rpc.params.arguments;
  if(!args||typeof args!=="object"||Array.isArray(args)||Object.keys(args).some(k=>!["actions","maxFrames"].includes(k)))return error(id,-32602,"Invalid arguments");
  const actions=args.actions??[],maxFrames=args.maxFrames??4;
  if(!Array.isArray(actions)||actions.length>3||!Number.isInteger(maxFrames)||maxFrames<1||maxFrames>4)return error(id,-32602,"Preview limits exceeded");
  for(const action of actions){
   if(!action||typeof action!=="object"||Array.isArray(action))return error(id,-32602,"Invalid action");
   const keys=Object.keys(action).sort().join(",");
   if(!((action.type==="switch"&&keys==="tab,type"&&["google","youtube","github","staging"].includes(action.tab))||(action.type==="navigate"&&keys==="index,type"&&Number.isInteger(action.index)&&action.index>=0&&action.index<=2)||(action.type==="history"&&keys==="delta,type"&&[-1,1].includes(action.delta))))return error(id,-32602,"Action refused");
  }
  try{
   const result=await simulateChatGptImageToolCall(chromium,{actions,maxFrames});
   // Calculate UTF-8 response size before creating the final serialized RPC response.
   // JSON string length is not a byte limit when metadata contains non-ASCII text.
   const envelope=JSON.stringify({jsonrpc:"2.0",id,result});
   if(Buffer.byteLength(envelope,"utf8")>MAX_RESPONSE_BYTES)return error(id,-32000,"Image response too large");
   return new Response(envelope,{status:200,headers});
  }catch{return error(id,-32000,"Synthetic frame preview failed");}
 };
}
