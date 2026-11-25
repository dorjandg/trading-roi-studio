// OmniPilot v2 isolated per-origin browser grants.
// Separate from the existing broad read-only ALLOWED_ORIGINS and demo grant.
// NO configured origins -> no rights; neither module import nor planning does I/O.
const refused=()=>Object.assign(new Error('SITE_GRANT_REFUSED'),{code:'SITE_GRANT_REFUSED'});
const fail=()=>{throw refused()};
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)
  &&Object.getPrototypeOf(o)===Object.prototype
  &&Object.keys(o).sort().join(',')===keys.slice().sort().join(',');
// Independent deny boundary: these operator-owned production and infrastructure
// resources can never be promoted by simply adding a site grant.
const protectedHosts=new Set([
  'fin-kac.pages.dev','trading-roi-studio.pages.dev',
  'hub.immamarketing.com','glam-lingerie.com'
]);
const protectedSuffixes=[
  '.fin-kac.pages.dev','.trading-roi-studio.pages.dev',
  '.immamarketing.com','.glam-lingerie.com',
  '.dorjan-gjoni-dg.workers.dev'
];
const denyHostname=host=>
  /(^localhost$|\.localhost$|\.local$|\.internal$|\.invalid$|\.test$|\.onion$|\.nip\.io$|\.sslip\.io$|\.xip\.io$)/i.test(host)
  ||protectedHosts.has(host)||protectedSuffixes.some(suffix=>host.endsWith(suffix));
