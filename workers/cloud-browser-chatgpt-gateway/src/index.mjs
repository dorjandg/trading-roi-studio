import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { oauthPages } from "./oauth-authorization.mjs";
import { forwardAuthorizedMcp } from "./forward.mjs";

const RESOURCE="https://cloud-browser-chatgpt-stage.dorjan-gjoni-dg.workers.dev/mcp";
const ORIGIN="https://cloud-browser-chatgpt-stage.dorjan-gjoni-dg.workers.dev";

// The maintained library verifies the OAuth token, audience, expiry and client.
// The handler additionally enforces the granted read-only scope before proxying.
const apiHandler={
  async fetch(request,env,ctx){
    const scopes=ctx.auth?.scope||[];
    if(!scopes.includes("mcp:read")||!ctx.props?.userId)return new Response(
      JSON.stringify({error:"Insufficient OAuth permissions"}),
      {status:403,headers:{"content-type":"application/json","cache-control":"no-store"}}
    );
    return forwardAuthorizedMcp(request,env,{userId:ctx.props.userId});
  }
};
const authHandler={
  fetch(request,env){
    // Never authorize through user-controlled identity headers.
    return oauthPages.fetch(request,{...env,OAUTH_ISSUER:ORIGIN});
  }
};

// No deployment until OAuth KV, a dedicated Google OAuth client,
// an allowlisted Google account and approved staging hostname are configured.
export default new OAuthProvider({
  apiRoute:"/mcp",
  apiHandler,
  defaultHandler:authHandler,
  authorizeEndpoint:"/authorize",
  tokenEndpoint:"/oauth/token",
  scopesSupported:["mcp:read","offline_access"],
  requiredScopes:["mcp:read"],
  clientIdMetadataDocumentEnabled:true,
  resourceMetadata:{resource:RESOURCE,authorization_servers:[ORIGIN]}
});
