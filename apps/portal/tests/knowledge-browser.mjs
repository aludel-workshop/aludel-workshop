// LAYER-KNOWLEDGE-01 journey, on a template-enabled server: a layer's Knowledge tab as its manual. Pages' overview, docs
// and Information; editing the charter (Save takes at once) and comparing two versions; Vision's Personas part with its
// contents; a new Personas layer describing its personas folder (which raises Compare specs); binding that folder with
// Vision's personas from the tree (Vision hands over), accepted in one step; Manage keeps only Activate and Settings.
// Axe at each page; 390 px. Run with tools/browser-checks.sh knowledge. KN_SHOTS=<dir> also saves screenshots.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { chromium } from './browser-support.mjs';

const origin = `http://aludel.localhost:${process.env.MACHINE_PORT || 4326}`;
const shots = process.env.KN_SHOTS || '';
if (shots) mkdirSync(shots, { recursive: true });
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
let n = 0;
const shot = async name => { if (shots) await page.screenshot({ path: `${shots}/${String(++n).padStart(2, '0')}-${name}.png`, fullPage: true }); };
const axe = async name => {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('main') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    .violations.map(value => `${value.id}: ${value.nodes.slice(0, 3).map(node => node.target).join(' | ')}`));
  assert.deepEqual(violations, [], `${name} accessibility`);
};
const side = () => page.locator('.kn-side');
const read = () => page.locator('.kn-read');

