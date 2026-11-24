import test from "node:test";
import assert from "node:assert/strict";
import {buildGoogleLoginUrl,pkceChallenge,verifyGoogleIdentity} from "../src/google-login.mjs";
import {renderConsent} from "../src/consent.mjs";
test("Google sign-in does not leak plain PKCE verifier",async()=>{
 const verifier="a-long-secret-pkce-verifier-value-which-should-not-leak";
 const url=buildGoogleLoginUrl({clientId:"client",redirectUri:"https://gateway.example/callback",state:"state",verifier,nonce:"nonce"});
 url.searchParams.set("code_challenge",await pkceChallenge(verifier));
 assert.equal(url.origin,"https://accounts.google.com");
 assert.equal(url.searchParams.get("code_challenge_method"),"S256");
 assert.ok(!url.href.includes(verifier));
 assert.equal(url.searchParams.get("nonce"),"nonce");
});
test("Google account must be verified, nonce-bound and allowlisted",async()=>{
 const idToken="opaque";
 const allowed={sub:"google-sub",email:"admin@example.com",email_verified:true,nonce:"expected"};
 const verify=async()=>({payload:allowed});
 const ok=await verifyGoogleIdentity({idToken,clientId:"client",nonce:"expected",allowedEmail:"ADMIN@example.com",verify});
 assert.equal(ok.userId,"google-sub");
 assert.equal(await verifyGoogleIdentity({idToken,clientId:"client",nonce:"wrong",allowedEmail:"admin@example.com",verify}),null);
 assert.equal(await verifyGoogleIdentity({idToken,clientId:"client",nonce:"expected",allowedEmail:"other@example.com",verify}),null);
 assert.equal(await verifyGoogleIdentity({idToken,clientId:"client",nonce:"expected",allowedEmail:"admin@example.com",verify:async()=>({payload:{...allowed,email_verified:false}})}),null);
});
test("OAuth consent escapes client-controlled HTML and shows redirect hostname",()=>{
 const page=renderConsent({clientName:'<script>alert("x")</script>',clientDomain:'<img onerror=alert(1)>',redirectHost:"chatgpt.com",redirectIsLoopback:false,scope:["mcp:read"]},"handle");
 assert.ok(!page.includes("<script>"));
 assert.ok(!page.includes("<img onerror="));
 assert.ok(page.includes("chatgpt.com"));
 assert.ok(page.includes("mcp:read"));
 assert.ok(page.includes('name="decision" value="deny"'));
});
