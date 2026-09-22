import { chromium, ownerSignIn } from './browser-support.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';

const base = process.env.MACHINE_TEST_URL || 'http://127.0.0.1:4310';
const key = process.env.MACHINE_TEST_KEY;
assert.ok(key, 'MACHINE_TEST_KEY is required');
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, bypassCSP: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await ownerSignIn(page, base, key);
  await page.getByRole('heading', { name: 'Aludel', exact: true }).waitFor();
  assert.match(await page.locator('.brand-hero').getAttribute('style'), /url\(.+\.png/);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Project brand' }).waitFor();
  await page.getByLabel('Project name').fill('Aludel');
  await page.getByLabel('Tagline').fill('Turn ideas into what’s next.');
  await page.locator('input[type=file]').setInputFiles(path.resolve('public/brand/aludel-workshop.png'));
  await page.getByRole('button', { name: 'Save project brand' }).click();
  await page.getByText('Project brand saved.').waitFor();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByRole('heading', { name: 'Aludel', exact: true }).waitFor();
  await page.addScriptTag({ path: path.resolve('node_modules/axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(value => value.id));
  assert.deepEqual(violations, []);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false);
  assert.deepEqual(errors, []);
  console.log('PASS: Aludel brand renders, saves, uploads, remains accessible, and fits narrow layout.');
} finally {
  await browser.close();
}
