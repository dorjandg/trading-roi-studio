// Stage 4.3: optional, isolated Cloudflare D1 storage for preview-only audit records.
// No user-entered values or proposed text are persisted. Never authorizes website writes.
const hex=buffer=>Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,"0")).join("");
async function sha256(s){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));}
const isHash=s=>typeof s==="string"&&/^[0-9a-f]{64}$/.test(s);
export function assertAuditDatabase(db){
  if(!db||typeof db.prepare!=="function"||typeof db.batch!=="function")throw Error("Isolated audit database not configured");
  return db;
}
export async function persistPreviewAudit(db,preview,receipt,now=new Date()){
  assertAuditDatabase(db);
  if(!preview||preview.previewOnly!==true||preview.executionAllowed!==false||
     preview.approvalState!=="NOT_REQUESTED"||preview.operation!=="set_text"||
     receipt?.approval?.canExecute!==false||receipt?.approval?.grantIssued!==false||
     !isHash(receipt?.proposalId)||!isHash(receipt?.audit?.proposedTextSha256)||
     receipt.audit.proposalId!==receipt.proposalId)throw Error("Unsafe audit receipt");
  const url=new URL(preview.url);
  if(url.protocol!=="https:"||url.search||url.username||url.password||
     !["text","textarea"].includes(preview.fieldType)||
     !Number.isSafeInteger(preview.formIndex)||preview.formIndex<1||preview.formIndex>12)
    throw Error("Invalid preview target");
  if(!Number.isFinite(now.getTime()))throw Error("Invalid timestamp");
  const eventId=await sha256("PREVIEW_RECORDED:"+receipt.proposalId);
  const expiresAt=new Date(now.getTime()+3600000).toISOString();
  // Enforce a single event per proposal. Duplicate retries never inflate the ledger.
  const statements=[
    db.prepare("INSERT OR IGNORE INTO edit_proposals (proposal_id,target_origin,target_path,operation,form_index,field_label,field_type,proposed_text_sha256,expires_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(receipt.proposalId,url.origin,url.pathname,"set_text",preview.formIndex,preview.fieldLabel,preview.fieldType,receipt.audit.proposedTextSha256,expiresAt),
    db.prepare("INSERT OR IGNORE INTO proposal_audit_events (event_id,proposal_id,event_type,payload_digest) VALUES (?,?,?,?)")
      .bind(eventId,receipt.proposalId,"PREVIEW_RECORDED",receipt.audit.proposedTextSha256)
  ];
  await db.batch(statements); // Cloudflare D1 batches statements atomically.
  const row=await db.prepare("SELECT proposal_id,target_origin,target_path,form_index,field_label,field_type,proposed_text_sha256,state FROM edit_proposals WHERE proposal_id = ?").bind(receipt.proposalId).first();
  if(!row || row.proposal_id!==receipt.proposalId||row.target_origin!==url.origin||row.target_path!==url.pathname||
     row.form_index!==preview.formIndex||row.field_label!==preview.fieldLabel||
     row.field_type!==preview.fieldType||row.proposed_text_sha256!==receipt.audit.proposedTextSha256||
     row.state!=="PREVIEW_ONLY")throw Error("Audit record verification failed");
  const event=await db.prepare("SELECT event_id,event_type,payload_digest FROM proposal_audit_events WHERE event_id = ?").bind(eventId).first();
  if(!event||event.event_id!==eventId||event.event_type!=="PREVIEW_RECORDED"||
     event.payload_digest!==receipt.audit.proposedTextSha256)throw Error("Audit event verification failed");
  return {
    proposalId:receipt.proposalId,
    approval:{state:"NOT_REQUESTED",required:true,grantIssued:false,canExecute:false},
    audit:{...receipt.audit,durable:true,storage:"ISOLATED_D1",delivery:"DATABASE_VERIFIED",eventId},
    persisted:true,executionAllowed:false
  };
}
