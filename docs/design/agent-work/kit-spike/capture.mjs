// W-29 #1: screenshot the kit-built screens beside Biome's recorded ones, and list what the kit could not draw.
// Usage: node capture.mjs   (Chromium from PLAYWRIGHT_BROWSERS_PATH, as the portal's browser tests use)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '../../../../apps/portal/tests/browser-support.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, 'shots');
mkdirSync(shots, { recursive: true });
const evidence = join(here, '../../../evidence/biome-review');
const browser = await chromium.launch({ headless: true });
const report = {};
for (const [name, recorded, width] of [['setup', 'initial-setup.png', 1280], ['world', 'populated-biome.png', 1280], ['setup-390', 'initial-setup-narrow.png', 390], ['demos', null, 1280]]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: 'light' });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(pathToFileURL(join(here, 'pages', `${name.replace(/-\d+$/, '')}.html`)).href);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(shots, `kit-${name}.png`), fullPage: name === 'demos' });
  report[name] = await page.evaluate(() => {
    const tags = [...new Set([...document.querySelectorAll('*')].map(el => el.localName).filter(tag => tag.startsWith('kit-')))];
    return { used: tags.filter(tag => customElements.get(tag)), undefined: tags.filter(tag => !customElements.get(tag)) };
  });
  report[name].errors = errors;
  await page.close();
  if (!recorded) continue;
  // Side by side: recorded on the left, kit on the right, at the same width.
  const compare = await browser.newPage({ viewport: { width: width * 2 + 24, height: 960 } });
  const file = join(shots, `compare-${name}.html`);
  writeFileSync(file, `<body style="margin:0;display:flex;gap:24px;background:#222;font:14px system-ui;color:#fff">
    <figure style="margin:0"><figcaption style="padding:6px">Recorded (Biome's built app)</figcaption><img src="${pathToFileURL(join(evidence, recorded)).href}" style="width:${width}px"></figure>
    <figure style="margin:0"><figcaption style="padding:6px">Generated kit (Design records only)</figcaption><img src="${pathToFileURL(join(shots, `kit-${name}.png`)).href}" style="width:${width}px"></figure></body>`);
  await compare.goto(pathToFileURL(file).href);
  await compare.waitForTimeout(200);
  await compare.screenshot({ path: join(shots, `compare-${name}.png`), fullPage: true });
  await compare.close();
  rmSync(file);
}
await browser.close();
writeFileSync(join(shots, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 1));
