'use strict';
const {test,expect}=require('@playwright/test');
const url='http://127.0.0.1:8765/finance/';
test('Finance Hub renders navigation, saves a prop account and cash event',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/finance?resource=*',async route=>{
    const resource=new URL(route.request().url()).searchParams.get('resource');
    const data=resource==='me'?{user:{id:'smoke-owner-id',email:'smoke-owner@example.com'},role:'owner',workspace_id:'smoke-workspace'}:
      resource==='snapshot'?{revision:0,data:null}:
      resource==='snapshot-meta'?{revision:0,updated_at:null}:
      resource==='members'?{members:[{id:'smoke-owner-id',email:'smoke-owner@example.com',role:'owner'}]}:
      {error:'Unknown resource'};
    await route.fulfill({status:data.error?404:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(url);
  await expect(page.locator('#page-overview')).toBeVisible();
  await page.locator('[data-page="propaccounts"]').first().click();
  await expect(page.locator('#page-propaccounts')).toBeVisible();
  await page.locator('#propForm [name="label"]').fill('Smoke test 50K');
  await page.locator('#propForm [name="size"]').fill('50000');
  await page.locator('#propForm [name="date"]').fill('2026-10-15');
  await page.locator('#propForm button').click();
  await expect(page.locator('#propRows')).toContainText('Smoke test 50K');
  await page.locator('#propEventForm [name="amount"]').fill('750');
  await page.locator('#propEventForm [name="date"]').fill('2026-10-16');
  await page.locator('#propEventForm button').click();
  await expect(page.locator('#propEventRows')).toContainText('750');
  await page.reload();
  await page.locator('[data-page="propaccounts"]').first().click();
  await expect(page.locator('#propEventRows')).toContainText('750');
  await page.locator('[data-page="reconciliation"]').first().click();
  await expect(page.locator('#recEventQueue')).toContainText('Smoke test 50K');
  const status=page.locator('[data-rec-event]').first();
  await status.selectOption('review');
  await expect(page.locator('[data-rec-event]').first()).toHaveValue('review');
  await page.reload();
  await expect(page.locator('[data-rec-event]').first()).toHaveValue('review');
  await page.locator('[data-page="propaccounts"]').first().click();
  await expect(page.locator('#propAuditHistory')).toContainText('status changed');
  await page.locator('[data-page="settings"]').first().click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#backupDownload').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^finance-hub-backup-.*\.json$/);
  expect(errors).toEqual([]);
});

test('Mobile navigation and account panel remain usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/finance?resource=*',async route=>{
    const resource=new URL(route.request().url()).searchParams.get('resource');
    const payload=resource==='me'?{user:{id:'mobile-owner',email:'mobile@example.com'},role:'owner',workspace_id:'mobile-workspace'}:
      resource==='snapshot'?{revision:0,data:null}:resource==='members'?{members:[]}: {revision:0};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await expect(page.locator('#signedInEmail')).toHaveText('mobile@example.com');
  await page.locator('#mobileNavToggle').click();
  await expect(page.locator('#financeSidebar')).toBeVisible();
  await page.locator('[data-page="settings"]').click();
  await expect(page.locator('#signedInRole')).toHaveText('Owner');
  expect(errors).toEqual([]);
});

test('Financial totals exclude transfers, investments stay out of P&L, and currencies stay separate',async({page})=>{
  await page.route(/currency-api|jsdelivr/,route=>route.fulfill({status:404,body:''}));
  await page.route('**/api/finance?resource=*',async route=>{
    const resource=new URL(route.request().url()).searchParams.get('resource');
    const response=resource==='me'?{user:{id:'math-user',email:'math@example.com'},role:'owner',workspace_id:'math-workspace'}:
      resource==='snapshot'?{revision:0,data:null}:resource==='members'?{members:[]}:{revision:0,updated_at:null};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.goto(url);
  await expect(page.locator('#signedInEmail')).toHaveText('math@example.com');
  await page.locator('[data-page="transactions"]').first().click();
  await page.locator('#entry').evaluate(form=>form.closest('details').open=true);
  for(const [type,amount,currency] of [['Income','2000','USD'],['Expense','450','USD'],['Investment','300','USD'],['Transfer','999','USD'],['Expense','90','EUR']]){
    await page.locator('#entry [name="date"]').fill('2026-10-15');
    await page.locator('#entry [name="user"]').fill('Dori');
    await page.locator('#entry [name="type"]').selectOption(type);
    await page.locator('#entry [name="amount"]').fill(amount);
    await page.locator('#entry [name="currency"]').selectOption(currency);
    await page.locator('#entry button').click();
  }
  await page.locator('[data-page="overview"]').first().click();
  await page.locator('#overviewPeriod').selectOption('all');
  await expect(page.locator('#stats')).toContainText('$2,000.00');
  await expect(page.locator('#stats')).toContainText('$450.00');
  await expect(page.locator('#stats')).toContainText('$1,550.00');
  await expect(page.locator('#stats')).toContainText('$1,250.00');
  await page.locator('#overviewCurrency').selectOption('EUR');
  await expect(page.locator('#stats')).toContainText('€90.00');
  await expect(page.locator('#stats')).not.toContainText('$2,000.00');
  await page.locator('[data-page="profitloss"]').first().click();
  await page.locator('#plPeriod').selectOption('all');
  await expect(page.locator('#plStatement')).toContainText('Investment outflows (not P&L expense)');
});

test('Switching authenticated accounts never shows the previous account cached transactions',async({page})=>{
  let identity='alice';
  await page.route('**/api/finance?resource=*',async route=>{
    const resource=new URL(route.request().url()).searchParams.get('resource');
    const response=resource==='me'?{user:{id:identity,email:identity+'@example.com'},role:'member',workspace_id:'shared'}:
      resource==='snapshot'?{revision:0,data:null}:{revision:0,updated_at:null};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.goto(url);
  await expect(page.locator('#signedInEmail')).toHaveText('alice@example.com');
  await page.evaluate(()=>{
    localStorage.setItem('finance-hub-v1',JSON.stringify([{id:'private-transaction',date:'2026-10-15',user:'Alice',category:'Personal',provider:'Private Bank',type:'Income',amount:777777,currency:'USD',notes:'Alice private ledger'}]));
  });
  identity='bob';
  await page.reload();
  await expect(page.locator('#signedInEmail')).toHaveText('bob@example.com');
  await page.locator('[data-page="transactions"]').first().click();
  await expect(page.locator('#rows')).not.toContainText('Alice private ledger');
  await expect(page.locator('#financeAuthGuard')).toBeHidden();
});

test('Prop-firm fee, payout, and ROI dashboard uses actual account records',async({page})=>{
  await page.route('**/api/finance?resource=*',async route=>{
    const r=new URL(route.request().url()).searchParams.get('resource');
    const data=r==='me'?{user:{id:'prop-fixture-user',email:'prop@example.com'},role:'owner',workspace_id:'prop-workspace'}:
      r==='snapshot'?{revision:0,data:null}:r==='members'?{members:[]}:{revision:0,updated_at:null};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(url);
  await expect(page.locator('#signedInEmail')).toHaveText('prop@example.com');
  await page.locator('[data-page="propaccounts"]').first().click();
  await page.locator('#propForm [name="label"]').fill('ROI fixture');
  await page.locator('#propForm [name="size"]').fill('50000');
  await page.locator('#propForm [name="evaluationFee"]').fill('50');
  await page.locator('#propForm [name="activationFee"]').fill('150');
  await page.locator('#propForm [name="payout"]').fill('750');
  await page.locator('#propForm [name="date"]').fill('2026-10-15');
  await page.locator('#propForm [name="payoutDate"]').fill('2026-10-16');
  await page.locator('#propForm button').click();
  await page.locator('[data-page="performance"]').first().click();
  await page.locator('#perfPeriod').selectOption('all');
  const metrics=page.locator('#perfMetrics');
  await expect(metrics).toContainText('$200.00');
  await expect(metrics).toContainText('$750.00');
  await expect(metrics).toContainText('$550.00');
  await expect(metrics).toContainText('275.0%');
});

test('An out-of-date cloud revision pauses auto-save rather than overwriting another device',async({page})=>{
  let remoteRevision=1,putCalls=0,putsAfterRemoteChange=0;
  const emptyBackup={format:'finance-hub-backup',version:2,transactions:[],propAccounts:[],propEvents:[],propAudit:[],subscriptions:[],invoices:[]};
  await page.route('**/api/finance?resource=*',async route=>{
    const resource=new URL(route.request().url()).searchParams.get('resource');
    let response;
    if(resource==='me')response={user:{id:'conflict-user',email:'conflict@example.com'},role:'owner',workspace_id:'conflict-ws'};
    else if(resource==='snapshot'){if(route.request().method()==='PUT'){putCalls++;if(remoteRevision>1)putsAfterRemoteChange++;response={error:'Stale save must be blocked'}}else response={revision:1,data:emptyBackup}}
    else if(resource==='snapshot-meta')response={revision:remoteRevision,updated_at:null};
    else if(resource==='members')response={members:[]};
    else{putCalls++;response={error:'Unexpected update'}}
    await route.fulfill({status:response.error?409:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.goto(url);
  await expect(page.locator('#cloudStatus')).toContainText('Up to date');
  remoteRevision=2;
  await page.locator('#overviewCurrency').selectOption('EUR');
  await expect(page.locator('#cloudStatus')).toContainText('Sync paused',{timeout:15000});
  // Startup preference initialization may issue earlier requests. After the
  // newer remote revision appears, no PUT is permitted.
  expect(putsAfterRemoteChange).toBe(0);
});


test('Additional reset fees and dated payouts change net prop cash and ROI without double counting',async({page})=>{
  await page.route('**/api/finance?resource=*',async route=>{
    const resource=new URL(route.request().url()).searchParams.get('resource');
    const data=resource==='me'?{user:{id:'dated-prop-user',email:'dated@example.com'},role:'owner',workspace_id:'dated-ws'}:
      resource==='snapshot'?{revision:0,data:null}:resource==='members'?{members:[]}:{revision:0,updated_at:null};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(url);
  await expect(page.locator('#signedInEmail')).toHaveText('dated@example.com');
  await page.locator('[data-page="propaccounts"]').first().click();
  await page.locator('#propForm [name="label"]').fill('Dated fee fixture');
  await page.locator('#propForm [name="size"]').fill('50000');
  await page.locator('#propForm [name="evaluationFee"]').fill('50');
  await page.locator('#propForm [name="activationFee"]').fill('150');
  await page.locator('#propForm [name="date"]').fill('2026-10-15');
  await page.locator('#propForm button').click();
  await page.locator('#propEventForm [name="kind"]').selectOption('reset');
  await page.locator('#propEventForm [name="amount"]').fill('25');
  await page.locator('#propEventForm [name="date"]').fill('2026-10-16');
  await page.locator('#propEventForm button').click();
  await page.locator('#propEventForm [name="kind"]').selectOption('payout');
  await page.locator('#propEventForm [name="amount"]').fill('750');
  await page.locator('#propEventForm [name="date"]').fill('2026-11-01');
  await page.locator('#propEventForm button').click();
  await page.locator('[data-page="performance"]').first().click();
  await page.locator('#perfPeriod').selectOption('all');
  await expect(page.locator('#perfMetrics')).toContainText('$225.00');
  await expect(page.locator('#perfMetrics')).toContainText('$750.00');
  await expect(page.locator('#perfMetrics')).toContainText('$525.00');
  await expect(page.locator('#perfMetrics')).toContainText('233.3%');
  await expect(page.locator('#perfPayouts')).toContainText('2026-11-01');
});

test('Pivot presets reconcile cash flow and expose unresolved historical FX',async({page})=>{
  const items=[
    {id:'i',date:'2026-09-02',user:'Dori',category:'Food & Dining',provider:'Careem',type:'Expense',amount:60,currency:'EUR'},
    {id:'r',date:'2026-09-02',user:'Dori',category:'Food & Dining',provider:'Careem',type:'Refund',amount:10,currency:'EUR'},
    {id:'c',date:'2026-09-02',category:'Food & Dining',provider:'Careem',type:'Cancelled',amount:30,currency:'EUR'},
    {id:'p',date:'2026-09-03',category:'Prop Firms',provider:'FTMO',type:'Income',amount:150,currency:'EUR'},
    {id:'t',date:'2026-09-03',category:'Brokers & Trading',provider:'Liquid Brokers',type:'Transfer',amount:400,currency:'EUR'},
    {id:'v',date:'2026-09-03',category:'Brokers & Trading',provider:'Liquid Brokers',type:'Investment',amount:40,currency:'EUR'},
    {id:'f',date:'2026-09-03',category:'Food & Dining',provider:'Careem',type:'Expense',amount:20,currency:'AED'}
  ];
  await page.route(/currency-api|jsdelivr/,route=>route.fulfill({json:{date:'2026-09-04',usd:{eur:0.9,aed:3.67}}}));
  await page.route('**/api/finance?resource=*',async route=>{
    const resource=new URL(route.request().url()).searchParams.get('resource');
    const data={format:'finance-hub-backup',version:2,transactions:items,propAccounts:[],propEvents:[],propAudit:[],subscriptions:[],invoices:[]};
    const json=resource==='me'?{user:{id:'pivot-user',email:'pivot@example.com'},role:'owner',workspace_id:'pivot-workspace'}:
      resource==='snapshot'?{revision:1,data}:resource==='members'?{members:[]}:{revision:1};
    await route.fulfill({json});
  });
  await page.goto(url+'#reports');
  await expect(page.locator('#pivotView')).toHaveValue('category');
  await expect(page.locator('#pivotTable tfoot th')).toHaveText(['Grand total','€60.00','€150.00','€100.00','€40.00','€10.00']);
  await expect(page.locator('#pivotFxCount')).toHaveText('(1)');
  await page.locator('#pivotFxReview summary').click();
  await expect(page.locator('#pivotFxRows')).toContainText('AED');
  const download=page.waitForEvent('download');
  await page.locator('#pivotExport').click();
  const fs=require('node:fs');
  expect(fs.readFileSync(await (await download).path(),'utf8')).toContain('"Grand total","60.00","150.00","100.00","40.00","10.00"');
  await page.getByRole('button',{name:'Food & Dining',exact:true}).click();
  await page.getByRole('button',{name:'Careem',exact:true}).click();
  await expect(page.locator('#pivotTable tbody tr')).toHaveCount(4);
  await page.locator('#pivotView').selectOption('month');
  await expect(page.locator('#pivotTable')).toContainText('2026-09');
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#pivotView')).toBeVisible();
  await expect(page.locator('#pivotExport')).toBeVisible();
});
