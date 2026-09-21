import { chromium } from '/tmp/app-builder-d01b-browser/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const base = process.env.MACHINE_TEST_URL || 'http://127.0.0.1:4312';
const key = process.env.MACHINE_TEST_KEY;
assert.ok(key, 'MACHINE_TEST_KEY is required');
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, bypassCSP: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(base);
  await page.getByLabel('Owner access key', { exact: true }).fill(key);
  if (await page.getByLabel('Confirm owner access key').count()) {
    await page.getByLabel('Confirm owner access key').fill(key);
    await page.getByRole('button', { name: 'Create owner access' }).click();
  } else {
    await page.getByRole('button', { name: 'Open portal' }).click();
  }
  await page.getByRole('heading', { name: 'GitHub integration needs operator configuration' }).waitFor();
  const panel = page.locator('.integration-panel');
  assert.match(await panel.innerText(), /one vendor-owned GitHub App/i);
  await panel.getByText('Required GitHub App settings').click();
  assert.match(await panel.innerText(), /MACHINE_GITHUB_PRIVATE_KEY_PATH/);
  assert.match(await panel.innerText(), /Administration: read\/write/);
  assert.match(await panel.innerText(), /Setup URL:/);
  await page.addScriptTag({ path: path.resolve('node_modules/axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(value => value.id));
  assert.deepEqual(violations, []);
  await page.screenshot({ path: 'test-results/github-integration-wide.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('heading', { name: 'GitHub integration needs operator configuration' }).waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false);
  await page.screenshot({ path: 'test-results/github-integration-narrow.png', fullPage: true });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
