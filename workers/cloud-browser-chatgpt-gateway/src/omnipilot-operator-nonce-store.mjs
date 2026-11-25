// Isolated D1 one-time Google operator authorization nonce storage contract.
// NOT imported by live Workers. D1 binding must be a NEW OmniPilot-only DB.
// Store HMAC digests, never nonce plaintext, OIDC tokens or Google identities.
const fail=code=>{throw Object.assign(new Error(code),{code})};
const HEX=/^[a-f0-9]{64}$/;
const NONCE=/^[A-Za-z0-9_-]{40,90}$/;
const MINUTE=60000;
const b64url=bytes=>btoa(String.fromCharCode(...bytes))
  .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const validClock=x=>Number.isSafeInteger(x)&&x>0;
const keyValid=k=>k?.algorithm?.name==='HMAC'&&k.usages?.includes('sign');
const dbValid=db=>typeof db?.prepare==='function';
async function digest(nonce,hmacKey){
  if(!keyValid(hmacKey))fail('NONCE_KEY_UNAVAILABLE');
  try{
    return hex(await crypto.subtle.sign('HMAC',hmacKey,
      new TextEncoder().encode('omnipilot:operator-nonce:v1\0'+nonce)));
  }catch{fail('NONCE_KEY_UNAVAILABLE')}
}
function checkIdentity(operatorKey,sessionKey){
  if(!HEX.test(operatorKey||'')||!HEX.test(sessionKey||''))
    fail('NONCE_IDENTITY_UNVERIFIED');
}
const insertSql='INSERT INTO omnipilot_operator_nonces (nonce_digest,operator_key,session_key,issued_at_ms,expires_at_ms,status) VALUES (?,?,?,?,?,?)';
const consumeSql="UPDATE omnipilot_operator_nonces SET status='USED',consumed_at_ms=? WHERE nonce_digest=? AND operator_key=? AND session_key=? AND status='ISSUED' AND issued_at_ms<=? AND expires_at_ms>? RETURNING nonce_digest";
export async function issueOperatorNonce({
  db,hmacKey,operatorKey,sessionKey,nowMs=Date.now(),
  nonceFactory=()=>b64url(crypto.getRandomValues(new Uint8Array(32)))
}){
  if(!dbValid(db)||!validClock(nowMs)||typeof nonceFactory!=='function')
    fail('NONCE_STORE_UNAVAILABLE');
  checkIdentity(operatorKey,sessionKey);
  const nonce=nonceFactory();
  if(typeof nonce!=='string'||!NONCE.test(nonce))fail('NONCE_FORMAT_INVALID');
  const nonceDigest=await digest(nonce,hmacKey);
  const expiresAtMs=nowMs+5*MINUTE;
  if(!Number.isSafeInteger(expiresAtMs))fail('NONCE_STORE_UNAVAILABLE');
  try{
    const saved=await db.prepare(insertSql).bind(nonceDigest,operatorKey,sessionKey,
      nowMs,expiresAtMs,'ISSUED').run();
    if(saved?.success!==true)fail('NONCE_ISSUE_UNCERTAIN_NO_RETRY');
  }catch{
    // Unknown commit outcome: do not auto-retry or return an unverified token.
    fail('NONCE_ISSUE_UNCERTAIN_NO_RETRY');
  }
  return Object.freeze({nonce,expiresAtMs,storedAsDigest:true,
    status:'ISSUED',retrySafe:false});
}
export async function consumeOperatorNonce({
  db,hmacKey,nonce,operatorKey,sessionKey,nowMs=Date.now()
}){
  if(!dbValid(db)||!validClock(nowMs)||!NONCE.test(nonce||''))
    fail('NONCE_STORE_UNAVAILABLE');
  checkIdentity(operatorKey,sessionKey);
  const nonceDigest=await digest(nonce,hmacKey);
  let row;
  try{
    row=await db.prepare(consumeSql).bind(nowMs,nonceDigest,
      operatorKey,sessionKey,nowMs,nowMs).first();
  }catch{fail('NONCE_CONSUMPTION_UNCERTAIN_NO_RETRY')}
  // UPDATE ... RETURNING is atomic; no stale cached nonce lookup.
  return row?.nonce_digest===nonceDigest;
}
