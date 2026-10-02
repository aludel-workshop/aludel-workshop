// T03-DATA: the Data template's own frame edits its OpenAPI file and publishes entries to the Library.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from './browser-support.mjs';

const origin = `http://aludel.localhost:${process.env.MACHINE_PORT || 4318}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true, acceptDownloads: true });
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
  const name = `DATA ${randomBytes(3).toString('hex')}`;
  await page.getByRole('textbox', { name: 'App name' }).fill(name);
  await page.getByRole('textbox', { name: 'Elevator pitch' }).fill('Neighbours lend tools.');
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await page.getByRole('button', { name: 'Start with no layers' }).click();
  await request('POST', '/api/accounts', { name: 'Data tester', email: `data-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  const project = (await request('GET', '/api/session')).projects.find(value => value.name === name);
  await request('PUT', `/api/projects/${project.id}/layer-instances/data`, { enabled: true });
  const base = `/p/${project.slug}`;
  await page.goto(origin + base + '/data/objects');
  const view = page.frameLocator('.lay-frame-view');
  await view.getByRole('heading', { name: 'New object' }).waitFor({ timeout: 30000 });
  assert.equal(await page.getByRole('heading', { name: 'Data', level: 1 }).count(), 1);
  await view.getByRole('textbox', { name: 'Name' }).fill('Tool');
  await view.getByRole('textbox', { name: 'Description' }).fill('Something a neighbour lends');
  await view.getByRole('button', { name: 'Add object' }).click();
  await view.getByRole('heading', { name: 'Tool', level: 2 }).waitFor();
  const files = await request('GET', `/api/projects/${project.id}/layers/data/files?path=outputs%2Fopenapi.json`);
  assert.ok(JSON.parse(files.content).components.schemas.Tool['x-aludel-id']);
  await page.locator('.lay-layer-outputs').getByRole('link', { name: 'API' }).click();
  await view.getByRole('heading', { name: 'New operation' }).waitFor();
  await view.getByRole('textbox', { name: 'operationId' }).fill('listTools');
  await view.getByRole('textbox', { name: 'Path' }).fill('/tools');
  await view.getByRole('textbox', { name: 'Summary' }).fill('List tools');
  await view.getByRole('button', { name: 'Add operation' }).click();
  await view.getByRole('heading', { name: 'List tools', level: 2 }).waitFor();
  await page.locator('.lay-layer-outputs').getByRole('link', { name: 'Access' }).click();
  await view.getByRole('heading', { name: 'New rule' }).waitFor();
  await view.getByRole('combobox', { name: 'Object' }).selectOption({ label: 'Tool' });
  await view.getByRole('textbox', { name: 'Rule, as a sentence' }).fill('Members can read tools.');
  await view.getByRole('button', { name: 'Add rule' }).click();
  await view.getByText('Members can read tools.').waitFor();
  await page.locator('.lay-layer-fixed').getByRole('link', { name: 'Tasks' }).click();
  await page.getByRole('link', { name: /^Access/ }).waitFor();
  assert.equal(await page.getByRole('link', { name: /^Actions/ }).count(), 0, 'Data Work is layer-scoped');
  await page.locator('.lay-layer-outputs').getByRole('link', { name: 'API' }).click();
  const downloadPromise = page.waitForEvent('download');
  await view.getByRole('button', { name: 'openapi.json' }).click();
  assert.equal((await downloadPromise).suggestedFilename(), 'openapi.json');
  await page.goto(origin + base + '/library/layers');
  await page.getByRole('searchbox', { name: 'Search the Library' }).fill('List tools');
  await page.getByText('List tools').first().waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + base + '/data/objects');
  await view.getByRole('heading', { name: 'Tool', level: 2 }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), '390px has no page overflow');
  const dataFrame = page.frames().find(frame => /\.layers\./.test(frame.url()));
  assert.ok(dataFrame, 'Data frame is present');
  for (const [name, target] of [['portal', page], ['Data frame', dataFrame]]) {
    await target.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
    const violations = await target.evaluate(async () => (await window.axe.run(document.querySelector('main') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(value => value.id));
    assert.deepEqual(violations, [], `${name} accessibility`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS data-layer: template frame creates objects and operations, exports OpenAPI, publishes to Library, 390px');
} finally { await browser.close(); }
