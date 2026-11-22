// Public MCP handshake and tool schema discovery only.
// Browser actions NEVER execute here: OAuthProvider authenticates every tools/call.
const readonly={readOnlyHint:true,destructiveHint:false,openWorldHint:true};
const oauth={securitySchemes:[{type:"oauth2",scopes:["mcp:read"]}]};
const urlSchema={type:"object",properties:{url:{type:"string",description:"Approved HTTPS page URL; must belong to the staging allowlist"}},required:["url"],additionalProperties:false};
export const advertisedTools=Object.freeze([
  {name:"browser_agent_status",title:"Check Browser Agent status",description:"Use to confirm an authorized read-only Browser Agent session and browser availability. Does not navigate websites.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{...readonly,openWorldHint:false},_meta:oauth},
  {name:"browser_inspect",title:"Inspect approved website",description:"Use to inspect the title, headings, HTTP status and link count on an approved HTTPS website. Read-only; cannot login, click or modify content.",inputSchema:urlSchema,annotations:readonly,_meta:oauth},
  {name:"browser_follow_link",title:"Follow approved page link (read only)",description:"GET navigation only to a same-origin link present on the source page; blocks action-like paths and all form submissions. No clicking, posting or editing.",inputSchema:{type:"object",properties:{url:{type:"string",description:"Source page approved HTTPS URL, without query parameters"},linkUrl:{type:"string",description:"Exact same-origin approved link on source page, without query parameters"}},required:["url","linkUrl"],additionalProperties:false},annotations:readonly,_meta:oauth},
  {name:"browser_form_inventory",title:"Inspect form layout (no values)",description:"Read only form structure, safe field labels and types on approved websites. Never retrieves input values, hidden credentials, passwords or uploads. Cannot submit forms.",inputSchema:urlSchema,annotations:readonly,_meta:oauth},
  {name:"browser_edit_preview",title:"Preview text edit (no changes)",description:"Preflight only: show proposed text change for one eligible field. Does not read current values or execute a write. Cannot approve, fill, click, submit, upload or save.",inputSchema:{type:"object",properties:{url:{type:"string",description:"Approved HTTPS page URL without query parameters"},formIndex:{type:"integer",minimum:1,maximum:12},fieldLabel:{type:"string",description:"Exact field label shown by browser_form_inventory"},proposedText:{type:"string",minLength:1,maxLength:1200}},required:["url","formIndex","fieldLabel","proposedText"],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},_meta:oauth},
  {name:"browser_page_links",title:"Discover approved website pages",description:"Use to discover up to 30 same-origin links on an approved HTTPS website. No clicks or submissions; output removes query parameters.",inputSchema:urlSchema,annotations:readonly,_meta:oauth}
]);
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const reply=(id,result)=>new Response(JSON.stringify({jsonrpc:"2.0",id,result}),{status:200,headers});
export async function publicDiscovery(request){
  const url=new URL(request.url);
  if(url.pathname!=="/mcp"||request.method!=="POST")return null;
  if(Number(request.headers.get("content-length")||0)>4096)return new Response("Request too large",{status:413});
  const raw=await request.clone().text();
  if(raw.length>4096)return new Response("Request too large",{status:413});
  let rpc;
  try{rpc=JSON.parse(raw)}catch{return null}
  if(!rpc||rpc.jsonrpc!=="2.0"||typeof rpc.method!=="string"||!Object.prototype.hasOwnProperty.call(rpc,"id")||Array.isArray(rpc))return null;
  if(rpc.method==="initialize")return reply(rpc.id,{
    protocolVersion:"2025-06-18",
    capabilities:{tools:{listChanged:false}},
    serverInfo:{name:"cloud-browser-chatgpt-stage",version:"0.2.0"},
    instructions:"This gateway offers only read-only website inspection on an exact HTTPS allowlist. All tool execution requires Google-backed OAuth mcp:read. Never use this service to click buttons, authenticate into websites, trade, change settings or write data."
  });
  if(rpc.method==="tools/list")return reply(rpc.id,{tools:advertisedTools});
  return null; // Tool execution and all other methods are exclusively OAuth-protected.
}
