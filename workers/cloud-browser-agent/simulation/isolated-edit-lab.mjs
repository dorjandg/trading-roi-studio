/**
 * Stage 4.4: disposable in-memory edit simulator for tests ONLY.
 * NOT imported by any deployed Worker or MCP gateway.
 * No network, real browser, Cloudflare D1, production URL or external side effects.
 */
const hashPattern=/^[0-9a-f]{64}$/;
const noncePattern=/^[a-z0-9-]{8,80}$/i;
const hash=async value=>{
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
 return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("");
};
const fail=(code)=>{throw Object.assign(new Error(code),{code});};
const frozenCopy=value=>structuredClone(value);
export class IsolatedEditLab {
 #fields=new Map();#plans=new Map();#journal=[];#approvals=new Map();#now;#disabled=false;
 constructor({now=()=>Date.now()}={}){this.#now=now;}
 seed(fieldId,value){
   if(typeof fieldId!=="string"||!/^fixture:[a-z0-9_-]{1,64}$/.test(fieldId))fail("INVALID_FIXTURE");
   if(this.#fields.has(fieldId)||typeof value!=="string"||value.length>1200)fail("INVALID_SEED");
   this.#fields.set(fieldId,{value,revision:1});
 }
 disableWrites(){this.#disabled=true;}
 inspect(fieldId){const f=this.#fields.get(fieldId);if(!f)fail("UNKNOWN_FIXTURE");return frozenCopy(f);}
 events(){return frozenCopy(this.#journal);}
 async #event(kind,id,meta={}){
   const previous=this.#journal.at(-1)?.eventHash||"0".repeat(64);
   const event={index:this.#journal.length+1,kind,proposalId:id,previousHash:previous,...meta};
   const eventHash=await hash(JSON.stringify(event));
   this.#journal.push({...event,eventHash});
 }
 async propose({fieldId,nextValue,creatorId,ttlMs=60000}){
   if(this.#disabled)fail("KILL_SWITCH");
   if(!this.#fields.has(fieldId)||typeof nextValue!=="string"||nextValue.length===0||nextValue.length>1200)fail("INVALID_CHANGE");
   if(typeof creatorId!=="string"||!noncePattern.test(creatorId))fail("INVALID_ACTOR");
   if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>300000)fail("INVALID_TTL");
   const previous=this.#fields.get(fieldId);
   const digest=await hash(nextValue);
   const id=await hash(JSON.stringify({fieldId,digest,baseRevision:previous.revision,creatorId,createdAt:this.#now(),sequence:this.#plans.size+1}));
   this.#plans.set(id,{id,fieldId,digest,nextValue,baseRevision:previous.revision,creatorId,expiresAt:this.#now()+ttlMs,status:"PENDING"});
   await this.#event("PROPOSED",id,{fieldId,baseRevision:previous.revision,digest});
   return {proposalId:id,fieldId,baseRevision:previous.revision,digest,expiresAt:this.#plans.get(id).expiresAt,status:"PENDING"};
 }
 async approve({proposalId,approverId,digest}){
   if(this.#disabled)fail("KILL_SWITCH");
   const p=this.#plans.get(proposalId);
   if(!p||p.status!=="PENDING")fail("NOT_PENDING");
   if(this.#now()>=p.expiresAt)fail("EXPIRED");
   if(typeof approverId!=="string"||!noncePattern.test(approverId)||approverId===p.creatorId)fail("SEPARATION_OF_DUTIES");
   if(!hashPattern.test(digest)||digest!==p.digest)fail("DIGEST_MISMATCH");
   p.status="APPROVED";p.approverId=approverId;
   this.#approvals.set(proposalId,{approverId,digest,unused:true});
   await this.#event("APPROVED",proposalId,{approverId,digest});
   return {proposalId,status:"APPROVED",executionAllowed:true,simulationOnly:true};
 }
 async execute({proposalId,digest,requestId,expectedRevision}){
   if(this.#disabled)fail("KILL_SWITCH");
   const p=this.#plans.get(proposalId),grant=this.#approvals.get(proposalId);
   if(!p||p.status!=="APPROVED"||!grant?.unused)fail("APPROVAL_REQUIRED_OR_USED");
   if(this.#now()>=p.expiresAt)fail("EXPIRED");
   if(typeof requestId!=="string"||!noncePattern.test(requestId))fail("INVALID_REQUEST");
   if(digest!==p.digest||digest!==grant.digest)fail("DIGEST_MISMATCH");
   const f=this.#fields.get(p.fieldId);
   if(!f||f.revision!==p.baseRevision||f.revision!==expectedRevision)fail("STALE_REVISION");
   const before=f.value;
   // In-memory journal first. A real implementation must use atomic persisted state transitions.
   await this.#event("EXECUTED",proposalId,{requestId,revisionBefore:f.revision,revisionAfter:f.revision+1,digest});
   f.value=p.nextValue;f.revision++;grant.unused=false;p.status="EXECUTED";p.before=before;p.afterRevision=f.revision;
   return {status:"EXECUTED",proposalId,revision:f.revision,simulationOnly:true};
 }
 async rollback({proposalId,actorId,expectedRevision}){
   if(this.#disabled)fail("KILL_SWITCH");
   const p=this.#plans.get(proposalId);
   if(!p||p.status!=="EXECUTED"||typeof actorId!=="string"||!noncePattern.test(actorId))fail("ROLLBACK_DENIED");
   const f=this.#fields.get(p.fieldId);
   if(f.revision!==expectedRevision||f.revision!==p.afterRevision)fail("STALE_REVISION");
   await this.#event("ROLLED_BACK",proposalId,{actorId,revisionBefore:f.revision,revisionAfter:f.revision+1});
   f.value=p.before;f.revision++;p.status="ROLLED_BACK";
   return {status:"ROLLED_BACK",revision:f.revision,simulationOnly:true};
 }
 async verifyJournal(){
   let prev="0".repeat(64);
   for(let i=0;i<this.#journal.length;i++){
     const {eventHash,...evt}=this.#journal[i];
     if(evt.index!==i+1||evt.previousHash!==prev||await hash(JSON.stringify(evt))!==eventHash)return false;
     prev=eventHash;
   }
   return true;
 }
}
