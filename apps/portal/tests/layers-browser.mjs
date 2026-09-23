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
  const tab = (section, name) => page.getByRole('navigation', { name: `${section} sections` }).getByRole('link', { name, exact: true });
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
  // Data (LAY-07A): the Accounts pack's contract is built by the template; new objects start proposed.
  await layerNav().getByRole('link', { name: 'Data' }).click();
  await page.getByRole('heading', { name: /knows, and how it's asked for/ }).waitFor();
  const erMap = page.getByRole('region', { name: 'Relationship map' });
  await erMap.getByRole('link', { name: /^Account/ }).click();
  await page.getByRole('heading', { name: 'Account', level: 2 }).waitFor();
  await page.locator('article').getByText('Built', { exact: true }).first().waitFor();
  assert.match(await page.getByRole('complementary', { name: 'Connected to Account' }).innerText(), /code units?/, 'the object shows what built it');
  await check('data-objects');
  const newObject = page.locator('form', { has: page.getByRole('heading', { name: 'New object' }) });
  await newObject.getByLabel('Name').fill('Tool');
  await newObject.getByLabel('Description').fill('Something a neighbour lends');
  await newObject.getByRole('button', { name: 'Add object' }).click();
  await page.getByRole('heading', { name: 'Tool', level: 2 }).waitFor();
  const addField = page.locator('form', { has: page.getByRole('heading', { name: 'Add a field' }) });
  await addField.getByLabel('Name').fill('title');
  await addField.getByLabel('Required').check();
  await addField.getByRole('button', { name: 'Add field' }).click();
  await page.getByText('Added title.').waitFor();
  const addRelation = page.locator('form', { has: page.getByRole('heading', { name: 'Add a relationship' }) });
  await addRelation.getByLabel('Name').fill('lender');
  await addRelation.getByLabel('To').selectOption({ label: 'Account' });
  await addRelation.getByRole('button', { name: 'Add relationship' }).click();
  await page.getByText('Relationship added.').waitFor();
  await page.getByRole('button', { name: 'Accept this contract' }).click();
  await page.getByText('The Tool contract is accepted.').waitFor();
  await page.locator('article').getByText('Contracted', { exact: true }).waitFor();
  await tab('Data', 'API').click();
  await page.getByRole('navigation', { name: 'Operations' }).getByRole('link', { name: /Create an account and sign in/ }).click();
  await page.getByRole('heading', { name: 'Create an account and sign in' }).waitFor();
  assert.match(await page.getByRole('complementary', { name: 'Example' }).innerText(), /POST \/api\/sign-up[\s\S]*"email": "sam@example.com"/);
  const openapi = await json('GET', `/api/projects/${project.id}/openapi.json`);
  assert.equal(openapi.openapi, '3.1.0');
  assert.equal(openapi.paths['/api/sign-up'].post.operationId, 'signUp');
  assert.ok(openapi.components.schemas.Tool.required.includes('title'));
  await check('data-api');
  await tab('Data', 'Access').click();
  await page.getByRole('cell', { name: 'People see only their own account.', exact: true }).waitFor();
  await check('data-access');

  // Platform (LAY-07B): overview, binding, code, repository, releases, environments, database, domains.
  await layerNav().getByRole('link', { name: 'Platform' }).click();
  await page.getByRole('heading', { name: 'Last release' }).waitFor();
  await until(async () => (await page.getByRole('heading', { name: 'Last release' }).locator('..').innerText()).includes('Passed'), 'the build became a passed release');
  await check('platform-overview');
  await tab('Platform', 'Architecture').click();
  await page.getByText('Angular 22 + Vite').waitFor();
  await page.getByRole('cell', { name: 'Route handler POST /api/sign-up', exact: true }).waitFor();
  await page.getByRole('cell', { name: 'Table accounts', exact: true }).waitFor();
  assert.match(await page.getByText(/^Needed by/).first().innerText(), /S\d+/, 'email delivery lists the stories that need it');
  await check('platform-architecture');
  await tab('Platform', 'Code').click();
  await page.getByRole('region', { name: 'Coverage' }).waitFor();
  await page.getByRole('link', { name: /POST \/api\/sign-up/ }).click();
  await page.getByRole('heading', { name: 'Why it exists' }).waitFor();
  await page.getByRole('link', { name: 'signUp operation' }).waitFor();
  await page.getByRole('heading', { name: 'References' }).locator('..').getByText('table accounts').waitFor();
  await check('platform-code-unit');
  await tab('Platform', 'Repository').click();
  await page.getByText('feat: generate Tool Share skeleton').waitFor();
  await tab('Platform', 'Releases').click();
  await page.getByRole('region', { name: 'Releases' }).getByText('Passed', { exact: true }).waitFor();
  await check('platform-releases');
  await tab('Platform', 'Environments').click();
  await page.getByText('Running').first().waitFor();
  await until(async () => /\/api\/health 200/.test(await page.getByRole('region', { name: 'Environments' }).innerText()), 'the preview answers its health check');
  await check('platform-environments');
  // The preview database appears once the app stores something: sign up in the generated app itself.
  const app = `http://tool-share.localhost:${port}`;
  const signUp = await api.fetch(`${app}/api/sign-up`, { method: 'POST', data: { email: 'sam@example.com', name: 'Sam', password: 'borrow-a-ladder' }, headers: { 'content-type': 'application/json' } });
  assert.equal(signUp.status(), 201, 'the generated app signs Sam up');
  await tab('Platform', 'Database').click();
  await page.reload();
  await page.getByRole('heading', { name: 'Health' }).waitFor();
  await page.getByText('accounts 1').waitFor();
  await page.getByRole('button', { name: 'Back up now' }).click();
  await page.getByText('Backed up.').waitFor();
  await page.getByRole('button', { name: /^Restore the backup from/ }).first().click();
  await page.getByText('This replaces the preview database').waitFor();
  await check('platform-database-restore');
  await page.getByRole('button', { name: 'Restore it' }).click();
  await page.getByText(/^Restored\./).waitFor();
  await page.getByRole('link', { name: 'Browse' }).click();
  await page.getByRole('region', { name: 'accounts' }).getByRole('cell', { name: 'Sam', exact: true }).waitFor();
  assert.equal(await page.getByRole('region', { name: 'accounts' }).getByText('hidden').count(), 2, 'salt and hash are hidden');
  const browsed = await json('GET', `/api/projects/${project.id}/database/browse?table=sessions`);
  assert.ok(browsed.rows.every(row => row[browsed.columns.indexOf('token_hash')] === null), 'session tokens never leave the server');
  await check('platform-database-browse');
  await page.getByRole('link', { name: 'Query' }).click();
  await page.getByLabel(/Read-only query/).fill('SELECT name, email FROM accounts');
  await page.getByRole('button', { name: 'Run' }).click();
  await page.getByRole('region', { name: 'Query result' }).getByRole('cell', { name: 'sam@example.com' }).waitFor();
  await page.getByLabel(/Read-only query/).fill('DELETE FROM accounts');
  await page.getByRole('button', { name: 'Run' }).click();
  await page.getByRole('alert').getByText(/Only SELECT/).waitFor();
  await check('platform-database-query');
  await tab('Platform', 'Domains').click();
  await page.getByText(`tool-share.localhost:${port}`).waitFor();

  // Work
  await layerNav().getByRole('link', { name: 'Work' }).click();
  await page.getByRole('heading', { name: 'Everything to do, from every layer' }).waitFor();
  const templateItem = page.getByRole('link', { name: /Accounts: sign up, sign in and sign out/ });
  await templateItem.click();
  await page.getByText('Built by the Aludel template.').waitFor();
  await page.getByRole('link', { name: 'Work', exact: true }).first().click();
  // Marking the Messages page designed changed a record with generated code, so a Reconcile item is open and suggestions start collapsed.
  await page.getByRole('link', { name: /Reconcile Messages page with its code/ }).waitFor();
  if (!(await page.locator('.lay-suggested').last().evaluate(element => element.open))) await page.locator('.lay-suggested summary').last().click();
  // DEC-040 (revising LAY-04B): a Planner's working style makes plans available to the Architect; nothing is opened or run yet.
  const pool = page.locator('.lay-suggested').first();
  if (!(await pool.evaluate(element => element.open))) await pool.locator('summary').click();
  const available = pool.locator('.lay-item', { hasText: 'Write the Conversation contract' });
  await available.waitFor();
  assert.match(await available.innerText(), /Architect/, 'plan work is routed to the Architect');
  assert.equal(await page.getByRole('link', { name: /Write the Conversation contract/ }).count(), 0, 'no item is opened until it is batched');
  // LAY-04A: a clarification's answer lands in the story it changes.
  if (!(await page.locator('.lay-suggested').last().evaluate(element => element.open))) await page.locator('.lay-suggested summary').last().click();
  await page.locator('.lay-suggested .lay-item', { hasText: /Clarify: Which record do conversations start from/ }).getByRole('button', { name: 'Start now' }).click();
  await page.getByRole('heading', { name: /^Which record do conversations start from/, level: 2 }).waitFor();
  await page.getByLabel('Answer', { exact: true }).fill('A tool listing');
  await page.getByLabel('Why (saved with the decision)').fill('Tools are what neighbours talk about');
  await page.getByRole('button', { name: 'Answer', exact: true }).click();
  await page.getByText('Answer saved.').waitFor();
  await page.getByRole('button', { name: /^Apply to S\d+/ }).click();
  await page.getByText(/^Applied\. The record has a new revision/).waitFor();
  await page.getByText(/^Applied to S\d+/).waitFor();
  await check('work-answer-applied');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByText('Moved to Done.').waitFor();
  // LAY-04A: closing needs the target to have changed from this item; editing from the item makes it so.
  await page.getByRole('link', { name: 'Work', exact: true }).first().click();
  if (!(await page.locator('.lay-suggested').last().evaluate(element => element.open))) await page.locator('.lay-suggested summary').last().click();
  const suggestion = page.locator('.lay-suggested .lay-item', { hasText: /Write acceptance for “Someone can start a conversation/ });
  await suggestion.getByRole('button', { name: 'Start now' }).click();
  await page.getByRole('heading', { name: 'Who\'s on it' }).waitFor();
  await page.getByText('On it: Ada Lovelace.').waitFor();
  await page.getByText(/Story:/).waitFor();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('alert').getByText(/has no change from W-\d+ yet/).waitFor();
  await page.locator('.lay-connected').getByRole('link', { name: /Someone can start a conversation/ }).click();
  await page.getByRole('status').getByText(/Working on/).waitFor();
  const conversationDrawer = page.getByRole('dialog');
  await conversationDrawer.getByText('A tool listing', { exact: true }).waitFor();
  await conversationDrawer.getByRole('button', { name: 'Add scenario' }).click();
  await conversationDrawer.getByLabel('Given').fill('a tool listing');
  await conversationDrawer.getByLabel('When').fill('Sam chooses Message the lender');
  await conversationDrawer.getByLabel('Then', { exact: true }).fill('a conversation about that tool opens');
  await conversationDrawer.getByLabel('Why this change (saved with the revision)').fill('Acceptance for the Demo');
  await conversationDrawer.getByRole('button', { name: 'Save story' }).click();
  await conversationDrawer.getByText('Acceptance for the Demo').waitFor();
  await page.getByRole('status').getByRole('link', { name: /Back to W-\d+/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByText('Moved to Done.').waitFor();
  await check('work-item');

  // LAY-04C: routines. The build already ran the security audit; running it again while it is open is refused.
  await page.getByRole('link', { name: 'Work', exact: true }).first().click();
  await page.getByRole('navigation', { name: 'Work sections' }).getByRole('link', { name: 'Routines' }).click();
  const routines = page.getByRole('region', { name: 'Routines' });
  await routines.getByRole('row', { name: /Security audit before release/ }).getByRole('link', { name: /W-\d+/ }).waitFor();
  await routines.getByRole('button', { name: 'Run Product drift check now' }).click();
  await page.getByText('Ran it. The new item is in the queue.').waitFor();
  await routines.getByRole('row', { name: /Product drift check/ }).getByRole('link', { name: /W-\d+/ }).waitFor();
  await routines.getByRole('button', { name: 'Run Security audit before release now' }).click();
  await page.getByRole('alert').getByText(/is still open/).waitFor();
  await routines.getByRole('checkbox', { name: 'Turn off Accessibility sweep' }).uncheck();
  await page.getByText('Routine off.').waitFor();
  await check('work-routines');
  // DEC-040: agents run only in batches. Connect a key (checked against the provider stand-in), fill, Go, review.
  await json('PUT', `/api/projects/${project.id}/connections/agent`, { provider: 'openai', secret: 'sk-proj-aludel-browser-test-key-good' });
  await page.getByRole('navigation', { name: 'Work sections' }).getByRole('link', { name: 'Queue' }).click();
  const batchPanel = page.getByRole('region', { name: 'Next agent batch' });
  await batchPanel.getByText('Nothing runs until you press Go.').waitFor();
  if (!(await page.locator('.lay-suggested').first().evaluate(element => element.open))) await page.locator('.lay-suggested summary').first().click();
  await page.getByRole('button', { name: /^Add to batch: Write the Message contract/ }).click();
  await page.getByText('Added to the batch.').waitFor();
  await batchPanel.getByRole('link', { name: 'Write the Message contract' }).waitFor();
  await batchPanel.getByRole('button', { name: /^Fill with the next/ }).click();
  await page.getByText(/^Added \d+\./).waitFor();
  await check('work-batch-draft');
  await batchPanel.getByRole('button', { name: /^Go: run \d+ items?/ }).click();
  await page.getByText(/B-1 started/).waitFor();
  await until(async () => (await json('GET', `/api/projects/${project.id}/knowledge`)).knowledge.batches[0].state === 'done', 'the batch finishes against the stand-in');
  await page.reload();
  await page.locator('.lay-batch').getByText(/B-1: finished/).first().waitFor({ state: 'attached' });
  const contract = page.getByRole('link', { name: /Write the Message contract/ }).first();
  await contract.click();
  await page.getByText(/Done by the Architect profile · \d+ tokens/).first().waitFor({ state: 'attached' });
  // A Planner reviews acceptance drafts: give one to an agent by hand, run it, then accept it.
  await page.getByRole('link', { name: 'Work', exact: true }).first().click();
  if (!(await page.locator('.lay-suggested').last().evaluate(element => element.open))) await page.locator('.lay-suggested summary').last().click();
  await page.locator('.lay-suggested .lay-item', { hasText: /Write acceptance for “Someone can block another person”/ }).getByRole('button', { name: 'Give to an agent' }).click();
  await page.getByText('Added to the batch.').waitFor();
  await page.getByRole('region', { name: 'Next agent batch' }).getByRole('button', { name: 'Go: run 1 item' }).click();
  await until(async () => (await json('GET', `/api/projects/${project.id}/knowledge`)).knowledge.batches[0].state === 'done', 'the second batch finishes');
  await page.reload();
  await page.getByRole('link', { name: /Write acceptance for “Someone can block another person”/ }).first().click();
  await page.getByRole('heading', { name: /Review the Product lead's draft/ }).waitFor();
  await check('work-review');
  await page.getByRole('button', { name: 'Accept' }).click();
  await page.getByText('Moved to Done.').waitFor();

  await page.getByRole('link', { name: 'Work', exact: true }).first().click();
  await page.getByRole('navigation', { name: 'Work sections' }).getByRole('link', { name: 'Working style' }).click();
  assert.equal(await page.getByRole('region', { name: 'Work routing' }).getByRole('row', { name: /^Spec/ }).getByRole('cell').nth(1).innerText(), 'Agent · you review', 'a Planner has agents draft specs for review');
  assert.equal(await page.getByRole('region', { name: 'Work routing' }).getByRole('row', { name: /^Define/ }).getByRole('cell').nth(1).innerText(), 'You');
  // The interim /projects/<id> page is gone; old links land in the project.
  await page.goto(`${portal}/projects/${project.id}`);
  await page.waitForURL(`${portal}/p/tool-share`);

  // Work › Agents (LAY-07C): profiles with revisioned instructions, AGENTS.md export, routing by work type.
  await page.getByRole('link', { name: 'Work', exact: true }).first().click();
  await page.getByRole('navigation', { name: 'Work sections' }).getByRole('link', { name: 'Agents' }).click();
  await page.getByRole('region', { name: 'Profiles' }).getByRole('link', { name: 'Coding agent' }).click();
  await page.getByRole('heading', { name: /Coding agent/, level: 2 }).waitFor();
  await page.getByLabel('Role instructions').fill('Implement against the story and the Data contract. Commit with Aludel-Work and Implements trailers.');
  await page.getByLabel('Why this change (saved with the revision)').fill('Shorter, same rules');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByText('Profile saved.').waitFor();
  await page.getByText('Shorter, same rules').waitFor();
  await check('work-agents-profile');
  await page.getByRole('link', { name: 'Agents', exact: true }).first().click();
  await page.getByRole('heading', { name: 'Project instructions' }).waitFor();
  await page.getByRole('button', { name: 'Export AGENTS.md' }).click();
  await page.getByText(/AGENTS.md written to the workspace/).waitFor();
  await check('work-agents');
  await page.getByRole('navigation', { name: 'Work sections' }).getByRole('link', { name: 'Working style' }).click();
  await page.getByLabel('Design', { exact: true }).selectOption({ label: 'Reviewer' });
  await page.getByText('Design work now goes to Reviewer.').waitFor();
  await check('work-style-routing');

  // Code links (LAY-07D): changing a template story makes its code suspect and opens one Reconcile item.
  await page.goto(`${portal}/p/tool-share/product/map`);
  await page.getByRole('region', { name: 'Story map' }).getByRole('link', { name: /Someone can sign up with email and password/ }).click();
  const signUpDrawer = page.getByRole('dialog');
  await signUpDrawer.getByText(/code units? · /).waitFor();
  await signUpDrawer.getByLabel('Edge cases (one per line)').fill('The email already has an account');
  await signUpDrawer.getByLabel('Why this change (saved with the revision)').fill('Found in testing');
  await signUpDrawer.getByRole('button', { name: 'Save story' }).click();
  await signUpDrawer.getByText('Suspect').waitFor();
  await layerNav().getByRole('link', { name: 'Home' }).click();
  const codeCard = page.getByRole('heading', { name: 'Code' }).locator('..');
  await codeCard.getByText(/\d+ suspect/).waitFor();
  const suspectBefore = Number(/(\d+) suspect/.exec(await codeCard.innerText())[1]);
  await layerNav().getByRole('link', { name: 'Work' }).click();
  await page.getByRole('link', { name: /Reconcile S1 Someone can sign up/ }).click();
  await page.getByRole('heading', { name: 'What changed' }).waitFor();
  await page.getByRole('cell', { name: 'edges' }).waitFor();
  await page.getByRole('link', { name: 'POST /api/sign-up' }).waitFor();
  await page.getByRole('button', { name: 'Agent', exact: true }).click();
  await page.getByText('Assigned.').waitFor();
  assert.equal(await page.getByLabel('Profile').locator('option:checked').innerText(), 'Coding agent', 'reconcile work goes to the Coding agent');
  await page.getByText(/Instructions pinned/).waitFor();
  await check('work-reconcile');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByText('Moved to Done.').waitFor();
  await layerNav().getByRole('link', { name: 'Home' }).click();
  // The Messages page's own Reconcile item is still open, so fewer suspect units rather than none.
  await until(async () => { const found = /(\d+) suspect/.exec(await page.getByRole('heading', { name: 'Code' }).locator('..').innerText()); return !found || Number(found[1]) < suspectBefore; }, 'closing the Reconcile item makes its code current again');

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
  for (const path of ['', '/product/map', '/pages/tree', '/data/objects', '/data/api', '/platform', '/platform/code', '/platform/database', '/work', '/work/agents']) {
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
  console.log(`PASS: layers ${checked.join(' → ')}; pack stories and template work; story edits with rationale; spec, doc, research; page canvas, linking and designed status; Data objects, fields, relations, contracts, OpenAPI export and access; Platform release, binding, code units, repository, health, database backup/restore, masked browse and guarded query; agent profiles, AGENTS.md export and routing; suspect code to a Reconcile item and back; agent batches (fill, Go, review), working-style routing, applied answers, verified closing, routines; suggestions to done work; search; member isolation; 390px; sign out.`);
} finally { await browser.close(); }
