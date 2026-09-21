import {chromium} from '/tmp/app-builder-d01b-browser/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const output=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},bypassCSP:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto('http://127.0.0.1:4310/reviews/project-workspace-v7/index.html');assert.equal(response.status(),200);await page.evaluate(()=>document.fonts.ready);
 for(const id of ['overview','plan','operations','findings']){await page.locator(`nav a[href="#${id}"]`).click();assert.equal(new URL(page.url()).hash,'#'+id);assert.equal(await page.locator('#'+id).isVisible(),true);}
 const imageState=await page.locator('img').evaluateAll(es=>es.map(e=>({source:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0})));assert.equal(imageState.every(i=>i.loaded),true);
 await page.locator('details').first().getByRole('group').count();
 const summary=page.locator('summary').first();await summary.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('details').first().getAttribute('open'),'');
 await page.addScriptTag({path:'/mnt/c/Users/henry/VSCode Projects/app-builder/apps/portal/node_modules/axe-core/axe.min.js'});
 const axe=()=>page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
 const wideAxe=await axe();assert.deepEqual(wideAxe,[]);await page.locator('nav a[href="#overview"]').click();await page.screenshot({path:output+'study-wide.png'});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const narrowAxe=await axe();assert.deepEqual(narrowAxe,[]);await page.screenshot({path:output+'study-narrow.png'});assert.deepEqual(errors,[]);
 const result={status:'pass',type:'Research-board checks only; no product workflow validated',reviewAnchors:4,referenceImages:imageState,keyboardDisclosure:true,fontLoaded:await page.evaluate(()=>document.fonts.check('16px Roboto')),narrowNoOverflow:true,wideAxe,narrowAxe,pageErrors:errors};writeFileSync(output+'board-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close()}
