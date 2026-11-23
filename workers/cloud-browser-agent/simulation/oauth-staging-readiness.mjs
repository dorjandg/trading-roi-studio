// API 1 staging OAuth readiness: OFFLINE CONTRACT/PREFLIGHT ONLY.
// This module does not open ports, exchange codes, verify JWT signatures,
// fetch IdP metadata, register an OAuth client or change Cloudflare/production.
// The deployed gateway must use a maintained OAuth/JWT verification library.
export const WIKIPEDIA_READ_SCOPE="browser:wikipedia.read";
const invalidHost=host=>/(?:^|\.)((?:example|test|invalid|localhost)(?:\.[a-z]+)?)$/.test(host)||host.endsWith(".invalid");
const exactKeys=(value,keys)=>value&&typeof value==="object"&&!Array.isArray(value)&&
 Object.keys(value).every(k=>keys.includes(k));
function httpsUrl(value,allowPath=false){
 if(typeof value!=="string")throw Error("Expected HTTPS URL");
 const parsed=new URL(value);
 if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.port||
  parsed.search||parsed.hash||(!allowPath&&parsed.pathname!=="/"))
  throw Error("Canonical HTTPS URL required");
 return parsed;
}
const canonical=u=>u.href.replace(/\/$/,"");
export function buildProtectedResourcePlan({resource,issuer,scope=WIKIPEDIA_READ_SCOPE}){
 const resourceUrl=httpsUrl(resource);
 const issuerUrl=httpsUrl(issuer,true);
 if(scope!==WIKIPEDIA_READ_SCOPE)throw Error("Only Wikipedia read scope supported");
 const resourceId=canonical(resourceUrl);
 const issuerId=canonical(issuerUrl);
 const metadataUrl=resourceId+"/.well-known/oauth-protected-resource";
 return Object.freeze({
  endpoint:resourceId+"/mcp",
  metadataUrl,
  metadata:Object.freeze({
   resource:resourceId,authorization_servers:[issuerId],
   scopes_supported:[scope],bearer_methods_supported:["header"]
  }),
  unauthenticatedChallenge:
   'Bearer resource_metadata="'+metadataUrl+'", scope="'+scope+'"',
  toolSecuritySchemes:Object.freeze([{type:"oauth2",scopes:[scope]}])
 });
}
export function withOAuthSecurityScheme(tool,plan){
 if(!tool||typeof tool!=="object"||Array.isArray(tool)||!tool.name||
  !plan||!Array.isArray(plan.toolSecuritySchemes))throw Error("Tool and OAuth plan required");
 return {...tool,_meta:{...(tool._meta||{}),
  securitySchemes:plan.toolSecuritySchemes.map(s=>({type:s.type,scopes:[...s.scopes]}))}};
}
export function inspectAuthorizationServerMetadata(document,plan,{clientRegistration="cimd",publicClient=true}={}){
 const failures=[];
 if(!document||typeof document!=="object"||Array.isArray(document))return {
  passed:false,failures:["Authorization server discovery metadata missing"]
 };
 const requiredIssuer=plan.metadata.authorization_servers[0];
 if(document.issuer!==requiredIssuer)failures.push("OAuth issuer does not match protected resource metadata");
 for(const field of ["authorization_endpoint","token_endpoint"]){
  try{httpsUrl(document[field],true);}catch{failures.push(field+" must be HTTPS");}
 }
 if(!Array.isArray(document.code_challenge_methods_supported)||
  !document.code_challenge_methods_supported.includes("S256"))failures.push("PKCE S256 not advertised");
 if(!Array.isArray(document.response_types_supported)||
  !document.response_types_supported.includes("code"))failures.push("Authorization code grant not advertised");
 if(!Array.isArray(document.token_endpoint_auth_methods_supported)||
  !document.token_endpoint_auth_methods_supported.includes(publicClient?"none":"private_key_jwt"))
  failures.push("Chosen client token authentication method not advertised");
 if(clientRegistration==="cimd"){
  if(document.client_id_metadata_document_supported!==true)
   failures.push("CIMD client identification not advertised");
 }else if(clientRegistration==="dcr"){
  try{httpsUrl(document.registration_endpoint,true);}catch{failures.push("DCR registration endpoint missing or not HTTPS");}
 }else if(clientRegistration!=="predefined")failures.push("Unsupported client registration method");
 // This is a metadata check only; resource-bound token issuance and actual
 // issuer/audience/scope/signature verification require separate live tests.
 return {passed:failures.length===0,failures};
}
export function assessStagingReleaseGate(input){
 // Evidence flags are declarations to be verified by reviewers, never proof.
 // This function MUST NOT be used as runtime authorization or deployment approval.
 const requirements=[
  ["staging_origin_real","Dedicated staging HTTPS hostname (not .invalid, localhost or production)"],
  ["staging_isolation_verified","Separate staging identity, runtime, namespace and secrets"],
  ["oauth_metadata_verified","OAuth discovery: issuer, endpoints, PKCE S256, client registration"],
  ["token_verifier_verified","Cryptographic JWT/JWKS or introspection verification in resource server"],
  ["resource_audience_verified","Resource audience binding and issuer/expiry/scope enforcement"],
  ["identity_allowlist_verified","Explicit authorized test-user policy and least privilege"],
  ["mcp_remote_transport_verified","Authenticated MCP remote transport tested against HTTPS staging"],
  ["openai_client_identity_reviewed","Client identity (mTLS where applicable) and callback review"],
  ["rate_limits_and_audit_verified","Rate limits, sensitive-log redaction, revocation and kill switch"],
  ["rollback_and_approval_verified","Documented rollback and explicit separate deployment approval"]
 ];
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Staging gate input required");
 const report=requirements.map(([key,description])=>({key,description,verified:input[key]===true}));
 const origin=input.stagingOrigin;
 let validOrigin=false;
 try{const url=httpsUrl(origin);validOrigin=!invalidHost(url.hostname);}catch{}
 // Explicitly block the observed production host from ever being classified staging.
 if(origin==="https://fin-kac.pages.dev"||origin==="https://trading-roi-studio.pages.dev")
  validOrigin=false;
 const missing=report.filter(x=>!x.verified).map(x=>x.key);
 if(!validOrigin||!input.stagingOrigin)missing.unshift("real_dedicated_staging_origin");
 return Object.freeze({mode:"offline-readiness-review-only",
  readyForDeployment:false,requiresHumanApproval:true,
  configurationCompleteForReview:missing.length===0,
  missing,requirements:report});
}
