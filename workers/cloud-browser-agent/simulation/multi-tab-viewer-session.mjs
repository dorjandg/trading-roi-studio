// Adapter for the isolated synthetic four-tab Chromium session.
// Implements the same narrow controller surface as the Wikipedia fixture.
import {createPersistentVisualSession} from "./persistent-visual-session.mjs";
export async function createMultiTabViewerSession(chromium){
 const core=await createPersistentVisualSession(chromium);
 const state=()=>({...core.state(),tabs:core.tabs(),title:core.state().page,url:`https://${core.state().activeTab}.example.invalid/`,events:core.events()});
 return Object.freeze({
  state,
  frame:()=>core.frame(),
  links:async()=>[],
  search:async()=>{throw Error("Search unavailable in offline multi-tab demo");},
  click:async()=>{throw Error("External links unavailable in offline multi-tab demo");},
  back:()=>core.history(-1),
  switchTab:name=>core.switchTab(name),
  navigate:index=>core.navigate(index),
  close:()=>core.close()
 });
}
