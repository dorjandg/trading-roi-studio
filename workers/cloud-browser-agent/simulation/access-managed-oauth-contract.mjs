// API1 P1 — pure, offline Managed OAuth metadata/identity separation review.
// Inputs are untrusted synthetic declarations, not authoritative Cloudflare
// metadata, and NEVER establish deployment or connector authorization.
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x) &&
  (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
const text = (x, max = 512) => typeof x === 'string' && x.length > 0 && x.length <= max;
function https(value, originOnly = false) {
  if (!text(value, 1024)) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      !u.search && !u.hash && (originOnly ? value === u.origin : true);
  } catch { return false; }
}
const review = (missing) => Object.freeze({
  decision: missing.length ? 'HOLD' : 'STRUCTURE_REVIEWABLE',
  missing: Object.freeze([...new Set(missing)]),
  externalCompatibilityVerified: false, readyForDeployment: false,
  connectorRegistrationAuthorized: false, executionAuthorized: false,
  requiresIndependentReview: true
});
export function assessManagedOAuthCompatibility(input = {}) {
  const missing = [];
  try {
    if (!record(input)) return review(['INVALID_PLAN']);
    const {resourceOrigin, oauthIssuer, accessJwtIssuer, appAudience,
      protectedResourceMetadata: prm, authorizationServerMetadata: asm,
      registrationMode, callbackUri, approvedCallbackUris, edge} = input;
    const invalidOrigins = ['https://fin-kac.pages.dev','https://trading-roi-studio.pages.dev'];
    if (!https(resourceOrigin, true) || invalidOrigins.includes(resourceOrigin))
      missing.push('DEDICATED_RESOURCE_ORIGIN');
    if (!https(oauthIssuer) || !https(accessJwtIssuer, true) ||
      !accessJwtIssuer?.endsWith('.cloudflareaccess.com')) {
      // OAuth issuer and Access JWT issuer are independently checked fields;
      // never infer one from the other even if their values happen to match.
      missing.push('ISSUER_CONTRACT');
    }
    if (!text(appAudience, 256)) missing.push('ACCESS_APPLICATION_AUDIENCE');
    if (!record(prm) || prm.resource !== resourceOrigin ||
      !Array.isArray(prm.authorization_servers) ||
      prm.authorization_servers.length !== 1 ||
      prm.authorization_servers[0] !== oauthIssuer ||
      !Array.isArray(prm.bearer_methods_supported) ||
      !prm.bearer_methods_supported.includes('header'))
      missing.push('PROTECTED_RESOURCE_METADATA');
    if (!record(asm) || asm.issuer !== oauthIssuer ||
      !https(asm.authorization_endpoint) || !https(asm.token_endpoint) ||
      !Array.isArray(asm.response_types_supported) ||
      !asm.response_types_supported.includes('code') ||
      !Array.isArray(asm.code_challenge_methods_supported) ||
      !asm.code_challenge_methods_supported.includes('S256'))
      missing.push('AUTHORIZATION_CODE_PKCE_METADATA');
    if (!['cimd','dcr','predefined'].includes(registrationMode) || !record(asm)) {
      missing.push('CLIENT_REGISTRATION_CONTRACT');
    } else if (registrationMode === 'cimd' && asm.client_id_metadata_document_supported !== true) {
      missing.push('CLIENT_REGISTRATION_CONTRACT');
    } else if (registrationMode === 'dcr' && !https(asm.registration_endpoint)) {
      missing.push('CLIENT_REGISTRATION_CONTRACT');
    } else if (registrationMode === 'predefined' && input.predefinedClientReviewed !== true) {
      missing.push('CLIENT_REGISTRATION_CONTRACT');
    }
    if (!https(callbackUri) || !Array.isArray(approvedCallbackUris) ||
      approvedCallbackUris.length === 0 || approvedCallbackUris.length > 4 ||
      !approvedCallbackUris.every(u => https(u)) ||
      !approvedCallbackUris.includes(callbackUri)) missing.push('EXACT_CALLBACK_REVIEW');
    if (!record(edge) || edge.managedOAuthEnabled !== true ||
      edge.singleIdentityAccessPolicy !== true ||
      edge.protectWithAccess !== true ||
      edge.directOriginBlocked !== true ||
      edge.dedicatedIsolatedResources !== true)
      missing.push('EDGE_SECURITY_DECLARATIONS');
    // No custom Cloudflare OAuth scope is assumed. API1's
    // browser:wikipedia.read authorization belongs in the local MCP policy.
    return review(missing);
  } catch { return review(['INVALID_PLAN']); }
}
