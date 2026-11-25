// OmniPilot isolated OAuth-subject authorization model (NO live wiring).
// Trusted input is ctx.props.userId supplied by OAuthProvider after Google
// verification. NEVER pass identities from MCP args, HTTP headers or page DOM.
import {parseSiteGrants,planSiteControl} from '../../cloud-browser-agent/src/omnipilot-site-grants.mjs';

const fail=(code='SUBJECT_GRANT_DENIED')=>{throw Object.assign(new Error(code),{code})};
const plain=(v)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
  &&Object.getPrototypeOf(v)===Object.prototype;
const hashPattern=/^[a-f0-9]{64}$/;
const googleSubject=/^[A-Za-z0-9_-]{8,128}$/;
const fixedIssuer='https://accounts.google.com';
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
function validClock(nowMs){
  if(!Number.isSafeInteger(nowMs)||nowMs<0)fail();
  return nowMs;
}
function validKey(key){
  if(!key||key.algorithm?.name!=='HMAC'||!key.usages?.includes('sign'))fail();
  return key;
}
function parseV2(raw,nowMs){
  let policy;try{policy=JSON.parse(raw)}catch{fail()}
  if(!plain(policy)||policy.version!==2)fail('SITE_GRANT_V2_REQUIRED');
  try{return parseSiteGrants(raw,nowMs)}catch{fail()}
}
export function trustedGooglePrincipalFromOAuthProps(props){
  // Only the OAuthProvider apiHandler should call this with ctx.props;
  // possession of a JS object is NOT evidence that the OAuth token was verified.
  if(!plain(props)||!googleSubject.test(props.userId||''))fail('OAUTH_SUBJECT_UNVERIFIED');
  return Object.freeze({issuer:fixedIssuer,subject:props.userId});
}
export async function deriveSubjectKey(principal,hmacKey,subtle=crypto.subtle){
  if(!plain(principal)||principal.issuer!==fixedIssuer||
    !googleSubject.test(principal.subject||''))fail('OAUTH_SUBJECT_UNVERIFIED');
  validKey(hmacKey);
  const message='omnipilot:google-sub:v1\0'+principal.issuer+'\0'+principal.subject;
  try{
    return hex(await subtle.sign('HMAC',hmacKey,new TextEncoder().encode(message)));
  }catch{fail('SUBJECT_DERIVATION_FAILED')}
}
export function constrainSubjectGrant(candidate,operatorPolicy,nowMs=Date.now()){
  validClock(nowMs);
  if(!plain(candidate)||Object.keys(candidate).sort().join(',')!==
      'expiresAt,maxActions,mode,origin,pathPrefix')fail();
  const ceiling=parseV2(operatorPolicy,nowMs);
  let desired;try{
    desired=parseSiteGrants(JSON.stringify({version:2,sites:[candidate]}),nowMs)[0];
  }catch{fail()}
  const parent=ceiling.find(x=>x.origin===desired.origin);
  if(!parent||desired.mode==='draft'&&parent.mode!=='draft'||
    !desired.pathPrefix.startsWith(parent.pathPrefix)||
    desired.expiresAtMs>parent.expiresAtMs||
    desired.maxActions>parent.maxActions)fail('SUBJECT_GRANT_EXCEEDS_OPERATOR_POLICY');
  return Object.freeze({origin:desired.origin,mode:desired.mode,
    pathPrefix:desired.pathPrefix,expiresAtMs:desired.expiresAtMs,
    maxActions:desired.maxActions});
}
export function evaluateSubjectGrant({
  subjectKey,oauthScopes,request,operatorPolicy,record,nowMs=Date.now()
}){
  validClock(nowMs);
  if(!hashPattern.test(subjectKey||'')||
    !Array.isArray(oauthScopes)||oauthScopes.some(x=>typeof x!=='string')||
    !plain(record))fail();
  // A broad legacy v1 policy must never silently become per-subject permission.
  parseV2(operatorPolicy,nowMs);
  if(!plain(request)||!['read','draft'].includes(request.mode))fail();
  const required=request.mode==='read'?
    ['mcp:read','mcp:site.read']:
    ['mcp:read','mcp:site.read','mcp:site.interact'];
  if(required.some(x=>!oauthScopes.includes(x)))fail('OAUTH_SCOPE_INSUFFICIENT');
  let planned;try{planned=planSiteControl(request,operatorPolicy,nowMs)}catch{fail()}
  if(record.status!=='ACTIVE'||record.subjectKey!==subjectKey||
    typeof record.grantId!=='string'||!/^([0-9a-f]{8}-){1}[0-9a-f-]{27}$/.test(record.grantId)||
    !Number.isSafeInteger(record.revision)||record.revision<2||
    !hashPattern.test(record.auditHead||'')||
    record.origin!==planned.origin||
    !['read','draft'].includes(record.mode)||
    request.mode==='draft'&&record.mode!=='draft'||
    typeof record.pathPrefix!=='string'||!planned.url.startsWith(record.origin+record.pathPrefix)||
    !Number.isSafeInteger(record.expiresAtMs)||record.expiresAtMs<=nowMs||
    !Number.isSafeInteger(record.maxActions)||record.maxActions<0||
    planned.actions.length>record.maxActions)fail();
  // Both the user grant and the operator's currently active policy apply.
  const ceiling=constrainSubjectGrant({
    origin:record.origin,mode:record.mode,pathPrefix:record.pathPrefix,
    expiresAt:new Date(record.expiresAtMs).toISOString(),
    maxActions:record.maxActions
  },operatorPolicy,nowMs);
  if(planned.actions.length>ceiling.maxActions||
    !planned.url.startsWith(ceiling.origin+ceiling.pathPrefix))fail();
  return Object.freeze({allowed:true,grantId:record.grantId,
    grantRevision:record.revision,mode:request.mode,origin:planned.origin,
    url:planned.url,actionCount:planned.actions.length,expiresAtMs:record.expiresAtMs,
    approvalState:'ACTIVE',persisted:false});
}
// The loader must read authoritative storage for EACH dispatch, not a cached
// snapshot. Revocation of an already executing browser action still requires
// a separate session cancellation barrier before promising instant abort.
export async function evaluateFreshSubjectGrant({
  subjectKey,oauthScopes,request,operatorPolicy,loadLatest,nowMs=Date.now()
}){
  if(typeof loadLatest!=='function'||!hashPattern.test(subjectKey||''))fail();
  let planned;
  try{planned=planSiteControl(request,operatorPolicy,nowMs)}catch{fail()}
  let record;try{
    record=await loadLatest(Object.freeze({subjectKey,origin:planned.origin}));
  }catch{fail('SUBJECT_GRANT_STORAGE_UNAVAILABLE')}
  if(record===null||record===undefined)fail();
  return evaluateSubjectGrant({subjectKey,oauthScopes,request,operatorPolicy,record,nowMs});
}
