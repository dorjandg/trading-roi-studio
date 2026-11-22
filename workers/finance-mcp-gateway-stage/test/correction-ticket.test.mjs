// Run with Node 22. Tests actual ticket helpers extracted from the Pages Function.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";
const source=readFileSync("functions/api/finance.js","utf8");
const start=source.indexOf("async function correctionTicket(");
const end=source.indexOf("async function handler(ctx){",start);
assert.ok(start>0&&end>start,"ticket helpers found");
const ctx=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,atob,btoa,Date,JSON});
vm.runInContext("const enc=new TextEncoder(); const b64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));"+source.slice(start,end)+";globalThis.issue=correctionTicket;globalThis.verify=verifyCorrectionTicket;",ctx);
const secret="test-only-32-byte-secret-not-production";
const claims={ws:"workspace",user_id:"owner",transaction_id:"9d1216ae-992c-4eed-8ee2-9efc28e19fe3",field:"category",expected_revision:19,expected_value:"Prop firm",new_value:"Trading expenses",exp:Date.now()+120000};
const ticket=await ctx.issue(secret,claims);
assert.match(ticket,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
const expected={...claims};delete expected.exp;
assert.equal(await ctx.verify(secret,ticket,expected),true,"valid ticket");
for(const [key,value] of [["ws","other-workspace"],["user_id","other-user"],["transaction_id","another"],["field","provider"],["expected_revision",20],["expected_value","changed"],["new_value","malicious"]]){
 assert.equal(await ctx.verify(secret,ticket,{...expected,[key]:value}),false,"reject "+key);
}
const [payload,signature]=ticket.split(".");
const altered=payload.slice(0,-1)+(payload.at(-1)==="A"?"B":"A")+"."+signature;
assert.equal(await ctx.verify(secret,altered,expected),false,"reject altered payload");
assert.equal(await ctx.verify(secret,ticket.slice(0,-1)+(ticket.at(-1)==="A"?"B":"A"),expected),false,"reject altered signature");
assert.equal(await ctx.verify("different-signing-key-with-32-characters",ticket,expected),false,"reject wrong key");
assert.equal(await ctx.verify(secret,await ctx.issue(secret,{...claims,exp:Date.now()-1000}),expected),false,"reject expired ticket");
assert.equal(await ctx.verify(secret,await ctx.issue(secret,{...claims,exp:Date.now()+3600000}),expected),false,"reject unreasonably long lifetime");
assert.equal(await ctx.verify(secret,"malformed",expected),false,"reject malformed");
console.log("Signed correction ticket runtime tests passed.");
