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
import { createUser, initAccounts } from '../../../../apps/portal/server/accounts.mjs';
import { initKnowledge, knowledge } from '../../../../apps/portal/server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../../../../apps/portal/server/onboarding.mjs';
import { ensureProductWorkspace } from '../../../../apps/portal/server/product-workspace.mjs';
import { openSecretStore } from '../../../../apps/portal/server/secret-store.mjs';
import { openDatabase } from '../../../../apps/portal/server/storage.mjs';
import { initWorkflow } from '../../../../apps/portal/server/workflow.mjs';
import { initLayerContract } from '../../../../apps/portal/server/layer-contract.mjs';
import { layerWorkScope } from '../../../../apps/portal/server/layer-scope.mjs';
import { ensureProjectRepositoryLayers } from '../../../../apps/portal/server/layer-package.mjs';
import { codeRepository, initCodeRepository } from '../../../../apps/portal/server/code-repository.mjs';
import { codeUnits, initCodeUnits } from '../../../../apps/portal/server/code-units.mjs';
import { initCodeLayer } from '../../../../apps/portal/server/code-layer.mjs';
import { initAgentRuns } from '../../../../apps/portal/server/agent-runs.mjs';
import { initSymphonyWorker } from '../../../../apps/portal/server/symphony-worker.mjs';
import { initCodeCandidates } from '../../../../apps/portal/server/code-candidates.mjs';
import { initWorkRuns } from '../../../../apps/portal/server/work-runs.mjs';
import { skeletonFiles, loadScaffoldSources } from '../../../../apps/portal/server/scaffold.mjs';
import { previewImageName } from '../../../../apps/portal/server/previews.mjs';
import { chromium } from '../../../../apps/portal/tests/browser-support.mjs';

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
const catalogs = loadCatalogs(new URL('../../../../apps/portal/config', import.meta.url).pathname);
const know = knowledge({ db, catalogs, packs: catalogs.packs });
const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
const owner = createUser(db, { email: 'owner@example.com', name: 'Charles', password });
const { token } = flows.saveDraft(null, { profile: 'planner' });
flows.saveDraft(token, { name: 'Biome', pitch: 'A disposable signup and first-world trial fixture.' });
const project = flows.claimDraft(token, owner, owner).project;
const projectId = project.id;
know.ensureAgents(projectId); know.ensurePackData(projectId); know.ensureRoutines(projectId); know.migrateWork(projectId);
know.ensureBrief(projectId); know.ensureLibrary(projectId); know.ensurePlan(projectId); know.ensureDesign(projectId);
const workspace = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId).workspace_path;
mkdirSync(workspace, { recursive: true }); git(workspace, 'init', '-q', '-b', 'main');
for (const directory of ['server', 'src', 'tests', '.aludel']) mkdirSync(join(workspace, directory));
const setup = flows.projectSetup(owner, projectId);
setup.stack = { ...setup.stack, options: { ...setup.stack.options, auth: true } };
const generated = skeletonFiles(setup, catalogs, catalogs.sourceControlProfiles?.[catalogs.defaultSourceControlProfile] || { gitignore: ['node_modules/'], gitattributes: [] }, { portal: 'http://aludel.localhost', app: 'http://demo.localhost' }, [], loadScaffoldSources(new URL('../../../../apps/portal/', import.meta.url).pathname));
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

  const dest = new URL('refs/', import.meta.url).pathname;
  await page.goto(`${portal}/p/${project.slug}/code/tasks`);
  await page.getByRole('button',{name:'Create task',exact:true}).or(page.getByRole('link',{name:'Create task',exact:true})).first().waitFor();
  await page.screenshot({path:dest+'00-current-board.png',fullPage:true});
  await page.goto(`${portal}/p/${project.slug}/code/tasks/create`);
  await page.getByRole('heading', { name: 'Create a Code task' }).waitFor();
  await page.screenshot({path:dest+'01-current-desktop.png',fullPage:true});
  await page.getByLabel('Task title').fill('A new member signs up and sets up their first world.');
  await page.getByLabel('Task brief').fill('Let a new member create an account and name their first world. Keep the request easy to review as a journey.');
  await page.screenshot({path:dest+'02-current-filled.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:dest+'03-current-phone.png',fullPage:true});
  await page.getByRole('button',{name:'Create task',exact:true}).click();
  await page.waitForURL(/\/work\/item\//);
  await page.getByRole('heading',{name:'A new member signs up and sets up their first world.'}).waitFor();
  const created=items().find(item=>item.title==='A new member signs up and sets up their first world.');
  assert.ok(created?.checks.some(c=>c.text==='The change fits the Code charter and cites the exact inputs it used'));
  await page.getByText(/1 criteri.*editable/).first().waitFor();
  await page.screenshot({path:dest+'04-current-result.png',fullPage:true});
  console.log('Captured current Code task form and natural-language request result on disposable data.');
} finally {
  await browser.close();server.kill();if(server.exitCode===null && server.signalCode===null)await new Promise(resolve=>server.once('exit',resolve));
  db.close();rmSync(root,{recursive:true,force:true});
}
