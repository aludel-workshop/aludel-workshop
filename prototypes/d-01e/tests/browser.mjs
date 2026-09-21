import {chromium} from '/tmp/app-builder-d01b-browser/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const evidence=path.resolve(root,'../../docs/design/portal-visual/v1');
fs.mkdirSync(evidence,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1487,height:1058},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const checks=[];const base=process.env.PREVIEW_URL||'http://127.0.0.1:4175/';

async function fresh(route='/borrowbox/reviews/A1',params='?scenario=candidate&review=current'){
 await page.goto(base);await page.evaluate(()=>sessionStorage.clear());await page.reload();
 await page.goto(base+params+'#'+route);await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.evaluate(()=>[...document.fonts].some(font=>font.status==='error')),false,'Font loading failed');
}
async function check(name,run){await run();checks.push({name,status:'passed'});console.log('PASS',name);}
async function a11y(name){
 await page.addScriptTag({path:path.join(root,'node_modules/axe-core/axe.min.js')});
 const violations=await page.evaluate(async()=>{const result=await axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return result.violations.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>node.target)}));});
 assert.deepEqual(violations,[],name+': '+JSON.stringify(violations));
}

try{
 await check('Accepted Overview remains unchanged in its default no-candidate state',async()=>{await fresh('/borrowbox/overview','');assert.equal(await page.locator('.decision-row').count(),3);assert.equal(await page.locator('.work-row').count(),4);assert.match(await page.locator('main').innerText(),/No preview yet/);});
 await check('Task keeps intent, scope, history and one named candidate transition',async()=>{await fresh('/borrowbox/work/BB-001');assert.match(await page.locator('main').innerText(),/What success means/);assert.match(await page.locator('main').innerText(),/Production release is not authorized/);await page.getByRole('link',{name:'Review candidate A1'}).click();assert.match(page.url(),/reviews\/A1/);});
 await check('Candidate workspace preserves identity, task return, evidence and release separation',async()=>{await fresh();assert.equal(await page.getByRole('heading',{name:'Candidate A1',exact:true}).count(),2);assert.equal(await page.getByText('8 passed · 1 gap',{exact:true}).count(),1);assert.match(await page.locator('.evaluation-pane').innerText(),/Acceptance does not release this build/);const drill=page.locator('.tool-image img');await drill.waitFor();assert.ok(await drill.evaluate(img=>img.complete&&img.naturalWidth>0));await a11y('Candidate workspace');await page.screenshot({path:evidence+'/implementation-wide.png'});});
 await check('BorrowBox preview handles success and overlap while preserving dates',async()=>{await fresh();await page.getByRole('button',{name:'Reserve tool'}).click();await page.getByText('Reservation confirmed for pickup.',{exact:false}).waitFor();await page.getByLabel('Pickup date').fill('2026-10-11');await page.getByLabel('Return date').fill('2026-10-13');await page.getByRole('button',{name:'Reserve tool'}).click();await page.getByText('Those dates are unavailable.',{exact:false}).waitFor();assert.equal(await page.getByLabel('Pickup date').inputValue(),'2026-10-11');assert.equal(await page.getByLabel('Return date').inputValue(),'2026-10-13');});
 await check('Feedback persists and revision request does not start another run',async()=>{await fresh();await page.getByRole('textbox',{name:'Your feedback'}).fill('Keep the overlap message near the dates.');await page.reload();assert.match(await page.getByRole('textbox',{name:'Your feedback'}).inputValue(),/overlap message/);await page.getByRole('button',{name:'Request revision'}).click();await page.getByText('Revision requested.',{exact:true}).waitFor();assert.match(await page.locator('.review-confirmation').innerText(),/No new run has started/);});
 await check('Acceptance binds A1 and remains separate from release',async()=>{await fresh();await page.getByRole('button',{name:'Accept candidate A1'}).click();await page.getByText('Candidate A1 accepted.',{exact:true}).waitFor();assert.match(await page.locator('.review-confirmation').innerText(),/Release still requires a separate authorization/);assert.match(page.url(),/reviews\/A1/);});
 await check('Stale and unavailable states retain A1 and block acceptance',async()=>{for(const state of ['stale','unavailable']){await fresh('/borrowbox/reviews/A1','?scenario=candidate&review='+state);assert.equal(await page.getByRole('button',{name:'Accept candidate A1'}).isDisabled(),true);assert.match(await page.locator('main').innerText(),/Candidate A1/);if(state==='unavailable')assert.match(await page.locator('main').innerText(),/newer candidate has not been substituted/);}});
 await check('Narrow review reflows without horizontal overflow and keeps action order',async()=>{await page.setViewportSize({width:390,height:844});await fresh();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await a11y('Narrow candidate workspace');const previewBox=await page.locator('.candidate-stage').boundingBox();const panelBox=await page.locator('.evaluation-pane').boundingBox();assert.ok(previewBox&&panelBox&&panelBox.y>previewBox.y);await page.screenshot({path:evidence+'/implementation-narrow.png',fullPage:true});});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(evidence+'/browser-validation.json',JSON.stringify({date:new Date().toISOString().slice(0,10),browser:browser.version(),checks,errors,viewports:[{width:1487,height:1058},{width:390,height:844}],limitations:['Synthetic browser-local state; no server concurrency or integration','Automated axe subset and keyboard-native controls, not a full assistive-technology audit','Q-005 evidence sufficiency remains a product-policy decision']},null,2));
}finally{await browser.close();}
