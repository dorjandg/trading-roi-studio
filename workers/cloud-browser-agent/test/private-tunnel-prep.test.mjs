import test from "node:test";
import assert from "node:assert/strict";
import {access,readFile,stat} from "node:fs/promises";
import {createPrivateTunnelPrep} from "../simulation/private-tunnel-prep.mjs";
const rpc=(method,params,id=1)=>({jsonrpc:"2.0",id,method,...(params===undefined?{}:{params})});
const fakeBrowser={launch(){throw Error("NO_CHROMIUM_MUST_START_FOR_DISCOVERY");}};
test("private tunnel prep creates localhost-only MCP, 0600 private header and redacted manifest; cleanup removes both",async()=>{
 const prep=await createPrivateTunnelPrep(fakeBrowser,{timeoutMs:2000});
 const {mcpUrl,headerFile}=prep.info;
 try{
  assert.match(mcpUrl,/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
  assert.equal(prep.info.oauthImplemented,false);
  assert.equal(prep.info.tunnelCreated,false);
  assert.equal(prep.info.chatgptConnected,false);
  assert.equal(prep.info.deployed,false);
  assert.equal(prep.info.productionWritesAllowed,false);
  assert.equal(await prep.verifyPrivateHeaderFile(),true);
  const file=await stat(headerFile);
  assert.equal(file.mode&0o777,0o600);
  const token=await readFile(headerFile,"utf8");
  assert.match(token,/^Bearer [a-zA-Z0-9_-]{40,}$/);
  const manifest=await readFile(prep.infoFile,"utf8");
  assert.equal(manifest.includes(token),false);
  assert.ok(manifest.includes("browser_automate_wikipedia_demo"));
  assert.ok(!Object.values(prep.info).includes(token));
  const response=await fetch(mcpUrl,{method:"POST",headers:{"content-type":"application/json",authorization:token},
   body:JSON.stringify(rpc("initialize",{protocolVersion:"2025-06-18"}))});
  assert.equal(response.status,200);
  assert.equal((await response.json()).result.protocolVersion,"2025-06-18");
  const list=await(await fetch(mcpUrl,{method:"POST",headers:{"content-type":"application/json",authorization:token},
   body:JSON.stringify(rpc("tools/list",{}))})).json();
  assert.deepEqual(list.result.tools.map(t=>t.name),["browser_automate_wikipedia_demo"]);
  const missing=await fetch(mcpUrl,{method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify(rpc("tools/list",{}))});
  assert.equal(missing.status,401);
  const wrong=await fetch(mcpUrl,{method:"POST",headers:{"content-type":"application/json",
   authorization:"Bearer wrong"},body:JSON.stringify(rpc("tools/list",{}))});
  assert.equal(wrong.status,401);
 }finally{await prep.close();}
 await assert.rejects(access(headerFile),/ENOENT/);
 await assert.rejects(access(prep.infoFile),/ENOENT/);
});
