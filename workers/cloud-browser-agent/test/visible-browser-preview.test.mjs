import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {chromium} from "playwright";
import {captureOfflineBrowserPreview} from "../simulation/visible-browser-preview.mjs";
test("offline preview renders PNG with no network or website actions",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"api1-preview-"));
 try{
  const result=await captureOfflineBrowserPreview(chromium,dir);
  assert.equal(result.networkRequests,0);
  assert.equal(result.readOnly,true);
  assert.equal(result.embeddedBrowser,false);
  assert.equal(result.productionWritesAllowed,false);
  assert.equal(result.source,"DISPOSABLE_LOCAL_FIXTURE");
  const bytes=await readFile(result.path);
  assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.ok(bytes.length>1000);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test("invalid screenshot inputs fail closed",async()=>{
 await assert.rejects(captureOfflineBrowserPreview(null,"/tmp/preview"),/Chromium required/);
 await assert.rejects(captureOfflineBrowserPreview(chromium,"../relative"),/Absolute output directory required/);
});
