// LAYER-BINDINGS-01 step 3, R4 disposable journey, on a template-enabled server: layer views show each facet's role through
// @aludel/host/roles. Fixture (mechanical, not a product pairing): Design's brand assets are refaceted out and ceded in the
// design-system binding; Vision's intent becomes a replica of Vision's own story map, the one free authority facet in a
// fresh project. Checked: a replica's view is read-only with "Propose a change", which raises Work in the authority's layer;
// a ceded view points at the authority and keeps old records read-only; an authority's view is edited as before. Axe and
// 390px. Run with tools/browser-checks.sh roles.
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
const axe = async (name, frame) => {
  const target = frame ? page.frames().find(item => item.parentFrame() === page.mainFrame()) : page.mainFrame();
  assert.ok(target, `${name}: the layer frame is open`);
  await target.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await target.evaluate(async () => (await window.axe.run(document.querySelector('main') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    .violations.map(value => `${value.id}: ${value.nodes[0]?.target}`));
  assert.deepEqual(violations, [], `${name} accessibility`);
};

try {
  await request('PUT', '/api/onboarding/draft', { profile: 'planner' });
  await request('PUT', '/api/onboarding/draft', { name: `Tool Share ${randomBytes(3).toString('hex')}`, pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = await request('POST', '/api/accounts', { name: 'Roles tester', email: `roles-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  await request('PUT', `/api/projects/${project.id}/design`, { feel: 'sleek-saas', theme: 'light', accent: '#2e7d5b', notes: 'Neighbourly and practical.' });
  for (const key of ['design', 'pages', 'product']) await request('PUT', `/api/projects/${project.id}/layer-instances/${key}`, { enabled: true });
  const api = `/api/projects/${project.id}`, base = `/p/${project.slug}`;
  const view = page.frameLocator('.lay-frame-view');

  // ---- Fixture: Design's brand assets ceded; Vision's intent a replica of its story map ----
  const [system] = (await request('GET', `${api}/bindings`)).bindings;
  await request('POST', `${api}/bindings/${system.id}/lifecycle`, { lifecycle: 'reconciling', rationale: 'Accepted.' });
  const refacet = await request('POST', `${api}/layers/design/refacets`, { change: { op: 'split', facet: 'kit',
    into: { key: 'brand', title: 'Brand', take: [{ kind: 'brand_asset' }], roles: ['authority', 'ceded'], views: ['brand'] }, join: { binding: system.id, id: 'design-brand', role: 'ceded' } } });
  await request('POST', `${api}/refacets/${refacet.item.id}/decide`, { decision: 'accept' });
  const fixture = await request('POST', `${api}/bindings`, { concept: { name: 'Fixture: Vision\'s intent follows its story map' }, authority: 'vision-map', rationale: 'Journey fixture.',
    participants: [{ id: 'vision-map', layer: { key: 'product' }, facet: 'story-map', role: 'authority', shape: 'product.story-map' },
      { id: 'vision-intent', layer: { key: 'product' }, facet: 'intent', role: 'replica', shape: 'product.intent' }] });
  await request('POST', `${api}/bindings/${fixture.id}/lifecycle`, { lifecycle: 'reconciling', rationale: 'Journey fixture.' });
  const roles = await request('GET', `${api}/roles?layer=product`);
  assert.deepEqual(roles.facets.map(facet => [facet.key, facet.role]), [['intent', 'replica'], ['story-map', 'authority']]);

  // ---- Replica: Vision's Brief is read-only, and a change is proposed in the authority ----
  await page.goto(origin + base + '/vision');
  const note = view.locator('.lay-role-note').first();
  await note.waitFor({ timeout: 60000 });
  assert.match(await note.textContent(), /Managed in Vision's story-map\.\s*This copy follows it/);
  assert.equal(await view.getByPlaceholder('Add a claim…').count(), 0, 'no claim can be added here');
  assert.equal(await view.getByRole('button', { name: /^Edit: / }).count(), 0, 'no claim can be edited here');
  assert.equal(await view.getByRole('button', { name: 'Persona', exact: true }).count(), 0, 'no persona can be added here');
  await note.getByRole('button', { name: 'Propose a change' }).click();
  await view.getByLabel(/What should change in Vision's story-map\?/).fill('Name the borrower persona after the neighbour who lends.');
  const proposed = page.waitForResponse(response => response.url().endsWith('/roles/propose') && response.request().method() === 'POST');
  await view.getByRole('button', { name: 'Send to Vision' }).click();
  const answer = await proposed;
  assert.equal(answer.status(), 201);
  const { item } = await answer.json();
  assert.equal(item.layer, 'product', 'the change is Work in the authority\'s layer (here Vision, whose story map is the authority)');
  assert.match(item.title, /^Change proposed from Vision: /);
  const own = await context.request.fetch(`${origin}${api}/roles/propose?layer=product`, { method: 'POST', headers: { 'content-type': 'application/json' }, data: { facet: 'story-map', note: 'x' } });
  assert.equal(own.status(), 409, 'an authority\'s facet is changed in place, not proposed');
  await axe('Vision Brief as a replica', true);

  // ---- Authority: Vision's story map is edited as before ----
  await page.goto(origin + base + '/vision/map');
  await view.getByPlaceholder('New activity, e.g. “Give it back”').waitFor({ timeout: 60000 });
  assert.equal(await view.locator('.lay-role-note').count(), 0, 'no note for the authority');

  // ---- Ceded: Design's Brand points at the authority and keeps assets read-only ----
  await page.goto(origin + base + '/design/brand');
  const ceded = view.locator('.lay-role-note').first();
  await ceded.waitFor({ timeout: 60000 });
  assert.match(await ceded.textContent(), /Now managed in Design\.\s*What is here is read-only history\./);
  assert.equal(await view.getByRole('button', { name: 'Add asset' }).count(), 0, 'no asset can be added here');
  await view.locator('.lay-ds-asset').first().click();
  await view.locator('.lay-ds-drawer').waitFor();
  assert.equal(await view.locator('.lay-ds-drawer form').count(), 0, 'an asset opens read-only');
  assert.equal(await view.locator('.lay-ds-drawer .lay-role-note').count(), 1);
  await axe('Design Brand as ceded', true);

  // ---- Authority: Design's tokens are edited as before ----
  await page.goto(origin + base + '/design/tokens');
  await view.getByRole('complementary', { name: 'Token tree' }).waitFor({ timeout: 60000 });
  assert.equal(await view.locator('.lay-role-note').count(), 0, 'no note for the authority');

  // ---- The host refuses what a view would not offer ----
  const asset = (await request('GET', `${api}/library?kind=brand_asset&source=output&limit=1`)).results[0];
  const refused = await context.request.fetch(`${origin}${api}/layers/design/api/updateBrandAsset`, { method: 'POST', headers: { 'content-type': 'application/json' },
    data: { id: asset.ref, body: { expectedRevision: asset.revision, changes: { notes: 'Edited anyway' } } } });
  assert.equal(refused.status(), 409);

  // ---- 390px ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + base + '/vision');
  await view.locator('.lay-role-note').first().waitFor({ timeout: 60000 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 390px');
  await axe('Vision Brief as a replica (390px)', true);
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`PASS Roles: a replica's view is read-only with Propose a change (Work ${item.ref || item.id} raised in the authority's layer), a ceded view points at the authority with read-only history, authorities edit as before, the host refuses a direct write, axe and 390px`);
} finally {
  await browser.close();
}
