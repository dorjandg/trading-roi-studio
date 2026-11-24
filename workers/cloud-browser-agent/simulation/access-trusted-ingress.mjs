// API1 P2-A: data-only synthetic parser. Never verifies identity or returns grants.
import {parseStrictJson} from './access-assertion-verifier.mjs';
const allowed = new Set(['host','content-type','content-length','accept',
  'cf-access-jwt-assertion','mcp-protocol-version','mcp-method','mcp-name']);
// Accept only bounded own data properties. No getters, sparse arrays, symbols,
// unusual prototypes or cycles. Arbitrary JS Proxies are outside the contract.
export function copyData(value, rootKeys, allowClock=false) {
  let nodes=0, units=0;
  const active=new WeakSet();
  function walk(v,depth,keys) {
    if(++nodes>512 || depth>12) throw Error('INVALID_DATA');
    if(typeof v==='string') {
      if(v.length>12000 || (units+=v.length)>65536) throw Error('INVALID_DATA');
      return v;
    }
    if(v===null || typeof v==='boolean' ||
       (typeof v==='number' && Number.isFinite(v))) return v;
    if(!v || typeof v!=='object') throw Error('INVALID_DATA');
    const array=Array.isArray(v), proto=Object.getPrototypeOf(v);
    if(array ? proto!==Array.prototype : ![Object.prototype,null].includes(proto)) throw Error('INVALID_DATA');
    if(active.has(v) || (array && v.length>64)) throw Error('INVALID_DATA');
    const names=Reflect.ownKeys(v);
    if(names.length>(keys?keys.length:65)) throw Error('INVALID_DATA');
    active.add(v);
    const out=array?[]:Object.create(null);
    if(array && (v.length>64 || names.length!==v.length+1)) throw Error('INVALID_DATA');
    for(const k of names) {
      if(array && k==='length') continue;
      const d=Object.getOwnPropertyDescriptor(v,k);
      if(typeof k!=='string' || !Object.hasOwn(d,'value') || !d.enumerable ||
         ['__proto__','constructor','prototype'].includes(k) ||
         (keys && !keys.includes(k)) || (array && (!/^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=v.length))) throw Error('INVALID_DATA');
      out[k]=depth===0 && allowClock && k==='clock' && typeof d.value==='function' ? d.value : walk(d.value,depth+1);
    }
    active.delete(v);
    return Object.freeze(out);
  }
  if(!value || typeof value!=='object' || Array.isArray(value)) throw Error('INVALID_DATA');
  return walk(value,0,rootKeys);
}
export function validateIngressConfig({expectedHost,maxHeaderBytes=16384,maxBodyBytes=4096}) {
  if(typeof expectedHost!=='string' || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(expectedHost) ||
    expectedHost.length>253 || expectedHost.split('.').some(x=>x.length>63) ||
    !Number.isSafeInteger(maxHeaderBytes) || maxHeaderBytes<1024 || maxHeaderBytes>32768 ||
    !Number.isSafeInteger(maxBodyBytes) || maxBodyBytes<1 || maxBodyBytes>4096) throw Error('INVALID_INGRESS_CONFIG');
  return Object.freeze({expectedHost,maxHeaderBytes,maxBodyBytes});
}
export function parseSyntheticRequest(request,{expectedHost,maxHeaderBytes,maxBodyBytes}) {
      request=copyData(request,['method','path','rawHeaders','body']);
      if( request.method!=='POST' || request.path!=='/mcp')
        throw Error('INVALID_REQUEST');
      const {rawHeaders,body}=request;
      if(!Array.isArray(rawHeaders) || rawHeaders.length%2 || rawHeaders.length>32 || typeof body!=='string')
        throw Error('INVALID_REQUEST');
      if(body.length>maxBodyBytes || Buffer.byteLength(body,'utf8')>maxBodyBytes || Buffer.from(body).toString('utf8')!==body)
        throw Error('INVALID_BODY');
      const headers=Object.create(null); let bytes=0;
      for(let i=0;i<rawHeaders.length;i+=2) {
        const name=rawHeaders[i], val=rawHeaders[i+1];
        if(typeof name!=='string' || name.length>64 || !/^[A-Za-z0-9-]+$/.test(name) ||
           typeof val!=='string' || val.length>12000 || !/^[\x20-\x7e]+$/.test(val) || val.trim()!==val)
          throw Error('INVALID_HEADERS');
        const k=name.toLowerCase(); bytes+=name.length+val.length+4;
        if(bytes>maxHeaderBytes || !allowed.has(k) || Object.hasOwn(headers,k)) throw Error('INVALID_HEADERS');
        headers[k]=val;
      }
      if(headers.host!==expectedHost || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(headers['content-type']??''))
        throw Error('INVALID_TARGET');
      if(Object.hasOwn(headers,'content-length') && (!/^(0|[1-9][0-9]*)$/.test(headers['content-length']) ||
        Number(headers['content-length'])!==Buffer.byteLength(body,'utf8'))) throw Error('INVALID_LENGTH');
      const assertion=headers['cf-access-jwt-assertion'];
      if(!assertion || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(assertion)) throw Error('INVALID_ASSERTION');
      delete headers['cf-access-jwt-assertion']; delete headers.host; delete headers['content-length']; delete headers.accept;
  return {assertion,method:'POST',path:'/mcp',headers,rpc:parseStrictJson(body)};
}
