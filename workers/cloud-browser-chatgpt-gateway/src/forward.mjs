const BASE="https://cloud-browser-agent-stage.dorjan-gjoni-dg.workers.dev";
const MAX_BODY=4096;
const json=(value,status)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
const invalid=(msg)=>json({jsonrpc:"2.0",id:null,error:{code:-32600,message:msg}},400);

export function validateRpc(value){
  if(!value||typeof value!=="object"||Array.isArray(value)||value.jsonrpc!=="2.0"||typeof value.method!=="string")return false;
  if(["initialize","ping","tools/list","notifications/initialized"].includes(value.method))return true;
  if(value.method!=="tools/call"||!value.params||typeof value.params!=="object")return false;
  const {name,arguments:args={}}=value.params;
  if(name==="browser_agent_status")return args&&typeof args==="object"&&!Array.isArray(args)&&Object.keys(args).length===0;
  if(name==="browser_inspect")return args&&typeof args==="object"&&!Array.isArray(args)&&Object.keys(args).length===1&&typeof args.url==="string";
  return false;
}

export async function forwardAuthorizedMcp(request,env,authorizedUser,fetcher=fetch){
  // Caller must supply an identity validated by a real OAuth provider, not a user-controllable header.
  if(!authorizedUser||typeof authorizedUser.userId!=="string"||!authorizedUser.userId)return json({error:"OAuth authorization required"},401);
  if(request.method!=="POST")return json({error:"Method not allowed"},405);
  if(!env?.CF_ACCESS_CLIENT_ID||!env?.CF_ACCESS_CLIENT_SECRET||!env?.BROWSER_AGENT_API_TOKEN)return json({error:"Gateway credentials unavailable"},503);
  if(Number(request.headers.get("content-length")||0)>MAX_BODY)return json({error:"Request too large"},413);
  const body=await request.text();
  if(body.length>MAX_BODY)return json({error:"Request too large"},413);
  let rpc;try{rpc=JSON.parse(body)}catch{return invalid("Invalid JSON");}
  if(!validateRpc(rpc))return invalid("Unsupported or invalid MCP action");
  const response=await fetcher(BASE+"/mcp",{
    method:"POST",
    redirect:"manual",
    headers:{
      "content-type":"application/json",
      "CF-Access-Client-Id":env.CF_ACCESS_CLIENT_ID,
      "CF-Access-Client-Secret":env.CF_ACCESS_CLIENT_SECRET,
      "Authorization":"Bearer "+env.BROWSER_AGENT_API_TOKEN
    },
    body,
    signal:AbortSignal.timeout(30000)
  });
  if(response.status>=300&&response.status<400)return json({error:"Upstream redirect rejected"},502);
  if(response.status!==200&&response.status!==202)return json({error:"Upstream MCP unavailable",status:response.status},502);
  if(response.status===202)return new Response(null,{status:202,headers:{"cache-control":"no-store"}});
  const text=await response.text();
  if(text.length>65536)return json({error:"Upstream response too large"},502);
  try{JSON.parse(text)}catch{return json({error:"Upstream response invalid"},502)}
  return new Response(text,{status:200,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
}
