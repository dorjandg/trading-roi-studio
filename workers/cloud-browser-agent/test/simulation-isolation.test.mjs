import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
const workerRoot=fileURLToPath(new URL("../",import.meta.url));
const source=["src/index.js","src/handler.mjs","src/mcp.mjs","src/audit-store.mjs","src/edit-preview.mjs"];
test("isolated edit simulation is never imported or exposed by deployed worker",()=>{
 for(const path of source){
  const text=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.doesNotMatch(text,/simulation\/isolated-edit-lab|IsolatedEditLab/);
 }
 const mcp=readFileSync(new URL("../src/mcp.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(mcp,/name:"browser_(click|fill|submit|upload|execute|approve|rollback)"/);
 const index=readFileSync(new URL("../src/index.js",import.meta.url),"utf8");
 assert.doesNotMatch(index,/write[-_]enabled|isolated-edit-lab/);
});

test("durable write prototype never reaches staging MCP gateway or deployed agent",()=>{
 const sources=["src/index.js","src/handler.mjs","src/mcp.mjs"];
 for(const path of sources){
  const body=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.doesNotMatch(body,/PersistentWritePrototype|persistent-write-prototype|sealed-identity-gateway|access-jwt-verifier|access-authenticated-fixture|makeAuthenticatedFixtureController|createAccessAuthenticatedFixture|node:sqlite/);
  assert.equal(body.includes("simulation/"),false);
 }
 const deployed=readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");
 assert.doesNotMatch(deployed,/WRITE_ENABLED|write_service|persistent-write-prototype/);
});

test("Stage 4.9 scaffold has no Wrangler deploy config or active website write API",{skip:!existsSync(new URL("../../cloud-browser-write-stage/src/index.mjs",import.meta.url))},()=>{
 const root=new URL("../../cloud-browser-write-stage/",import.meta.url);
 for(const path of ["wrangler.jsonc","wrangler.toml","wrangler.json"]){
  assert.equal(existsSync(new URL(path,root)),false);
 }
 const code=readFileSync(new URL("src/index.mjs",root),"utf8");
 assert.doesNotMatch(code,/await\\s+(?:page\\.)?(?:fill|click|submit)|browser\\.newPage/);
 assert.equal(code.includes("WRITE_SERVICE_BOOTSTRAP_ENABLED"),true);
 assert.equal(code.includes('"/authorization-check"'),true);
 for(const name of ["/execute","/approve","/upload","/rollback"]){
  assert.equal(code.includes('url.pathname==="'+name+'"'),false);
 }
});
