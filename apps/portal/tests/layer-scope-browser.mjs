// DEC-057 layer-scoped Work in the browser: Pages Tasks shows Access instead of Actions, a task is created without an
// action, and a real agent run's review has Changes and Follow-ups; a created follow-up is signed as the agent's from Pages.
// Seeds a disposable portal through the server's own modules, then serves it.
// Usage (build first): PLAYWRIGHT_MODULE=<…/playwright/index.mjs> node tests/layer-scope-browser.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { agentRuns, initAgentRuns } from '../server/agent-runs.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { initLayerScope } from '../server/layer-scope.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initSymphonyWorker, symphonyWorker } from '../server/symphony-worker.mjs';
import { initWorkRuns } from '../server/work-runs.mjs';
import { initWorkflow } from '../server/workflow.mjs';
import { chromium } from './browser-support.mjs';

const out = 'test-results/layer-scope';
mkdirSync(out, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-layer-scope-'));
process.env.MACHINE_DATA_DIR = root;
process.env.MACHINE_PAGES_TEMPLATE_ENABLED = '1';
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
const password = 'correct-horse-battery';

const db = openDatabase(join(root, 'machine.sqlite'));
initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initLayerContract(db); initPagesLayerApp(db);
initAgentRuns(db); initSymphonyWorker(db); initWorkRuns(db); initLayerScope(db);
const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const know = knowledge({ db, catalogs, packs: catalogs.packs });
const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
const owner = createUser(db, { email: 'owner@example.com', name: 'Charles', password });
const { token } = flows.saveDraft(null, { profile: 'planner' });
flows.saveDraft(token, { name: 'Tool Library', pitch: 'Borrow tools from neighbours.' });
const project = flows.claimDraft(token, owner, owner).project;
const projectId = project.id;
initLayerContract(db);
know.ensureAgents(projectId); know.ensurePackData(projectId); know.ensureRoutines(projectId); know.migrateWork(projectId);
know.ensureBrief(projectId); know.ensureLibrary(projectId); know.ensurePlan(projectId); know.ensureDesign(projectId);
const workspace = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId).workspace_path;
mkdirSync(workspace, { recursive: true }); git(workspace, 'init', '-q');
writeFileSync(join(workspace, 'README.md'), 'Pinned base\n'); git(workspace, 'add', '.');
git(workspace, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial');
const profile = know.defaultProfile(projectId);
know.update(projectId, profile.id, { model: '', effort: 'medium' }, { rationale: 'Profile-scoped worker fixture' });
const workerRoot = join(root, 'symphony-workspaces'); mkdirSync(workerRoot);
const worker = symphonyWorker({ db, know, workspaceRoot: workerRoot });
const scope = worker.authenticate('Bearer ' + worker.issueToken(owner, projectId, profile.id).token);
const runs = agentRuns({ db, know, secrets: openSecretStore(root), providers: catalogs.agentProviders.providers, worker, symphonyDispatch: true, callModel: async () => { throw new Error('No model'); } });

const page1 = know.insert(projectId, 'page', { label: 'Browse tools', icon: 'article', pageType: 'list', status: 'planned' });
const page2 = know.insert(projectId, 'page', { label: 'Tool detail', icon: 'article', pageType: 'detail', status: 'planned' });
const task = know.createWork(projectId, { layer: 'pages', title: 'Map how people find a tool', assignee: { kind: 'agent', id: profile.id } }, owner.name);
if (task.state === 'suggested') know.updateWork(owner, projectId, task.id, { state: 'ready' });
runs.stage(owner, projectId, task.id);
runs.start(owner, projectId, runs.view(projectId).find(value => value.state === 'draft').id);
const issue = worker.issues(scope, { states: ['Ready'] }).issues.find(value => value.native_ref.work_id === task.id);
const clone = join(workerRoot, issue.identifier);
git(root, 'clone', workspace, clone); git(clone, 'checkout', '--detach', issue.native_ref.repository_commit);
writeFileSync(join(clone, '.git', 'aludel-base'), issue.native_ref.repository_commit + '\n');
worker.registerWorkspace(scope, { attemptId: issue.native_ref.attempt_id, path: clone });
worker.reserveRun(scope, { attemptId: issue.native_ref.attempt_id });
worker.submitProposal(scope, { attemptId: issue.native_ref.attempt_id, proposal: {
  summary: 'Map finding a tool from the list to its detail page.',
  content: { changes: [{ kind: 'flow', op: 'create', title: 'Find a tool', steps: [{ page: page1.id, name: 'Browse tools', trigger: 'Open Tools' }, { page: page2.id, name: 'Read the detail' }] }],
    notes: 'Detail has no borrow action yet.' },
  followUps: [
    { layer: 'platform', title: 'Build the tool detail route', brief: 'Implement Tool detail with its borrow button.', why: 'The Find a tool flow ends on a page Code has not built.' },
    { layer: 'product', title: 'Write the borrow story', brief: 'Capture who borrows and why.', why: 'No Vision story explains borrowing, so the flow cites none.' }],
  usedInputs: [{ id: page1.id, revision: page1.revision }, { id: page2.id, revision: page2.revision }] } });
db.close();

const port = await new Promise(resolve => { const probe = createServer().listen(0, '127.0.0.1', () => { const { port: free } = probe.address(); probe.close(() => resolve(free)); }); });
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_SYMPHONY_WORKSPACE_ROOT: workerRoot, MACHINE_SYMPHONY_DISPATCH: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', chunk => serverLog += chunk); server.stderr.on('data', chunk => serverLog += chunk);
const portal = `http://aludel.localhost:${port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (let i = 0; i < 80 && !/listening|http:\/\//i.test(serverLog); i++) await new Promise(resolve => setTimeout(resolve, 150));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  assert.ok((await context.request.post(`${portal}/api/sign-in`, { data: { email: 'owner@example.com', password } })).ok(), 'sign-in');
  const page = await context.newPage();
  await page.addInitScript({ path: 'node_modules/axe-core/axe.min.js' });
  page.on('pageerror', error => errors.push(error.message));
  const shot = name => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  const axe = () => page.evaluate(async () => (await window.axe.run(document.querySelector('main'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    .violations.map(item => `${item.id}: ${item.nodes[0]?.target}`));
  const base = `${portal}/p/${project.slug}`;

  // Tasks: Access replaces Actions for the layer-scoped Pages layer.
  await page.goto(`${base}/pages/tasks/access`);
  await page.getByRole('heading', { name: 'Access', level: 2 }).waitFor();
  const side = await page.locator('.lay-mg-side a').allInnerTexts();
  assert.ok(side.some(text => /Access/.test(text)) && !side.some(text => /^Actions/.test(text.trim())), `sidebar: ${side}`);
  await page.locator('.lay-access-list').getByText('Flows', { exact: true }).waitFor();
  await page.getByText('Owner: always elevated').waitFor();
  assert.deepEqual(await axe(), [], 'Access axe');
  await shot('access');

  // Create: no action picker; the task names the layer.
  await page.goto(`${base}/pages/tasks/create`);
  await page.getByRole('heading', { name: /Create a Pages task/ }).waitFor();
  assert.equal(await page.getByRole('combobox', { name: 'Action' }).count(), 0, 'no action picker');
  await page.getByText(/proposes anything else as a follow-up/).waitFor();
  assert.deepEqual(await axe(), [], 'Create axe');
  await shot('create');
  await page.getByRole('textbox', { name: 'Task title' }).fill('Tidy the browse flow');
  await page.getByRole('button', { name: 'Create task' }).click();
  await page.getByRole('heading', { name: 'Tidy the browse flow', level: 1 }).waitFor();

  // Review: Changes show the new flow and notes; Follow-ups show each reason.
  await page.goto(`${base}/work/item/${task.id}/review/1`);
  await page.getByRole('heading', { name: /Review W-\d+ · Run 1/ }).waitFor();
  await page.getByText('New flow').waitFor();
  await page.getByRole('tab', { name: /Follow-ups/ }).click();
  await page.getByText('The Find a tool flow ends on a page Code has not built.').waitFor();
  assert.deepEqual(await axe(), [], 'Follow-ups axe');
  await shot('follow-ups');
  await page.getByRole('button', { name: /Create task in Code/ }).click();
  await page.getByText('Follow-up task created.').waitFor();
  const created = page.locator('.wr-fu', { hasText: 'Build the tool detail route' }).getByRole('link');
  await created.waitFor();
  await page.locator('.wr-fu', { hasText: 'Write the borrow story' }).getByRole('button', { name: 'Dismiss' }).click();
  await page.getByText(/Dismissed by Charles/).waitFor();
  await shot('follow-ups-decided');
  await created.click();
  await page.getByRole('heading', { name: 'Build the tool detail route', level: 1 }).waitFor();
  await page.getByText(/from the Pages layer as a follow-up to W-\d+/).first().waitFor();
  await shot('follow-up-item');

  // Sign and accept applies the new flow.
  await page.goto(`${base}/work/item/${task.id}/review/1`);
  await page.getByRole('heading', { name: /Review W-\d+ · Run 1/ }).waitFor();
  await page.locator('.wr-pip-end').click();
  await page.getByRole('button', { name: 'Sign and accept' }).click();
  await page.getByText(/Run 1 accepted and applied/).waitFor();
  const reopened = openDatabase(join(root, 'machine.sqlite'));
  assert.equal(reopened.prepare("SELECT COUNT(*) AS n FROM knowledge_records WHERE project_id = ? AND kind = 'flow'").get(projectId).n, 1);
  reopened.close();

  // Phone width: the review tabs and follow-ups stay within the page.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${base}/work/item/${task.id}/review/1`);
  await page.getByRole('tab', { name: /Follow-ups/ }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no horizontal page scroll at 390px');
  await shot('follow-ups-390');

  assert.deepEqual(errors, [], 'no page errors');
  console.log(`PASS layer-scope browser check; screenshots in ${out}`);
} catch (error) {
  console.error(serverLog.slice(-2000));
  throw error;
} finally {
  await browser.close();
  server.kill();
  rmSync(root, { recursive: true, force: true });
}
