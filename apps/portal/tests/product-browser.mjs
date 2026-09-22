import { chromium, ownerSignIn } from './browser-support.mjs';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const baseUrl = `http://127.0.0.1:${process.env.MACHINE_PORT || 4313}`;
for (let tries = 0; ; tries++) {
  try { if ((await fetch(`${baseUrl}/api/session`)).ok) break; } catch {}
  if (tries >= 49) throw new Error('Test portal did not become ready');
  await new Promise(resolve => setTimeout(resolve, 100));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, bypassCSP: true });
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  const key = randomBytes(24).toString('hex');
  await ownerSignIn(page, baseUrl, key);
  await page.getByRole('link', { name: 'Product', exact: true }).click();
  await page.getByRole('heading', { name: 'Build software from durable product intent' }).waitFor();
  await page.getByRole('button', { name: 'Edit direction' }).click();
  await page.getByLabel('Purpose').fill('Aludel turns durable product intent into deliberately authorized work and reviewable evidence.');
  await page.getByRole('button', { name: 'Save revision' }).click();
  await page.getByText('Revision 2 saved. No work was started.').waitFor();

  await page.getByRole('link', { name: 'Roadmap', exact: true }).click();
  await page.getByRole('heading', { name: 'Outcome roadmap' }).waitFor();
  assert.equal(await page.getByText(/Calendar view is unavailable/).count(), 1);
  await page.getByRole('button', { name: /Request a change and review its preview/ }).click();
  await page.getByRole('button', { name: 'Edit outcome' }).click();
  await page.getByLabel('Priority').fill('8');
  await page.getByRole('button', { name: 'Save revision' }).click();
  await page.getByText('Revision 2 saved. No work was started.').waitFor();

  await page.getByRole('link', { name: 'Features', exact: true }).click();
  await page.getByRole('heading', { name: 'Product capabilities' }).waitFor();
  await page.getByRole('button', { name: 'Add feature' }).click();
  await page.getByLabel('Feature').fill('Inspect product evidence');
  await page.getByLabel('Description').fill('Keep evidence close to the capability it supports.');
  await page.getByLabel('Linked outcome').selectOption('outcome-first-loop');
  await page.getByRole('button', { name: 'Save revision' }).click();
  await page.getByText('Revision 1 saved. No work was started.').waitFor();
  assert.match(await page.locator('.feature-list').innerText(), /Inspect product evidence/);

  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const axe = () => page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(value => value.id));
  for (const view of ['product', 'product/roadmap', 'product/features']) {
    await page.goto(`${baseUrl}/#/the-machine/${view}`); await page.locator('main h1').waitFor();
    assert.deepEqual(await axe(), []); await page.screenshot({ path: `test-results/${view.replace('/', '-')}-wide.png`, fullPage: true });
  }
  await page.goto(`${baseUrl}/#/the-machine/proposals`);
  await page.getByRole('heading', { name: 'Change proposals' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/#/the-machine/product/features`); await page.getByRole('heading', { name: 'Product capabilities' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(await axe(), []); assert.deepEqual(errors, []);
  await page.screenshot({ path: 'test-results/product-features-narrow.png', fullPage: true });
  console.log('PASS: Product direction, roadmap and features; revisioned edits; legacy route; wide/narrow axe and layout.');
} finally { await browser.close(); }
