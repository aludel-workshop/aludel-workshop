// LAYER-BINDINGS-01 step 3, R5 disposable journey, on a template-enabled server: a new, unrelated Personas layer covers part
// of Vision. In Manage › Facets, Personas declares a facet; Discover raises Assess overlap; the chain's refacet of Vision is
// accepted in Vision's Manage › Facets; the binding is accepted; Vision's Brief points at Personas; the adopted persona is
// paired; Pages gets Work for its reference; and the whole thing merges back through Manage › Facets. Axe and 390px.
// Run with tools/browser-checks.sh overlap.
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
const axe = async (name, frame = false) => {
  const target = frame ? page.frames().find(item => item.parentFrame() === page.mainFrame()) : page.mainFrame();
  await target.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await target.evaluate(async () => (await window.axe.run(document.querySelector('main') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    .violations.map(value => `${value.id}: ${value.nodes[0]?.target}`));
  assert.deepEqual(violations, [], `${name} accessibility`);
};

try {
  await request('PUT', '/api/onboarding/draft', { profile: 'planner' });
  await request('PUT', '/api/onboarding/draft', { name: `Tool Share ${randomBytes(3).toString('hex')}`, pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = await request('POST', '/api/accounts', { name: 'Overlap tester', email: `overlap-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  for (const key of ['design', 'pages', 'product']) await request('PUT', `/api/projects/${project.id}/layer-instances/${key}`, { enabled: true });
  const api = `/api/projects/${project.id}`, base = `/p/${project.slug}`;
  const persona = await request('POST', `${api}/layers/product/api/createPersona`, { body: { persona: { name: 'Borrower', role: 'Needs a tool once' } } });
  const flow = await request('POST', `${api}/layers/pages/api/createFlow`, { body: { flow: { title: 'Borrow a drill', persona: persona.id, steps: [] } } });

  // ---- A new layer declares what it shares, in Manage › Facets ----
  await request('POST', `${api}/layer-definitions`, { name: 'Personas', key: 'personas', template: 'markdown' });
  await page.goto(origin + base + '/personas/manage/facets');
  const facets = page.locator('aludel-layer-facets');
  await facets.getByText('Not in any facet').waitFor({ timeout: 60000 });
  await facets.getByRole('button', { name: 'Declare a facet' }).click();
  const declare = facets.getByRole('form', { name: 'Declare a facet' });
  await declare.getByLabel('Facet', { exact: true }).fill('People');
  await declare.getByLabel('markdown document').check();
  await declare.getByLabel('A copy that follows another layer').uncheck();
  await declare.getByLabel(/Hints for discovery/).fill('personas');
  await declare.getByRole('button', { name: 'Propose the facet' }).click();
  const proposal = facets.getByRole('listitem', { name: /Refacet Personas: declare the people facet/ });
  await proposal.waitFor();
  assert.match(await proposal.textContent(), /Moves no records\./);
  await axe('Manage › Facets with a proposal');
  await proposal.getByRole('button', { name: 'Accept' }).click();
  await until(() => facets.locator('.lay-fc-list').first().textContent(), text => /People\s*people\s*Not shared/.test(text), 'Personas shares a People facet');

  // ---- Discover raises Assess overlap: soft Work, nothing matched automatically ----
  const work = async () => (await request('GET', `${api}/knowledge`)).knowledge.work || [];
  await until(work, items => items.some(item => /^Assess overlap: /.test(item.title)), 'Discover raises Assess overlap');

  // ---- The assessment's answer: refacet Vision, bind the two (Personas authority, Vision's personas ceded) ----
  const chain = await request('POST', `${api}/overlaps`, { rationale: 'Personas keeps the people we design for.',
    refacets: [{ layer: 'product', change: { op: 'split', facet: 'intent', into: { key: 'personas', title: 'Personas', take: [{ kind: 'persona' }] } } }],
    binding: { concept: { name: 'The people we design for' }, authority: 'personas-people',
      participants: [{ id: 'personas-people', layer: { key: 'personas' }, facet: 'people', role: 'authority', shape: 'personas.people' },
        { id: 'vision-personas', layer: { key: 'product' }, facet: 'personas', role: 'ceded', shape: 'product.personas' }] } });
  await page.goto(origin + base + '/vision/manage/facets');
  const split = facets.getByRole('listitem', { name: /Refacet Vision: split intent into intent and personas/ });
  await split.waitFor({ timeout: 60000 });
  assert.match(await split.textContent(), /Moves 1 persona\./);
  assert.match(await split.textContent(), /1 references from other layers point into what moves\./, 'the preflight finds Pages\' flow');
  await split.getByRole('button', { name: 'Accept' }).click();
  await until(() => facets.locator('.lay-fc-list').first().textContent(), text => /Personas\s*personas/.test(text), 'Vision has a Personas facet');
  const { binding } = await request('POST', `${api}/binding-changes/${chain.proposal.id}/decide`, { decision: 'accept' });

  // ---- Vision's Brief points at Personas; its persona is offered once and adopted ----
  await page.goto(origin + base + '/vision');
  const view = page.frameLocator('.lay-frame-view');
  // A refacet moves the layer's pin, so its views are built again for the new commit before the frame opens.
  await page.locator('.lay-frame-view').waitFor({ timeout: 180000 });
  await until(() => view.locator('.lay-role-note').allTextContents().catch(() => []), texts => texts.some(text => /Now managed in Personas\./.test(text)), 'Vision\'s personas point at Personas');
  assert.equal(await view.getByRole('button', { name: 'Persona', exact: true }).count(), 0, 'no persona can be added in Vision');
  const status = async () => request('GET', `${api}/bindings/${binding.id}/status`);
  const adopt = (await status()).work.find(item => item.kind === 'adopt');
  assert.equal(adopt.entry, persona.id);
  const doc = await request('POST', `${api}/layers/personas/api/createDocument`, { body: { document: { path: 'borrower.md', content: '# Borrower\n\nNeeds a tool once.' } } });
  await request('POST', `${api}/bindings/${binding.id}/adopted`, { workItemId: adopt.id, ref: doc.id });
  const after = await until(status, value => value.work.some(item => item.kind === 'adapter'), 'Pages gets Work for its reference');
  assert.ok(after.binding.correspondence.some(entry => entry.refs['vision-personas'] === persona.id && entry.refs['personas-people'] === doc.id), 'the persona and its document are paired');
  void flow;

  // ---- Merging back, through Manage › Facets ----
  await request('POST', `${api}/bindings/${binding.id}/transfer`, { change: { to: 'vision-personas', roles: { 'personas-people': 'ceded' } }, rationale: 'Personas is retired.' });
  await request('POST', `${api}/bindings/${binding.id}/lifecycle`, { lifecycle: 'retired', rationale: 'Merged back.' });
  await page.goto(origin + base + '/vision/manage/facets');
  const intent = facets.locator('.lay-fc-list').first().getByRole('listitem').filter({ hasText: 'Product intent' });
  await intent.getByRole('button', { name: 'Merge' }).click();
  await facets.getByRole('form', { name: 'Merge into Product intent' }).getByLabel('Merge into Product intent').selectOption('personas');
  await facets.getByRole('button', { name: 'Propose the merge' }).click();
  const merge = facets.getByRole('listitem', { name: /Refacet Vision: merge personas into intent/ });
  await merge.getByRole('button', { name: 'Accept' }).click();
  await until(() => facets.locator('.lay-fc-list').first().textContent(), text => !/Personas\s*personas/.test(text), 'the facets are merged');
  await page.goto(origin + base + '/vision');
  await page.locator('.lay-frame-view').waitFor({ timeout: 180000 });
  await view.getByRole('button', { name: 'Persona', exact: true }).waitFor({ timeout: 60000 });

  // ---- 390px ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + base + '/vision/manage/facets');
  await facets.locator('.lay-fc-list').first().waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 390px');
  await axe('Manage › Facets (390px)');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS Overlap: Personas declares a facet in Manage › Facets, Discover raises Assess overlap, Vision\'s refacet accepted in Manage › Facets, binding accepted, Vision points at Personas, the persona adopted and paired, Pages gets Work for its reference, merged back through Manage › Facets, axe and 390px');
} finally {
  await browser.close();
}
