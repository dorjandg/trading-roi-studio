import test from "node:test";
import assert from "node:assert/strict";
import {readFile,stat} from "node:fs/promises";
import {createPrivateTunnelPrep} from "../simulation/private-tunnel-prep.mjs";
import {planPrivateTunnelProfile,savePrivateTunnelProfile} from "../simulation/private-tunnel-profile.mjs";

const FAKE_ID="tunnel_0123456789abcdef0123456789abcdef";
const browser={launch(){throw Error("No browser should launch during private setup");}};
test("approved tunnel profile is secret-free, private and cannot start anything",{timeout:15000},async()=>{
 const prep=await createPrivateTunnelPrep(browser,{timeoutMs:2000});
 try{
  const candidate=planPrivateTunnelProfile(prep.info,{tunnelId:FAKE_ID});
  assert.equal(candidate.requiresPrivateRuntimeKey,true);
  assert.equal(candidate.chatgptPluginCreated,false);
  assert.equal(candidate.tunnelStarted,false);
  assert.match(candidate.yaml,/^config_version: 1/m);
  assert.match(candidate.yaml,/tunnel_0123456789abcdef0123456789abcdef/);
  assert.match(candidate.yaml,/api_key: "env:CONTROL_PLANE_API_KEY"/);
  assert.match(candidate.yaml,/oauth_discovery: disabled/);
  assert.match(candidate.yaml,/max_concurrent_requests: 1/);
  assert.match(candidate.yaml,/Authorization: "file:/);
  assert.ok(candidate.yaml.includes(prep.info.mcpUrl));
  const secret=await readFile(prep.info.headerFile,"utf8");
  assert.equal(candidate.yaml.includes(secret),false);
  const saved=await savePrivateTunnelProfile(prep.info,{tunnelId:FAKE_ID});
  assert.equal(saved.tunnelStarted,false);
  assert.equal(saved.chatgptPluginCreated,false);
  assert.equal(saved.usesProtectedHeaderFile,true);
  const info=await stat(saved.profilePath);
  assert.equal(info.mode&0o777,0o600);
  const yaml=await readFile(saved.profilePath,"utf8");
  assert.equal(yaml,candidate.yaml);
  assert.equal(yaml.includes(secret),false);
  await assert.rejects(savePrivateTunnelProfile(prep.info,{tunnelId:FAKE_ID}),/EEXIST/);
 }finally{await prep.close();}
});
test("profile creation refuses absent/invalid tunnel ID, public HTTP targets and deployment markers",()=>{
 const info={mcpUrl:"http://127.0.0.1:4182/mcp",
  headerFile:"/tmp/api1-private-mcp-example/authorization.header",
  deployed:false,tunnelCreated:false,productionWritesAllowed:false};
 assert.throws(()=>planPrivateTunnelProfile(info),/Approved tunnel ID required/);
 for(const id of ["", "tunnel_placeholder","https://evil.example","tunnel_a\nfoo: bar", "tunnel_abc"]){
  assert.throws(()=>planPrivateTunnelProfile(info,{tunnelId:id}),/Approved tunnel ID required/);
 }
 for(const mcpUrl of ["http://0.0.0.0:4182/mcp","https://evil.example/mcp",
  "http://127.0.0.1:4182/mcp?token=abc","http://localhost:4182/mcp",
  "http://127.0.0.1:4182/"]){
  assert.throws(()=>planPrivateTunnelProfile({...info,mcpUrl},{tunnelId:FAKE_ID}),/Isolated MCP target required/);
 }
 assert.throws(()=>planPrivateTunnelProfile({...info,deployed:true},{tunnelId:FAKE_ID}),/Isolated MCP target required/);
});
