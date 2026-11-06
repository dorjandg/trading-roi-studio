/* Create a PRIVATE-to-PUBLIC content handoff only after explicit admin approval.
   Reads curated PUBLIC fields from the private D1 queue; NEVER publishes student questions,
   private research notes, IP hashes, or arbitrary generated answers.
   Opens a GitHub PR; never merges automatically. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const repo=process.env.GITHUB_REPOSITORY||'dorjandg/trading-roi-studio';
const branch=process.env.JJ_BASE_BRANCH||'jj-simon-knowledge-hub';
const token=process.env.GITHUB_TOKEN;
const endpoint=process.env.JJ_QUESTIONS_ENDPOINT;
const admin=process.env.JJ_REVIEW_TOKEN;
const enable=process.env.JJ_ENABLE_PUBLIC_PROPOSALS==='true';
const BLOB_PATH='jj-simon/approved-answers.js';

function getList(src){const m=src.match(/const jjApprovedAnswers=(\[[\s\S]*?\]);/);if(!m)throw Error('Approved-answer file shape changed');return JSON.parse(m[1])}
async function github(method,resource,body){
 const r=await fetch('https://api.github.com/repos/'+repo+resource,{
  method,headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','content-type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)
 });
 if(!r.ok)throw Error('GitHub '+method+' failed with status '+r.status);
 return r.json();
}
async function queue(url,method='GET',body){
 const r=await fetch(url,{
  method,headers:{authorization:'Bearer '+admin,'content-type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)
 });
 if(!r.ok)throw Error('Review queue '+method+' failed with status '+r.status);
 return r.json();
}
function validatedPublic(row,validEvidence){
 if(!row?.id?.match(/^uq_[a-f0-9]{22}$/))return null;
 const title=String(row.approved_public_title||'').trim();
 const answer=String(row.approved_public_answer||'').trim();
 let ids;try{ids=JSON.parse(row.approved_evidence_ids||'[]')}catch{return null}
 if(!title||!answer||title.length>180||answer.length>3500||!Array.isArray(ids)||!ids.length)return null;
 if(ids.some(id=>!validEvidence.has(id)))return null;
 // Simple defense-in-depth. A human must curate/approve PUBLIC text; no heuristic replaces review.
 const sensitive=/[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/\S+|\b(?:password|api[ -]?key|private[ -]?key|secret[ -]?token|account number)\b/i;
 if(sensitive.test(title+' '+answer))return null;
 return {id:'AQ-'+row.id.slice(3),title,answer,evidence_ids:ids,source:'admin_reviewed'};
}
async function main(){
 if(!enable){console.log('Publication proposal disabled. Set JJ_ENABLE_PUBLIC_PROPOSALS=true after reviewing public-release safeguards.');return}
 if(!endpoint?.startsWith('https://')||!admin||!token)throw Error('Required private endpoint/token and GitHub token missing');
 const evidenceSource=await readFile('jj-simon/source-evidence-data.js','utf8');
 const evidence=JSON.parse(evidenceSource.match(/const jjEvidenceRecords=(\[[\s\S]*?\]);/)[1]);
 const valid=new Set(evidence.map(x=>x.id));
 const rows=(await queue(endpoint+'?status=approved')).questions||[];
 const approved=rows.map(row=>({row,public:validatedPublic(row,valid)})).filter(x=>x.public&&!x.row.proposed_commit).slice(0,3);
 if(!approved.length){console.log('No approved, unpublished answers.');return}
 const safeBranch=branch.replace(/[^a-zA-Z0-9._/-]/g,'');
 const ref=await github('GET','/git/ref/heads/'+encodeURIComponent(safeBranch));
 const parent=ref.object.sha;
 const existingFile=await github('GET','/contents/'+BLOB_PATH+'?ref='+encodeURIComponent(branch));
 const current=getList(Buffer.from(existingFile.content.replace(/\s+/g,''),'base64').toString('utf8'));
 const additions=approved.filter(x=>!current.some(y=>y.id===x.public.id));
 if(!additions.length){console.log('Approved answers already included in catalog.');return}
 const updated=[...current,...additions.map(x=>x.public)];
 const newContents='/* Approved public research answers only. Source IDs point to Academy evidence. */\nconst jjApprovedAnswers='+JSON.stringify(updated)+';\n';
 const hash=createHash('sha256').update(additions.map(x=>x.row.id).join('|')).digest('hex').slice(0,12);
 const feature='jj-approved-answers-'+hash;
 await github('POST','/git/refs',{ref:'refs/heads/'+feature,sha:parent});
 const update=await github('PUT','/contents/'+BLOB_PATH,{
  branch:feature,sha:existingFile.sha,message:'Propose '+additions.length+' explicitly approved JJ Academy research answer(s)',
  content:Buffer.from(newContents,'utf8').toString('base64')
 });
 const pull=await github('POST','/pulls',{
  title:'JJ Academy: review '+additions.length+' approved answer addition(s)',
  head:feature,base:branch,
  body:'Admin-curated, explicitly approved public FAQ entries. No original student questions, private research notes, or IP data included. Validate evidence IDs, check course claims and privacy, and merge manually after review.'
 });
 for(const x of additions){
  await queue(endpoint,'PATCH',{
   id:x.row.id,status:'approved',
   research_notes:x.row.research_notes||'',
   proposed_commit:pull.html_url,
   approved_public_title:x.public.title,approved_public_answer:x.public.answer,approved_evidence_ids:x.public.evidence_ids
  });
 }
 console.log('Created an unmerged review PR; '+additions.length+' approved answer(s). URL: '+pull.html_url);
 if(!update.commit?.sha)throw Error('GitHub did not return commit');
}
if(process.argv[1]?.endsWith('propose-approved.mjs'))main().catch(e=>{console.error('PR proposal failed:',e.message);process.exitCode=1});
export {validatedPublic,getList};
