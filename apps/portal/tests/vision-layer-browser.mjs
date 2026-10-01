// T03-VISION disposable journey. Start a fresh template-enabled server, then run with MACHINE_PORT and PLAYWRIGHT_MODULE.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from './browser-support.mjs';

const origin = `http://aludel.localhost:${process.env.MACHINE_PORT || 4326}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const request = async (method, path, data) => {
  const response = await context.request.fetch(origin + path, { method, data, headers: { 'content-type': 'application/json' } });
  assert.ok(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
  return response.json();
};
try {
  await page.goto(origin + '/start');
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: /Continue/i }).first().click();
  const name = `VISION ${randomBytes(3).toString('hex')}`;
  await page.getByRole('textbox', { name: 'App name' }).fill(name);
  await page.getByRole('textbox', { name: 'Elevator pitch' }).fill('Neighbours share tools.');
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await page.getByRole('button', { name: 'Start with no layers' }).click();
  await request('POST', '/api/accounts', { name: 'Vision tester', email: `vision-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  const project = (await request('GET', '/api/session')).projects.find(value => value.name === name);
  await request('PUT', `/api/projects/${project.id}/layer-instances/product`, { enabled: true });
  const base = `/p/${project.slug}`;
  await page.goto(origin + base + '/vision/brief');
  const view = page.frameLocator('.lay-frame-view');
  await view.getByLabel('Add to Problem').waitFor({ timeout: 30000 });
  await view.getByLabel('Add to Problem').fill('Neighbours lack a trusted way to share tools.');
  await view.getByLabel('Add to Problem').press('Enter');
  await view.getByText('Neighbours lack a trusted way to share tools.').first().waitFor();
  await view.getByRole('button', { name: 'Assumed' }).first().click();
  await view.getByRole('dialog', { name: 'Neighbours lack a trusted way to share tools.' }).waitFor();
  await view.getByRole('button', { name: 'Close evidence' }).click();
  const knowledge = await request('GET', `/api/projects/${project.id}/knowledge`);
  assert.ok(knowledge.knowledge.claims.some(claim => claim.text === 'Neighbours lack a trusted way to share tools.'));
  await page.locator('.lay-layer-outputs').getByRole('link', { name: 'Story map' }).click();
  await view.getByLabel('New activity').fill('Borrow a tool');
  await view.getByRole('button', { name: 'Add activity' }).click();
  await view.getByText('Borrow a tool').first().waitFor();
  await page.locator('.lay-layer-outputs').getByRole('link', { name: 'Documents' }).click();
  await view.getByRole('button', { name: /Generate PR\/FAQ/ }).click();
  await view.getByText('Up to date with Brief revision', { exact: false }).waitFor();
  await page.goto(origin + base + '/library/layers');
  await page.getByRole('searchbox', { name: 'Search the Library' }).fill('Neighbours lack');
  await page.getByText('Neighbours lack a trusted way to share tools.').first().waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + base + '/vision/brief');
  await view.getByText('Neighbours lack a trusted way to share tools.').first().waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  const visionFrame = page.frames().find(frame => /\.layers\./.test(frame.url()));
  assert.ok(visionFrame);
  for (const [name, target] of [['portal', page], ['Vision frame', visionFrame]]) {
    await target.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
    const violations = await target.evaluate(async () => (await window.axe.run(document.querySelector('main') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(value => value.id));
    assert.deepEqual(violations, [], `${name} accessibility`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS Vision frame: Brief edit, story map, generated document, Library and 390px');
} finally { await browser.close(); }
