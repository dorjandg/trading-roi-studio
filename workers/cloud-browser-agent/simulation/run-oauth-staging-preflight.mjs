// Offline-only gate report. Intentionally cannot return deployment authorization.
// No fetch, secrets, account connections, DNS, Cloudflare calls, or file modifications
// outside its optional CI artifact directory.
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {
 buildProtectedResourcePlan,inspectAuthorizationServerMetadata,assessStagingReleaseGate
} from "./oauth-staging-readiness.mjs";
const resource="https://api1-staging.example.invalid";
const issuer="https://identity-staging.example.invalid";
const plan=buildProtectedResourcePlan({resource,issuer});
const provider={
 issuer,authorization_endpoint:issuer+"/authorize",token_endpoint:issuer+"/token",
 response_types_supported:["code"],code_challenge_methods_supported:["S256"],
 token_endpoint_auth_methods_supported:["none"],
 client_id_metadata_document_supported:true,
 scopes_supported:["browser:wikipedia.read"]
};
const syntheticMetadata=inspectAuthorizationServerMetadata(provider,plan);
const actualState=assessStagingReleaseGate({stagingOrigin:resource});
assert.equal(syntheticMetadata.passed,true);
assert.equal(actualState.configurationCompleteForReview,false);
assert.equal(actualState.readyForDeployment,false);
const report={
 status:"BLOCKED_PENDING_REAL_STAGING_AND_OAUTH_REVIEW",
 mode:"offline-only",publicEndpointCreated:false,clientRegistered:false,
 deploymentPerformed:false,productionTouched:false,
 syntheticMetadataValidated:true,protectedResourceTemplate:plan.metadata,
 authChallengeTemplate:plan.unauthenticatedChallenge,
 toolScope:"browser:wikipedia.read",
 outstandingRequirements:actualState.missing,
 explicitHumanApprovalRequired:true
};
const dir=process.env.API1_OAUTH_READINESS_DIR;
if(dir){
 if(!dir.startsWith("/tmp/"))throw Error("CI report directory must be under /tmp");
 await mkdir(dir,{recursive:true});
 await writeFile(dir+"/readiness.json",JSON.stringify(report,null,2));
}
console.log("API1_OAUTH_STAGING_PREFLIGHT",JSON.stringify({
 status:report.status,offlineOnly:true,remaining:report.outstandingRequirements.length
}));
