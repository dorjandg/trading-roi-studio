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
