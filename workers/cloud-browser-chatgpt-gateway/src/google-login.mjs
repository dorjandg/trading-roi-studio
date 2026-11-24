import { createRemoteJWKSet, jwtVerify } from "jose";

export const GOOGLE_ISSUERS=["https://accounts.google.com","accounts.google.com"];
const GOOGLE_JWKS=createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function buildGoogleLoginUrl({clientId,redirectUri,state,verifier,nonce}){
  if(!clientId||!redirectUri||!state||!verifier||!nonce)throw Error("Google sign-in not configured");
  const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id",clientId);
  url.searchParams.set("redirect_uri",redirectUri);
  url.searchParams.set("response_type","code");
  url.searchParams.set("scope","openid email");
  url.searchParams.set("state",state);
  url.searchParams.set("nonce",nonce);
  url.searchParams.set("access_type","online");
  url.searchParams.set("prompt","select_account");
  url.searchParams.set("code_challenge_method","S256");
  // S256 is computed by the caller; do not transmit a plain verifier.
  return url;
}

export async function pkceChallenge(verifier){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
export async function exchangeGoogleCode({code,verifier,clientId,clientSecret,redirectUri,fetcher=fetch}){
  if(!code||!verifier||!clientId||!clientSecret)return null;
  const body=new URLSearchParams({code,code_verifier:verifier,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:"authorization_code"});
  const response=await fetcher("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  if(!response.ok)return null;
  const token=await response.json();
  return typeof token?.id_token==="string"?token.id_token:null;
}
export async function verifyGoogleIdentity({idToken,clientId,nonce,allowedEmail,verify=jwtVerify}){
  if(!idToken||!clientId||!nonce||!allowedEmail)return null;
  const {payload}=await verify(idToken,GOOGLE_JWKS,{issuer:GOOGLE_ISSUERS,audience:clientId,clockTolerance:30});
  if(payload.nonce!==nonce||payload.email_verified!==true||typeof payload.email!=="string"||!payload.sub)return null;
  if(payload.email.toLowerCase()!==allowedEmail.toLowerCase().trim())return null;
  return {userId:String(payload.sub),email:payload.email};
}
