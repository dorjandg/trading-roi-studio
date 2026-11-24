import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {renderPage} from '../src/site.js';
const content=JSON.parse(await readFile(new URL('../src/content.json',import.meta.url),'utf8'));
const client=await readFile(new URL('../public/assets/site.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/assets/site.css',import.meta.url),'utf8');

test('chat has a compact header, transcript, bottom composer and keyboard-aware viewport in both languages',()=>{
 for(const lang of ['en','sq']){
  const html=renderPage('/',content,lang);
  assert.match(html,/interactive-widget=resizes-content/);
  assert.match(html,/id="chat-panel" role="dialog" aria-modal="true"/);
  assert.match(html,/id="chat-messages" role="log"/);
  assert.match(html,/id="chat-reset"/);
  assert.match(html,/id="chat-question" rows="1"[^>]*enterkeyhint="send"/);
  assert.ok(html.indexOf('id="chat-form"')>html.indexOf('class="chat-footer"'));
  assert.match(html,/site\.js\?v=chat-viewport-1/);
 }
 assert.match(css,/\.chat-messages\{flex:1 1 0;min-height:0;max-height:none/);
 assert.match(css,/\.chat-panel\{position:fixed;z-index:300;left:var\(--chat-vv-left/);
 assert.match(css,/\.chat-panel\.chat-compact \.chat-header p,\.chat-panel\.chat-compact \.chat-footer\{display:none\}/);
});
test('mobile chat uses visible viewport, never steals keyboard focus and restores page on close',async()=>{
 const listeners=new Map(),frames=new Map(),nodes=new Map();let active=null,focusCalls=[],restored=null,raf=0,fetchResolver;
 const element=id=>{
  if(nodes.has(id))return nodes.get(id);
  const handlers=new Map(),props=new Map(),classes=new Set(),children=[];
  const node={id,hidden:id==='chat-panel',disabled:false,inert:false,value:'',textContent:id==='site-config'?'{"language":"en"}':'',dataset:{},scrollTop:0,scrollHeight:100,clientHeight:100,children,
   style:{setProperty:(k,v)=>props.set(k,v),removeProperty:k=>props.delete(k),getPropertyValue:k=>props.get(k),height:''},
   classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v),toggle:(v,on)=>on?classes.add(v):classes.delete(v)},
   addEventListener:(k,f)=>handlers.set(k,f),fire:(k,event={})=>handlers.get(k)?.(event),setAttribute(k,v){this[k]=v;},querySelector(sel){return sel==='.chat-suggestions'?element('suggestions'):sel==='button[type="submit"]'?element('submit'):null;},querySelectorAll:()=>[],
   focus(opts){active=node;focusCalls.push([id,opts]);},blur(){if(active===node)active=null;},appendChild(child){children.push(child);},remove(){this.removed=true;},getBoundingClientRect:()=>({top:12}),closest:()=>null,getClientRects:()=>[{}]};
  nodes.set(id,node);return node;
 };
 const vv={width:390,height:780,offsetLeft:0,offsetTop:0,addEventListener:(k,f)=>listeners.set('vv:'+k,f)};
 const doc={documentElement:element('root'),body:element('body'),getElementById:id=>id==='application-form'?null:element(id),querySelector:()=>null,querySelectorAll:sel=>sel.includes('#site-menu')?[element('main'),element('chat-open')]:[],addEventListener(){},createElement:()=>element('message'+Math.random()),get activeElement(){return active;}};
 doc.documentElement.lang='en';doc.documentElement.clientWidth=390;
 const win={visualViewport:vv,innerHeight:780,scrollX:0,scrollY:326,matchMedia:()=>({matches:true}),requestAnimationFrame:f=>{frames.set(++raf,f);return raf;},cancelAnimationFrame:id=>frames.delete(id),addEventListener:(k,f)=>listeners.set(k,f),scrollTo:(x,y)=>{restored=[x,y];}};
 const flush=()=>{const fs=[...frames.values()];frames.clear();fs.forEach(f=>f());};
 runInNewContext(client,{document:doc,window:win,location:{href:'https://vocalmastery.net/?lang=en'},URL,localStorage:{getItem:()=>null,setItem(){}},setTimeout,clearTimeout,AbortController,fetch:()=>new Promise(resolve=>{fetchResolver=resolve;})});
 const panel=element('chat-panel'),question=element('chat-question');
 element('chat-open').fire('click');
 assert.equal(panel.hidden,false);assert.equal(active.id,'chat-close');
 assert.equal(panel.style.getPropertyValue('--chat-vv-height'),'780px');
 assert.equal(doc.body.style.getPropertyValue('--chat-page-top'),'-326px');
 assert.ok(doc.body.classList.contains('chat-open'));
 question.focus();vv.height=352;vv.offsetTop=8;listeners.get('vv:resize')();listeners.get('vv:scroll')();
 assert.equal(frames.size,1);flush();
 assert.equal(panel.style.getPropertyValue('--chat-vv-height'),'352px');assert.equal(panel.style.getPropertyValue('--chat-vv-top'),'8px');assert.ok(panel.classList.contains('chat-compact'));
 question.value='Hello';element('chat-form').fire('submit',{preventDefault(){}});
 assert.equal(active,null);assert.equal(element('submit').disabled,true);
 fetchResolver({ok:true,json:async()=>({reply:'Welcome'})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(active,null);assert.equal(element('submit').disabled,false);
 vv.height=780;vv.offsetTop=0;listeners.get('vv:resize')();flush();assert.ok(!panel.classList.contains('chat-compact'));
 element('chat-close').fire('click');assert.equal(panel.hidden,true);assert.deepEqual(restored,[0,326]);assert.equal(active.id,'chat-open');
 assert.equal(focusCalls.filter(([id])=>id==='chat-question').length,1);
 assert.ok(!doc.body.classList.contains('chat-open'));
});
