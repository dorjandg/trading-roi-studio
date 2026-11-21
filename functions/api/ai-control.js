/**
 * AI Control Gateway (prototype): metadata-only MCP endpoint.
 * No financial data, credentials, or mutating operations are exposed.
 * Not production-ready: configure OAuth resource-server authentication before deployment.
 */
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const TOOLS=[{name:"finance_api_contract",description:"Describe the Finance Hub control API integration status; does not retrieve financial records.",inputSchema:{type:"object",properties:{},additionalProperties:false}}];
export async function onRequest({request,env}){
  // Fail closed until a gateway-specific authentication layer is implemented.
  if(env.AI_GATEWAY_ENABLED!=="true")return json({error:"Gateway disabled"},503);
  // Do not enable this prototype in production: no trusted OAuth identity validation exists yet.
  return json({error:"OAuth resource-server authentication not configured"},501);
}
export const gatewayContract={protocol:"mcp",version:"2025-06-18",tools:TOOLS};
