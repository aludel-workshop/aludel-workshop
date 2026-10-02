// T03-DESIGN disposable journey through the Design layer's own frame, on a template-enabled server: a token draft
// previewed live across tabs and saved as one revision, a component, a brand template, a reference to a Library finding,
// the kit in the Library, and accessibility at 390px. Run with tools/browser-checks.sh design-layer.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from './browser-support.mjs';

const origin = `http://aludel.localhost:${process.env.MACHINE_PORT || 4326}`;
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
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
const axe = async (target, name) => {
  await target.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await target.evaluate(async () => (await window.axe.run(document.querySelector('main') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    .violations.map(value => `${value.id}: ${value.nodes[0]?.target}`));
  assert.deepEqual(violations, [], `${name} accessibility`);
};
try {
  await request('PUT', '/api/onboarding/draft', { profile: 'planner' });
  const name = `Tool Share ${randomBytes(3).toString('hex')}`;
  await request('PUT', '/api/onboarding/draft', { name, pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = await request('POST', '/api/accounts', { name: 'Design tester', email: `design-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  await request('PUT', `/api/projects/${project.id}/design`, { feel: 'sleek-saas', theme: 'light', accent: '#2e7d5b', notes: 'Neighbourly and practical.' });
  await request('PUT', `/api/projects/${project.id}/layer-instances/design`, { enabled: true });
  await request('PUT', `/api/projects/${project.id}/features`, { picks: ['accounts'] });
  // A Library finding to reference from a component.
  const { uploaded } = await request('POST', `/api/projects/${project.id}/assets`, { filename: 'sidebar.png', dataUrl: pixel, notes: '', purpose: 'library' });
  const source = await request('POST', `/api/projects/${project.id}/records`, { kind: 'source', data: { type: 'screenshot', title: 'Linear sidebar', assetId: uploaded } });
  const finding = await request('POST', `/api/projects/${project.id}/records`, { kind: 'finding', data: { sourceId: source.id, type: 'image', text: 'The active row uses a subtle font weight.' } });
  const base = `/p/${project.slug}`;
  const bar = page.locator('.lay-layer-outputs');
  const view = page.frameLocator('.lay-frame-view');

  // ---- Tokens: a draft changes the preview at once, and every Design tab previews it until it is saved ----
  await page.goto(origin + base + '/design/tokens');
  await bar.getByRole('link', { name: 'Docs' }).waitFor({ timeout: 30000 });
  assert.deepEqual((await bar.getByRole('link').allInnerTexts()).map(text => text.trim()).filter(Boolean).slice(0, 4), ['Tokens', 'Components', 'Brand', 'Docs']);
  await view.locator('.lay-ds-box').first().waitFor({ timeout: 60000 });
  const primary = canvas => view.locator(canvas).first().evaluate(element => element.style.getPropertyValue('--mat-sys-primary'));
  const before = await primary('.lay-ds-canvas');
  await view.locator('.lay-ds-box[aria-label^="Primary 50"]').click();
  await view.getByRole('dialog', { name: 'Primary 50' }).getByLabel('Hex value').fill('#1f6fb2');
  await view.getByRole('dialog', { name: 'Primary 50' }).getByLabel('Hex value').press('Enter');
  await view.getByRole('dialog', { name: 'Primary 50' }).getByLabel('Close').click();
  const draft = await primary('.lay-ds-canvas');
  assert.notEqual(draft, before, 'the draft changes the preview at once');
  await view.getByText('Unsaved token changes').waitFor();
  await bar.getByRole('link', { name: 'Components' }).click();
  await view.locator('.lay-ds-ccanvas').first().waitFor();
  assert.equal(await primary('.lay-ds-ccanvas'), draft, 'the Components preview shows the unsaved draft');
  await bar.getByRole('link', { name: 'Tokens' }).click();
  await view.getByText('Unsaved token changes').waitFor();
  await view.getByLabel('What changed').fill('Bluer primary');
  await view.getByRole('button', { name: 'Save revision' }).click();
  await page.getByText('Saved as a new revision of the token set.').waitFor();
  const tokens = (await request('GET', `/api/projects/${project.id}/library?kind=design_tokens&source=output&data=1`)).results;
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].layer.key, 'design');
  assert.equal(tokens[0].revision, 2, 'one new revision of the token set');
  assert.equal(tokens[0].data.fromLook, false, 'a person\'s edit stops following the Look & feel');

  // ---- Pages draws its spec preview from its own copy of the kit, which the accepted design-system binding fills
  // (LAYER-BINDINGS-01); with Design off it keeps that copy ----
  await request('PUT', `/api/projects/${project.id}/layer-instances/pages`, { enabled: true });
  let binding;
  for (let i = 0; i < 40 && !(binding = (await request('GET', `/api/projects/${project.id}/bindings`)).bindings.find(entry => entry.lifecycle === 'proposed')); i++) await page.waitForTimeout(250);
  assert.ok(binding, 'Discover proposes the design-system binding');
  await request('POST', `/api/projects/${project.id}/bindings/${binding.id}/lifecycle`, { expectedRevision: binding.revision, lifecycle: 'reconciling', rationale: 'Accepted by the journey.' });
  // The kit arrives from the Library after the preview first draws, so read the theme until it settles.
  const pollTheme = async expected => {
    await page.goto(origin + base + '/pages/page');
    await view.getByRole('navigation', { name: 'Page tree' }).getByRole('link').first().click({ timeout: 60000 });
    await view.locator('.lay-pg-app').first().waitFor();
    let value;
    for (let i = 0; i < 40 && (value = await view.locator('.lay-pg-app').first().evaluate(element => element.style.getPropertyValue('--mat-sys-primary'))) !== expected; i++) await page.waitForTimeout(250);
    return value;
  };
  assert.equal(await pollTheme(draft), draft, 'Pages previews with the saved token set');
  await request('PUT', `/api/projects/${project.id}/layer-instances/design`, { enabled: false });
  assert.equal(await pollTheme(draft), draft, 'without Design, Pages keeps drawing with its copy of the kit');
  await request('PUT', `/api/projects/${project.id}/layer-instances/design`, { enabled: true });
  await page.goto(origin + base + '/design/components');

  // ---- Components: add a needed one, and reference a Library finding on a built one ----
  await bar.getByRole('link', { name: 'Components' }).click();
  await view.getByLabel('New component name').fill('Carousel (large)');
  await view.getByLabel('New component name').press('Enter');
  await view.getByText("Carousel (large) isn't specified yet").waitFor();
  await view.getByRole('complementary', { name: 'Components' }).getByRole('link', { name: /Nav list/ }).click();
  await view.locator('.lay-ds-ccanvas .lay-ds-navitem').first().waitFor();
  await view.locator('.lay-ds-acc > summary', { hasText: 'References' }).click();
  await view.locator('#ds-ref').selectOption(finding.id);
  await view.getByRole('button', { name: 'Add', exact: true }).last().click();
  await view.locator('.lay-ds-ref', { hasText: 'subtle font weight' }).waitFor();

  // ---- Brand: starters are there; a template adds stock assets through the host feature ----
  await bar.getByRole('link', { name: 'Brand' }).click();
  await view.locator('.lay-ds-asset', { hasText: 'Tagline' }).first().waitFor();
  await view.getByRole('button', { name: 'Add from a template' }).click();
  await view.getByRole('button', { name: /Email header/ }).click();
  await view.locator('.lay-ds-asset', { hasText: 'Email sign-off' }).waitFor();
  // An image asset: the upload goes through the uploads feature, then the asset through Design's API and the host's upload check.
  await view.getByRole('button', { name: 'Add asset' }).click();
  await view.locator('.lay-ds-menuitem input[type=file]').setInputFiles({ name: 'shed-logo.png', mimeType: 'image/png', buffer: Buffer.from(pixel.split(',')[1], 'base64') });
  await page.getByText('Image added.').waitFor();
  const brand = (await request('GET', `/api/projects/${project.id}/library?kind=brand_asset&source=output&data=1&limit=100`)).results;
  assert.ok(brand.some(entry => entry.data.type === 'image' && /^asset-/.test(entry.data.assetId) && entry.data.name === 'shed-logo'), 'the uploaded image is a Design brand asset');

  // ---- The kit is in the Library, where other layers read it ----
  await page.goto(origin + base + '/library/layers');
  await page.getByRole('searchbox', { name: 'Search the Library' }).fill('Carousel');
  await page.getByText('Carousel (large)').first().waitFor();
  const components = (await request('GET', `/api/projects/${project.id}/library?kind=component&source=output&data=1&limit=100`)).results;
  assert.ok(components.some(entry => entry.data.name === 'Carousel (large)' && entry.layer.key === 'design'));
  await axe(page, 'Library');

  // ---- Accessibility of the portal and the Design frame, and 390px ----
  await page.goto(origin + base + '/design/components');
  await view.locator('.lay-ds-ccanvas').first().waitFor({ timeout: 60000 });
  const frame = () => page.frames().find(value => /\.layers\./.test(value.url()));
  await axe(page, 'portal');
  await axe(frame(), 'Design frame (components)');
  await page.goto(origin + base + '/design/tokens');
  await view.locator('.lay-ds-box').first().waitFor({ timeout: 60000 });
  await axe(frame(), 'Design frame (tokens)');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + base + '/design/brand');
  await view.locator('.lay-ds-asset').first().waitFor({ timeout: 60000 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'no sideways scroll at 390px');
  await axe(frame(), 'Design frame (brand, 390px)');
  assert.deepEqual(errors, []);
  console.log('PASS Design frame: token draft live across tabs and saved, component, reference, brand template and image, Pages theme through the binding and kept without Design, Library, axe and 390px');
} finally { await browser.close(); }
