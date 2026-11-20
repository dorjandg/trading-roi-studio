'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(Boolean);
assert.match(html,/const accountingFingerprint=\(\)=>JSON\.stringify\(\[items,propAccounts,propEvents,propAudit,subscriptions,invoices\]\)/,'Cloud autosave ignores independently ingested Gmail evidence');
assert.match(html,/function sameAccountingAsSnapshot_\(data\)/,'Cloud reload compares actual accounting with owner snapshot');
assert.match(html,/hasSafeLocalBaseline\(snapshot\.data\)/,'Initial connection only falls back to verified snapshot data');
assert.ok(!html.includes('if(!hasSafeLocalBaseline()){'),'Initial sync must never omit authenticated snapshot data');
assert.match(html,/if\(snapshot\.data\)\{\s*if\(!hasSafeLocalBaseline\(snapshot\.data\)\)/,'Initial snapshot load passes data to baseline check rather than falsely pausing');
const sameAccounting=html.match(/function sameAccountingAsSnapshot_\(data\)\{[\s\S]*?\n \}(?=\n function hasSafeLocalBaseline)/);
assert.ok(sameAccounting,'Cloud reload exact accounting match verifier is present');
function compareAccounting(local,remote){
 const fields=['items','propAccounts','propEvents','propAudit','subscriptions','invoices'];
 const context={JSON,...local,isValid:b=>!!b&&fields.slice(1).every(k=>Array.isArray(b[k]))&&Array.isArray(b.transactions)};
 vm.createContext(context);vm.runInContext(sameAccounting[0]+';this.compare=sameAccountingAsSnapshot_;',context);
 return context.compare(remote);
}
const accountingFixture={items:[{id:'a1',amount:125}],propAccounts:[],propEvents:[],propAudit:[],subscriptions:[],invoices:[]};
const authenticatedSnapshot={transactions:[{id:'a1',amount:125}],propAccounts:[],propEvents:[],propAudit:[],subscriptions:[],invoices:[]};
assert.equal(compareAccounting(accountingFixture,authenticatedSnapshot),true,'Identical authenticated accounting safely reconnects after reload');
assert.equal(compareAccounting(accountingFixture,{...authenticatedSnapshot,transactions:[{id:'a1',amount:126}]}),false,'Changed financial transaction always blocks silent reload');
assert.equal(compareAccounting(accountingFixture,{...authenticatedSnapshot,invoices:[{id:'bill1'}]}),false,'Changed invoices always block silent reload');

assert.match(html,/safeAccountingMarker_\(currentMarker\.fingerprint\)/,'Legacy Gmail-inclusive sync markers are reconciled only when accounting unchanged');
assert.match(html,/id="gmailOverviewCard"/,'Financial overview displays a Gmail evidence review card');
assert.match(html,/id="gmailOverviewMetrics"/,'Financial overview includes an evidence KPI strip');
assert.match(html,/function renderGmailOverview_\(\)/,'Overview Gmail evidence KPIs render from imported records');
assert.match(html,/Possible related payments/,'Overview presents provisional reconciliation candidate count');
const candidateFunction=html.match(/function gmailPotentialMatches_\(rows\)\{[\s\S]*?\n\}(?=\nfunction renderGmailReconciliation_)/);
assert.ok(candidateFunction,'Gmail conservative reconciliation function is present');
const candidateContext={};vm.createContext(candidateContext);vm.runInContext(candidateFunction[0]+';this.reconcile=gmailPotentialMatches_;',candidateContext);
const reconciliationFixture=[
 {source_id:'gmail:topstep1',date:'2026-11-18',provider:'Topstep',description:'Payout approved',amount:'2000',currency:'USD',category:'Prop firms',status:'payout_approved'},
 {source_id:'gmail:bank1',date:'2026-11-19',provider:'Banking provider',description:'Transfer received',amount:'2000',currency:'USD',category:'Banking',status:'transfer_confirmed'},
 {source_id:'gmail:topstep2',date:'2026-10-01',provider:'Topstep',description:'Payout approved',amount:'2000',currency:'USD',category:'Prop firms',status:'payout_approved'},
 {source_id:'gmail:topstep3',date:'2026-11-19',provider:'Topstep',description:'Payment receipt',amount:'1800',currency:'USD',category:'Prop firms',status:'payment_confirmed'},
 {source_id:'gmail:bank2',date:'2026-11-19',provider:'Banking provider',description:'Transfer received',amount:'2000',currency:'EUR',category:'Banking',status:'transfer_confirmed'}
];
const candidates=candidateContext.reconcile(reconciliationFixture);
assert.equal(candidates.length,1,'Only the near-date cross-provider same-currency amount is a candidate');
assert.equal(candidates[0].first.source_id,'gmail:topstep1');
assert.equal(candidates[0].second.source_id,'gmail:bank1');
assert.ok(html.includes('Potentially related financial emails'),'Review-only Gmail reconciliation section visible');

assert.ok(scripts.length,'Finance Hub inline script exists');
for(const script of scripts)new vm.Script(script,{filename:'finance/index.html'});
const ids=new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map(x=>x[1]));
const references=[...html.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);
for(const ref of references)assert.ok(ids.has(ref),'Missing DOM element: '+ref);
const pages=[...html.matchAll(/id="page-([a-z]+)"/g)].map(x=>x[1]);
const navigation=[...html.matchAll(/data-page="([a-z]+)"/g)].map(x=>x[1]);
assert.equal(new Set(pages).size,pages.length,'Duplicate page ID');
assert.deepEqual(new Set(pages),new Set(navigation),'Navigation and pages must match');
const sum=(rows,type)=>rows.filter(x=>x.type===type).reduce((a,x)=>a+x.amount,0);
const sample=[{type:'Income',amount:2000,currency:'USD'},{type:'Expense',amount:450,currency:'USD'},{type:'Investment',amount:300,currency:'USD'}];
assert.equal(sum(sample,'Income')-sum(sample,'Expense'),1550,'Operating cash flow');
assert.equal(sum(sample,'Income')-sum(sample,'Expense')-sum(sample,'Investment'),1250,'Cash after investments');
const account={evaluationFee:50,activationFee:150,payout:750};
const fees=account.evaluationFee+account.activationFee;
assert.equal(account.payout-fees,550,'Net prop cash');
assert.equal((account.payout-fees)/fees*100,275,'Prop firm ROI');
const monthly=[{firm:'Topstep',date:'2026-09-01',payoutDate:'2026-10-15',evaluationFee:50,activationFee:150,payout:750}];
const octoberPayout=monthly.filter(x=>x.payoutDate.slice(0,7)==='2026-10').reduce((a,x)=>a+x.payout,0);
const septemberPayout=monthly.filter(x=>x.payoutDate.slice(0,7)==='2026-09').reduce((a,x)=>a+x.payout,0);
assert.equal(octoberPayout,750,'Payout assigned to receipt month');
assert.equal(septemberPayout,0,'Payout not assigned to purchase month');

