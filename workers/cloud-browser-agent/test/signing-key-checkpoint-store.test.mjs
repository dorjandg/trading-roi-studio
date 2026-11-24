// Disposable local databases only. No services, subprocesses, network or keys.
import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {createHash} from "node:crypto";
import {mkdtempSync,rmSync,existsSync,statSync,chmodSync,symlinkSync,linkSync,
 unlinkSync,writeFileSync,readFileSync,copyFileSync,mkdirSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createSigningKeyCheckpointStore} from "../simulation/signing-key-checkpoint-store.mjs";

// A CI checkout may have an untrusted writable ancestor. Use the OS sticky temp root.\nconst ROOT=tmpdir();
const STORE_ID="fixture-signing-checkpoint";
const PAYLOAD='{"clock":1,"keys":["public-fixture-a"],"revoked":[]}';
const NEXT='{"clock":2,"keys":["public-fixture-b"],"revoked":["public-fixture-a"]}';
const sha=value=>createHash("sha256").update(value,"utf8").digest("hex");
const floor=(revision=1,payload=PAYLOAD)=>({revision,sha256:sha(payload)});
const expected=(revision=1,payload=PAYLOAD)=>({storeId:STORE_ID,revision,sha256:sha(payload),payload});
const code=(wanted,unknown=false)=>error=>{
 assert.equal(error.code,wanted);assert.equal(error.message,wanted);
 assert.equal(error.outcomeUnknown,unknown);assert.equal(error.retrySafe,false);return true;
};
function fixture(t){
 const dir=mkdtempSync(join(ROOT,"checkpoint-fixture-")),filename=join(dir,"state.sqlite");
 const handles=[];
 t.after(()=>{for(const handle of handles)try{handle.close();}catch{}
  chmodSync(dir,0o700);rmSync(dir,{recursive:true,force:true});});
 const create=(options={})=>{
  const handle=createSigningKeyCheckpointStore(filename,{mode:"create",storeId:STORE_ID,
   floor:{revision:0,sha256:null},initialPayload:PAYLOAD,...options});
  handles.push(handle);return handle;
 };
 const open=(options={})=>{
  const handle=createSigningKeyCheckpointStore(filename,{mode:"open",storeId:STORE_ID,floor:floor(),...options});
  handles.push(handle);return handle;
 };
 return {dir,filename,create,open};
}
function mutate(filename,fn){
 const db=new DatabaseSync(filename);
 try{return fn(db);}finally{db.close();}
}
const cas=(store,revision,payload,oldPayload=PAYLOAD)=>store.compareAndSwap({
 expectedRevision:revision,expectedSha256:sha(oldPayload),payload
});

