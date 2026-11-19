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
  await page.route('**/api/finance?resource=*',async route=>{
    const resource=new URL(route.request().url()).searchParams.get('resource');
    const response=resource==='me'?{user:{id:'math-user',email:'math@example.com'},role:'owner',workspace_id:'math-workspace'}:
      resource==='snapshot'?{revision:0,data:null}:resource==='members'?{members:[]}:{revision:0,updated_at:null};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.goto(url);
  await expect(page.locator('#signedInEmail')).toHaveText('math@example.com');
  await page.locator('[data-page="transactions"]').first().click();
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
  await expect(page.locator('#transactionRows')).not.toContainText('Alice private ledger');
  await expect(page.locator('#financeAuthGuard')).toBeHidden();
});
