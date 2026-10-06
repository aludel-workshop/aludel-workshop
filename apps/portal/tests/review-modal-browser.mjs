// W-27 (A7): an action in review opens one review modal, and what it shows matches what the action changed. Follows the
// Pages flows W-27 #1 staged ("Review a code action's files"; the walked half of "Review a UI action by walking it" comes with
// #6) and the Action review page: the card says what changed and offers Review; the modal shows Records (Previous beside
// Proposed, unchanged fields hidden and long runs folded), Files (W-27 #5: a tree of the changed files beside each one's diff
// against the item's base, read from the project's repository; following a newer report; saying why when it can't read the
// commit), or says there's nothing to show; the side panel keeps
// W-25's preview states (ready, stale, unreachable, none) and the decision (a flag needs a note). Opens from a link
// (?review=N); Escape closes it. A scripted local agent (no model) works the items through the editor API.
// Screens and axe at 1440 and 390 px.
// Usage: npm run build, then MACHINE_LAYER_TEMPLATES_ENABLED=1 node tests/review-modal-browser.mjs
// (PLAYWRIGHT_MODULE and CHROMIUM_PATH when not in an item container; see browser-support.mjs).
// `npm run preview -- review-modal` keeps the portal running afterwards, on the item with its #1 open, for a person to look at.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const dest = 'test-results/review-modal/';
mkdirSync(dest, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-review-modal-browser-'));
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
// W-27 #5: the project's repository, where the item's branch has two commits: the map, then a fix to it.
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Charles', '-c', 'user.email=owner@example.com', ...args], { cwd, encoding: 'utf8' }).trim();
const repo = join(root, 'project'); git(root, 'init', '-q', '-b', 'main', repo);
mkdirSync(join(repo, 'src')); writeFileSync(join(repo, 'src/list.ts'), 'export function list(tools) {\n  return tools.sort(byName);\n}\n');
git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'start'); git(repo, 'checkout', '-qb', 'aludel/w-2');
writeFileSync(join(repo, 'src/list.ts'), 'export function list(tools, here) {\n  return tools.sort(byDistance(here));\n}\n');
writeFileSync(join(repo, 'src/map.ts'), 'export function pins(tools) {\n  return tools.map(tool => tool.place);\n}\n');
git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'map');
const first = git(repo, 'rev-parse', 'HEAD');
writeFileSync(join(repo, 'src/map.ts'), 'export function pins(tools) {\n  return tools.filter(tool => tool.place).map(tool => tool.place);\n}\n');
git(repo, 'commit', '-qam', 'skip tools without a place');
const second = git(repo, 'rev-parse', 'HEAD'); git(repo, 'checkout', '-q', 'main');
db.prepare('UPDATE project_setup SET workspace_path = ? WHERE project_id = ?').run(repo, project.id);
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
  // A modal is fixed to the viewport, so its screens are the viewport; the item page's are the full page.
  const shot = name => page.screenshot({ path: dest + name + '.png', fullPage: !page.url().includes('review=') });
  const audit = async label => {
    await page.evaluate(axe);
    const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('aludel-work-goal'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
    assert.deepEqual(violations, [], `axe: ${label}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll: ${label}`);
  };
  const main = page.locator('aludel-work-goal');
  const card = number => main.locator('article.wg-action').filter({ has: page.locator(`h4:has-text("#${number}")`) });
  const state = (number, text) => card(number).locator('.wg-state', { hasText: text }).waitFor();
  const modal = number => page.getByRole('dialog', { name: new RegExp(`^Review #${number} `) });
  const openReview = async number => { await card(number).getByRole('button', { name: `Review #${number}` }).click(); await modal(number).waitFor(); return modal(number); };

  const goals = `${portal}/api/projects/${project.id}/goals`;
  const editorToken = (await (await context.request.post(`${portal}/api/projects/${project.id}/editor`)).json()).token;
  const agentFor = workId => async (path, body) => {
    const response = await context.request.fetch(`${portal}/api/editor/goals/${encodeURIComponent(workId)}${path}`, { method: body ? 'POST' : 'GET', data: body, headers: { authorization: `Bearer ${editorToken}` } });
    const value = await response.json(); if (!response.ok()) throw new Error(`${path}: ${value.error}`); return value;
  };
  const person = async (workId, path, data = {}) => { const response = await context.request.post(`${goals}/${encodeURIComponent(workId)}${path}`, { data }); assert.ok(response.ok(), `${path}: ${await response.text()}`); return response.json(); };
  const newItem = async title => { const id = (await (await context.request.post(goals, { data: { title, brief: title } })).json()).item.id; await person(id, '/claim'); return id; };

  // A page already in Pages: an earlier item made it and closed, so the next item's change has a Previous.
  const toolList = { label: 'Tool list', icon: 'table_rows', pageType: 'list', description: 'Every tool you can borrow nearby, nearest first.', status: 'planned', sections: [
    { name: 'Filters', region: 'main', content: { title: 'Find a tool', body: 'Search by name; filter by kind and distance.' } },
    { name: 'List', region: 'main', content: { title: 'Tools near you', body: 'One row per tool: photo, name, owner, distance and Borrow.', action: 'Borrow' } },
    { name: 'Empty', region: 'main', state: 'empty', content: { title: 'Nothing nearby', body: 'Widen the distance or ask your street.' } }] };
  const seed = await newItem('Spec the tool list'), seeding = agentFor(seed);
  await seeding('/define', { brief: 'The tool list page.', actions: [{ layer: 'pages', goal: 'Spec the tool list' }] });
  await person(seed, '/move', { to: 'progress' });
  await seeding('/actions/1', { state: 'working' });
  const pageId = (await seeding('/stage', { action: 1, operationId: 'createPage', body: { page: toolList } })).staged.id;
  await seeding('/actions/1', { state: 'review', summary: 'The tool list.' });
  await person(seed, '/review/1', { verdict: 'approve' }); await person(seed, '/move', { to: 'review' }); await person(seed, '/close');

  // The item under review: a Pages action, two Code actions with previews, and one with nothing to show.
  const workId = await newItem('Show tools near me'), agent = agentFor(workId);
  await agent('/define', { brief: 'A map of tools to borrow nearby, beside the list.', actions: [
    { layer: 'pages', goal: 'Add the map to the tool list' }, { layer: 'platform', goal: 'Show the map beside the list' },
    { layer: 'platform', goal: 'Pin each tool on the map' }, { goal: 'Agree the map provider' }] });
  await page.goto(`${portal}/p/${project.slug}/work/item/${encodeURIComponent(workId)}`);
  await main.getByRole('button', { name: 'Start work' }).click();
  await main.locator('.wg-board-progress').waitFor();
  await page.locator('.wg-live.on').waitFor();
  for (const number of [1, 2, 3, 4]) await agent(`/actions/${number}`, { state: 'working' });

  // Records: #1 changes the page (a new section, a reworded one) and adds a flow.
  const live = (await agent(`/read?layer=pages&operationId=getPage&id=${pageId}`)).result.data.sections;
  const keep = (index, section) => ({ ...section, id: live[index].id });
  const sections = [keep(0, toolList.sections[0]), { name: 'Map', region: 'main', content: { title: 'Tools on a map', body: 'A pin per tool; tap one to see it in the list.' } },
    keep(1, { ...toolList.sections[1], content: { ...toolList.sections[1].content, body: 'One row per tool: photo, name, owner, distance, and Borrow or Ask.' } }), keep(2, toolList.sections[2])];
  await agent('/stage', { action: 1, operationId: 'updatePage', id: pageId, body: { expectedRevision: 1, changes: { description: 'Every tool you can borrow nearby, on a map and in a list.', sections } } });
  await agent('/stage', { action: 1, operationId: 'createFlow', body: { flow: { title: 'Borrow from the map', steps: [{ page: pageId, name: 'Find a pin', trigger: 'Tap a pin on the map' }, { page: pageId, name: 'Borrow it', trigger: 'Borrow on its row' }] } } });
  await agent('/actions/1', { state: 'review', summary: 'The map sits above the list; a new flow borrows from it.', preview: { none: 'Records only: the page and flow change in Pages.' } });
  await state(1, 'Ready for review');
  await card(1).locator('.wg-changed', { hasText: '2 records in Pages' }).waitFor();
  assert.equal(await card(1).getByRole('button', { name: 'Approve' }).count(), 0, 'approve lives in the modal');
  await shot('01-card'); await audit('card');

  let dialog = await openReview(1);
  assert.equal(await dialog.getByRole('tab').count(), 0, 'one view: no tabs');
  const list = dialog.getByRole('navigation', { name: 'Records it staged' });
  await list.locator('li', { hasText: 'Tool list' }).getByText('Changed').waitFor();
  await list.locator('li', { hasText: 'Borrow from the map' }).getByText('New').waitFor();
  await dialog.locator('.rm-cols', { hasText: 'Previous · r1' }).waitFor();
  const fields = dialog.locator('.rm-field');
  assert.deepEqual((await fields.locator('h4').allTextContents()).map(text => text.trim()), ['DescriptionChanged', 'SectionsChanged'], 'only the changed fields, each marked');
  const description = fields.filter({ hasText: 'Description' }).locator('.rm-row');
  assert.match(await description.locator('.rm-prev').innerText(), /nearest first/);
  assert.match(await description.locator('.rm-next').innerText(), /on a map and in a list/);
  const sectionRows = fields.filter({ hasText: 'Sections' });
  await sectionRows.locator('.rm-added .rm-next', { hasText: 'Name: Map' }).waitFor();
  await sectionRows.locator('.rm-changed .rm-next', { hasText: 'distance, and Borrow or Ask' }).waitFor();
  await shot('02-records'); await audit('records');
  // Unchanged fields on request; a folded run of unchanged lines opens.
  await dialog.getByLabel('Show unchanged fields').check();
  await fields.filter({ hasText: 'Page type' }).waitFor();
  await dialog.getByLabel('Show unchanged fields').uncheck();
  // The new flow: nothing before it.
  await list.getByRole('button', { name: /Borrow from the map/ }).click();
  await dialog.getByText('New: there was nothing before.').waitFor();
  await fields.filter({ hasText: 'Steps' }).locator('.rm-next', { hasText: 'Name: Find a pin' }).waitFor();
  await shot('03-records-new'); await audit('records new');
  // A link opens it; Escape closes it and drops the link's ?review.
  assert.match(page.url(), /\?review=1$/);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.doesNotMatch(page.url(), /review=/);
  await page.goto(`${portal}/p/${project.slug}/work/item/${encodeURIComponent(workId)}?review=1`);
  dialog = modal(1); await dialog.waitFor();
  // A flag needs a note and sends it back to the agent.
  assert.equal(await dialog.getByRole('button', { name: 'Flag' }).isEnabled(), false, 'a flag needs a note');
  await dialog.getByLabel(/^Note/).fill('Put the map under the filters, not above them');
  await dialog.getByRole('button', { name: 'Flag' }).click();
  await dialog.waitFor({ state: 'detached' });
  await state(1, 'Working');
  await page.locator('.wg-events').getByText('Flagged #1: Put the map under the filters').waitFor();
  await agent('/actions/1', { state: 'review', summary: 'The map sits under the filters.' });

  // Files, and a preview handed over: #2 reported code and a link to the build, its commit and what to try.
  await agent('/code', { branch: 'aludel/w-2', commit: first, files: [{ path: 'src/map.ts', status: 'added' }, { path: 'src/list.ts', status: 'modified' }] });
  const built = `${portal}/p/${project.slug}/work`;
  await agent('/actions/2', { state: 'review', summary: 'The map sits beside the list.', preview: { url: built, try: 'Open the board and drag a card across.' } });
  await card(2).locator('.wg-changed', { hasText: '2 files · a preview to open' }).waitFor();
  dialog = await openReview(2);
  // Files: the tree, the first file's diff Before beside After with line numbers, and another file picked from the tree.
  const tree = dialog.getByRole('navigation', { name: 'Files it changed' });
  await tree.getByText(`2 files on aludel/w-2 at ${first.slice(0, 7)}`).waitFor();
  await tree.locator('summary', { hasText: 'src' }).waitFor();
  assert.deepEqual(await tree.locator('.rm-fname').allInnerTexts(), ['list.ts', 'map.ts']);
  assert.equal(await tree.getByRole('button', { name: /list\.ts/ }).getAttribute('aria-current'), 'true', 'the first file opens');
  const changes = dialog.getByRole('region', { name: 'Changes to src/list.ts' });
  await changes.locator('.rm-crow.rm-changed', { hasText: 'byDistance(here)' }).waitFor();
  const changed = changes.locator('.rm-crow.rm-changed').first();
  assert.deepEqual((await changed.locator('.rm-no').allInnerTexts()), ['1', '1']);
  assert.match(await changed.locator('.rm-prev').innerText(), /function list\(tools\) \{/);
  assert.match(await changed.locator('.rm-next').innerText(), /function list\(tools, here\) \{/);
  await changes.locator('.rm-hunk', { hasText: '@@ -1,3 +1,3 @@' }).waitFor();
  await tree.getByRole('button', { name: /map\.ts/ }).click();
  const added = dialog.getByRole('region', { name: 'Changes to src/map.ts' });
  await added.locator('.rm-crow.rm-added').first().waitFor();
  assert.equal(await added.locator('.rm-crow.rm-added').count(), 3);
  const side = dialog.getByRole('complementary', { name: 'Decision' });
  await side.getByText('Try: Open the board and drag a card across.').waitFor();
  assert.match(await side.locator('.rm-meta').innerText(), new RegExp(`^At ${first.slice(0, 7)} · from Charles's local agent · \\d{2}:\\d{2}$`));
  const link = side.getByRole('link', { name: 'Preview #2 (opens in a new tab)' });
  assert.equal(await link.getAttribute('href'), built);
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.equal(await dialog.getByRole('link', { name: 'Open in a new tab' }).getAttribute('href'), built);
  assert.equal(await side.locator('.rm-previewnote').count(), 0, 'reachable and current: no warning');
  await shot('04-files-and-preview'); await audit('files and preview');
  const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await tab.waitForLoadState(); assert.equal(tab.url(), built); await tab.locator('aludel-work-board').waitFor(); await tab.close();
  // Stale: newer code is reported, so the preview says which build it shows.
  await agent('/code', { branch: 'aludel/w-2', commit: second, files: [{ path: 'src/map.ts', status: 'added' }, { path: 'src/list.ts', status: 'modified' }] });
  await side.getByText(`Older build: it shows ${first.slice(0, 7)}, but ${second.slice(0, 7)} was reported since. Ask for a fresh one.`).waitFor();
  // The Files view follows the newer report.
  await tree.getByText(`2 files on aludel/w-2 at ${second.slice(0, 7)}`).waitFor();
  await tree.getByRole('button', { name: /map\.ts/ }).click();
  await dialog.getByRole('region', { name: 'Changes to src/map.ts' }).locator('.rm-crow', { hasText: 'filter(tool => tool.place)' }).waitFor();
  await shot('04b-files-newer'); await audit('files newer');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await dialog.waitFor({ state: 'detached' });

  // Unreachable: #3's link answers nothing from this browser; approve it from its summary without opening it.
  await agent('/actions/3', { state: 'review', summary: 'Pins for every tool.', preview: { url: `http://localhost:${closedPort}/p/${project.slug}/work`, try: 'Zoom in on the pins.' } });
  dialog = await openReview(3);
  await dialog.getByText("This browser can't reach it. The agent's container may have stopped, or the port isn't forwarded to this machine. Ask the agent to run it again.").waitFor();
  await dialog.getByRole('button', { name: 'Approve #3' }).click();
  await dialog.waitFor({ state: 'detached' });
  await state(3, 'Done');
  await assert.rejects(agent('/actions/3', { preview: null }), /#3 is done; its preview can't change/, 'the preview stays as it was reviewed');

  // A reported commit Aludel can't read (not in the repository, and no GitHub to fetch from): it says why, with Retry and
  // the files as the agent reported them.
  await agent('/code', { branch: 'aludel/w-2', commit: 'abcdef1234567', files: [{ path: 'src/map.ts', status: 'added' }] });
  dialog = await openReview(2);
  await dialog.getByRole('alert').getByText(/Aludel doesn't have abcdef1 yet, and this project has no GitHub repository/).waitFor();
  await dialog.locator('.rm-plain li', { hasText: 'src/map.ts' }).waitFor();
  await shot('05a-files-unreadable'); await audit('files unreadable');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  await agent('/code', { branch: 'aludel/w-2', commit: second, files: [{ path: 'src/map.ts', status: 'added' }, { path: 'src/list.ts', status: 'modified' }] });

  // Nothing to show: #4 staged nothing and gave no preview.
  await agent('/actions/4', { state: 'review', summary: 'Agreed: OpenStreetMap tiles.' });
  await card(4).locator('.wg-changed', { hasText: 'Nothing staged; read its summary' }).waitFor();
  dialog = await openReview(4);
  await dialog.getByText('#4 staged no records and reported no code it can show here.', { exact: false }).waitFor();
  await dialog.getByText("No preview: the agent didn't hand one over.").waitFor();
  await shot('05-nothing-to-show'); await audit('nothing to show');
  await dialog.getByRole('button', { name: 'Approve #4' }).click();
  await state(4, 'Done');

  // The action's details offer the same review.
  await card(1).getByRole('button', { name: 'Details and log' }).click();
  await page.locator('.wg-side').getByRole('button', { name: 'Review #1' }).click();
  dialog = modal(1); await dialog.waitFor();
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'All activity' }).click();

  // 390 px: full screen, Previous above Proposed.
  await page.setViewportSize({ width: 390, height: 844 });
  dialog = await openReview(1);
  await dialog.locator('.rm-field').first().scrollIntoViewIfNeeded();
  await shot('06-phone-records'); await audit('phone records');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  dialog = await openReview(2);
  await dialog.locator('.rm-crow').first().waitFor();
  await shot('07-phone-files'); await audit('phone files');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 1440, height: 1000 });

  assert.deepEqual(errors, []);
  console.log('PASS review modal: an action in review says what it changed and opens the review modal (from its card, its details or a link); Records shows Previous beside Proposed, only changed fields until asked, a new record with nothing before; Files shows a tree of the reported code beside each file diff, follows a newer report and says why when it cannot read it; nothing to show says so; the preview handed over sits beside it, ready, stale, unreachable or none; a flag needs a note, and approve needs no preview; Escape closes; axe at 1440 and 390 px.');
  await holdForPreview({ port, path: `/p/${project.slug}/work/item/${encodeURIComponent(workId)}?review=1`, account: { email: 'owner@example.com', password } });
} catch (error) {
  for (const open of browser.contexts().flatMap(context => context.pages())) await open.screenshot({ path: dest + 'failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close(); server.kill();
  if (server.exitCode === null && server.signalCode === null) await new Promise(resolve => server.once('exit', resolve));
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
