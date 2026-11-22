import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
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
