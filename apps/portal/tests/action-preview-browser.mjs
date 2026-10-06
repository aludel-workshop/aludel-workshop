// W-25: an action hands over a preview with its review, and its person opens it from the item page. Follows the Pages flow
// W-25 #1 staged, "Review a UI action on its preview" (see the action, open its preview, try what it says, approve or flag),
// through the Action preview section's four states: ready, stale (newer code reported), unreachable from this browser, and
// none (with the agent's reason, or none given). A scripted local agent (no model) works the item through the editor API.
// Screens and axe at 1440 and 390 px.
// Usage: npm run build, then MACHINE_LAYER_TEMPLATES_ENABLED=1 node tests/action-preview-browser.mjs
// (PLAYWRIGHT_MODULE and CHROMIUM_PATH when not in an item container; see browser-support.mjs).
// `npm run preview -- action-preview` keeps the portal running afterwards, on the item, for a person to look at.
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

const dest = 'test-results/action-preview/';
mkdirSync(dest, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-action-preview-browser-'));
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

const freePort = async wanted => { const probe = createServer(); await new Promise(resolve => probe.listen(wanted, '127.0.0.1', resolve)); const found = probe.address().port; await new Promise(resolve => probe.close(resolve)); return found; };
const port = await freePort(Number(process.env.JOURNEY_PORT || 0));
const closedPort = await freePort(0); // nothing listens here: a preview whose container stopped
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_LAYER_TEMPLATES_ENABLED: '1', MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', chunk => serverLog += chunk); server.stderr.on('data', chunk => serverLog += chunk);
const portal = `http://localhost:${port}`, errors = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
try {
  for (const deadline = Date.now() + 60000; !/listening|http:\/\//i.test(serverLog) && Date.now() < deadline;) await new Promise(r => setTimeout(r, 100));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  assert.ok((await context.request.post(`${portal}/api/sign-in`, { data: { email: 'owner@example.com', password } })).ok());
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const shot = name => page.screenshot({ path: dest + name + '.png', fullPage: true });
  const audit = async label => {
    await page.evaluate(axe);
    const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('aludel-work-goal'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
    assert.deepEqual(violations, [], `axe: ${label}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll: ${label}`);
  };
  const main = page.locator('aludel-work-goal');
  const card = number => main.locator('article.wg-action').filter({ has: page.locator(`h4:has-text("#${number}")`) });
  const state = (number, text) => card(number).locator('.wg-state', { hasText: text }).waitFor();

  // An item the person claimed and their local agent defined: four UI actions, each handing its review over differently.
  const goals = `${portal}/api/projects/${project.id}/goals`;
  const workId = (await (await context.request.post(goals, { data: { title: 'Show tools near me', brief: 'A map of tools to borrow nearby.' } })).json()).item.id;
  assert.ok((await context.request.post(`${goals}/${encodeURIComponent(workId)}/claim`, { data: {} })).ok());
  const editorToken = (await (await context.request.post(`${portal}/api/projects/${project.id}/editor`)).json()).token;
  const agent = async (path, body) => {
    const response = await context.request.fetch(`${portal}/api/editor/goals/${encodeURIComponent(workId)}${path}`, { method: body ? 'POST' : 'GET', data: body, headers: { authorization: `Bearer ${editorToken}` } });
    const value = await response.json(); if (!response.ok()) throw new Error(`${path}: ${value.error}`); return value;
  };
  await agent('/define', { brief: 'A map of tools to borrow nearby, beside the list.', actions: [
    { layer: 'platform', goal: 'Show the map beside the list' }, { layer: 'platform', goal: 'Pin each tool on the map' },
    { layer: 'platform', goal: 'Serve tools by distance' }, { layer: 'platform', goal: 'Tidy the map styles' }] });
  await page.goto(`${portal}/p/${project.slug}/work/item/${encodeURIComponent(workId)}`);
  await main.getByRole('button', { name: 'Start work' }).click();
  await main.locator('.wg-board-progress').waitFor();
  await page.locator('.wg-live.on').waitFor();

  // Ready: #1 hands over a link to the build it made, the commit it shows and what to try.
  const first = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678', second = 'f0e1d2c3b4a5968778695a4b3c2d1e0f12345678';
  await agent('/code', { branch: 'aludel/w-1', commit: first, files: [{ path: 'src/map.ts', status: 'added' }] });
  const built = `${portal}/p/${project.slug}/work`;
  for (const number of [1, 2, 3, 4]) await agent(`/actions/${number}`, { state: 'working' });
  await agent('/actions/1', { state: 'review', summary: 'The map sits beside the list.', preview: { url: built, try: 'Open the board and drag a card across.' } });
  await state(1, 'Ready for review');
  const preview = card(1).locator('.wg-preview');
  await preview.getByText('Try: Open the board and drag a card across.').waitFor();
  const link = preview.getByRole('link', { name: 'Preview #1 (opens in a new tab)' });
  assert.equal(await link.getAttribute('href'), built);
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.match(await preview.locator('.wg-previewmeta').innerText(), /^At a1b2c3d · from Charles's local agent · \d{2}:\d{2}$/);
  assert.equal(await preview.locator('.wg-previewnote').count(), 0, 'reachable and current: no warning');
  await shot('01-ready'); await audit('ready');
  // Open its preview: a new tab on the agent's link; try what it says there.
  const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await tab.waitForLoadState();
  assert.equal(tab.url(), built);
  await tab.locator('aludel-work-board').waitFor();
  await tab.close();

  // The same preview sits in the action's details, beside its log.
  await card(1).getByRole('button', { name: 'Details and log' }).click();
  await page.getByRole('heading', { name: '#1 details and log' }).waitFor();
  await page.locator('.wg-side .wg-preview').getByRole('link', { name: 'Preview #1 (opens in a new tab)' }).waitFor();
  await page.locator('.wg-events').getByText('Handed over a preview of #1 at a1b2c3d').waitFor();
  await shot('02-details'); await audit('details');
  await page.getByRole('button', { name: 'All activity' }).click();

  // Stale: newer code is reported, so the preview says which build it shows; a fresh one clears it.
  await agent('/code', { branch: 'aludel/w-1', commit: second, files: [{ path: 'src/map.ts', status: 'added' }] });
  await preview.getByText('Older build: it shows a1b2c3d, but f0e1d2c was reported since. Ask for a fresh one.').waitFor();
  assert.ok(await preview.evaluate(node => node.classList.contains('wg-preview-warn')));
  await shot('03-stale'); await audit('stale');
  await agent('/actions/1', { preview: { url: built, try: 'Open the board and drag a card across.' } });
  await preview.locator('.wg-previewmeta', { hasText: 'At f0e1d2c' }).waitFor();
  assert.equal(await preview.locator('.wg-previewnote').count(), 0, 'a fresh preview is current');

  // Unreachable: #2's link answers nothing from this browser (its container stopped); the link stays.
  await agent('/actions/2', { state: 'review', summary: 'Pins for every tool.', preview: { url: `http://localhost:${closedPort}/p/${project.slug}/work`, try: 'Zoom in on the pins.' } });
  await card(2).getByText("This browser can't reach it. The agent's container may have stopped, or the port isn't forwarded to this machine. Ask the agent to run it again.").waitFor();
  await card(2).getByRole('link', { name: 'Preview #2 (opens in a new tab)' }).waitFor();

  // None: #3 says why it has no preview; #4 gave none, and the page says so.
  await agent('/actions/3', { state: 'review', summary: 'Distance ordering on the server.', preview: { none: 'Only the server changed; nothing on screen.' } });
  await card(3).getByText('No preview: Only the server changed; nothing on screen.').waitFor();
  await agent('/actions/4', { state: 'review', summary: 'Tidied.' });
  await card(4).getByText("No preview: the agent didn't hand one over.").waitFor();
  await shot('04-unreachable-and-none'); await audit('unreachable and none');

  // Approve or flag: neither needs the preview opened. #2's is down; it's approved from its summary.
  await card(2).getByRole('button', { name: 'Approve' }).click();
  await state(2, 'Done');
  await assert.rejects(agent('/actions/2', { preview: null }), /#2 is done; its preview can't change/, 'the preview stays as it was reviewed');
  await card(1).getByRole('button', { name: 'Flag' }).click();
  await card(1).getByLabel('What should change?').fill('The map covers the list at phone width');
  await card(1).getByRole('button', { name: 'Send to the agent' }).click();
  await state(1, 'Working');
  assert.equal((await agent('')).actions[0].preview.commit, second, 'a flagged action keeps its preview until the agent hands over a new one');
  await agent('/actions/1', { state: 'review', summary: 'The list moves under the map at phone width.', preview: { url: built, try: 'At phone width, the list sits under the map.' } });
  await state(1, 'Ready for review');

  // 390 px.
  await page.setViewportSize({ width: 390, height: 844 });
  await card(1).locator('.wg-preview').scrollIntoViewIfNeeded();
  await shot('05-phone'); await audit('phone');
  await page.setViewportSize({ width: 1440, height: 1000 });

  assert.deepEqual(errors, []);
  console.log('PASS action preview: an action hands over a preview with its review; Preview opens it in a new tab, with its commit, who handed it over and what to try, on the card and in its details; stale once newer code is reported and current again with a fresh one; unreachable from this browser, with the link kept; none, with the agent\'s reason or none given; approve without opening it, and a flag keeps it until a new one; axe at 1440 and 390 px.');
  await holdForPreview({ port, path: `/p/${project.slug}/work/item/${encodeURIComponent(workId)}`, account: { email: 'owner@example.com', password } });
} catch (error) {
  for (const open of browser.contexts().flatMap(context => context.pages())) await open.screenshot({ path: dest + 'failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close(); server.kill();
  if (server.exitCode === null && server.signalCode === null) await new Promise(resolve => server.once('exit', resolve));
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
