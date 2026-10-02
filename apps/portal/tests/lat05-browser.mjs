import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from './browser-support.mjs';

const origin = 'http://aludel.lat05.localhost:4312';
const out = 'docs/evidence/lat-05';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, bypassCSP: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const call = async (method, path, data) => {
  const res = await context.request.fetch(origin + path, { method, data, headers: { 'content-type': 'application/json' } });
  assert.ok(res.ok(), `${method} ${path}: ${res.status()} ${await res.text()}`);
  return res.json();
};
async function audit(name) {
  await page.addScriptTag({ path: 'apps/portal/node_modules/axe-core/axe.min.js' });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } })).violations.map(v => v.id));
  assert.deepEqual(violations, [], `${name} axe`);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}
try {
  await page.goto(origin + '/start');
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: /Continue/i }).first().click();
  const name = `LAT05 ${randomBytes(3).toString('hex')}`;
  await page.getByRole('textbox', { name: 'App name' }).fill(name);
  await page.getByRole('textbox', { name: 'Elevator pitch' }).fill('Check reviewed Pages flow coverage.');
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await page.getByRole('button', { name: 'Start with no layers' }).click();
  await call('POST', '/api/accounts', { name: 'LAT05 tester', email: `lat05-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  const session = await call('GET', '/api/session');
  const project = session.projects.find(p => p.name === name);
  assert.ok(project);
  const base = `/api/projects/${project.id}`;
  await call('PUT', `${base}/layer-instances/pages`, { enabled: true });
  await call('PUT', `${base}/layer-instances/product`, { enabled: true });
  const story = await call('POST', `${base}/records`, { kind: 'story', data: { title: 'Find the route', phase: 'demo' } });
  const draft = await call('POST', `${base}/layers/pages/connections`, { sourceKey: 'product' });
  await call('PUT', `${base}/layers/pages/connections/${draft.id}`, { expectedRevision: draft.revision, mapping: 'flow-candidate', instructions: 'Map each accepted story to a real page step.', status: 'active' });
  const view = await call('GET', `${base}/layers/pages/reconciliation`);
  assert.equal(view.coverage, 'active');
  const gap = view.gaps.find(item => item.sourceId === story.id);
  assert.ok(gap?.workItemId);
  await page.goto(origin + `/p/${project.slug}/pages/operations/connections/${draft.id}`);
  await page.getByRole('heading', { name: /Vision → Pages/ }).waitFor();
  await page.getByText('Flow coverage: active').waitFor();
  await page.getByRole('link', { name: 'Open Work' }).first().waitFor();
  await audit('connection-wide');
  await page.setViewportSize({ width: 390, height: 844 });
  await audit('connection-390');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/browser.json`, JSON.stringify({ checks: ['reviewed policy','durable gap','Work link','wide axe','390 axe','no page error','no overflow'], projectId: project.id, errors }, null, 2));
  console.log('LAT-05 browser utility journey passed');
} finally { await browser.close(); }
