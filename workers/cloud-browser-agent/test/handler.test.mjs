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
    evaluate:async()=>[{method:"POST",fields:[{type:"text",label:"Name",name:"name",value:"never-expose"},{type:"password",label:"Password",name:"password",value:"secret"}]}],
    locator:selector=>selector==="a[href]"?{count:async()=>3,evaluateAll:async()=>[
      {href:"https://fin-kac.pages.dev/summary?session=secret",text:"Summary"},
      {href:"https://evil.test/steal",text:"External"},
      {href:"https://fin-kac.pages.dev/summary?token=other",text:"Duplicate"},
      {href:"https://fin-kac.pages.dev/reports",text:"Reports"}
    ]}:selector==="h1, h2"?
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

test("discovers same-origin navigation without leaking query parameters or visiting links",async()=>{
  const mock=browserMock();
  const response=await createHandler(mock.launch)(req("/links",{url:"https://fin-kac.pages.dev"}),env);
  const value=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(value.links.map(x=>x.url),[
    "https://fin-kac.pages.dev/summary",
    "https://fin-kac.pages.dev/reports"
  ]);
  assert.equal(value.queryParametersRemoved,true);
  assert.equal(value.readOnly,true);
  assert.equal(mock.state.navigated,"https://fin-kac.pages.dev/");
  assert.equal(mock.state.browserClosed,true);
});

test("follow an actual same-origin link using GET and close browser",async()=>{
 const mock=browserMock();
 const handler=createHandler(mock.launch);
 const r=await handler(req("/follow",{url:"https://fin-kac.pages.dev",linkUrl:"https://fin-kac.pages.dev/reports"}),env);
 const j=await r.json();
 assert.equal(r.status,200);
 assert.equal(j.finalUrl,"https://fin-kac.pages.dev/reports");
 assert.equal(j.clicked,false);
 assert.equal(j.readOnly,true);
 assert.equal(j.method,"GET");
 assert.equal(mock.state.browserClosed,true);
});
test("refuse links not present on source page",async()=>{
 const mock=browserMock();
 const r=await createHandler(mock.launch)(req("/follow",{url:"https://fin-kac.pages.dev",linkUrl:"https://fin-kac.pages.dev/not-listed"}),env);
 assert.equal(r.status,400);
 assert.equal(mock.state.navigated,"https://fin-kac.pages.dev/");
 assert.equal(mock.state.browserClosed,true);
});
test("reject cross-origin, query and action-like navigation before launch",async()=>{
 let launches=0;
 const handler=createHandler(async()=>{launches++;});
 for(const linkUrl of ["https://evil.test/","https://fin-kac.pages.dev/reports?delete=1","https://fin-kac.pages.dev/logout","https://fin-kac.pages.dev/delete/7"]){
  const r=await handler(req("/follow",{url:"https://fin-kac.pages.dev",linkUrl}),env);
  assert.equal(r.status,400);
 }
 assert.equal(launches,0);
});

test("form endpoint returns field shape without values or sensitive inputs",async()=>{
 const mock=browserMock();
 const r=await createHandler(mock.launch)(req("/forms",{url:"https://fin-kac.pages.dev"}),env);
 const body=await r.json();
 assert.equal(r.status,200);
 assert.equal(body.formCount,1);
 assert.deepEqual(body.forms[0].fields.map(x=>x.label),["Name"]);
 assert.equal(JSON.stringify(body).includes("never-expose"),false);
 assert.equal(body.submissionsAllowed,false);
 assert.equal(mock.state.browserClosed,true);
});

test("edit preview never changes page and does not read values",async()=>{
 const mock=browserMock();
 const r=await createHandler(mock.launch)(req("/edit-preview",{url:"https://fin-kac.pages.dev",formIndex:1,fieldLabel:"Name",proposedText:"New label"}),env);
 const v=await r.json();
 assert.equal(r.status,200);
 assert.equal(v.previewOnly,true);assert.equal(v.executionAllowed,false);
 assert.equal(v.currentValue,"NOT_READ");
 assert.equal(v.proposedText,"New label");
 assert.equal(mock.state.browserClosed,true);
});
