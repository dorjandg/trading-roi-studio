/**
 * RFC 9728 OAuth protected-resource metadata for the Finance AI gateway.
 * Does not publish metadata until the gateway and trusted issuer are configured.
 */
const reply=(body,status)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function onRequest({request,env}){
 if(request.method!=="GET")return reply({error:"Method not allowed"},405);
 const issuer=String(env.AI_GATEWAY_ISSUER||"");
 const resource=String(env.AI_GATEWAY_RESOURCE_URL||"");
 if(env.AI_GATEWAY_ENABLED!=="true"||!issuer.startsWith("https://")||!resource.startsWith("https://"))return reply({error:"Gateway unavailable"},503);
 let parsed;try{parsed=new URL(resource)}catch{return reply({error:"Gateway unavailable"},503)}
 if(parsed.username||parsed.password||parsed.hash||parsed.search||parsed.pathname!=="/api/ai-control")return reply({error:"Gateway unavailable"},503);
 if(parsed.origin!==new URL(request.url).origin)return reply({error:"Gateway unavailable"},503);
 return reply({resource,authorization_servers:[issuer],scopes_supported:["finance:metadata:read"],bearer_methods_supported:["header"]},200);
}