export function validateOrigin(value){
  if(typeof value!=='string'||value.length>200||!value.startsWith('https://'))fail();
  let u;try{u=new URL(value)}catch{fail()}
  const host=u.hostname;
  if(u.origin!==value||u.protocol!=='https:'||u.port||u.username||u.password
    ||!host.includes('.')||host.length>180||host.startsWith('xn--')
    ||host.includes('.xn--')||denyHostname(host)
    ||!host.split('.').every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x))
    ||/^\d+(?:\.\d+){3}$/.test(host)||host.startsWith('['))fail();
  return Object.freeze({origin:u.origin,hostname:host});
}
export function validateSiteUrl(value){
  if(typeof value!=='string'||value.length>1024||!value.startsWith('https://'))fail();
  let u;try{u=new URL(value)}catch{fail()}
  validateOrigin(u.origin);
  if(u.username||u.password||u.port||u.search||u.hash||u.href!==value
    ||/[%\\]/.test(u.pathname)||u.pathname.includes('//')
    ||/(?:^|\/)(?:login|logout|signin|signout|auth|oauth|token|api|admin|delete|remove|pay|buy|order|checkout|transfer|withdraw|approve|confirm|purchase|upload|download|unsubscribe|reset|activate|deactivate|submit|save)(?:\/|$)/i.test(u.pathname))fail();
  return u;
}
function safeString(value,max){
  if(typeof value!=='string'||value.length<1||value.length>max
    ||/[\u0000-\u001f\u007f]/.test(value)
    ||new TextDecoder('utf-8',{fatal:true}).decode(new TextEncoder().encode(value))!==value)fail();
  return value;
}
function selector(value){
  safeString(value,120);
  // Exact same-origin link selectors may contain a slash, but not wildcards,
  // query strings, fragments, encoded paths, or parent-directory segments.
  const exactLink=/^a\[href="\/[a-zA-Z0-9_:.\/\-]{1,95}"\]$/.test(value)&&!value.includes('..');
  if(!exactLink&&!/^[a-zA-Z0-9_#. >:[\]="'\-]+$/.test(value))fail();
  if(/(?:password|secret|token|otp|credit|card|csrf|submit|payment|hidden|file|confirm|delete|purchase)/i.test(value))fail();
  return value;
}
export function parseSiteGrants(raw,nowMs=Date.now()){
  if(typeof raw!=='string'||raw.length<2||raw.length>5000)fail();
  let value;try{value=JSON.parse(raw)}catch{fail()}
  if(!exact(value,['version','sites'])||![1,2].includes(value.version)
    ||!Array.isArray(value.sites)||value.sites.length<1||value.sites.length>16
    ||Object.keys(value.sites).length!==value.sites.length)fail();
  if(value.version===2&&(!Number.isSafeInteger(nowMs)||nowMs<0))fail();
  const seen=new Set();
  const sites=value.sites.map(item=>{
    const expected=value.version===1?['origin','mode']:
      ['origin','mode','pathPrefix','expiresAt','maxActions'];
    if(!exact(item,expected)||!['read','draft'].includes(item.mode))fail();
    const origin=validateOrigin(item.origin);
    if(seen.has(origin.origin))fail();
    seen.add(origin.origin);
    if(value.version===1)return Object.freeze({...origin,mode:item.mode});
    // Version 2 is operator-configured and time-limited, never a user-granted
    // persistent permission. Draft grants expire within 24h; reads within 30d.
    const prefix=item.pathPrefix;
    if(typeof prefix!=='string'||prefix.length<1||prefix.length>128
      ||!prefix.startsWith('/')||!prefix.endsWith('/')
      ||prefix.includes('//')||prefix.includes('..')
      ||/[%\\?#]/.test(prefix)
      ||!/^\/(?:[A-Za-z0-9._~-]+\/)*$/.test(prefix)
      ||/(?:^|\/)(?:api|admin|auth|login|logout|token|delete|remove|save|submit|order|checkout|buy|purchase|transfer|confirm|upload|download)(?:\/|$)/i.test(prefix))fail();
    if(typeof item.expiresAt!=='string'
       ||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.expiresAt))fail();
    const expires=Date.parse(item.expiresAt);
    const maxLifetime=item.mode==='read'?30*86400000:86400000;
    if(!Number.isSafeInteger(expires)||new Date(expires).toISOString()!==item.expiresAt
      ||expires<=nowMs||expires-nowMs>maxLifetime)fail();
    if(!Number.isSafeInteger(item.maxActions)
      ||(item.mode==='read'?item.maxActions!==0:
          item.maxActions<1||item.maxActions>3))fail();
    return Object.freeze({...origin,mode:item.mode,
      pathPrefix:prefix,expiresAtMs:expires,maxActions:item.maxActions});
  });
  return Object.freeze(sites);
}
export function planSiteControl(request,rawGrants,nowMs=Date.now()){
  if(!request||typeof request!=='object'||Array.isArray(request)
    ||Object.getPrototypeOf(request)!==Object.prototype)fail();
  const keys=Object.keys(request).sort().join(',');
  if(!['mode,url','actions,mode,url'].includes(keys)||!['read','draft'].includes(request.mode))fail();
  if(request.mode==='read'&&keys!=='mode,url')fail();
  if(request.mode==='draft'&&keys!=='actions,mode,url')fail();
  const url=validateSiteUrl(request.url);
  const permit=parseSiteGrants(rawGrants,nowMs).find(g=>g.origin===url.origin);
  if(!permit||(request.mode==='draft'&&permit.mode!=='draft'))fail();
  if(permit.pathPrefix&&!url.pathname.startsWith(permit.pathPrefix))fail();
  let actions=[];
  if(request.mode==='draft'){
    if(!Array.isArray(request.actions)||request.actions.length<1||request.actions.length>5
      ||(permit.maxActions!==undefined&&request.actions.length>permit.maxActions)
      ||Object.keys(request.actions).length!==request.actions.length)fail();
    actions=request.actions.map(x=>{
      if(!x||typeof x!=='object'||Array.isArray(x)||Object.getPrototypeOf(x)!==Object.prototype)fail();
      if(x.op==='fill'){
        if(!exact(x,['op','selector','value']))fail();
        return Object.freeze({op:'fill',selector:selector(x.selector),value:safeString(x.value,256)});
      }
      if(x.op==='click'||x.op==='wait'){
        if(!exact(x,['op','selector']))fail();
        return Object.freeze({op:x.op,selector:selector(x.selector)});
      }
      if(x.op==='press'){
        if(!exact(x,['op','selector','key'])||!['Tab','Escape'].includes(x.key))fail();
        return Object.freeze({op:'press',selector:selector(x.selector),key:x.key});
      }
      fail();
    });
  }
  const bounded=permit.pathPrefix?{pathPrefix:permit.pathPrefix,
    expiresAtMs:permit.expiresAtMs,maxActions:permit.maxActions}:{};
  return Object.freeze({url:url.href,origin:permit.origin,hostname:permit.hostname,
    mode:request.mode,actions:Object.freeze(actions),...bounded});
}
