import {chromium} from '/tmp/app-builder-d01b-browser/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1800,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const checks=[];
try{
 await page.goto('http://127.0.0.1:4175/review.html');
 const demo=page.frameLocator('#candidate');
 await demo.getByRole('link',{name:/Reservation implementation/}).click();
 await demo.getByRole('button',{name:'Authorize task',exact:true}).click();
 await page.getByRole('button',{name:'Simulate build completion'}).click();
 await demo.getByRole('link',{name:'Review candidate A1'}).click();
 await demo.getByRole('button',{name:'Reserve tool',exact:true}).click();
 await demo.getByText('Reservation confirmed for pickup.',{exact:false}).waitFor();
 await demo.getByRole('button',{name:'Accept candidate A1'}).click();
 await demo.getByText('Candidate A1 accepted.',{exact:true}).waitFor();
 checks.push('Published entry → Work → authorize → complete → review → reserve → accept, without URL manipulation');
 await page.getByLabel('Feedback about Aludel').fill('Outer notes must survive inner reset.');
 await page.getByRole('button',{name:'Load / reset scenario'}).click();
 await demo.getByRole('link',{name:/Reservation implementation/}).click();
 await demo.getByRole('button',{name:'Authorize task',exact:true}).waitFor();
 assert.equal(await page.getByLabel('Feedback about Aludel').inputValue(),'Outer notes must survive inner reset.');
 checks.push('Reset restores Ready and preserves outer review notes');
 for(const s of ['stale','unavailable']){
  await page.getByLabel('Starting scenario').selectOption(s);
  await page.getByRole('button',{name:'Load / reset scenario'}).click();
  await demo.getByRole('button',{name:'Accept candidate A1'}).waitFor();
  assert.equal(await demo.getByRole('button',{name:'Accept candidate A1'}).isDisabled(),true);
 }
 checks.push('Visible scenario controls reach stale/unavailable and block acceptance');
 await page.getByLabel('Starting scenario').selectOption('candidate');await page.getByRole('button',{name:'Load / reset scenario'}).click();
 await demo.getByRole('button',{name:'Accept candidate A1'}).waitFor();
 await page.screenshot({path:'../../temp/review-harness-wide.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.getByLabel('Preview width').selectOption('100%');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'../../temp/review-harness-narrow.png',fullPage:true});
 checks.push('390px host has no horizontal overflow');
 assert.deepEqual(errors,[]);
 fs.writeFileSync('../../docs/design/portal-visual/v1/harness-validation.json',JSON.stringify({date:'2026-09-20',checks,errors,limitations:['Local same-origin synthetic fixture','No production identity, isolation or real execution proof']},null,2));
}finally{await browser.close();}
