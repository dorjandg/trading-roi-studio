import { AuthorizationError, CimdFetchError } from "@cloudflare/workers-oauth-provider";
import {buildGoogleLoginUrl,pkceChallenge,exchangeGoogleCode,verifyGoogleIdentity} from "./google-login.mjs";
import {renderConsent} from "./consent.mjs";

const text=(message,status=400)=>new Response(message,{status,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}});
const redirect=(headers)=>new Response(null,{status:302,headers});
function configured(env){return !!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.GOOGLE_ALLOWED_EMAIL);}
function redirectUri(request){return new URL("/callback",request.url).toString();}
function newSecret(){return crypto.randomUUID()+crypto.randomUUID();}
async function beginGoogle(auth,request,env,headers){
  const verifier=newSecret(),nonce=newSecret();
  const upstream=await auth.beginUpstream(request,{data:{verifier,nonce},headers});
  const url=buildGoogleLoginUrl({clientId:env.GOOGLE_CLIENT_ID,redirectUri:redirectUri(new Request(new URL("/",env.OAUTH_ISSUER))),state:upstream.state,verifier,nonce});
  url.searchParams.set("code_challenge",await pkceChallenge(verifier));
  upstream.headers.set("Location",url.href);
  return redirect(upstream.headers);
}

export const oauthPages={
  async fetch(request,env){
    if(!configured(env)||!env.OAUTH_PROVIDER||!env.OAUTH_ISSUER)return text("OAuth sign-in not configured",503);
    const auth=env.OAUTH_PROVIDER;
    const path=new URL(request.url).pathname;
    try{
      if(path==="/authorize"&&request.method==="GET"){
        const original=await auth.parseAuthRequest(request);
        const details=await auth.describeConsent(original);
        const consent=await auth.beginConsent(original);
        consent.headers.set("content-type","text/html; charset=utf-8");
        return new Response(renderConsent(details,consent.handle),{headers:consent.headers});
      }
      if(path==="/authorize"&&request.method==="POST"){
        const form=await request.formData();
        const handle=String(form.get("handle")||"");
        if(form.get("decision")!=="approve"){
          const result=await auth.denyConsent(request,handle);
          return redirect(result.headers);
        }
        const approved=await auth.approveConsent(request,handle,{scope:form.getAll("scope").map(String)});
        if(!approved.request.scope.includes("mcp:read"))return text("Read-only scope required",403);
        return beginGoogle(auth,approved.request,env,approved.headers);
      }
      if(path==="/callback"&&request.method==="GET"){
        const {request:original,data,headers}=await auth.finishUpstream(request);
        const query=new URL(request.url).searchParams;
        if(query.has("error")||!query.get("code")){
          const result=await auth.completeAuthorization; // no grant on rejection
          return text("Google authorization denied",403);
        }
        const idToken=await exchangeGoogleCode({
          code:query.get("code"),verifier:data.verifier,clientId:env.GOOGLE_CLIENT_ID,
          clientSecret:env.GOOGLE_CLIENT_SECRET,redirectUri:new URL("/callback",env.OAUTH_ISSUER).toString()
        });
        if(!idToken)return text("Google authentication failed",401);
        const verified=await verifyGoogleIdentity({idToken,clientId:env.GOOGLE_CLIENT_ID,nonce:data.nonce,allowedEmail:env.GOOGLE_ALLOWED_EMAIL});
        if(!verified)return text("This Google account is not authorized",403);
        const completed=await auth.completeAuthorization({
          request:original,userId:verified.userId,metadata:{},scope:original.scope,
          props:{userId:verified.userId,email:verified.email}
        });
        headers.set("Location",completed.redirectTo);
        return redirect(headers);
      }
      return text("Not found",404);
    }catch(error){
      if(error instanceof AuthorizationError&&error.redirectTo)return Response.redirect(error.redirectTo,302);
      if(error instanceof AuthorizationError||error instanceof CimdFetchError)return text("OAuth authorization request invalid",400);
      // Never return upstream token errors or identity details to callers.
      return text("OAuth operation failed",500);
    }
  }
};
