// LAT08A-INTEGRATION-01: generic Code Work, exact combined builds, guided synthetic sessions and serial acceptance.
// Usage: PLAYWRIGHT_MODULE=<…/playwright/index.mjs> MACHINE_LAYER_TEMPLATES_ENABLED=1 node tests/repository-review-browser.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { agentRuns, initAgentRuns } from '../server/agent-runs.mjs';
import { codeCandidates, initCodeCandidates } from '../server/code-candidates.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initSymphonyWorker, symphonyWorker } from '../server/symphony-worker.mjs';
import { initWorkRuns, workRuns } from '../server/work-runs.mjs';
import { initWorkflow } from '../server/workflow.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { layerWorkScope } from '../server/layer-scope.mjs';
import { ensureProjectRepositoryLayers } from '../server/layer-package.mjs';
import { codeRepository, initCodeRepository } from '../server/code-repository.mjs';
import { codeUnits, initCodeUnits } from '../server/code-units.mjs';
import { initCodeLayer } from '../server/code-layer.mjs';
import { skeletonFiles, loadScaffoldSources } from '../server/scaffold.mjs';
import { previewImageName } from '../server/previews.mjs';
import { chromium } from './browser-support.mjs';

const out = 'test-results/repository-review';
mkdirSync(out, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-repository-review-'));
process.env.MACHINE_DATA_DIR = root;
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
const password = 'correct-horse-battery';

// Seed a disposable project; all accounts, repositories and app data remain in its temporary root.
const db = openDatabase(join(root, 'machine.sqlite'));
initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initAgentRuns(db); initSymphonyWorker(db); initCodeCandidates(db); initWorkRuns(db);
const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const know = knowledge({ db, catalogs, packs: catalogs.packs });
const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
const owner = createUser(db, { email: 'owner@example.com', name: 'Charles', password });
const { token } = flows.saveDraft(null, { profile: 'planner' });
flows.saveDraft(token, { name: 'Browser Buddy', pitch: 'A pet in a browser window.' });
const project = flows.claimDraft(token, owner, owner).project;
const projectId = project.id;
know.ensureAgents(projectId); know.ensurePackData(projectId); know.ensureRoutines(projectId); know.migrateWork(projectId);
know.ensureBrief(projectId); know.ensureLibrary(projectId); know.ensurePlan(projectId); know.ensureDesign(projectId);
const workspace = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId).workspace_path;
mkdirSync(workspace, { recursive: true }); git(workspace, 'init', '-q', '-b', 'main');
writeFileSync(join(workspace, 'README.md'), 'Pinned base\n'); git(workspace, 'add', '.');
mkdirSync(join(workspace, 'server')); mkdirSync(join(workspace, 'src')); mkdirSync(join(workspace, 'tests')); mkdirSync(join(workspace, '.aludel'));
const freePort = async () => { const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); const port = probe.address().port; await new Promise(resolve => probe.close(resolve)); return port; };
const setup = flows.projectSetup(owner, projectId);
setup.stack = { ...setup.stack, options: { ...setup.stack.options, auth: true } };
const generated = skeletonFiles(setup, catalogs, catalogs.sourceControlProfiles?.[catalogs.defaultSourceControlProfile] || { gitignore: ['node_modules/'], gitattributes: [] }, { portal: 'http://aludel.localhost', app: 'http://demo.localhost' }, [], loadScaffoldSources(new URL('..', import.meta.url).pathname));
writeFileSync(join(workspace, 'server/server.mjs'), generated.files['server/server.mjs']);
writeFileSync(join(workspace, 'Dockerfile'), 'FROM node:24-bookworm-slim\nWORKDIR /app\nCOPY . .\nRUN mkdir -p dist && cp src/review-page.html dist/index.html\nUSER node\nCMD ["node", "server/server.mjs"]\n');
const html = label => `<!doctype html><html><head><title>Review demo</title></head><body><h1>${label}</h1><p id="route"></p><p id="role"></p><script>document.querySelector('#route').textContent=location.pathname; fetch('/api/session').then(r=>r.json()).then(v=>document.querySelector('#role').textContent=v.account?.email||'anonymous');</script></body></html>`;
writeFileSync(join(workspace, 'src/review-page.html'), html('Before'));
writeFileSync(join(workspace, 'tests/app.test.mjs'), `import test from 'node:test'; import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs'; test('the demo obtains identity through the real session API',()=>assert.ok(readFileSync('src/review-page.html','utf8').includes("fetch('/api/session')")));\n`);
// JOURNEYS-01 J3: the v2 recipe maps personas to the starter fixture; review steps come from journeys.
writeFileSync(join(workspace, '.aludel/review.json'), JSON.stringify({ version: 2, checks: [{ name: 'App session integration', command: ['node', '--test', 'tests/app.test.mjs'] }],
  personas: { author: { fixture: 'starter', session: 'author' }, viewer: { fixture: 'starter', session: 'viewer' } } }));
