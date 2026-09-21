import {chromium} from '/tmp/app-builder-d01b-browser/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const evidence=path.resolve(root,'../../docs/design/portal-visual/v1');
const source=fs.readFileSync(path.join(evidence,'selected-direction.png'));
const implementation=fs.readFileSync(path.join(evidence,'implementation-wide.png'));
const width=source.readUInt32BE(16),height=source.readUInt32BE(20);
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:width*2,height},deviceScaleFactor:1});
await page.setContent(`<body style="margin:0;display:flex;background:white"><img width="${width}" height="${height}" src="data:image/png;base64,${source.toString('base64')}"><img width="${width}" height="${height}" src="data:image/png;base64,${implementation.toString('base64')}"></body>`);
await page.locator('img').last().evaluate(image=>image.decode());await page.screenshot({path:path.join(evidence,'comparison-wide.png')});await browser.close();
