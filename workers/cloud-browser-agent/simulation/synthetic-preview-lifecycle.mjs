// Test-only lifecycle guard. No listeners, network, or production imports.
export async function runBoundedPreview(chromium,work,{timeoutMs=30000,signal}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<10||timeoutMs>60000)throw Error("Invalid timeout");
 if(signal?.aborted)throw Error("Preview cancelled");
 let activeBrowser=null;
 const controller=new AbortController();
 const closeBrowser=async()=>{if(activeBrowser){const b=activeBrowser;activeBrowser=null;await b.close().catch(()=>{});}};
 const guarded={
  launch:async options=>{
   if(controller.signal.aborted)throw Error("Preview cancelled");
   const browser=await chromium.launch(options);
   if(controller.signal.aborted){await browser.close().catch(()=>{});throw Error("Preview cancelled");}
   activeBrowser=browser;
   return browser;
  }
 };
 const abort=()=>controller.abort();
 signal?.addEventListener("abort",abort,{once:true});
 let timer;
 const deadline=new Promise((_,reject)=>{
  timer=setTimeout(()=>{reject(Error("Preview timeout"));controller.abort();},timeoutMs);
  controller.signal.addEventListener("abort",()=>reject(Error("Preview cancelled")),{once:true});
 });
 const workPromise=Promise.resolve().then(()=>work(guarded));
 try{return await Promise.race([workPromise,deadline]);}
 finally{
  clearTimeout(timer);
  signal?.removeEventListener("abort",abort);
  controller.abort();
  await closeBrowser();
  // A late launch is closed by guarded.launch when it resolves.
  // Prevent an abandoned work promise from becoming an unhandled rejection.
  workPromise.catch(()=>{});
 }
}
