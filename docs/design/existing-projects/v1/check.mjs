// EX-02A C0 prototype check: walks the connect path and each Code-step case, screenshots every screen at 1440 and
// 390 px, runs axe on each, and fails on any violation or sideways scroll.
// Usage: CHROMIUM_PATH=… PLAYWRIGHT_MODULE=… node docs/design/existing-projects/v1/check.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const here = new URL('./', import.meta.url).pathname, shots = here + 'shots/'; mkdirSync(shots, { recursive: true });
const axe = readFileSync(new URL('../../../../apps/portal/node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width > 500 ? 900 : 844 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + here + 'index.html');
    const snap = async name => {
      await page.waitForTimeout(150);
      await page.addScriptTag({ content: axe });
      const v = await page.evaluate(async () => (await axe.run(document, { rules: { region: { enabled: false } } })).violations.map(x => `${x.id}: ${x.nodes.length}`));
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      await page.screenshot({ path: `${shots}${width}-${name}.png`, fullPage: true });
      results.push(`${width} ${name}: ${v.length ? 'AXE ' + v.join(', ') : 'axe clean'}${sideways ? ', SIDEWAYS SCROLL' : ''}`);
    };
    await snap('01-start');
    await page.getByRole('radio', { name: /Connect an existing repository/ }).click(); await snap('02-start-chosen');
    await page.getByRole('button', { name: 'Continue' }).click(); await snap('03-style');
    await page.getByRole('button', { name: 'Continue' }).click(); await snap('04-account');
    await page.getByRole('button', { name: 'Continue with GitHub' }).click();
    await page.getByRole('button', { name: 'Continue' }).click(); await snap('05-repository');
    await page.getByRole('option', { name: /aludel-workshop\/aludel-workshop/ }).click(); await snap('06-repository-picked');
    await page.getByRole('button', { name: 'Check repository' }).click(); await snap('07-code-aludel');
    for (const kase of ['Single app at the root', 'Default branch isn’t main', 'Too large', 'Already has .aludel/']) {
      await page.getByRole('button', { name: kase }).click(); await snap('08-code-' + kase.replace(/[^a-z]+/gi, '-').toLowerCase());
    }
    await page.getByRole('button', { name: 'Aludel (monorepo)' }).click();
    await page.getByRole('button', { name: 'Continue' }).click(); await snap('09-layers');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('The 17 files').click(); await snap('10-connect');
    await page.getByRole('button', { name: 'Connect and push' }).click(); await page.waitForTimeout(1800); await snap('11-done');
    if (errors.length) results.push(`${width} page errors: ${errors.join('; ')}`);
    await page.close();
  }
} finally { await browser.close(); }
writeFileSync(here + 'check-results.txt', results.join('\n') + '\n');
console.log(results.join('\n'));
process.exitCode = results.some(r => /AXE|SIDEWAYS|errors/.test(r)) ? 1 : 0;
