// Explicit owned-host acceptance only. No import-time listener/browser launch.
// The installed production launcher and broker are used without test seams.
import {randomBytes} from 'node:crypto';
import {request} from 'node:http';
import {fileURLToPath} from 'node:url';
import {createNativeOmniPilotRuntime} from './omnipilot-native-runtime.mjs';

export async function runNativeAcceptance(installation){
  const bearerToken=randomBytes(32).toString('base64url');
  const runtime=await createNativeOmniPilotRuntime({installation,bearerToken});
  const observations=runtime.diagnostics();let sequence=0;
  async function command(value){
    const url=new URL(runtime.url),body=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:++sequence,method:'tools/call',
      params:{name:'omnipilot_browser',arguments:{command:value}}}));
    return new Promise((resolve,reject)=>{
      const req=request({host:'127.0.0.1',port:url.port,path:'/mcp',method:'POST',agent:false,
        headers:{host:url.host,authorization:'Bearer '+bearerToken,'content-type':'application/json','content-length':body.length}},res=>{
        const chunks=[];let size=0;
        res.on('data',bytes=>{size+=bytes.length;if(size>3000000){req.destroy();reject(Error('ACCEPTANCE_RESPONSE_LIMIT'));}else chunks.push(bytes);});
        res.on('error',reject);res.on('end',()=>{
          try{const reply=JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if(res.statusCode!==200||reply.result?.isError!==false)throw Error('ACCEPTANCE_COMMAND_FAILED');resolve(reply.result);
          }catch{reject(Error('ACCEPTANCE_COMMAND_FAILED'));}
        });
      });
      req.setTimeout(10000,()=>{req.destroy();reject(Error('ACCEPTANCE_COMMAND_TIMEOUT'));});
      req.on('error',reject);req.end(body);
    });
  }
  let result;
  try{
    const status=await command({op:'status'}),created=await command({op:'tabs.create'});
    const tabId=created.structuredContent.data.tabId;
    await command({op:'click',tabId,x:10,y:10});
    const text=await command({op:'snapshot',tabId,maxChars:100});
    const picture=await command({op:'screenshot',tabId,width:320,height:200});
    await command({op:'tabs.close',tabId});
    if(status.structuredContent.data.tabCount!==1||created.structuredContent.data.origin!=='about:blank'||
      text.structuredContent.data.text!==''||picture.content.filter(item=>item.type==='image').length!==1||
      picture.structuredContent.data.redactionComplete!==false)throw Error('ACCEPTANCE_EVIDENCE_FAILED');
    result={scope:'owned-blank-browser-no-public-navigation',status:'passed',actualBrowserCommands:6,
      startup:observations,blankScreenshot:{width:picture.structuredContent.data.width,height:picture.structuredContent.data.height},
      requestedPublicNavigation:false,publicNetworkAcceptance:false,pluginExposure:false,parentDeathAcceptance:false,
      remaining:['Controlled HTTPS/TLS, redirect, subresource and WebSocket acceptance',
        'Owned direct TCP/UDP refusal and forced parent/child death acceptance','Independent private tunnel/plugin audience verification']};
  }finally{
    const shutdown=await runtime.close();
    if(result)result.shutdown=shutdown;
    if(!shutdown.namespaceInitGone||!shutdown.processExitObserved||!shutdown.brokerCloseComplete||
      !shutdown.cleanupComplete||shutdown.shutdownTimedOut)throw Error('ACCEPTANCE_SHUTDOWN_INCOMPLETE');
  }
  return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length!==3){process.stderr.write('Three trusted installation paths required: node chromium playwright-core\n');process.exitCode=1;}
  else runNativeAcceptance({node:args[0],chromium:args[1],playwrightCore:args[2]}).then(
    result=>process.stdout.write(JSON.stringify(result)+'\n'),error=>{
      const code=/^(?:NATIVE|ACCEPTANCE)_[A-Z_]+$/.test(error?.code??error?.message)?error.code??error.message:'ACCEPTANCE_FAILED';
      process.stdout.write(JSON.stringify({status:'failed',code,stage:error?.stage??null})+'\n');process.exitCode=1;
    });
}
