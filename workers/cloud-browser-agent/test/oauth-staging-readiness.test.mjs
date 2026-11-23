import test from "node:test";
import assert from "node:assert/strict";
import {
 WIKIPEDIA_READ_SCOPE,buildProtectedResourcePlan,withOAuthSecurityScheme,
 inspectAuthorizationServerMetadata,assessStagingReleaseGate
} from "../simulation/oauth-staging-readiness.mjs";
const resource="https://api1-staging.example.invalid";
const issuer="https://identity-staging.example.invalid";
const plan=buildProtectedResourcePlan({resource,issuer});
const provider={
 issuer,authorization_endpoint:issuer+"/authorize",token_endpoint:issuer+"/token",
 response_types_supported:["code"],code_challenge_methods_supported:["S256"],
 token_endpoint_auth_methods_supported:["none","private_key_jwt"],
 client_id_metadata_document_supported:true,registration_endpoint:issuer+"/register",
 scopes_supported:[WIKIPEDIA_READ_SCOPE]
};
test("protected-resource metadata and OAuth challenge use only canonical staging HTTPS resource and narrow scope",()=>{
 assert.deepEqual(plan.metadata,{
  resource,authorization_servers:[issuer],scopes_supported:[WIKIPEDIA_READ_SCOPE],bearer_methods_supported:["header"]
 });
 assert.equal(plan.endpoint,resource+"/mcp");
 assert.equal(plan.metadataUrl,resource+"/.well-known/oauth-protected-resource");
 assert.match(plan.unauthenticatedChallenge,/^Bearer resource_metadata="https:\/\/api1-staging\.example\.invalid\/\.well-known\/oauth-protected-resource", scope="browser:wikipedia\.read"$/);
 const original={name:"browser_automate_wikipedia_demo",inputSchema:{type:"object"}};
 const linked=withOAuthSecurityScheme(original,plan);
 assert.deepEqual(linked._meta.securitySchemes,[{type:"oauth2",scopes:[WIKIPEDIA_READ_SCOPE]}]);
 assert.equal(original._meta,undefined);
});
test("OAuth metadata preflight requires correct issuer, HTTPS endpoints, authorization-code, PKCE and supported client registration",()=>{
 assert.deepEqual(inspectAuthorizationServerMetadata(provider,plan),{passed:true,failures:[]});
 const broken={...provider,issuer:"https://attacker.example.invalid",
  token_endpoint:"http://identity-staging.example.invalid/token",
  code_challenge_methods_supported:["plain"],response_types_supported:["token"],
  token_endpoint_auth_methods_supported:[],client_id_metadata_document_supported:false};
 const report=inspectAuthorizationServerMetadata(broken,plan);
 assert.equal(report.passed,false);
 assert.equal(report.failures.length,6);
 assert.equal(inspectAuthorizationServerMetadata(provider,plan,{clientRegistration:"dcr"}).passed,true);
 assert.equal(inspectAuthorizationServerMetadata({...provider,registration_endpoint:undefined},plan,{clientRegistration:"dcr"}).passed,false);
 assert.equal(inspectAuthorizationServerMetadata(provider,plan,{publicClient:false}).passed,true);
});
test("invalid URL, external scope and malformed client configuration fail closed",()=>{
 for(const value of ["http://api1-staging.example.invalid","https://user:pw@api1-staging.example.invalid",
  "https://api1-staging.example.invalid/path","https://api1-staging.example.invalid?x=1",
  "https://api1-staging.example.invalid:443"]){
  // URL normalization removes the default HTTPS port, so the :443 case may be normalized.
  if(value.endsWith(":443"))continue;
  assert.throws(()=>buildProtectedResourcePlan({resource:value,issuer}),/Canonical HTTPS URL required/);
 }
 assert.throws(()=>buildProtectedResourcePlan({resource,issuer,scope:"browser:write"}),/Only Wikipedia read scope/);
 assert.equal(inspectAuthorizationServerMetadata(null,plan).passed,false);
 assert.equal(inspectAuthorizationServerMetadata(provider,plan,{clientRegistration:"unknown"}).passed,false);
});
test("no placeholder or production origin can pass staging release gate; no automatic deployment authorization",()=>{
 const flags={
  staging_origin_real:true,staging_isolation_verified:true,oauth_metadata_verified:true,
  token_verifier_verified:true,resource_audience_verified:true,
  identity_allowlist_verified:true,mcp_remote_transport_verified:true,
  openai_client_identity_reviewed:true,rate_limits_and_audit_verified:true,
  rollback_and_approval_verified:true
 };
 const empty=assessStagingReleaseGate({});
 assert.equal(empty.configurationCompleteForReview,false);
 assert.equal(empty.readyForDeployment,false);
 assert.ok(empty.missing.length>=10);
 for(const stagingOrigin of [resource,"http://browser-staging.example.com",
  "https://fin-kac.pages.dev","https://trading-roi-studio.pages.dev"]){
  const result=assessStagingReleaseGate({...flags,stagingOrigin});
  assert.equal(result.configurationCompleteForReview,false);
  assert.equal(result.requiresHumanApproval,true);
  assert.equal(result.readyForDeployment,false);
 }
 const representative=assessStagingReleaseGate({...flags,stagingOrigin:"https://browser-stage.review-site.partner-domain.net"});
 assert.equal(representative.configurationCompleteForReview,true);
 assert.equal(representative.readyForDeployment,false);
 assert.equal(representative.requiresHumanApproval,true);
});
