import { chromium } from '/tmp/app-builder-d01b-browser/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const base = process.env.MACHINE_TEST_URL || 'http://127.0.0.1:4311';
const key = process.env.MACHINE_TEST_KEY;
assert.ok(key, 'MACHINE_TEST_KEY is required');
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, bypassCSP: true });
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
  await page.getByRole('heading', { name: 'Aludel', exact: true }).waitFor();
  assert.match(await page.locator('main').innerText(), /knowledge (records|sources)/i);
  await page.getByRole('link', { name: 'Browse knowledge' }).click();
  await page.getByLabel('Search records').fill('architecture');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('link', { name: /Architecture proposal/ }).click();
  await page.getByRole('heading', { name: 'Architecture proposal' }).waitFor();
  assert.match(await page.locator('main').innerText(), /Structured metadata/);
  await page.getByRole('link', { name: 'New request' }).click();
  await page.getByLabel('Your request').fill('Make native product records easy to audit.');
  await page.getByRole('button', { name: 'Save request' }).click();
  await page.getByRole('button', { name: 'Create change proposal' }).click();
  await page.getByRole('heading', { name: 'Make native product records easy to audit.' }).waitFor();
  await page.getByLabel('Acceptance examples, one per line').fill('Revision history remains visible.');
  await page.getByRole('button', { name: 'Save new revision' }).click();
  await page.getByText('Proposal revision 2 saved. No work has started.').waitFor();
  await page.getByRole('link', { name: 'Decisions', exact: true }).click();
  await page.getByRole('link', { name: /Where should mutable product records live/ }).click();
  const decisionId = 'DEC-MACHINE-DATA';
  const external = await page.context().request.post(`${base}/api/decisions/${decisionId}/answer`, { data: { expectedRevision: 1, answer: 'Portal database with repository sources', rationale: 'Concurrent revision fixture.' } });
  assert.equal(external.ok(), true);
  await page.getByLabel('Continue using hand-edited Markdown').check();
  await page.getByLabel('Rationale').fill('Exercise dependency-specific staleness.');
  await page.getByRole('button', { name: 'Save decision revision' }).click();
  await page.getByText(/This decision changed to revision 2/).waitFor();
  assert.equal(await page.getByLabel('Continue using hand-edited Markdown').isChecked(), true);
  assert.equal(await page.getByLabel('Rationale').inputValue(), 'Exercise dependency-specific staleness.');
  await page.getByRole('button', { name: 'Review current revision' }).click();
  await page.getByText(/Current revision 2 loaded/).waitFor();
  assert.equal(await page.getByLabel('Continue using hand-edited Markdown').isChecked(), true);
  await page.getByRole('button', { name: 'Save decision revision' }).click();
  await page.getByText(/1 linked records need reassessment; unrelated work was unchanged/).waitFor();
  await page.getByRole('link', { name: 'Work', exact: true }).click();
  const linked = page.locator('.work-record').filter({ hasText: 'PLAN-B02' });
  const unrelated = page.locator('.work-record').filter({ hasText: 'PLAN-B03' });
  assert.match(await linked.innerText(), /stale/i);
  assert.match(await unrelated.innerText(), /current/i);
  await linked.getByRole('button', { name: 'Reassess' }).click();
  await page.getByText('PLAN-B02 reassessed against current decision revisions. No execution started.').waitFor();
  assert.match(await linked.innerText(), /current/i);
  await page.addScriptTag({ path: path.resolve('node_modules/axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(value => value.id));
  assert.deepEqual(violations, []);
  await page.screenshot({ path: 'test-results/work-dependencies-wide.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/#/the-machine/overview');
  await page.getByRole('heading', { name: 'Aludel', exact: true }).waitFor();
  const overflow = await page.evaluate(() => ({ overflowing: document.documentElement.scrollWidth > innerWidth, width: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('*')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(element => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right })) }));
  assert.equal(overflow.overflowing, false, JSON.stringify(overflow));
  await page.screenshot({ path: 'test-results/overview-narrow.png', fullPage: true });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
