// CUSTOM-LAYER-01 layer navigation contract: every layer page has one heading and one bar (output tabs, then Tasks and
// Manage), no nested tab rows, and the same Tasks and Manage for built-in and custom layers.
// Run through tools/browser-checks.sh layer-bar (build first). Screenshots go to MACHINE_DATA_DIR/layer-bar-shots.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { chromium } from './browser-support.mjs';

const origin = `http://aludel.localhost:${process.env.MACHINE_PORT || 4318}`;
const out = process.env.LAYER_BAR_SHOTS || `${process.env.MACHINE_DATA_DIR || '/tmp'}/layer-bar-shots`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error' && !/status of 40[49]/.test(msg.text())) errors.push(msg.text()); });
page.on('dialog', dialog => dialog.accept());
const request = async (method, path, data) => {
  const response = await context.request.fetch(origin + path, { method, data, headers: { 'content-type': 'application/json' } });
  assert.ok(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
  return response.json();
};
const shot = name => page.screenshot({ path: `${out}/${name}.png` });
const step = name => console.log('ok', name);
async function audit(name) {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('main'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`));
  assert.deepEqual(violations, [], `${name} axe`);
}
// The contract: one h1, one layer bar, no other tab rows on the page.
async function oneBar(label, outputs) {
  await page.locator('.lay-layer-bar').waitFor();
  const shape = await page.evaluate(() => ({
    h1: document.querySelectorAll('main h1').length, bars: document.querySelectorAll('.lay-layer-bar').length,
    nested: document.querySelectorAll('main .lay-tabs:not(.lay-gap-top), main .lay-pa-subnav, main .lay-shared-tabs').length,
    outputs: [...document.querySelectorAll('.lay-layer-outputs a')].map(a => a.textContent.trim()),
    fixed: [...document.querySelectorAll('.lay-layer-fixed a')].map(a => [...a.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim())
  }));
  assert.deepEqual(shape, { h1: 1, bars: 1, nested: 0, outputs, fixed: ['Tasks', 'Knowledge', 'Manage'] }, `${label} layer bar`);
}
const url = () => new URL(page.url()).pathname;

try {
  await page.goto(origin + '/start');
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: /Continue/i }).first().click();
  const name = `BAR ${randomBytes(3).toString('hex')}`;
  await page.getByRole('textbox', { name: 'App name' }).fill(name);
  await page.getByRole('textbox', { name: 'Elevator pitch' }).fill('Check the layer bar.');
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await page.getByRole('button', { name: 'Start with no layers' }).click();
  await request('POST', '/api/accounts', { name: 'Bar tester', email: `bar-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  const project = (await request('GET', '/api/session')).projects.find(value => value.name === name);
  await request('PUT', `/api/projects/${project.id}/layer-instances/pages`, { enabled: true });
  const base = `/p/${project.slug}`;

  // Built-in layer: heading above one bar.
  await page.goto(origin + base + '/pages');
  await oneBar('Pages map', ['Map', 'Pages', 'Flows', 'Kit']);
  assert.equal(await page.locator('main h1').innerText(), 'Pages');
  await shot('01-pages-map');
  await page.locator('.lay-layer-outputs a', { hasText: 'Flows' }).click();
  await page.waitForURL(/\/pages\/flows$/);
  await oneBar('Pages flows', ['Map', 'Pages', 'Flows', 'Kit']);
  step('built-in layer: heading, one bar, output tabs switch');

  // Tasks: Work's own board, the Roles-style Actions and a Routines list, picked from a sidebar (no second tab row).
  await page.locator('.lay-layer-fixed a', { hasText: 'Tasks' }).click();
  await page.waitForURL(/\/pages\/tasks$/);
  await oneBar('Pages tasks', ['Map', 'Pages', 'Flows', 'Kit']);
  const tasksNav = page.getByRole('navigation', { name: 'Pages tasks' });
  const sectionNames = await tasksNav.locator('a').evaluateAll(links => links.map(a => [...a.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim()));
  // DEC-057: a layer-scoped Pages (its template publishes an API) shows Access instead of an action list.
  const scoped = Boolean((await request('GET', `/api/projects/${project.id}/layer-instances`)).layers.find(entry => entry.key === 'pages')?.workScope);
  assert.deepEqual(sectionNames, ['Board', scoped ? 'Access' : 'Actions', 'Routines', 'All work']);
  await page.locator('aludel-layer-tasks aludel-work-board .lay-kb').waitFor();
  await page.locator('aludel-layer-tasks .lay-kb-col[data-col="draft"]').waitFor();
  await shot('02-pages-tasks');
  await audit('Pages tasks');

  // A task created from the layer is an ordinary Work item, and comes back to the layer board as the same card.
  await page.locator('aludel-work-board').getByRole('link', { name: 'Create task' }).click();
  await page.waitForURL(/\/pages\/tasks\/create$/);
  await page.getByRole('dialog', { name: 'Create task', exact: true }).waitFor();
  await oneBar('Pages create task', ['Map', 'Pages', 'Flows', 'Kit']);
  assert.equal(await page.locator('aludel-work-create select[name="role"]').count(), 0, 'the layer is fixed inside its own Tasks');
  const actionId = scoped ? null : await page.locator('aludel-work-create select[name="action"]').inputValue();
  if (scoped) assert.equal(await page.locator('aludel-work-create select[name="action"]').count(), 0, 'a layer-scoped task names no action');
  else assert.match(actionId, /^pages\./);
  await page.getByLabel('Title', { exact: true }).fill('Check the checkout flow');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL(/\/work\/item\//);
  await page.goto(origin + base + '/pages/tasks');
  const card = page.locator('aludel-layer-tasks .lay-kb-card', { hasText: 'Check the checkout flow' });
  await card.waitFor();
  if (scoped) {
    await tasksNav.getByRole('link', { name: /^Access/ }).click();
    await page.waitForURL(/\/pages\/tasks\/access$/);
    await page.getByRole('heading', { name: 'Access', level: 2 }).waitFor();
    await oneBar('Pages access', ['Map', 'Pages', 'Flows', 'Kit']);
    await shot('02b-pages-access');
    await audit('Pages access');
    step('Tasks: Work board and cards; create in the layer, open in Work, back as a card; Access for a layer-scoped layer');
  } else {
    await card.locator('.lay-rolechip').click();
    await page.waitForURL(new RegExp(`/pages/tasks/actions/${actionId.replace('.', '\\.')}$`));
    await page.locator(`[id="setup-${actionId}"]`).waitFor();
    step('Tasks: Work board and cards; create in the layer, open in Work, back as a card; card chip opens its action');
    await oneBar('Pages actions', ['Map', 'Pages', 'Flows', 'Kit']);
    const row = page.locator(`[id="action-${actionId}"]`);
    await row.locator('aludel-assignee').waitFor();
    await row.locator(`[id="setup-${actionId}"] h4`, { hasText: 'Done when' }).waitFor();
    await row.locator(`[id="setup-${actionId}"] h4`, { hasText: 'Always reads' }).waitFor();
    await shot('02b-pages-actions');
    await audit('Pages actions');
  }
  await tasksNav.getByRole('link', { name: /^Routines/ }).click();
  await page.waitForURL(/\/pages\/tasks\/routines$/);
  await page.getByRole('region', { name: 'Pages routines' }).waitFor();
  await page.getByRole('link', { name: 'Discover neighboring layers' }).click();
  await page.waitForURL(/\/tasks\/routines\/discovery$/);
  await page.locator('.lay-back', { hasText: 'Routines' }).click();
  await page.waitForURL(/\/pages\/tasks\/routines$/);
  await page.getByRole('button', { name: 'New routine' }).click();
  await page.waitForURL(/\/pages\/tasks\/routines\/[^/]+$/);
  await page.locator('#rt-title').waitFor();
  await oneBar('Pages routine', ['Map', 'Pages', 'Flows', 'Kit']);
  await page.locator('#rt-title').fill('Weekly flow audit');
  await page.getByLabel('Trigger').selectOption('schedule');
  await page.getByLabel('Cadence').selectOption('weekly');
  await page.getByRole('button', { name: 'Save routine' }).click();
  await page.locator('.success-message', { hasText: 'Routine saved' }).waitFor();
  await page.getByRole('heading', { name: 'Weekly flow audit' }).waitFor();
  await shot('02c-pages-routine');
  await audit('Pages routine');
  await page.locator('.lay-back', { hasText: 'Routines' }).click();
  await page.getByRole('region', { name: 'Pages routines' }).getByRole('link', { name: 'Weekly flow audit' }).waitFor();
  assert.equal(await tasksNav.locator('a', { hasText: 'Weekly flow audit' }).count(), 0, 'routines are listed on their page, not in the sidebar');
  step('Tasks: Roles-style actions; routine list, detail with a way back, and a saved schedule');

  // Manage: settings only (LAYER-KNOWLEDGE-01: Connections gave way to bindings, proposed from Knowledge).
  await page.locator('.lay-layer-fixed a', { hasText: 'Manage' }).click();
  await page.waitForURL(/\/pages\/manage$/);
  await page.locator('aludel-layer-manage').waitFor();
  await oneBar('Pages manage', ['Map', 'Pages', 'Flows', 'Kit']);
  await page.getByLabel('Name', { exact: true }).fill('Screens');
  await page.getByLabel('Search icons').fill('rou');
  await page.locator('.lay-mg-icons label[title="route"]').click();
  await page.locator('.lay-mg-colours label').nth(6).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('.success-message', { hasText: 'Layer settings saved' }).waitFor();
  const railTile = await page.locator('.lay-nav a.lay-lc-pages .lay-tile').evaluate(el => ({ icon: el.textContent.trim(), bg: getComputedStyle(el).backgroundColor }));
  assert.equal(railTile.icon, 'route');
  assert.equal(railTile.bg, 'rgb(46, 125, 50)', 'the rail tile takes the chosen colour (#2e7d32, the sixth swatch after Default; active tiles are solid)');
  await page.locator('main h1', { hasText: 'Screens' }).waitFor();
  await page.locator('.lay-nav a.lay-lc-pages', { hasText: 'Screens' }).waitFor();
  // Other screens label layers through the shared name map; the built-in's new name must reach them too.
  await page.goto(origin + base + '/work');
  await page.waitForFunction(() => !/\bPages\b/.test(document.querySelector('main')?.innerText || '') || /Screens/.test(document.querySelector('main')?.innerText || ''), null, { timeout: 10000 });
  await page.goto(origin + base + '/pages/manage');
  await page.locator('aludel-layer-manage').waitFor();
  await shot('03-pages-manage-settings');
  await audit('Pages manage settings');
  assert.equal(await page.locator('.lay-mg-side .lay-mg-doc').count(), 0, 'Manage lists no Knowledge documents');
  assert.equal(await page.locator('.lay-mg-side a', { hasText: 'Activate' }).count(), 0, 'an active layer has no Activate step');
  assert.equal(await page.locator('.lay-mg-side a', { hasText: /Connections|Facets/ }).count(), 0, 'no Connections or Facets in Manage');

  // Knowledge is its own tab, a docs site: the overview, then the charter, edited and saved at once.
  await page.locator('.lay-layer-fixed a', { hasText: 'Knowledge' }).click();
  await page.waitForURL(/\/pages\/knowledge$/);
  await page.locator('aludel-layer-knowledge .kn-title').waitFor();
  await oneBar('Pages knowledge', ['Map', 'Pages', 'Flows', 'Kit']);
  await page.locator('.kn-side').getByRole('link', { name: 'Charter', exact: true }).click();
  await page.locator('.kn-read').getByRole('button', { name: 'Edit' }).click();
  const charter = page.locator('.kn-editor textarea');
  await page.waitForFunction(() => /^## Purpose$/m.test(document.querySelector('.kn-editor textarea')?.value || ''));
  await charter.fill((await charter.inputValue()) + '\n## Accessibility\n\nEvery flow is checked at 390px and with a keyboard.\n');
  await page.locator('.kn-read').getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('.success-message', { hasText: 'Saved.' }).waitFor();
  await page.locator('.kn-md', { hasText: 'Every flow is checked at 390px' }).waitFor();
  await shot('04-pages-knowledge');
  await audit('Pages knowledge');
  await page.locator('.kn-side .kn-link', { hasText: 'Flow method' }).click();
  await page.waitForURL(/\/pages\/knowledge\/doc\/.+/);
  step('Knowledge tab: a docs site whose charter is saved at once for a built-in; Manage has settings only');

  // Old links open their new places.
  for (const [from, to] of [['/pages/operations', '/pages/tasks'], ['/pages/operations/routines', '/pages/tasks/routines'], ['/pages/operations/connections', '/pages/manage/connections'], ['/pages/manage/knowledge', '/pages/knowledge'], ['/pages/operations/actions', '/pages/tasks/actions']]) {
    await page.goto(origin + base + from);
    await page.waitForURL(url => url.pathname === base + to);
  }
  step('legacy Operations, Setup and Manage › Knowledge links redirect');

  // Custom layer: a draft opens on Manage › Activate, with a badge and a banner elsewhere until it is active.
  const layer = await request('POST', `/api/projects/${project.id}/layer-definitions`, { name: 'Research' });
  await page.goto(origin + base + '/' + layer.key);
  await page.locator('aludel-layer-manage h2', { hasText: 'Activate Research' }).waitFor();
  await oneBar('Research draft', ['Files']);
  await page.locator('.lay-layer-draft').waitFor();
  assert.equal((await page.locator('.lay-layer-fixed .lay-layer-count-warn').innerText()).trim(), '8', 'Manage badge counts the steps left');
  assert.equal(await page.locator('.lay-draft-banner').count(), 0, 'no banner on the Activate page itself');
  await shot('05-research-activate');
  await audit('Research activate');
  await page.locator('.lay-layer-outputs a', { hasText: 'Files' }).click();
  await page.locator('.lay-draft-banner', { hasText: '0 of 8 steps done' }).waitFor();
  await page.locator('.lay-mg-side a, .lay-layer-fixed a', { hasText: 'Manage' }).first().click();
  await page.locator('.lay-mg-side a', { hasText: 'Settings' }).click();
  await page.waitForURL(/\/manage\/settings$/);
  await page.locator('.lay-mg-icons').waitFor();
  await page.getByLabel('Name', { exact: true }).fill('Field research');
  await page.getByLabel('Search icons').fill('science');
  await page.locator('.lay-mg-icons label[title="science"]').click();
  await page.locator('.lay-mg-colours label').nth(9).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('main h1', { hasText: 'Field research' }).waitFor();
  await page.locator('.lay-nav a', { hasText: 'Field research' }).waitFor();

  // The charter is written in Knowledge, from the seeded headings; the checklist follows it.
  await page.locator('.lay-mg-side a', { hasText: 'Activate' }).click();
  await page.getByRole('link', { name: 'Open the charter in Knowledge' }).click();
  await page.waitForURL(new RegExp(`/${layer.key}/knowledge/doc/charter$`));
  await page.locator('.kn-read').getByRole('button', { name: 'Edit' }).click();
  await page.waitForFunction(() => /<!--/.test(document.querySelector('.kn-editor textarea')?.value || ''), null, { timeout: 10000 });
  const seeded = await page.locator('.kn-editor textarea').inputValue();
  const answers = { 'Purpose': 'Collect and interpret customer research.', 'Contents and scope': 'Interviews, sources and synthesized findings.', 'Methodology': 'Record sources, then synthesize patterns.',
    'Output conventions and taxonomy': 'One Markdown file per source under sources/.', 'Quality bar': 'Every claim cites a source and date.', 'Role in the project': 'Evidence for product decisions in Vision.',
    'How this layer works with others': 'Publishes findings; reads the Vision brief.' };
  let written = seeded;
  for (const [heading, answer] of Object.entries(answers)) written = written.replace(new RegExp(`(## ${heading}\\n\\n)<!--[^>]*-->`), `$1${answer}`);
  await page.locator('.kn-editor textarea').fill(written);
  await page.locator('.kn-read').getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('.success-message', { hasText: 'Saved.' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.kn-checks li.done').length === 7, null, { timeout: 10000 });
  await page.locator('.lay-draft-banner', { hasText: '7 of 8 steps done' }).waitFor();
  await shot('06-research-charter');
  await audit('Research charter');

  await page.goto(origin + base + '/' + layer.key + '/manage/activate');
  await page.getByRole('link', { name: 'Open Tasks › Actions' }).click();
  await page.waitForURL(/\/tasks\/actions$/);
  // The URL changes a moment before the view does; wait for the New action row itself.
  await page.locator('#action-new').waitFor();
  await page.locator('#action-new').getByRole('button', { name: 'Add' }).click();
  await page.locator('#new-action-title').fill('Add a source');
  await page.waitForFunction(() => document.querySelector('#new-action-key')?.value === 'add_a_source', null, { timeout: 5000 });
  await page.locator('#new-action-purpose').fill('Capture a source with provenance.');
  await page.locator('#new-action-method').fill('Record the citation, then summarise the claims it supports.');
  await page.locator('#new-action-checks').fill('Source and date are recorded');
  await shot('05b-research-new-action');
  await audit('Research new action');
  await page.getByRole('button', { name: 'Add action' }).click();
  await page.locator('.success-message', { hasText: 'Action added' }).waitFor();
  await page.goto(origin + base + '/' + layer.key + '/manage');
  await page.getByRole('button', { name: 'Activate Field research' }).click();
  await page.waitForURL(new RegExp(`/${layer.key}/tasks$`));
  await page.locator('.lay-layer-draft').waitFor({ state: 'detached' });
  await page.goto(origin + base + '/' + layer.key + '/tasks/actions');
  await page.locator(`[id="action-${layer.key}.add_a_source"] aludel-assignee`).waitFor();
  assert.equal(await page.locator('.lay-draft-banner, .lay-layer-count-warn').count(), 0, 'banner and badge clear once active');
  step('custom draft: Activate landing, badge, banner, charter written in Knowledge, action, activate');

  await page.locator('.lay-layer-outputs a', { hasText: 'Files' }).click();
  await page.locator('.mde').waitFor();
  await oneBar('Research files', ['Files']);
  await audit('Research files');
  await shot('06-research-files');
  await page.goto(origin + base + '/' + layer.key + '/setup');
  await page.waitForURL(url => url.pathname === `${base}/${layer.key}/manage/activate`);
  step('custom output tab, and old Setup link opens Activate');

  // The rail collapses to icons and remembers it.
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.waitForFunction(() => document.querySelector('.lay-rail').getBoundingClientRect().width <= 70, null, { timeout: 5000 });
  assert.equal(await page.getByRole('link', { name: 'Field research' }).count() >= 1, true, 'collapsed links keep their names');
  await shot('07-rail-collapsed');
  await page.reload();
  await page.getByRole('button', { name: 'Expand sidebar' }).waitFor();
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  step('rail collapses to an icon rail and remembers it');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/pages/tasks', scoped ? '/pages/tasks/access' : '/pages/tasks/actions', '/pages/tasks/routines', '/pages/manage', `/${layer.key}`]) {
    await page.goto(origin + base + path);
    await page.locator('.lay-layer-bar').waitFor();
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `${path} at 390px overflows by ${overflow}`);
  }
  await page.goto(origin + base + '/pages/manage');
  await shot('08-narrow-manage');
  step('390px: no horizontal page scroll');

  assert.deepEqual(errors, [], 'page errors');
  console.log('PASS layer bar: one heading and bar, Tasks (Work board, Roles actions, routines) and Manage for built-in and custom layers, redirects, rail, axe, 390px');
} catch (error) {
  await shot('failure').catch(() => {});
  console.error(error); console.error('page errors:', errors); process.exitCode = 1;
} finally { await browser.close(); }
