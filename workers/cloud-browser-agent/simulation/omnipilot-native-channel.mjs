// Private process protocol, not an MCP endpoint or a source of authority.
// Production owners supply the connected socket and synchronous revocation.
import {normalizeGenericBrowserCommand} from './omnipilot-generic-browser.mjs';

export const NATIVE_LIMITS=Object.freeze({commandBytes:8192,resultBytes:2800000,
  startupMs:30000,shutdownMs:1500,bridgeConnections:16,bridgeBytes:32*1024*1024});
const CODES=new Set(['INVALID_INPUT','DRIVER_UNSUPPORTED','EGRESS_REQUIRED','EGRESS_UNAVAILABLE',
  'EGRESS_REVOKED','CONTEXT_CLOSED','CONTEXT_MISMATCH','TAB_LIMIT','TAB_UNAVAILABLE','VIEWPORT_REQUIRED',
  'TARGET_NOT_UNIQUE','SENSITIVE_FIELD_REFUSED','EVIDENCE_LIMIT','OWNER_STOPPED','OWNER_INITIALIZATION_FAILED',
  'UNSAFE_PAGE_STATE','DEADLINE_EXCEEDED','OPERATION_UNCERTAIN','DRIVER_FAILED','QUEUE_FULL']);
export const nativeFailure=(code,dispatched=false,outcomeUnknown=false)=>Object.freeze(Object.assign(
  Error('Native browser operation refused'),{code,dispatched,outcomeUnknown,retrySafe:false}));
export function exactRecord(value,keys,required=keys){
  if(!value||typeof value!=='object'||Array.isArray(value)||
    ![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('NATIVE_PROTOCOL_INVALID');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(required.some(key=>!Object.hasOwn(descriptors,key))||Reflect.ownKeys(descriptors).some(key=>
    typeof key!=='string'||!keys.includes(key)||!descriptors[key].enumerable||!Object.hasOwn(descriptors[key],'value')))
    throw Error('NATIVE_PROTOCOL_INVALID');
  return Object.fromEntries(Object.entries(descriptors).map(([key,d])=>[key,d.value]));
}
export function canonicalData(bytes,maxBytes){
  if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>maxBytes)throw Error('NATIVE_FRAME_INVALID');
  const raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),value=JSON.parse(raw);
  if(JSON.stringify(value)!==raw)throw Error('NATIVE_FRAME_INVALID');
  let nodes=0;
  function freeze(item,depth){
    if(++nodes>512||depth>16)throw Error('NATIVE_FRAME_INVALID');
    if(typeof item==='string'&&Buffer.from(item).toString('utf8')!==item)throw Error('NATIVE_FRAME_INVALID');
    if(item&&typeof item==='object'){
      for(const key of Object.keys(item)){
        if(['__proto__','constructor','prototype'].includes(key)||Buffer.from(key).toString('utf8')!==key)
          throw Error('NATIVE_FRAME_INVALID');
        freeze(item[key],depth+1);
      }
      Object.freeze(item);
    }
    return item;
  }
  return freeze(value,0);
}
export function sanitizedNativeError(value){
  try{
    const out={};
    for(const key of ['code','dispatched','outcomeUnknown','retrySafe']){
      const d=Object.getOwnPropertyDescriptor(value,key);
      if(!d||!Object.hasOwn(d,'value'))throw Error();out[key]=d.value;
    }
    if(!CODES.has(out.code)||typeof out.dispatched!=='boolean'||typeof out.outcomeUnknown!=='boolean'||
      out.retrySafe!==false||out.outcomeUnknown&&!out.dispatched)throw Error();
    return Object.freeze(out);
  }catch{return Object.freeze({code:'OPERATION_UNCERTAIN',dispatched:true,outcomeUnknown:true,retrySafe:false});}
}

