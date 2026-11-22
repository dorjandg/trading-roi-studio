import {validateChange,applyChangeToCopy} from "./write-guards.js";

// Produces a complete, revision-checked snapshot body compatible with the
// existing Finance Hub PUT ?resource=snapshot contract. NO network requests.
const required=["transactions","propAccounts","propEvents","propAudit","subscriptions","invoices"];
export function prepareExistingSave(snapshot,args) {
  if(!snapshot?.data||snapshot.data.format!=="finance-hub-backup"||
     snapshot.data.version!==2||!required.every(k=>Array.isArray(snapshot.data[k])))
    return {ok:false,code:"UNSUPPORTED_SNAPSHOT"};
  const change=validateChange(snapshot,args);
  if(!change.ok)return change;
  const next=applyChangeToCopy(snapshot,change);
  const oldRecords=snapshot.data.transactions;
  const newRecords=next.data.transactions;
  if(oldRecords.length!==newRecords.length)return {ok:false,code:"INTEGRITY_ERROR"};
  for(let i=0;i<oldRecords.length;i++){
    const a=oldRecords[i],b=newRecords[i];
    if(a.id!==b.id)return {ok:false,code:"INTEGRITY_ERROR"};
    const expected={...a};
    if(a.id===change.transaction_id)expected[change.field]=change.after;
    if(JSON.stringify(expected)!==JSON.stringify(b))return {ok:false,code:"INTEGRITY_ERROR"};
  }
  for(const key of required.filter(k=>k!=="transactions"))
    if(JSON.stringify(snapshot.data[key])!==JSON.stringify(next.data[key]))
      return {ok:false,code:"INTEGRITY_ERROR"};
  const body={expectedRevision:snapshot.revision,data:next.data};
  const bytes=new TextEncoder().encode(JSON.stringify(body)).byteLength;
  if(bytes>1024*1024)return {ok:false,code:"SNAPSHOT_TOO_LARGE"};
  return {ok:true,body,change,bytes,notice:"Prepared only; no request was sent and no record was saved."};
}
