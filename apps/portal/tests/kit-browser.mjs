// LAYER-KNOWLEDGE-01 journey, on a template-enabled server: Pages' Kit is part of Pages' information, so it has a tab of its
// own. While Pages' kit follows no one, the tab is Pages' own and fully editable (a token set, components, brand assets);
// once the design-system binding is in force, it is a read-only copy with "Propose a change", and Knowledge shows Kit on
// the Design system card. Axe; 390 px. Run with tools/browser-checks.sh kit.
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
const axe = async name => {
  const target = page.frames().find(item => item.parentFrame() === page.mainFrame());
  await target.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await target.evaluate(async () => (await window.axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    .violations.map(value => `${value.id}: ${value.nodes[0]?.target}`));
  assert.deepEqual(violations, [], `${name} accessibility`);
};
const shots = process.env.KN_SHOTS || '';
const shot = async name => { if (shots) await page.screenshot({ path: `${shots}/kit-${name}.png`, fullPage: true }); };
const kitItems = async api => (await request('GET', `${api}/library?kind=kit_item&source=output&data=1&limit=100`)).results;

try {
  await request('PUT', '/api/onboarding/draft', { profile: 'planner' });
  await request('PUT', '/api/onboarding/draft', { name: `Tool Share ${randomBytes(3).toString('hex')}`, pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = await request('POST', '/api/accounts', { name: 'Kit tester', email: `kit-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  await request('PUT', `/api/projects/${project.id}/layer-instances/pages`, { enabled: true });
  const api = `/api/projects/${project.id}`, base = `/p/${project.slug}`;

  // ---- Pages alone: the Kit is Pages' own ----
  await page.goto(origin + base + '/pages/kit');
  await page.locator('.lay-frame-view').waitFor({ timeout: 180000 });
  const view = page.frameLocator('.lay-frame-view');
  await view.getByRole('button', { name: 'Start a token set' }).click({ timeout: 120000 });
  await view.locator('.lay-pg-kit-swatches li').first().waitFor({ timeout: 30000 });
  await view.getByPlaceholder('New component, e.g. Lend button').fill('Lend button');
  await view.getByRole('button', { name: 'Add component' }).click();
  await view.getByRole('button', { name: 'Remove Lend button' }).waitFor();
  await view.getByPlaceholder('New brand asset, e.g. App name').fill('Tool Share');
  await view.getByRole('button', { name: 'Add brand asset' }).click();
  const brand = view.getByRole('button', { name: 'Remove Tool Share' });
  await brand.waitFor();
  const name = view.locator('.lay-pg-kit-list li', { has: brand }).getByLabel('Name');
  await name.fill('Tool Share wordmark'); await name.press('Tab');
  await view.getByRole('button', { name: 'Remove Tool Share wordmark' }).waitFor();
  assert.deepEqual((await kitItems(api)).map(item => item.data.group).sort(), ['brand', 'component', 'tokens']);
  assert.ok((await kitItems(api)).every(item => !item.data.sourceRef), 'Pages\' own items name no source');
  await shot('own'); await axe('Kit, Pages\' own');

  // ---- With Design and the design-system binding in force, the Kit is a read-only copy ----
  await request('PUT', `${api}/layer-instances/design`, { enabled: true });
  await request('PUT', `${api}/design`, { feel: 'sleek-saas', theme: 'light', accent: '#2e7d5b', notes: 'Neighbourly.' });
  const [system] = (await request('GET', `${api}/bindings`)).bindings;
  assert.ok(system, 'Discover proposes the design-system binding');
  await request('POST', `${api}/bindings/${system.id}/lifecycle`, { lifecycle: 'reconciling', rationale: 'Pages draws with Design\'s kit.' });
  await page.goto(origin + base + '/pages/kit');
  await page.locator('.lay-frame-view').waitFor({ timeout: 180000 });
  const note = view.locator('.lay-role-note').first();
  await note.waitFor({ timeout: 60000 });
  assert.match(await note.textContent(), /This copy follows it/);
  await note.getByRole('button', { name: 'Propose a change' }).waitFor();
  assert.equal(await view.getByRole('button', { name: 'Add component' }).count(), 0, 'nothing is added to a copy');
  assert.equal(await view.getByRole('button', { name: /^Remove / }).count(), 0, 'nothing is removed from a copy');
  await shot('copy'); await axe('Kit, a copy');
  const refused = await context.request.fetch(`${origin}${api}/records`, { method: 'POST', headers: { 'content-type': 'application/json' }, data: { kind: 'kit_item', data: { group: 'component', value: { name: 'Sneaky' } } } });
  assert.ok(refused.status() >= 400, 'the host refuses writes to a copy whatever the view does');

  // ---- Knowledge: Kit sits on the Design system card, and its page says where it is edited ----
  await page.goto(origin + base + '/pages/knowledge');
  const card = page.locator('.kn-side .kn-card', { hasText: 'Design system' });
  await card.waitFor({ timeout: 60000 });
  await card.getByRole('link', { name: 'Kit', exact: true }).click();
  await page.locator('.kn-read').getByRole('link', { name: 'Edited in the Kit tab' }).waitFor();
  assert.match(await page.locator('.kn-read').textContent(), /Design system · keeps a copy/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + base + '/pages/kit');
  await page.locator('.lay-frame-view').waitFor({ timeout: 180000 });
  await view.locator('.lay-role-note').first().waitFor({ timeout: 60000 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 390px');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS Kit: Pages\' own kit edited in the Kit tab (token set, component, brand asset, rename); a read-only copy with Propose a change once the design-system binding is in force, and the host refuses writes; Kit on the Design system card in Knowledge; axe and 390px');
} finally {
  await browser.close();
}