// Four-byte big-endian byte length followed by exact JSON.stringify JSON.
// No duplicate keys, alternate encodings, line framing or unbounded buffering.
export function createNativeFramedChannel(socket,{maxReadBytes,maxWriteBytes,onMessage,onFailure}){
  if(!Number.isSafeInteger(maxReadBytes)||maxReadBytes<1||maxReadBytes>NATIVE_LIMITS.resultBytes||
    !Number.isSafeInteger(maxWriteBytes)||maxWriteBytes<1||maxWriteBytes>NATIVE_LIMITS.resultBytes||
    typeof onMessage!=='function'||typeof onFailure!=='function')throw Error('NATIVE_CHANNEL_CONFIG');
  let closed=false,header=Buffer.alloc(4),headerUsed=0,body=null,bodyUsed=0,queuedBytes=0;
  const writes=new Set();
  function fail(){
    if(closed)return;closed=true;
    // Revocation must precede release of any promise that can admit new work.
    try{onFailure();}catch{}finally{
      for(const entry of writes){clearTimeout(entry.timer);entry.reject(Error('NATIVE_CHANNEL_FAILED'));}
      writes.clear();queuedBytes=0;try{socket.destroy();}catch{}
    }
  }
  socket.on('error',fail);socket.on('end',fail);socket.on('close',fail);
  socket.on('data',chunk=>{
    if(closed)return;
    try{
      if(!Buffer.isBuffer(chunk))throw Error();
      let offset=0,frames=0;
      while(offset<chunk.length&&!closed){
        if(!body){
          const count=Math.min(4-headerUsed,chunk.length-offset);
          chunk.copy(header,headerUsed,offset,offset+count);headerUsed+=count;offset+=count;
          if(headerUsed!==4)continue;
          const length=header.readUInt32BE();
          if(length===0||length>maxReadBytes)throw Error();
          body=Buffer.allocUnsafe(length);bodyUsed=0;
        }
        const count=Math.min(body.length-bodyUsed,chunk.length-offset);
        chunk.copy(body,bodyUsed,offset,offset+count);bodyUsed+=count;offset+=count;
        if(bodyUsed===body.length){
          if(++frames>4)throw Error();
          const value=canonicalData(body,maxReadBytes);body=null;bodyUsed=0;headerUsed=0;
          onMessage(value);
        }
      }
    }catch{fail();}
  });
  function send(value,deadline=performance.now()+1500){
    return new Promise((resolve,reject)=>{
      let bytes;
      try{
        if(closed||socket.destroyed||!Number.isFinite(deadline)||performance.now()>=deadline)throw Error();
        bytes=Buffer.from(JSON.stringify(value));canonicalData(bytes,maxWriteBytes);
        if(queuedBytes+bytes.length+4>maxWriteBytes+4)throw Error();
      }catch{fail();reject(Error('NATIVE_CHANNEL_FAILED'));return;}
      const frame=Buffer.allocUnsafe(bytes.length+4);frame.writeUInt32BE(bytes.length);bytes.copy(frame,4);
      const remaining=deadline-performance.now();
      if(remaining<=0){fail();reject(Error('NATIVE_CHANNEL_FAILED'));return;}
      const entry={reject,timer:null};writes.add(entry);queuedBytes+=frame.length;
      entry.timer=setTimeout(fail,remaining);
      try{socket.write(frame,error=>{
        if(!writes.has(entry))return;
        if(error||performance.now()>=deadline){fail();return;}
        writes.delete(entry);queuedBytes-=frame.length;clearTimeout(entry.timer);resolve();
      });}catch{fail();}
    });
  }
  return Object.freeze({send,close:fail,diagnostics:()=>Object.freeze({closed,queuedBytes,partialFrame:headerUsed>0||body!==null})});
}

