// W-8 (AGENT-WORK-01 A6, first part): the Work board as five Kanban columns derived from item status, walked by its person
// while a scripted local agent (no model) works one item through the editor API. Follows the Pages flows W-8 #1 staged:
// "Move an item across the board" (create → define → Ready → start → review → close-out to Done), "Move a rough note to
// Ready", "Start an item nobody is assigned to" and "Try to drag an item to Done"; plus the peek, each filter, and the same
// board as a layer's Tasks tab. Screens and axe at 1440 and 390 px.
// Usage: npm run build, then MACHINE_LAYER_TEMPLATES_ENABLED=1 node tests/work-board-browser.mjs
// (PLAYWRIGHT_MODULE and CHROMIUM_PATH when not in an item container; see browser-support.mjs).
// `npm run preview -- work-board` keeps the portal running afterwards for a person to look at (W-25).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';
import { chromium } from './browser-support.mjs';
import { holdForPreview } from './portal-support.mjs';

const dest = 'test-results/work-board/';
mkdirSync(dest, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-work-board-browser-'));
process.env.MACHINE_DATA_DIR = root;
const password = 'correct-horse-battery';
const db = openDatabase(join(root, 'machine.sqlite'));
initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db);
const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const know = knowledge({ db, catalogs, packs: catalogs.packs });
const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
const owner = createUser(db, { email: 'owner@example.com', name: 'Charles', password });
const { token } = flows.saveDraft(null, { profile: 'planner' });
flows.saveDraft(token, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
const project = flows.claimDraft(token, owner, owner).project;
know.ensureDesign(project.id);
db.close();

const probe = createServer(); await new Promise(resolve => probe.listen(Number(process.env.JOURNEY_PORT || 0), '127.0.0.1', resolve));
const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_LAYER_TEMPLATES_ENABLED: '1', MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', chunk => serverLog += chunk); server.stderr.on('data', chunk => serverLog += chunk);
const portal = `http://aludel.localhost:${port}`, errors = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
try {
  for (const deadline = Date.now() + 60000; !/listening|http:\/\//i.test(serverLog) && Date.now() < deadline;) await new Promise(r => setTimeout(r, 100));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  assert.ok((await context.request.post(`${portal}/api/sign-in`, { data: { email: 'owner@example.com', password } })).ok());
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const shot = (name, fullPage = true) => page.screenshot({ path: dest + name + '.png', fullPage });
  const audit = async (label, scope = 'aludel-work-board') => {
    await page.evaluate(axe);
    const violations = await page.evaluate(async scope => (await window.axe.run(document.querySelector(scope), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), scope);
    assert.deepEqual(violations, [], `axe: ${label}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll: ${label}`);
  };
  const goals = `${portal}/api/projects/${project.id}/goals`;
  const api = async (path, data) => {
    const response = await context.request.post(`${goals}${path}`, { data });
    const value = await response.json(); if (!response.ok()) throw new Error(`${path}: ${value.error}`); return value;
  };
  const editorToken = (await (await context.request.post(`${portal}/api/projects/${project.id}/editor`)).json()).token;
  const agent = async (workId, path, body) => {
    const response = await context.request.fetch(`${portal}/api/editor/goals/${encodeURIComponent(workId)}${path}`, { method: body ? 'POST' : 'GET', data: body, headers: { authorization: `Bearer ${editorToken}` } });
    const value = await response.json(); if (!response.ok()) throw new Error(`${path}: ${value.error}`); return value;
  };
  const me = { kind: 'person', id: owner.id };

  // The other cards the board shows: a rough note, an unassigned Ready item, and one in progress that needs you.
  const rough = (await api('', { title: 'sign up flow??' })).item;
  const loose = (await api('', { title: 'Lend a ladder', priority: 'low' })).item;
  await api(`/${loose.id}/define`, { brief: 'A neighbour lends a ladder for a weekend.', phases: [{ title: 'Build' }], actions: [{ phase: 1, layer: 'pages', goal: 'Add the lending page' }] });
  const busy = (await api('', { title: 'Show tools near me', priority: 'high' })).item;
  await api(`/${busy.id}/assign`, { assignee: me });
  await agent(busy.id, '/define', { brief: 'A map of tools within a short walk.', phases: [{ title: 'Build' }], actions: [{ phase: 1, layer: 'design', goal: 'Pick the map style' }, { phase: 1, layer: 'pages', goal: 'Add the map page' }] });
  await api(`/${busy.id}/move`, { to: 'progress' });
  await agent(busy.id, '/actions/1', { state: 'working' });
  await agent(busy.id, '/events', { kind: 'question', action: 1, text: 'Street map or satellite?', options: ['Street', 'Satellite'] });

  const board = page.locator('aludel-work-board');
  const column = key => board.locator(`.lay-kb-col[data-col="${key}"]`);
  const cardIn = (key, title) => column(key).locator('.lay-kb-card', { hasText: title });
  const peek = board.locator('aside.lay-kb-peek');
  const moveTo = async label => { await peek.getByLabel('Move to').selectOption({ label }); };

  // The board: five columns derived from status, cards with priority, layers, assignee, progress, needs and the live dot.
  await page.goto(`${portal}/p/${project.slug}/work`);
  for (const name of ['Draft', 'Ready', 'In progress', 'In review', 'Done']) await board.getByRole('heading', { name: new RegExp(`^${name}\\s*\\d+$`) }).waitFor();
  const busyCard = cardIn('progress', 'Show tools near me');
  await busyCard.locator('.lay-kb-live').waitFor();
  await busyCard.getByRole('img', { name: '1 needs you' }).waitFor();
  await busyCard.getByRole('img', { name: '0 of 2 actions done' }).waitFor();
  await busyCard.getByText('You, local').waitFor();
  assert.equal(await busyCard.locator('aludel-role-chip').count(), 2, 'the card names both layers its actions touch');
  await cardIn('draft', 'sign up flow??').waitFor();
  await cardIn('ready', 'Lend a ladder').getByText('Unassigned').waitFor();
  assert.equal(await board.getByText(/Batch|Queue|Backlog|Next/).count(), 0, 'batches, Next and Queue/Backlog are gone');
  await shot('01-board'); await audit('board');

  // Create task, then the agent defines it (flow step 1-2).
  await board.getByRole('link', { name: 'Create task' }).click();
  await page.getByRole('dialog', { name: 'Create task', exact: true }).waitFor();
  await page.getByLabel('Layer', { exact: true }).selectOption('goal');
  await page.getByLabel('Title', { exact: true }).fill('Borrow a drill');
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await page.waitForURL(/\/work\/item\//);
  const workId = decodeURIComponent(page.url().split('/').pop());
  await api(`/${workId}/assign`, { assignee: me });
  await agent(workId, '/define', { brief: 'A neighbour borrows a drill in minutes.', phases: [{ title: 'Spec', gated: true }, { title: 'Build' }],
    actions: [{ phase: 1, layer: 'pages', goal: 'Spec the borrow flow' }, { phase: 2, layer: 'pages', goal: 'Build the borrow page' }] });
  await page.goto(`${portal}/p/${project.slug}/work`);

  // Defined, it lands in Ready. The peek: fields, actions with their states, Move to, Open item.
  await cardIn('ready', 'Borrow a drill').getByRole('button', { name: 'Borrow a drill' }).click();
  await peek.getByRole('heading', { name: 'Borrow a drill' }).waitFor();
  await peek.getByText('#1 Spec the borrow flow').waitFor();
  await peek.getByText('You, local').waitFor();
  await peek.getByRole('link', { name: 'Open item' }).waitFor();
  const [peekAt, firstCol] = await Promise.all([peek.boundingBox(), column('draft').boundingBox()]);
  assert.ok(firstCol.width > 180, 'the columns keep their width while the peek is open');
  assert.ok(peekAt.y >= 0 && peekAt.y < 200, 'the peek opens in view');
  await shot('02-peek', false); await audit('peek');

  // Move to › Draft and back to › Ready, then Move to › In progress asks to confirm the start (flow steps 3-4).
  await moveTo('Draft');
  await cardIn('draft', 'Borrow a drill').waitFor();
  await moveTo('Ready');
  await cardIn('ready', 'Borrow a drill').waitFor();
  await moveTo('In progress');
  const dialog = page.getByRole('dialog', { name: /^Start W-\d+\?$/ });
  await dialog.getByText('You work on it with your own agent.', { exact: false }).waitFor();
  await shot('03-confirm-start'); await audit('confirm start', '.lay-kb-dialog');
  await dialog.getByRole('button', { name: 'Start', exact: true }).click();
  await cardIn('progress', 'Borrow a drill').waitFor();

  // The agent works both actions; its person approves them; Move to › In review (flow step 5).
  for (const number of [1, 2]) {
    await agent(workId, `/actions/${number}`, { state: 'working' });
    await agent(workId, `/actions/${number}`, { state: 'review', summary: 'Done.' });
    await api(`/${workId}/review/${number}`, { verdict: 'approve' });
  }
  await page.reload();
  await cardIn('progress', 'Borrow a drill').getByRole('img', { name: '2 of 2 actions done' }).waitFor();
  await cardIn('progress', 'Borrow a drill').getByRole('button', { name: 'Borrow a drill' }).click();
  await moveTo('In review');
  await cardIn('review', 'Borrow a drill').waitFor();

  // A drag to Done is refused: Done comes from close-out (side flow "Try to drag an item to Done").
  await board.getByRole('button', { name: 'Close the peek' }).click();
  await cardIn('review', 'Borrow a drill').dragTo(column('done'));
  const refused = page.getByRole('dialog', { name: /^W-\d+ closes from the item$/ });
  await refused.getByRole('link', { name: 'Open item' }).waitFor();
  await cardIn('review', 'Borrow a drill').waitFor();
  assert.equal(await column('done').locator('.lay-kb-card').count(), 0, 'nothing reached Done by dragging');
  await shot('04-refused-drag'); await audit('refused drag', '.lay-kb-dialog');
  await refused.getByRole('button', { name: 'Cancel' }).click();
  // The server refuses too, whatever the board does.
  await assert.rejects(api(`/${workId}/move`, { to: 'done' }), /closes from the item once its actions are reviewed/);

  // Open item › Close out, and the card lands in Done (flow steps 6-7).
  await cardIn('review', 'Borrow a drill').getByRole('button', { name: 'Borrow a drill' }).click();
  await peek.getByRole('link', { name: 'Open item' }).click();
  await page.waitForURL(/\/work\/item\//);
  await page.locator('aludel-work-goal').getByRole('button', { name: /^Close out/ }).click();
  await page.locator('aludel-work-goal .wg-board-done').waitFor();
  await page.goto(`${portal}/p/${project.slug}/work`);
  await cardIn('done', 'Borrow a drill').waitFor();
  assert.equal(await board.locator('#kb-move').count(), 0, 'no peek is open');
  await cardIn('done', 'Borrow a drill').getByRole('button', { name: 'Borrow a drill' }).click();
  assert.equal(await peek.getByLabel('Move to').count(), 0, 'a closed item has no Move to');

  // A rough note asks to be defined first (side flow "Move a rough note to Ready").
  await cardIn('draft', 'sign up flow??').getByRole('button', { name: 'sign up flow??' }).click();
  await moveTo('Ready');
  const define = page.getByRole('dialog', { name: /is still a rough note$/ });
  await define.getByRole('link', { name: 'Open item to define it' }).waitFor();
  await shot('05-define-first'); await audit('define first', '.lay-kb-dialog');
  await define.getByRole('button', { name: 'Cancel' }).click();
  await cardIn('draft', 'sign up flow??').waitFor();

  // Nobody assigned: the start asks who works on it (side flow "Start an item nobody is assigned to").
  await cardIn('ready', 'Lend a ladder').getByRole('button', { name: 'Lend a ladder' }).click();
  await moveTo('In progress');
  const claim = page.getByRole('dialog', { name: /^Start W-\d+\?$/ });
  await claim.getByText(/Nobody is assigned/).waitFor();
  await claim.getByRole('button', { name: 'Claim and start' }).click();
  await cardIn('progress', 'Lend a ladder').getByText('You, local').waitFor();
  await board.getByRole('button', { name: 'Close the peek' }).click();

  // Filters: Needs you, layer, assignee.
  // The project's built-in routines made items of their own (marked Routine); the filters are checked on this journey's items.
  const mine = ['Borrow a drill', 'Lend a ladder', 'Show tools near me', 'sign up flow??'];
  const shown = async () => (await board.locator('.lay-kb-card').evaluateAll(cards => cards.map(card => card.querySelector('.lay-kb-title').textContent.trim()))).filter(title => mine.includes(title)).sort();
  assert.ok(await board.locator('.lay-kb-card', { hasText: 'Explore' }).first().getByText('Routine').count(), 'routine-made items say where they came from');
  await board.getByRole('button', { name: /^Needs you · 1$/ }).click();
  assert.deepEqual(await shown(), ['Show tools near me']);
  await shot('06-needs-you'); await audit('needs you');
  await board.getByRole('button', { name: /^Needs you/ }).click();
  await board.getByLabel('Layer').selectOption('design');
  assert.deepEqual(await shown(), ['Show tools near me']);
  await board.getByLabel('Layer').selectOption('');
  await board.getByLabel('Assignee').selectOption('none');
  assert.deepEqual(await shown(), ['sign up flow??']);
  await board.getByLabel('Assignee').selectOption('');
  assert.equal((await shown()).length, 4);

  // A layer's Tasks tab is the same board, filtered to that layer.
  await page.goto(`${portal}/p/${project.slug}/pages/tasks`);
  await page.locator('aludel-layer-tasks aludel-work-board .lay-kb').waitFor();
  await cardIn('done', 'Borrow a drill').waitFor();
  assert.deepEqual(await shown(), ['Borrow a drill', 'Lend a ladder', 'Show tools near me']);
  assert.equal(await board.getByLabel('Layer').count(), 0, 'the layer is fixed on its own Tasks tab');
  await shot('07-pages-tasks'); await audit('pages tasks');

  // Phones: columns stack, no sideways scroll; the peek covers the board.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${portal}/p/${project.slug}/work`);
  await cardIn('progress', 'Show tools near me').waitFor();
  const [draftBox, readyBox] = await Promise.all([column('draft').boundingBox(), column('ready').boundingBox()]);
  assert.ok(readyBox.y >= draftBox.y + draftBox.height - 1 && Math.abs(readyBox.x - draftBox.x) < 2, 'columns stack at 390 px');
  await shot('08-phone'); await audit('phone');
  await cardIn('progress', 'Show tools near me').getByRole('button', { name: 'Show tools near me' }).click();
  await peek.getByText('#1 Pick the map style').waitFor();
  const peekBox = await peek.boundingBox();
  assert.ok(peekBox.x <= 0 && peekBox.width >= 389, 'on a phone the peek covers the board');
  await shot('09-phone-peek', false); await audit('phone peek');
  await page.keyboard.press('Escape');
  assert.equal(await peek.count(), 0, 'Escape closes the peek');

  assert.deepEqual(errors, []);
  console.log('PASS work board: five status columns, cards (priority, layers, assignee, progress, needs, live), create → define → Ready → confirmed start → review → close-out to Done, the peek, a rough note asked to define first, an unassigned start claimed, a refused drag to Done, Needs you / layer / assignee filters, the Pages Tasks tab as the same board, axe at 1440 and 390 px.');
  await holdForPreview({ port, path: `/p/${project.slug}/work`, account: { email: 'owner@example.com', password } });
} finally {
  await browser.close(); server.kill();
  if (server.exitCode === null && server.signalCode === null) await new Promise(resolve => server.once('exit', resolve));
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
