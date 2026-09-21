import { chromium } from '/tmp/app-builder-d01b-browser/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const base=process.env.D03_URL||'http://127.0.0.1:4310/reviews/project-workspace-v3/index.html';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},bypassCSP:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${base}#/work/history`);await page.getByRole('heading',{name:'History'}).waitFor();
 assert.equal(await page.locator('.row').count(),2);
 await page.getByRole('link',{name:/B-02/}).click();await page.getByRole('heading',{name:'Product records and dependencies'}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'Product records and dependencies'}).waitFor();
 await page.getByLabel('Breadcrumb').getByRole('link',{name:'Work'}).click();assert.ok(page.url().endsWith('#/work/history'));
 await page.getByRole('link',{name:/D-02/}).click();await page.getByRole('heading',{name:'Project workspace strategy'}).waitFor();
 await page.goto(`${base}#/work/history/MISSING`);await page.getByRole('heading',{name:'Work record not found'}).waitFor();
 await page.goto(`${base}?fixture=zero#/work/plan`);await page.getByRole('heading',{name:'Nothing here yet'}).waitFor();
 await page.goto(`${base}?fixture=error#/work/plan`);await page.getByRole('heading',{name:'Work could not be loaded'}).waitFor();
 await page.goto(`${base}?fixture=many#/work/plan`);assert.equal(await page.locator('.row').count(),24);
 await page.goto(`${base}#/work/plan/new`);const title=page.getByLabel('Title');await title.fill('Retained planning draft');await page.reload();assert.equal(await page.getByLabel('Title').inputValue(),'Retained planning draft');
 await page.goto(`${base}#/work/reconcile`);await page.getByRole('heading',{name:'Review imported work'}).waitFor();await page.getByRole('button',{name:'Apply to disposable fixture'}).click();await page.getByText(/0 live portal writes/).waitFor();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.addScriptTag({path:'/mnt/c/Users/henry/VSCode Projects/app-builder/apps/portal/node_modules/axe-core/axe.min.js'});
 const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id));
 assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);
 await page.screenshot({path:'/mnt/c/Users/henry/VSCode Projects/app-builder/docs/design/project-workspace/v3/reconciliation-narrow.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.goto(`${base}#/work/plan`);await page.screenshot({path:'/mnt/c/Users/henry/VSCode Projects/app-builder/docs/design/project-workspace/v3/plan-wide.png',fullPage:true});
 const result={status:'pass',base,twoRecordSelection:true,detailReload:true,returnToCollection:true,missing:true,zero:true,error:true,many:24,draftReload:true,reconciliationInteraction:true,narrowNoOverflow:true,axeViolations:violations,pageErrors:errors,limitation:'Design prototype with deterministic fixtures; no portal product records mutated.'};
 writeFileSync('/mnt/c/Users/henry/VSCode Projects/app-builder/docs/design/project-workspace/v3/browser-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close()}