// A transport-free one-command client. halt is a trusted synchronous callback
// that revokes egress/namespace ownership, never a request-supplied policy.
export function createNativeCommandClient({send,halt}){
  if(typeof send!=='function'||typeof halt!=='function')throw Error('NATIVE_CLIENT_CONFIG');
  let stopped=false,pending=null,nextId=1,lastSequence=0;
  function release(error,result){
    const entry=pending;if(!entry)return;pending=null;clearTimeout(entry.timer);
    if(error)entry.reject(error);else entry.resolve(result);
  }
  function poison(){
    if(stopped)return;stopped=true;
    try{halt();}catch{}finally{release(nativeFailure('OPERATION_UNCERTAIN',!!pending?.submitted,!!pending?.submitted));}
  }
  function stop(){
    if(stopped)return;stopped=true;
    release(nativeFailure('OWNER_STOPPED',!!pending?.submitted,!!pending?.submitted));
  }
  function accept(message){
    if(stopped)return;
    try{
      const m=exactRecord(message,['v','kind','id','result','error'],['v','kind','id']);
      const entry=pending;
      if(m.v!==1||!entry||m.id!==entry.id||performance.now()>=entry.deadline||process.hrtime.bigint()>=entry.expiresNs||
        !['result','error'].includes(m.kind)||Object.hasOwn(m,m.kind==='result'?'error':'result'))throw Error();
      if(m.kind==='error'){
        exactRecord(m.error,['code','dispatched','outcomeUnknown','retrySafe']);
        const error=sanitizedNativeError(m.error);
        if(JSON.stringify(error)!==JSON.stringify(m.error))throw Error();
        if(error.outcomeUnknown){stopped=true;try{halt();}catch{}finally{release(nativeFailure(error.code,error.dispatched,true));}}
        else release(nativeFailure(error.code,error.dispatched,false));
      }else{
        const result=exactRecord(m.result,['op','sequence','untrustedContent','data']);
        if(result.op!==entry.op||result.untrustedContent!==true||!Number.isSafeInteger(result.sequence)||
          result.sequence<=lastSequence||!result.data||typeof result.data!=='object'||Array.isArray(result.data))throw Error();
        lastSequence=result.sequence;release(null,m.result);
      }
    }catch{poison();}
  }
  function execute(input,ownerDeadline){
    if(stopped)return Promise.reject(nativeFailure('OWNER_STOPPED'));
    let normalized,external,upstreamExpiry=null;
    try{
      normalized=normalizeGenericBrowserCommand(input);
      external=canonicalData(Buffer.from(JSON.stringify(input)),NATIVE_LIMITS.commandBytes);
      if(ownerDeadline!==undefined){
        const deadline=exactRecord(ownerDeadline,['expiresNs']);
        if(typeof deadline.expiresNs!=='bigint'||deadline.expiresNs<=0n)throw Error();upstreamExpiry=deadline.expiresNs;
      }
    }catch{return Promise.reject(nativeFailure('INVALID_INPUT'));}
    if(pending)return Promise.reject(nativeFailure('QUEUE_FULL'));
    if(nextId>Number.MAX_SAFE_INTEGER){poison();return Promise.reject(nativeFailure('OWNER_STOPPED'));}
    return new Promise((resolve,reject)=>{
      const localExpiry=process.hrtime.bigint()+BigInt(normalized.timeoutMs)*1000000n;
      const expiresNs=upstreamExpiry!==null&&upstreamExpiry<localExpiry?upstreamExpiry:localExpiry;
      // The first clock is authoritative across the verified shared Linux time
      // namespace. Sampling performance before the remaining duration creates
      // only a conservative local deadline, never a later child expiry.
      const localStart=performance.now(),remainingMs=Number(expiresNs-process.hrtime.bigint())/1000000;
      const entry={id:nextId++,op:normalized.op,resolve,reject,submitted:false,
        deadline:localStart+remainingMs,expiresNs,timer:null};
      pending=entry;
      if(remainingMs<=0){poison();return;}
      entry.timer=setTimeout(poison,remainingMs);
      entry.submitted=true;
      try{Promise.resolve(send({v:1,kind:'execute',id:entry.id,expiresNs:entry.expiresNs.toString(),command:external},entry.deadline)).then(()=>{
        if(pending===entry&&(performance.now()>=entry.deadline||process.hrtime.bigint()>=entry.expiresNs))poison();
      },poison);}catch{poison();}
    });
  }
  return Object.freeze({adapter:Object.freeze({execute}),accept,stop,poison,
    diagnostics:()=>Object.freeze({stopped,busy:pending!==null,submitted:pending?.submitted===true,lastSequence})});
}