try {
  await request('PUT', '/api/onboarding/draft', { profile: 'planner' });
  await request('PUT', '/api/onboarding/draft', { name: `Tool Share ${randomBytes(3).toString('hex')}`, pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = await request('POST', '/api/accounts', { name: 'Knowledge tester', email: `kn-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  for (const key of ['design', 'pages', 'product']) await request('PUT', `/api/projects/${project.id}/layer-instances/${key}`, { enabled: true });
  const api = `/api/projects/${project.id}`, base = `/p/${project.slug}`;
  const persona = await request('POST', `${api}/layers/product/api/createPersona`, { body: { persona: { name: 'Borrower', role: 'Needs a tool once' } } });
  await request('POST', `${api}/layers/pages/api/createFlow`, { body: { flow: { title: 'Borrow a drill', persona: persona.id, steps: [] } } });

  // ---- Pages' Knowledge: the overview, then Docs on top and Information underneath, in one sidebar ----
  await page.goto(origin + base + '/pages/knowledge');
  await read().getByRole('heading', { name: 'Pages', level: 2 }).waitFor({ timeout: 60000 });
  assert.match(await read().textContent(), /What Pages keeps/);
  for (const name of ['Map', 'Pages', 'Flows']) await read().locator('.kn-tile', { hasText: name }).first().waitFor();
  const headings = await side().locator('.kn-sec').allTextContents();
  assert.deepEqual(headings.map(text => text.replace(/(checklist)?\s*Select$/, '').trim()), ['Docs', 'Information']);
  for (const name of ['Overview', 'Charter']) await side().getByRole('link', { name, exact: true }).waitFor();
  await side().getByRole('button', { name: 'Editor tabs' }).waitFor();
  await page.locator('.kn-outline').getByRole('link', { name: 'What it keeps' }).waitFor();
  await shot('pages-overview'); await axe('Knowledge overview');

  // ---- The charter: Save takes at once; two versions compare ----
  await side().getByRole('link', { name: 'Charter', exact: true }).click();
  await read().getByRole('heading', { name: 'Charter', level: 2 }).waitFor();
  await read().getByRole('button', { name: 'Edit' }).click();
  const editor = read().locator('.kn-editor textarea');
  await editor.fill(`${await editor.inputValue()}\n## Notes\n\nTool Share starts with lending between neighbours.`);
  await read().locator('.kn-preview').getByText('Tool Share starts with lending').waitFor();
  await shot('charter-editing');
  await read().getByRole('button', { name: 'Save' }).click();
  await page.getByText('Saved.').first().waitFor();
  await read().locator('.kn-md').getByText('Tool Share starts with lending').waitFor();
  await read().getByRole('button', { name: 'History' }).click();
  const versions = read().locator('.kn-history input[type=checkbox]');
  await versions.nth(0).check(); await versions.nth(1).check();
  await read().locator('.kn-d-add', { hasText: 'Tool Share starts with lending' }).waitFor();
  await shot('charter-compare'); await axe('Charter history');

  // ---- Vision's Personas: spec, contents, where it is edited ----
  await page.goto(origin + base + '/vision/knowledge/node/personas');
  await read().getByRole('heading', { name: 'Personas', level: 2 }).waitFor({ timeout: 30000 });
  await read().getByRole('link', { name: 'Edited in the Brief tab' }).waitFor();
  await read().locator('.kn-table').first().getByText('name', { exact: true }).waitFor();
  await read().getByRole('link', { name: 'Borrower' }).waitFor();
  assert.match(await read().textContent(), /Not shared\. Only Vision uses it\./);
  assert.match(await read().textContent(), /Referenced by\s*Pages \(1\)/);
  await shot('vision-personas'); await axe('Knowledge part');

  // ---- A new Personas layer says what its personas folder is; that raises Compare specs ----
  await request('POST', `${api}/layer-definitions`, { name: 'Personas', key: 'personas', template: 'markdown' });
  await request('POST', `${api}/layers/personas/api/createFolder`, { body: { folder: { path: 'personas' } } });
  await request('POST', `${api}/layers/personas/api/createDocument`, { body: { document: { path: 'personas/lender.md', content: '# Lender\n\n> Owns tools that sit idle.' } } });
  await page.goto(origin + base + '/personas/knowledge/info');
  await read().getByRole('heading', { name: 'Information', level: 2 }).waitFor({ timeout: 60000 });
  await read().getByRole('button', { name: 'Add a part' }).click();
  const form = read().getByRole('form', { name: 'Add a part' });
  await form.getByLabel('Title').fill('Personas');
  await form.getByLabel('What it is for').fill('One document per person we design for, in the format below.');
  await form.getByLabel('Inside').selectOption({ label: 'Documents' });
  await form.getByLabel('Covers').selectOption('markdown_document');
  await form.getByLabel('Only where').fill('folder');
  await form.getByLabel('is', { exact: true }).fill('personas');
  await form.getByLabel('Required format (optional)').fill('# {Name}\n\n> {Their situation}\n\n## Needs\n- …');
  await form.getByLabel('About (Markdown)').fill('Each file in `personas/` describes one person. The file name is the persona\'s key.');
  await shot('personas-add-part');
  await form.getByRole('button', { name: 'Save' }).click();
  await read().getByRole('heading', { name: 'Personas', level: 2 }).waitFor();
  await read().locator('.kn-fmt', { hasText: '{Their situation}' }).waitFor();
  await read().locator('.kn-md', { hasText: 'describes one person' }).waitFor();
  await read().getByRole('link', { name: 'lender.md' }).waitFor();
  const work = (await request('GET', `${api}/knowledge`)).knowledge.work || [];
  assert.ok(work.some(item => /^Compare specs: Personas's spec changed/.test(item.title)), 'a spec change creates a task');
  await shot('personas-part');

  // ---- Bind it with Vision's personas from the tree: Personas leads, Vision hands over ----
  await read().getByRole('button', { name: 'Bind…' }).first().click();
  await side().getByRole('button', { name: 'Propose a binding' }).click();
  await read().getByRole('heading', { name: 'Propose a binding', level: 2 }).waitFor();
  await read().getByRole('combobox', { name: /Add a layer/ }).selectOption({ label: 'Vision' });
  const vision = read().getByRole('listitem', { name: 'Vision' });
  await vision.getByRole('checkbox', { name: /Personas/ }).check();
  await vision.getByRole('checkbox', { name: 'Keep a local copy' }).uncheck();
  await read().getByLabel('Name').fill('The people we design for');
  await read().getByLabel('How the parts match').fill('Personas holds the full portraits of the people Vision names in one line. Personas leads; Vision points to it.');
  await read().getByText(/Vision's Personas hand over to Personas/).waitFor();
  await read().getByText(/Pages points at Vision's Personas \(1 reference\)/).waitFor();
  assert.equal(await read().getByRole('listitem', { name: 'Personas' }).getByRole('button', { name: 'Leads' }).getAttribute('aria-pressed'), 'true');
  await shot('propose'); await axe('Propose a binding');
  // The lead is a toggle: try Vision, then back.
  await vision.getByRole('button', { name: 'Make lead' }).click();
  await read().getByText(/Vision's Personas lead/).waitFor();
  await read().getByRole('listitem', { name: 'Personas' }).getByRole('button', { name: 'Make lead' }).click();
  await read().getByText(/Personas's Personas lead/).waitFor();
  await read().getByRole('button', { name: 'Propose', exact: true }).click();
  await read().getByRole('heading', { name: 'The people we design for', level: 2 }).waitFor();
  await side().locator('.kn-card.kn-proposed', { hasText: 'The people we design for' }).waitFor();
  await shot('proposed'); await axe('Proposed binding');
  await read().getByRole('button', { name: 'Accept' }).click();
  await page.getByText(/Accepted\./).first().waitFor({ timeout: 60000 });
  await read().locator('.lay-chip', { hasText: 'Live' }).first().waitFor();
  await shot('accepted');

  // ---- Vision now shows the card: its Personas hand over, Personas leads ----
  await page.goto(origin + base + '/vision/knowledge');
  const card = side().locator('.kn-card', { hasText: 'The people we design for' });
  await card.waitFor({ timeout: 30000 });
  assert.match((await card.textContent()).replace(/\s+/g, " "), /with Personas · hands over · Personas leads/);
  await card.getByRole('link', { name: 'Personas', exact: true }).click();
  await read().getByRole('heading', { name: 'Personas', level: 2 }).waitFor();
  await read().locator('.kn-meta').getByRole('link', { name: /The people we design for · hands over/ }).waitFor();
  await shot('vision-after');

  // ---- Manage keeps Activate and Settings only ----
  await page.goto(origin + base + '/pages/manage');
  await page.locator('.lay-mg-side').waitFor();
  assert.deepEqual((await page.locator('.lay-mg-side a').allTextContents()).map(text => text.replace(/^tune/, '').trim()), ['Settings']);

  // ---- 390 px ----
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/pages/knowledge', '/vision/knowledge/node/personas', '/personas/knowledge/info']) {
    await page.goto(origin + base + path);
    await read().locator('.kn-title').waitFor({ timeout: 30000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `no horizontal scroll at 390px on ${path}`);
  }
  await page.getByRole('button', { name: /Personas knowledge/ }).click();
  await side().getByRole('link', { name: 'Charter' }).waitFor();
  await shot('phone-sidebar'); await axe('Knowledge at 390px');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS Knowledge: overview, docs and Information in one sidebar; charter saved at once and two versions compared; a part with its shape, contents and references; a new layer\'s spec part (raising Compare specs); bound from the tree with Vision handing over, accepted in one step; Manage without Connections or Facets; axe and 390px');
} catch (error) {
  if (shots) await page.screenshot({ path: `${shots}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
