import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {generateKeyPair,SignJWT} from 'jose';
import {deriveSubjectKey} from '../src/omnipilot-subject-authority.mjs';
import {verifyIndependentOperator} from '../src/omnipilot-operator-proof.mjs';

const NOW=1764000000000;
const ISSUER='https://accounts.google.com';
const CLIENT='synthetic-operator-client-123456.apps.googleusercontent.com';
const OPERATOR='google-operator-1234567890';
const REQUESTER='google-requester-2345678901';
const STRANGER='google-unknown-9876543210';
const NONCE='test-nonce-synthetic-123456789012345';
let pair,key,config,requesterKey;
const used=new Set();
const consumeNonce=async nonce=>!used.has(nonce)&&(used.add(nonce),true);
async function setup(){
  if(pair)return;
  pair=await generateKeyPair('RS256',{modulusLength:2048});
  key=await webcrypto.subtle.importKey('raw',new Uint8Array(32).fill(71),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  requesterKey=await deriveSubjectKey({issuer:ISSUER,subject:REQUESTER},key);
  const operatorKey=await deriveSubjectKey({issuer:ISSUER,subject:OPERATOR},key);
  config={googleClientId:CLIENT,googleJwks:pair.publicKey,
    subjectHmacKey:key,operatorKeys:[operatorKey]};
}
async function token(opts={}){
  await setup();
  const {subject=OPERATOR,nonce=NONCE,issuer=ISSUER,audience=CLIENT,
    iat=Math.floor(NOW/1000)-15,exp=Math.floor(NOW/1000)+600,
    emailVerified=true,signingKey=pair.privateKey}=opts;
  return new SignJWT({nonce,email_verified:emailVerified})
    .setProtectedHeader({alg:'RS256'}).setIssuer(issuer)
    .setSubject(subject).setAudience(audience).setIssuedAt(iat)
    .setExpirationTime(exp).sign(signingKey);
}
const args=(idToken,more={})=>({idToken,expectedNonce:NONCE,
  requesterSubjectKey:requesterKey,configuration:config,
  consumeNonce,nowMs:NOW,...more});
const denied=async(task,code)=>assert.rejects(task,code?{code}:e=>typeof e?.code==='string');

test('independent signed Google operator can approve only after one-time nonce',async()=>{
  await setup();used.clear();
  const t=await token();
  const result=await verifyIndependentOperator(args(t));
  assert.equal(result.verified,true);
  assert.equal(result.separateFromRequester,true);
  assert.equal(result.issuer,ISSUER);
  assert.equal(result.operatorKey,config.operatorKeys[0]);
  assert.equal(result.proofExpiresAtMs,NOW+600000);
  assert.equal(JSON.stringify(result).includes(OPERATOR),false);
  assert.equal(Object.isFrozen(result),true);
  await denied(verifyIndependentOperator(args(t)),'OPERATOR_NONCE_REJECTED');
});

test('self approval refused even if same subject is on the trusted operator allowlist',async()=>{
  await setup();used.clear();
  const t=await token({subject:REQUESTER});
  const otherConfig={...config,operatorKeys:[requesterKey]};
  await denied(verifyIndependentOperator(args(t,{configuration:otherConfig})),
    'OPERATOR_SELF_APPROVAL_DENIED');
  assert.equal(used.size,0);
});

test('Google JWT issuer, audience, signature, nonce and email verification are mandatory',async()=>{
  await setup();used.clear();
  const invalid=[
    [{issuer:'https://imposter.example.org'},'OPERATOR_GOOGLE_SIGNATURE_INVALID'],
    [{audience:'wrong-oauth-client-987654'},'OPERATOR_GOOGLE_SIGNATURE_INVALID'],
    [{nonce:'wrong-nonce-synthetic-123456789'},'OPERATOR_CLAIMS_REJECTED'],
    [{emailVerified:false},'OPERATOR_CLAIMS_REJECTED'],
    [{iat:Math.floor(NOW/1000)-1000},'OPERATOR_CLAIMS_REJECTED'],
    [{iat:Math.floor(NOW/1000)+1000},'OPERATOR_CLAIMS_REJECTED'],
    [{exp:Math.floor(NOW/1000)+7200},'OPERATOR_CLAIMS_REJECTED'],
    [{exp:Math.floor(NOW/1000)-10},'OPERATOR_GOOGLE_SIGNATURE_INVALID'],
    [{subject:STRANGER},'OPERATOR_NOT_ALLOWLISTED']
  ];
  for(const [opts,code] of invalid){
    const t=await token(opts);
    await denied(verifyIndependentOperator(args(t)),code);
  }
  const forged=await generateKeyPair('RS256',{modulusLength:2048});
  const fake=await token({signingKey:forged.privateKey});
  await denied(verifyIndependentOperator(args(fake)),
    'OPERATOR_GOOGLE_SIGNATURE_INVALID');
  assert.equal(used.size,0);
});

test('untrusted configuration, missing HMAC key and nonce storage failure deny',async()=>{
  await setup();used.clear();
  const t=await token();
  await denied(verifyIndependentOperator(args(t,{configuration:{...config,operatorKeys:[]}})),
    'OPERATOR_PROOF_UNCONFIGURED');
  await denied(verifyIndependentOperator(args(t,{configuration:{...config,googleJwks:null}})),
    'OPERATOR_PROOF_UNCONFIGURED');
  await denied(verifyIndependentOperator(args(t,{configuration:{...config,subjectHmacKey:null}})),
    'OPERATOR_PROOF_UNCONFIGURED');
  await denied(verifyIndependentOperator(args(t,{consumeNonce:async()=>false})),
    'OPERATOR_NONCE_REJECTED');
  await denied(verifyIndependentOperator(args(t,{consumeNonce:async()=>{throw Error('storage failure');}})),
    'OPERATOR_NONCE_REJECTED');
  await denied(verifyIndependentOperator(args(t,{expectedNonce:'bad'})),
    'OPERATOR_PROOF_UNCONFIGURED');
  await denied(verifyIndependentOperator(args(t,{requesterSubjectKey:'requester-id'})),
    'OPERATOR_PROOF_UNCONFIGURED');
});

test('nonce cannot be replayed across sessions and signed operator cannot escalate scope',async()=>{
  await setup();used.clear();
  const t=await token();
  const alternate=await token();
  const [a,b]=await Promise.allSettled([
    verifyIndependentOperator(args(t)),
    verifyIndependentOperator(args(alternate))
  ]);
  assert.equal([a,b].filter(x=>x.status==='fulfilled').length,1);
  const fail=[a,b].find(x=>x.status==='rejected');
  assert.equal(fail.reason.code,'OPERATOR_NONCE_REJECTED');
});
