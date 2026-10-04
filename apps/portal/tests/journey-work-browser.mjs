// JOURNEYS-01 J5: Specify, then implement, on a disposable imported app with no journeys. A person creates a Code task about
// /settings through the visible form; Code offers to specify a journey first; the person specifies it on a real branch
// (a characterization test for today's step, a new step without one); review builds and walks it; accepting it raises
// Implement, whose claims are only the step the app doesn't do yet.
// Usage: PLAYWRIGHT_MODULE=<…/playwright/index.mjs> MACHINE_LAYER_TEMPLATES_ENABLED=1 node tests/journey-work-browser.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
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
import { initLayerContract } from '../server/layer-contract.mjs';
import { layerWorkScope } from '../server/layer-scope.mjs';
import { ensureProjectRepositoryLayers } from '../server/layer-package.mjs';
import { codeRepository, initCodeRepository } from '../server/code-repository.mjs';
import { codeUnits, initCodeUnits } from '../server/code-units.mjs';
import { initCodeLayer } from '../server/code-layer.mjs';
import { initAgentRuns } from '../server/agent-runs.mjs';
import { initSymphonyWorker } from '../server/symphony-worker.mjs';
import { initCodeCandidates } from '../server/code-candidates.mjs';
import { initWorkRuns } from '../server/work-runs.mjs';
import { skeletonFiles, loadScaffoldSources } from '../server/scaffold.mjs';
import { previewImageName } from '../server/previews.mjs';
import { chromium } from './browser-support.mjs';

