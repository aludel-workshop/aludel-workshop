// AGENT-WORK-01 A3: the goal item page, driven by its person in the browser while a scripted local agent (no model) works it
// through the editor API, as Claude Code would through the Aludel tools. Follows the a0/v2 walkthrough: create a goal,
// claim it locally, the agent phases it, start; a question and a new action land live on their actions; answer and approve them;
// a staged change shows in the changeset; review gates clear. Screens and axe at 1440 and 390 px.
// Usage: npm run build, then PLAYWRIGHT_MODULE=<…/playwright/index.mjs> MACHINE_LAYER_TEMPLATES_ENABLED=1 node tests/agent-work-browser.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const dest = 'test-results/agent-work/';
mkdirSync(dest, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-agent-work-browser-'));
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
// The project repository (main checked out) and the person's checkout, where the agent commits on aludel/w-8 while main moves on.
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Charles', '-c', 'user.email=owner@example.com', ...args], { cwd, encoding: 'utf8' }).trim();
const repo = join(root, 'project'), checkout = join(root, 'checkout');
git(root, 'init', '-q', '-b', 'main', repo);
mkdirSync(join(repo, 'server')); writeFileSync(join(repo, 'server/routes.mjs'), 'export const routes = [];\n');
git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'start');
git(root, 'clone', '-q', repo, checkout); git(checkout, 'checkout', '-q', '-b', 'aludel/w-8');
mkdirSync(join(checkout, 'src/pages'), { recursive: true }); writeFileSync(join(checkout, 'src/pages/sign-up.html'), '<h1>Join Tool Share</h1>\n');
writeFileSync(join(checkout, 'server/routes.mjs'), "export const routes = ['/sign-up'];\n");
git(checkout, 'add', '.'); git(checkout, 'commit', '-qm', 'sign-up page');
writeFileSync(join(repo, 'README.md'), 'Tool Share\n'); git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'readme');
db.prepare('UPDATE project_setup SET workspace_path = ? WHERE project_id = ?').run(repo, project.id);
const branchCommit = git(checkout, 'rev-parse', 'HEAD'), short = branchCommit.slice(0, 7);
db.close();

