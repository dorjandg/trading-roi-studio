import test from "node:test";
import assert from "node:assert/strict";
import {createLocalControllerAuth} from "../simulation/local-controller-auth.mjs";
test("read grant cannot control, control grant is short-lived and single use",()=>{
 let time=100000;
 const a=createLocalControllerAuth({secret:Buffer.alloc(32,4),now:()=>time});
 const read=a.issue({scope:"viewer:read",ttlMs:2000});
 const control=a.issue({scope:"viewer:control",ttlMs:2000});
 assert.equal(a.verify(read,"viewer:read"),true);
 assert.equal(a.verify(read,"viewer:control"),false);
 assert.equal(a.verify(control,"viewer:control",{consume:true}),true);
 assert.equal(a.verify(control,"viewer:control",{consume:true}),false);
 time+=2001;
 assert.equal(a.verify(read,"viewer:read"),false);
});
test("tampered, malformed, overlong and invalid scope tokens fail closed",()=>{
 const a=createLocalControllerAuth();
 const token=a.issue();
 assert.equal(a.verify(token+"x","viewer:read"),false);
 assert.equal(a.verify("bad","viewer:read"),false);
 assert.equal(a.verify("x".repeat(1025),"viewer:read"),false);
 assert.throws(()=>a.issue({scope:"admin"}),/Invalid scope/);
 assert.throws(()=>a.issue({ttlMs:900001}),/Invalid scope/);
 assert.throws(()=>createLocalControllerAuth({secret:Buffer.alloc(5)}),/32-byte/);
});
