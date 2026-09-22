// LAY-02/03: a project's layers at /p/<slug>. Sets a project up through the same APIs onboarding uses, builds it,
// then drives every layer in the browser. Usage: start a fresh portal, then MACHINE_PORT=<port> PLAYWRIGHT_MODULE=<…> node tests/layers-browser.mjs
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from './browser-support.mjs';

const port = process.env.MACHINE_PORT || 4318;
const portal = `http://aludel.localhost:${port}`;
mkdirSync('test-results/layers', { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const axe = async page => {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(item => `${item.id}: ${item.nodes[0]?.target}`));
};
const until = async (check, message) => { for (let i = 0; i < 40 && !(await check()); i++) await new Promise(resolve => setTimeout(resolve, 150)); assert.ok(await check(), message); };

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, bypassCSP: true });
  const api = context.request;
  const json = async (method, path, data) => { const response = await api.fetch(`${portal}${path}`, { method, data, headers: { 'content-type': 'application/json' } }); assert.ok(response.ok(), `${method} ${path} → ${response.status()} ${await response.text()}`); return response.json(); };
  await json('PUT', '/api/onboarding/draft', { profile: 'planner' });
  await json('PUT', '/api/onboarding/draft', { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = await json('POST', '/api/accounts', { name: 'Ada Lovelace', email: 'ada@example.com', password: 'correct-horse-battery' });
  await json('PUT', `/api/projects/${project.id}/design`, { feel: 'mobile-social', theme: 'light', accent: '#e0457b' });
  await json('PUT', `/api/projects/${project.id}/features`, { picks: ['accounts', 'messaging'] });
  await json('POST', `/api/projects/${project.id}/skeleton`, {});
  for (let i = 0; i < 90 && (await json('GET', `/api/projects/${project.id}/preview`)).preview.status !== 'running'; i++) await new Promise(resolve => setTimeout(resolve, 1000));

  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const layerNav = () => page.getByRole('navigation', { name: 'Layers' });
  const checked = [];
  const check = async name => { assert.deepEqual(await axe(page), [], `${name} has accessibility violations`); await page.screenshot({ path: `test-results/layers/${name}.png`, fullPage: true }); checked.push(name); };

  // Home
  await page.goto(`${portal}/p/tool-share`);
  await page.getByRole('heading', { name: 'Tool Share', level: 1 }).waitFor();
  await page.getByText('Neighbours lend and borrow tools they rarely use.').first().waitFor();
  await page.getByRole('heading', { name: 'Demo phase' }).waitFor();
  assert.match(await page.locator('.lay-legend').innerText(), /3 Built/, 'the Accounts template stories are built after the build');
  await check('home');

  // Product › Vision
  await layerNav().getByRole('link', { name: 'Product' }).click();
  await page.getByRole('heading', { name: 'What we\'re building, and why' }).waitFor();
  await page.getByRole('heading', { name: 'Principles' }).locator('..').getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Principles (one per line)').fill('Neighbourly, never transactional\nRough distance only, never addresses');
  await page.getByLabel('Why this change').fill('From the first interviews');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Rough distance only, never addresses').waitFor();
  await page.getByLabel('Name', { exact: true }).fill('Sam');
  await page.getByLabel('Role').fill('Borrower');
  await page.getByLabel('What they need').fill('Needs a tool once, hates buying it');
  await page.getByRole('button', { name: 'Add persona' }).click();
  await page.getByText('Sam · Borrower').waitFor();
  await check('product-vision');

  // Product › Story map
  await page.getByRole('link', { name: 'Story map' }).click();
  const map = page.getByRole('region', { name: 'Story map' });
  await map.getByText('Join').first().waitFor();
  assert.equal(await map.locator('.lay-pack').count(), 2, 'both packs are marked on the map');
  assert.equal(await map.locator('.lay-story-card.built').count(), 3, 'template-built stories show as built');
  await page.getByPlaceholder('New activity, e.g. “Give it back”').fill('Borrow');
  await page.getByRole('button', { name: 'Add activity' }).click();
  await page.getByText('Added “Borrow”').waitFor();
  await map.getByRole('button', { name: 'Add a Demo story to First step' }).click();
  await map.getByLabel('New story').fill('Sam can ask to borrow a tool for specific dates');
  await map.getByRole('button', { name: 'Add', exact: true }).click();
  await map.getByRole('link', { name: /Sam can ask to borrow a tool/ }).click();
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('heading', { name: 'Sam can ask to borrow a tool for specific dates' }).waitFor();
  await drawer.getByRole('button', { name: 'Add scenario' }).click();
  await drawer.getByLabel('Given').fill('an available tool');
  await drawer.getByLabel('When').fill('Sam picks dates and sends a request');
  await drawer.getByLabel('Then', { exact: true }).fill('the lender sees the request with the dates');
  await drawer.getByLabel('Why this change (saved with the revision)').fill('Agreed with Priya in the kickoff');
  await drawer.getByRole('button', { name: 'Save story' }).click();
  await drawer.getByText('Agreed with Priya in the kickoff').waitFor();
  await until(async () => (await drawer.locator('.lay-chip').first().innerText()) === 'Defined', 'acceptance makes the story Defined');
  await check('product-map-story');
  await drawer.getByRole('link', { name: 'Close story' }).click();

  // Product › Specs, Docs, Research, Roadmap
  await page.getByRole('link', { name: 'Specs' }).click();
  await page.getByPlaceholder(/New spec/).fill('Ask to borrow, and get an answer');
  await page.getByRole('button', { name: 'New spec' }).click();
  await page.getByRole('button', { name: 'Save spec' }).waitFor();
  await page.getByRole('checkbox', { name: /Sam can ask to borrow/ }).check();
  await page.getByLabel('Problem').fill('Sam can find a tool but cannot ask for it.');
  await page.getByLabel('Requirements (one per line)').fill('FR-001 The system must let a signed-in person request a tool for a start and end date.\nFR-002 WHEN a request is sent, the system must notify the lender.');
  await page.getByRole('button', { name: 'Save spec' }).click();
  await page.getByText('Spec saved.').waitFor();
  await check('product-spec');
  await page.getByRole('link', { name: 'Docs' }).click();
  await page.getByText('Free-form documents, organised your way.').waitFor();
  await page.getByLabel('Title').fill('Launch plan');
  await page.getByLabel('Template').selectOption('PR/FAQ');
  await page.getByRole('button', { name: 'Create' }).click();
  await until(async () => (await page.getByLabel('Document (Markdown)').inputValue()).includes('# Press release'), 'templates seed the document');
  await page.getByRole('link', { name: 'Research' }).click();
  await page.getByRole('heading', { name: 'Add research' }).waitFor();
  await page.getByLabel('Title').fill('Interview: Maya');
  await page.getByLabel('Notes').fill('“I bought a tile cutter for one bathroom.”');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('heading', { name: 'Interview: Maya' }).waitFor();
  await page.getByRole('link', { name: 'Roadmap' }).click();
  await page.getByRole('heading', { name: 'MVP' }).waitFor();
  await check('product-roadmap');

  // Pages
  await layerNav().getByRole('link', { name: 'Pages' }).click();
  const tree = page.getByRole('navigation', { name: 'Page tree' });
  await tree.getByRole('link', { name: 'Messages' }).click();
  await page.getByRole('heading', { name: 'Messages', level: 2 }).waitFor();
  await tree.getByRole('link', { name: 'Conversation' }).waitFor();
  assert.ok(await page.locator('.lay-canvas page-blocks .block').count() > 0, 'the canvas renders the same page blocks as the app');
  await page.getByLabel('Link a story').selectOption({ label: await page.getByLabel('Link a story').locator('option', { hasText: 'Sam can ask to borrow' }).innerText() });
  await page.getByText('Story linked.').waitFor();
  await page.getByRole('button', { name: 'Mark as designed' }).click();
  await page.getByText(/is designed/).waitFor();
  await check('pages-tree');
  await page.getByRole('link', { name: 'Flows' }).click();
  await page.getByRole('heading', { name: 'Talk it over' }).waitFor();

  // Design and Platform
  await layerNav().getByRole('link', { name: 'Design' }).click();
  await page.getByRole('cell', { name: 'color.primary' }).waitFor();
  assert.match(await page.locator('table').innerText(), /#ca3e6f/, 'tokens use the same readable primary as the scaffold');
  await check('design-foundations');
  for (const tab of ['Components', 'Patterns', 'Guidelines', 'Sources & changes']) { await page.getByRole('link', { name: tab }).click(); await page.waitForTimeout(100); assert.deepEqual(await axe(page), [], `design ${tab}`); }
  await layerNav().getByRole('link', { name: 'Platform' }).click();
  await page.getByText('Angular 22 + Vite').waitFor();
  await page.getByRole('link', { name: 'Environments' }).click();
  await page.getByText('Running').first().waitFor();
  await check('platform-environments');

  // Work
  await layerNav().getByRole('link', { name: 'Work' }).click();
  await page.getByRole('heading', { name: 'Everything to do, from every layer' }).waitFor();
  const templateItem = page.getByRole('link', { name: /Accounts: sign up, sign in and sign out/ });
  await templateItem.click();
  await page.getByText('Built by the Aludel template.').waitFor();
  await page.getByRole('link', { name: 'Work', exact: true }).first().click();
  const suggestion = page.locator('.lay-suggested .lay-item', { hasText: /Write acceptance for “Someone can start a conversation/ });
  await suggestion.getByRole('button', { name: 'Start now' }).click();
  await page.getByRole('heading', { name: 'Who\'s on it' }).waitFor();
  await page.getByText('On it: Ada Lovelace.').waitFor();
  await page.getByText(/Story:/).waitFor();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByText('Moved to Done.').waitFor();
  await check('work-item');

  // Search, isolation, sign out
  await page.getByLabel('Search every layer').fill('conversation');
  await page.locator('.lay-results').getByText('Story map').waitFor();
  await page.getByLabel('Search every layer').fill('');
  const stranger = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const strangerApi = stranger.request;
  await strangerApi.fetch(`${portal}/api/accounts`, { method: 'POST', data: { name: 'Bob', email: 'bob@example.com', password: 'correct-horse-battery' }, headers: { 'content-type': 'application/json' } });
  assert.equal((await strangerApi.fetch(`${portal}/api/projects/${project.id}/knowledge`)).status(), 404, 'non-members cannot read the layers');
  const strangerPage = await stranger.newPage();
  await strangerPage.goto(`${portal}/p/tool-share`);
  await strangerPage.getByRole('heading', { name: 'Project not found' }).waitFor();
  await stranger.close();

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['', '/product/map', '/pages/tree', '/work']) {
    await page.goto(`${portal}/p/tool-share${path}`);
    await page.locator('.lay-main h1').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path || 'home'} overflows at 390px`);
    assert.deepEqual(await axe(page), [], `${path || 'home'} at 390px`);
  }
  await page.screenshot({ path: 'test-results/layers/home-narrow.png', fullPage: true });
  await page.getByRole('button', { name: /Ada Lovelace/ }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(`${portal}/`);

  assert.deepEqual(errors, []);
  console.log(`PASS: layers ${checked.join(' → ')}; pack stories and template work; story edits with rationale; spec, doc, research; page canvas, linking and designed status; suggestions to done work; search; member isolation; 390px; sign out.`);
} finally { await browser.close(); }
