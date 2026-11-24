// Pure declarations only. All domains and identities here are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {assessManagedOAuthCompatibility} from '../simulation/access-managed-oauth-contract.mjs';

const origin='https://api1-gateway.example.test';
const oauthIssuer='https://api1-oauth.example.test';
const callback='https://client.example.test/callback';
const plan={resourceOrigin:origin,oauthIssuer,
  accessJwtIssuer:'https://synthetic-team.cloudflareaccess.com',
  appAudience:'synthetic-access-audience',
  protectedResourceMetadata:{resource:origin,authorization_servers:[oauthIssuer],
    bearer_methods_supported:['header']},
  authorizationServerMetadata:{issuer:oauthIssuer,
    authorization_endpoint:oauthIssuer+'/authorize',token_endpoint:oauthIssuer+'/token',
    response_types_supported:['code'],code_challenge_methods_supported:['S256'],
    client_id_metadata_document_supported:true},
  registrationMode:'cimd',callbackUri:callback,approvedCallbackUris:[callback],
  edge:{managedOAuthEnabled:true,singleIdentityAccessPolicy:true,
    protectWithAccess:true,directOriginBlocked:true,dedicatedIsolatedResources:true}};
const review=override=>assessManagedOAuthCompatibility({...plan,...override});
const hold=(o,reason)=>{const r=review(o);assert.equal(r.decision,'HOLD');assert.ok(r.missing.includes(reason));
  assert.equal(r.readyForDeployment,false);assert.equal(r.executionAuthorized,false);};

test('complete offline synthetic shape is reviewable, never deployable',()=>{
  const r=review();assert.equal(r.decision,'STRUCTURE_REVIEWABLE');
  assert.deepEqual(r.missing,[]);assert.equal(r.readyForDeployment,false);
  assert.equal(r.connectorRegistrationAuthorized,false);
  assert.equal(r.externalCompatibilityVerified,false);
});
test('invalid or production resource origin blocks review',()=>{
  hold({resourceOrigin:'https://trading-roi-studio.pages.dev'},'DEDICATED_RESOURCE_ORIGIN');
  hold({resourceOrigin:'http://api1.invalid'},'DEDICATED_RESOURCE_ORIGIN');
  hold({resourceOrigin:'https://api1.example.test/path'},'DEDICATED_RESOURCE_ORIGIN');
});
test('OAuth issuer and Access JWT issuer are independent requirements',()=>{
  hold({oauthIssuer:'http://unsafe.example.test'},'ISSUER_CONTRACT');
  hold({accessJwtIssuer:'https://wrong.example.test'},'ISSUER_CONTRACT');
  hold({appAudience:undefined},'ACCESS_APPLICATION_AUDIENCE');
});
test('protected resource metadata cannot refer to another app or issuer',()=>{
  hold({protectedResourceMetadata:{...plan.protectedResourceMetadata,
    authorization_servers:['https://other.example.test']}},'PROTECTED_RESOURCE_METADATA');
  hold({protectedResourceMetadata:{...plan.protectedResourceMetadata,
    resource:'https://finance.example.test'}},'PROTECTED_RESOURCE_METADATA');
});
test('PKCE S256 and authorization code flow required',()=>{
  hold({authorizationServerMetadata:{...plan.authorizationServerMetadata,
    code_challenge_methods_supported:['plain']}},'AUTHORIZATION_CODE_PKCE_METADATA');
  hold({authorizationServerMetadata:{...plan.authorizationServerMetadata,
    response_types_supported:['token']}},'AUTHORIZATION_CODE_PKCE_METADATA');
});
test('CIMD, DCR and predefined registration require explicit evidence',()=>{
  hold({authorizationServerMetadata:{...plan.authorizationServerMetadata,
    client_id_metadata_document_supported:false}},'CLIENT_REGISTRATION_CONTRACT');
  hold({registrationMode:'dcr'},'CLIENT_REGISTRATION_CONTRACT');
  assert.equal(review({registrationMode:'dcr',authorizationServerMetadata:{
    ...plan.authorizationServerMetadata,registration_endpoint:oauthIssuer+'/register'}}).decision,'STRUCTURE_REVIEWABLE');
  hold({registrationMode:'predefined'},'CLIENT_REGISTRATION_CONTRACT');
  assert.equal(review({registrationMode:'predefined',predefinedClientReviewed:true}).decision,'STRUCTURE_REVIEWABLE');
});
test('unapproved callback and incomplete edge protections remain HOLD',()=>{
  hold({callbackUri:'https://unapproved.example.test'},'EXACT_CALLBACK_REVIEW');
  hold({approvedCallbackUris:[]},'EXACT_CALLBACK_REVIEW');
  hold({edge:{...plan.edge,directOriginBlocked:false}},'EDGE_SECURITY_DECLARATIONS');
  hold({edge:{...plan.edge,protectWithAccess:false}},'EDGE_SECURITY_DECLARATIONS');
  hold({edge:{...plan.edge,singleIdentityAccessPolicy:false}},'EDGE_SECURITY_DECLARATIONS');
});
test('declarations do not falsely authorize runtime even if user supplies flags',()=>{
  const r=review({runtimeAuthorized:true,deployApproved:true,liveTestsPassed:true});
  assert.equal(r.readyForDeployment,false);assert.equal(r.executionAuthorized,false);
});
