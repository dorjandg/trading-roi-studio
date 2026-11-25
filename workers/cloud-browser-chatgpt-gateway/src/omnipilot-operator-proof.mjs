// Isolated operator identity proof. NOT wired into a live OAuth or MCP route.
// The integration must pass a PINNED Google JWK verifier / audience and a
// SERVER-OWNED allowlist of HMAC-derived operator subjects; never accept
// keys, roles, audience, nonce or allowlists from tool args, URLs or headers.
import {jwtVerify} from 'jose';
import {deriveSubjectKey} from './omnipilot-subject-authority.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code})};
const HASH=/^[a-f0-9]{64}$/;
const SUB=/^[A-Za-z0-9_-]{8,128}$/;
const ISSUERS=['https://accounts.google.com','accounts.google.com'];
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
  &&Object.getPrototypeOf(x)===Object.prototype;
const keyIsTrusted=k=>k&&((typeof k==='function')||
  (typeof k==='object'&&typeof k.type==='string'));
export async function verifyIndependentOperator({
  idToken,expectedNonce,requesterSubjectKey,configuration,
  consumeNonce,nowMs=Date.now(),verify=jwtVerify
}){
  if(typeof idToken!=='string'||idToken.length<40||idToken.length>8192||
    !/^[A-Za-z0-9_.-]+$/.test(idToken)||
    typeof expectedNonce!=='string'||expectedNonce.length<24||
    expectedNonce.length>256||!/^[A-Za-z0-9_-]+$/.test(expectedNonce)||
    !HASH.test(requesterSubjectKey||'')||!Number.isSafeInteger(nowMs)||
    nowMs<0||typeof consumeNonce!=='function'||
    !plain(configuration)||!configuration.googleClientId||
    typeof configuration.googleClientId!=='string'||
    !/^[A-Za-z0-9._-]{16,256}$/.test(configuration.googleClientId)||
    !keyIsTrusted(configuration.googleJwks)||
    !configuration.subjectHmacKey||!Array.isArray(configuration.operatorKeys)||
    configuration.operatorKeys.length<1||configuration.operatorKeys.length>8||
    configuration.operatorKeys.some(v=>!HASH.test(v))||
    typeof verify!=='function')fail('OPERATOR_PROOF_UNCONFIGURED');

  let payload;
  try{
    ({payload}=await verify(idToken,configuration.googleJwks,{
      issuer:ISSUERS,audience:configuration.googleClientId,
      algorithms:['RS256'],clockTolerance:0,
      currentDate:new Date(nowMs)
    }));
  }catch{fail('OPERATOR_GOOGLE_SIGNATURE_INVALID')}
  if(!plain(payload)||!SUB.test(payload.sub||'')||
    payload.nonce!==expectedNonce||
    payload.email_verified!==true||
    !Number.isSafeInteger(payload.iat)||!Number.isSafeInteger(payload.exp)||
    payload.iat*1000>nowMs+30000||
    payload.iat*1000<nowMs-300000||
    payload.exp*1000<=nowMs||payload.exp*1000>nowMs+3600000)
    fail('OPERATOR_CLAIMS_REJECTED');

  // The Google subject is hashed using the same canonical issuer namespace
  // as the requester, so the same human account cannot approve its own grant.
  let key;
  try{
    key=await deriveSubjectKey({
      issuer:'https://accounts.google.com',subject:payload.sub
    },configuration.subjectHmacKey);
  }catch{fail('OPERATOR_SUBJECT_KEY_UNAVAILABLE')}
  if(key===requesterSubjectKey)fail('OPERATOR_SELF_APPROVAL_DENIED');
  if(!configuration.operatorKeys.includes(key))
    fail('OPERATOR_NOT_ALLOWLISTED');

  // A server-owned one-shot nonce store prevents replay; a storage outage
  // denies the attempt instead of allowing a second approval.
  let consumed=false;
  try{consumed=await consumeNonce(expectedNonce,key,nowMs)}catch{}
  if(consumed!==true)fail('OPERATOR_NONCE_REJECTED');
  return Object.freeze({verified:true,operatorKey:key,
    issuer:'https://accounts.google.com',separateFromRequester:true,
    proofExpiresAtMs:payload.exp*1000,source:'google-signed-id-token'});
}