const out = 'test-results/journey-work';
mkdirSync(out, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-journey-work-'));
process.env.MACHINE_DATA_DIR = root;
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
const commit = (cwd, message) => { git(cwd, 'add', '.'); git(cwd, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', message); return git(cwd, 'rev-parse', 'HEAD'); };
const password = 'correct-horse-battery';

// A disposable project whose app was imported: the generated server (with its preview-only setup route), a v2 recipe,
// two routes Code detects, and no journeys.
const db = openDatabase(join(root, 'machine.sqlite'));
initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initAgentRuns(db); initSymphonyWorker(db); initCodeCandidates(db); initWorkRuns(db);
const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const know = knowledge({ db, catalogs, packs: catalogs.packs });
const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
const owner = createUser(db, { email: 'owner@example.com', name: 'Charles', password });
const { token } = flows.saveDraft(null, { profile: 'planner' });
flows.saveDraft(token, { name: 'Team Notes', pitch: 'Notes a small team shares.' });
const project = flows.claimDraft(token, owner, owner).project;
const projectId = project.id;
know.ensureAgents(projectId); know.ensurePackData(projectId); know.ensureRoutines(projectId); know.migrateWork(projectId);
know.ensureBrief(projectId); know.ensureLibrary(projectId); know.ensurePlan(projectId); know.ensureDesign(projectId);
const workspace = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId).workspace_path;
mkdirSync(workspace, { recursive: true }); git(workspace, 'init', '-q', '-b', 'main');
for (const directory of ['server', 'src', 'tests', '.aludel']) mkdirSync(join(workspace, directory));
const setup = flows.projectSetup(owner, projectId);
setup.stack = { ...setup.stack, options: { ...setup.stack.options, auth: true } };
const generated = skeletonFiles(setup, catalogs, catalogs.sourceControlProfiles?.[catalogs.defaultSourceControlProfile] || { gitignore: ['node_modules/'], gitattributes: [] }, { portal: 'http://aludel.localhost', app: 'http://demo.localhost' }, [], loadScaffoldSources(new URL('..', import.meta.url).pathname));
writeFileSync(join(workspace, 'README.md'), 'Team Notes\n');
writeFileSync(join(workspace, 'server/server.mjs'), generated.files['server/server.mjs']);
writeFileSync(join(workspace, 'Dockerfile'), 'FROM node:24-bookworm-slim\nWORKDIR /app\nCOPY . .\nRUN mkdir -p dist && cp src/page.html dist/index.html\nUSER node\nCMD ["node", "server/server.mjs"]\n');
writeFileSync(join(workspace, 'src/page.html'), `<!doctype html><html lang="en"><head><title>Team Notes</title></head><body><h1>Team Notes</h1><p id="route"></p><p id="role"></p><script>document.querySelector('#route').textContent=location.pathname; fetch('/api/session').then(r=>r.json()).then(v=>document.querySelector('#role').textContent=v.account?.email||'anonymous');</script></body></html>`);
writeFileSync(join(workspace, 'src/routes.ts'), "export const routes = [\n  { path: '/notes', label: 'Notes' },\n  { path: '/settings', label: 'Settings' }\n];\n");
writeFileSync(join(workspace, 'tests/app.test.mjs'), "import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';\ntest('the page reads its session from the app', () => assert.ok(readFileSync('src/page.html', 'utf8').includes(\"fetch('/api/session')\")));\n");
writeFileSync(join(workspace, '.aludel/review.json'), JSON.stringify({ version: 2, checks: [{ name: 'App tests', command: ['node', '--test', 'tests/app.test.mjs'] }],
  personas: { member: { fixture: 'starter', session: 'author' } } }));
const base = commit(workspace, 'imported app');
initLayerContract(db); initCodeUnits(db); initCodeLayer(db); initCodeRepository(db);
ensureProjectRepositoryLayers(db, projectId);
assert.ok(layerWorkScope(db, projectId, 'platform'), 'Code runs from its template as a layer-scoped layer');
const codeRepo = codeRepository({ db, units: codeUnits({ db }) }); codeRepo.adopt(projectId); codeRepo.seed(projectId, () => []);
const routeUnits = db.prepare("SELECT symbol FROM code_units WHERE project_id = ? AND kind = 'route' ORDER BY symbol").all(projectId).map(row => row.symbol);
assert.deepEqual(routeUnits, ['route /notes', 'route /settings'], 'Code indexed the app\'s routes');
const freePort = async () => { const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); const port = probe.address().port; await new Promise(resolve => probe.close(resolve)); return port; };
const items = () => db.withProject(projectId, () => know.workList(projectId));

const port = await freePort();
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_SYMPHONY_DISPATCH: '', MACHINE_LAYER_TEMPLATES_ENABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', chunk => serverLog += chunk); server.stderr.on('data', chunk => serverLog += chunk);
const portal = `http://aludel.localhost:${port}`, errors = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/home/henry/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome' });
try {
  for (const deadline = Date.now() + 60000; !/listening|http:\/\//i.test(serverLog) && Date.now() < deadline;) await new Promise(resolve => setTimeout(resolve, 100));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  assert.ok((await context.request.post(`${portal}/api/sign-in`, { data: { email: 'owner@example.com', password } })).ok());
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const axe = async () => {
    await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'));
    const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(node => node.target.join(' ')) })));
    assert.deepEqual(violations, [], JSON.stringify(violations));
  };

  // 1. Create the request in Code's Tasks. A request about /settings, which no journey covers, is offered Specify.
  await page.goto(`${portal}/p/${project.slug}/code/tasks/create`);
  await page.getByRole('heading', { name: 'Create a Code task' }).waitFor();
  await page.getByText("an agent may change only this layer's declared repository files").waitFor();
  await page.getByLabel('Task title').fill('Invite teammates');
  await page.getByLabel('Task brief').fill('From /settings, a member invites people by email.');
  await page.getByLabel('Assignee').selectOption({ label: 'You' });
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  await page.getByText('No journey covers /settings yet.').waitFor();
  assert.equal(await page.getByLabel('Journey', { exact: true }).inputValue(), 'Invite teammates');
  await axe();
  await page.screenshot({ path: `${out}/offer.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/offer-narrow.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'the offer fits a 390px screen');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Specify first', exact: true }).click();
  await page.waitForURL(/\/work\/item\//);
  const specify = items().find(item => item.context?.journeyWork?.kind === 'specify');
  assert.deepEqual(specify.checks.map(claim => claim.id), ['journey-spec', 'journeys-unchanged']);
  assert.ok(!items().some(item => item.context?.journeyWork?.kind === 'reviewable'), 'the app is reviewable already: recipe, persona fixture and setup route');
  await page.getByText(/Journey invite-teammates at revision 1/).first().waitFor();

  // 2. The person specifies it on a real branch: today's step is characterized, the new step has no test yet.
  await page.getByRole('button', { name: 'Stage in your batch', exact: true }).click();
  await page.getByRole('button', { name: "I'm working", exact: true }).click();
  await page.getByRole('button', { name: 'Ready for review', exact: true }).waitFor();
  const checkout = join(root, 'specify');
  git(root, 'clone', '-q', workspace, checkout); git(checkout, 'checkout', '-q', '-b', 'specify-invite');
  mkdirSync(join(checkout, '.aludel/outputs'), { recursive: true }); mkdirSync(join(checkout, '.aludel/journeys'), { recursive: true });
  writeFileSync(join(checkout, '.aludel/journeys/invite-teammates.spec.mjs'), "export default {\n  'open-settings': async ({ page, step }) => {\n    await page.goto(step.route);\n    await page.locator('#route').getByText(step.route, { exact: true }).waitFor();\n    await page.getByText('author@demo.invalid', { exact: true }).waitFor();\n  }\n};\n");
  const step = (id, name, route, extra = {}) => ({ id, name, route, trigger: `Goes to ${route}`, expected: `${name}.`, ...extra });
  const specified = { journeys: [{ version: 1, id: 'invite-teammates', title: 'Invite teammates', origin: 'authored', revision: 1, persona: 'member',
    steps: [step('open-settings', 'Settings open as the member', '/settings', { test: 'invite-teammates.spec.mjs#open-settings' }), step('invite', 'An invitation goes out by email', '/settings/invite')] }] };
  const existing = JSON.parse(readFileSync(join(checkout, '.aludel/outputs/journeys.json'), 'utf8'));
  assert.deepEqual(existing.journeys, [], 'Code installed its empty journeys file');
  writeFileSync(join(checkout, '.aludel/outputs/journeys.json'), JSON.stringify(specified, null, 2) + '\n');
  const specifiedCommit = commit(checkout, 'Specify invite teammates');
  git(workspace, 'fetch', '-q', checkout, 'specify-invite:specify-invite');
  await page.getByRole('button', { name: 'Ready for review', exact: true }).click();
  await page.getByLabel('Local branch', { exact: true }).fill('specify-invite');
  await page.getByLabel('Exact commit', { exact: true }).fill(specifiedCommit);
  await page.getByLabel('What is ready for review', { exact: true }).fill('Specified Invite teammates: settings characterized, the invite step to build.');
  await page.locator('#person-evidence-journey-spec').fill('The journey file at revision 1, authored.');
  await page.locator('#person-evidence-journeys-unchanged').fill('The settings step test passes on the current app.');
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
  await page.getByRole('link', { name: /Review/ }).filter({ hasText: 'Review' }).first().waitFor();

  // 3. Review builds the specified app and walks the journey; the record claim is proven by the build holding it.
  const runsUrl = `${portal}/api/projects/${projectId}/work/${specify.id}/runs`;
  const [run] = (await (await context.request.get(runsUrl)).json()).runs;
  const apiBase = `${runsUrl}/${run.id}`;
  const prepared = await context.request.post(`${apiBase}/prepare`, { data: {} }); assert.ok(prepared.ok(), await prepared.text());
  const integration = (await prepared.json()).run.integration;
  const built = await context.request.post(`${apiBase}/preview`, { data: { integrationId: integration.id } }); assert.ok(built.ok(), await built.text());
  let reviewed;
  for (const deadline = Date.now() + 180000; ; await new Promise(resolve => setTimeout(resolve, 2000))) {
    reviewed = (await (await context.request.get(runsUrl)).json()).runs[0];
    if (reviewed.proofs['journey-spec']?.status !== 'not-run' || Date.now() > deadline) break;
  }
  assert.deepEqual([reviewed.proofs['journey-spec'].status, reviewed.proofs['journeys-unchanged'].status, reviewed.gate], ['passed', 'passed', []], JSON.stringify(reviewed.proofs));
  await page.goto(`${portal}/p/${project.slug}/work/item/${specify.id}/review/1`);
  await page.getByRole('heading', { name: /W-\d+ · Run 1/, level: 1 }).waitFor();
  await page.getByText('The journey in this build: Passed').waitFor({ timeout: 60000 });
  await axe();
  await page.screenshot({ path: `${out}/specify-review.png`, fullPage: true });

  // 4. Accepting it merges the exact reviewed commit and raises Implement with the unbuilt step as its claim.
  for (const claim of ['journey-spec', 'journeys-unchanged']) assert.ok((await context.request.put(`${apiBase}/review`, { data: { integrationId: integration.id, verdict: { claim, value: 'accept' } } })).ok());
  const accepted = await context.request.post(`${apiBase}/sign`, { data: { integrationId: integration.id, outcome: 'accept' } }); assert.ok(accepted.ok(), await accepted.text());
  assert.equal(git(workspace, 'rev-parse', 'main'), integration.commit, 'accept advances main to the reviewed commit');
  const implement = items().find(item => item.context?.journeyWork?.kind === 'implement');
  assert.ok(implement, `Implement was raised: ${JSON.stringify(items().find(item => item.id === specify.id).log.slice(-3))}`);
  assert.deepEqual(implement.checks.map(claim => [claim.id, claim.kind, claim.steps ?? null]), [['invite-teammates-steps', 'journey', ['invite']], ['journeys-unchanged', 'invariant', null]]);
  assert.equal(implement.title, 'Implement: Invite teammates');
  await page.goto(`${portal}/p/${project.slug}/work/item/${implement.id}`);
  await page.getByRole('heading', { name: 'Implement: Invite teammates' }).waitFor();
  await page.getByText(/Journey invite-teammates at revision 1: step invite/).first().waitFor();
  // The item counts its backed claims as criteria and says where it came from.
  await page.getByText('2 criteria · editable').waitFor();
  assert.equal(await page.getByText('No criteria yet.', { exact: false }).count(), 0);
  await page.getByText(new RegExp(`Raised by accepting ${specify.ref}`)).first().waitFor();
  assert.equal(await page.getByText('A gap the Code layer found').count(), 0);
  await axe();
  await page.screenshot({ path: `${out}/implement-raised.png`, fullPage: true });
  await page.goto(`${portal}/p/${project.slug}/work/item/${specify.id}`);
  await page.getByText(new RegExp(`Raised ${implement.ref} to implement invite-teammates at revision 1; steps open-settings already pass`)).waitFor();
  assert.notEqual(integration.commit, base);

  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: a Code request about an uncovered route is offered Specify in the visible form; Specify runs as a person on a real branch; review builds and walks the journey and proves its record claim; accepting merges the reviewed commit and raises Implement claiming only the step the app does not do yet; axe and 390px pass.');
} catch (error) {
  console.error('SERVER', serverLog.slice(-4000)); throw error;
} finally {
  await browser.close(); server.kill(); if (server.exitCode === null && server.signalCode === null) await new Promise(resolve => server.once('exit', resolve));
  for (const row of db.prepare('SELECT id FROM layer_review_integrations').all()) {
    try { execFileSync('docker', ['image', 'rm', previewImageName(join(root, 'review-workspaces'), 'review', row.id)], { stdio: 'ignore' }); } catch {}
  }
  db.close(); rmSync(root, { recursive: true, force: true });
}
