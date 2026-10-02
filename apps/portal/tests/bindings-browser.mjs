// LAYER-BINDINGS-01 step 2 disposable journey, on a template-enabled server: with no binding Pages draws plain specs; Discover
// proposes the design-system binding in Library › Bindings; accepting it there fills Pages' own copy of the kit, so the spec
// preview draws with Design's tokens; a Look & feel change reaches Pages through the binding; and with Design switched off
// Pages keeps drawing with its copy. Axe and 390px. Run with tools/browser-checks.sh bindings.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from './browser-support.mjs';

const origin = `http://aludel.localhost:${process.env.MACHINE_PORT || 4326}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, bypassCSP: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const request = async (method, path, data) => {
  const response = await context.request.fetch(origin + path, { method, data, headers: { 'content-type': 'application/json' } });
  assert.ok(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
  return response.json();
};
const until = async (read, ok, what) => {
  let value;
  for (let i = 0; i < 80; i++) { value = await read(); if (ok(value)) return value; await page.waitForTimeout(250); }
  assert.fail(`${what}: last value ${JSON.stringify(value)}`);
};
const axe = async name => {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('main') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    .violations.map(value => `${value.id}: ${value.nodes[0]?.target}`));
  assert.deepEqual(violations, [], `${name} accessibility`);
};
try {
  await request('PUT', '/api/onboarding/draft', { profile: 'planner' });
  await request('PUT', '/api/onboarding/draft', { name: `Tool Share ${randomBytes(3).toString('hex')}`, pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = await request('POST', '/api/accounts', { name: 'Binding tester', email: `bind-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  await request('PUT', `/api/projects/${project.id}/design`, { feel: 'sleek-saas', theme: 'light', accent: '#2e7d5b', notes: 'Neighbourly and practical.' });
  for (const key of ['design', 'pages']) await request('PUT', `/api/projects/${project.id}/layer-instances/${key}`, { enabled: true });
  await request('PUT', `/api/projects/${project.id}/features`, { picks: ['accounts'] });
  const base = `/p/${project.slug}`;
  const view = page.frameLocator('.lay-frame-view');
  const kitItems = async () => (await request('GET', `/api/projects/${project.id}/library?kind=kit_item&source=output&limit=100`)).total;
  // Pages' spec preview: the primary colour it draws with, read until it settles on the expected one.
  const theme = async () => {
    await page.goto(origin + base + '/pages/page');
    await view.getByRole('navigation', { name: 'Page tree' }).getByRole('link').first().click({ timeout: 60000 });
    await view.locator('.lay-pg-app').first().waitFor();
    await page.waitForTimeout(400);
    return view.locator('.lay-pg-app').first().evaluate(element => element.style.getPropertyValue('--mat-sys-primary'));
  };

  // ---- No binding: Pages works on its own, with an empty kit ----
  assert.equal(await kitItems(), 0, 'Pages keeps no kit before a binding');
  assert.equal(await theme(), '', 'with no binding, Pages draws plain specs');

  // ---- Library › Bindings shows the proposal; the owner accepts it there ----
  await page.goto(origin + base + '/library/bindings');
  const card = page.getByRole('region', { name: 'Design system' });
  await card.waitFor({ timeout: 30000 });
  await until(() => card.locator('.lay-chip').first().textContent(), text => /Proposed/.test(text), 'the binding is proposed');
  assert.match(await card.textContent(), /Design kit\s*authority/);
  assert.match(await card.textContent(), /Pages kit\s*follows the authority\s*through its aludel-kit adapter/);
  await axe('Library › Bindings (proposed)');
  // R2: the proposal is a Work item, and Accept decides it rather than leaving Discover's review open.
  const [{ id: bindingId }] = (await request('GET', `/api/projects/${project.id}/bindings`)).bindings;
  const pendingChanges = async () => (await request('GET', `/api/projects/${project.id}/bindings/${bindingId}/status`)).changes;
  assert.deepEqual((await pendingChanges()).map(c => c.change), [{ kind: 'lifecycle', lifecycle: 'reconciling' }], 'Discover\'s proposal waits as Work');
  await card.getByRole('button', { name: 'Accept' }).click();
  await until(() => card.locator('.lay-chip').first().textContent(), text => /Active/.test(text), 'the first reconcile completes and the binding is active');
  assert.deepEqual(await pendingChanges(), [], 'accepting closed Discover\'s review item');
  // The R2 routes: a proposed binding change and a refacet are Work items the owner decides; dismissing applies nothing.
  const { proposed: pause } = await request('POST', `/api/projects/${project.id}/bindings/${bindingId}/changes`, { change: { kind: 'lifecycle', lifecycle: 'paused' }, rationale: 'Route check.' });
  assert.deepEqual((await pendingChanges()).map(c => c.id), [pause.id]);
  await request('POST', `/api/projects/${project.id}/binding-changes/${pause.id}/decide`, { decision: 'dismiss' });
  assert.deepEqual(await pendingChanges(), []);
  const refacet = await request('POST', `/api/projects/${project.id}/layers/design/refacets`, { change: { op: 'split', facet: 'kit', into: { key: 'brand', title: 'Brand', take: [{ kind: 'brand_asset' }] } } });
  assert.ok(refacet.preflight.records.length > 0 && refacet.item.layer === 'design', 'the refacet is Work in Design, with its preflight');
  assert.equal((await request('POST', `/api/projects/${project.id}/refacets/${refacet.item.id}/decide`, { decision: 'dismiss', reason: 'Route check.' })).merged, null);
  const counts = await card.locator('.lay-binding-counts').textContent();
  assert.match(counts, /^\s*\d+ matched\s*$/, `every entry matched, nothing waiting: ${counts}`);
  assert.match(await card.textContent(), /Recent changes[\s\S]*Added [\s\S]* in Pages's kit/, 'the imports are listed as automatic changes');
  assert.match(await card.textContent(), /First reconcile complete/);
  const imported = await kitItems();
  assert.ok(imported > 5, `Pages now keeps its own copy of the kit (${imported} items)`);

  // ---- Pages draws with the copy ----
  const first = await until(theme, value => value !== '', 'Pages draws with Design\'s tokens');

  // ---- A Look & feel change follows the binding into Pages ----
  await request('PUT', `/api/projects/${project.id}/design`, { feel: 'sleek-saas', theme: 'light', accent: '#8a3ffc', notes: 'Neighbourly and practical.' });
  const second = await until(theme, value => value !== '' && value !== first, 'the changed tokens reach Pages\' copy');
  await page.goto(origin + base + '/library/bindings');
  await until(() => card.textContent(), text => /Updated /.test(text), 'the update is listed as an automatic change');

  // ---- Pages keeps its copy without Design ----
  await request('PUT', `/api/projects/${project.id}/layer-instances/design`, { enabled: false });
  assert.equal(await theme(), second, 'with Design off, Pages still draws with its copy');
  assert.equal(await kitItems(), imported, 'and keeps every item');
  await page.goto(origin + base + '/library/bindings');
  await until(() => card.textContent(), text => /On hold: Design is switched off/.test(text), 'the binding shows it is on hold');
  await request('PUT', `/api/projects/${project.id}/layer-instances/design`, { enabled: true });

  // ---- 390px ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + base + '/library/bindings');
  await card.waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 390px');
  await axe('Library › Bindings (390px)');
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`PASS Bindings: plain Pages with no binding, proposal in Library › Bindings, accepted and active (${imported} kit items imported), Pages draws Design's tokens, Look & feel change followed (${first} → ${second}), Pages keeps its copy without Design while the binding is on hold, axe and 390px`);
} finally {
  await browser.close();
}
