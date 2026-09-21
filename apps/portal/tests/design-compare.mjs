import { chromium } from '/tmp/app-builder-d01b-browser/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4313/apps/portal/test-results/work-design-comparison.html';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const response=await page.goto(base);
 assert.equal(response.status(),200);
 await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth));
 assert.equal(await page.locator('img').count(),10);
 await page.screenshot({path:'test-results/work-design-comparison.png',fullPage:true});
 console.log('PASS: five source/implementation pairs captured in one comparison image.');
}finally{await browser.close();}
