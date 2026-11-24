// Development-only local checkpoint storage. No source authentication, private
// keys, credentials, browser, network or production integration. The caller owns
// a private directory and supplies an independent rollback floor on recovery.
// Replacing this database AND its external floor defeats local rollback checks.
import {DatabaseSync} from "node:sqlite";
import {createHash} from "node:crypto";
import {constants,openSync,closeSync,lstatSync,realpathSync,fsyncSync} from "node:fs";
import {dirname,isAbsolute,resolve} from "node:path";

const MAX_BYTES=128*1024,MAX_REVISION=Number.MAX_SAFE_INTEGER;
const TABLE="signing_key_checkpoint";
const SCHEMA=`CREATE TABLE signing_key_checkpoint (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 schema_version INTEGER NOT NULL CHECK(schema_version=1),
 store_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>=1 AND revision<=9007199254740991),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=131072)
) STRICT`;
const ownErrors=new WeakSet();
function failure(code,outcomeUnknown=false){
 const error=Object.assign(Error(code),{code,outcomeUnknown,retrySafe:false});
 ownErrors.add(error);return Object.freeze(error);
}
const normalized=(error,code)=>ownErrors.has(error)?error:failure(code);
const digest=payload=>createHash("sha256").update(payload,"utf8").digest("hex");
const revision=value=>Number.isSafeInteger(value)&&value>=1;
const sha=value=>typeof value==="string"&&/^[a-f0-9]{64}$/.test(value);
function data(value,required,allowed=required){
 try{
  if(value===null||typeof value!=="object"||Array.isArray(value))throw Error();
  const prototype=Object.getPrototypeOf(value);
  if(prototype!==Object.prototype&&prototype!==null)throw Error();
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
  if(required.some(key=>!Object.hasOwn(descriptors,key))||keys.some(key=>
    typeof key!=="string"||!allowed.includes(key)||!descriptors[key].enumerable||
    !Object.hasOwn(descriptors[key],"value")))throw Error();
  return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
 }catch{throw failure("STATE_INVALID_ARGUMENT");}
}
function payloadValue(value){
 if(typeof value!=="string"||value.length>MAX_BYTES||Buffer.byteLength(value,"utf8")>MAX_BYTES||
   Buffer.from(value,"utf8").toString("utf8")!==value)throw failure("STATE_INVALID_ARGUMENT");
 // Opaque canonical bytes: serialization and key lifecycle validation belong
 // to the trusted owner, not this storage adapter.
 return value;
}
function floorValue(value){
 const floor=data(value,["revision","sha256"]);
 if(!revision(floor.revision)||!sha(floor.sha256))throw failure("STATE_INVALID_ARGUMENT");
 return Object.freeze(floor);
}
function statOrMissing(path){
 try{return lstatSync(path);}catch(error){
  if(error?.code==="ENOENT")return null;
  throw failure("STATE_PATH_UNAVAILABLE");
 }
}
function privateDirectory(path,uid){
 const parent=dirname(path);
 try{
  if(realpathSync(parent)!==parent)throw failure("STATE_PATH_DENIED");
  const direct=lstatSync(parent);
  if(!direct.isDirectory()||direct.uid!==uid||(direct.mode&0o077)!==0)
   throw failure("STATE_PATH_DENIED");
  // A private child is insufficient beneath an untrusted writable ancestor.
  // Root/caller-owned sticky directories (e.g. /tmp) protect owned children.
  for(let current=parent;;current=dirname(current)){
   const entry=lstatSync(current);
   if(!entry.isDirectory()||![0,uid].includes(entry.uid)||
     (entry.mode&0o022)!==0&&(entry.mode&0o1000)===0)throw failure("STATE_PATH_DENIED");
   if(dirname(current)===current)break;
  }
  return direct;
 }catch(error){throw normalized(error,"STATE_PATH_UNAVAILABLE");}
}
function privateFile(path,uid,{missing=false}={}){
 const entry=statOrMissing(path);
 if(!entry){if(missing)return null;throw failure("STATE_MISSING");}
 if(!entry.isFile()||entry.uid!==uid||(entry.mode&0o077)!==0||entry.nlink!==1)
  throw failure("STATE_PATH_DENIED");
 return entry;
}
function sidecars(path,uid,creating=false){
 for(const suffix of ["-wal","-shm","-journal"]){
  const entry=privateFile(path+suffix,uid,{missing:true});
  if(creating&&entry)throw failure("STATE_PATH_DENIED");
 }
}
function syncDirectory(path){
 let fd;
 try{fd=openSync(dirname(path),constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);fsyncSync(fd);}
 finally{if(fd!==undefined)closeSync(fd);}
}
function validateStored(db,storeId,floor){
 const schema=db.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' ORDER BY name").all();
 if(schema.length!==1||schema[0].type!=="table"||schema[0].name!==TABLE||schema[0].sql!==SCHEMA)
  throw failure("STATE_SCHEMA_INVALID");
 // Bound bytes returned by SQLite even if a damaged/externally edited row
 // bypassed its CHECK constraint. Do not normalize malformed UTF-8 silently.
 const rows=db.prepare("SELECT singleton,schema_version,store_id,revision,sha256,CASE WHEN length(CAST(payload AS BLOB))=0 THEN zeroblob(0) ELSE substr(CAST(payload AS BLOB),1,131073) END AS payload_bytes FROM signing_key_checkpoint LIMIT 2").all();
 if(rows.length===0)throw failure("STATE_MISSING");
 if(rows.length!==1)throw failure("STATE_CONTENT_INVALID");
 const row=rows[0];
 if(row.singleton!==1||row.schema_version!==1||!revision(row.revision)||!sha(row.sha256))
  throw failure("STATE_CONTENT_INVALID");
 if(row.store_id!==storeId)throw failure("STATE_STORE_MISMATCH");
 let payload;
 try{
  if(!(row.payload_bytes instanceof Uint8Array)||row.payload_bytes.length>MAX_BYTES)throw Error();
  payload=payloadValue(new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(row.payload_bytes));
 }catch{throw failure("STATE_CONTENT_INVALID");}
 if(digest(payload)!==row.sha256)throw failure("STATE_CONTENT_INVALID");
 if(row.revision<floor.revision||row.revision===floor.revision&&row.sha256!==floor.sha256)
  throw failure("STATE_ROLLBACK_DETECTED");
 return Object.freeze({storeId,revision:row.revision,sha256:row.sha256,payload});
}

