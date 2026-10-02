// LAYER-BINDINGS-01 step 3, R5 disposable journey, on a template-enabled server: a Branding layer built from scratch takes
// over Design's branding. Branding (from the Markdown template) declares a facet; one overlap chain refacets Design (brand
// assets out of its kit) and Pages (its brand kit items out of its kit, which would otherwise straddle two authorities)
// and binds them, Branding the authority. Design's Brand tab then points at Branding, Pages' brand kit needs an adapter
// for Branding's shape, and the design-system binding keeps only tokens and components. Run with
// tools/browser-checks.sh branding.
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

try {
  await request('PUT', '/api/onboarding/draft', { profile: 'planner' });
  await request('PUT', '/api/onboarding/draft', { name: `Tool Share ${randomBytes(3).toString('hex')}`, pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = await request('POST', '/api/accounts', { name: 'Branding tester', email: `brand-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  await request('PUT', `/api/projects/${project.id}/design`, { feel: 'sleek-saas', theme: 'light', accent: '#2e7d5b', notes: 'Neighbourly and practical.' });
  for (const key of ['design', 'pages']) await request('PUT', `/api/projects/${project.id}/layer-instances/${key}`, { enabled: true });
  const api = `/api/projects/${project.id}`, base = `/p/${project.slug}`;
  const [system] = (await request('GET', `${api}/bindings`)).bindings;
  await request('POST', `${api}/bindings/${system.id}/lifecycle`, { lifecycle: 'reconciling', rationale: 'Pages draws with Design\'s kit.' });
  const kitBefore = (await request('GET', `${api}/library?kind=kit_item&source=output&limit=100`)).total;

  // ---- Branding, from scratch, declares what it keeps ----
  await request('POST', `${api}/layer-definitions`, { name: 'Branding', key: 'branding', template: 'markdown' });
  const declared = await request('POST', `${api}/layers/branding/refacets`, { change: { op: 'declare', into: { key: 'brand', title: 'Brand', take: [{ kind: 'markdown_document' }], roles: ['authority'], hints: ['branding'] } } });
  await request('POST', `${api}/refacets/${declared.item.id}/decide`, { decision: 'accept' });

  // ---- One chain: refacet Design and Pages, then bind the brand parts with Branding as the authority ----
  const chain = await request('POST', `${api}/overlaps`, { rationale: 'Branding keeps the brand now.',
    refacets: [{ layer: 'design', change: { op: 'split', facet: 'kit', into: { key: 'brand', title: 'Brand', take: [{ kind: 'brand_asset' }], roles: ['authority', 'ceded'], views: ['brand'] } } },
      { layer: 'pages', change: { op: 'split', facet: 'kit', into: { key: 'kit-brand', title: 'Brand kit', take: [{ kind: 'kit_item', where: { field: 'group', equals: 'brand' } }], roles: ['replica'] } } }],
    binding: { concept: { name: 'The app\'s brand' }, authority: 'branding-brand',
      participants: [{ id: 'branding-brand', layer: { key: 'branding' }, facet: 'brand', role: 'authority', shape: 'branding.brand' },
        { id: 'design-brand', layer: { key: 'design' }, facet: 'brand', role: 'ceded', shape: 'design.brand' },
        { id: 'pages-kit-brand', layer: { key: 'pages' }, facet: 'kit-brand', role: 'replica', shape: 'pages.kit-brand' }] } });
  const refused = await context.request.fetch(`${origin}${api}/binding-changes/${chain.proposal.id}/decide`, { method: 'POST', headers: { 'content-type': 'application/json' }, data: { decision: 'accept' } });
  assert.equal(refused.status(), 409, 'the binding waits on its refacets');
  for (const item of chain.refacets) await request('POST', `${api}/refacets/${item.id}/decide`, { decision: 'accept' });
  const { binding } = await request('POST', `${api}/binding-changes/${chain.proposal.id}/decide`, { decision: 'accept' });
  assert.equal((await request('GET', `${api}/bindings/${system.id}`)).detached.length, 0, 'the design-system binding let go of the brand entries');
  assert.equal((await request('GET', `${api}/library?kind=kit_item&source=output&limit=100`)).total, kitBefore, 'Pages kept every copy');

  // ---- Design's Brand points at Branding; Library › Bindings shows the brand binding and what Pages still needs ----
  await page.goto(origin + base + '/design/brand');
  await page.locator('.lay-frame-view').waitFor({ timeout: 180000 });
  const view = page.frameLocator('.lay-frame-view');
  await until(() => view.locator('.lay-role-note').allTextContents().catch(() => []), texts => texts.some(text => /Now managed in Branding\./.test(text)), 'Design\'s Brand points at Branding');
  assert.equal(await view.getByRole('button', { name: 'Add asset' }).count(), 0);
  await page.goto(origin + base + '/library/bindings');
  const card = page.getByRole('region', { name: 'The app\'s brand' });
  await card.waitFor({ timeout: 30000 });
  assert.match(await card.textContent(), /Pages kit-brand\s*follows the authority\s*needs an adapter for Branding's brand/);
  assert.match(await card.textContent(), /Design brand\s*ceded/);
  const offered = (await request('GET', `${api}/bindings/${binding.id}/status`)).work.filter(item => item.kind === 'adopt');
  assert.ok(offered.length > 0, 'Design\'s brand assets are offered to Branding once, as Work');
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`PASS Branding: declared from scratch, one chain refaceted Design and Pages and bound them, Design's Brand points at Branding, Pages' brand kit needs an adapter, ${offered.length} brand assets offered to Branding, Pages kept all ${kitBefore} kit items`);
} finally {
  await browser.close();
}