const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
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
  const shot = name => page.screenshot({ path: dest + name + '.png', fullPage: true });
  const audit = async (label, scope = 'aludel-work-goal') => {
    await page.evaluate(axe);
    const violations = await page.evaluate(async scope => (await window.axe.run(document.querySelector(scope), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), scope);
    assert.deepEqual(violations, [], `axe: ${label}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll: ${label}`);
  };
  const main = page.locator('aludel-work-goal');
  const card = number => main.locator('article.wg-action').filter({ has: page.locator(`h4:has-text("#${number}")`) });
  const state = (number, text) => card(number).locator('.wg-state', { hasText: text }).waitFor();
  // W-27: approve an action in its review modal (optionally checking a record it staged is listed there).
  const approveReview = async (number, record) => {
    await card(number).getByRole('button', { name: `Review #${number}` }).click();
    const modal = page.getByRole('dialog', { name: new RegExp(`Review #${number}`) });
    if (record) await modal.locator('.rm-name', { hasText: record }).waitFor();
    await modal.getByRole('button', { name: `Approve #${number}` }).click();
    await modal.waitFor({ state: 'detached' });
  };

  // Create a goal from the Work composer.
  await page.goto(`${portal}/p/${project.slug}/work/create`);
  await page.getByRole('dialog', { name: 'Create task', exact: true }).waitFor();
  await page.getByLabel('Layer', { exact: true }).selectOption('goal');
  await page.getByLabel('Title', { exact: true }).fill('Create the sign-up flow');
  await page.getByLabel('Description', { exact: true }).fill('A visitor signs up and lands in their first world.');
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await page.waitForURL(/\/work\/item\//);
  const workId = decodeURIComponent(page.url().split('/').pop());
  await main.getByRole('heading', { name: 'Create the sign-up flow' }).waitFor();
  await main.getByText('Draft', { exact: true }).first().waitFor();

  // Define it by hand: two phases' worth of actions is the agent's job; the person adds one and saves to Ready.
  await main.getByRole('button', { name: 'Add action' }).click();
  await main.getByLabel('New action').fill('Add a slogan for the sign-up page');
  await main.getByLabel('Layer', { exact: true }).selectOption('design');
  await main.getByRole('button', { name: 'Add', exact: true }).click();
  await card(1).waitFor();
  await main.getByRole('button', { name: 'Edit brief' }).or(main.getByRole('button', { name: 'Save and move to Ready' })).first().waitFor();
  if (await main.getByRole('button', { name: 'Edit brief' }).count()) await main.getByRole('button', { name: 'Edit brief' }).click();
  await main.getByLabel('Brief', { exact: true }).fill('A visitor signs up with email and a password and lands in their first world. Google sign-up is separate.');
  await main.getByRole('button', { name: 'Save and move to Ready' }).click();
  await main.locator('.wg-board-ready').waitFor();
  await shot('01-ready'); await audit('ready');
  assert.equal(await main.getByRole('button', { name: 'Start work' }).isEnabled(), false, 'Start waits for an assignee');

  // The agent's editor connection, as `pair` would store it.
  const editorToken = (await (await context.request.post(`${portal}/api/projects/${project.id}/editor`)).json()).token;
  const agent = async (path, body) => {
    const response = await context.request.fetch(`${portal}/api/editor/goals/${encodeURIComponent(workId)}${path}`, { method: body ? 'POST' : 'GET', data: body, headers: { authorization: `Bearer ${editorToken}` } });
    const value = await response.json(); if (!response.ok()) throw new Error(`${path}: ${value.error}`); return value;
  };
  await assert.rejects(agent(''), /Task not found/, 'the agent sees the item only once its person claims it');

  // Who works on it is the assignee: agents (remote) wait on A2; you work on your own machine.
  await main.getByRole('button', { name: 'Change assignee' }).click();
  const menu = page.getByRole('menu');
  assert.equal(await menu.getByRole('menuitem', { name: /Default agent/ }).isDisabled(), true, 'remote agents wait on A2');
  await menu.getByText('Agents work remotely, which comes with the remote runtime (A2).').waitFor();
  await shot('01b-assignee'); await audit('assignee menu', '.cdk-overlay-container');
  await menu.getByRole('menuitem', { name: /^You/ }).click();
  // Yours, it opens in a container. This project has no GitHub repository, so the page says why it can't
  // (tests/connect-browser.mjs opens one against a GitHub repository).
  const container = main.getByRole('button', { name: 'Open in a container' });
  await container.waitFor();
  await container.click();
  await page.getByText("An item container clones the project's GitHub repository").waitFor();
  // Team says how to connect, once for every container; a checkout that reports itself is named there.
  await page.goto(`${portal}/p/${project.slug}/work/team`);
  await page.getByRole('heading', { name: 'Work in VS Code with Claude Code' }).waitFor();
  await page.getByText(/Connected until \d{4}-\d{2}-\d{2}\./).waitFor();
  const placed = await context.request.post(`${portal}/api/editor/checkout`, { data: { path: '/home/ada/code/tool-share', distro: 'Ubuntu' }, headers: { authorization: `Bearer ${editorToken}` } });
  assert.ok(placed.ok(), 'the local tools report where the checkout is');
  await page.reload();
  await page.getByText('Connected: /home/ada/code/tool-share (WSL Ubuntu).').waitFor();
  await shot('01c-team'); await audit('team', 'aludel-work-team');
  await page.goBack();
  await container.waitFor();
  const ref = (await main.locator('.lay-eyebrow').innerText()).split('›').pop().trim();
  assert.equal(await main.getByRole('link', { name: 'work in your tool-share checkout' }).getAttribute('href'),
    'vscode://anthropic.claude-code/open?prompt=' + encodeURIComponent(`Work on ${ref} (${workId}) using the Aludel tools.`), 'your own checkout stays a choice');
  await shot('01d-open-in-container'); await audit('open in a container');
  // A rough Draft assigned to you goes to Claude Code to define; the page doesn't ask you to write the actions.
  const goals = `${portal}/api/projects/${project.id}/goals`;
  const rough = (await (await context.request.post(goals, { data: { title: 'sign up flow??' } })).json()).item.id;
  assert.ok((await context.request.post(`${goals}/${rough}/assign`, { data: { assignee: { kind: 'person', id: owner.id } } })).ok());
  await page.goto(`${portal}/p/${project.slug}/work/item/${encodeURIComponent(rough)}`);
  await main.getByText(/Claude Code there defines it: a brief and actions in phases\./).waitFor();
  await main.getByText('No brief yet. Whoever works on it defines it').waitFor();
  assert.equal(await main.locator('#wg-brief-text').count(), 0, 'the brief editor stays closed: the agent writes it');
  assert.equal(await main.getByRole('button', { name: 'Start work' }).count(), 0, 'a Draft starts once it is defined and Ready');
  await shot('01e-draft-assigned'); await audit('draft assigned');
  await page.goBack();
  await container.waitFor();
  // Claimed, the local agent defines it as v2's orchestrator did: phases with a review gate after the spec work.
  await agent('/define', { brief: 'A visitor signs up with email and a password and lands in their first world. Google sign-up is separate.',
    phases: [{ title: 'Specify', gated: true }, { title: 'Build' }],
    actions: [{ phase: 1, layer: 'design', goal: 'Add a slogan for the sign-up page' }, { phase: 2, layer: 'product', goal: 'Add the joining activity to the Vision map' }] });
  await main.getByRole('heading', { name: 'Phase 2 Build' }).waitFor();
  await main.locator('.wg-gate', { hasText: "phase 2 starts once you've reviewed #1" }).waitFor();
  await main.getByRole('button', { name: 'Start work' }).click();
  await main.locator('.wg-board-progress').waitFor();
  await page.getByRole('heading', { name: 'Thread' }).waitFor();
  await page.locator('.wg-live.on').waitFor();

  // The scripted agent: phase it (the item started, so new actions need approval), work #1 and ask on it.
  await agent('/actions/1', { state: 'working' });
  await agent('/events', { kind: 'log', text: 'Read the Design brand and the Pages onboarding flow.', action: 1 });
  const asked = await agent('/events', { kind: 'question', action: 1, text: 'Should the slogan mention the neighbourhood?', options: ['Yes, by name', 'No, keep it general'] });
  await state(1, 'Needs you');
  await main.locator('.wg-needcount', { hasText: '1 needs you' }).waitFor();
  await assert.rejects(agent('/actions/2', { state: 'working' }), /review gate/, 'the gate holds phase 2');
  await agent('/actions', { phase: 2, goal: 'Screenshot the sign-up page at phone width', layer: 'pages', reason: 'The page is new; a phone check catches layout problems early.' });
  await state(3, 'New: needs your approval');
  await shot('02-needs-on-actions'); await audit('needs');

  await card(1).getByLabel('Yes, by name').check();
  await card(1).getByRole('button', { name: 'Answer' }).click();
  await state(1, 'Working');
  assert.equal((await agent('')).needs.length, 1, 'the answer reaches the agent');
  await card(3).getByRole('button', { name: 'Approve' }).click();
  await state(3, 'To do');
  assert.equal(asked.needs.length, 1);

  // A staged change shows in the changeset, grouped by layer, and nothing applies.
  await agent('/stage', { action: 1, operationId: 'createBrandAsset', body: { asset: { name: 'Slogan', type: 'text', text: 'Borrow from your street.' } } });
  await main.getByRole('heading', { name: 'Changes staged' }).waitFor();
  await main.locator('.wg-changes').getByText('Slogan').waitFor();
  await agent('/actions/1', { state: 'review', summary: 'One slogan, staged in Design.' });
  await state(1, 'Ready for review');

  // Details and log narrow the thread to one action; steering is the person's.
  await card(1).getByRole('button', { name: 'Details and log' }).click();
  await page.getByRole('heading', { name: '#1 details and log' }).waitFor();
  await page.locator('.wg-events').getByText('Answered: Yes, by name').waitFor();
  await shot('03-action-details'); await audit('details');
  await page.getByRole('button', { name: 'All activity' }).click();
  await page.getByLabel('Steer: ask, add or change actions').fill('Keep the slogan under six words');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.locator('.wg-events').getByText('Steer: Keep the slogan under six words').waitFor();

  // A4: review #1 on its own. A flag needs a note and sends it back to the agent, who addresses it; then approve it.
  // W-27: the review opens in the review modal, where Flag and Approve live.
  await card(1).locator('.wg-review').getByText('1 record in Design').waitFor();
  await card(1).getByRole('button', { name: 'Review #1' }).click();
  const modal = page.getByRole('dialog', { name: /Review #1/ });
  await modal.locator('.rm-name', { hasText: 'Slogan' }).waitFor();
  await shot('04-review-action'); await audit('review action');
  assert.equal(await modal.getByRole('button', { name: 'Flag' }).isEnabled(), false, 'a flag needs a note');
  await modal.getByLabel(/^Note/).fill('Use the street name, not "your street"');
  await modal.getByRole('button', { name: 'Flag' }).click();
  await modal.waitFor({ state: 'detached' });
  await state(1, 'Working');
  await page.locator('.wg-events').getByText('Flagged #1: Use the street name').waitFor();
  assert.ok((await agent('')).events.some(event => event.kind === 'flag' && event.action === 1), 'the agent reads the flag');
  await agent('/events', { kind: 'message', action: 1, text: 'Addressed your note: the slogan now names the street.' });
  await agent('/actions/1', { state: 'review', summary: 'The slogan names the street.' });
  await approveReview(1);
  await state(1, 'Done');
  await main.locator('.wg-gate', { hasText: 'Review gate cleared' }).waitFor();
  await agent('/actions/2', { state: 'working' });
  await agent('/stage', { action: 2, operationId: 'createActivity', body: { activity: { title: 'Join Tool Share' } } });
  await agent('/actions/2', { state: 'review', summary: 'Added the activity.' });
  await card(2).locator('.wg-review').getByText('1 record in Vision').waitFor();
  await approveReview(2, 'Join Tool Share');
  await agent('/actions/3', { state: 'working' }); await agent('/actions/3', { state: 'review', summary: 'No overflow at 390 px.' });
  await approveReview(3);
  await state(3, 'Done');
  // A8: code committed in the person's checkout shows beside the staged records.
  await agent('/code', { branch: 'aludel/w-8', commit: branchCommit, base: git(repo, 'rev-parse', 'main~1'), files: [{ path: 'src/pages/sign-up.html', status: 'added' }, { path: 'server/routes.mjs', status: 'modified' }] });
  // CW-1: close-out takes the commit from the project's GitHub repository. This journey's portal has no GitHub, so the
  // commit is put in Aludel's copy up front, standing in for that fetch (agent-work.test.mjs A4 covers the fetch itself).
  git(repo, 'fetch', '-q', checkout, 'aludel/w-8');
  await main.locator('.wg-changes', { hasText: 'aludel/w-8' }).getByText('src/pages/sign-up.html').waitFor();
  await main.getByRole('button', { name: 'Move to review' }).click();
  await main.locator('.wg-board-review').waitFor();
  assert.deepEqual((await agent('/changeset')).changeset.map(group => group.layer), ['design', 'product']);
  // Close-out is "looks good, merge it": the branch merges into main (a merge commit, as main moved) with the records.
  await main.getByRole('heading', { name: 'Ready to close out' }).waitFor();
  await main.locator('.wg-close').getByText(`Closing merges aludel/w-8 (${short}) into main and applies 2 staged record changes in Design and Vision at once.`).waitFor();
  await shot('05-close-out'); await audit('close out');
  await main.getByRole('button', { name: 'Close out and merge' }).click();
  await main.locator('.wg-board-done').waitFor();
  await main.getByText(/Closed\. Applied 2 record changes; merged aludel\/w-8 into main with a merge commit \([0-9a-f]{7}\)/).waitFor();
  assert.equal(git(repo, 'rev-list', '--parents', '-n', '1', 'main').split(' ').length, 3, 'main has the merge commit');
  assert.ok(existsSync(join(repo, 'src/pages/sign-up.html')) && existsSync(join(repo, 'README.md')), 'the checked-out main has both sides');
  await main.getByText('Applied at close-out').waitFor();
  // The thread follows its newest entry, so the close-out is in view without scrolling the list.
  const last = main.locator('.wg-events > li').last();
  await last.filter({ hasText: 'Closed: applied 2 record changes' }).waitFor();
  assert.ok(await last.evaluate(entry => { const list = entry.parentElement.getBoundingClientRect(), box = entry.getBoundingClientRect(); return box.bottom <= list.bottom + 1 && box.top >= list.top - 1; }), 'the newest thread entry is in view');
  await shot('06-closed'); await audit('closed');

  // 390 px.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload(); await main.getByRole('heading', { name: 'Create the sign-up flow' }).waitFor();
  await shot('07-phone'); await audit('phone');

  // W-8 attempt 2, E3: an item that can't be finished. The agent's action fails; it proposes a wrap-up, which its person
  // approves; the wrap-up proposes what has to happen first (the retry after both), and the person edits, creates and
  // dismisses them in the stack, then confirms ending it as not done. Nothing applies or merges.
  await page.setViewportSize({ width: 1440, height: 1000 });
  const goalsApi = `${portal}/api/projects/${project.id}/goals`;
  const second = (await (await context.request.post(goalsApi, { data: { title: 'Kanban board', brief: 'A board for every item.' } })).json()).item.id;
  const as = async (path, body) => { const response = await context.request.fetch(`${portal}/api/editor/goals/${encodeURIComponent(second)}${path}`, { method: 'POST', data: body, headers: { authorization: `Bearer ${editorToken}` } });
    const value = await response.json(); if (!response.ok()) throw new Error(`${path}: ${value.error}`); return value; };
  assert.ok((await context.request.post(`${goalsApi}/${second}/assign`, { data: { assignee: { kind: 'person', id: owner.id } } })).ok());
  await as('/define', { brief: 'A board for every item.', actions: [{ layer: 'pages', goal: 'Spec the board in Pages' }] });
  assert.ok((await context.request.post(`${goalsApi}/${second}/move`, { data: { to: 'progress' } })).ok());
  await as('/actions/1', { state: 'working' });
  await as('/actions', { goal: 'Wrap up: propose what has to happen first', wrapUp: true, reason: "Flows need a persona, and Pages has none of its own; the container can't build the portal." });
  await page.goto(`${portal}/p/${project.slug}/work/item/${encodeURIComponent(second)}`);
  await main.getByRole('heading', { name: 'Kanban board' }).waitFor();
  await card(2).getByText('End this item as not done?').waitFor();
  await card(2).getByRole('button', { name: 'Approve' }).click();
  await card(2).getByText(/Ends W-\d+ as not done/).waitFor();
  await as('/actions/2', { state: 'working' });
  const proposed = await as('/actions/2/proposals', { items: [
    { title: 'Serve layer templates to item containers', brief: 'The container gets layer-base from Aludel.', why: "The container can't build the portal without layer-base." },
    { title: 'Personas in Pages', brief: 'Pages keeps its own personas, bound to Vision through the Library.', why: 'A flow needs a persona, and a layer never needs another layer.' },
    { title: 'Kanban board, again', brief: 'Retry W-8 once both are done.', why: 'The retry.', after: [0, 1] }] });
  assert.equal(proposed.proposals.length, 3, 'the agent gets back what it proposed, not the whole item (F14)');
  await as('/actions/2', { state: 'review', summary: "Ended: the item container can't build the portal, and Pages can't hold a flow's persona." });
  const stack = main.getByRole('group', { name: 'Items #2 proposes' });
  await stack.getByText('Proposed to happen first').waitFor();
  await stack.getByText(/After Serve layer templates to item containers and Personas in Pages/).waitFor();
  await shot('08-proposed'); await audit('proposed items');
  const proposal = n => stack.locator('.wg-proposal').nth(n);
  await proposal(2).getByLabel('Title', { exact: true }).fill('Kanban board (attempt 2)');
  await proposal(2).getByRole('button', { name: 'Create item' }).click();
  await stack.locator('.wg-decided', { hasText: 'Kanban board (attempt 2)' }).waitFor();
  await proposal(1).getByRole('button', { name: 'Dismiss' }).click();
  await stack.locator('.wg-decided', { hasText: 'Dismissed' }).waitFor();
  await proposal(0).getByRole('button', { name: 'Create item' }).click();
  await stack.locator('.wg-decided', { hasText: 'Serve layer templates' }).waitFor();
  await approveReview(2);
  await main.getByText('The wrap-up is ready for review.').waitFor();
  await main.getByRole('button', { name: 'Move to review' }).click();
  await main.getByRole('heading', { name: 'Ready to end as not done' }).waitFor();
  await main.locator('.wg-close-notdone').getByText(/Ending applies nothing and merges nothing: 0 staged record changes stay unapplied\. The work continues in W-\d+, W-\d+\./).waitFor();
  await shot('09-end-not-done'); await audit('end as not done');
  await main.getByRole('button', { name: 'End as not done' }).click();
  await main.getByRole('group', { name: 'Confirm ending as not done' }).getByRole('button', { name: 'End as not done' }).click();
  await main.locator('.wg-board-done').waitFor();
  await main.getByText(/Ended as not done: Ended: the item container can't build the portal/).waitFor();
  const decided = (await (await context.request.get(`${goalsApi}/${second}`)).json()).actions[1].proposals;
  const [templatesItem, , retry] = decided.map(entry => entry.createdWorkId);
  assert.deepEqual((await (await context.request.get(`${goalsApi}/${templatesItem}`)).json()).item.blocks, [retry], 'the prerequisite blocks the retry');
  await shot('10-ended'); await audit('ended');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload(); await main.getByRole('heading', { name: 'Kanban board' }).waitFor();
  await shot('11-ended-phone'); await audit('ended, phone');

  // W-8 F24 and a person's own ending: drop an action that isn't needed, then end the item as not done with a reason.
  // F4 and F14 on the way: the agent names the item by its number, and a write answers briefly.
  await page.setViewportSize({ width: 1440, height: 1000 });
  const third = (await (await context.request.post(goalsApi, { data: { title: 'Tasks tab', brief: 'Each layer shows its items.' } })).json()).item;
  assert.ok((await context.request.post(`${goalsApi}/${third.id}/assign`, { data: { assignee: { kind: 'person', id: owner.id } } })).ok());
  const byRef = await context.request.fetch(`${portal}/api/editor/goals/${third.ref}/define`, { method: 'POST', headers: { authorization: `Bearer ${editorToken}` },
    data: { brief: 'Each layer shows its items.', actions: [{ layer: 'pages', goal: 'Spec the tab' }, { layer: 'pages', goal: 'Build the tab', after: [1] }] } });
  assert.ok(byRef.ok(), 'the item by its number (F4)');
  const reply = await byRef.json();
  assert.deepEqual([reply.item.ref, reply.actions.length, 'events' in reply, 'brief' in reply], [third.ref, 2, false, false], 'a short reply (F14)');
  assert.ok((await context.request.post(`${goalsApi}/${third.id}/move`, { data: { to: 'progress' } })).ok());
  await page.goto(`${portal}/p/${project.slug}/work/item/${encodeURIComponent(third.id)}`);
  await main.getByRole('heading', { name: 'Tasks tab' }).waitFor();
  await main.getByRole('button', { name: 'Remove #2' }).click();
  await card(2).waitFor({ state: 'detached' });
  await main.getByRole('button', { name: 'End as not done…' }).click();
  await main.getByLabel("Why can't it be finished?").fill('The board already embeds per layer; nothing is left to do here.');
  await shot('12-end-yourself'); await audit('end it yourself');
  await main.locator('form.wg-close-notdone').getByRole('button', { name: 'End as not done' }).click();
  await main.locator('.wg-board-done').waitFor();
  await main.getByText(/Ended as not done: The board already embeds per layer/).waitFor();
  await shot('13-ended-yourself'); await audit('ended yourself');
  assert.deepEqual(errors, []);
  console.log('PASS goal item page: create, define, agent phases it with a review gate, assign yourself (agents wait on A2), Open in a container (refused without a GitHub repository) or your checkout, start, live question and approval on their actions, answer, staged changeset by layer, reported code, details and log, steer, per-action review with a flag the agent addresses, gate held and cleared, move to review, close-out that merges the branch into main; and an item ended as not done: wrap-up approved, its proposed items edited, created and dismissed, dependencies as blocking links, the ending confirmed; a to-do action removed and an item ended by its person with a reason; the item by its number and a short reply to an agent write; axe at 1440 and 390 px.');
} catch (error) {
  for (const open of browser.contexts().flatMap(context => context.pages())) await open.screenshot({ path: dest + 'failure.png', fullPage: true }).catch(() => {});
  console.error(serverLog.split('\n').filter(line => /error/i.test(line) && !/ExperimentalWarning/.test(line)).slice(-10).join('\n'));
  throw error;
} finally {
  await browser.close(); server.kill();
  if (server.exitCode === null && server.signalCode === null) await new Promise(resolve => server.once('exit', resolve));
  rmSync(root, { recursive: true, force: true });
}
