// API1 P3-A: read-only Linux process identity inspection with INJECTED readers.
// No fs/proc/process/network imports or operational capabilities. A real reader
// must be separately reviewed; these observations are never ownership leases.
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const TICKS=/^[1-9][0-9]{0,19}$/;
const PID=/^[1-9][0-9]{0,9}$/;
const STAT_LIMIT=8192;
const LINK_LIMIT=1024;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,allowed)=>Object.keys(x).every(k=>allowed.includes(k));
const result=(decision,issues)=>Object.freeze({
  decision,issues:Object.freeze([...new Set(issues)]),
  executionAuthorized:false,requiresExternalVerification:true,
  executableFingerprintVerified:false
});

function parseStat(raw,pid){
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>STAT_LIMIT||raw.length<12)
    return null;
  // /proc/<pid>/stat field 2 is a parenthesized comm and may contain spaces
  // and closing parentheses. The delimiter is the final ") " before fields 3+.
  const end=raw.lastIndexOf(') ');
  if(end<2||raw[raw.indexOf(' ')+1]!=='(')return null;
  const head=raw.slice(0,raw.indexOf(' '));
  if(head!==String(pid))return null;
  const fields=raw.slice(end+2).trim().split(/\s+/);
  // field 22 starttime is index 19 of the fields that begin at field 3.
  if(fields.length<20||!TICKS.test(fields[19])||!new Set(['R','S','D','T','t','Z','X','x','I','W']).has(fields[0]))return null;
  return {state:fields[0],startTicks:fields[19]};
}

/**
 * Compare the same process's boot ID, stat start ticks, and executable link
 * against operator-supplied expectations. Every read goes through injected,
 * read-only callables; no default reader is provided. Link matching is NOT a
 * cryptographic executable fingerprint, and PID checks are inherently racy.
 */
export async function inspectProcessIdentity({pid,expected,readFile,readLink}={}){
  if(!Number.isSafeInteger(pid)||pid<1||pid>2147483647||
    !obj(expected)||!keys(expected,['bootId','startTicks','executableLink'])||
    typeof expected.bootId!=='string'||!UUID.test(expected.bootId)||
    typeof expected.startTicks!=='string'||!TICKS.test(expected.startTicks)||
    typeof expected.executableLink!=='string'||
    !expected.executableLink.startsWith('/')||
    expected.executableLink.length>LINK_LIMIT||
    /[\x00-\x1f\x7f]/.test(expected.executableLink)||
    typeof readFile!=='function'||typeof readLink!=='function')
    throw Error('Invalid read-only process identity input');

  const statPath='/proc/'+pid+'/stat';
  const exePath='/proc/'+pid+'/exe';
  const bootPath='/proc/sys/kernel/random/boot_id';
  let boot1,stat1,link1,stat2,link2,boot2;
  try{
    // Fixed, bounded target paths only. Reread identity before reporting to
    // reduce (not eliminate) PID reuse and executable replacement races.
    boot1=await readFile(bootPath);
    stat1=await readFile(statPath);
    link1=await readLink(exePath);
    stat2=await readFile(statPath);
    link2=await readLink(exePath);
    boot2=await readFile(bootPath);
  }catch{
    return result('HOLD',['PROCESS_IDENTITY_READ_UNAVAILABLE']);
  }
  if([boot1,boot2,stat1,stat2,link1,link2].some(x=>typeof x!=='string'))
    return result('HOLD',['PROCESS_IDENTITY_MALFORMED']);
  if(Buffer.byteLength(stat1,'utf8')>STAT_LIMIT||Buffer.byteLength(stat2,'utf8')>STAT_LIMIT||
    link1.length>LINK_LIMIT||link2.length>LINK_LIMIT||boot1.length>64||boot2.length>64)
    return result('HOLD',['PROCESS_IDENTITY_MALFORMED']);
  const a=parseStat(stat1,pid),b=parseStat(stat2,pid);
  const id1=boot1.trim(),id2=boot2.trim();
  if(!a||!b||!UUID.test(id1)||!UUID.test(id2)||
    !link1.startsWith('/')||!link2.startsWith('/')||
    /[\x00-\x1f\x7f]/.test(link1+link2))
    return result('HOLD',['PROCESS_IDENTITY_MALFORMED']);
  const issues=[];
  if(id1!==id2||a.startTicks!==b.startTicks||a.state!==b.state||link1!==link2)
    issues.push('PROCESS_CHANGED_DURING_INSPECTION');
  if(id1!==expected.bootId)issues.push('BOOT_ID_MISMATCH');
  if(a.startTicks!==expected.startTicks||b.startTicks!==expected.startTicks)
    issues.push('START_IDENTITY_MISMATCH');
  if(link1!==expected.executableLink||link2!==expected.executableLink)
    issues.push('EXECUTABLE_LINK_MISMATCH');
  if(['Z','X','x'].includes(a.state)||['Z','X','x'].includes(b.state))
    issues.push('PROCESS_NOT_LIVE');
  if(link1.endsWith(' (deleted)')||link2.endsWith(' (deleted)'))
    issues.push('EXECUTABLE_LINK_DELETED');
  return result(issues.length?'HOLD':'REVIEWABLE',issues);
}
