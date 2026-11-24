import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CHILD_ENV} from '../simulation/omnipilot-native-child.mjs';

// A real Node subprocess receives only these owned synthetic environment
// values. No browser, namespace, listener, profile or inherited host env runs.
const modulePath=fileURLToPath(new URL('../simulation/omnipilot-native-child.mjs',import.meta.url));
const fixture=String.raw`
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {CHILD_ENV,snapshotNativeChildEnvironment,checkChildEnvironment}=await import(pathToFileURL(process.argv[2]));
const namespaces=Object.fromEntries(['user','pid','mnt','net','ipc','uts','time'].map((name,i)=>[name,name+':['+(100+i)+']']));
const interfaces={lo:[{address:'127.0.0.1',internal:true}]};
const exotic=Object.getPrototypeOf(process.env)!==Object.prototype&&Object.getPrototypeOf(process.env)!==null;
assert.equal(exotic,true);
const mode=process.argv[3];
if(mode==='clean'){
  // The ordinary record validator continues to reject the original exotic
  // object. The owned boundary supplies an immutable data snapshot instead.
  assert.throws(()=>checkChildEnvironment(process.env,interfaces,namespaces),{message:'NATIVE_PROTOCOL_INVALID'});
  const snapshot=snapshotNativeChildEnvironment();
  assert.equal(Object.getPrototypeOf(snapshot),null);assert.equal(Object.isFrozen(snapshot),true);
  checkChildEnvironment(snapshot,interfaces,namespaces);
  process.env.HOME='/owned-later-change';assert.equal(snapshot.HOME,CHILD_ENV.HOME);
  assert.throws(()=>{snapshot.HOME='/owned-mutation';},TypeError);
  process.stdout.write(JSON.stringify({exotic:true,snapshotAccepted:true,frozen:true,originalValidatorPreserved:true})+'\n');
}else if(mode==='unknown'||mode==='missing'){
  const original=Object.getOwnPropertyDescriptor;let valueReads=0;
  Object.getOwnPropertyDescriptor=function(target,key){if(target===process.env)valueReads++;return original(target,key);};
  try{assert.throws(()=>snapshotNativeChildEnvironment(),{message:'NATIVE_ENVIRONMENT_REFUSED'});assert.equal(valueReads,0);}
  finally{Object.getOwnPropertyDescriptor=original;}
  process.stdout.write(JSON.stringify({rejected:true,allowedValueReads:valueReads})+'\n');
}else if(mode==='wrong'){
  const snapshot=snapshotNativeChildEnvironment();
  assert.throws(()=>checkChildEnvironment(snapshot,interfaces,namespaces),{message:'NATIVE_ENVIRONMENT_REFUSED'});
  process.stdout.write(JSON.stringify({rejected:true,exactValueCheckPreserved:true})+'\n');
}else throw Error('Unknown owned fixture');
`;
function run(mode,env){
  // argv[1] deliberately is not modulePath, so importing the module cannot be
  // mistaken for invoking its guarded namespace entrypoint.
  const output=execFileSync(process.execPath,['--input-type=module','-e',fixture,'owned-env-regression',modulePath,mode],
    {env,timeout:3000,maxBuffer:8192,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  return JSON.parse(output);
}
test('real Node process.env is accepted only through the trusted immutable snapshot',()=>{
  assert.deepEqual(run('clean',{...CHILD_ENV,PWD:'/home/omnipilot'}),
    {exotic:true,snapshotAccepted:true,frozen:true,originalValidatorPreserved:true});
});
test('unexpected environment names fail before any environment value is read',()=>{
  assert.deepEqual(run('unknown',{...CHILD_ENV,OWNED_SYNTHETIC_MARKER:'not-a-real-secret'}),{rejected:true,allowedValueReads:0});
});
test('missing required environment names fail before any remaining value is read',()=>{
  const env={...CHILD_ENV};delete env.TMPDIR;
  assert.deepEqual(run('missing',env),{rejected:true,allowedValueReads:0});
});
test('snapshot conversion preserves exact expected-value and optional PWD checks',()=>{
  for(const env of [{...CHILD_ENV,HOME:'/owned-wrong-home'},{...CHILD_ENV,PWD:'/owned-wrong-cwd'}])
    assert.deepEqual(run('wrong',env),{rejected:true,exactValueCheckPreserved:true});
});