/**
 * Synchronous local CAS. Never use an existing live database or untrusted path.
 * Open requires an externally retained floor and never initializes missing state.
 * testOnlyFaultAt is captured once and affects CAS only, not initial creation.
 */
export function createSigningKeyCheckpointStore(filename,options){
 const config=data(options,["mode","storeId"],["mode","storeId","floor","initialPayload","testOnlyFaultAt"]);
 const {mode,storeId,testOnlyFaultAt=null}=config;
 if(!["create","open"].includes(mode)||typeof storeId!=="string"||
   !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(storeId)||
   ![null,"beforeCommit","afterCommit"].includes(testOnlyFaultAt)||
   typeof filename!=="string"||filename.length>4096||filename.includes("\0")||
   !isAbsolute(filename)||resolve(filename)!==filename||!filename.endsWith(".sqlite")||
   typeof process.getuid!=="function")throw failure("STATE_INVALID_ARGUMENT");
 let initialPayload,initialFloor;
 if(mode==="create"){
  initialPayload=payloadValue(config.initialPayload);
  initialFloor=Object.freeze({revision:1,sha256:digest(initialPayload)});
  if(config.floor!==undefined){
   const supplied=data(config.floor,["revision","sha256"]);
   const bootstrap=supplied.revision===0&&supplied.sha256===null;
   if(!bootstrap&&(supplied.revision!==1||supplied.sha256!==initialFloor.sha256))
    throw failure("STATE_INVALID_ARGUMENT");
  }
 }else{
  if(Object.hasOwn(config,"initialPayload"))throw failure("STATE_INVALID_ARGUMENT");
  initialFloor=floorValue(config.floor);
 }
 const uid=process.getuid(),parent=privateDirectory(filename,uid);
 sidecars(filename,uid,mode==="create");
 if(mode==="create"){
  let fd;
  try{
   fd=openSync(filename,constants.O_RDWR|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
   fsyncSync(fd);
  }catch(error){
   if(error?.code==="EEXIST")throw failure("STATE_ALREADY_EXISTS");
   throw normalized(error,"STATE_PATH_UNAVAILABLE");
  }finally{if(fd!==undefined)try{closeSync(fd);}catch{throw failure("STATE_PATH_UNAVAILABLE");}}
  // A failed initialization remains quarantined. Never delete/reinitialize it.
  try{syncDirectory(filename);}catch{throw failure("STATE_WRITE_OUTCOME_UNKNOWN",true);}
 }
 const file=privateFile(filename,uid);
 let db,closed=false,writePoisoned=false,active=false,minimum=initialFloor,initialCommitAttempted=false;
 const identity=()=>{
  const currentParent=privateDirectory(filename,uid),current=privateFile(filename,uid);
  if(currentParent.dev!==parent.dev||currentParent.ino!==parent.ino||
    current.dev!==file.dev||current.ino!==file.ino)throw failure("STATE_PATH_CHANGED");
  sidecars(filename,uid);
 };
 const acknowledge=receipt=>{minimum=Object.freeze({revision:receipt.revision,sha256:receipt.sha256});return receipt;};
 const configure=connection=>{
  connection.exec("PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=100;");
  if(connection.prepare("PRAGMA busy_timeout").get().timeout!==100||
    connection.prepare("PRAGMA trusted_schema").get().trusted_schema!==0)
   throw failure("STATE_STORAGE_POLICY_UNAVAILABLE");
 };
 try{
  if(mode==="open"){
   // The probe cannot create a missing database. Recheck identity before the
   // writable open; concurrent hostile replacement by the directory owner is
   // outside this local-store contract and requires an external ownership fence.
   let probe;
   try{probe=new DatabaseSync(filename,{readOnly:true,allowExtension:false});configure(probe);validateStored(probe,storeId,minimum);}
   finally{if(probe)probe.close();}
   identity();
  }
  db=new DatabaseSync(filename,{allowExtension:false});configure(db);
  identity();
  if(mode==="open")validateStored(db,storeId,minimum);
  const journal=db.prepare("PRAGMA journal_mode=WAL").get();
  db.exec("PRAGMA synchronous=FULL;");
  if(journal.journal_mode!=="wal"||db.prepare("PRAGMA synchronous").get().synchronous!==2)
   throw failure("STATE_STORAGE_POLICY_UNAVAILABLE");
  if(mode==="create"){
   let transaction=false,commitAttempted=false;
   try{
    db.exec("BEGIN IMMEDIATE");transaction=true;
    db.exec(SCHEMA);
    db.prepare("INSERT INTO signing_key_checkpoint(singleton,schema_version,store_id,revision,sha256,payload) VALUES(1,1,?,1,?,?)")
     .run(storeId,initialFloor.sha256,initialPayload);
    initialCommitAttempted=true;commitAttempted=true;db.exec("COMMIT");transaction=false;
    syncDirectory(filename);
   }catch(error){
    let rollbackFailed=false;
    if(transaction)try{db.exec("ROLLBACK");}catch{rollbackFailed=true;}
    if(commitAttempted||rollbackFailed)throw failure("STATE_WRITE_OUTCOME_UNKNOWN",true);
    throw normalized(error,"STATE_WRITE_FAILED");
   }
  }
  acknowledge(validateStored(db,storeId,minimum));
 }catch(error){
  if(db)try{db.close();}catch{}
  if(initialCommitAttempted)throw failure("STATE_WRITE_OUTCOME_UNKNOWN",true);
  throw normalized(error,"STATE_STORAGE_UNAVAILABLE");
 }
 function guard(){
  if(closed)throw failure("STATE_CLOSED");
  if(active)throw failure("STATE_OPERATION_IN_PROGRESS");
 }
 function read(){
  guard();
  try{identity();return acknowledge(validateStored(db,storeId,minimum));}
  catch(error){throw normalized(error,"STATE_STORAGE_UNAVAILABLE");}
 }
 function compareAndSwap(input){
  guard();
  if(writePoisoned)throw failure("STATE_WRITE_OUTCOME_UNKNOWN",true);
  const request=data(input,["expectedRevision","expectedSha256","payload"]);
  if(!revision(request.expectedRevision)||!sha(request.expectedSha256))throw failure("STATE_INVALID_ARGUMENT");
  const payload=payloadValue(request.payload),sha256=digest(payload);
  let transaction=false,commitAttempted=false;
  active=true;
  try{
   identity();db.exec("BEGIN IMMEDIATE");transaction=true;
   const current=validateStored(db,storeId,minimum);
   if(current.revision!==request.expectedRevision||current.sha256!==request.expectedSha256)
    throw failure("STATE_CAS_CONFLICT");
   if(current.revision===MAX_REVISION)throw failure("STATE_REVISION_EXHAUSTED");
   const nextRevision=current.revision+1;
   const update=db.prepare("UPDATE signing_key_checkpoint SET revision=?,sha256=?,payload=? WHERE singleton=1 AND revision=? AND sha256=?")
    .run(nextRevision,sha256,payload,current.revision,current.sha256);
   if(update.changes!==1)throw failure("STATE_CAS_CONFLICT");
   if(testOnlyFaultAt==="beforeCommit")throw failure("STATE_WRITE_FAILED");
   commitAttempted=true;db.exec("COMMIT");transaction=false;
   if(testOnlyFaultAt==="afterCommit")throw failure("STATE_WRITE_OUTCOME_UNKNOWN",true);
   const receipt=validateStored(db,storeId,minimum);
   if(receipt.revision!==nextRevision||receipt.sha256!==sha256||receipt.payload!==payload)
    throw failure("STATE_WRITE_OUTCOME_UNKNOWN",true);
   return acknowledge(receipt);
  }catch(error){
   let rollbackFailed=false;
   if(transaction)try{db.exec("ROLLBACK");}catch{rollbackFailed=true;}
   if(commitAttempted||rollbackFailed){
    writePoisoned=true;throw failure("STATE_WRITE_OUTCOME_UNKNOWN",true);
   }
   throw normalized(error,"STATE_WRITE_FAILED");
  }finally{active=false;}
 }
 function close(){
  if(closed)return;
  if(active)throw failure("STATE_OPERATION_IN_PROGRESS");
  closed=true;
  try{db.close();}catch{throw failure("STATE_STORAGE_UNAVAILABLE");}
 }
 return Object.freeze({read,compareAndSwap,close});
}
