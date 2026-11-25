import {parseSiteGrants} from './omnipilot-site-grants.mjs';

// Pure operator-review helper. No networking, no credentials, no storage, and
// specifically NO permission to apply or authorize its own output.
const fail=(code)=>{throw Object.assign(new Error(code),{code})};
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)
  &&Object.getPrototypeOf(o)===Object.prototype
  &&Object.keys(o).sort().join(',')===keys.slice().sort().join(',');

export function previewAdditionalSiteGrant(currentRaw,request,nowMs=Date.now()){
  if(!Number.isSafeInteger(nowMs)||nowMs<0)
    fail('SITE_GRANT_REVIEW_INVALID');
  if(!exact(request,['origin','mode','pathPrefix','ttlMinutes','maxActions']))
    fail('SITE_GRANT_REVIEW_INVALID');
  if(!['read','draft'].includes(request.mode)
    ||!Number.isSafeInteger(request.ttlMinutes)
    ||request.ttlMinutes<1
    ||request.ttlMinutes>(request.mode==='read'?43200:1440))
    fail('SITE_GRANT_REVIEW_INVALID');
  if(request.mode==='read'&&request.maxActions!==0)
    fail('SITE_GRANT_REVIEW_INVALID');
  if(request.mode==='draft'&&(!Number.isSafeInteger(request.maxActions)
    ||request.maxActions<1||request.maxActions>3))
    fail('SITE_GRANT_REVIEW_INVALID');
  let prior;
  try{prior=JSON.parse(currentRaw)}catch{fail('SITE_GRANT_REVIEW_INVALID')}
  if(!exact(prior,['version','sites'])||!Array.isArray(prior.sites))
    fail('SITE_GRANT_REVIEW_INVALID');
  // Upgrading existing indefinite v1 grants needs a separate review;
  // do NOT silently convert them to a new policy.
  if(prior.version===1)fail('SITE_GRANT_MIGRATION_REVIEW_REQUIRED');
  if(prior.version!==2||prior.sites.length>15)
    fail('SITE_GRANT_REVIEW_INVALID');
  if(prior.sites.length){
    try{parseSiteGrants(currentRaw,nowMs)}catch{fail('SITE_GRANT_REVIEW_INVALID')}
  }
  const expiry=new Date(nowMs+request.ttlMinutes*60000).toISOString();
  const grant={
    origin:request.origin,mode:request.mode,pathPrefix:request.pathPrefix,
    expiresAt:expiry,maxActions:request.maxActions
  };
  const policy=JSON.stringify({version:2,sites:[...prior.sites,grant]});
  let entries;
  try{entries=parseSiteGrants(policy,nowMs)}
  catch{fail('SITE_GRANT_REVIEW_INVALID')}
  // The result is only a human-readable policy proposal: it is not a
  // signed approval, one-time credential, or authorization to deploy.
  return Object.freeze({
    applied:false,requiresOperatorReview:true,
    candidateOrigin:grant.origin,mode:grant.mode,pathPrefix:grant.pathPrefix,
    expiresAt:grant.expiresAt,maxActions:grant.maxActions,
    count:entries.length,
    proposedPolicyJson:policy
  });
}
