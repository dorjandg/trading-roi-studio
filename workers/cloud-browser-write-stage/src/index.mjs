/**
 * Stage 4.9 -- non-deployable, intentionally write-disabled service skeleton.
 *
 * NOT part of existing OAuth gateway / Browser Agent. No wrangler config, no
 * deployment workflow, no write route. A later, separately reviewed staging
 * deployment must add Cloudflare Access ingress and pinned issuer/JWKS config.
 */
import { createAccessJwtVerifier } from "../../cloud-browser-agent/simulation/access-jwt-verifier.mjs";

const json=(payload,status=200)=>new Response(JSON.stringify(payload),{
 status,
 headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
          "x-content-type-options":"nosniff","referrer-policy":"no-referrer"}
});
function reject(code,status=403){return json({error:code,executionAllowed:false},status)}
const allowedMethods=new Set(["GET","POST"]);
const exactKeys=(value,keys)=>value&&typeof value==="object"&&!Array.isArray(value)&&
 Object.keys(value).sort().join(",")===keys.slice().sort().join(",");
export function createWriteDisabledHandler({buildVerifier=createAccessJwtVerifier}={}){
 return async function handle(request,env={}){
  // Staging bootstrap is disabled until an independently authorized release.
  if(env.WRITE_SERVICE_BOOTSTRAP_ENABLED!=="true")return reject("SERVICE_NOT_ACTIVATED",503);
  const url=new URL(request.url);
  if(request.method==="GET"&&url.pathname==="/health")
   return json({service:"cloud-browser-write-stage",mode:"write-disabled",
     authentication:"required-for-preflight",executionAllowed:false,
     uploadsAllowed:false,productionWritesAllowed:false});
  if(!allowedMethods.has(request.method))return reject("METHOD_DENIED",405);
  if(request.method!=="POST"||url.pathname!=="/authorization-check"||url.search)
   return reject("WRITE_ENDPOINT_NOT_IMPLEMENTED",404);
  // No anonymous introspection; no unverified role headers accepted.
  const accessJwt=request.headers.get("Cf-Access-Jwt-Assertion");
  if(!accessJwt)return reject("ACCESS_JWT_REQUIRED",401);
  if(Number(request.headers.get("content-length")||0)>1024)return reject("REQUEST_TOO_LARGE",413);
  const raw=await request.text();
  if(raw.length>1024)return reject("REQUEST_TOO_LARGE",413);
  let body;try{body=JSON.parse(raw)}catch{return reject("INVALID_JSON",400)}
  if(!exactKeys(body,["purpose"])||body.purpose!=="review-identity-only")
   return reject("UNSUPPORTED_PREFLIGHT",400);
  // Pinned trusted Access keys are injected by the *server*, never supplied in
  // headers, request body or JWT token key URLs.
  if(!env.ACCESS_ISSUER||!env.ACCESS_AUDIENCE||!env.ACCESS_JWKS_JSON||
     !env.ACCESS_ROLE_ASSIGNMENTS_JSON)return reject("IDENTITY_NOT_CONFIGURED",503);
  try{
   const verifier=buildVerifier({
    issuer:env.ACCESS_ISSUER,
    audience:env.ACCESS_AUDIENCE,
    jwks:JSON.parse(env.ACCESS_JWKS_JSON),
    roleAssignments:JSON.parse(env.ACCESS_ROLE_ASSIGNMENTS_JSON)
   });
   const principal=await verifier.verify(accessJwt);
   return json({authenticated:principal.authenticated,
     role:principal.role,
     scope:"identity-preflight-only",
     executionAllowed:false,
     approvalAllowed:false,
     uploadAllowed:false,
     productionWritesAllowed:false});
  }catch{return reject("IDENTITY_VERIFICATION_FAILED",401)}
 };
}
const handler=createWriteDisabledHandler();
export default {fetch(request,env){return handler(request,env)}};