// The app already keeps journeys in .aludel/; installing Code reads them in rather than replacing them with its empty file.
mkdirSync(join(workspace, '.aludel/outputs'));
writeFileSync(join(workspace, '.aludel/outputs/journeys.json'), JSON.stringify({ journeys: [
  { version: 1, id: 'edit-post', title: 'Edit a post', origin: 'authored', revision: 1, persona: 'author', steps: [{ id: 'editor', name: 'Review the post editor', route: '/posts/demo/edit', trigger: 'Opens the post', expected: 'The editor opens as the demo author.' }] },
  { version: 1, id: 'read-post', title: 'Read a post', origin: 'authored', revision: 1, persona: 'viewer', steps: [{ id: 'page', name: 'Review the viewer page', route: '/posts/demo', trigger: 'Opens the post', expected: 'The post opens as the demo viewer.' }] }] }));
git(workspace, 'add', '.');
git(workspace, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial');
initLayerContract(db); initCodeUnits(db); initCodeLayer(db); initCodeRepository(db);
ensureProjectRepositoryLayers(db, projectId);
assert.ok(layerWorkScope(db, projectId, 'platform'), JSON.stringify({ instances: db.prepare('SELECT layer_key, enabled FROM layer_instances WHERE project_id = ?').all(projectId), binding: db.prepare('SELECT layer_key, accepted_commit FROM layer_package_bindings WHERE project_id = ?').all(projectId) }));
const codeRepo = codeRepository({ db, units: codeUnits({ db }) }); codeRepo.adopt(projectId); codeRepo.seed(projectId, () => []);
const profile = know.defaultProfile(projectId);
know.update(projectId, profile.id, { model: '', effort: 'medium' }, { rationale: 'Profile-scoped worker fixture' });
const workerRoot = join(root, 'symphony-workspaces'); mkdirSync(workerRoot);
const candidates = codeCandidates({ db, candidateRoot: join(root, 'code-candidates'), externalRoot: workerRoot });
const worker = symphonyWorker({ db, know, candidates, workspaceRoot: workerRoot });
const scope = worker.authenticate('Bearer ' + worker.issueToken(owner, projectId, profile.id).token);
const runs = agentRuns({ db, know, secrets: openSecretStore(root), providers: catalogs.agentProviders.providers, worker, symphonyDispatch: true, callModel: async () => { throw new Error('No model'); } });
const history = workRuns({ db, know, candidates });
const go = work => {
  runs.stage(owner, projectId, work.id);
  const batch = runs.view(projectId).find(value => value.state === 'draft');
  runs.start(owner, projectId, batch.id);
  const issue = worker.issues(scope, { states: ['Ready'] }).issues.find(value => value.native_ref.work_id === work.id);
  const clone = join(workerRoot, issue.identifier);
  rmSync(clone, { recursive: true, force: true });
  git(root, 'clone', workspace, clone); git(clone, 'checkout', '--detach', issue.native_ref.repository_commit);
  writeFileSync(join(clone, '.git', 'aludel-base'), issue.native_ref.repository_commit + '\n');
  worker.registerWorkspace(scope, { attemptId: issue.native_ref.attempt_id, path: clone });
  worker.reserveRun(scope, { attemptId: issue.native_ref.attempt_id });
  return issue.native_ref.attempt_id;
};

const work = know.createWork(projectId, { layer: 'platform', title: 'Review the exact integrated app', assignee: { kind: 'agent', id: profile.id }, checks: ['The editor opens as the author', 'The post opens as the viewer'] }, owner.name);
if (work.state === 'suggested') know.updateWork(owner, projectId, work.id, { state: 'ready' });
const attemptId = go(know.workById(projectId, work.id));
const attempt = db.prepare('SELECT workspace_path FROM symphony_attempts WHERE id = ?').get(attemptId);
const info = worker.layerWorkspace(scope, attemptId), checkout = join(attempt.workspace_path, 'layer');
git(root, 'clone', '-q', workspace, checkout); git(checkout, 'checkout', '-q', '-b', info.branch, info.base);
writeFileSync(join(attempt.workspace_path, '.git/info/exclude'), '/layer/\n', { flag: 'a' });
writeFileSync(join(checkout, 'src/review-page.html'), html('Candidate review demo'));
worker.commitLayer(scope, { attemptId, message: 'Identify the candidate page', tests: [] });
worker.submitProposal(scope, { attemptId, proposal: { summary: 'Open the editor and viewer directly with synthetic app sessions.', content: {} } });
const second = know.createWork(projectId, { layer: 'platform', title: 'Integrate a second Code branch', assignee: { kind: 'agent', id: profile.id }, checks: ['The companion coexists with the first change'] }, owner.name);
if (second.state === 'suggested') know.updateWork(owner, projectId, second.id, { state: 'ready' });
const secondAttempt = go(know.workById(projectId, second.id));
const secondInfo = worker.layerWorkspace(scope, secondAttempt), secondCheckout = join(db.prepare('SELECT workspace_path FROM symphony_attempts WHERE id = ?').get(secondAttempt).workspace_path, 'layer');
git(root, 'clone', '-q', workspace, secondCheckout); git(secondCheckout, 'checkout', '-q', '-b', secondInfo.branch, secondInfo.base);
writeFileSync(join(secondCheckout, '../.git/info/exclude'), '/layer/\n', { flag: 'a' });
writeFileSync(join(secondCheckout, 'src/review-companion.mjs'), 'export const companion = true;\n');
worker.commitLayer(scope, { attemptId: secondAttempt, message: 'Add a companion module', tests: [] });
worker.submitProposal(scope, { attemptId: secondAttempt, proposal: { summary: 'A second independent Code branch from the same base.', content: {} } });
const conflict = know.createWork(projectId, { layer: 'platform', title: 'Send a conflicting Code change back', assignee: { kind: 'agent', id: profile.id }, checks: ['Resolve the changed page with the latest accepted version'] }, owner.name);
if (conflict.state === 'suggested') know.updateWork(owner, projectId, conflict.id, { state: 'ready' });
const conflictAttempt = go(know.workById(projectId, conflict.id));
const conflictInfo = worker.layerWorkspace(scope, conflictAttempt), conflictCheckout = join(db.prepare('SELECT workspace_path FROM symphony_attempts WHERE id = ?').get(conflictAttempt).workspace_path, 'layer');
git(root, 'clone', '-q', workspace, conflictCheckout); git(conflictCheckout, 'checkout', '-q', '-b', conflictInfo.branch, conflictInfo.base);
writeFileSync(join(conflictCheckout, '../.git/info/exclude'), '/layer/\n', { flag: 'a' });
writeFileSync(join(conflictCheckout, 'src/review-page.html'), html('Conflicting page change'));
worker.commitLayer(scope, { attemptId: conflictAttempt, message: 'Change the same page independently', tests: [] });
worker.submitProposal(scope, { attemptId: conflictAttempt, proposal: { summary: 'A conflicting branch to send back without applying.', content: {} } });
// JOURNEYS-01 J4: the person's item claims the viewer step of its journey; the step has no test yet, so the person says why.
const personWork = know.createWork(projectId, { layer: 'platform', title: 'Person submits a real repository candidate', assignee: {kind:'person', id:owner.id},
  claims: [{ id: 'read-post-steps', kind: 'journey', journey: 'read-post', revision: 1, steps: ['page'] }], checks: ['The editor opens directly as the author', 'The viewer opens directly as the viewer'] }, owner.name);
if (personWork.state === 'suggested') know.updateWork(owner, projectId, personWork.id, {state:'ready'});
// The generated adapter must remain unavailable in an ordinary app process.
const normalPort = await freePort();
const normal = spawn(process.execPath, [join(workspace, 'server/server.mjs')], { env: { ...process.env, PORT: String(normalPort), HOST: '127.0.0.1', DATA_DIR: join(root, 'normal-app-data'), ALUDEL_REVIEW_PREVIEW: '', ALUDEL_REVIEW_TOKEN: '' }, stdio: 'ignore' });
try {
  for (const deadline = Date.now() + 10000; ;) {
    try { if ((await fetch(`http://127.0.0.1:${normalPort}/api/health`)).ok) break; } catch {}
    if (Date.now() > deadline) throw new Error('Normal app did not start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal((await fetch(`http://127.0.0.1:${normalPort}/api/__aludel/review`, { method: 'POST', body: '{}' })).status, 404);
} finally { normal.kill(); await new Promise(resolve => normal.once('exit', resolve)); }
const port = await freePort();
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_SYMPHONY_WORKSPACE_ROOT: workerRoot, MACHINE_SYMPHONY_DISPATCH: '', MACHINE_LAYER_TEMPLATES_ENABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', chunk => serverLog += chunk); server.stderr.on('data', chunk => serverLog += chunk);
const portal = `http://aludel.localhost:${port}`, errors = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/home/henry/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome' });
try {
  for (const deadline=Date.now()+60000; !/listening|http:\/\//i.test(serverLog) && Date.now()<deadline;) await new Promise(resolve=>setTimeout(resolve,100));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const signIn = await context.request.post(`${portal}/api/sign-in`, { data: { email: 'owner@example.com', password } }); assert.ok(signIn.ok(), await signIn.text());
  const page = await context.newPage(); page.on('pageerror', error=>errors.push(error.message));
  await page.goto(`${portal}/p/${project.slug}/work/item/${work.id}/review/1`);
  await page.getByRole('heading', {name:/Review W-\d+ · Run 1/}).waitFor();
  await page.getByRole('button',{name:/Walk 2 journey steps in Preview/}).click({timeout:120000});
  const authorButton = page.getByRole('button',{name:'Review the post editor'});
  try { await authorButton.waitFor({timeout:30000}); } catch (error) { await page.screenshot({path:`${out}/failure.png`,fullPage:true}); console.error((await page.locator('body').innerText()).slice(-7000)); console.error('RUN', JSON.stringify((await (await context.request.get(`${portal}/api/projects/${projectId}/work/${work.id}/runs`)).json()).runs[0])); console.error('SERVER', serverLog.slice(-3000)); throw error; }
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Review the post editor')&&!b.disabled),null,{timeout:120000});
  await page.screenshot({path:`${out}/guided-review-wide.png`,fullPage:true});
  const previewFrame = page.frameLocator('iframe[title="Candidate preview"]');
  await authorButton.click();
  await previewFrame.locator('#route').getByText('/posts/demo/edit', {exact:true}).waitFor();
  await previewFrame.getByText('author@demo.invalid', {exact:true}).waitFor();
  await page.screenshot({path:`${out}/author-step.png`,fullPage:true});
  await page.getByRole('button',{name:'Review the viewer page'}).click();
  await previewFrame.locator('#route').getByText('/posts/demo', {exact:true}).waitFor();
  await previewFrame.getByText('viewer@demo.invalid', {exact:true}).waitFor();
  await page.screenshot({path:`${out}/viewer-step.png`,fullPage:true});
  await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'));
  const violations = await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id)); assert.deepEqual(violations,[]);
  await page.setViewportSize({width:390,height:844}); await page.screenshot({path:`${out}/guided-review-narrow.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'narrow viewport has no horizontal overflow');
  for (const name of ['Refresh against latest', 'Rebuild checks']) { const box = await page.getByRole('button', {name,exact:true}).boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= 390, `${name} is fully visible at 390px`); }
  const apiBase = `${portal}/api/projects/${projectId}/work/${work.id}/runs/${attemptId}`;
  const detail = (await (await context.request.get(`${portal}/api/projects/${projectId}/work/${work.id}/runs`)).json()).runs[0];
  const wrong = await context.request.put(`${apiBase}/review`,{data:{integrationId:'old',verdict:{index:0,value:'accept'}}}); assert.equal(wrong.status(),409);
  const correct = await context.request.put(`${apiBase}/review`,{data:{integrationId:detail.integration.id,verdict:{index:0,value:'reject',note:'Keep this durable note'}}}); assert.ok(correct.ok());
  const refreshed = await context.request.post(`${apiBase}/prepare`,{data:{}}); assert.ok(refreshed.ok()); assert.equal((await refreshed.json()).run.review.verdicts['note-1'].note,'Keep this durable note','unchanged refresh preserves notes, kept by claim ID');
  const rebuilt = await context.request.post(`${apiBase}/prepare`, {data:{rebuild:true}}); assert.ok(rebuilt.ok());
  const revised = (await rebuilt.json()).run; assert.notEqual(revised.integration.id, detail.integration.id); assert.deepEqual(revised.review.verdicts, {});
  assert.equal(revised.steps.at(-1).previousReview.verdicts['note-1'].note, 'Keep this durable note', 'new evidence preserves prior observations in history');
  const built = await context.request.post(`${apiBase}/preview`, {data:{integrationId:revised.integration.id}}); assert.ok(built.ok(), await built.text());
  for (const index of [0, 1]) assert.ok((await context.request.put(`${apiBase}/review`, {data:{integrationId:revised.integration.id,verdict:{index,value:'accept'}}})).ok());
  const accepted = await context.request.post(`${apiBase}/sign`, {data:{integrationId:revised.integration.id,outcome:'accept'}}); assert.ok(accepted.ok(), await accepted.text());
  assert.equal(git(workspace, 'rev-parse', 'main'), revised.integration.commit, 'accept advances only the exact reviewed Code commit');
  const secondBase = `${portal}/api/projects/${projectId}/work/${second.id}/runs/${secondAttempt}`;
  const combinedResponse = await context.request.post(`${secondBase}/prepare`, {data:{}}); assert.ok(combinedResponse.ok(), await combinedResponse.text());
  const combined = (await combinedResponse.json()).run;
  assert.equal(combined.layerSource.base, detail.layerSource.base, 'both Code branches started at the same accepted base');
  assert.equal(combined.integration.base, revised.integration.commit);
  assert.match(git(workspace, 'show', `${combined.integration.commit}:src/review-page.html`), /Candidate review demo/);
  assert.match(git(workspace, 'show', `${combined.integration.commit}:src/review-companion.mjs`), /companion/);
  assert.equal(git(workspace, 'rev-parse', 'main'), revised.integration.commit, 'preparing the second review does not mutate main');
  const secondBuildResponse = await context.request.post(`${secondBase}/preview`, {data:{integrationId:combined.integration.id}}); assert.ok(secondBuildResponse.ok(), await secondBuildResponse.text());
  const secondBuild = (await secondBuildResponse.json()).preview; assert.ok(secondBuild.checks.every(check => check.status === 'passed'));
  assert.equal((await (await context.request.get(`${secondBuild.url}/api/session`)).json()).account, null, 'a second candidate never inherits the first candidate session');
  const secondStep = await context.request.post(`${secondBase}/scenario`, {data:{integrationId:combined.integration.id,step:'edit-post.editor'}}); assert.ok(secondStep.ok());
  const secondPage = await context.newPage(); await secondPage.goto((await secondStep.json()).url); await secondPage.getByText('author@demo.invalid', {exact:true}).waitFor(); await secondPage.close();
  assert.ok((await context.request.put(`${secondBase}/review`, {data:{integrationId:combined.integration.id,verdict:{index:0,value:'accept'}}})).ok());
  const secondAccept = await context.request.post(`${secondBase}/sign`, {data:{integrationId:combined.integration.id,outcome:'accept'}}); assert.ok(secondAccept.ok(), await secondAccept.text());
  assert.equal(git(workspace, 'rev-parse', 'main'), combined.integration.commit);
  await page.goto(`${portal}/p/${project.slug}/work/item/${conflict.id}/review/1`);
  await page.getByText('The submission conflicts with the accepted repository. Send it back for resolution.', {exact:true}).waitFor();
  await page.getByRole('button', {name:/^Flag( it)?$/}).click();
  await page.getByLabel(/What is wrong/).fill('Resolve this against the accepted page.');
  await page.getByRole('button', {name:'Save flag',exact:true}).click();
  await page.locator('.wr-pickbtn').click(); await page.locator('.wr-menu').getByRole('button', {name:/^Finish/}).click();
  await page.getByRole('button', {name:/Send back to/}).click();
  await page.waitForURL(new RegExp(`/work/item/${conflict.id}$`));
  assert.equal(git(workspace, 'rev-parse', 'main'), combined.integration.commit, 'rejecting an unprepared conflicting submission changes no accepted bytes');


  // Person work uses the same genuine lifecycle through visible controls, never a fabricated proposal.
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${portal}/p/${project.slug}/work/item/${personWork.id}`);
  await page.getByRole('button', {name:'Stage in your batch',exact:true}).click();
  await page.getByRole('button', {name:"I'm working",exact:true}).click();
  await page.getByRole('button', {name:'Ready for review',exact:true}).waitFor();
  const personCheckout = join(root, 'person-candidate');
  git(root, 'clone', '-q', workspace, personCheckout);
  git(personCheckout, 'checkout', '-q', '-b', 'person-review');
  writeFileSync(join(personCheckout,'src/person-review.mjs'),'export const personReview = true;\n');
  git(personCheckout, 'add', '.');
  git(personCheckout, '-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','A person candidate');
  const personCommit = git(personCheckout,'rev-parse','HEAD');
  git(workspace,'fetch','-q',personCheckout,'person-review:person-review');
  await page.getByRole('button', {name:'Ready for review',exact:true}).click();
  await page.getByLabel('Local branch',{exact:true}).fill('person-review');
  await page.getByLabel('Exact commit',{exact:true}).fill(personCommit);
  await page.getByLabel('What is ready for review',{exact:true}).fill('A genuine person-performed repository submission.');
  await page.locator('#person-evidence-note-1').fill('Open the author editor without a manual login.');
  await page.locator('#person-evidence-note-2').fill('Open the viewer page without navigating.');
  await page.getByLabel("If its step tests won't pass yet, say why (optional)").fill('The viewer step has no test yet; the next slice writes one.');
  await page.getByRole('button',{name:'Submit for review',exact:true}).click();
  await page.getByRole('link',{name:/Review/}).filter({hasText:'Review'}).first().waitFor();
  const personRuns = (await (await context.request.get(`${portal}/api/projects/${projectId}/work/${personWork.id}/runs`)).json()).runs;
  assert.equal(personRuns[0].state,'review');
  assert.equal(personRuns[0].performer.kind,'person');
  assert.equal(personRuns[0].layerSource.commit,personCommit);
  assert.equal(personRuns[0].proposalId,null);
  assert.equal(git(workspace,'rev-parse','main'),combined.integration.commit,'person submission does not change accepted code');
  await page.getByRole('link',{name:'Work',exact:true}).first().click();
  await page.getByRole('tab',{name:/^Done/}).click();
  await page.locator('[role=tabpanel][aria-labelledby=sub-done]').getByRole('link',{name:personWork.title,exact:true}).click();
  await page.getByRole('link',{name:/Review/}).filter({hasText:'Review'}).first().click();
  await page.getByRole('heading',{name:/Review W-\d+ · Run 1/}).waitFor();
  // The journey claim comes first, with its step's proof on this build and the person's reason beside it.
  await page.getByText('Step tests on this build: No test').waitFor({timeout:120000});
  await page.getByText('The viewer step has no test yet; the next slice writes one.').waitFor();
  await page.screenshot({path:`${out}/person-review-claim.png`,fullPage:true});
  await page.getByRole('button',{name:/Walk 1 step in Preview/}).click();
  await page.getByRole('button',{name:'Review the post editor'}).waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Review the post editor')&&!b.disabled),null,{timeout:120000});
  await page.getByRole('button',{name:'Review the post editor'}).click();
  await page.frameLocator('iframe[title="Candidate preview"]').getByText('author@demo.invalid',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Review the viewer page'}).click();
  await page.frameLocator('iframe[title="Candidate preview"]').getByText('viewer@demo.invalid',{exact:true}).waitFor();
  await page.screenshot({path:`${out}/person-review.png`,fullPage:true});
  const personBase = `${portal}/api/projects/${projectId}/work/${personWork.id}/runs/${personRuns[0].id}`;
  const personReview = (await (await context.request.get(`${portal}/api/projects/${projectId}/work/${personWork.id}/runs`)).json()).runs[0];
  assert.deepEqual(personReview.task.criteria.map(claim=>claim.id),['read-post-steps','note-1','note-2']);
  assert.deepEqual([personReview.proofs['read-post-steps'].status, personReview.gate.map(entry=>entry.reason)],['uncovered',['The viewer step has no test yet; the next slice writes one.']]);
  await page.getByRole('button',{name:'Sign off'}).click();
  await page.getByText(/Accepting signs over 1 unproven claim that Charles gave a reason for/).waitFor();
  await page.screenshot({path:`${out}/person-review-signoff.png`,fullPage:true});
  for(const claim of ['read-post-steps','note-1','note-2']) assert.ok((await context.request.put(`${personBase}/review`,{data:{integrationId:personReview.integration.id,verdict:{claim,value:'accept'}}})).ok());
  const personAccepted = await context.request.post(`${personBase}/sign`,{data:{integrationId:personReview.integration.id,outcome:'accept'}});
  assert.ok(personAccepted.ok(),await personAccepted.text());
  assert.equal(git(workspace,'rev-parse','main'),personReview.integration.commit);

  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: generic Code review prepares/builds on open; author/viewer steps require no manual login/navigation; stale generation refused; notes survive unchanged refresh and remain in rebuild history; two Code branches integrate serially; person work stages, starts, submits an exact branch, appears in Done, previews both roles and accepts through the same guards; wide/narrow and axe pass.');
} catch (error) { console.error('SERVER', serverLog.slice(-4000)); throw error; } finally {
  // A portal that already exited (say, failing at startup) has no exit left to wait for; its log is printed above.
  await browser.close(); server.kill(); if (server.exitCode === null && server.signalCode === null) await new Promise(resolve=>server.once('exit',resolve));
  for(const row of db.prepare('SELECT id FROM layer_review_integrations').all()) {
    try { execFileSync('docker',['image','rm',previewImageName(join(root,'review-workspaces'),'review',row.id)],{stdio:'ignore'}); } catch {}
  }
  db.close(); rmSync(root,{recursive:true,force:true});
}
