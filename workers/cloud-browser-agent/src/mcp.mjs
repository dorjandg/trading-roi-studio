import { createHandler, authorized } from "./handler.mjs";
import { validateManagedPilot, executeManagedPilot } from "./omnipilot-managed-pilot.mjs";
import { validateTarget, validateReadOnlyLink } from "./policy.mjs";
import { validateEditPreviewRequest } from "./edit-preview.mjs";

const headers = {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const json = (obj,status=200) => new Response(JSON.stringify(obj),{status,headers});
const content = value => ({content:[{type:"text",text:JSON.stringify(value)}]});
const pilotTool = {
  name:"omnipilot_managed_demo",
  description:"Opt-in public TodoMVC interaction only. Executes real browser actions on the disposable demonstration website; not arbitrary websites, authenticated sites, files, credentials or production. Actions may modify the demo page; uncertain results must never be retried automatically.",
  inputSchema:{type:"object",additionalProperties:false,required:["url","actions"],properties:{
    url:{const:"https://demo.playwright.dev/todomvc/"},
    actions:{type:"array",minItems:1,maxItems:5,items:{type:"object",additionalProperties:false,
      required:["op","selector"],properties:{
        op:{enum:["fill","press","click","wait"]},
        selector:{type:"string",minLength:1,maxLength:120},
        value:{type:"string",maxLength:256},
        key:{enum:["Enter","Escape","Tab","Space"]}
      }}}
  }}
};
const tools = [
  {name:"browser_agent_status",description:"Read staging browser-agent status; no website interactions.",inputSchema:{type:"object",properties:{},additionalProperties:false}},
  {name:"browser_page_links",description:"Discover up to 30 unique same-origin HTTPS links on an approved page; no clicks or forms. Query strings removed.",inputSchema:{type:"object",properties:{url:{type:"string"}},required:["url"],additionalProperties:false}},
  {name:"browser_follow_link",description:"Read-only GET navigation to an exact same-origin anchor found on the source page; blocks form submissions, query-string URLs and action-like paths. Does not click or edit.",inputSchema:{type:"object",properties:{url:{type:"string"},linkUrl:{type:"string"}},required:["url","linkUrl"],additionalProperties:false}},
  {name:"browser_form_inventory",description:"List only non-sensitive website form field structure. Never reads form values, hidden fields, passwords, files or user data, and cannot edit or submit.",inputSchema:{type:"object",properties:{url:{type:"string"}},required:["url"],additionalProperties:false}},
  {name:"browser_edit_preview",description:"Review proposed plain-text edits to a single non-sensitive field on an approved page. NEVER fills, clicks, submits, uploads or saves. No approval tokens issued.",inputSchema:{type:"object",properties:{url:{type:"string"},formIndex:{type:"integer"},fieldLabel:{type:"string"},proposedText:{type:"string"}},required:["url","formIndex","fieldLabel","proposedText"],additionalProperties:false}},
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
    if(rpc.method==="tools/list")return reply({tools:env.OMNIPILOT_MANAGED_PILOT_ENABLED==="true"?[...tools,pilotTool]:tools});
    if(rpc.method!=="tools/call")return error(-32601,"Method not found");
    const name=rpc.params?.name;
    const args=rpc.params?.arguments??{};
    if(!args||typeof args!=="object"||Array.isArray(args))return error(-32602,"Invalid arguments");
    if(name==="omnipilot_managed_demo"){
      if(env.OMNIPILOT_MANAGED_PILOT_ENABLED!=="true")return error(-32602,"Unknown tool or invalid arguments");
      try{validateManagedPilot(args);}catch{return error(-32602,"Managed pilot arguments refused");}
      const outcome=await executeManagedPilot(env.BROWSER,args);
      return reply({...content(outcome),isError:outcome.ok!==true});
    }
    if(name==="browser_agent_status"&&Object.keys(args).length===0){
      return reply(content({service:"cloud-browser-agent",mode:"read-only",browserConfigured:!!env.BROWSER}));
    }
    if(name==="browser_edit_preview"){
      try { validateEditPreviewRequest(args,env.ALLOWED_ORIGINS); }
      catch { return error(-32602,"Preview arguments rejected"); }
      const internal=new Request(new URL("/edit-preview",request.url),{method:"POST",headers:{authorization:request.headers.get("authorization")||"","content-type":"application/json"},body:JSON.stringify(args)});
      const response=await handler(internal,env);
      const value=await response.json();
      return reply({...content(value),isError:!response.ok});
    }
    if(name==="browser_follow_link"){
      if(Object.keys(args).sort().join(",")!=="linkUrl,url"||typeof args.url!=="string"||typeof args.linkUrl!=="string")return error(-32602,"Expected source URL and link URL only");
      try{validateReadOnlyLink(args.url,args.linkUrl,env.ALLOWED_ORIGINS)}catch{return error(-32602,"Navigation not approved");}
      const internal=new Request(new URL("/follow",request.url),{method:"POST",headers:{authorization:request.headers.get("authorization")||"","content-type":"application/json"},body:JSON.stringify({url:args.url,linkUrl:args.linkUrl})});
      const response=await handler(internal,env);
      const value=await response.json();
      return reply({...content(value),isError:!response.ok});
    }
    if(!["browser_inspect","browser_page_links","browser_form_inventory"].includes(name))return error(-32602,"Unknown tool or invalid arguments");
    if(Object.keys(args).length!==1||typeof args.url!=="string")return error(-32602,"Expected only URL");
    try{validateTarget(args.url,env.ALLOWED_ORIGINS);}catch{return error(-32602,"URL not approved");}
    const internal=new Request(new URL(name==="browser_page_links"?"/links":name==="browser_form_inventory"?"/forms":"/inspect",request.url),{method:"POST",headers:{authorization:request.headers.get("authorization")||"","content-type":"application/json"},body:JSON.stringify({url:args.url})});
    const response=await handler(internal,env);
    const value=await response.json();
    return reply({...content(value),isError:!response.ok});
  };
}
