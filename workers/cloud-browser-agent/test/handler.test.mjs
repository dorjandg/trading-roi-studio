import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/handler.mjs";

const env={AGENT_API_TOKEN:"test-only-secret",ALLOWED_ORIGINS:"https://fin-kac.pages.dev",BROWSER:{}};
function req(path, body, token="test-only-secret", method=body===undefined?"GET":"POST") {
  const headers={authorization:"Bearer "+token};
  if(body!==undefined) headers["content-type"]="application/json";
  return new Request("https://cloud-browser-agent-stage.example"+path,{
    method,headers,body:body===undefined?undefined:typeof body==="string"?body:JSON.stringify(body)
  });
}
function browserMock() {
  const state={closed:false,navigated:null};
  const page={
    on(){},
    goto:async url=>{state.navigated=url;return {status:()=>200};},
    url:()=>state.navigated,
    title:async()=>"Home",
    locator:selector=>selector==="h1, h2"?
      {allTextContents:async()=>["  Welcome  "]}:{count:async()=>3},
    screenshot:async()=>new Uint8Array([137,80,78,71])
  };
  const context={
    newPage:async()=>page,
    on(){},
    route:async()=>{},
    close:async()=>{state.closed=true;}
  };
  const browser={newContext:async()=>context,close:async()=>{state.browserClosed=true;}};
  return {state, launch:async()=>browser};
}
test("requires authentication before health or browser use",async()=>{
  let launches=0;
  const handler=createHandler(async()=>{launches++;throw Error("must not launch");});
  const response=await handler(req("/health",undefined,"wrong"),env);
  assert.equal(response.status,401);
  assert.equal(launches,0);
});
test("health works but never discloses credentials",async()=>{
  const response=await createHandler(()=>{throw Error("must not launch");})(req("/health"),env);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.mode,"read-only");
  assert.equal(body.browserConfigured,true);
  assert.equal(JSON.stringify(body).includes(env.AGENT_API_TOKEN),false);
});
test("blocks unapproved URL before launching browser",async()=>{
  let launches=0;
  const response=await createHandler(async()=>{launches++;})(req("/inspect",{url:"https://example.com"}),env);
  assert.equal(response.status,400);assert.equal(launches,0);
});
test("rejects malformed JSON and unsupported actions",async()=>{
  const handler=createHandler(async()=>{throw Error("not expected");});
  assert.equal((await handler(req("/inspect","not-json"),env)).status,400);
  assert.equal((await handler(req("/click",{url:"https://fin-kac.pages.dev"}),env)).status,404);
});
test("requires browser binding for inspection",async()=>{
  const response=await createHandler(async()=>{throw Error("not expected");})(req("/inspect",{url:"https://fin-kac.pages.dev"}),{...env,BROWSER:undefined});
  assert.equal(response.status,503);
});
test("inspects an approved website and closes browser resources",async()=>{
  const mock=browserMock();
  const response=await createHandler(mock.launch)(req("/inspect",{url:"https://fin-kac.pages.dev"}),env);
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.title,"Home");
  assert.deepEqual(body.headings,["Welcome"]);
  assert.equal(body.linkCount,3);
  assert.equal(body.readOnly,true);
  assert.equal(mock.state.closed,true);
  assert.equal(mock.state.browserClosed,true);
});
test("returns screenshot bytes and closes browser",async()=>{
  const mock=browserMock();
  const response=await createHandler(mock.launch)(req("/screenshot",{url:"https://fin-kac.pages.dev"}),env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get("content-type"),"image/png");
  assert.equal((await response.arrayBuffer()).byteLength,4);
  assert.equal(mock.state.browserClosed,true);
});
