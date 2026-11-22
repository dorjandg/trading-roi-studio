import { createHandler, authorized } from "./handler.mjs";
import { validateTarget } from "./policy.mjs";

const headers = {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const json = (obj,status=200) => new Response(JSON.stringify(obj),{status,headers});
const content = value => ({content:[{type:"text",text:JSON.stringify(value)}]});
const tools = [
  {name:"browser_agent_status",description:"Read staging browser-agent status; no website interactions.",inputSchema:{type:"object",properties:{},additionalProperties:false}},
  {name:"browser_inspect",description:"Read-only inspection of a preapproved HTTPS website: title, headings, link count and HTTP status. No clicks, logins, forms or trading.",inputSchema:{type:"object",properties:{url:{type:"string",description:"Approved HTTPS URL to inspect"}},required:["url"],additionalProperties:false}}
];
export function createMcpHandler(launch) {
  const handler=createHandler(launch);
  return async (request,env)=>{
    if(!(await authorized(request,env))) return json({error:"Unauthorized"},401);
    if(request.method!=="POST") return json({error:"Method not allowed"},405);
    if(Number(request.headers.get("content-length")||"0")>4096) return json({error:"Request too large"},413);
    const raw=await request.text();
    if(raw.length>4096) return json({error:"Request too large"},413);
    let rpc;try{rpc=JSON.parse(raw);}catch{return json({error:"Invalid JSON"},400);}
    if(!rpc||rpc.jsonrpc!=="2.0"||typeof rpc.method!=="string"||Array.isArray(rpc))return json({error:"Invalid JSON-RPC"},400);
    if(rpc.method==="notifications/initialized")return new Response(null,{status:202,headers:{"cache-control":"no-store"}});
    const reply=(result)=>json({jsonrpc:"2.0",id:rpc.id??null,result});
    const error=(code,message)=>json({jsonrpc:"2.0",id:rpc.id??null,error:{code,message}});
    if(rpc.method==="initialize")return reply({protocolVersion:"2025-06-18",capabilities:{tools:{listChanged:false}},serverInfo:{name:"cloud-browser-agent-staging",version:"0.1.0"}});
    if(rpc.method==="ping")return reply({});
    if(rpc.method==="tools/list")return reply({tools});
    if(rpc.method!=="tools/call")return error(-32601,"Method not found");
    const name=rpc.params?.name;
    const args=rpc.params?.arguments??{};
    if(!args||typeof args!=="object"||Array.isArray(args))return error(-32602,"Invalid arguments");
    if(name==="browser_agent_status"&&Object.keys(args).length===0){
      return reply(content({service:"cloud-browser-agent",mode:"read-only",browserConfigured:!!env.BROWSER}));
    }
    if(name!=="browser_inspect")return error(-32602,"Unknown tool or invalid arguments");
    if(Object.keys(args).length!==1||typeof args.url!=="string")return error(-32602,"Expected only URL");
    try{validateTarget(args.url,env.ALLOWED_ORIGINS);}catch{return error(-32602,"URL not approved");}
    const internal=new Request(new URL("/inspect",request.url),{method:"POST",headers:{authorization:request.headers.get("authorization")||"","content-type":"application/json"},body:JSON.stringify({url:args.url})});
    const response=await handler(internal,env);
    const value=await response.json();
    return reply({...content(value),isError:!response.ok});
  };
}