// Accounting regression checks: fixtures for linked events and independent currencies.
const accountsFixture=[{id:'a',owner:'Dori',currency:'USD',evaluationFee:50,activationFee:150,payout:0}];
const eventsFixture=[{id:'e1',accountId:'a',kind:'payout',amount:750,date:'2026-10-15',linkedTransactionId:'t1'},{id:'e2',accountId:'a',kind:'reset',amount:25,date:'2026-10-16',linkedTransactionId:'t2'}];
const ledgerFixture=[{id:'t1',user:'Dori',type:'Income',amount:750,currency:'USD',date:'2026-10-15'},{id:'t2',user:'Dori',type:'Expense',amount:25,currency:'USD',date:'2026-10-16'},{id:'t3',user:'Dori',type:'Expense',amount:80,currency:'USD',date:'2026-10-16'},{id:'t4',user:'Dori',type:'Expense',amount:90,currency:'EUR',date:'2026-10-16'}];
const linked=new Set(eventsFixture.map(e=>e.linkedTransactionId));
const usdOther=ledgerFixture.filter(t=>t.currency==='USD'&&t.type==='Expense'&&!linked.has(t.id)).reduce((n,t)=>n+t.amount,0);
const usdLinked=ledgerFixture.filter(t=>t.currency==='USD'&&t.type==='Expense'&&linked.has(t.id)).reduce((n,t)=>n+t.amount,0);
assert.equal(usdOther,80,'Linked fee excluded from other ledger expenses');
assert.equal(usdLinked,25,'Linked fee appears in linked ledger metric');
assert.equal(usdOther+usdLinked,105,'Ledger expense partition preserves totals');
assert.equal(ledgerFixture.filter(t=>t.currency==='EUR').reduce((n,t)=>n+t.amount,0),90,'EUR stays separate from USD');
const cashFees=accountsFixture[0].evaluationFee+accountsFixture[0].activationFee+eventsFixture.filter(e=>e.kind!=='payout').reduce((n,e)=>n+e.amount,0);
assert.equal(cashFees,225,'Account fees plus dated fee events');
assert.equal(750-cashFees,525,'Net prop cash after dated reset fee');
assert.equal(eventsFixture.filter(e=>e.kind==='payout').reduce((n,e)=>n+e.amount,0),750,'Linked payout is not added twice to prop cash');
const backup={format:'finance-hub-backup',version:2,transactions:ledgerFixture,propAccounts:accountsFixture,propEvents:eventsFixture,propAudit:[{id:'audit-1',eventId:'e1',action:'status changed'}],subscriptions:[],invoices:[]};
const restored=JSON.parse(JSON.stringify(backup));
assert.deepEqual(restored.propEvents,eventsFixture,'Backup round trip preserves event links');
assert.deepEqual(restored.propAudit,backup.propAudit,'Backup round trip preserves audit history');
assert.ok(html.includes("const linkedIds=new Set(propEvents.filter("),'Linked expense reporting remains present');
assert.ok(html.includes("linkedTransactionId"),'Cash event transaction links remain present');
assert.ok(html.includes("propAudit=b.version===2"),'Backup restore includes audit history');
assert.ok(html.includes("/^\\d{4}-\\d{2}-\\d{2}$/"),'Cash event ISO date validation remains correct');

