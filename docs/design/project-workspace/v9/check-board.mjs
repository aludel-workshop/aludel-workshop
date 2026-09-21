import { chromium } from '/tmp/app-builder-d01b-browser/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('.', import.meta.url));
const base = 'http://127.0.0.1:4310/reviews/project-workspace-v9/index.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, bypassCSP: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  const response = await page.goto(base);
  assert.equal(response.status(), 200);
  await page.evaluate(() => document.fonts.ready);

  for (const id of ['overview', 'plan-a', 'plan-b', 'operations', 'intake']) {
    await page.locator(`.review-bar a[href="#${id}"]`).click();
    assert.equal(new URL(page.url()).hash, `#${id}`);
    assert.equal(await page.locator(`#${id}`).isVisible(), true);
    await page.locator(`#${id}`).screenshot({ path: `${output}${id}-wide.png` });
  }

  assert.equal(await page.getByText('Next up', { exact: true }).count(), 0);
  assert.equal(await page.locator('#operations .work-card').count(), 5);
  assert.equal(await page.locator('#plan-a .table-row:not(.table-head)').count(), 4);
  assert.equal(await page.locator('#overview .action').count(), 3);

  await page.addScriptTag({ path: '/mnt/c/Users/henry/VSCode Projects/app-builder/apps/portal/node_modules/axe-core/axe.min.js' });
  const axe = () => page.evaluate(async () => (await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }
  })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
  const wideAxe = await axe();
  assert.deepEqual(wideAxe, []);

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  for (const id of ['overview', 'plan-a', 'operations', 'intake']) {
    assert.equal(await page.locator(`#${id} h2`).isVisible(), true);
  }
  await page.locator('#operations').screenshot({ path: `${output}operations-narrow.png` });
  const narrowAxe = await axe();
  assert.deepEqual(narrowAxe, []);
  assert.deepEqual(errors, []);

  const result = {
    status: 'pass',
    kind: 'Static composition study; no product controls or record mutations tested',
    sections: ['overview', 'plan-a', 'plan-b', 'operations', 'intake'],
    nextUpRemoved: true,
    overviewActions: 3,
    planTableRows: 4,
    operationStates: ['ready-for-review', 'problem', 'in-progress', 'not-started-queued', 'not-started-blocked'],
    fontLoaded: await page.evaluate(() => document.fonts.check('16px Roboto')),
    narrowNoOverflow: true,
    wideAxe,
    narrowAxe,
    pageErrors: errors
  };
  writeFileSync(`${output}board-results.json`, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