test("explicit creation and reopen preserve one complete frozen checkpoint",t=>{
 const f=fixture(t),store=f.create();
 const first=store.read();assert.deepEqual(first,expected());
 assert.equal(Object.isFrozen(first),true);assert.equal(Object.isFrozen(store),true);
 assert.equal(statSync(f.filename).mode&0o777,0o600);
 const second=cas(store,1,NEXT);assert.deepEqual(second,expected(2,NEXT));
 assert.equal(Object.isFrozen(second),true);store.close();
 const reopened=f.open({floor:floor(2,NEXT)});
 assert.deepEqual(reopened.read(),second);
});
test("two separately opened handles cannot both commit the same revision and digest",t=>{
 const f=fixture(t),first=f.create(),second=f.open();
 const old=second.read();const accepted=cas(first,old.revision,NEXT,old.payload);
 assert.throws(()=>cas(second,old.revision,'{"wrong":true}',old.payload),code("STATE_CAS_CONFLICT"));
 assert.deepEqual(second.read(),accepted);
 const final=cas(second,2,'{"clock":3}',NEXT);
 assert.deepEqual(first.read(),final);assert.equal(final.revision,3);
});
test("open never bootstraps a missing database, missing row or unrelated schema",t=>{
 const f=fixture(t);
 assert.throws(()=>f.open(),code("STATE_MISSING"));
 assert.equal(existsSync(f.filename),false);
 const store=f.create();store.close();
 mutate(f.filename,db=>db.exec("DELETE FROM signing_key_checkpoint"));
 assert.throws(()=>f.open(),code("STATE_MISSING"));
 assert.equal(mutate(f.filename,db=>db.prepare("SELECT COUNT(*) AS count FROM signing_key_checkpoint").get().count),0);
 mutate(f.filename,db=>db.exec("DROP TABLE signing_key_checkpoint; CREATE TABLE unrelated(value TEXT)"));
 assert.throws(()=>f.open(),code("STATE_SCHEMA_INVALID"));
 assert.equal(mutate(f.filename,db=>db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").get().name),"unrelated");
});
test("create refuses an existing path and open requires a trusted floor and store identity",t=>{
 const f=fixture(t),store=f.create();store.close();
 const before=readFileSync(f.filename);
 assert.throws(()=>f.create(),code("STATE_ALREADY_EXISTS"));
 assert.deepEqual(readFileSync(f.filename),before);
 assert.throws(()=>createSigningKeyCheckpointStore(f.filename,{mode:"open",storeId:STORE_ID}),code("STATE_INVALID_ARGUMENT"));
 assert.throws(()=>f.open({storeId:"other-store"}),code("STATE_STORE_MISMATCH"));
 assert.throws(()=>f.open({initialPayload:PAYLOAD}),code("STATE_INVALID_ARGUMENT"));
 assert.deepEqual(f.open().read(),expected());
});
test("recovery floor rejects an older complete database or a same-revision digest conflict",t=>{
 const f=fixture(t),store=f.create();store.close();
 const backup=join(f.dir,"old.sqlite");copyFileSync(f.filename,backup);
 const current=f.open();cas(current,1,NEXT);current.close();
 copyFileSync(backup,f.filename);
 assert.throws(()=>f.open({floor:floor(2,NEXT)}),code("STATE_ROLLBACK_DETECTED"));
 assert.throws(()=>f.open({floor:{revision:1,sha256:"0".repeat(64)}}),code("STATE_ROLLBACK_DETECTED"));
});
test("acknowledged reads advance the handle floor and detect a later rollback",t=>{
 const f=fixture(t),first=f.create(),second=f.open();
 cas(first,1,NEXT);assert.deepEqual(second.read(),expected(2,NEXT));
 mutate(f.filename,db=>db.prepare("UPDATE signing_key_checkpoint SET revision=1,sha256=?,payload=?").run(sha(PAYLOAD),PAYLOAD));
 assert.throws(()=>second.read(),code("STATE_ROLLBACK_DETECTED"));
 assert.throws(()=>cas(second,1,NEXT),code("STATE_ROLLBACK_DETECTED"));
 assert.throws(()=>first.read(),code("STATE_ROLLBACK_DETECTED"));
});
test("content, digest and schema corruption refuse reads and writes without resetting state",t=>{
 const f=fixture(t),store=f.create();
 mutate(f.filename,db=>db.prepare("UPDATE signing_key_checkpoint SET sha256=?").run("a".repeat(64)));
 assert.throws(()=>store.read(),code("STATE_CONTENT_INVALID"));
 assert.throws(()=>cas(store,1,NEXT),code("STATE_CONTENT_INVALID"));
 mutate(f.filename,db=>db.prepare("UPDATE signing_key_checkpoint SET sha256=?,payload=?").run(sha("tampered"),"tampered"));
 assert.throws(()=>store.read(),code("STATE_ROLLBACK_DETECTED"));
 mutate(f.filename,db=>db.exec("ALTER TABLE signing_key_checkpoint ADD COLUMN extra TEXT"));
 assert.throws(()=>store.read(),code("STATE_SCHEMA_INVALID"));
 store.close();assert.throws(()=>f.open(),code("STATE_SCHEMA_INVALID"));
});
test("truncated non-database bytes fail closed with a fixed sanitized error",t=>{
 const f=fixture(t);writeFileSync(f.filename,"PRIVATE_CORRUPT_CHECKPOINT",{mode:0o600});
 const before=readFileSync(f.filename);
 assert.throws(()=>f.open(),code("STATE_STORAGE_UNAVAILABLE"));
 assert.deepEqual(readFileSync(f.filename),before);
});
test("SQLite internal-prefix filtering never hides a user-defined sqliteX trigger",t=>{
 const f=fixture(t),store=f.create();
 mutate(f.filename,db=>db.exec("CREATE TRIGGER sqliteXextra AFTER UPDATE ON signing_key_checkpoint BEGIN SELECT 1; END"));
 assert.throws(()=>store.read(),code("STATE_SCHEMA_INVALID"));
 assert.throws(()=>cas(store,1,NEXT),code("STATE_SCHEMA_INVALID"));
 store.close();assert.throws(()=>f.open(),code("STATE_SCHEMA_INVALID"));
});
test("payloads retain exact UTF-8 bytes and the 128KiB limit is measured in bytes",t=>{
 const f=fixture(t),store=f.create({initialPayload:""});
 assert.deepEqual(store.read(),expected(1,""));
 const nul="\uFEFFopaque\0UTF-8 α";
 assert.deepEqual(cas(store,1,nul,""),expected(2,nul));
 const boundary="α".repeat(65536);
 assert.deepEqual(cas(store,2,boundary,nul),expected(3,boundary));
 assert.throws(()=>cas(store,3,boundary+"α",boundary),code("STATE_INVALID_ARGUMENT"));
 assert.throws(()=>cas(store,3,"\ud800",boundary),code("STATE_INVALID_ARGUMENT"));
 assert.deepEqual(store.read(),expected(3,boundary));
});
test("bootstrap floor is create-only and invalid or oversized inputs do not create a file",t=>{
 const f=fixture(t);
 assert.throws(()=>f.create({floor:{revision:0,sha256:"0".repeat(64)}}),code("STATE_INVALID_ARGUMENT"));
 assert.throws(()=>f.create({floor:{revision:1,sha256:"0".repeat(64)}}),code("STATE_INVALID_ARGUMENT"));
 assert.throws(()=>f.create({initialPayload:"a".repeat(131073)}),code("STATE_INVALID_ARGUMENT"));
 assert.throws(()=>f.open({floor:{revision:0,sha256:null}}),code("STATE_INVALID_ARGUMENT"));
 assert.equal(existsSync(f.filename),false);
 assert.deepEqual(f.create().read(),expected());
});
test("overlong or invalid UTF-8 stored bytes fail bounded decoding",t=>{
 const f=fixture(t),store=f.create();
 mutate(f.filename,db=>{
  db.exec("PRAGMA ignore_check_constraints=ON");
  db.prepare("UPDATE signing_key_checkpoint SET payload=?").run("a".repeat(131073));
 });
 assert.throws(()=>store.read(),code("STATE_CONTENT_INVALID"));
 mutate(f.filename,db=>db.exec("UPDATE signing_key_checkpoint SET payload=CAST(x'ff' AS TEXT)"));
 assert.throws(()=>store.read(),code("STATE_CONTENT_INVALID"));
});
test("unsafe revisions and exhaustion refuse mutation",t=>{
 const f=fixture(t),store=f.create();
 for(const value of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])
  assert.throws(()=>cas(store,value,NEXT),code("STATE_INVALID_ARGUMENT"));
 mutate(f.filename,db=>db.prepare("UPDATE signing_key_checkpoint SET revision=?").run(Number.MAX_SAFE_INTEGER));
 const before=store.read();
 assert.throws(()=>cas(store,Number.MAX_SAFE_INTEGER,NEXT),code("STATE_REVISION_EXHAUSTED"));
 assert.deepEqual(store.read(),before);
});
test("a before-COMMIT fault rolls back the complete write and preserves the old checkpoint",t=>{
 const f=fixture(t),initial=f.create();initial.close();
 const options={testOnlyFaultAt:"beforeCommit"},store=f.open(options);
 options.testOnlyFaultAt=null;
 assert.throws(()=>cas(store,1,NEXT),code("STATE_WRITE_FAILED"));
 assert.deepEqual(store.read(),expected());
 store.close();assert.deepEqual(f.open().read(),expected());
});
test("an after-COMMIT acknowledgment fault reports uncertainty and permanently poisons writes",t=>{
 const f=fixture(t),initial=f.create();initial.close();
 const store=f.open({testOnlyFaultAt:"afterCommit"});
 assert.throws(()=>cas(store,1,NEXT),code("STATE_WRITE_OUTCOME_UNKNOWN",true));
 assert.deepEqual(store.read(),expected(2,NEXT));
 assert.throws(()=>cas(store,2,'{"clock":3}',NEXT),code("STATE_WRITE_OUTCOME_UNKNOWN",true));
 assert.deepEqual(store.read(),expected(2,NEXT));store.close();
 assert.deepEqual(f.open({floor:floor(2,NEXT)}).read(),expected(2,NEXT));
});
test("paths must be private, owned and free of symlink or hardlink aliases",t=>{
 const f=fixture(t);
 chmodSync(f.dir,0o755);assert.throws(()=>f.create(),code("STATE_PATH_DENIED"));
 assert.equal(existsSync(f.filename),false);chmodSync(f.dir,0o700);
 const store=f.create();store.close();
 const alias=join(f.dir,"alias.sqlite");symlinkSync(f.filename,alias);
 assert.throws(()=>createSigningKeyCheckpointStore(alias,{mode:"open",storeId:STORE_ID,floor:floor()}),code("STATE_PATH_DENIED"));
 unlinkSync(alias);linkSync(f.filename,alias);
 assert.throws(()=>f.open(),code("STATE_PATH_DENIED"));unlinkSync(alias);
 chmodSync(f.filename,0o644);assert.throws(()=>f.open(),code("STATE_PATH_DENIED"));chmodSync(f.filename,0o600);
 const linkedParent=join(f.dir,"parent-alias");symlinkSync(f.dir,linkedParent);
 assert.throws(()=>createSigningKeyCheckpointStore(join(linkedParent,"state.sqlite"),{
  mode:"open",storeId:STORE_ID,floor:floor()}),code("STATE_PATH_DENIED"));
 assert.deepEqual(f.open().read(),expected());
});
test("an insecure writable ancestor or preexisting sidecar cannot authorize a new store",t=>{
 const f=fixture(t),unsafe=join(f.dir,"unsafe"),privateChild=join(unsafe,"private");
 mkdirSync(unsafe,{mode:0o777});chmodSync(unsafe,0o777);mkdirSync(privateChild,{mode:0o700});
 assert.throws(()=>createSigningKeyCheckpointStore(join(privateChild,"state.sqlite"),{
  mode:"create",storeId:STORE_ID,initialPayload:PAYLOAD}),code("STATE_PATH_DENIED"));
 writeFileSync(f.filename+"-wal","untrusted-sidecar",{mode:0o600});
 assert.throws(()=>f.create(),code("STATE_PATH_DENIED"));assert.equal(existsSync(f.filename),false);
});
test("handle identity rejects a replaced database path",t=>{
 const f=fixture(t),store=f.create(),old=store.read();
 // A same-owner test replacement is outside the storage trust boundary, but
 // this handle must still refuse to use an unlinked former database silently.
 unlinkSync(f.filename);writeFileSync(f.filename,"replacement",{mode:0o600});
 assert.throws(()=>store.read(),code("STATE_PATH_CHANGED"));
 assert.throws(()=>cas(store,old.revision,NEXT),code("STATE_PATH_CHANGED"));
});
test("plain input snapshots reject accessors and close remains permanent and idempotent",t=>{
 const f=fixture(t),store=f.create();let touched=0;
 assert.throws(()=>store.compareAndSwap({expectedRevision:1,expectedSha256:sha(PAYLOAD),
  get payload(){touched++;return NEXT;}}),code("STATE_INVALID_ARGUMENT"));
 assert.equal(touched,0);assert.deepEqual(store.read(),expected());
 store.close();store.close();
 assert.throws(()=>store.read(),code("STATE_CLOSED"));
 assert.throws(()=>cas(store,1,NEXT),code("STATE_CLOSED"));
});
