// T03-G1 (DEC-059): Library › Layers pools every installed layer's outputs and Knowledge with the Library's own content.
// Run through tools/browser-checks.sh library (build first). Screenshots go to MACHINE_DATA_DIR/library-shots.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { chromium } from './browser-support.mjs';

const origin = `http://aludel.localhost:${process.env.MACHINE_PORT || 4318}`;
const out = process.env.LIBRARY_SHOTS || `${process.env.MACHINE_DATA_DIR || '/tmp'}/library-shots`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error' && !/status of 40[49]/.test(msg.text())) errors.push(msg.text()); });
const request = async (method, path, data) => {
  const response = await context.request.fetch(origin + path, { method, data, headers: { 'content-type': 'application/json' } });
  assert.ok(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
  return response.json();
};
const shot = name => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
const step = name => console.log('ok', name);
async function audit(name) {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('main'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    .violations.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`));
  assert.deepEqual(violations, [], `${name} axe`);
}
const rows = () => page.locator('main .lay-insrow');
const settled = async () => { await page.waitForTimeout(350); await page.locator('main [role=status]').first().waitFor(); };

try {
  await page.goto(origin + '/start');
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: /Continue/i }).first().click();
  const name = `LIB ${randomBytes(3).toString('hex')}`;
  await page.getByRole('textbox', { name: 'App name' }).fill(name);
  await page.getByRole('textbox', { name: 'Elevator pitch' }).fill('Neighbours lend and borrow tools.');
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await page.getByRole('button', { name: 'Start with no layers' }).click();
  await request('POST', '/api/accounts', { name: 'Library tester', email: `lib-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  const project = (await request('GET', '/api/session')).projects.find(value => value.name === name);
  for (const key of ['product', 'pages', 'data']) await request('PUT', `/api/projects/${project.id}/layer-instances/${key}`, { enabled: true });
  await request('POST', `/api/projects/${project.id}/records`, { kind: 'source', data: { type: 'note', title: 'Tool survey', body: 'Most drills are used for thirteen minutes.' } });
  const base = `/p/${project.slug}`;

  await page.goto(origin + base + '/library/layers');
  await page.getByRole('link', { name: 'Layers' }).and(page.locator('[aria-current=page]')).waitFor();
  await rows().first().waitFor({ timeout: 10000 }).catch(async () => assert.fail(`the pool lists entries; page shows: ${(await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 900)} ${errors.join(' | ')}`));
  assert.ok(await rows().count() > 3, 'the pool lists entries');
  step('Library › Layers lists the pool');
  await shot('01-layers');
  await audit('Library layers');

  // Knowledge from every installed layer.
  await page.getByRole('combobox', { name: /^Show/ }).selectOption('knowledge');
  await settled();
  const layerNames = await rows().locator('.lay-meta3 span:first-child').allInnerTexts();
  for (const layer of ['Vision', 'Pages', 'Data']) assert.ok(layerNames.includes(layer), `${layer} publishes Knowledge`);
  await page.getByRole('combobox', { name: /^Layer/ }).selectOption('product');
  await settled();
  assert.ok((await rows().locator('.lay-meta3 span:first-child').allInnerTexts()).every(text => text === 'Vision'));
  step('filters by source and layer');

  // Search reaches the Library's own research, then an entry opens.
  await page.getByRole('combobox', { name: /^Layer/ }).selectOption('');
  await page.getByRole('combobox', { name: /^Show/ }).selectOption('');
  await page.getByRole('searchbox', { name: 'Search the Library' }).fill('thirteen minutes');
  await page.waitForFunction(() => [...document.querySelectorAll('main .lay-insrow')].map(row => row.querySelector('strong')?.textContent).join('|') === 'Tool survey');
  await rows().first().click();
  await page.waitForURL(/\/library\/entry\/src-/);
  await page.getByRole('heading', { level: 1, name: 'Tool survey' }).waitFor();
  assert.match(await page.locator('main').innerText(), /thirteen minutes/);
  step('search finds research and opens it');

  // A layer charter opens as a document.
  await page.goto(origin + base + '/library/entry/k:product:identity');
  await page.locator('main .lay-docbody').waitFor();
  assert.match(await page.locator('main').innerText(), /Vision · identity · Knowledge · revision \d+/);
  await shot('02-charter');
  await audit('Library entry');
  step('a layer charter opens from the Library');

  // Phone width.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + base + '/library/layers');
  await settled();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `no horizontal scroll at 390px (${overflow})`);
  await shot('03-narrow');
  await audit('Library layers narrow');
  step('390px');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS library: pool, filters, search, entry, narrow and axe');
} finally {
  await browser.close();
}