const apiSource=fs.readFileSync(require('node:path').join(__dirname,'..','functions','api','finance.js'),'utf8');
assert.match(apiSource,/WHERE a\.workspace_id=\? AND a\.owner_user_id=\? ORDER BY a\.created_at DESC LIMIT 500/,'Connection listing must always be owner-scoped');
assert.match(apiSource,/WHERE workspace_id=\? AND user_id=\? ORDER BY occurred_on DESC LIMIT 1000/,'Transaction listing must always be user-scoped');
assert.doesNotMatch(apiSource,/\(\? IN \('owner','admin'\) OR (?:a\.owner_user_id|user_id)=\?\)/,'No administrative financial-data bypass');

assert.ok(html.includes('id="finance-mobile-compact-2026"'),'Mobile compact stylesheet present');
assert.ok(html.includes('.grid#stats{grid-template-columns:repeat(2,minmax(0,1fr))}'),'Two-column small-screen dashboard present');
assert.ok(html.includes('table{width:100%;min-width:max-content}'),'Wide financial tables remain horizontally scrollable');
assert.ok(html.includes('.form{grid-template-columns:minmax(0,1fr)}'),'Narrow-screen form fields stack');
assert.ok(html.includes('id="ftmoCashPanel"'),'FTMO expenses and payouts summary exists');
assert.ok(html.includes('id="ftmoCashSummary"'),'FTMO cash summary widget exists');
assert.ok(html.includes('id="ftmoGoAccounts"'),'FTMO records link exists');
assert.ok(html.includes('ftmo-cash-summary'),'FTMO summary uses existing financial records');
assert.ok(!html.includes('ftmoHistoryFile'),'FTMO trade history importer removed');
assert.ok(!html.includes('ftmo-read-only-history'),'FTMO trade analysis script removed');
assert.ok(html.includes('Automatic FTMO billing/payout retrieval is'),'No false automatic payout-sync claim');
assert.ok(html.includes('id="ftmoReceiptReview"'),'FTMO Gmail review queue exists');
assert.ok(html.includes('id="ftmoReceiptFile"'),'FTMO receipt CSV file input exists');
assert.ok(html.includes('id="ftmoReceiptRows"'),'FTMO review rows exist');
assert.ok(html.includes('id="ftmo-gmail-receipt-review"'),'FTMO receipt review logic present');
assert.ok(html.includes('Nothing has been saved.'),'FTMO receipts require human confirmation');
assert.ok(html.includes("r.currency+' requires conversion/reconciliation"),'Non-ledger currencies cannot be silently booked');
assert.ok(html.includes("x.reference===reference"),'Previously linked Gmail sources are detected');
assert.ok(html.includes("function safeAccountingMarker_(stored)"),'Existing per-user cloud snapshots have a safe fingerprint migration');
assert.ok(html.includes("currentMarker.userId===cloud.user.id&&safeAccountingMarker_(currentMarker.fingerprint)"),'Legacy snapshots only accepted for the authenticated account after checking accounting data');
assert.ok(html.includes("JSON.stringify(oldRows.slice(0,6))"),'Legacy Gmail evidence is excluded from fingerprint comparison without ignoring accounting changes');
assert.ok(html.includes('id="page-gmail"'),'Dedicated Gmail financial inbox page exists');
assert.ok(html.includes('data-page="gmail"'),'Gmail financial inbox navigation exists');
assert.ok(html.includes('id="gmailFinanceRegister"'),'Gmail financial inbox exists');
assert.ok(html.includes('id="gmailEvidenceFile"'),'Gmail review CSV input exists');
assert.ok(html.includes('id="gmailEvidenceRows"'),'Financial evidence table exists');
assert.ok(html.includes("const GMAIL_EVIDENCE_KEY='finance-hub-gmail-evidence-v1'"),'Gmail evidence stored separately from transactions');
assert.ok(html.includes("invoices,gmailEvidence}}$('cloudConnect')"),'Gmail evidence included in private cloud snapshot');
assert.ok(html.includes('Array.isArray(b.gmailEvidence)?b.gmailEvidence:[]'),'Older snapshots remain compatible');
assert.ok(html.includes('id="gmail-financial-evidence"'),'Financial evidence import script installed');
assert.ok(html.includes("old.has(rec.source_id)"),'Duplicate Gmail source references skipped');
assert.ok(html.includes("No accounting transactions were added."),'Gmail import does not auto-post cash movements');
assert.ok(html.includes('id="gmailEvidenceExport"'),'Gmail evidence data can be exported');
assert.ok(html.includes("[items,propAccounts,propEvents,propAudit,subscriptions,invoices,gmailEvidence]=[[],[],[],[],[],[],[]]"),'Gmail financial evidence cleared on account switch');
assert.ok(html.includes('Sign in to your verified Finance Hub cloud account before importing Gmail evidence.'),'Gmail import requires verified login');
assert.ok(html.includes('gmailEvidence=Array.isArray(b.gmailEvidence)?b.gmailEvidence:[]'),'Gmail evidence restores with signed-in cloud snapshot');
console.log('PASS Finance Hub: JavaScript syntax, DOM references, 16-page navigation, financial fixtures, linked fee partition, payout dates, backup round trip.');
